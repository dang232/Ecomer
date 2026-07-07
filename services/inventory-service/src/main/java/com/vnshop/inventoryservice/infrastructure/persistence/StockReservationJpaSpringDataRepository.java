package com.vnshop.inventoryservice.infrastructure.persistence;

import com.vnshop.inventoryservice.domain.StockReservation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public interface StockReservationJpaSpringDataRepository
        extends JpaRepository<StockReservationJpaEntity, UUID> {

    List<StockReservationJpaEntity> findByOrderIdAndStatus(String orderId, StockReservation.Status status);

    @Modifying
    @Query("update StockReservationJpaEntity r set r.status = :status, r.releasedAt = :releasedAt where r.reservationId = :id")
    int updateStatus(@Param("id") UUID id,
                     @Param("status") StockReservation.Status status,
                     @Param("releasedAt") Instant releasedAt);

    /**
     * Batch release of multiple reservations in a single UPDATE.
     * Reduces N database round trips to 1 for order cancellation flows.
     */
    @Modifying
    @Query("update StockReservationJpaEntity r set r.status = :status, r.releasedAt = :releasedAt "
           + "where r.reservationId in :ids")
    int batchUpdateStatus(@Param("ids") List<UUID> ids,
                          @Param("status") StockReservation.Status status,
                          @Param("releasedAt") Instant releasedAt);
}
