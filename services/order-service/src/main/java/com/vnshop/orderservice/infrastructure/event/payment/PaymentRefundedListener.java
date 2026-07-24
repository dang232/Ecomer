package com.vnshop.orderservice.infrastructure.event.payment;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.orderservice.domain.RefundLedgerEntry;
import com.vnshop.orderservice.domain.Return;
import com.vnshop.orderservice.domain.ReturnStatus;
import com.vnshop.orderservice.domain.port.out.RefundLedgerRepositoryPort;
import com.vnshop.orderservice.domain.port.out.ReturnRepositoryPort;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.DltHandler;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.annotation.RetryableTopic;
import org.springframework.kafka.retrytopic.DltStrategy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Closes the buyer-visible refund state and records durable financial evidence.
 * A payment refund can be an order-level saga compensation without a return ID,
 * so the ledger is written independently of the return state transition.
 */
@Service
public class PaymentRefundedListener {
    private static final Logger LOGGER = LoggerFactory.getLogger(PaymentRefundedListener.class);

    private final ReturnRepositoryPort returnRepository;
    private final RefundLedgerRepositoryPort refundLedgerRepository;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    public PaymentRefundedListener(
            ReturnRepositoryPort returnRepository,
            RefundLedgerRepositoryPort refundLedgerRepository,
            ObjectMapper objectMapper,
            Clock clock) {
        this.returnRepository = returnRepository;
        this.refundLedgerRepository = refundLedgerRepository;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    @RetryableTopic(
            attempts = "3",
            dltStrategy = DltStrategy.FAIL_ON_ERROR,
            dltTopicSuffix = ".DLT",
            retryTopicSuffix = ".retry"
    )
    @KafkaListener(topics = "payment.refunded", groupId = "order-service-refund", concurrency = "6")
    @Transactional
    public void onPaymentRefunded(String eventJson) {
        JsonNode payload = readTree(eventJson);
        String refundId = text(payload, "refundId");
        if (refundId == null || refundId.isBlank()) {
            throw new IllegalArgumentException("payment.refunded requires refundId");
        }

        UUID orderId = parseUuid(text(payload, "orderId"));
        if (orderId == null) {
            throw new IllegalArgumentException("payment.refunded requires a valid orderId");
        }

        UUID returnId = parseOptionalUuid(payload, "returnId", refundId);

        BigDecimal amount = parseAmount(payload, refundId);
        if (amount == null) {
            throw new IllegalArgumentException("payment.refunded requires a positive amount");
        }
        String currency = text(payload, "currency");
        if (currency == null || currency.isBlank()) {
            throw new IllegalArgumentException("payment.refunded requires currency");
        }
        if (!"VND".equalsIgnoreCase(currency)) {
            throw new IllegalArgumentException("payment.refunded supports VND amounts only");
        }
        currency = currency.toUpperCase(Locale.ROOT);
        String status = text(payload, "status");
        if (status == null || status.isBlank()) {
            status = "COMPLETED";
        }
        boolean partial = "PARTIALLY_REFUNDED".equalsIgnoreCase(status);
        boolean completed = "COMPLETED".equalsIgnoreCase(status)
                || "REFUNDED".equalsIgnoreCase(status);
        if (!partial && !completed) {
            LOGGER.warn("payment.refunded refundId={} has unsupported status={}; event ignored", refundId, status);
            return;
        }

        if (refundLedgerRepository.existsByRefundId(refundId)) {
            LOGGER.debug("payment.refunded refundId={} already recorded; duplicate ignored", refundId);
            return;
        }

        refundLedgerRepository.save(new RefundLedgerEntry(
                refundId,
                orderId,
                returnId,
                text(payload, "sellerId"),
                amount,
                currency,
                Instant.now(clock),
                status.toUpperCase(Locale.ROOT)));

        if (returnId == null || partial) {
            LOGGER.info("payment-refunded ledgered orderId={} refundId={} without return", orderId, refundId);
            return;
        }

        Optional<Return> maybeReturn = returnRepository.findById(returnId);
        if (maybeReturn.isEmpty()) {
            LOGGER.warn("payment.refunded returnId={} not found; ledger retained for refundId={}", returnId, refundId);
            return;
        }

        Return orderReturn = maybeReturn.get();
        if (orderReturn.status() == ReturnStatus.REFUNDED) {
            LOGGER.debug("payment.refunded returnId={} already REFUNDED; ledger recorded", returnId);
            return;
        }
        if (orderReturn.status() != ReturnStatus.COMPLETED) {
            LOGGER.warn("payment.refunded returnId={} in status={}; ledger recorded", returnId, orderReturn.status());
            return;
        }

        orderReturn.markRefunded();
        returnRepository.save(orderReturn);
        LOGGER.info("payment-refunded returnId={} orderId={} refundId={}", returnId, orderId, refundId);
    }

    private BigDecimal parseAmount(JsonNode payload, String refundId) {
        String raw = text(payload, "amount");
        if (raw == null || raw.isBlank()) {
            LOGGER.warn("payment.refunded refundId={} has no amount; event rejected", refundId);
            return null;
        }
        try {
            BigDecimal amount = new BigDecimal(raw);
            if (amount.signum() <= 0) {
                LOGGER.warn("payment.refunded refundId={} has non-positive amount; event rejected", refundId);
                return null;
            }
            return amount;
        } catch (NumberFormatException exception) {
            LOGGER.warn("payment.refunded refundId={} has invalid amount; event rejected", refundId);
            return null;
        }
    }

    private JsonNode readTree(String json) {
        try {
            return objectMapper.readTree(json);
        } catch (Exception ex) {
            throw new IllegalArgumentException("payment.refunded payload is not valid JSON", ex);
        }
    }

    private static UUID parseOptionalUuid(JsonNode payload, String fieldName, String refundId) {
        String raw = text(payload, fieldName);
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(raw);
        } catch (IllegalArgumentException ex) {
            LOGGER.warn("payment.refunded refundId={} has invalid {}", refundId, fieldName);
            return null;
        }
    }

    private static UUID parseUuid(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(raw);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private static String text(JsonNode node, String fieldName) {
        JsonNode value = node.path(fieldName);
        return value.isMissingNode() || value.isNull() ? null : value.asText();
    }

    @DltHandler
    public void handleDlt(String message) {
        LOGGER.error("payment.refunded message sent to DLT after retries exhausted");
    }
}
