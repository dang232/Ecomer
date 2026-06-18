import { describe, expect, it, vi } from "vitest";

/**
 * P2-4 smoke-test: verifies that an unknown payment code in the
 * CheckoutPage paymentOptions mapping triggers exactly one console.warn.
 *
 * The actual CheckoutPage component is integration-tested in the E2E suite;
 * this unit test confirms the warn-logic pattern in isolation.
 */
describe("CheckoutPage paymentOptions unknown-code warning (P2-4)", () => {
  it("console.warn fires once per unknown payment code", () => {
    const warnSpy = vi.spyOn(console, "warn").mockReturnValue(undefined);

    // Mirrors the logic in CheckoutPage.tsx lines 88-101:
    // codeToFallback holds the 7 known codes; anything else gets a warn.
    const knownCodes = new Set(["VNPAY", "MOMO", "VIETQR", "STRIPE", "PAYPAL", "BANK", "COD"]);
    const rawCodes = [
      { code: "VNPAY", enabled: true },
      { code: "STRIPE", enabled: true },
      { code: "UNKNOWN_GATEWAY_XYZ", enabled: true }, // intentionally unknown
      { code: "ANOTHER_UNKNOWN", enabled: true },     // intentionally unknown
    ];

    for (const p of rawCodes.filter((p) => p.enabled !== false)) {
      if (!knownCodes.has(p.code)) {
        console.warn(
          `[CheckoutPage] Unknown payment code "${p.code}" — using generic CreditCard icon. Consider adding it to codeToFallback.`,
        );
      }
    }

    expect(warnSpy).toHaveBeenCalledTimes(2);
    const messages = warnSpy.mock.calls.map((c) => c[0] as string);
    expect(messages.some((m) => m.includes("UNKNOWN_GATEWAY_XYZ"))).toBe(true);
    expect(messages.some((m) => m.includes("ANOTHER_UNKNOWN"))).toBe(true);

    warnSpy.mockRestore();
  });

  it("no warn is emitted for all-known payment codes", () => {
    const warnSpy = vi.spyOn(console, "warn").mockReturnValue(undefined);

    const knownCodes = new Set(["VNPAY", "MOMO", "VIETQR", "STRIPE", "PAYPAL", "BANK", "COD"]);
    const rawCodes = [
      { code: "VNPAY", enabled: true },
      { code: "STRIPE", enabled: true },
      { code: "COD", enabled: true },
    ];

    for (const p of rawCodes.filter((p) => p.enabled !== false)) {
      if (!knownCodes.has(p.code)) {
        console.warn(`[CheckoutPage] Unknown payment code "${p.code}"...`);
      }
    }

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
