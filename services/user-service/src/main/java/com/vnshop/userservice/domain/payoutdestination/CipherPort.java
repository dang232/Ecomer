package com.vnshop.userservice.domain.payoutdestination;

/**
 * Authenticated-encryption port for payout destination material.
 * <p>
 * Implementations MUST use authenticated encryption (AEAD) with a
 * versioned key. {@link #currentKeyVersion()} is the version that will
 * be embedded in the ciphertext envelope so envelopes can be rotated
 * without re-encrypting the world.
 */
public interface CipherPort {

    /** Version of the active key. {@code > 0} for production use. */
    int currentKeyVersion();

    /**
     * Encrypts the plaintext into a versioned AEAD envelope. The
     * returned string is opaque to callers and is the only form that
     * may be persisted or serialized to a downstream service.
     */
    String encrypt(String plaintext, int keyVersion);

    /** Round-trip test helper - decrypts the envelope back to plaintext. */
    String decrypt(String envelope, int keyVersion);
}
