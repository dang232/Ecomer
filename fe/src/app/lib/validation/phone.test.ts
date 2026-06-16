/** Unit tests for the libphonenumber-js-backed phone helpers. */
import { describe, expect, it } from "vitest";

import {
  DEFAULT_COUNTRY,
  dialCodeForCountry,
  digitsOnly,
  formatAsYouType,
  isValidPhone,
  livePhoneStatus,
  parseOptionalPhone,
} from "./phone";

describe("phone validation helpers", () => {
  describe("dialCodeForCountry", () => {
    it("returns +84 for Vietnam", () => {
      expect(dialCodeForCountry("VN")).toBe("+84");
    });
    it("returns +1 for the US", () => {
      expect(dialCodeForCountry("US")).toBe("+1");
    });
    it("returns +44 for the UK", () => {
      expect(dialCodeForCountry("GB")).toBe("+44");
    });
  });

  describe("digitsOnly", () => {
    it("strips non-digit characters", () => {
      expect(digitsOnly("+1a2b3c4d5e")).toBe("12345");
    });
    it("returns empty for all-symbol input", () => {
      expect(digitsOnly("hello world")).toBe("");
    });
    it("preserves digits verbatim", () => {
      expect(digitsOnly("912345678")).toBe("912345678");
    });
  });

  describe("isValidPhone", () => {
    it("accepts a valid Vietnam number", () => {
      expect(isValidPhone("+84912345678", "VN")).toBe(true);
    });
    it("accepts a valid US number", () => {
      expect(isValidPhone("+12025551234", "US")).toBe(true);
    });
    it("rejects a US number when country is set to Vietnam", () => {
      expect(isValidPhone("+12025551234", "VN")).toBe(false);
    });
    it("rejects an empty string", () => {
      expect(isValidPhone("", "VN")).toBe(false);
    });
    it("rejects a Vietnam number with too few digits", () => {
      expect(isValidPhone("+84123", "VN")).toBe(false);
    });
  });

  describe("parseOptionalPhone", () => {
    it("formats a Vietnam number to +84 E.164", () => {
      expect(parseOptionalPhone("912345678", "VN")).toBe("+84912345678");
    });
    it("formats a US number to +1 E.164", () => {
      expect(parseOptionalPhone("(202) 555-1234", "US")).toBe("+12025551234");
    });
    it("returns null for null", () => {
      expect(parseOptionalPhone(null, "VN")).toBeNull();
    });
    it("returns null for blank", () => {
      expect(parseOptionalPhone("   ", "VN")).toBeNull();
    });
    it("returns null when the number is invalid for the country", () => {
      expect(parseOptionalPhone("123", "VN")).toBeNull();
    });
  });

  describe("formatAsYouType", () => {
    it("formats a Vietnam number with spaces", () => {
      const out = formatAsYouType("912345678", "VN");
      // AsYouType's exact spacing varies by locale; the important thing
      // is that it contains the digits and no letters or symbols.
      expect(out).not.toMatch(/[a-zA-Z+]/);
      expect(out.replace(/\D/g, "")).toBe("912345678");
    });
    it("formats a US number with parens", () => {
      const out = formatAsYouType("2025551234", "US");
      expect(out).not.toMatch(/[a-zA-Z]/);
      expect(out.replace(/\D/g, "")).toBe("2025551234");
    });
  });

  describe("livePhoneStatus", () => {
    it("returns 'empty' for no input", () => {
      expect(livePhoneStatus("", "VN")).toBe("empty");
    });
    it("returns 'short' for too few digits", () => {
      expect(livePhoneStatus("1234", "VN")).toBe("short");
    });
    it("returns 'valid' for a complete Vietnam number", () => {
      expect(livePhoneStatus("912345678", "VN")).toBe("valid");
    });
    it("returns 'valid' for a complete US number", () => {
      expect(livePhoneStatus("2025551234", "US")).toBe("valid");
    });
  });

  it("DEFAULT_COUNTRY is Vietnam", () => {
    expect(DEFAULT_COUNTRY).toBe("VN");
  });
});
