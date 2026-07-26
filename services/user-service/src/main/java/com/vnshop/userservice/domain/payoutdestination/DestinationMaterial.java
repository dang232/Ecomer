package com.vnshop.userservice.domain.payoutdestination;

/**
 * Service-to-service carrier for the encrypted destination material.
 * Returned by the internal lookup endpoint and forwarded to the
 * seller-finance-service where the snapshot is re-encrypted under the
 * finance key.
 *
 * <p>This object MUST never be serialized into a browser-facing API.
 */
public record DestinationMaterial(
        String destinationId,
        String sellerId,
        String ciphertext,
        int keyVersion,
        String algorithm,
        String fingerprint
) {
    public DestinationMaterial {
        if (destinationId == null || destinationId.isBlank()) {
            throw new IllegalArgumentException("destinationId is required");
        }
        if (sellerId == null || sellerId.isBlank()) {
            throw new IllegalArgumentException("sellerId is required");
        }
        if (ciphertext == null || ciphertext.isBlank()) {
            throw new IllegalArgumentException("ciphertext is required");
        }
        if (keyVersion <= 0) {
            throw new IllegalArgumentException("keyVersion must be > 0");
        }
        if (algorithm == null || algorithm.isBlank()) {
            throw new IllegalArgumentException("algorithm is required");
        }
        if (fingerprint == null || fingerprint.isBlank()) {
            throw new IllegalArgumentException("fingerprint is required");
        }
    }
}
