package com.vnshop.userservice.infrastructure.crypto;

import com.vnshop.userservice.domain.payoutdestination.CipherPort;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

/**
 * AES-256-GCM AEAD adapter for payout destination material.
 *
 * <p>Envelope format on the wire:
 * {@code v<keyVersion>.<nonceB64>.<ivB64>.<ciphertextB64>.<tagB64>}
 * (versioned prefix keeps the envelope self-describing for key
 * rotation.)
 *
 * <p>Key material is loaded from configuration: a versioned map
 * {@code vnshop.crypto.payout.keys.<n> = base64Encoded32Bytes}. In
 * non-test execution, a non-zero current key version is required. The
 * first missing/invalid key in the chain makes the {@link CipherPort}
 * fail-closed.
 */
public final class AesGcmDestinationCipher implements CipherPort {

    public static final String ALGORITHM = "AES/GCM/NoPadding";
    public static final int GCM_TAG_BITS = 128;
    public static final int GCM_IV_BYTES = 12;
    public static final int CURRENT_KEY_VERSION_PLACEHOLDER = 0;
    private static final String ENVELOPE_VERSION_PREFIX = "v";
    private static final String ENVELOPE_SEPARATOR = ".";

    private final Map<Integer, SecretKey> keysByVersion = new ConcurrentHashMap<>();
    private final int currentKeyVersion;
    private final SecureRandom rng = new SecureRandom();

    public AesGcmDestinationCipher(Map<Integer, String> base64KeysByVersion, int currentKeyVersion) {
        if (base64KeysByVersion == null || base64KeysByVersion.isEmpty()) {
            throw new IllegalStateException("at least one payout destination encryption key is required");
        }
        if (currentKeyVersion <= 0) {
            throw new IllegalStateException("currentKeyVersion must be > 0 in non-test execution");
        }
        for (Map.Entry<Integer, String> e : base64KeysByVersion.entrySet()) {
            int version = e.getKey();
            if (version <= 0) {
                throw new IllegalStateException("key version " + version + " is invalid");
            }
            byte[] raw = decodeBase64(e.getValue());
            if (raw.length != 32) {
                throw new IllegalStateException("key version " + version + " must decode to 32 bytes (AES-256)");
            }
            keysByVersion.put(version, new SecretKeySpec(raw, "AES"));
        }
        if (!keysByVersion.containsKey(currentKeyVersion)) {
            throw new IllegalStateException(
                    "currentKeyVersion " + currentKeyVersion + " is not present in configured key set");
        }
        this.currentKeyVersion = currentKeyVersion;
    }

    /** Convenience constructor for tests: single key = current. */
    public AesGcmDestinationCipher(byte[] keyBytes) {
        this(Map.of(1, Base64.getEncoder().encodeToString(keyBytes)), 1);
    }

    @Override
    public int currentKeyVersion() {
        return currentKeyVersion;
    }

    @Override
    public String encrypt(String plaintext, int keyVersion) {
        if (plaintext == null) {
            throw new IllegalArgumentException("plaintext is required");
        }
        SecretKey key = keysByVersion.get(keyVersion);
        if (key == null) {
            throw new IllegalArgumentException("unknown key version: " + keyVersion);
        }
        byte[] iv = new byte[GCM_IV_BYTES];
        rng.nextBytes(iv);
        try {
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));
            cipher.updateAAD(aadForVersion(keyVersion));
            byte[] ctWithTag = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            // Split ct and tag. GCM tag is the trailing 16 bytes.
            int tagOffset = ctWithTag.length - (GCM_TAG_BITS / 8);
            byte[] ct = new byte[tagOffset];
            byte[] tag = new byte[GCM_TAG_BITS / 8];
            System.arraycopy(ctWithTag, 0, ct, 0, tagOffset);
            System.arraycopy(ctWithTag, tagOffset, tag, 0, tag.length);
            return ENVELOPE_VERSION_PREFIX + keyVersion
                    + ENVELOPE_SEPARATOR + Base64.getEncoder().encodeToString(iv)
                    + ENVELOPE_SEPARATOR + Base64.getEncoder().encodeToString(ct)
                    + ENVELOPE_SEPARATOR + Base64.getEncoder().encodeToString(tag);
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException("encryption failed", ex);
        }
    }

    @Override
    public String decrypt(String envelope, int keyVersion) {
        if (envelope == null || !envelope.startsWith(ENVELOPE_VERSION_PREFIX)) {
            throw new IllegalArgumentException("envelope is missing version prefix");
        }
        String[] parts = envelope.split("\\.", -1);
        if (parts.length != 4) {
            throw new IllegalArgumentException("envelope is malformed");
        }
        int embeddedVersion;
        try {
            embeddedVersion = Integer.parseInt(parts[0].substring(1));
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException("envelope version is not a number", ex);
        }
        if (embeddedVersion != keyVersion) {
            throw new IllegalArgumentException("envelope version mismatch");
        }
        SecretKey key = keysByVersion.get(keyVersion);
        if (key == null) {
            throw new IllegalArgumentException("unknown key version: " + keyVersion);
        }
        byte[] iv = Base64.getDecoder().decode(parts[1]);
        byte[] ct = Base64.getDecoder().decode(parts[2]);
        byte[] tag = Base64.getDecoder().decode(parts[3]);
        if (iv.length != GCM_IV_BYTES) {
            throw new IllegalArgumentException("envelope IV length is invalid");
        }
        if (tag.length != GCM_TAG_BITS / 8) {
            throw new IllegalArgumentException("envelope tag length is invalid");
        }
        byte[] ctWithTag = ByteBuffer.allocate(ct.length + tag.length).put(ct).put(tag).array();
        try {
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));
            cipher.updateAAD(parts[0].getBytes(StandardCharsets.US_ASCII));
            byte[] plain = cipher.doFinal(ctWithTag);
            return new String(plain, StandardCharsets.UTF_8);
        } catch (GeneralSecurityException ex) {
            // Authentication failed - treat as fatal, never as "decrypt to garbage".
            throw new IllegalStateException("decryption failed: ciphertext did not authenticate", ex);
        }
    }

    private static byte[] decodeBase64(String s) {
        try {
            return Base64.getDecoder().decode(s);
        } catch (IllegalArgumentException ex) {
            throw new IllegalStateException("invalid base64 key material", ex);
        }
    }

    private static byte[] aadForVersion(int keyVersion) {
        return (ENVELOPE_VERSION_PREFIX + keyVersion).getBytes(StandardCharsets.US_ASCII);
    }
}
