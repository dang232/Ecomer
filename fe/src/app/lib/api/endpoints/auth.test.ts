import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock native-auth so registerUser's auth:false flag is honored regardless
// of any leftover token state.
let liveToken: string | null = null;
vi.mock("../../auth/native-auth", () => ({
  getAccessToken: () => liveToken,
  setLiveTokenSet: vi.fn(),
  refreshTokens: vi.fn(),
}));

import { registerUser } from "./auth";
import { ApiError } from "../envelope";

const fetchSpy = vi.spyOn(global, "fetch");

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    ...init,
  });
}

beforeEach(() => {
  fetchSpy.mockReset();
  liveToken = null;
});

afterEach(() => {
  vi.clearAllMocks();
});

const sampleInput = {
  email: "u@example.com",
  password: "pw",
  firstName: "A",
  lastName: "B",
};

describe("registerUser", () => {
  it("POSTs to /auth/register without an Authorization header (auth: false)", async () => {
    liveToken = "should-not-be-sent";
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        message: "ok",
        data: {},
        errorCode: null,
        timestamp: "2026-05-15T00:00:00Z",
      }),
    );

    await registerUser(sampleInput);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const init = fetchSpy.mock.calls[0][1];
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["X-Correlation-Id"]).toMatch(/^[0-9a-f-]{36}$/);
    // credentials must be "include" so the backend can set the refresh cookie.
    expect(init?.credentials).toBe("include");
  });

  it("resolves without throwing on a 2xx envelope", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        success: true,
        message: "ok",
        data: {},
        errorCode: null,
        timestamp: "2026-05-15T00:00:00Z",
      }),
    );

    // emptyResponseSchema accepts {} as data, so the resolved value is {}.
    await expect(registerUser(sampleInput)).resolves.toEqual({});
  });

  it("throws ApiError with backend errorCode/message when envelope.success is false", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse({
        success: false,
        message: "Email already registered",
        data: {},
        errorCode: "EMAIL_TAKEN",
        timestamp: "2026-05-15T00:00:00Z",
      }),
    );

    const err = await registerUser(sampleInput).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).errorCode).toBe("EMAIL_TAKEN");
    expect((err as ApiError).message).toBe("Email already registered");
  });
});