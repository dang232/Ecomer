import { describe, expect, it, vi } from "vitest";

import { mapPaymentOptions, type RawPaymentMethod } from "./types";

/** Stub i18next TFunction — returns the key as-is. */
const t = ((key: string) => key) as unknown as Parameters<typeof mapPaymentOptions>[1];

describe("mapPaymentOptions (extracted from CheckoutPage)", () => {
  it("console.warn fires once per unknown payment code", () => {
    const warnSpy = vi.spyOn(console, "warn").mockReturnValue(undefined);

    const rawMethods: RawPaymentMethod[] = [
      { code: "VNPAY", name: "VNPay", enabled: true },
      { code: "STRIPE", name: "Stripe", enabled: true },
      { code: "UNKNOWN_GATEWAY_XYZ", name: "Unknown GW", enabled: true },
      { code: "ANOTHER_UNKNOWN", name: "Another", enabled: true },
    ];

    const result = mapPaymentOptions(rawMethods, t);

    // Two unknown codes -> two warnings
    expect(warnSpy).toHaveBeenCalledTimes(2);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("UNKNOWN_GATEWAY_XYZ"),
    );
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("ANOTHER_UNKNOWN"),
    );

    // Unknown codes still produce a PaymentOption with generic fallback
    const unknownOption = result.find((o) => o.id === ("UNKNOWN_GATEWAY_XYZ" as string));
    expect(unknownOption).toBeDefined();
    expect(unknownOption!.name).toBe("Unknown GW");

    warnSpy.mockRestore();
  });

  it("no warn for all-known payment codes", () => {
    const warnSpy = vi.spyOn(console, "warn").mockReturnValue(undefined);

    const rawMethods: RawPaymentMethod[] = [
      { code: "VNPAY", name: "VNPay", enabled: true },
      { code: "STRIPE", name: "Stripe", enabled: true },
      { code: "COD", name: "COD", enabled: true },
    ];

    mapPaymentOptions(rawMethods, t);

    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("returns full fallback list when data is undefined", () => {
    const result = mapPaymentOptions(undefined, t);
    expect(result).toHaveLength(7);
    expect(result[0].id).toBe("VNPAY");
  });

  it("filters out disabled payment methods", () => {
    const warnSpy = vi.spyOn(console, "warn").mockReturnValue(undefined);

    const rawMethods: RawPaymentMethod[] = [
      { code: "VNPAY", name: "VNPay", enabled: true },
      { code: "UNKNOWN_DISABLED", name: "Disabled", enabled: false },
    ];

    mapPaymentOptions(rawMethods, t);

    // Disabled unknown code should NOT trigger a warn
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
