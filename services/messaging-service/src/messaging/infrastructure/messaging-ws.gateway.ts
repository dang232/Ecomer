import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  forwardRef,
} from "@nestjs/common";
import {
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { IncomingMessage } from "node:http";
import { URL } from "node:url";
import { WebSocket, WebSocketServer as WsServer } from "ws";
import { TokenExpiredError, WsJwtVerifier } from "./auth/ws-jwt.verifier";

/**
 * `ws`-backed gateway. Each socket is bound to one user (Keycloak `sub`)
 * after a JWT handshake. The Kafka consumer calls {@link dispatch} when a
 * message lands; we look up the open sockets for that user and push.
 *
 * Per-pod fan-out only — cross-pod delivery is what Kafka is for.
 *
 * Why a custom gateway instead of `@SubscribeMessage` handlers? The handshake
 * happens during HTTP upgrade, before passport-jwt can decorate the request,
 * so we have to verify the token ourselves. Once verified we don't need any
 * client-to-server message routing — clients are subscribers, sending happens
 * over REST.
 */
@WebSocketGateway({ path: "/ws/messaging" })
@Injectable()
export class MessagingWsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  private static readonly KEEPALIVE_INTERVAL_MS = 30_000;
  private readonly logger = new Logger(MessagingWsGateway.name);
  private readonly socketsByUser = new Map<string, Set<WebSocket>>();
  private readonly userBySocket = new WeakMap<WebSocket, string>();
  private readonly socketAlive = new WeakMap<WebSocket, boolean>();
  private keepaliveTimer?: ReturnType<typeof setInterval>;

  @WebSocketServer()
  server!: WsServer;

  constructor(
    @Inject(forwardRef(() => WsJwtVerifier))
    private readonly verifier: WsJwtVerifier,
  ) {}

  afterInit(server: WsServer): void {
    this.server = server;
    this.keepaliveTimer = setInterval(
      () => this.checkSocketLiveness(),
      MessagingWsGateway.KEEPALIVE_INTERVAL_MS,
    );
  }

  onModuleDestroy(): void {
    if (this.keepaliveTimer) clearInterval(this.keepaliveTimer);
    this.keepaliveTimer = undefined;
    for (const sockets of this.socketsByUser.values()) {
      for (const socket of sockets) {
        socket.terminate();
      }
    }
    this.socketsByUser.clear();
  }

  async handleConnection(
    client: WebSocket,
    request: IncomingMessage,
  ): Promise<void> {
    const clientIp = this.extractClientIp(request);
    try {
      const token = this.extractToken(request);
      if (!token) {
        this.refuse(client, 4401, "missing_token");
        return;
      }
      const payload = await this.verifier.verify(token);
      const userId = payload.sub;
      this.bind(client, userId);
      client.send(
        JSON.stringify({ type: "hello", userId, ts: new Date().toISOString() }),
      );
    } catch (err) {
      if (err instanceof TokenExpiredError) {
        this.verifier.logRejection(clientIp, (err as Error).message);
        this.refuse(client, 4001, "token_expired");
      } else {
        this.verifier.logRejection(clientIp, (err as Error).message);
        this.refuse(client, 4401, "invalid_token");
      }
    }
  }

  handleDisconnect(client: WebSocket): void {
    const userId = this.userBySocket.get(client);
    if (!userId) return;
    const set = this.socketsByUser.get(userId);
    if (!set) return;
    set.delete(client);
    if (set.size === 0) this.socketsByUser.delete(userId);
  }

  /**
   * Push a message event to every socket bound to the given user. Called by
   * `KafkaMessageConsumer` once the broker delivers an event.
   */
  dispatch(userId: string, payload: unknown): void {
    const set = this.socketsByUser.get(userId);
    if (!set) return;
    const wireFormat = JSON.stringify({ type: "message", payload });
    for (const socket of set) {
      if (socket.readyState === socket.OPEN) {
        try {
          socket.send(wireFormat);
        } catch {
          // Drop quietly — the disconnect handler will clean up.
        }
      }
    }
  }

  private extractToken(request: IncomingMessage): string | null {
    const auth = request.headers.authorization;
    if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();

    const protocols = request.headers["sec-websocket-protocol"];
    const protocolHeader = Array.isArray(protocols)
      ? protocols.join(",")
      : protocols;
    const jwtProtocol = protocolHeader
      ?.split(",")
      .map((value) => value.trim())
      .find((value) => value.startsWith("vnshop-jwt."));
    if (jwtProtocol) {
      const token = jwtProtocol.slice("vnshop-jwt.".length).trim();
      if (token) return token;
    }

    const url = new URL(
      request.url ?? "/",
      `http://${request.headers.host ?? "localhost"}`,
    );
    const fromQuery = url.searchParams.get("token");
    // Backward-compatible fallback for clients deployed before subprotocol
    // authentication was introduced. New clients must not use this path.
    return fromQuery ? fromQuery.trim() : null;
  }

  private extractClientIp(request: IncomingMessage): string {
    const forwarded = request.headers["x-forwarded-for"];
    if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
    return request.socket.remoteAddress ?? "unknown";
  }

  private bind(client: WebSocket, userId: string): void {
    let set = this.socketsByUser.get(userId);
    if (!set) {
      set = new Set();
      this.socketsByUser.set(userId, set);
    }
    set.add(client);
    this.userBySocket.set(client, userId);
    this.socketAlive.set(client, true);
    client.on("pong", () => this.socketAlive.set(client, true));
  }

  private checkSocketLiveness(): void {
    for (const sockets of this.socketsByUser.values()) {
      for (const socket of sockets) {
        if (!this.socketAlive.get(socket)) {
          socket.terminate();
          this.handleDisconnect(socket);
          continue;
        }
        this.socketAlive.set(socket, false);
        try {
          socket.ping();
        } catch {
          socket.terminate();
          this.handleDisconnect(socket);
        }
      }
    }
  }

  private refuse(client: WebSocket, code: number, reason: string): void {
    try {
      client.send(JSON.stringify({ type: "error", reason }));
    } catch {
      // Ignore — client may already be in CLOSING.
    }
    client.close(code, reason);
  }
}
