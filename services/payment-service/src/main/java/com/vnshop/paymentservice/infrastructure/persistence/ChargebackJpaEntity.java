package com.vnshop.paymentservice.infrastructure.persistence;

import com.vnshop.paymentservice.domain.Chargeback;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.UUID;

@Getter
@Setter
@Entity
@Table(schema = "payment_svc", name = "chargebacks")
public class ChargebackJpaEntity extends BaseJpaEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;

    @Column(name = "chargeback_id", nullable = false, columnDefinition = "uuid", unique = true)
    private UUID chargebackId;

    @Column(name = "order_id", nullable = false, length = 64)
    private String orderId;

    @Column(name = "external_chargeback_id", nullable = false, length = 255, unique = true)
    private String externalChargebackId;

    @Enumerated(EnumType.STRING)
    @Column(name = "provider", nullable = false, length = 16)
    private Chargeback.ChargebackProvider provider;

    @Column(name = "reason", nullable = false, length = 512)
    private String reason;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 16)
    private Chargeback.ChargebackStatus status;

    @Column(name = "evidence_json", columnDefinition = "TEXT")
    private String evidenceJson;

    @Column(name = "due_date")
    private LocalDate dueDate;

    @Column(name = "challenged_amount", precision = 19, scale = 2)
    private BigDecimal challengedAmount;

    @Column(name = "currency", nullable = false, length = 3)
    private String currency;

    @Column(name = "provider_payment_id", length = 255)
    private String providerPaymentId;

    protected ChargebackJpaEntity() {
    }

    public static ChargebackJpaEntity fromDomain(Chargeback cb) {
        ChargebackJpaEntity entity = new ChargebackJpaEntity();
        entity.chargebackId = cb.id();
        entity.orderId = cb.orderId();
        entity.externalChargebackId = cb.externalChargebackId();
        entity.provider = cb.provider();
        entity.reason = cb.reason();
        entity.status = cb.status();
        entity.evidenceJson = cb.evidenceJson();
        entity.dueDate = cb.dueDate();
        entity.challengedAmount = cb.challengedAmount();
        entity.currency = cb.currency();
        entity.providerPaymentId = cb.providerPaymentId();
        if (cb.createdAt() != null) {
            entity.setCreatedAt(cb.createdAt());
        }
        return entity;
    }

    public Chargeback toDomain() {
        return new Chargeback(
                chargebackId,
                orderId,
                externalChargebackId,
                provider,
                reason,
                status,
                evidenceJson,
                dueDate, challengedAmount, currency, providerPaymentId,
                getCreatedAt(),
                getUpdatedAt());
    }
}
