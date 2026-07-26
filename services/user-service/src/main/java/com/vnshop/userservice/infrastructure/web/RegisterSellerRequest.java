package com.vnshop.userservice.infrastructure.web;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Browser-facing registration request. Carries the seller-friendly
 * bank label (e.g. "Vietcombank") but never the raw account number.
 * The full account details must be supplied later via
 * {@code POST /sellers/me/payout-destination}.
 */
public record RegisterSellerRequest(
        @NotBlank
        @Size(min = 2, max = 120)
        String shopName,
        @NotBlank
        @Size(min = 2, max = 120)
        String bankName
) {
}
