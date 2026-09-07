import type { IncomingMessage } from "node:http";
import type { WebSocket, WebSocketServer } from "ws";

import { MessagingWsGateway } from "./messaging-ws.gateway";
import type { WsJwtVerifier } from "./auth/ws-jwt.verifier";

type TokenExtractor = {
  extractToken(request: IncomingMessage): string | null;
};

const extractToken = (gateway: MessagingWsGateway, request: IncomingMessage) =>
  (gateway as unknown as TokenExtractor).extractToken(request);

const request = (
  headers: IncomingMessage["headers"],
  url = "/ws/messaging",
): IncomingMessage => ({ headers, url }) as IncomingMessage;

describe("MessagingWsGateway WebSocket authentication", () => {
  const gateway = new MessagingWsGateway({} as WsJwtVerifier);

  it("prefers the bearer authorization header", () => {
    expect(
      extractToken(
        gateway,
        request({
          authorization: "Bearer header-token",
          "sec-websocket-protocol": "vnshop-auth, vnshop-jwt.subprotocol-token",
        }),
      ),
    ).toBe("header-token");
  });

  it("extracts the token from the WebSocket subprotocol", () => {
    expect(
      extractToken(
        gateway,
        request({
          "sec-websocket-protocol": "vnshop-auth, vnshop-jwt.subprotocol-token",
        }),
      ),
    ).toBe("subprotocol-token");
  });

  it("supports the legacy query-token fallback", () => {
    expect(
      extractToken(gateway, request({}, "/ws/messaging?token=legacy-token")),
    ).toBe("legacy-token");
  });

  it("returns null when no token is provided", () => {
    expect(extractToken(gateway, request({}))).toBeNull();
  });
});

describe("MessagingWsGateway keepalive", () => {
  const socketsByUser = (gateway: MessagingWsGateway) =>
    (gateway as unknown as { socketsByUser: Map<string, Set<WebSocket>> })
      .socketsByUser;

  afterEach(() => {
    jest.useRealTimers();
  });

  it("terminates and evicts a socket that does not pong", async () => {
    jest.useFakeTimers();
    const verifier = { verify: jest.fn().mockResolvedValue({ sub: "user-1" }) } as unknown as WsJwtVerifier;
    const gateway = new MessagingWsGateway(verifier);
    const socket = {
      OPEN: 1,
      readyState: 1,
      on: jest.fn(),
      ping: jest.fn(),
      send: jest.fn(),
      terminate: jest.fn(),
    } as unknown as WebSocket;

    await gateway.handleConnection(
      socket,
      { ...request({ authorization: "Bearer token" }), socket: {} } as IncomingMessage,
    );
    gateway.afterInit({} as WebSocketServer);

    jest.advanceTimersByTime(30_000);
    expect(socket.ping).toHaveBeenCalledTimes(1);
    expect(socket.terminate).not.toHaveBeenCalled();

    jest.advanceTimersByTime(30_000);
    expect(socket.terminate).toHaveBeenCalledTimes(1);
    expect(socketsByUser(gateway).has("user-1")).toBe(false);

    gateway.onModuleDestroy();
  });
});
