package com.vnshop.productservice.infrastructure.persistence.purchase;

import java.time.Instant;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface VerifiedPurchaseJpaSpringDataRepository extends JpaRepository<VerifiedPurchaseJpaEntity, UUID> {
    boolean existsByBuyerIdAndProductId(String buyerId, String productId);

    boolean existsByBuyerIdAndProductIdAndOrderId(String buyerId, String productId, String orderId);

    @Modifying
    @Query(value = """
            INSERT INTO product_svc.verified_purchases
                (purchase_id, order_id, buyer_id, product_id, delivered_at, created_at, updated_at)
            VALUES (:purchaseId, :orderId, :buyerId, :productId, :deliveredAt, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (order_id, buyer_id, product_id) DO NOTHING
            """, nativeQuery = true)
    int insertIfAbsent(
            @Param("purchaseId") UUID purchaseId,
            @Param("orderId") String orderId,
            @Param("buyerId") String buyerId,
            @Param("productId") String productId,
            @Param("deliveredAt") Instant deliveredAt);
}
