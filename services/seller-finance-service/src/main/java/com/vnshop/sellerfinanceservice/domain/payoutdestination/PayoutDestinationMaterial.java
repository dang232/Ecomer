package com.vnshop.sellerfinanceservice.domain.payoutdestination;

/**
 * Decrypted destination material as received from user-service.
 * Carries ciphertext + key version so the caller can build an
 * immutable snapshot, but never plaintext.
 *
 * <p>Plaintext never lives in this record. Decryption happens
 * only at submission time, in memory, and is intentionally a
 * separate concern.
 */
public record PayoutDestinationMaterial(
        String destinationId,
        String sellerId,
        String ciphertext,
        int keyVersion,
        String algorithm,
        String fingerprint
) {
}
