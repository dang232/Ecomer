package com.vnshop.orderservice.infrastructure.event.payment;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.PaymentStatus;
import com.vnshop.orderservice.domain.port.out.OrderRepositoryPort;
import com.vnshop.orderservice.domain.port.out.SellerFinanceAdjustmentPublisherPort;
import com.vnshop.orderservice.domain.port.out.SubOrderFinancialAllocationRepositoryPort;
import java.math.BigDecimal;
import java.util.Optional;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.kafka.annotation.DltHandler;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.annotation.RetryableTopic;
import org.springframework.kafka.retrytopic.DltStrategy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Applies the order and seller-finance effects of a resolved chargeback. */
@Service
public class ChargebackResolvedListener {
    private final OrderRepositoryPort orderRepository;
    private final ObjectMapper objectMapper;
    private final SubOrderFinancialAllocationRepositoryPort allocationRepository;
    private final SellerFinanceAdjustmentPublisherPort sellerFinancePublisher;

    public ChargebackResolvedListener(OrderRepositoryPort orderRepository, ObjectMapper objectMapper) {
        this(orderRepository, objectMapper, null, null);
    }

    @Autowired
    public ChargebackResolvedListener(
            OrderRepositoryPort orderRepository,
            ObjectMapper objectMapper,
            SubOrderFinancialAllocationRepositoryPort allocationRepository,
            SellerFinanceAdjustmentPublisherPort sellerFinancePublisher) {
        this.orderRepository = orderRepository;
        this.objectMapper = objectMapper;
        this.allocationRepository = allocationRepository;
        this.sellerFinancePublisher = sellerFinancePublisher;
    }

    @RetryableTopic(attempts = "3", dltStrategy = DltStrategy.FAIL_ON_ERROR,
            dltTopicSuffix = ".DLT", retryTopicSuffix = ".retry")
    @KafkaListener(topics = "payment.chargeback.resolved", groupId = "order-service-chargeback-resolved", concurrency = "3")
    @Transactional
    public void onChargebackResolved(String eventJson) {
        JsonNode payload = readTree(eventJson);
        UUID orderId = parseUuid(text(payload, "orderId"));
        UUID chargebackId = parseUuid(text(payload, "chargebackId"));
        String outcome = text(payload, "outcome");
        if (orderId == null || chargebackId == null || outcome == null) return;

        Optional<Order> maybeOrder = orderRepository.findById(orderId);
        if (maybeOrder.isPresent()
                && "WON".equalsIgnoreCase(outcome)
                && maybeOrder.get().paymentStatus() == PaymentStatus.DISPUTED) {
            Order order = maybeOrder.get();
            order.markPaymentCompleted();
            orderRepository.save(order);
        }

        if (allocationRepository == null || sellerFinancePublisher == null) return;
        for (ChargebackAllocationSupport.Portion portion : ChargebackAllocationSupport.portions(
                allocationRepository.findByOrderId(orderId), decimal(payload, "challengedAmount"))) {
            if ("WON".equalsIgnoreCase(outcome)) {
                sellerFinancePublisher.publishChargebackRelease(
                        portion.allocation(), chargebackId, portion.components());
            } else if ("LOST".equalsIgnoreCase(outcome) || "ACCEPTED".equalsIgnoreCase(outcome)) {
                sellerFinancePublisher.publishChargebackFinalize(
                        portion.allocation(), chargebackId, portion.components());
            }
        }
    }

    private JsonNode readTree(String json) {
        try {
            return objectMapper.readTree(json);
        } catch (Exception ex) {
            throw new IllegalArgumentException("payment.chargeback.resolved payload is not valid JSON", ex);
        }
    }

    private static UUID parseUuid(String raw) {
        try {
            return raw == null ? null : UUID.fromString(raw);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isMissingNode() || value.isNull() ? null : value.asText();
    }

    private static BigDecimal decimal(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() || value.asText().isBlank() ? null : value.decimalValue();
    }

    @DltHandler
    public void handleDlt(String message) {
        // DLT handling is intentionally observable through broker tooling.
    }
}
