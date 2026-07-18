package com.vnshop.inventoryservice.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FlashSaleReservationOutboxJpaRepository
        extends JpaRepository<FlashSaleReservationOutboxJpaEntity, UUID> {
    Optional<FlashSaleReservationOutboxJpaEntity> findByIdempotencyKeyHash(String idempotencyKeyHash);
    List<FlashSaleReservationOutboxJpaEntity> findByState(FlashSaleReservationOutboxJpaEntity.State state);
}
