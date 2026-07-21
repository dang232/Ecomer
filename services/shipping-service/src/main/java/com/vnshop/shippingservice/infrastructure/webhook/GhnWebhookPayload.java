package com.vnshop.shippingservice.infrastructure.webhook;

import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonProperty;

public record GhnWebhookPayload(
        @JsonProperty("OrderCode") String orderCode,
        @JsonProperty("Status") String status,
        @JsonAlias({"StatusCode", "status_code"}) @JsonProperty("StatusCode") String statusCode,
        @JsonAlias({"UpdatedDate", "Time", "updated_at"}) @JsonProperty("UpdatedDate") String updatedDate,
        @JsonProperty("ClientOrderCode") String clientOrderCode
) {
}
