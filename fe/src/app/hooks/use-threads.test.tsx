import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn();
vi.mock("./auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

const listThreadsMock = vi.fn();
vi.mock("@/shared/api/endpoints/messaging", async (importActual) => {
  const actual: object = await importActual();
  return {
    ...actual,
    listThreads: (...args: unknown[]) => listThreadsMock(...args),
  };
});

import { makeWrapper } from "@/shared/test/render-with-query-client";

import { useThreads } from "./use-threads";

beforeEach(() => {
  useAuthMock.mockReturnValue({ ready: true, authenticated: true });
  listThreadsMock.mockReset();
});

afterEach(() => vi.clearAllMocks());

describe("useThreads", () => {
  it("does not fetch when unauthenticated", () => {
    useAuthMock.mockReturnValue({ ready: true, authenticated: false });
    const { Wrapper } = makeWrapper();
    renderHook(() => useThreads(), { wrapper: Wrapper });
    expect(listThreadsMock).not.toHaveBeenCalled();
  });

  it("returns thread items and rolls up unread counts", async () => {
    listThreadsMock.mockResolvedValue({
      content: [
        {
          id: "t1",
          buyerId: "alice",
          sellerId: "zoe",
          otherPartyId: "zoe",
          productId: null,
          lastMessageAt: "2026-05-17T00:00:00Z",
          lastMessageBody: "Hi",
          lastMessageSenderId: "zoe",
          unreadCount: 3,
        },
        {
          id: "t2",
          buyerId: "alice",
          sellerId: "bob",
          otherPartyId: "bob",
          productId: "P1",
          lastMessageAt: "2026-05-16T00:00:00Z",
          lastMessageBody: null,
          lastMessageSenderId: null,
          unreadCount: 0,
        },
      ],
    });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useThreads(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.totalUnread).toBe(3);
  });
});
