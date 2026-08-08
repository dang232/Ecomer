package com.vnshop.sellerfinanceservice.infrastructure.web.pagination;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Locale;

public final class AdminCursorFilterHash {
    private AdminCursorFilterHash() {}

    public static String forPayouts(String query, String status) {
        String normalizedQuery = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        String normalizedStatus = status == null ? "" : status.trim().toUpperCase(Locale.ROOT);
        String scope = normalizedQuery + "\u0000" + normalizedStatus;
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(scope.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }
}
