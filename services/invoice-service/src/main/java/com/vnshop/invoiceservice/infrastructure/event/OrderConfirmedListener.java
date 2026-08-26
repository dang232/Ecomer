package com.vnshop.invoiceservice.infrastructure.event;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.invoiceservice.application.InvoiceService;
import com.vnshop.invoiceservice.application.SellerAuthorizationService;
import com.vnshop.invoiceservice.domain.entity.AuthorizationStatus;
import com.vnshop.invoiceservice.domain.entity.SellerAuthorization;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.DltHandler;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.kafka.annotation.RetryableTopic;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.retrytopic.DltStrategy;
import org.springframework.stereotype.Service;
import com.vnshop.invoiceservice.infrastructure.dlt.DurableDltService;
import org.apache.kafka.clients.consumer.ConsumerRecord;

/**
 * Consumes {@code order.confirmed} events and creates a DRAFT Invoice record
 * for sellers with ACTIVE authorization, or publishes a
 * {@code notification.seller-invoice-required} event for non-authorized sellers.
 *
 * <p>Idempotent: duplicate events for the same orderId are silently ignored
 * by {@link InvoiceService#createDraftInvoice}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class OrderConfirmedListener {

    static final String TOPIC_SELLER_INVOICE_REQUIRED = "notification.seller-invoice-required";

    private final InvoiceService invoiceService;
    private final SellerAuthorizationService sellerAuthorizationService;
    private final ObjectMapper objectMapper;
    private final KafkaTemplate<String, String> kafkaTemplate;
    private final DurableDltService durableDltService;

    @RetryableTopic(
            attempts = "3",
            dltStrategy = DltStrategy.FAIL_ON_ERROR,
            dltTopicSuffix = ".DLT",
            retryTopicSuffix = ".retry"
    )
    @KafkaListener(topics = "order.confirmed", groupId = "invoice-service", concurrency = "3")
    public void onOrderConfirmed(String eventJson) {
        JsonNode payload = parseJson(eventJson);
        if (payload == null) {
            return;
        }

        String orderIdRaw = text(payload, "orderId");
        if (orderIdRaw == null || orderIdRaw.isBlank()) {
            log.warn("order.confirmed missing orderId — skipping. payload={}", eventJson);
            return;
        }

        UUID orderId = parseUuid(orderIdRaw);
        if (orderId == null) {
            log.warn("order.confirmed orderId={} is not a valid UUID — skipping", orderIdRaw);
            return;
        }

        String sellerId = text(payload, "sellerId");
        String buyerId = text(payload, "buyerId");
        String items = extractJsonField(payload, "items");
        String vatBreakdown = extractJsonField(payload, "vatBreakdown");
        String buyerTaxCode = text(payload, "buyerTaxCode");

        Optional<SellerAuthorization> authOpt = sellerAuthorizationService.getAuthorization(sellerId);
        boolean authorized = authOpt.map(a -> AuthorizationStatus.ACTIVE == a.getStatus())
                .orElse(false);

        if (authorized) {
            BigDecimal taxDeductionAmount = calculateTaxDeduction(payload, authOpt.get().getTaxDeductionPercent());
            invoiceService.createDraftInvoice(orderId, sellerId, buyerId, items, vatBreakdown, buyerTaxCode,
                    taxDeductionAmount);
        } else {
            publishSellerInvoiceRequired(orderId, sellerId, eventJson);
        }
    }

    @DltHandler
    public void handleDlt(ConsumerRecord<String, String> record) {
        durableDltService.store(record, "order.confirmed DLT payload received", 3);
    }

    private BigDecimal calculateTaxDeduction(JsonNode payload, int taxDeductionPercent) {
        JsonNode totalNode = payload.path("totalAmount");
        if (totalNode.isMissingNode() || totalNode.isNull()) {
            return null;
        }
        try {
            BigDecimal total = new BigDecimal(totalNode.asText());
            return total.multiply(BigDecimal.valueOf(taxDeductionPercent))
                    .divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP);
        } catch (NumberFormatException ex) {
            log.warn("Could not parse totalAmount for tax deduction calculation: {}", ex.getMessage());
            return null;
        }
    }

    private void publishSellerInvoiceRequired(UUID orderId, String sellerId, String originalEventJson) {
        try {
            String notification = objectMapper.writeValueAsString(
                    Map.of("orderId", orderId.toString(), "sellerId", sellerId == null ? "" : sellerId));
            kafkaTemplate.send(TOPIC_SELLER_INVOICE_REQUIRED, orderId.toString(), notification);
            log.info("Seller {} not authorized for invoicing — published {} for orderId={}", sellerId,
                    TOPIC_SELLER_INVOICE_REQUIRED, orderId);
        } catch (Exception ex) {
            log.error("Failed to publish {} for orderId={}: {}", TOPIC_SELLER_INVOICE_REQUIRED, orderId,
                    ex.getMessage());
            throw new RuntimeException("Failed to publish seller-invoice-required event", ex);
        }
    }

    private JsonNode parseJson(String json) {
        try {
            return objectMapper.readTree(json);
        } catch (Exception ex) {
            throw new IllegalArgumentException("order.confirmed payload is not valid JSON", ex);
        }
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.path(field);
        return value.isMissingNode() || value.isNull() ? null : value.asText();
    }

    private String extractJsonField(JsonNode node, String field) {
        JsonNode value = node.path(field);
        if (value.isMissingNode() || value.isNull()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception ex) {
            log.warn("Failed to serialize field '{}': {}", field, ex.getMessage());
            return null;
        }
    }

    private static UUID parseUuid(String raw) {
        try {
            return UUID.fromString(raw);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }
}
