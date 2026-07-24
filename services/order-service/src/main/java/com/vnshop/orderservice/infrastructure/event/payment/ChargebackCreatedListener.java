package com.vnshop.orderservice.infrastructure.event.payment;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.PaymentStatus;
import com.vnshop.orderservice.domain.finance.FinancialReversal;
import com.vnshop.orderservice.domain.finance.SubOrderFinancialAllocation;
import com.vnshop.orderservice.domain.port.out.OrderRepositoryPort;
import com.vnshop.orderservice.domain.port.out.FinancialReversalRepositoryPort;
import com.vnshop.orderservice.domain.port.out.SellerFinanceAdjustmentPublisherPort;
import com.vnshop.orderservice.domain.port.out.SubOrderFinancialAllocationRepositoryPort;
import java.math.BigDecimal;
import java.util.Optional;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.kafka.annotation.DltHandler;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.annotation.RetryableTopic;
import org.springframework.kafka.retrytopic.DltStrategy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Consumes chargeback-open events and stages both order and finance effects. */
@Service
public class ChargebackCreatedListener {
    private static final Logger log = LoggerFactory.getLogger(ChargebackCreatedListener.class);

    private final OrderRepositoryPort orderRepository;
    private final ObjectMapper objectMapper;
    private final SubOrderFinancialAllocationRepositoryPort allocationRepository;
    private final SellerFinanceAdjustmentPublisherPort sellerFinancePublisher;
    private final FinancialReversalRepositoryPort reversalRepository;

    public ChargebackCreatedListener(OrderRepositoryPort orderRepository, ObjectMapper objectMapper) {
        this(orderRepository, objectMapper, null, null, null);
    }

    public ChargebackCreatedListener(
            OrderRepositoryPort orderRepository,
            ObjectMapper objectMapper,
            SubOrderFinancialAllocationRepositoryPort allocationRepository,
            SellerFinanceAdjustmentPublisherPort sellerFinancePublisher) {
        this(orderRepository, objectMapper, allocationRepository, sellerFinancePublisher, null);
    }

    @Autowired
    public ChargebackCreatedListener(
            OrderRepositoryPort orderRepository,
            ObjectMapper objectMapper,
            SubOrderFinancialAllocationRepositoryPort allocationRepository,
            SellerFinanceAdjustmentPublisherPort sellerFinancePublisher,
            FinancialReversalRepositoryPort reversalRepository) {
        this.orderRepository = orderRepository;
        this.objectMapper = objectMapper;
        this.allocationRepository = allocationRepository;
        this.sellerFinancePublisher = sellerFinancePublisher;
        this.reversalRepository = reversalRepository;
    }

    @RetryableTopic(attempts = "3", dltStrategy = DltStrategy.FAIL_ON_ERROR,
            dltTopicSuffix = ".DLT", retryTopicSuffix = ".retry")
    @KafkaListener(topics = "payment.chargeback.created", groupId = "order-service-chargeback", concurrency = "3")
    @Transactional
    public void onChargebackCreated(String eventJson) {
        JsonNode payload = readTree(eventJson);
        UUID orderId = parseUuid(text(payload, "orderId"));
        if (orderId == null) {
            log.warn("payment.chargeback.created missing valid orderId");
            return;
        }

        Optional<Order> maybeOrder = orderRepository.findById(orderId);
        if (maybeOrder.isPresent()) {
            Order order = maybeOrder.get();
            if (order.paymentStatus() != PaymentStatus.DISPUTED) {
                order.markPaymentDisputed();
                orderRepository.save(order);
            }
        } else {
            log.warn("payment.chargeback.created orderId={} not found", orderId);
        }

        UUID chargebackId = parseUuid(text(payload, "chargebackId"));
        if (chargebackId != null && allocationRepository != null && sellerFinancePublisher != null) {
            if (reversalRepository != null && !reversalRepository.findByReversalId(chargebackId).isEmpty()) {
                log.debug("payment.chargeback.created chargebackId={} already reserved; duplicate ignored", chargebackId);
                return;
            }
            List<SubOrderFinancialAllocation> allocations = allocationRepository.findByOrderId(orderId);
            if (reversalRepository == null) {
                ChargebackAllocationSupport.portions(allocations, decimal(payload, "challengedAmount"))
                        .forEach(portion -> sellerFinancePublisher.publishChargebackHold(
                                portion.allocation(), chargebackId, portion.components()));
            } else {
                ChargebackAllocationSupport.portions(allocations, decimal(payload, "challengedAmount"),
                                allocation -> reversalRepository.remainingBuyerAmount(
                                        allocation.allocationId(), allocation.components().buyerPaidAmount()))
                        .forEach(portion -> {
                            FinancialReversal reservation = reversalRepository.reserve(
                                    new FinancialReversal(chargebackId, portion.allocation().allocationId(), orderId,
                                            FinancialReversal.ReversalType.CHARGEBACK,
                                            FinancialReversal.ReversalStatus.OPEN,
                                            portion.components().buyerPaidAmount(),
                                            portion.components().currency(), Instant.now(), Instant.now()),
                                    portion.allocation().components().buyerPaidAmount());
                            sellerFinancePublisher.publishChargebackHold(
                                    portion.allocation(), chargebackId,
                                    portion.allocation().components().reversalForBuyerAmount(reservation.buyerAmount()));
                        });
            }
        }
        log.info("chargeback-disputed orderId={} chargebackId={} provider={}",
                orderId, text(payload, "chargebackId"), text(payload, "provider"));
    }

    private JsonNode readTree(String json) {
        try {
            return objectMapper.readTree(json);
        } catch (Exception ex) {
            throw new IllegalArgumentException("payment.chargeback.created payload is not valid JSON", ex);
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
        log.error("payment.chargeback.created sent to DLT after retries exhausted: {}", message);
    }
}
