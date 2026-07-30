import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn();
const useAppConfigMock = vi.fn();
vi.mock("./auth-context", () => ({
  useAuth: () => useAuthMock(),
}));
vi.mock("./use-app-config", () => ({
  useAppConfig: () => useAppConfigMock(),
}));

import { makeWrapper } from "@/shared/test/render-with-query-client";

import { useMessagingSocket } from "./use-messaging-socket";

class FakeWebSocket {
  static readonly instances: FakeWebSocket[] = [];
  static readonly OPEN = 1;
  static readonly CONNECTING = 0;

  readonly OPEN = FakeWebSocket.OPEN;
  readonly CONNECTING = FakeWebSocket.CONNECTING;
  readonly url: string;
  readonly protocols: string | string[] | undefined;
  readyState = FakeWebSocket.CONNECTING;

  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.protocols = protocols;
    FakeWebSocket.instances.push(this);
  }

  addEventListener(): void {}

  close(): void {
    this.readyState = 3;
  }

  send(): void {}
}

const originalWebSocket = globalThis.WebSocket;

beforeEach(() => {
  useAuthMock.mockReturnValue({ ready: true, authenticated: true, token: "jwt-token" });
  useAppConfigMock.mockReturnValue({
    websocket: { messagingUri: "wss://api.vnshop.invalid/ws/messaging" },
  });
  FakeWebSocket.instances.length = 0;
  globalThis.WebSocket = FakeWebSocket as unknown as typeof WebSocket;
});

afterEach(() => {
  globalThis.WebSocket = originalWebSocket;
  vi.clearAllMocks();
});

describe("useMessagingSocket", () => {
  it("sends authentication through a subprotocol instead of the URL", () => {
    const { Wrapper } = makeWrapper();
    const { unmount } = renderHook(() => useMessagingSocket(), { wrapper: Wrapper });

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(FakeWebSocket.instances[0].url).toBe("wss://api.vnshop.invalid/ws/messaging");
    expect(FakeWebSocket.instances[0].url).not.toContain("token=");
    expect(FakeWebSocket.instances[0].protocols).toEqual(["vnshop-auth", "vnshop-jwt.jwt-token"]);

    unmount();
    expect(FakeWebSocket.instances[0].readyState).toBe(3);
  });
});
