import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import { CONNECTION_REGISTRY_PORT } from '../../domain/port/outbound/connection-registry.port';
import type { ConnectionRegistryPort } from '../../domain/port/outbound/connection-registry.port';
import { NOTIFICATION_REPOSITORY } from '../../domain/port/outbound/notification.repository';
import type { NotificationRepository } from '../../domain/port/outbound/notification.repository';
import { NOTIFICATION_PREFERENCES_REPOSITORY } from '../../domain/port/outbound/notification-preferences.repository';
import type { NotificationPreferencesRepository } from '../../domain/port/outbound/notification-preferences.repository';
import { NotificationChannel } from '../../domain/model/notification-preferences';
import { DeliveryStatusValue } from '../../domain/model/delivery-status';

@WebSocketGateway({
  namespace: '/ws/notifications',
  cors: {
    origin: (
      process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:5173'
    ).split(','),
    credentials: true,
  },
  pingInterval: 25000,
  pingTimeout: 10000,
})
export class SocketioNotificationGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(SocketioNotificationGateway.name);
  private readonly jwksClient: jwksRsa.JwksClient;
  private readonly issuer: string;
  private readonly audience: string;

  constructor(
    private readonly configService: ConfigService,
    @Inject(CONNECTION_REGISTRY_PORT)
    private readonly connectionRegistry: ConnectionRegistryPort,
    @Inject(NOTIFICATION_REPOSITORY)
    private readonly notificationRepo: NotificationRepository,
    @Inject(NOTIFICATION_PREFERENCES_REPOSITORY)
    private readonly preferencesRepo: NotificationPreferencesRepository,
  ) {
    const jwkSetUri = this.configService.get<string>(
      'KEYCLOAK_JWK_SET_URI',
      'http://localhost:8085/realms/vnshop/protocol/openid-connect/certs',
    );
    this.jwksClient = jwksRsa({
      jwksUri: jwkSetUri,
      cache: true,
      rateLimit: true,
    });
    this.issuer = this.configService.get<string>('KEYCLOAK_ISSUER_URI', 'http://localhost:9090/realms/vnshop');
    this.audience = this.configService.get<string>('KEYCLOAK_JWT_AUDIENCE', 'vnshop-api');
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = (client.handshake.auth?.token ??
        client.handshake.query['token']) as string | undefined;
      if (!token) {
        client.disconnect(true);
        return;
      }

      const userId = await this.verifyToken(token);
      if (!userId) {
        client.disconnect(true);
        return;
      }

      (client as Socket & { userId: string }).userId = userId;
      await this.connectionRegistry.register(userId, client.id);
      void client.join(`user:${userId}`);

      // Refresh registration every 30s to keep TTL alive
      const refreshInterval = setInterval(() => {
        void this.connectionRegistry.refreshRegistration(userId);
      }, 30_000);
      refreshInterval.unref?.();
      (client.data as { refreshInterval?: NodeJS.Timeout }).refreshInterval =
        refreshInterval;

      // Drain offline queue and send catch-up notifications
      const offlineIds =
        await this.connectionRegistry.drainOfflineQueue(userId);
      /* istanbul ignore next */
      if (offlineIds.length > 0) {
        const notifications = await this.notificationRepo.findByIds(offlineIds);

        /* istanbul ignore next */
        if (notifications.length > 0) {
          // Filter out notifications whose type has IN_APP disabled in current preferences
          const preferences = await this.preferencesRepo.findByUserId(userId);
          const filtered = preferences
            ? notifications.filter((n) =>
                preferences.isChannelEnabled(
                  n.type,
                  NotificationChannel.IN_APP,
                ),
              )
            : notifications;

          /* istanbul ignore next */
          if (filtered.length > 0) {
            client.emit('notification:catch-up', filtered);
          }
        }
      }

      this.logger.log(`Connected: ${client.id} userId=${userId}`);
    } catch (error) {
      this.logger.warn(`Connection rejected: ${client.id} - ${String(error)}`);
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const userId = (client as Socket & { userId?: string }).userId;
    const interval = (client.data as { refreshInterval?: NodeJS.Timeout })
      .refreshInterval;
    if (interval) clearInterval(interval);

    if (userId) {
      try {
        await this.connectionRegistry.unregister(userId, client.id);
        this.logger.log(`Disconnected: ${client.id} userId=${userId}`);
      } catch (err) {
        this.logger.warn(`Failed to unregister ${client.id}: ${err}`);
      }
    }
  }

  @SubscribeMessage('notification:ack')
  async handleAck(client: Socket, payload: { ids: string[] }): Promise<void> {
    const userId = (client as Socket & { userId?: string }).userId;
    if (!userId || !Array.isArray(payload?.ids) || payload.ids.length === 0)
      return;

    // Cap batch size to prevent abuse
    const ids = payload.ids.slice(0, 100);

    for (const id of ids) {
      try {
        const notification = await this.notificationRepo.findByIdAndUserId(
          id,
          userId,
        );
        if (!notification) continue;
        if (notification.deliveryStatus.getValue() !== DeliveryStatusValue.SENT)
          continue;

        notification.markDelivered();
        await this.notificationRepo.save(notification);
      } catch (err) {
        this.logger.warn(`Failed to ACK notification ${id}: ${err}`);
      }
    }
  }

  private verifyToken(token: string): Promise<string | null> {
    return new Promise((resolve) => {
      jwt.verify(
        token,
        (header, callback) => {
          this.jwksClient.getSigningKey(header.kid, (err, key) => {
            /* istanbul ignore next */
            if (err || !key) {
              callback(err ?? new Error('No signing key'));
              return;
            }
            callback(null, key.getPublicKey());
          });
        },
        { algorithms: ['RS256'], issuer: this.issuer, audience: this.audience },
        (err, decoded) => {
          if (err || !decoded) {
            resolve(null);
            return;
          }
          const subject = (decoded as jwt.JwtPayload).sub;
          resolve(typeof subject === 'string' && subject.length > 0 ? subject : null);
        },
      );
    });
  }
}
