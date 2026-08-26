package com.vnshop.orderservice.application.shipping;

import com.vnshop.orderservice.domain.ParcelDimensions;

public record ShippingQuoteRequest(
        String street,
        String ward,
        String district,
        String city,
        ParcelDimensions parcel) {
}
