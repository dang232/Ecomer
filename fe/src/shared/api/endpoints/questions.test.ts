import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/auth", () => ({
  getAccessToken: () => "jwt-question-test",
  setLiveTokenSet: vi.fn(),
  refreshTokens: vi.fn(),
}));

import { askQuestion, questionsByProduct } from "@/shared/api/endpoints/questions";
import { questionSchema } from "@/shared/contracts/api";

const canonicalQuestion = {
  id: "question-1",
  productId: "product-1",
  userId: "buyer-1",
  question: "Does this include a warranty?",
  answer: null,
  answeredAt: null,
  createdAt: "2026-08-05T08:00:00Z",
};

function rawApiResponse(data: unknown, status = 200): Response {
  return new Response(
    JSON.stringify({
      success: true,
      message: "Success",
      data,
      errorCode: null,
      timestamp: "2026-08-05T08:00:00Z",
    }),
    { status, headers: { "content-type": "application/json" } },
  );
}

const fetchSpy = vi.spyOn(globalThis, "fetch");

beforeEach(() => {
  fetchSpy.mockReset();
});

describe("question endpoints", () => {
  it("decodes the canonical POST envelope through the shared API client", async () => {
    fetchSpy.mockResolvedValueOnce(rawApiResponse(canonicalQuestion, 201));

    const result = await askQuestion({
      productId: "product-1",
      question: "Does this include a warranty?",
    });

    expect(result).toEqual(canonicalQuestion);
    expect(result.id).toBe("question-1");

    const [, init] = fetchSpy.mock.calls[0];
    expect(init?.method).toBe("POST");
    expect(init?.body).toBe(
      JSON.stringify({ productId: "product-1", question: "Does this include a warranty?" }),
    );
  });

  it("decodes the canonical GET list envelope through the shared API client", async () => {
    fetchSpy.mockResolvedValueOnce(rawApiResponse([canonicalQuestion]));

    const result = await questionsByProduct("product-1");

    expect(result).toEqual([canonicalQuestion]);
    expect(result[0]?.id).toBe("question-1");
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("rejects a malformed list item instead of returning it as an empty-compatible question", async () => {
    fetchSpy.mockResolvedValueOnce(
      rawApiResponse([{ ...canonicalQuestion, questionId: canonicalQuestion.id }]),
    );

    await expect(questionsByProduct("product-1")).rejects.toMatchObject({
      errorCode: "MALFORMED_RESPONSE",
    });
  });

  it("rejects the legacy questionId field instead of passing it through the contract", () => {
    const result = questionSchema.safeParse({
      ...canonicalQuestion,
      questionId: canonicalQuestion.id,
    });

    expect(result.success).toBe(false);
  });
});
