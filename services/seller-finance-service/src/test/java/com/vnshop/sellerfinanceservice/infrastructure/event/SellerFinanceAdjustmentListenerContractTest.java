package com.vnshop.sellerfinanceservice.infrastructure.event;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.sellerfinanceservice.application.ApplyFinancialAdjustmentUseCase;
import java.lang.reflect.Method;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.kafka.annotation.DltHandler;
import org.springframework.kafka.annotation.RetryableTopic;

class SellerFinanceAdjustmentListenerContractTest {

    private static final String EVENT_ID = "0b52ddda-9f1f-41c6-b8ce-9a08c05fce01";
    private static final String ADJUSTMENT_ID = "d7ebfe5c-3321-40a3-8bdc-6bd3d4a77773";
    private static final String ALLOCATION_ID = "48b6b814-f977-4e99-83c1-c8b7e353ed18";
    private static final String ORDER_ID = "d9ff1b60-81c5-4e63-a90d-397f1f20cfc7";
    private static final long SUB_ORDER_ID = 42L;

    private final SellerFinanceAdjustmentListener listener =
            new SellerFinanceAdjustmentListener(new ObjectMapper());

    @Test
    void acceptsTheVersionOneAdjustmentContractWithExactComponentSnapshot() {
        listener.onSellerFinanceAdjustment(validOutboxEvent());
    }

    @Test
    void mapsAValidCreditIntoTheAtomicApplicationUseCase() {
        ApplyFinancialAdjustmentUseCase useCase = mock(ApplyFinancialAdjustmentUseCase.class);
        when(useCase.apply(any())).thenReturn(new ApplyFinancialAdjustmentUseCase.ApplyResult(
                java.util.UUID.fromString(EVENT_ID), java.util.UUID.randomUUID()));
        SellerFinanceAdjustmentListener applyingListener = new SellerFinanceAdjustmentListener(new ObjectMapper(), useCase);

        applyingListener.onSellerFinanceAdjustment(validOutboxEvent());

        verify(useCase).apply(any());
    }

    @Test
    void mapsReleaseConfirmationMetadataIntoTheAtomicApplicationUseCase() {
        ApplyFinancialAdjustmentUseCase useCase = mock(ApplyFinancialAdjustmentUseCase.class);
        when(useCase.apply(any())).thenReturn(new ApplyFinancialAdjustmentUseCase.ApplyResult(
                java.util.UUID.fromString(EVENT_ID), java.util.UUID.randomUUID()));
        SellerFinanceAdjustmentListener applyingListener = new SellerFinanceAdjustmentListener(new ObjectMapper(), useCase);

        applyingListener.onSellerFinanceAdjustment(validOutboxEvent(
                Map.of(),
                Map.of("adjustmentType", "RELEASE", "releaseMetadata", Map.of(
                        "reason", "BUYER_CONFIRMED", "confirmedBy", "buyer-1", "confirmedAt", "2026-07-24T04:00:00Z")),
                Map.of()));

        verify(useCase).apply(any());
    }

    @Test
    void rejectsEventsMissingRequiredIdsForRetryAndDlt() {
        assertThatThrownBy(() -> listener.onSellerFinanceAdjustment(
                validOutboxEvent(Map.of(), Map.of("adjustmentId", ""), Map.of())))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("adjustmentId");
    }

    @Test
    void rejectsEveryRequiredUuidIdentifierForRetryAndDlt() {
        assertThatThrownBy(() -> listener.onSellerFinanceAdjustment(
                validOutboxEvent(Map.of("eventId", ""), Map.of(), Map.of())))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("eventId");
        assertThatThrownBy(() -> listener.onSellerFinanceAdjustment(
                validOutboxEvent(Map.of(), Map.of("allocationId", ""), Map.of())))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("allocationId");
        assertThatThrownBy(() -> listener.onSellerFinanceAdjustment(
                validOutboxEvent(Map.of(), Map.of("orderId", ""), Map.of())))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("orderId");
    }

    @Test
    void rejectsInvalidOccurredAtTimestampForRetryAndDlt() {
        assertThatThrownBy(() -> listener.onSellerFinanceAdjustment(
                validOutboxEvent(Map.of("occurredAt", "not-a-timestamp"), Map.of(), Map.of())))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("occurredAt");
    }

    @Test
    void rejectsUnknownSchemaVersionForRetryAndDlt() {
        assertThatThrownBy(() -> listener.onSellerFinanceAdjustment(
                validOutboxEvent(Map.of("schemaVersion", 2), Map.of(), Map.of())))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("schemaVersion");
    }

