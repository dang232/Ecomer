package com.vnshop.productservice.infrastructure.persistence.purchase;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class VerifiedPurchaseJpaRepositoryAdapterTest {
    private final VerifiedPurchaseJpaSpringDataRepository repository = mock(VerifiedPurchaseJpaSpringDataRepository.class);
    private final VerifiedPurchaseJpaRepositoryAdapter adapter = new VerifiedPurchaseJpaRepositoryAdapter(repository);

    @Test
    void checksTheSpecificOrderWhenOrderIdIsProvided() {
        when(repository.existsByBuyerIdAndProductIdAndOrderId("buyer-1", "product-1", "order-1"))
                .thenReturn(true);

        assertThat(adapter.hasDeliveredPurchase("buyer-1", "product-1", "order-1")).isTrue();
        verify(repository).existsByBuyerIdAndProductIdAndOrderId("buyer-1", "product-1", "order-1");
    }

    @Test
    void checksAnyDeliveredOrderWhenOrderIdIsMissing() {
        when(repository.existsByBuyerIdAndProductId("buyer-1", "product-1"))
                .thenReturn(true);

        assertThat(adapter.hasDeliveredPurchase("buyer-1", "product-1", null)).isTrue();
        verify(repository).existsByBuyerIdAndProductId("buyer-1", "product-1");
    }

    @Test
    void recordsEvidenceWithAnIdempotentInsert() {
        Instant deliveredAt = Instant.parse("2026-07-15T10:00:00Z");

        adapter.recordDeliveredPurchase("order-1", "buyer-1", "product-1", deliveredAt);

        verify(repository).insertIfAbsent(
                any(UUID.class),
                eq("order-1"),
                eq("buyer-1"),
                eq("product-1"),
                eq(deliveredAt));
    }
}
