package com.vnshop.shippingservice.infrastructure.persistence;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.shippingservice.domain.model.CarrierWebhookEvent;
import com.vnshop.shippingservice.domain.model.CodCollectionEvidence;
import com.vnshop.shippingservice.domain.model.CarrierWebhookOutboxRecord;
import com.vnshop.shippingservice.infrastructure.config.ShippingWebhookOutboxProperties;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ShippingWebhookOutboxAdapterTest {

    @Test
    void findPendingRestoresCodEvidenceFromStoredPayload() throws Exception {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        ObjectMapper objectMapper = new ObjectMapper();
        ShippingWebhookOutboxAdapter adapter = new ShippingWebhookOutboxAdapter(
                jdbcTemplate,
                objectMapper,
                new ShippingWebhookOutboxProperties(50, 1_000, 60_000, 8, 1, 300, 8, 1_000));

        UUID orderId = UUID.randomUUID();
        BigDecimal amount = new BigDecimal("125000");
        CarrierWebhookEvent base = new CarrierWebhookEvent(
                "carrier-event-1", orderId.toString(), "GHN", "GHN-1", "DELIVERED", "Delivered",
                "2026-07-24T10:30:00Z", amount, UUID.randomUUID().toString(), "VND");
        CodCollectionEvidence expected = CodCollectionEvidence.expected(
                UUID.randomUUID(), orderId.toString(), "GHN", "GHN-1", amount, "VND");
        CarrierWebhookEvent verified = base.withCodEvidence(
                CodCollectionEvidence.fromCarrierEvent(base, expected));
        String payload = objectMapper.writeValueAsString(verified);

        ResultSet resultSet = mock(ResultSet.class);
        when(resultSet.getString("payload")).thenReturn(payload);
        when(resultSet.getObject("id", UUID.class)).thenReturn(UUID.randomUUID());
        when(resultSet.getInt("attempts")).thenReturn(0);
        when(resultSet.getObject("next_retry_at", Instant.class)).thenReturn(null);
        CarrierWebhookOutboxRecord restored = adapter.mapRecord(resultSet, 0);

        assertThat(restored.event().hasVerifiedCodCollection()).isTrue();
    }
}
