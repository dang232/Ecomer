package com.vnshop.orderservice.infrastructure.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

public record ShippingOptionsRequest(
        @Valid @NotNull AddressRequest address,
        @Valid @NotNull ParcelRequest parcel) {
}
