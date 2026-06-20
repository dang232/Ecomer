import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import { type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useAuthMock = vi.fn();
vi.mock("./use-auth", () => ({
  useAuth: () => useAuthMock(),
}));

const listNotificationsMock = vi.fn();
const markNotificationReadMock = vi.fn();
const markAllNotificationsReadMock = vi.fn();
const unreadNotificationCountMock = vi.fn();
vi.mock("../lib/api/endpoints/notifications", () => ({
  listNotifications: (...args: unknown[]) => listNotificationsMock(...args),
  markNotificationRead: (...args: unknown[]) => markNotificationReadMock(...args),
  markAllNotificationsRead: (...args: unknown[]) => markAllNotificationsReadMock(...args),
  unreadNotificationCount: (...args: unknown[]) => unreadNotificationCountMock(...args),
}));

import { useNotifications } from "./use-notifications";
import { makeWrapper } from "../test-utils/render-with-query-client";

const buildPage = (content: { id: string; title: string; read?: boolean }[]) => ({
  content,
  totalElements: content.length,
  totalPages: 1,
  number: 0,
  size: 30,
  first: true,
  last: true,
});


beforeEach(() => {
  useAuthMock.mockReturnValue({ ready: true, authenticated: true });
  listNotificationsMock.mockReset();
  markNotificationReadMock.mockReset();
  markAllNotificationsReadMock.mockReset();
  unreadNotificationCountMock.mockReset();
  unreadNotificationCountMock.mockResolvedValue({ count: 0 });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useNotifications", () => {
  it("does not fetch when keycloak isn't ready", () => {
    useAuthMock.mockReturnValue({ ready: false, authenticated: false });
    const { Wrapper } = makeWrapper();
    renderHook(() => useNotifications(), { wrapper: Wrapper });
    expect(listNotificationsMock).not.toHaveBeenCalled();
    expect(unreadNotificationCountMock).not.toHaveBeenCalled();
  });

  it("does not fetch when unauthenticated", () => {
    useAuthMock.mockReturnValue({ ready: true, authenticated: false });
    const { Wrapper } = makeWrapper();
    renderHook(() => useNotifications(), { wrapper: Wrapper });
    expect(listNotificationsMock).not.toHaveBeenCalled();
    expect(unreadNotificationCountMock).not.toHaveBeenCalled();
  });

  it("returns items from the paged envelope and uses server unread count", async () => {
    listNotificationsMock.mockResolvedValue(
      buildPage([
        { id: "n1", title: "Đơn hàng đã giao", read: false },
        { id: "n2", title: "Khuyến mãi", read: true },
        { id: "n3", title: "Tin mới", read: false },
      ]),
    );
    unreadNotificationCountMock.mockResolvedValue({ count: 2 });
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useNotifications(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.items).toHaveLength(3));
    await waitFor(() => expect(result.current.unreadCount).toBe(2));
  });

  it("falls back to a client-side unread count when the count endpoint fails", async () => {
    listNotificationsMock.mockResolvedValue(
      buildPage([
        { id: "n1", title: "Tin 1" },
        { id: "n2", title: "Tin 2", read: false },
      ]),
    );
    unreadNotificationCountMock.mockRejectedValue(new Error("boom"));
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useNotifications(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.items).toHaveLength(2));
    await waitFor(() => expect(result.current.unreadCount).toBe(1));
  });

  it("markRead calls POST /:id/read and patches the cache without a list refetch", async () => {
    listNotificationsMock.mockResolvedValue(
      buildPage([
        { id: "n1", title: "Một", read: false },
        { id: "n2", title: "Hai", read: false },
      ]),
    );
    unreadNotificationCountMock.mockResolvedValue({ count: 2 });
    markNotificationReadMock.mockResolvedValue({ id: "n1", title: "Một", read: true });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useNotifications(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.items).toHaveLength(2));
    await waitFor(() => expect(result.current.unreadCount).toBe(2));

    await act(async () => {
      result.current.markRead("n1");
    });

    await waitFor(() => expect(result.current.unreadCount).toBe(1));
    expect(markNotificationReadMock).toHaveBeenCalledWith("n1");
    expect(listNotificationsMock).toHaveBeenCalledTimes(1);
  });

  it("markAllRead clears unread count optimistically", async () => {
    listNotificationsMock.mockResolvedValue(
      buildPage([
        { id: "n1", title: "Một", read: false },
        { id: "n2", title: "Hai", read: false },
      ]),
    );
    unreadNotificationCountMock.mockResolvedValue({ count: 2 });
    markAllNotificationsReadMock.mockResolvedValue({ updated: 2 });

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useNotifications(), { wrapper: Wrapper });

    await waitFor(() => expect(result.current.items).toHaveLength(2));
    await waitFor(() => expect(result.current.unreadCount).toBe(2));

    await act(async () => {
      result.current.markAllRead();
    });

    await waitFor(() => expect(result.current.unreadCount).toBe(0));
    expect(markAllNotificationsReadMock).toHaveBeenCalledTimes(1);
  });

  it("exposes loading state while the initial fetch is in flight", () => {
    listNotificationsMock.mockImplementation(() => new Promise(() => undefined));
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useNotifications(), { wrapper: Wrapper });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.items).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
  });

  it("propagates errors from the list endpoint", async () => {
    listNotificationsMock.mockRejectedValue(new Error("boom"));
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useNotifications(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
  });
});
