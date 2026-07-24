package com.vnshop.sellerfinanceservice.infrastructure.event;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.sellerfinanceservice.application.CreditWalletUseCase;
import com.vnshop.sellerfinanceservice.domain.CommissionTier;
import com.vnshop.sellerfinanceservice.infrastructure.persistence.ProcessedOrderEvent;
import com.vnshop.sellerfinanceservice.infrastructure.persistence.ProcessedOrderEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@Service
@ConditionalOnProperty(prefix = "seller-finance.legacy-order-created-consumer", name = "enabled", havingValue = "true")
public class OrderCreatedFinanceListener {
    private static final Logger LOGGER = LoggerFactory.getLogger(OrderCreatedFinanceListener.class);

    private final CreditWalletUseCase creditWalletUseCase;
    private final ProcessedOrderEventRepository processedOrderEventRepository;
    private final ObjectMapper objectMapper;

    public OrderCreatedFinanceListener(CreditWalletUseCase creditWalletUseCase,
                                       ProcessedOrderEventRepository processedOrderEventRepository,
                                       ObjectMapper objectMapper) {
        this.creditWalletUseCase = creditWalletUseCase;
        this.processedOrderEventRepository = processedOrderEventRepository;
        this.objectMapper = objectMapper;
    }

    @KafkaListener(topics = {"order.created", "order.paid"}, groupId = "seller-finance-service", concurrency = "6")
    @Transactional
    public void onOrderEvent(String eventJson) {
        JsonNode envelope = readTree(eventJson);
        String eventType = text(envelope, "eventType");
        JsonNode payload = envelope.hasNonNull("payload") ? readTree(envelope.get("payload").asText()) : envelope;
        if (!"ORDER_CREATED".equals(eventType) && !"ORDER_CREATED".equals(text(payload, "eventType"))) {
            return;
        }

        // Idempotency: the outbox envelope carries the row id as "id"; use it as the dedup key.
        String eventId = text(envelope, "id");
        if (eventId == null || eventId.isBlank()) {
            LOGGER.warn("order.created/paid event missing id field — skipping idempotency check. payload={}", eventJson);
        } else if (processedOrderEventRepository.existsById(eventId)) {
            LOGGER.info("order event id={} already processed — skipping", eventId);
            return;
        }

        for (JsonNode sellerTotal : payload.path("sellerTotals")) {
            String sellerId = text(sellerTotal, "sellerId");
            BigDecimal orderAmount = sellerTotal.path("amount").decimalValue();
            CommissionTier tier = CommissionTier.valueOf(textOrDefault(sellerTotal, "commissionTier", CommissionTier.STANDARD.name()));
            creditWalletUseCase.credit(sellerId, orderAmount, tier);
        }

        // Record the event id so a redelivery is a no-op.
        if (eventId != null && !eventId.isBlank()) {
            processedOrderEventRepository.save(new ProcessedOrderEvent(eventId));
        }
    }

    private JsonNode readTree(String json) {
        try {
            return objectMapper.readTree(json);
        } catch (Exception exception) {
            throw new IllegalArgumentException("order event payload is invalid", exception);
        }
    }

    private static String text(JsonNode node, String fieldName) {
        return node.path(fieldName).asText();
    }

    private static String textOrDefault(JsonNode node, String fieldName, String defaultValue) {
        JsonNode value = node.path(fieldName);
        return value.isMissingNode() || value.asText().isBlank() ? defaultValue : value.asText();
    }

}
