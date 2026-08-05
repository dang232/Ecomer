package com.vnshop.userservice.domain;

import java.util.Objects;
import java.util.regex.Pattern;

/**
 * International phone number in E.164 format: a {@code +} followed by the
 * country calling code and the national subscriber number, e.g.
 * {@code +84912345678} (Vietnam) or {@code +12025551234} (US).
 *
 * <p>The BE validates the shape with a simple E.164 regex — the country-aware
 * validation (is this a real, in-use number for this country?) is the FE's
 * responsibility, via {@code libphonenumber-js}. The FE formats the
 * user-typed number to E.164 before submitting, and the BE stores the
 * canonical E.164 string verbatim. This keeps the BE dependency-free
 * (no {@code libphonenumber-java} jar) while still giving users a polished
 * multi-country picker and real-time validation on the FE.</p>
 *
 * <p>{@link #parseOrNull(String)} is the single entry point for raw user input.
 * It returns {@code null} for null/blank and a validated {@code PhoneNumber}
 * otherwise, so callers (controllers, use cases) never re-implement the
 * blank-handling rule.</p>
 */
public record PhoneNumber(String value) {

    /**
     * Generic E.164 pattern: {@code +} followed by 1-3 digit country code and
     * 4-15 digits of national number. This intentionally rejects the legacy
     * Vietnam-only shape; the FE is responsible for country-aware validation
     * (e.g. Vietnam requires 9-10 digits, US requires 10, etc.).
     */
    public static final String PATTERN_STR = "\\+[1-9]\\d{4,14}";

    private static final Pattern E164_PATTERN = Pattern.compile("^" + PATTERN_STR + "$");

    public PhoneNumber {
        Objects.requireNonNull(value, "phone number is required");
        if (!E164_PATTERN.matcher(value).matches()) {
            throw new IllegalArgumentException("phone number must be in E.164 format, e.g. +84912345678");
        }
    }

    /**
     * Construct a {@code PhoneNumber} from raw user input, returning {@code null}
     * for null/blank and a validated {@code PhoneNumber} otherwise. Use this
     * anywhere user input is converted into the domain type so the optionality
     * rule lives in one place.
     */
    public static PhoneNumber parseOrNull(String raw) {
        if (raw == null || raw.isBlank()) return null;
        return new PhoneNumber(raw.trim());
    }
}
