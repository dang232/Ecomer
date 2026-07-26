package com.vnshop.sellerfinanceservice.infrastructure.crypto;

import com.vnshop.sellerfinanceservice.domain.payoutdestination.SnapshotSealer;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;
import java.util.Objects;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

/**
 * HMAC-SHA-256 sealer for finance snapshots. Uses the same key material
 * as the destination cipher so that key rotation policies stay aligned.
 *
 * <p>Envelope: {@code k<keyVersion>.<b64mac>}.
 */
public final class HmacSnapshotSealer implements SnapshotSealer {

    private static final String ALGORITHM = "HmacSHA256";

    private final Map<Integer, byte[]> keysByVersion;
    private final int maxKeyVersion;

    public HmacSnapshotSealer(Map<Integer, byte[]> keysByVersion) {
        this.keysByVersion = Map.copyOf(Objects.requireNonNull(keysByVersion, "keysByVersion is required"));
        if (keysByVersion.isEmpty()) {
            throw new IllegalStateException("HmacSnapshotSealer requires at least one key");
        }
        this.maxKeyVersion = keysByVersion.keySet().stream().mapToInt(Integer::intValue).max().orElseThrow();
    }

    @Override
    public int currentKeyVersion() {
        return maxKeyVersion;
    }

    @Override
    public String seal(String canonical) {
        Objects.requireNonNull(canonical, "canonical is required");
        try {
            Mac mac = Mac.getInstance(ALGORITHM);
            mac.init(new SecretKeySpec(keysByVersion.get(maxKeyVersion), ALGORITHM));
            byte[] tag = mac.doFinal(canonical.getBytes(StandardCharsets.UTF_8));
            return "k" + maxKeyVersion + "." + Base64.getEncoder().encodeToString(tag);
        } catch (Exception ex) {
            throw new IllegalStateException("seal failed: " + ex.getMessage(), ex);
        }
    }

    @Override
    public void verify(String canonical, String envelope) {
        Objects.requireNonNull(canonical, "canonical is required");
        Objects.requireNonNull(envelope, "envelope is required");
        String[] parts = envelope.split("\\.", -1);
        if (parts.length != 2 || !parts[0].startsWith("k")) {
            throw new IllegalArgumentException("envelope malformed");
        }
        int version;
        try {
            version = Integer.parseInt(parts[0].substring(1));
        } catch (NumberFormatException ex) {
            throw new IllegalArgumentException("envelope version not numeric", ex);
        }
        byte[] key = keysByVersion.get(version);
        if (key == null) {
            throw new IllegalStateException("no sealer key registered for version " + version);
        }
        try {
            Mac mac = Mac.getInstance(ALGORITHM);
            mac.init(new SecretKeySpec(key, ALGORITHM));
            byte[] expected = mac.doFinal(canonical.getBytes(StandardCharsets.UTF_8));
            byte[] actual = Base64.getDecoder().decode(parts[1]);
            if (!java.security.MessageDigest.isEqual(expected, actual)) {
                throw new IllegalStateException("snapshot envelope does not match canonical bytes");
            }
        } catch (Exception ex) {
            throw new IllegalStateException("verify failed: " + ex.getMessage(), ex);
        }
    }
}