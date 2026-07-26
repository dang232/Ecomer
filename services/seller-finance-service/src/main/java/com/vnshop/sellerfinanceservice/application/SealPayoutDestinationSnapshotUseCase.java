package com.vnshop.sellerfinanceservice.application;

import com.vnshop.sellerfinanceservice.domain.payoutdestination.PayoutDestinationSnapshot;
import com.vnshop.sellerfinanceservice.domain.payoutdestination.SnapshotSealer;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Objects;

/**
 * Produces a tamper-detecting envelope for a previously captured snapshot.
 * Verifies it on read.
 */
public final class SealPayoutDestinationSnapshotUseCase {

    private final SnapshotSealer sealer;

    public SealPayoutDestinationSnapshotUseCase(SnapshotSealer sealer) {
        this.sealer = Objects.requireNonNull(sealer, "sealer is required");
    }

    public PayoutDestinationSnapshot seal(PayoutDestinationSnapshot snapshot) {
        if (snapshot == null) throw new IllegalArgumentException("snapshot is required");
        String canonical = canonical(snapshot);
        String envelope = sealer.seal(canonical);
        return new PayoutDestinationSnapshot(
                snapshot.snapshotId(),
                snapshot.sellerId(),
                snapshot.destinationId(),
                snapshot.ciphertext(),
                snapshot.keyVersion(),
                snapshot.algorithm(),
                snapshot.fingerprint(),
                snapshot.bankAccountLast4(),
                snapshot.bankName(),
                snapshot.capturedAt(),
                envelope
        );
    }

    public void verify(PayoutDestinationSnapshot snapshot) {
        if (snapshot == null) throw new IllegalArgumentException("snapshot is required");
        sealer.verify(canonical(snapshot), snapshot.integrityEnvelope());
    }

    private static String canonical(PayoutDestinationSnapshot snapshot) {
        return String.join("|",
                snapshot.snapshotId(),
                snapshot.sellerId(),
                snapshot.destinationId(),
                snapshot.ciphertext(),
                Integer.toString(snapshot.keyVersion()),
                snapshot.algorithm(),
                snapshot.fingerprint(),
                snapshot.bankAccountLast4(),
                snapshot.bankName(),
                snapshot.capturedAt().toString()
        );
    }

    public static String fingerprintHex(byte[] bytes) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(md.digest(bytes));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 unavailable", ex);
        }
    }
}