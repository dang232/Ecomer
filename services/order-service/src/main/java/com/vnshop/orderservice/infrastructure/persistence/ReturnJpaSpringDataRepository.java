package com.vnshop.orderservice.infrastructure.persistence;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

interface ReturnJpaSpringDataRepository extends JpaRepository<ReturnJpaEntity, UUID> {
 List<ReturnJpaEntity> findByBuyerId(String buyerId);

 @Query("select r from ReturnJpaEntity r where r.subOrderId in (select s.id from SubOrderJpaEntity s where s.sellerId = :sellerId) order by r.requestedAt desc")
 List<ReturnJpaEntity> findBySellerId(@Param("sellerId") String sellerId);

 Optional<ReturnJpaEntity> findBySubOrderId(Long subOrderId);
}
