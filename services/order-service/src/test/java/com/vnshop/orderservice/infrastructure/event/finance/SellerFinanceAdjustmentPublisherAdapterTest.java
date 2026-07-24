package com.vnshop.orderservice.infrastructure.event.finance;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.orderservice.domain.CommissionTier;
import com.vnshop.orderservice.domain.finance.FinancialComponents;
import com.vnshop.orderservice.domain.finance.SubOrderFinancialAllocation;
import com.vnshop.orderservice.infrastructure.outbox.OutboxEventJpaEntity;
import com.vnshop.orderservice.infrastructure.outbox.OutboxEventRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

public class SellerFinanceAdjustmentPublisherAdapterTest {

    @Test
    void stagesVersionOneCreditWithTheExactAllocationSnapshot() throws Exception {
        OutboxEventRepository repository = mock(OutboxEventRepository.class);
        ObjectMapper mapper = new ObjectMapper();
        SubOrderFinancialAllocation allocation = allocation();

        new SellerFinanceAdjustmentPublisherAdapter(repository, mapper).publishCredit(allocation);

        ArgumentCaptor<OutboxEventJpaEntity> event = ArgumentCaptor.forClass(OutboxEventJpaEntity.class);
        verify(repository).save(event.capture());
        JsonNode envelope = mapper.readTree(event.getValue().getPayload());
        assertThat(event.getValue().getEventType()).isEqualTo("SELLER_FINANCE_ADJUSTMENT");
        assertThat(event.getValue().getAggregateId()).isEqualTo("seller-42");
        assertThat(envelope.path("schemaVersion").asInt()).isEqualTo(1);
        assertThat(envelope.path("eventType").asText()).isEqualTo("SELLER_FINANCE_ADJUSTMENT");
        assertThat(envelope.path("payload").path("adjustmentType").asText()).isEqualTo("CREDIT");
        assertThat(envelope.path("payload").path("allocationId").asText()).isEqualTo(allocation.allocationId().toString());
        assertThat(envelope.path("payload").path("allocationVersion").asInt()).isEqualTo(1);
        assertThat(envelope.path("payload").path("orderId").asText()).isEqualTo(allocation.orderId().toString());
        assertThat(envelope.path("payload").path("subOrderId").asLong()).isEqualTo(17L);
        assertThat(envelope.path("payload").path("sellerId").asText()).isEqualTo("seller-42");
        assertThat(envelope.path("payload").path("commissionTier").asText()).isEqualTo("MALL");
        assertThat(envelope.path("payload").path("frozenCommissionRate").decimalValue())
                .isEqualByComparingTo("0.03");
        assertThat(envelope.path("payload").path("reversalId").isNull()).isTrue();
        assertThat(envelope.path("payload").path("components").path("sellerPayableAmount").decimalValue())
                .isEqualByComparingTo(allocation.components().sellerPayableAmount());
        assertThat(envelope.path("occurredAt").asText()).isNotBlank();
    }

    @Test
    void derivesAStableReleaseCausationIdFromTheAllocationAndBuyer() throws Exception {
        OutboxEventRepository repository = mock(OutboxEventRepository.class);
        ObjectMapper mapper = new ObjectMapper();
        SubOrderFinancialAllocation allocation = allocation();

        new SellerFinanceAdjustmentPublisherAdapter(repository, mapper).publishRelease(allocation, "buyer-1");

        ArgumentCaptor<OutboxEventJpaEntity> event = ArgumentCaptor.forClass(OutboxEventJpaEntity.class);
        verify(repository).save(event.capture());
        JsonNode envelope = mapper.readTree(event.getValue().getPayload());
        assertThat(envelope.path("causationId").asText()).isEqualTo(
                UUID.nameUUIDFromBytes(("buyer-confirmed:" + allocation.orderId() + ":" + allocation.subOrderId())
                        .getBytes(java.nio.charset.StandardCharsets.UTF_8)).toString());
    }

    public static SubOrderFinancialAllocation allocation() {
        return new SubOrderFinancialAllocation(UUID.randomUUID(), 1, UUID.randomUUID(), 17L, "seller-42",
                CommissionTier.MALL, new BigDecimal("0.03"),
                new FinancialComponents(new BigDecimal("100000"), new BigDecimal("2000"), new BigDecimal("3000"),
                        new BigDecimal("10000"), new BigDecimal("7000"), new BigDecimal("5000"), BigDecimal.ZERO,
                        new BigDecimal("95000"), new BigDecimal("2850"), new BigDecimal("92150"),
                        new BigDecimal("112000"), "VND"),
                SubOrderFinancialAllocation.Source.NATIVE_V1, Instant.parse("2026-07-24T03:30:00Z"));
    }
}
