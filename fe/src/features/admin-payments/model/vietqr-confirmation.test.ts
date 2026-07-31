import { describe, expect, it } from "vitest";

import {
  buildVietqrConfirmationPayload,
  parseVietqrConfirmation,
} from "../model/vietqr-confirmation";

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

describe("vietqr-confirmation model", () => {
  it("parses a confirmation with a bank reference", () => {
    expect(
      parseVietqrConfirmation({ paymentId: VALID_UUID, bankReference: "BANK-12345" }),
    ).toEqual({ paymentId: VALID_UUID, bankReference: "BANK-12345" });
  });

  it("parses a confirmation without a bank reference", () => {
    expect(parseVietqrConfirmation({ paymentId: VALID_UUID })).toEqual({
      paymentId: VALID_UUID,
      bankReference: undefined,
    });
  });

  it("rejects a non-UUID payment id", () => {
    expect(() => parseVietqrConfirmation({ paymentId: "pmt-1" })).toThrow();
  });

  it("trims and bounds the bank reference", () => {
    const tooLong = "x".repeat(121);
    expect(() =>
      parseVietqrConfirmation({ paymentId: VALID_UUID, bankReference: tooLong }),
    ).toThrow();
    expect(
      parseVietqrConfirmation({
        paymentId: VALID_UUID,
        bankReference: "  BANK-1  ",
      }),
    ).toEqual({ paymentId: VALID_UUID, bankReference: "BANK-1" });
  });

  it("buildVietqrConfirmationPayload keeps a non-empty reference and drops empties", () => {
    expect(buildVietqrConfirmationPayload("  BANK-1  ")).toEqual({
      bankReference: "BANK-1",
    });
    expect(buildVietqrConfirmationPayload("")).toEqual({});
    expect(buildVietqrConfirmationPayload("   ")).toEqual({});
    expect(buildVietqrConfirmationPayload(undefined)).toEqual({});
  });
});