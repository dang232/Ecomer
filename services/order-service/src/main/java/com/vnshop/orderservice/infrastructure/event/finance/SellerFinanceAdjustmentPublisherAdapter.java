package com.vnshop.orderservice.infrastructure.event.finance;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.orderservice.domain.finance.SubOrderFinancialAllocation;
import com.vnshop.orderservice.domain.port.out.SellerFinanceAdjustmentPublisherPort;
import com.vnshop.orderservice.infrastructure.outbox.OutboxEvent;
import com.vnshop.orderservice.infrastructure.outbox.OutboxEventJpaEntity;
import com.vnshop.orderservice.infrastructure.outbox.OutboxEventRepository;
import java.time.Instant;
import org.springframework.stereotype.Service;

@Service
public class SellerFinanceAdjustmentPublisherAdapter implements SellerFinanceAdjustmentPublisherPort {
    private static final String EVENT_TYPE = "SELLER_FINANCE_ADJUSTMENT";

    private final OutboxEventRepository repository;
    private final ObjectMapper objectMapper;

    public SellerFinanceAdjustmentPublisherAdapter(OutboxEventRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @Override
    public void publishCredit(SubOrderFinancialAllocation allocation, String causationId) {
        stage(SellerFinanceAdjustmentEvent.credit(allocation, causationId, Instant.now()), allocation);
    }

    public void publishCredit(SubOrderFinancialAllocation allocation) {
        publishCredit(allocation, allocation.allocationId().toString());
    }

    @Override
    public void publishRelease(SubOrderFinancialAllocation allocation, String buyerId) {
        stage(SellerFinanceAdjustmentEvent.release(allocation, buyerId, Instant.now()), allocation);
    }

    private void stage(SellerFinanceAdjustmentEvent event, SubOrderFinancialAllocation allocation) {
        repository.save(OutboxEventJpaEntity.fromDomain(OutboxEvent.pending(
                "Seller", allocation.sellerId(), EVENT_TYPE, toJson(event))));
    }

    private String toJson(SellerFinanceAdjustmentEvent event) {
        try {
            return objectMapper.writeValueAsString(event);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Failed to serialize seller finance adjustment " + event.eventId(), exception);
        }
    }
}
