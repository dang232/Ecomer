package com.vnshop.shippingservice.infrastructure.webhook;

import com.vnshop.shippingservice.domain.model.CarrierWebhookEvent;
import org.springframework.stereotype.Component;

import java.util.Locale;

@Component
public class GhnWebhookMapper {
    public CarrierWebhookEvent toEvent(GhnWebhookPayload payload) {
        String trackingCode = payload.orderCode();
        String orderId = firstNonBlank(payload.clientOrderCode(), trackingCode);
        return new CarrierWebhookEvent(
                WebhookEventIdentity.create("GHN", trackingCode, payload.updatedDate(), payload.status(), payload.statusCode()),
                orderId,
                "GHN",
                trackingCode,
                mapStatus(payload.statusCode(), payload.status()),
                payload.status(),
                payload.updatedDate(),
                payload.codCollectedAmount(),
                payload.collectionId(),
                payload.currency());
    }

    private String mapStatus(String statusCode, String status) {
        String value = firstNonBlank(statusCode, status);
        if (value == null) {
            return "UNKNOWN";
        }
        return switch (value.trim().toLowerCase(Locale.ROOT)) {
            case "1", "readytopick", "ready_to_pick", "created" -> "CREATED";
            case "2", "3", "picking", "picked", "pickup", "picked_up" -> "PICKED_UP";
            case "4", "5", "6", "storing", "transporting", "sorting", "transport", "in_transit" -> "IN_TRANSIT";
            case "7", "delivering", "out_for_delivery" -> "OUT_FOR_DELIVERY";
            case "8", "200", "delivered", "da_giao" -> "DELIVERED";
            case "9", "return", "returning" -> "RETURNING";
            case "10", "returned", "return_completed" -> "RETURNED";
            case "11", "12", "13", "exception", "damage", "lost", "failed" -> "DELIVERY_FAILED";
            case "cancel", "cancelled", "canceled", "huy" -> "CANCELLED";
            default -> value.trim().toUpperCase(Locale.ROOT);
        };
    }

    private String firstNonBlank(String first, String fallback) {
        return first != null && !first.isBlank() ? first : fallback;
    }
}
