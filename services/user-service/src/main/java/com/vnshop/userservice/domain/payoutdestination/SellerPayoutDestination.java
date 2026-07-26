package com.vnshop.userservice.domain.payoutdestination;

import com.vnshop.userservice.domain.redaction.Redacted;
import java.time.Instant;
import java.util.Objects;

/**
 * Immutable payout-destination record. Replaces the plaintext
 * {@code bankAccount} field on the legacy seller profile with an
 * authenticated ciphertext envelope + the metadata that downstream
 * services are allowed to see.
 *
 * <p>Field accessors all return masked values when the caller has
 * chosen the public view. The raw plaintext is only available through
 * {@link #materialForFinance()}, which is itself only reached via the
 * service-to-service contract.
 */
public final class SellerPayoutDestination {

    /** Persisted algorithm identifier shared with downstream finance consumers. */
    public static final String PERSISTED_ALGORITHM = "AES-256-GCM";

    public enum VerificationState {
        PENDING,
        UNVERIFIED,
        VERIFIED,
        REJECTED,
        LEGACY_MIGRATED
    }

    private final String destinationId;
    private final String sellerId;
    private final String bankName;          // public metadata
    private final String bankAccountLast4;  // public masked metadata
    private final String fingerprint;       // deterministic, hash of plaintext
    private final int keyVersion;
    private final String algorithm;
    private final String ciphertext;        // AEAD envelope (B64)
    private final VerificationState verificationState;
    private final Instant enrolledAt;
    private final Instant updatedAt;

    public SellerPayoutDestination(
            String destinationId,
            String sellerId,
            String bankName,
            String bankAccountLast4,
            String fingerprint,
            int keyVersion,
            String algorithm,
            String ciphertext,
            VerificationState verificationState,
            Instant enrolledAt,
            Instant updatedAt
    ) {
        this.destinationId = Objects.requireNonNull(destinationId, "destinationId");
        this.sellerId = Objects.requireNonNull(sellerId, "sellerId");
        this.bankName = requireNonBlank(bankName, "bankName");
        this.bankAccountLast4 = requireLengthAtMost4(bankAccountLast4, "bankAccountLast4");
        this.fingerprint = requireNonBlank(fingerprint, "fingerprint");
        if (keyVersion <= 0) {
            throw new IllegalArgumentException("keyVersion must be > 0");
        }
        this.keyVersion = keyVersion;
        this.algorithm = requireNonBlank(algorithm, "algorithm");
        this.ciphertext = requireNonBlank(ciphertext, "ciphertext");
        this.verificationState = Objects.requireNonNull(verificationState, "verificationState");
        this.enrolledAt = Objects.requireNonNull(enrolledAt, "enrolledAt");
        this.updatedAt = Objects.requireNonNull(updatedAt, "updatedAt");
    }

    public String destinationId() { return destinationId; }
    public String sellerId() { return sellerId; }
    public String bankName() { return bankName; }
    public String bankAccountLast4() { return bankAccountLast4; }
    public String fingerprint() { return fingerprint; }
    public int keyVersion() { return keyVersion; }
    public String algorithm() { return algorithm; }
    public String ciphertext() { return ciphertext; }
    public VerificationState verificationState() { return verificationState; }
    public Instant enrolledAt() { return enrolledAt; }
    public Instant updatedAt() { return updatedAt; }

    /**
     * Service-to-service material returned to internal callers only.
     * The SellerProfileResponse / PublicSellerResponse / AdminSeller
     * DTOs MUST NOT include this in their serialized form.
     */
    public DestinationMaterial materialForFinance() {
        return new DestinationMaterial(destinationId, sellerId, ciphertext, keyVersion, algorithm, fingerprint);
    }

    @Override
    public String toString() {
        return "SellerPayoutDestination{" +
                "destinationId='" + destinationId + '\'' +
                ", sellerId='" + sellerId + '\'' +
                ", bankName='" + bankName + '\'' +
                ", bankAccountLast4='" + bankAccountLast4 + '\'' +
                ", fingerprint=" + Redacted.fingerprint(fingerprint) +
                ", keyVersion=" + keyVersion +
                ", algorithm='" + algorithm + '\'' +
                ", verificationState=" + verificationState +
                ", enrolledAt=" + enrolledAt +
                ", updatedAt=" + updatedAt +
                '}';
    }

    private static String requireNonBlank(String v, String name) {
        if (v == null || v.isBlank()) {
            throw new IllegalArgumentException(name + " is required");
        }
        return v;
    }

    private static String requireLengthAtMost4(String v, String name) {
        if (v == null || v.isBlank()) {
            throw new IllegalArgumentException(name + " is required");
        }
        if (v.length() > 4) {
            throw new IllegalArgumentException(name + " must be <=4 chars");
        }
        return v;
    }
}
