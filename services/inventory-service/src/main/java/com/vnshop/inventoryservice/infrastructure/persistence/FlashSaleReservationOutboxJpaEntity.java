package com.vnshop.inventoryservice.infrastructure.persistence;

import com.vnshop.inventoryservice.domain.FlashSaleReservation;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(schema = "inventory_svc", name = "flash_sale_reservation_outbox")
public class FlashSaleReservationOutboxJpaEntity {
    public enum State { PENDING, ACCEPTED, REJECTED, RELEASED }

    @Id
    @Column(name = "reservation_id", columnDefinition = "uuid")
    private UUID reservationId;
    @Column(name = "idempotency_key_hash", nullable = false, unique = true)
    private String idempotencyKeyHash;
    @Column(name = "request_hash", nullable = false)
    private String requestHash;
    @Column(name = "product_id", nullable = false)
    private String productId;
    @Column(name = "buyer_id", nullable = false)
    private String buyerId;
    @Column(name = "quantity", nullable = false)
    private int quantity;
    @Enumerated(EnumType.STRING)
    @Column(name = "state", nullable = false)
    private State state;
    @Column(name = "reserved_at", nullable = false)
    private Instant reservedAt;
    @Column(name = "expires_at", nullable = false)
    private Instant expiresAt;
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected FlashSaleReservationOutboxJpaEntity() {
    }

    public FlashSaleReservationOutboxJpaEntity(UUID reservationId, String idempotencyKeyHash,
            String requestHash, String productId, String buyerId, int quantity, State state,
            Instant reservedAt, Instant expiresAt) {
        this.reservationId = reservationId;
        this.idempotencyKeyHash = idempotencyKeyHash;
        this.requestHash = requestHash;
        this.productId = productId;
        this.buyerId = buyerId;
        this.quantity = quantity;
        this.state = state;
        this.reservedAt = reservedAt;
        this.expiresAt = expiresAt;
        this.updatedAt = reservedAt;
    }

    public UUID getReservationId() { return reservationId; }
    public String getIdempotencyKeyHash() { return idempotencyKeyHash; }
    public String getRequestHash() { return requestHash; }
    public String getProductId() { return productId; }
    public String getBuyerId() { return buyerId; }
    public int getQuantity() { return quantity; }
    public State getState() { return state; }
    public Instant getReservedAt() { return reservedAt; }
    public Instant getExpiresAt() { return expiresAt; }

    public void setState(State state) {
        this.state = state;
        this.updatedAt = Instant.now();
    }

    public FlashSaleReservation toDomain() {
        FlashSaleReservation.Status status = switch (state) {
            case ACCEPTED -> FlashSaleReservation.Status.RESERVED;
            case REJECTED -> FlashSaleReservation.Status.REJECTED;
            case RELEASED, PENDING -> FlashSaleReservation.Status.EXPIRED;
        };
        return new FlashSaleReservation(reservationId, productId, buyerId, quantity, status, reservedAt, expiresAt);
    }
}
