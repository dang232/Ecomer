package com.vnshop.sellerfinanceservice.domain.payoutdestination;

import java.time.Instant;
import java.util.Objects;

/**
 * Immutable snapshot of the seller's payout destination, captured at
 * reservation time. Used to make submission-time destination decisions
 * audit-stable even if the seller later changes their enrollment.
 *
 * <p>Carries its own integrity envelope so we can detect tampering or
 * replay. The envelope is produced by an {@link com.vnshop.sellerfinanceservice.domain.payoutdestination.SnapshotSealer}.
 */
public final class PayoutDestinationSnapshot {

    private final String snapshotId;
    private final String sellerId;
    private final String destinationId;
    private final String ciphertext;
    private final int keyVersion;
    private final String algorithm;
    private final String fingerprint;
    private final String bankAccountLast4;
    private final String bankName;
    private final Instant capturedAt;
    private final String integrityEnvelope;

    public PayoutDestinationSnapshot(
            String snapshotId,
            String sellerId,
            String destinationId,
            String ciphertext,
            int keyVersion,
            String algorithm,
            String fingerprint,
            String bankAccountLast4,
            String bankName,
            Instant capturedAt,
            String integrityEnvelope
    ) {
        this.snapshotId = Objects.requireNonNull(snapshotId, "snapshotId is required");
        this.sellerId = Objects.requireNonNull(sellerId, "sellerId is required");
        this.destinationId = Objects.requireNonNull(destinationId, "destinationId is required");
        this.ciphertext = Objects.requireNonNull(ciphertext, "ciphertext is required");
        this.keyVersion = keyVersion;
        this.algorithm = Objects.requireNonNull(algorithm, "algorithm is required");
        this.fingerprint = Objects.requireNonNull(fingerprint, "fingerprint is required");
        this.bankAccountLast4 = Objects.requireNonNull(bankAccountLast4, "bankAccountLast4 is required");
        this.bankName = Objects.requireNonNull(bankName, "bankName is required");
        this.capturedAt = Objects.requireNonNull(capturedAt, "capturedAt is required");
        this.integrityEnvelope = Objects.requireNonNull(integrityEnvelope, "integrityEnvelope is required");
        if (keyVersion <= 0) {
            throw new IllegalArgumentException("keyVersion must be > 0");
        }
    }

    public String snapshotId() { return snapshotId; }
    public String sellerId() { return sellerId; }
    public String destinationId() { return destinationId; }
    public String ciphertext() { return ciphertext; }
    public int keyVersion() { return keyVersion; }
    public String algorithm() { return algorithm; }
    public String fingerprint() { return fingerprint; }
    public String bankAccountLast4() { return bankAccountLast4; }
    public String bankName() { return bankName; }
    public Instant capturedAt() { return capturedAt; }
    public String integrityEnvelope() { return integrityEnvelope; }
}
