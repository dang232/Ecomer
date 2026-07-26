package com.vnshop.sellerfinanceservice.domain.payoutdestination;

/**
 * Produces a tamper-detecting envelope over a snapshot's canonical bytes.
 * The envelope lets the audit pipeline verify that an immutable snapshot
 * was not altered between capture and provider submission.
 */
public interface SnapshotSealer {

    /** Returns a versioned envelope (e.g. {@code k<keyVersion>.<b64mac>}). */
    String seal(String canonical);

    /** Verify a previously produced envelope; throws if invalid. */
    void verify(String canonical, String envelope);

    /** Highest key version in the sealer. */
    int currentKeyVersion();
}