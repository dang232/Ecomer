package com.vnshop.sellerfinanceservice.infrastructure.persistence;

import com.vnshop.sellerfinanceservice.infrastructure.persistence.BaseJpaEntity;
import com.vnshop.sellerfinanceservice.domain.Payout;
import com.vnshop.sellerfinanceservice.domain.PayoutStatus;
import com.vnshop.sellerfinanceservice.domain.payoutdestination.PayoutDestinationSnapshot;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(schema = "seller_finance_svc", name = "payouts")
@Getter
@Setter
public class PayoutJpaEntity extends BaseJpaEntity {
    @Id
    @Column(name = "payout_id", nullable = false, columnDefinition = "uuid")
    private UUID payoutId;

    @Column(name = "seller_id", nullable = false)
    private String sellerId;

    @Column(name = "amount", nullable = false, precision = 19, scale = 2)
    private BigDecimal amount;

    @Column(name = "currency", nullable = false, length = 3)
    private String currency;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private PayoutStatus status;

    @Column(name = "completed_by")
    private String completedBy;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "idempotency_key")
    private String idempotencyKey;
    @Column(name = "destination_snapshot_id")
    private String destinationSnapshotId;
    @Column(name = "destination_id")
    private String destinationId;
    @Column(name = "destination_ciphertext", columnDefinition = "text")
    private String destinationCiphertext;
    @Column(name = "destination_key_version")
    private Integer destinationKeyVersion;
    @Column(name = "destination_algorithm")
    private String destinationAlgorithm;
    @Column(name = "destination_fingerprint")
    private String destinationFingerprint;
    @Column(name = "destination_bank_account_last4")
    private String destinationBankAccountLast4;
    @Column(name = "destination_bank_name")
    private String destinationBankName;
    @Column(name = "destination_captured_at")
    private Instant destinationCapturedAt;
    @Column(name = "destination_integrity_envelope", columnDefinition = "text")
    private String destinationIntegrityEnvelope;
    @Column(name = "approved_by")
    private String approvedBy;
    @Column(name = "approved_at")
    private Instant approvedAt;
    @Column(name = "submitted_by")
    private String submittedBy;
    @Column(name = "submitted_at")
    private Instant submittedAt;
    @Column(name = "paid_by")
    private String paidBy;
    @Column(name = "paid_at")
    private Instant paidAt;
    @Column(name = "external_reference")
    private String externalReference;
    @Column(name = "provider_attempt_id")
    private String providerAttemptId;
    @Column(name = "evidence_reference")
    private String evidenceReference;
    @Column(name = "failure_reason")
    private String failureReason;
    @Column(name = "rejection_reason")
    private String rejectionReason;

    protected PayoutJpaEntity() {
    }

    static PayoutJpaEntity fromDomain(Payout payout) {
        PayoutJpaEntity entity = new PayoutJpaEntity();
        entity.payoutId = payout.payoutId();
        entity.sellerId = payout.sellerId();
        entity.amount = payout.amount();
        entity.currency = payout.currency();
        entity.status = payout.status();
        entity.completedBy = payout.completedBy();
        entity.completedAt = payout.completedAt();
        entity.setCreatedAt(payout.createdAt());
        entity.idempotencyKey = payout.idempotencyKey();
        PayoutDestinationSnapshot snapshot = payout.destinationSnapshot();
        if (snapshot != null) {
            entity.destinationSnapshotId = snapshot.snapshotId();
            entity.destinationId = snapshot.destinationId();
            entity.destinationCiphertext = snapshot.ciphertext();
            entity.destinationKeyVersion = snapshot.keyVersion();
            entity.destinationAlgorithm = snapshot.algorithm();
            entity.destinationFingerprint = snapshot.fingerprint();
            entity.destinationBankAccountLast4 = snapshot.bankAccountLast4();
            entity.destinationBankName = snapshot.bankName();
            entity.destinationCapturedAt = snapshot.capturedAt();
            entity.destinationIntegrityEnvelope = snapshot.integrityEnvelope();
        }
        entity.approvedBy = payout.approvedBy();
        entity.approvedAt = payout.approvedAt();
        entity.submittedBy = payout.submittedBy();
        entity.submittedAt = payout.submittedAt();
        entity.paidBy = payout.paidBy();
        entity.paidAt = payout.paidAt();
        entity.externalReference = payout.externalReference();
        entity.providerAttemptId = payout.providerAttemptId();
        entity.evidenceReference = payout.evidenceReference();
        entity.failureReason = payout.failureReason();
        entity.rejectionReason = payout.rejectionReason();
        return entity;
    }

    Payout toDomain() {
        PayoutDestinationSnapshot snapshot = destinationSnapshotId == null ? null : new PayoutDestinationSnapshot(
                destinationSnapshotId, sellerId, destinationId, destinationCiphertext, destinationKeyVersion,
                destinationAlgorithm, destinationFingerprint, destinationBankAccountLast4, destinationBankName,
                destinationCapturedAt, destinationIntegrityEnvelope);
        return new Payout(payoutId, sellerId, amount, currency == null ? "VND" : currency, status, getCreatedAt(),
                idempotencyKey, snapshot, approvedBy, approvedAt, submittedBy, submittedAt, paidBy, paidAt,
                externalReference, providerAttemptId, evidenceReference, failureReason, rejectionReason,
                completedBy, completedAt, null, null);
    }
}
