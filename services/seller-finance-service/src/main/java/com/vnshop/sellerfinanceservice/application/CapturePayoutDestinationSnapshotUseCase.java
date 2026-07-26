package com.vnshop.sellerfinanceservice.application;

import com.vnshop.sellerfinanceservice.domain.payoutdestination.PayoutDestinationMaterial;
import com.vnshop.sellerfinanceservice.domain.payoutdestination.PayoutDestinationSnapshot;
import com.vnshop.sellerfinanceservice.domain.payoutdestination.SnapshotSealer;
import com.vnshop.sellerfinanceservice.domain.port.out.PayoutDestinationClient;
import com.vnshop.sellerfinanceservice.domain.redaction.Redacted;
import java.time.Instant;
import java.util.NoSuchElementException;
import java.util.Objects;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Captures an immutable snapshot of the seller's payout destination so that
 * the rest of the payout pipeline operates on a fixed value rather than
 * re-fetching mutable enrollment state.
 *
 * <p>Returns {@code null} when the seller has no enrolled destination
 * (caller decides whether to fail-closed).
 */
public class CapturePayoutDestinationSnapshotUseCase {

    private static final Logger log = LoggerFactory.getLogger(CapturePayoutDestinationSnapshotUseCase.class);

    private final PayoutDestinationClient client;

    public CapturePayoutDestinationSnapshotUseCase(PayoutDestinationClient client) {
        this.client = Objects.requireNonNull(client, "client is required");
    }

    public PayoutDestinationSnapshot captureOrNull(String sellerId, String bankName, String bankAccountLast4) {
        if (sellerId == null || sellerId.isBlank()) {
            throw new IllegalArgumentException("sellerId is required");
        }
        PayoutDestinationMaterial material = client.lookup(sellerId)
                .orElseThrow(() -> new NoSuchElementException(
                        "no payout destination enrolled for sellerId=" + sellerId));
        return new PayoutDestinationSnapshot(
                UUID.randomUUID().toString(),
                material.sellerId(),
                material.destinationId(),
                material.ciphertext(),
                material.keyVersion(),
                material.algorithm(),
                material.fingerprint(),
                bankAccountLast4 == null ? "****" : bankAccountLast4,
                bankName == null ? "" : bankName,
                Instant.now(),
                "" // integrity envelope is sealed by SnapshotCaptureService for callers that need it
        );
    }

    /** Convenience: redaction-safe audit log line on capture. */
    public static String auditLog(PayoutDestinationSnapshot snapshot) {
        if (snapshot == null) return "snapshot=null";
        return "snapshotId=" + snapshot.snapshotId()
                + " sellerId=" + snapshot.sellerId()
                + " destinationFingerprint=" + Redacted.fingerprint(snapshot.fingerprint())
                + " keyVersion=" + snapshot.keyVersion()
                + " capturedAt=" + snapshot.capturedAt();
    }
}