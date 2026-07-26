package com.vnshop.sellerfinanceservice.domain.redaction;

/**
 * Centralized redaction helpers. Never logs plaintext, never serializes
 * destination material, never echoes fingerprints in full to clients.
 */
public final class Redacted {

    private Redacted() {}

    /** Mask everything except last4 (e.g. {@code ****1234}). */
    public static String mask(String value) {
        if (value == null || value.isBlank()) return "****";
        if (value.length() <= 4) return "****";
        return "****" + value.substring(value.length() - 4);
    }

    /** Last4 of an account number. Returns {@code ****} if too short. */
    public static String last4(String value) {
        if (value == null || value.isBlank()) return "****";
        String trimmed = value.trim();
        if (trimmed.length() <= 4) return "****";
        return trimmed.substring(trimmed.length() - 4);
    }

    /** First 8 hex chars of a fingerprint for log readability. */
    public static String fingerprint(String hex) {
        if (hex == null || hex.isBlank()) return "<none>";
        return hex.length() <= 8 ? hex : hex.substring(0, 8);
    }
}