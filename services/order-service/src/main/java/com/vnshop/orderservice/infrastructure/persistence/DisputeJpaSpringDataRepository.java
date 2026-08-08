package com.vnshop.orderservice.infrastructure.persistence;

import com.vnshop.orderservice.domain.DisputeStatus;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.time.Instant;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DisputeJpaSpringDataRepository extends JpaRepository<DisputeJpaEntity, UUID> {
 List<DisputeJpaEntity> findByStatus(DisputeStatus status);

 @Query("select d from DisputeJpaEntity d where d.status = :status and "
         + "(:term = '' or lower(str(d.disputeId)) like :likeTerm "
         + "or lower(str(d.returnId)) like :likeTerm or lower(d.buyerReason) like :likeTerm "
         + "or lower(d.sellerResponse) like :likeTerm) order by d.createdAt desc")
 List<DisputeJpaEntity> findByStatusAndQuery(@Param("status") DisputeStatus status,
         @Param("term") String term, @Param("likeTerm") String likeTerm);

  Optional<DisputeJpaEntity> findByReturnId(UUID returnId);

  @Query("select d from DisputeJpaEntity d where d.status = :status and "
          + "(:term = '' or lower(str(d.disputeId)) like :likeTerm "
          + "or lower(str(d.returnId)) like :likeTerm or lower(d.buyerReason) like :likeTerm "
          + "or lower(coalesce(d.sellerResponse, '')) like :likeTerm) "
          + "and (:createdAtBefore is null or d.createdAt < :createdAtBefore "
          + "or (d.createdAt = :createdAtBefore and d.disputeId < :disputeIdBefore)) "
          + "order by d.createdAt desc, d.disputeId desc")
  List<DisputeJpaEntity> findCursor(@Param("status") DisputeStatus status,
          @Param("term") String term, @Param("likeTerm") String likeTerm,
          @Param("createdAtBefore") Instant createdAtBefore,
          @Param("disputeIdBefore") UUID disputeIdBefore,
          org.springframework.data.domain.Pageable pageable);
}
