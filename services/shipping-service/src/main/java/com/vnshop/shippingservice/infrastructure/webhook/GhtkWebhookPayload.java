package com.vnshop.shippingservice.infrastructure.webhook;

import com.fasterxml.jackson.annotation.JsonProperty;

public record GhtkWebhookPayload(
        @JsonProperty("label_id") String labelId,
        String status,
        @JsonProperty("status_text") String statusText,
        @JsonProperty("updated_at") String updatedAt,
        @JsonProperty("order_id") String orderId
) {
}
