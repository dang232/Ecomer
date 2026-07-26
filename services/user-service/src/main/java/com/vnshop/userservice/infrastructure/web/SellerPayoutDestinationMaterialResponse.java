package com.vnshop.userservice.infrastructure.web;

import com.vnshop.userservice.domain.payoutdestination.DestinationMaterial;

/**
 * Service-to-service payload carrying encrypted destination material.
 * Only used on internal routes; never exposed to the public internet.
 */
public record SellerPayoutDestinationMaterialResponse(
        String destinationId,
        String sellerId,
        String ciphertextEnvelope,
        int keyVersion,
        String algorithm,
        String fingerprint
) {
    public static SellerPayoutDestinationMaterialResponse fromDomain(DestinationMaterial material) {
        return new SellerPayoutDestinationMaterialResponse(
                material.destinationId(),
                material.sellerId(),
                material.ciphertext(),
                material.keyVersion(),
                material.algorithm(),
                material.fingerprint()
        );
    }
}
