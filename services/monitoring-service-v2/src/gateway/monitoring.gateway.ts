import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import * as jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';
import { ConfigService } from '@nestjs/config';
import type { Namespace } from 'socket.io';

@WebSocketGateway({
  namespace: '/ws/monitoring',
  path: '/monitoring/socket.io',
  cors: {
    origin: (process.env.CORS_ORIGINS ?? 'http://localhost:8096,http://localhost:3000').split(','),
    credentials: true,
  },
})
export class MonitoringGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(MonitoringGateway.name);
  private readonly jwksClient: jwksRsa.JwksClient;
  private readonly adminRole: string;
  private readonly issuer: string;
  private readonly audience: string;

  constructor(private readonly config: ConfigService) {
    const jwkSetUri = this.config.get<string>(
      'app.keycloak.jwkSetUri',
      'http://keycloak:8080/realms/vnshop/protocol/openid-connect/certs',
    );
    this.adminRole = this.config.get<string>('app.keycloak.adminRole', 'ADMIN');
    this.issuer = this.config.get<string>('app.keycloak.issuerUri', 'http://localhost:9090/realms/vnshop');
    this.audience = this.config.get<string>('app.keycloak.audience', 'vnshop-api');

    this.jwksClient = jwksRsa({
      jwksUri: jwkSetUri,
      cache: true,
      rateLimit: true,
    });
  }

  afterInit(namespace: Namespace): void {
    namespace.use((socket, next) => {
      const token = (socket.handshake.auth?.token ?? socket.handshake.query['token']) as string | undefined;
      if (!token) {
        next(new Error('Unauthorized'));
        return;
      }
      void this.verifyToken(token).then((payload) => {
        const roles = payload?.realm_access as { roles?: string[] } | undefined;
        const authorized = roles?.roles?.some((role) => role.toUpperCase() === this.adminRole.toUpperCase()) ?? false;
        if (!authorized) {
          next(new Error('Forbidden'));
          return;
        }
        socket.data.tokenPayload = payload;
        next();
      }).catch(() => next(new Error('Unauthorized')));
    });
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = (client.handshake.auth?.token ?? client.handshake.query['token']) as string | undefined;
      if (!token) {
        client.disconnect(true);
        return;
      }

      const payload = await this.verifyToken(token);
      if (!payload) {
        client.disconnect(true);
        return;
      }

      const roles = (payload as Record<string, unknown>).realm_access as { roles?: string[] } | undefined;
      if (!roles?.roles?.some((role) => role.toUpperCase() === this.adminRole.toUpperCase())) {
        client.disconnect(true);
        return;
      }

      this.logger.log(`Client connected: ${client.id}`);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @OnEvent('service.status')
  handleServiceStatus(payload: { serviceId: string; status: string; responseMs: number; timestamp: Date }) {
    this.server?.emit('service:status', payload);
  }

  @OnEvent('service.alert')
  handleServiceAlert(payload: { serviceId: string; type: string; message: string; timestamp: Date }) {
    this.server?.emit('service:alert', payload);
  }

  private async verifyToken(token: string): Promise<Record<string, unknown> | null> {
    return new Promise((resolve) => {
      const getKey = (header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) => {
        this.jwksClient.getSigningKey(header.kid, (err, key) => {
          if (err || !key) return callback(err ?? new Error('No key'));
          callback(null, key.getPublicKey());
        });
      };

      jwt.verify(token, getKey, { algorithms: ['RS256'], issuer: this.issuer, audience: this.audience }, (err, decoded) => {
        if (err) return resolve(null);
        if (!decoded || typeof decoded !== 'object' || typeof decoded.sub !== 'string' || decoded.sub.trim() === '') {
          return resolve(null);
        }
        resolve(decoded as Record<string, unknown>);
      });
    });
  }
}
