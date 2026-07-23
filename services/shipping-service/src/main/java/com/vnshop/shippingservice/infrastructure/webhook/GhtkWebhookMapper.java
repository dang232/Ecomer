package com.vnshop.shippingservice.infrastructure.webhook;

import com.vnshop.shippingservice.domain.model.CarrierWebhookEvent;
import org.springframework.stereotype.Component;

import java.util.Locale;

@Component
public class GhtkWebhookMapper {
    public CarrierWebhookEvent toEvent(GhtkWebhookPayload payload) {
        String trackingCode = payload.labelId();
        return new CarrierWebhookEvent(
                WebhookEventIdentity.create("GHTK", trackingCode, payload.updatedAt(), payload.status(), payload.statusText()),
                firstNonBlank(payload.orderId(), trackingCode),
                "GHTK",
                trackingCode,
                mapStatus(payload.status()),
                payload.statusText(),
                payload.updatedAt(),
                payload.codCollectedAmount(),
                payload.collectionId(),
                payload.currency());
    }

    public String mapStatus(String value) {
        if (value == null || value.isBlank()) {
            return "UNKNOWN";
        }
        return switch (value.trim().toLowerCase(Locale.ROOT)) {
            case "1", "2", "created", "moi", "accepted", "da-tiep-nhan" -> "CREATED";
            case "3", "4", "pickup", "lay-hang", "picked_up" -> "PICKED_UP";
            case "5", "transport", "van-chuyen", "in_transit" -> "IN_TRANSIT";
            case "6", "delivering", "dang-giao", "out_for_delivery" -> "OUT_FOR_DELIVERY";
            case "7", "8", "delivered", "da-giao" -> "DELIVERED";
            case "failed", "that-bai", "delivery_failed" -> "DELIVERY_FAILED";
            case "return", "tra-hang", "returned" -> "RETURNED";
            default -> value.trim().toUpperCase(Locale.ROOT);
        };
    }

    private String firstNonBlank(String first, String fallback) {
        return first != null && !first.isBlank() ? first : fallback;
    }
}
