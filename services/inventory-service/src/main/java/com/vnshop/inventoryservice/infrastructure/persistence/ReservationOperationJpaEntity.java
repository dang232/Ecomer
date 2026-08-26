package com.vnshop.inventoryservice.infrastructure.persistence;

import com.vnshop.inventoryservice.application.ReservationOperation;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(schema = "inventory_svc", name = "reservation_operations")
public class ReservationOperationJpaEntity {
    @Id
    @Column(name = "operation_id", nullable = false)
    private String operationId;
    @Column(name = "request_hash", nullable = false, length = 64)
    private String requestHash;
    @Column(nullable = false)
    private boolean success;
    @Column(name = "reserved_items", nullable = false)
    private int reservedItems;
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ReservationOperation.ReservationStatus status;
    @Enumerated(EnumType.STRING)
    @Column(name = "failure_code", nullable = false)
    private ReservationOperation.ReservationFailureCode failureCode;
    @Column(name = "processed_at", nullable = false)
    private Instant processedAt;

    protected ReservationOperationJpaEntity() {}

    static ReservationOperationJpaEntity fromDomain(ReservationOperation operation) {
        ReservationOperationJpaEntity entity = new ReservationOperationJpaEntity();
        entity.operationId = operation.operationId();
        entity.requestHash = operation.requestHash();
        entity.success = operation.success();
        entity.reservedItems = operation.reservedItems();
        entity.status = operation.status();
        entity.failureCode = operation.failureCode();
        entity.processedAt = operation.processedAt();
        return entity;
    }

    ReservationOperation toDomain() {
        return new ReservationOperation(operationId, requestHash, success, reservedItems,
                status, failureCode, processedAt);
    }
}
