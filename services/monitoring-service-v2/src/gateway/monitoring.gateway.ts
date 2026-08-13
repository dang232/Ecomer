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

@WebSocketGateway({
  namespace: '/ws/monitoring',
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

  constructor(private readonly config: ConfigService) {
    const jwkSetUri = this.config.get<string>(
      'app.keycloak.jwkSetUri',
      'http://keycloak:8080/realms/vnshop/protocol/openid-connect/certs',
    );
    this.adminRole = this.config.get<string>('app.keycloak.adminRole', 'ADMIN');

    this.jwksClient = jwksRsa({
      jwksUri: jwkSetUri,
      cache: true,
      rateLimit: true,
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
      if (!roles?.roles?.includes(this.adminRole)) {
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

      jwt.verify(token, getKey, { algorithms: ['RS256'] }, (err, decoded) => {
        if (err) return resolve(null);
        resolve(decoded as Record<string, unknown>);
      });
    });
  }
}
