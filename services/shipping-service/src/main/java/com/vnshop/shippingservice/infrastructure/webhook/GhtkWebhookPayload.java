package com.vnshop.shippingservice.infrastructure.webhook;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;

public record GhtkWebhookPayload(
        @JsonProperty("label_id") String labelId,
        String status,
        @JsonProperty("status_text") String statusText,
        @JsonProperty("updated_at") String updatedAt,
        @JsonProperty("order_id") String orderId,
        @JsonAlias({"cod_collected_amount", "collected_cod_amount", "cod_collect_amount"})
        @JsonProperty("cod_collected_amount") BigDecimal codCollectedAmount,
        @JsonAlias({"collection_id", "cod_collection_id"}) @JsonProperty("collection_id") String collectionId,
        @JsonAlias({"currency"}) @JsonProperty("currency") String currency
) {
    public GhtkWebhookPayload(String labelId, String status, String statusText, String updatedAt, String orderId) {
        this(labelId, status, statusText, updatedAt, orderId, null, null, null);
    }
}
