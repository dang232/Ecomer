package com.vnshop.userservice.infrastructure.web;

import com.vnshop.userservice.domain.SellerProfile;

/**
 * Self/admin-facing seller profile response. The destination is
 * surfaced only as {@code destinationId + bankName + last4 +
 * verificationState}. The plaintext account number never appears in
 * this DTO.
 */
public record SellerProfileResponse(
        String id,
        String shopName,
        String bankName,
        boolean approved,
        String tier,
        boolean vacationMode,
        DestinationSummary destination
) {
    public static SellerProfileResponse fromDomain(SellerProfile sellerProfile) {
        DestinationSummary dest = sellerProfile.destinationMask()
                .map(m -> new DestinationSummary(m.destinationId(), m.bankName(), m.last4(), m.verificationState()))
                .orElse(null);
        return new SellerProfileResponse(
                sellerProfile.id(),
                sellerProfile.shopName(),
                sellerProfile.bankName(),
                sellerProfile.approved(),
                sellerProfile.tier().name(),
                sellerProfile.vacationMode(),
                dest
        );
    }

    public record DestinationSummary(
            String destinationId,
            String bankName,
            String last4,
            String verificationState
    ) {}
}