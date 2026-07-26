package com.vnshop.sellerfinanceservice.domain;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import com.vnshop.sellerfinanceservice.domain.payoutdestination.PayoutDestinationSnapshot;

public class Payout {
    private final UUID payoutId;
    private final String sellerId;
    private final BigDecimal amount;
    private String currency;
    private PayoutStatus status;
    private final Instant createdAt;
    private String idempotencyKey;
    private PayoutDestinationSnapshot destinationSnapshot;
    private String approvedBy;
    private Instant approvedAt;
    private String submittedBy;
    private Instant submittedAt;
    private String paidBy;
    private Instant paidAt;
    private String externalReference;
    private String providerAttemptId;
    private String evidenceReference;
    private String failureReason;
    private String rejectionReason;
    private String completedBy;
    private Instant completedAt;

    public Payout(UUID payoutId, String sellerId, BigDecimal amount, PayoutStatus status, Instant createdAt) {
        Objects.requireNonNull(payoutId, "payoutId is required");
        requireNonBlank(sellerId, "sellerId");
        Objects.requireNonNull(amount, "amount is required");
        if (amount.compareTo(BigDecimal.ZERO) <= 0) throw new IllegalArgumentException("amount must be greater than zero");
        this.payoutId = payoutId;
        this.sellerId = sellerId;
        this.amount = amount;
        this.currency = "VND";
        this.status = Objects.requireNonNull(status, "status is required");
        this.createdAt = Objects.requireNonNull(createdAt, "createdAt is required");
        this.idempotencyKey = null;
        this.destinationSnapshot = null;
    }

    public Payout(UUID payoutId, String sellerId, BigDecimal amount, PayoutStatus status, Instant createdAt,
                  String completedBy, Instant completedAt) {
        this(payoutId, sellerId, amount, status, createdAt);
        this.completedBy = completedBy;
        this.completedAt = completedAt;
    }

    public Payout(UUID payoutId, String sellerId, BigDecimal amount, String currency, PayoutStatus status,
                  Instant createdAt, String idempotencyKey, PayoutDestinationSnapshot destinationSnapshot,
                  String approvedBy, Instant approvedAt, String submittedBy, Instant submittedAt,
                  String paidBy, Instant paidAt, String externalReference, String providerAttemptId,
                  String evidenceReference, String failureReason, String rejectionReason,
                  String completedBy, Instant completedAt, String ignoredOne, String ignoredTwo) {
        Objects.requireNonNull(payoutId, "payoutId is required");
        requireNonBlank(sellerId, "sellerId");
        Objects.requireNonNull(amount, "amount is required");
        if (amount.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("amount must be greater than zero");
        }
        this.payoutId = payoutId;
        this.sellerId = sellerId;
        this.amount = amount;
        requireNonBlank(currency, "currency");
        this.currency = currency;
        this.status = Objects.requireNonNull(status, "status is required");
        this.createdAt = Objects.requireNonNull(createdAt, "createdAt is required");
        this.idempotencyKey = idempotencyKey;
        this.destinationSnapshot = destinationSnapshot;
        this.approvedBy = approvedBy;
        this.approvedAt = approvedAt;
        this.submittedBy = submittedBy;
        this.submittedAt = submittedAt;
        this.paidBy = paidBy;
        this.paidAt = paidAt;
        this.externalReference = externalReference;
        this.providerAttemptId = providerAttemptId;
        this.evidenceReference = evidenceReference;
        this.failureReason = failureReason;
        this.rejectionReason = rejectionReason;
        this.completedBy = completedBy;
        this.completedAt = completedAt;
    }

    public static Payout pending(String sellerId, BigDecimal amount, Instant createdAt) {
        return new Payout(UUID.randomUUID(), sellerId, amount, PayoutStatus.PENDING, createdAt);
    }

    public static Payout requested(String sellerId, BigDecimal amount, String currency, String idempotencyKey,
                                   PayoutDestinationSnapshot destinationSnapshot, Instant createdAt) {
        requireNonBlank(idempotencyKey, "idempotencyKey");
        Payout payout = new Payout(UUID.randomUUID(), sellerId, amount, PayoutStatus.REQUESTED, createdAt);
        requireNonBlank(currency, "currency");
        payout.idempotencyKey = idempotencyKey;
        payout.destinationSnapshot = destinationSnapshot;
        payout.currency = currency.toUpperCase();
        return payout;
    }

    public UUID payoutId() {
        return payoutId;
    }

    public String sellerId() {
        return sellerId;
    }

    public BigDecimal amount() {
        return amount;
    }

    public String currency() { return currency; }

    public String idempotencyKey() { return idempotencyKey; }

    public PayoutDestinationSnapshot destinationSnapshot() { return destinationSnapshot; }

    public PayoutStatus status() {
        return status;
    }

    public Instant createdAt() {
        return createdAt;
    }

    public String completedBy() {
        return completedBy == null ? paidBy : completedBy;
    }

    public Instant completedAt() {
        return completedAt == null ? paidAt : completedAt;
    }

    public String approvedBy() { return approvedBy; }
    public Instant approvedAt() { return approvedAt; }
    public String submittedBy() { return submittedBy; }
    public Instant submittedAt() { return submittedAt; }
    public String paidBy() { return paidBy; }
    public Instant paidAt() { return paidAt; }
    public String externalReference() { return externalReference; }
    public String providerAttemptId() { return providerAttemptId; }
    public String evidenceReference() { return evidenceReference; }
    public String failureReason() { return failureReason; }
    public String rejectionReason() { return rejectionReason; }

