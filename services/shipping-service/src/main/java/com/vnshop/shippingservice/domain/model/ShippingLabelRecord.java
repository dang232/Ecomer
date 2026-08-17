package com.vnshop.shippingservice.domain.model;

import java.util.UUID;

public record ShippingLabelRecord(
        UUID labelId,
        String orderId,
        CarrierCode carrier,
        String trackingCode,
        Status status) {

    public enum Status {
        CREATED,
        CANCELLED
    }
}
