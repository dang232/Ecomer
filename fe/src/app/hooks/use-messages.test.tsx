import { renderHook, waitFor, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type UnknownCall = (...args: unknown[]) => unknown;

const useAuthMock = vi.fn<() => unknown>();
vi.mock("./auth-context", () => ({
  useAuth: () => useAuthMock(),
}));

const listMessagesMock = vi.fn<UnknownCall>();
const sendMessageMock = vi.fn<UnknownCall>();
const markThreadReadMock = vi.fn<UnknownCall>();
vi.mock("@/shared/api/endpoints/messaging", async (importActual) => {
  const actual: object = await importActual();
  return {
    ...actual,
    listMessages: (...args: unknown[]) => listMessagesMock(...args),
    sendMessage: (...args: unknown[]) => sendMessageMock(...args),
    markThreadRead: (...args: unknown[]) => markThreadReadMock(...args),
  };
});

import { makeWrapper } from "@/shared/test/render-with-query-client";

import { messagesKey, useMessages, useSendMessage } from "./use-messages";

const buildPage = (
  content: { id: string; threadId: string; senderId: string; body: string; sentAt: string }[],
) => ({
  content,
  nextCursor: null,
  hasMore: false,
});

beforeEach(() => {
  useAuthMock.mockReturnValue({ ready: true, authenticated: true });
  listMessagesMock.mockReset();
  sendMessageMock.mockReset();
  markThreadReadMock.mockReset();
});

afterEach(() => vi.clearAllMocks());

describe("useMessages", () => {
  it("does not fetch until auth is ready", () => {
    useAuthMock.mockReturnValue({ ready: false, authenticated: false });
    const { Wrapper } = makeWrapper();
    renderHook(() => useMessages("t1"), { wrapper: Wrapper });
    expect(listMessagesMock).not.toHaveBeenCalled();
  });

  it("does not fetch when threadId is missing", () => {
    const { Wrapper } = makeWrapper();
    renderHook(() => useMessages(undefined), { wrapper: Wrapper });
    expect(listMessagesMock).not.toHaveBeenCalled();
  });

  it("loads the latest page for the given thread with the configured limit", async () => {
    listMessagesMock.mockResolvedValue(
      buildPage([
        { id: "m1", threadId: "t1", senderId: "alice", body: "hi", sentAt: "2026-05-17T00:00:00Z" },
      ]),
    );
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useMessages("t1", 25), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.data?.content).toHaveLength(1));
    expect(listMessagesMock).toHaveBeenCalledWith("t1", { limit: 25 });
  });
});

describe("useSendMessage optimistic flow", () => {
  it("inserts a placeholder, swaps it for the saved message on success, and invalidates the thread list", async () => {
    const { client, Wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(client, "invalidateQueries");

    sendMessageMock.mockResolvedValue({
      id: "m1",
      threadId: "t1",
      senderId: "alice",
      body: "hi",
      sentAt: "2026-05-17T00:00:00Z",
    });

    const { result } = renderHook(() => useSendMessage("t1"), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ body: "hi" });
    });

    const cache = client.getQueryData<{ content: { id: string }[] }>(messagesKey("t1"))!;
    expect(cache.content[0].id).toBe("m1");
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["messaging", "threads"] });
  });

  it("rolls back the placeholder when the POST fails", async () => {
    const { client, Wrapper } = makeWrapper();
    sendMessageMock.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useSendMessage("t1"), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ body: "should disappear" }).catch(() => undefined);
    });

    const cache = client.getQueryData<{ content: { id: string }[] }>(messagesKey("t1"));
    expect(cache?.content ?? []).toHaveLength(0);
  });
});
