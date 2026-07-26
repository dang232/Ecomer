package com.vnshop.sellerfinanceservice.infrastructure.crypto;

import com.vnshop.sellerfinanceservice.domain.payoutdestination.CipherPort;
import java.security.GeneralSecurityException;
import java.util.Map;
import java.util.Objects;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.util.Base64;

/**
 * AES-256-GCM AEAD adapter. Decrypts envelopes produced by user-service.
 * Envelope format is {@code v<keyVersion>.<ivB64>.<ctB64>.<tagB64>}.
 *
 * <p>Fail-closed: missing keys / unsupported version / AEAD tag
 * mismatch throws {@link IllegalStateException}.
 */
public final class AesGcmCipher implements CipherPort {

    private static final String ALGORITHM = "AES/GCM/NoPadding";
    private static final int GCM_TAG_BITS = 128;
    private static final int GCM_IV_BYTES = 12;

    private final Map<Integer, SecretKey> keysByVersion;
    private final int maxKeyVersion;

    public AesGcmCipher(Map<Integer, SecretKey> keysByVersion) {
        this.keysByVersion = Map.copyOf(Objects.requireNonNull(keysByVersion, "keysByVersion is required"));
        if (keysByVersion.isEmpty()) {
            throw new IllegalStateException("AesGcmCipher requires at least one key");
        }
        for (Map.Entry<Integer, SecretKey> e : keysByVersion.entrySet()) {
            if (e.getKey() <= 0 || e.getValue() == null) {
                throw new IllegalArgumentException("key version must be > 0 and key material non-null");
            }
        }
        this.maxKeyVersion = keysByVersion.keySet().stream().mapToInt(Integer::intValue).max().orElseThrow();
    }

    @Override
    public int currentKeyVersion() {
        return maxKeyVersion;
    }

    @Override
    public String decrypt(String envelope) {
        if (envelope == null || envelope.isBlank()) {
            throw new IllegalArgumentException("envelope is required");
        }
        String[] parts = envelope.split("\\.", -1);
        if (parts.length != 4) {
            throw new IllegalArgumentException("envelope malformed");
        }
        if (!parts[0].startsWith("v")) {
            throw new IllegalArgumentException("envelope missing version prefix");
        }
        int version;
        try {
            version = Integer.parseInt(parts[0].substring(1));
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException("envelope version not numeric", ex);
        }
        SecretKey key = keysByVersion.get(version);
        if (key == null) {
            throw new IllegalStateException("no key registered for envelope version " + version);
        }
        byte[] iv = Base64.getDecoder().decode(parts[1]);
        byte[] ct = Base64.getDecoder().decode(parts[2]);
        byte[] tag = Base64.getDecoder().decode(parts[3]);
        if (iv.length != GCM_IV_BYTES) {
            throw new IllegalStateException("IV length mismatch");
        }
        try {
            Cipher cipher = Cipher.getInstance(ALGORITHM);
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_BITS, iv));
            cipher.updateAAD(parts[0].getBytes(java.nio.charset.StandardCharsets.US_ASCII));
            byte[] ctWithTag = new byte[ct.length + tag.length];
            System.arraycopy(ct, 0, ctWithTag, 0, ct.length);
            System.arraycopy(tag, 0, ctWithTag, ct.length, tag.length);
            byte[] pt = cipher.doFinal(ctWithTag);
            return new String(pt, java.nio.charset.StandardCharsets.UTF_8);
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException("decrypt failed: " + ex.getMessage(), ex);
        }
    }

    /** Build a SecretKey from a base64-encoded 32-byte AES-256 key. */
    public static SecretKey decodeBase64Key(String b64) {
        Objects.requireNonNull(b64, "base64 key is required");
        byte[] raw = Base64.getDecoder().decode(b64);
        if (raw.length != 32) {
            throw new IllegalArgumentException("AES-256 key must decode to 32 bytes (got " + raw.length + ")");
        }
        return new SecretKeySpec(raw, "AES");
    }
}