package com.vnshop.userservice.infrastructure.web.pagination;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

public final class AdminCursorFilterHash {
    private AdminCursorFilterHash() {}

    public static String forQuery(String query) {
        return hash(normalize(query));
    }

    private static String normalize(String query) {
        return query == null ? "" : query.trim().toLowerCase(java.util.Locale.ROOT);
    }

    private static String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }
}
