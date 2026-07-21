package com.vnshop.shippingservice.infrastructure.webhook;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.stream.Stream;

final class WebhookEventIdentity {
    private WebhookEventIdentity() {
    }

    static String create(String carrier, String trackingCode, String timestamp, String... fields) {
        String material = Stream.concat(Stream.of(carrier, trackingCode, timestamp), Stream.of(fields))
                .map(value -> value == null ? "" : value.trim())
                .reduce((left, right) -> left + "\u001f" + right)
                .orElse("");
        String suffix = timestamp == null || timestamp.isBlank() ? sha256(material) : timestamp;
        return carrier + ":" + trackingCode + ":" + suffix;
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is not available", e);
        }
    }
}
