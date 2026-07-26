package com.vnshop.sellerfinanceservice.infrastructure.web;

/** Manual payout evidence. Only references and hashes are accepted, never bank details. */
public record PayoutActionRequest(String reason, Evidence evidence) {
    public record Evidence(String externalReference, String evidenceHash, Boolean maskedDestinationConfirmed) {
    }

    public String evidenceReference() {
        if (evidence == null) return null;
        if (evidence.evidenceHash() != null && !evidence.evidenceHash().isBlank()) return evidence.evidenceHash();
        return evidence.externalReference();
    }

    public void requireManualPaymentEvidence() {
        if (reason == null || reason.isBlank()) {
            throw new IllegalArgumentException("payment reason is required");
        }
        if (evidence == null
                || evidence.externalReference() == null || evidence.externalReference().isBlank()
                || evidence.evidenceHash() == null || evidence.evidenceHash().isBlank()
                || !Boolean.TRUE.equals(evidence.maskedDestinationConfirmed())) {
            throw new IllegalArgumentException(
                    "manual payment requires external reference, evidence hash, and masked destination confirmation");
        }
    }

    public void requireFailureEvidence() {
        if (reason == null || reason.isBlank()) {
            throw new IllegalArgumentException("failure reason is required");
        }
        if (evidence == null || evidenceReference() == null || evidenceReference().isBlank()) {
            throw new IllegalArgumentException("payout failure requires evidence reference");
        }
    }
}
