package com.vnshop.orderservice.infrastructure.web.pagination;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.Test;

class AdminCursorCodecTest {
    private static final String SECRET = "test-secret";
    private static final Instant NOW = Instant.parse("2026-08-08T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static final AdminCursorCodec.Cursor CURSOR = new AdminCursorCodec.Cursor(
            "orders", "filter-hash", "createdAt:desc,id:desc", "2026-08-07T23:59:00Z", "order-42", NOW, null);
    private final AdminCursorCodec codec = new AdminCursorCodec(SECRET, Duration.ofMinutes(5), CLOCK);

    @Test
    void roundTrip_preservesScopedPayload() {
        String token = codec.encode(CURSOR);

        AdminCursorCodec.Cursor decoded = codec.decode(token, "orders", "filter-hash", "createdAt:desc,id:desc");

        assertThat(decoded).isEqualTo(CURSOR.withExpiresAt(NOW.plusSeconds(300)));
        assertThat(decoded.asOf()).isEqualTo(NOW);
        assertThat(token).doesNotContain("orders").matches("[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+");
    }

    @Test
    void omittedAsOf_roundTripsAsNull() {
        String token = signed(payload("").replace(",\"expiresAt\"", ",\"asOfMissing\":true,\"expiresAt\""));

        assertThat(codec.decode(token, "orders", "filter-hash", "createdAt:desc,id:desc").asOf()).isNull();
    }

    @Test
    void tampering_isRejected() {
        String token = codec.encode(CURSOR);
        String tampered = token.substring(0, token.length() - 1) + (token.endsWith("A") ? "B" : "A");

        assertReason(tampered, "orders", "filter-hash", "createdAt:desc,id:desc", AdminCursorCodec.RejectionReason.TAMPERED);
    }

    @Test
    void expiry_isRejected() {
        String token = signed(payloadWithExpiry("2026-08-07T23:59:00Z"));

        assertReason(token, "orders", "filter-hash", "createdAt:desc,id:desc", AdminCursorCodec.RejectionReason.EXPIRED);
    }

    @Test
    void scopeMismatches_areTyped() {
        String token = codec.encode(CURSOR);

        assertReason(token, "users", "filter-hash", "createdAt:desc,id:desc", AdminCursorCodec.RejectionReason.RESOURCE_MISMATCH);
        assertReason(token, "orders", "other-filter", "createdAt:desc,id:desc", AdminCursorCodec.RejectionReason.FILTER_MISMATCH);
        assertReason(token, "orders", "filter-hash", "name:asc,id:asc", AdminCursorCodec.RejectionReason.SORT_MISMATCH);
    }

    @Test
    void malformedAndOversizedTokens_areRejectedBeforeDecode() {
        assertReason("not-a-token", "orders", "filter-hash", "createdAt:desc,id:desc", AdminCursorCodec.RejectionReason.MALFORMED);
        assertReason("x".repeat(4097), "orders", "filter-hash", "createdAt:desc,id:desc", AdminCursorCodec.RejectionReason.MALFORMED);
    }

    @Test
    void signedUnsupportedVersions_areRejected() {
        assertReason(signed(payloadWithVersion(0)), "orders", "filter-hash", "createdAt:desc,id:desc", AdminCursorCodec.RejectionReason.UNSUPPORTED_VERSION);
        assertReason(signed(payloadWithVersion(2)), "orders", "filter-hash", "createdAt:desc,id:desc", AdminCursorCodec.RejectionReason.UNSUPPORTED_VERSION);
    }

    @Test
    void requiredFields_missingWrongOrBlank_areRejected() {
        Map<String, String> fields = Map.of(
                "resource", "\"resource\":\"\"",
                "filterHash", "\"filterHash\":1",
                "sort", "\"sort\":null",
                "uniqueId", "\"uniqueId\":\"\"",
                "expiresAt", "\"expiresAt\":1");
        fields.forEach((field, replacement) -> {
            String json = payloadWithout(field, replacement);
            assertReason(signed(json), "orders", "filter-hash", "createdAt:desc,id:desc", AdminCursorCodec.RejectionReason.MISSING_FIELD);
        });
    }

    @Test
    void wireFormatVector_roundTripsAcrossCodecContract() {
        String token = signed(payload(""));

        AdminCursorCodec.Cursor decoded = codec.decode(token, "orders", "filter-hash", "createdAt:desc,id:desc");

        assertThat(decoded.resource()).isEqualTo("orders");
        assertThat(decoded.filterHash()).isEqualTo("filter-hash");
        assertThat(decoded.sort()).isEqualTo("createdAt:desc,id:desc");
        assertThat(decoded.sortKey()).isEqualTo("2026-08-07T23:59:00Z");
        assertThat(decoded.uniqueId()).isEqualTo("order-42");
    }

    private void assertReason(String token, String resource, String filterHash, String sort, AdminCursorCodec.RejectionReason reason) {
        assertThatThrownBy(() -> codec.decode(token, resource, filterHash, sort))
                .isInstanceOf(AdminCursorCodec.InvalidCursorException.class)
                .extracting(exception -> ((AdminCursorCodec.InvalidCursorException) exception).reason())
                .isEqualTo(reason);
    }

    private static String payload(String versionOrExpiry) {
        return "{" + (versionOrExpiry.isBlank() ? "\"v\":1," : versionOrExpiry)
                + "\"resource\":\"orders\",\"filterHash\":\"filter-hash\",\"sort\":\"createdAt:desc,id:desc\",\"sortKey\":\"2026-08-07T23:59:00Z\",\"uniqueId\":\"order-42\",\"expiresAt\":\"2026-08-08T00:05:00Z\"}";
    }

    private static String payloadWithExpiry(String expiresAt) {
        return payload("").replace("2026-08-08T00:05:00Z", expiresAt);
    }

    private static String payloadWithVersion(int version) {
        return payload("").replace("\"v\":1", "\"v\":" + version);
    }

    private static String signed(String json) {
        try {
            byte[] payload = json.getBytes(StandardCharsets.UTF_8);
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(payload) + "."
                    + Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(payload));
        } catch (Exception exception) {
            throw new IllegalStateException(exception);
        }
    }

    private static String payloadWithout(String field, String replacement) {
        String json = payload("");
        if (field.equals("resource")) return json.replace("\"resource\":\"orders\"", replacement);
        if (field.equals("filterHash")) return json.replace("\"filterHash\":\"filter-hash\"", replacement);
        if (field.equals("sort")) return json.replace("\"sort\":\"createdAt:desc,id:desc\"", replacement);
        if (field.equals("uniqueId")) return json.replace("\"uniqueId\":\"order-42\"", replacement);
        return json.replace("\"expiresAt\":\"2026-08-08T00:05:00Z\"", replacement);
    }

}
