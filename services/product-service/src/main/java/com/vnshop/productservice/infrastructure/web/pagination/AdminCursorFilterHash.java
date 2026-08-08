package com.vnshop.productservice.infrastructure.web.pagination;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

public final class AdminCursorFilterHash {
    private AdminCursorFilterHash() {}

    public static String forQuery(String query) {
        String normalized = query == null ? "" : query.trim().toLowerCase(java.util.Locale.ROOT);
        try {
            return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(normalized.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is required", exception);
        }
    }
}
