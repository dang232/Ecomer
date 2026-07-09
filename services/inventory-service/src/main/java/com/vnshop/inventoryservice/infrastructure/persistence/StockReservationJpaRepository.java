package com.vnshop.inventoryservice.infrastructure.persistence;

import com.vnshop.inventoryservice.domain.StockReservation;
import com.vnshop.inventoryservice.domain.port.out.StockReservationPort;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Repository;

/**
 * JPA-backed implementation of {@link StockReservationPort}. Decrement is
 * issued as a single conditional UPDATE so concurrent Reserve calls cannot
 * oversell — the database itself enforces the invariant via the
 * `available_quantity >= :qty` predicate.
 */
@Repository
public class StockReservationJpaRepository implements StockReservationPort {
    private final StockReservationJpaSpringDataRepository reservationRepository;
    private final StockLevelJpaSpringDataRepository stockLevelRepository;

    public StockReservationJpaRepository(StockReservationJpaSpringDataRepository reservationRepository,
                                          StockLevelJpaSpringDataRepository stockLevelRepository) {
        this.reservationRepository = reservationRepository;
        this.stockLevelRepository = stockLevelRepository;
    }

    @Override
    public DecrementOutcome tryDecrement(String productId, int quantity) {
        int updated = stockLevelRepository.conditionallyDecrement(productId, quantity);
        if (updated > 0) {
            return DecrementOutcome.APPLIED;
        }
        // 0 rows affected: either the row doesn't exist, or it does but had
        // insufficient stock. Distinguish with a follow-up read.
        return stockLevelRepository.findById(productId).isPresent()
                ? DecrementOutcome.INSUFFICIENT
                : DecrementOutcome.NOT_PROJECTED;
    }

    @Override
    public void increment(String productId, int quantity) {
        stockLevelRepository.upsertIncrement(productId, quantity);
    }

    @Override
    public void saveReservation(StockReservation reservation) {
        reservationRepository.save(StockReservationJpaEntity.fromDomain(reservation));
    }

    @Override
    public List<StockReservation> findActiveReservationsByOrderId(String orderId) {
        return reservationRepository
                .findByOrderIdAndStatus(orderId, StockReservation.Status.RESERVED)
                .stream()
                .map(StockReservationJpaEntity::toDomain)
                .toList();
    }

    @Override
    public void incrementBatch(Map<String, Integer> productQuantities) {
        productQuantities.forEach((productId, qty) ->
                stockLevelRepository.upsertIncrement(productId, qty));
    }

    @Override
    public void markReleased(StockReservation reservation) {
        reservationRepository.updateStatus(
                reservation.reservationId(),
                StockReservation.Status.RELEASED,
                reservation.releasedAt() != null ? reservation.releasedAt() : Instant.now());
    }

    @Override
    public void batchMarkReleased(List<UUID> reservationIds, Instant releasedAt) {
        reservationRepository.batchUpdateStatus(
                reservationIds,
                StockReservation.Status.RELEASED,
                releasedAt);
    }
}
