package com.vnshop.sellerfinanceservice.domain;

import java.util.Locale;

public enum PayoutExecutionMode {
    DISABLED,
    MANUAL_RECORDED,
    PROVIDER;

    public static PayoutExecutionMode parse(String raw) {
        if (raw == null || raw.isBlank()) {
            throw new IllegalArgumentException("payout execution mode is required");
        }
        try {
            return valueOf(raw.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException(
                    "payout execution mode must be DISABLED, MANUAL_RECORDED, or PROVIDER", exception);
        }
    }
}
