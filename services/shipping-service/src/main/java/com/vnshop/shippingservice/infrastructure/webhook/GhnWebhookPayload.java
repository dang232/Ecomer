package com.vnshop.shippingservice.infrastructure.webhook;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.math.BigDecimal;

public record GhnWebhookPayload(
        @JsonProperty("OrderCode") String orderCode,
        @JsonProperty("Status") String status,
        @JsonAlias({"StatusCode", "status_code"}) @JsonProperty("StatusCode") String statusCode,
        @JsonAlias({"UpdatedDate", "Time", "updated_at"}) @JsonProperty("UpdatedDate") String updatedDate,
        @JsonProperty("ClientOrderCode") String clientOrderCode,
        @JsonAlias({"CodCollectedAmount", "cod_collected_amount", "CodCollectAmount", "CodCollect"})
        @JsonProperty("CodCollectedAmount") BigDecimal codCollectedAmount,
        @JsonAlias({"CollectionId", "collection_id", "cod_collection_id"})
        @JsonProperty("CollectionId") String collectionId,
        @JsonAlias({"Currency", "currency"}) @JsonProperty("Currency") String currency
) {
}
