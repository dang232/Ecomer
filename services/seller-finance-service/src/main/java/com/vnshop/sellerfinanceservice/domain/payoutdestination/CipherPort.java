package com.vnshop.sellerfinanceservice.domain.payoutdestination;

/**
 * Decode-only cipher for finance-side immutable snapshots. The encryptor
 * lives in user-service; seller-finance only decrypts envelopes handed to
 * it by inter-service calls.
 *
 * <p>Implementations must be fail-closed: missing or invalid keys
 * produce {@link IllegalStateException} rather than empty plaintext.
 */
public interface CipherPort {

    /** Highest key version this cipher can decrypt. */
    int currentKeyVersion();

    /** Decrypt a versioned envelope previously produced by user-service. */
    String decrypt(String envelope);
}
