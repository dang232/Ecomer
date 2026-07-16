package com.vnshop.productservice.infrastructure.persistence.purchase;

import com.vnshop.productservice.infrastructure.persistence.BaseJpaEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(schema = "product_svc", name = "verified_purchases")
public class VerifiedPurchaseJpaEntity extends BaseJpaEntity {
    @Id
    @Column(name = "purchase_id", columnDefinition = "uuid")
    private UUID purchaseId;

    @Column(name = "order_id", nullable = false, length = 255)
    private String orderId;

    @Column(name = "buyer_id", nullable = false, length = 255)
    private String buyerId;

    @Column(name = "product_id", nullable = false, length = 255)
    private String productId;

    @Column(name = "delivered_at", nullable = false)
    private Instant deliveredAt;

    protected VerifiedPurchaseJpaEntity() {
    }
}
