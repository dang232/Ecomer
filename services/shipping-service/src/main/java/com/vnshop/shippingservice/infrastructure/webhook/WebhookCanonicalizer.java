package com.vnshop.shippingservice.infrastructure.webhook;

import java.nio.charset.StandardCharsets;
import java.util.Map;

final class WebhookCanonicalizer {
    private WebhookCanonicalizer() {
    }

    static String serialize(String prefix, Map<String, String> fields) {
        StringBuilder result = new StringBuilder(prefix).append('|');
        fields.forEach((name, value) -> {
            appendLengthPrefixed(result, name);
            appendLengthPrefixed(result, value == null ? "" : value);
            result.append(';');
        });
        return result.toString();
    }

    private static void appendLengthPrefixed(StringBuilder result, String value) {
        byte[] bytes = value.getBytes(StandardCharsets.UTF_8);
        result.append(bytes.length).append(':').append(value);
    }
}
