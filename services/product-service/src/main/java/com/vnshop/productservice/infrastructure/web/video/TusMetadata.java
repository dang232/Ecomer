package com.vnshop.productservice.infrastructure.web.video;

import com.vnshop.productservice.domain.video.VideoOwnerType;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;

/**
 * Parses the tus {@code Upload-Metadata} header.
 *
 * <p>The header is a comma-separated list of {@code key base64value} pairs, e.g.:
 * <pre>ownerType UFJPRF VDT, ownerId dXVpZA==, idempotencyKey abc123</pre>
 *
 * <p>Keys used by this service:
 * <ul>
 *   <li>{@code ownerType} — {@link VideoOwnerType#PRODUCT} or {@link VideoOwnerType#REVIEW}</li>
 *   <li>{@code ownerId}   — UUID of product or review</li>
 *   <li>{@code idempotencyKey} — client deduplication key</li>
 * </ul>
 */
public record TusMetadata(VideoOwnerType ownerType, String ownerId, String idempotencyKey,
        String extension) {

    public static TusMetadata parse(String headerValue) {
        Map<String, String> fields = new HashMap<>();
        if (headerValue == null || headerValue.isBlank()) {
            throw new IllegalArgumentException("Upload-Metadata header is required");
        }
        for (String entry : headerValue.split(",")) {
            String[] parts = entry.strip().split(" ", 2);
            if (parts.length == 2) {
                String key = parts[0].strip();
                String value = new String(Base64.getDecoder().decode(parts[1].strip()), StandardCharsets.UTF_8);
                fields.put(key, value);
            } else if (parts.length == 1) {
                fields.put(parts[0].strip(), "");
            }
        }

        String rawOwnerType = required(fields, "ownerType");
        VideoOwnerType ownerType;
        try {
            ownerType = VideoOwnerType.valueOf(rawOwnerType);
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException(
                    "ownerType must be PRODUCT or REVIEW, got: " + rawOwnerType);
        }
        String ownerId = required(fields, "ownerId");
        String idempotencyKey = required(fields, "idempotencyKey");

        return new TusMetadata(ownerType, ownerId, idempotencyKey, extensionFor(fields));
    }

    private static String extensionFor(Map<String, String> fields) {
        String filename = fields.getOrDefault("filename", "").strip();
        int separator = filename.lastIndexOf('.');
        if (separator >= 0 && separator < filename.length() - 1) {
            String extension = filename.substring(separator + 1).toLowerCase(java.util.Locale.ROOT);
            if (java.util.Set.of("mp4", "mov", "webm", "mkv").contains(extension)) {
                return extension;
            }
        }

        return switch (fields.getOrDefault("filetype", "")) {
            case "video/quicktime" -> "mov";
            case "video/webm" -> "webm";
            case "video/x-matroska" -> "mkv";
            default -> "mp4";
        };
    }

    private static String required(Map<String, String> fields, String key) {
        String value = fields.get(key);
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Upload-Metadata is missing required field: " + key);
        }
        return value;
    }
}