    @Test
    void rejectsComponentSnapshotsWithUnexpectedFieldsForRetryAndDlt() {
        assertThatThrownBy(() -> listener.onSellerFinanceAdjustment(
                validOutboxEvent(Map.of(), Map.of(), Map.of("unexpectedAmount", 1))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("components");
    }

    @Test
    void rejectsUnknownAdjustmentTypes() {
        assertThatThrownBy(() -> listener.onSellerFinanceAdjustment(
                validOutboxEvent(Map.of(), Map.of("adjustmentType", "UNKNOWN"), Map.of())))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("adjustmentType");
    }

    @Test
    void rejectsAnAggregateThatDoesNotMatchTheSellerSnapshot() {
        assertThatThrownBy(() -> listener.onSellerFinanceAdjustment(
                validOutboxEvent(Map.of("aggregateId", "other-seller"), Map.of(), Map.of())))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("aggregateId");
    }

    @Test
    void rejectsReleaseWithoutBuyerConfirmationMetadata() {
        assertThatThrownBy(() -> listener.onSellerFinanceAdjustment(
                validOutboxEvent(Map.of(), Map.of("adjustmentType", "RELEASE"), Map.of())))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("releaseMetadata");
    }

    @Test
    void rejectsNonPositiveNumericSubOrderIdsForRetryAndDlt() {
        assertThatThrownBy(() -> listener.onSellerFinanceAdjustment(
                validOutboxEvent(Map.of(), Map.of("subOrderId", 0), Map.of())))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("subOrderId");
    }

    @Test
    void exposesRetryAndDltHandlersForPoisonedMessages() throws Exception {
        Method listenerMethod = SellerFinanceAdjustmentListener.class
                .getMethod("onSellerFinanceAdjustment", String.class);
        Method dltMethod = SellerFinanceAdjustmentListener.class.getMethod("handleDlt", String.class);

        assertThat(listenerMethod.getAnnotation(RetryableTopic.class)).isNotNull();
        assertThat(dltMethod.getAnnotation(DltHandler.class)).isNotNull();
    }

    private static String validOutboxEvent() {
        return validOutboxEvent(Map.of(), Map.of(), Map.of());
    }

    private static String validOutboxEvent(Map<String, Object> envelopeOverrides,
                                            Map<String, Object> payloadOverrides,
                                            Map<String, Object> componentOverrides) {
        Map<String, Object> components = new LinkedHashMap<>(Map.ofEntries(
                Map.entry("itemGmvAmount", 100000),
                Map.entry("sellerFundedDiscountAmount", 5000),
                Map.entry("platformFundedDiscountAmount", 2500),
                Map.entry("buyerShippingChargeAmount", 15000),
                Map.entry("sellerShippingPayableAmount", 10000),
                Map.entry("taxChargedAmount", 1000),
                Map.entry("sellerTaxPayableAmount", 0),
                Map.entry("commissionBaseAmount", 92500),
                Map.entry("platformCommissionAmount", 8500),
                Map.entry("sellerPayableAmount", 76500),
                Map.entry("buyerPaidAmount", 107500),
                Map.entry("currency", "VND")));
        components.putAll(componentOverrides);
        Map<String, Object> payload = new LinkedHashMap<>(Map.of(
                "adjustmentId", ADJUSTMENT_ID,
                "adjustmentType", "CREDIT",
                "allocationId", ALLOCATION_ID,
                "allocationVersion", 1,
                "orderId", ORDER_ID,
                "subOrderId", SUB_ORDER_ID,
                "sellerId", "seller-42",
                "components", components));
        payload.put("reversalId", null);
        payload.put("commissionTier", "MALL");
        payload.put("frozenCommissionRate", 0.03);
        payload.put("currency", "VND");
        payload.put("releaseMetadata", null);
        payload.putAll(payloadOverrides);
        Map<String, Object> envelope = new LinkedHashMap<>(Map.of(
                "eventId", EVENT_ID,
                "eventType", "SELLER_FINANCE_ADJUSTMENT",
                "schemaVersion", 1,
                "occurredAt", "2026-07-24T03:30:00Z",
                "producer", "order-service",
                "aggregateId", "seller-42",
                "correlationId", ORDER_ID,
                "causationId", EVENT_ID,
                "payload", payload));
        envelope.putAll(envelopeOverrides);

        try {
            ObjectMapper mapper = new ObjectMapper();
            return mapper.writeValueAsString(Map.of(
                    "id", 17,
                    "aggregateType", "Order",
                    "aggregateId", ORDER_ID,
                    "eventType", "SELLER_FINANCE_ADJUSTMENT",
                    "payload", mapper.writeValueAsString(envelope)));
        } catch (Exception exception) {
            throw new AssertionError(exception);
        }
    }
}