    public void approve(String actor, String reason, Instant now) {
        requireActor(actor);
        requireNonBlank(reason, "approval reason");
        if (status == PayoutStatus.APPROVED) return;
        requireStatus(PayoutStatus.REQUESTED, PayoutStatus.PENDING);
        if (sellerId.equals(actor)) throw new IllegalStateException("approval actor must be different from seller");
        status = PayoutStatus.APPROVED;
        approvedBy = actor;
        approvedAt = Objects.requireNonNull(now, "approvedAt is required");
    }

    public void beginSubmission(String actor, Instant now) {
        requireActor(actor);
        if (status == PayoutStatus.SUBMITTING) return;
        requireStatus(PayoutStatus.APPROVED);
        status = PayoutStatus.SUBMITTING;
        submittedBy = actor;
        submittedAt = Objects.requireNonNull(now, "submittedAt is required");
    }

    public void markSubmitted(String actor, String providerReference, String attemptId, Instant now) {
        requireActor(actor);
        requireNonBlank(providerReference, "providerReference");
        requireNonBlank(attemptId, "attemptId");
        if (status == PayoutStatus.SUBMITTED && Objects.equals(providerAttemptId, attemptId)) return;
        requireStatus(PayoutStatus.SUBMITTING);
        status = PayoutStatus.SUBMITTED;
        submittedBy = actor;
        submittedAt = Objects.requireNonNull(now, "submittedAt is required");
        externalReference = providerReference;
        providerAttemptId = attemptId;
    }

    public void markUnknown(String actor, String reason, Instant now) {
        requireActor(actor);
        requireNonBlank(reason, "unknown reason");
        if (status == PayoutStatus.UNKNOWN) return;
        requireStatus(PayoutStatus.SUBMITTING, PayoutStatus.SUBMITTED);
        status = PayoutStatus.UNKNOWN;
        failureReason = reason;
        submittedBy = actor;
        submittedAt = Objects.requireNonNull(now, "submittedAt is required");
    }

    public void markPaid(String actor, String providerReference, String evidence, boolean evidenceVerified, Instant now) {
        requireActor(actor);
        requireNonBlank(providerReference, "providerReference");
        requireNonBlank(evidence, "evidence");
        if (!evidenceVerified) throw new IllegalArgumentException("payment evidence must be verified");
        if (approvedBy != null && approvedBy.equals(actor)) {
            throw new IllegalStateException("payment actor must be different from approver");
        }
        if (status == PayoutStatus.PAID) return;
        requireStatus(PayoutStatus.SUBMITTED, PayoutStatus.UNKNOWN, PayoutStatus.SUBMITTING);
        status = PayoutStatus.PAID;
        paidBy = actor;
        paidAt = Objects.requireNonNull(now, "paidAt is required");
        externalReference = providerReference;
        evidenceReference = evidence;
    }

    public void reject(String actor, String reason, Instant now) {
        requireActor(actor);
        requireNonBlank(reason, "rejection reason");
        if (status == PayoutStatus.REJECTED) return;
        requireStatus(PayoutStatus.REQUESTED, PayoutStatus.PENDING, PayoutStatus.APPROVED);
        status = PayoutStatus.REJECTED;
        rejectionReason = reason;
        completedBy = actor;
        completedAt = Objects.requireNonNull(now, "rejectedAt is required");
    }

    public void complete(String completedBy, Instant completedAt) {
        requireNonBlank(completedBy, "completedBy");
        Objects.requireNonNull(completedAt, "completedAt is required");
        this.status = PayoutStatus.COMPLETED;
        this.completedBy = completedBy;
        this.completedAt = completedAt;
        this.paidBy = completedBy;
        this.paidAt = completedAt;
    }

    public void complete(String completedBy, Instant completedAt, String reason, String evidence) {
        requireNonBlank(reason, "completion reason");
        requireNonBlank(evidence, "payment evidence");
        complete(completedBy, completedAt);
        this.evidenceReference = evidence;
    }

    public void fail() {
        status = PayoutStatus.FAILED;
    }

    public void fail(String actor, String reason, String evidence, Instant failedAt) {
        requireNonBlank(actor, "actor");
        requireNonBlank(reason, "failure reason");
        requireNonBlank(evidence, "failure evidence");
        if (status == PayoutStatus.FAILED) return;
        if (status != PayoutStatus.PENDING) throw new IllegalStateException("payout is not pending");
        status = PayoutStatus.FAILED;
        failureReason = reason;
        evidenceReference = evidence;
        completedBy = actor;
        completedAt = Objects.requireNonNull(failedAt, "failedAt is required");
    }

    public void fail(String actor, String reason, Instant now) {
        requireActor(actor);
        requireNonBlank(reason, "failure reason");
        if (status == PayoutStatus.FAILED) return;
        if (status != PayoutStatus.UNKNOWN && status != PayoutStatus.SUBMITTED && status != PayoutStatus.SUBMITTING) {
            throw new IllegalStateException("payout cannot fail from " + status);
        }
        status = PayoutStatus.FAILED;
        failureReason = reason;
        completedBy = actor;
        completedAt = Objects.requireNonNull(now, "failedAt is required");
    }

    private void requireStatus(PayoutStatus... allowed) {
        for (PayoutStatus candidate : allowed) if (status == candidate) return;
        throw new IllegalStateException("payout cannot transition from " + status);
    }

    private void requireActor(String actor) { requireNonBlank(actor, "actor"); }

    private static void requireNonBlank(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(fieldName + " is required");
        }
    }
}
