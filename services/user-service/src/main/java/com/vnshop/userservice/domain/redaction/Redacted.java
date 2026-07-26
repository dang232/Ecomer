package com.vnshop.userservice.domain.redaction;

/**
 * Centralized redaction helpers for payout destination material. All
 * public response DTOs, log lines, JSON serializers, metrics, traces,
 * and test fixtures that need to surface a destination reference must
 * route raw values through this class first.
 *
 * <p>Why centralized: the same "last4 only" rule applies to logs, API
 * responses, metrics, traces, and exception messages. Letting each
 * caller invent its own masking would inevitably leak the plaintext.
 */
public final class Redacted {

    private Redacted() {}

    /** Returns a redacted replacement for any sensitive token. */
    public static String mask(String sensitive) {
        if (sensitive == null) {
            return "[REDACTED-NULL]";
        }
        return "[REDACTED:" + sensitive.length() + "]";
    }

    /**
     * Last-four helper. Returns "****XXXX" for any non-blank input so
     * logs / metrics / DTOs can carry a stable masked view.
     */
    public static String last4(String accountNumber) {
        if (accountNumber == null || accountNumber.isBlank()) {
            return "****";
        }
        int len = accountNumber.length();
        if (len <= 4) {
            return "****" + accountNumber;
        }
        return "****" + accountNumber.substring(len - 4);
    }

    /** Strip a destination reference to a fingerprint-only summary. */
    public static String fingerprint(String fingerprint) {
        if (fingerprint == null || fingerprint.isBlank()) {
            return "[NO-FINGERPRINT]";
        }
        int len = fingerprint.length();
        if (len <= 12) return fingerprint;
        return fingerprint.substring(0, 8) + "…" + fingerprint.substring(len - 4);
    }
}
