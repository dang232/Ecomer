import type { IncomingMessage } from "node:http";

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
