package com.vnshop.sellerfinanceservice.infrastructure.event;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.sellerfinanceservice.application.RefundWalletUseCase;
import com.vnshop.sellerfinanceservice.domain.CommissionTier;
import com.vnshop.sellerfinanceservice.infrastructure.persistence.ProcessedRefund;
import com.vnshop.sellerfinanceservice.infrastructure.persistence.ProcessedRefundRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

/**
 * Reverses the seller wallet credit when a refund is issued. Payment-service
 * publishes {@code payment.refunded} as a flat JSON object (no outbox envelope —
 * payment-service uses a direct {@code KafkaTemplate.send}, unlike order-service
 * which goes through the outbox). The {@code amount} field is the buyer-facing
 * VND total; this listener applies the same commission tier as the original
 * credit so the wallet projection ends up where it started.
 *
 * <p>Idempotency is enforced via the {@code processed_refund} table: before
 * debiting, the listener checks whether the {@code refundId} has already been
 * processed. If so, the event is skipped. The debit and the insert are wrapped
 * in a single transaction so they commit atomically — a crash between the two
 * cannot leave the system in an inconsistent state.
 */
@Service
public class PaymentRefundedFinanceListener {
    private static final Logger LOGGER = LoggerFactory.getLogger(PaymentRefundedFinanceListener.class);

    private final RefundWalletUseCase refundWalletUseCase;
    private final ProcessedRefundRepository processedRefundRepository;
    private final ObjectMapper objectMapper;

    public PaymentRefundedFinanceListener(RefundWalletUseCase refundWalletUseCase,
                                          ProcessedRefundRepository processedRefundRepository,
                                          ObjectMapper objectMapper) {
        this.refundWalletUseCase = refundWalletUseCase;
        this.processedRefundRepository = processedRefundRepository;
        this.objectMapper = objectMapper;
    }

    @KafkaListener(topics = "payment.refunded", groupId = "seller-finance-service-refund", concurrency = "6")
    @Transactional
    public void onPaymentRefunded(String eventJson) {
        JsonNode payload = readTree(eventJson);
        String sellerId = text(payload, "sellerId");
        String amountRaw = text(payload, "amount");
        String refundId = text(payload, "refundId");
        if (sellerId == null || sellerId.isBlank() || amountRaw == null || amountRaw.isBlank()) {
            LOGGER.warn("payment.refunded missing sellerId or amount — skipping. payload={}", eventJson);
            return;
        }
        if (refundId == null || refundId.isBlank()) {
            LOGGER.warn("payment.refunded missing refundId — skipping. payload={}", eventJson);
            return;
        }
        String reversalId = text(payload, "reversalId");
        if (reversalId != null && !reversalId.isBlank()) {
            LOGGER.debug("payment.refunded reversalId={} is handled by immutable seller-finance adjustment", reversalId);
            return;
        }
        // Idempotency: skip if this refundId was already processed.
        if (processedRefundRepository.existsById(refundId)) {
            LOGGER.info("payment.refunded refundId={} already processed — skipping", refundId);
            return;
        }
        BigDecimal amount;
        try {
            amount = new BigDecimal(amountRaw);
        } catch (NumberFormatException ex) {
            LOGGER.warn("payment.refunded amount={} not a valid number — skipping", amountRaw);
            return;
        }
        // Read commission tier from the event; default to STANDARD for backward
        // compatibility with events published before the tier field was added.
        String tierRaw = text(payload, "commissionTier");
        CommissionTier tier = CommissionTier.STANDARD;
        if (tierRaw != null && !tierRaw.isBlank()) {
            try {
                tier = CommissionTier.valueOf(tierRaw);
            } catch (IllegalArgumentException ex) {
                LOGGER.warn("payment.refunded unknown commissionTier={} — defaulting to STANDARD", tierRaw);
            }
        }
        refundWalletUseCase.refund(sellerId, amount, tier).ifPresentOrElse(
                result -> LOGGER.info("seller-wallet-refunded sellerId={} debited={}", sellerId, result.sellerNet()),
                () -> LOGGER.warn("seller-wallet-refund skipped — no wallet for sellerId={}", sellerId));
        // Record the refundId so a redelivery is a no-op.
        processedRefundRepository.save(new ProcessedRefund(refundId, sellerId, amount));
    }

    private JsonNode readTree(String json) {
        try {
            return objectMapper.readTree(json);
        } catch (Exception ex) {
            throw new IllegalArgumentException("payment.refunded payload is not valid JSON", ex);
        }
    }

    private static String text(JsonNode node, String fieldName) {
        JsonNode value = node.path(fieldName);
        return value.isMissingNode() || value.isNull() ? null : value.asText();
    }

}
