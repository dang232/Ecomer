package com.vnshop.orderservice.infrastructure.web.pagination;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;

class AdminCursorCodecTest {
    private static final Instant NOW = Instant.parse("2026-08-08T00:00:00Z");
    private static final Clock CLOCK = Clock.fixed(NOW, ZoneOffset.UTC);
    private static final AdminCursorCodec.Cursor CURSOR = new AdminCursorCodec.Cursor(
            "orders", "filter-hash", "createdAt:desc,id:desc", "2026-08-07T23:59:00Z", "order-42", NOW, null);

    private AdminCursorCodec codec() {
        return new AdminCursorCodec("test-secret", Duration.ofMinutes(5), CLOCK);
    }

    @Test
    void roundTrip_preservesScopedPayload() {
        String token = codec().encode(CURSOR);

        AdminCursorCodec.Cursor decoded = codec().decode(token, "orders", "filter-hash", "createdAt:desc,id:desc");

        assertThat(decoded).isEqualTo(CURSOR.withExpiresAt(NOW.plusSeconds(300)));
        assertThat(token).doesNotContain("orders");
        assertThat(token).matches("[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+");
    }

    @Test
    void tampering_isRejectedWithTypedReason() {
        String token = codec().encode(CURSOR);
        String tampered = token.substring(0, token.length() - 1) + (token.endsWith("A") ? "B" : "A");

        assertThatThrownBy(() -> codec().decode(tampered, "orders", "filter-hash", "createdAt:desc,id:desc"))
                .isInstanceOf(AdminCursorCodec.InvalidCursorException.class)
                .extracting(exception -> ((AdminCursorCodec.InvalidCursorException) exception).reason())
                .isEqualTo(AdminCursorCodec.RejectionReason.TAMPERED);
    }

    @Test
    void expiry_isRejected() {
        String token = codec().tokenForTesting("{\"v\":1,\"resource\":\"orders\",\"filterHash\":\"filter-hash\",\"sort\":\"createdAt:desc,id:desc\",\"sortKey\":\"2026-08-07T23:59:00Z\",\"uniqueId\":\"order-42\",\"expiresAt\":\"2026-08-07T23:59:00Z\"}");

        assertThatThrownBy(() -> codec().decode(token, "orders", "filter-hash", "createdAt:desc,id:desc"))
                .isInstanceOf(AdminCursorCodec.InvalidCursorException.class)
                .extracting(exception -> ((AdminCursorCodec.InvalidCursorException) exception).reason())
                .isEqualTo(AdminCursorCodec.RejectionReason.EXPIRED);
    }

    @Test
    void scopeMismatches_areTyped() {
        String token = codec().encode(CURSOR);

        assertReason(token, "users", "filter-hash", "createdAt:desc,id:desc", AdminCursorCodec.RejectionReason.RESOURCE_MISMATCH);
        assertReason(token, "orders", "other-filter", "createdAt:desc,id:desc", AdminCursorCodec.RejectionReason.FILTER_MISMATCH);
        assertReason(token, "orders", "filter-hash", "name:asc,id:asc", AdminCursorCodec.RejectionReason.SORT_MISMATCH);
    }

    @Test
    void malformedPayload_isRejected() {
        assertReason("not-a-token", "orders", "filter-hash", "createdAt:desc,id:desc", AdminCursorCodec.RejectionReason.MALFORMED);
    }

    @Test
    void missingRequiredField_isRejected() {
        String token = codec().tokenForTesting("{\"v\":1,\"resource\":\"orders\",\"filterHash\":\"filter-hash\",\"sort\":\"createdAt:desc,id:desc\",\"expiresAt\":\"2026-08-08T00:05:00Z\"}");

        assertThatThrownBy(() -> codec().decode(token, "orders", "filter-hash", "createdAt:desc,id:desc"))
                .isInstanceOf(AdminCursorCodec.InvalidCursorException.class)
                .extracting(exception -> ((AdminCursorCodec.InvalidCursorException) exception).reason())
                .isEqualTo(AdminCursorCodec.RejectionReason.MISSING_FIELD);
    }

    private void assertReason(String token, String resource, String filterHash, String sort,
                              AdminCursorCodec.RejectionReason reason) {
        assertThatThrownBy(() -> codec().decode(token, resource, filterHash, sort))
                .isInstanceOf(AdminCursorCodec.InvalidCursorException.class)
                .extracting(exception -> ((AdminCursorCodec.InvalidCursorException) exception).reason())
                .isEqualTo(reason);
    }
}
