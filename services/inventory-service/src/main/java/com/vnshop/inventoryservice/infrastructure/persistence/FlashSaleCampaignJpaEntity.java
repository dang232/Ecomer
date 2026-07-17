package com.vnshop.inventoryservice.infrastructure.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(schema = "inventory_svc", name = "flash_sale_campaigns")
public class FlashSaleCampaignJpaEntity {

    @Id
    @Column(name = "id", columnDefinition = "uuid")
    private UUID id;

    @Column(name = "product_id", nullable = false)
    private String productId;

    @Column(name = "original_price", nullable = false)
    private BigDecimal originalPrice;

    @Column(name = "sale_price", nullable = false)
    private BigDecimal salePrice;

    @Column(name = "stock_total", nullable = false)
    private int stockTotal;

    @Column(name = "starts_at", nullable = false)
    private Instant startsAt;

    @Column(name = "ends_at", nullable = false)
    private Instant endsAt;

    @Column(name = "active", nullable = false)
    private boolean active;

    @Column(name = "name")
    private String name;

    @Column(name = "shop_name")
    private String shopName;

    @Column(name = "is_shop_official", nullable = false)
    private boolean isShopOfficial;

    @Column(name = "is_shop_preferred", nullable = false)
    private boolean isShopPreferred;

    @Column(name = "raw_discount", nullable = false)
    private int rawDiscount;

    @Column(name = "discount")
    private String discount;

    @Column(name = "image_hash")
    private String imageHash;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected FlashSaleCampaignJpaEntity() {
    }

    public UUID getId() { return id; }
    public String getProductId() { return productId; }
    public BigDecimal getOriginalPrice() { return originalPrice; }
    public BigDecimal getSalePrice() { return salePrice; }
    public int getStockTotal() { return stockTotal; }
    public Instant getStartsAt() { return startsAt; }
    public Instant getEndsAt() { return endsAt; }
    public boolean isActive() { return active; }
    public String getName() { return name; }
    public String getShopName() { return shopName; }
    public boolean isShopOfficial() { return isShopOfficial; }
    public boolean isShopPreferred() { return isShopPreferred; }
    public int getRawDiscount() { return rawDiscount; }
    public String getDiscount() { return discount; }
    public String getImageHash() { return imageHash; }
    public Instant getCreatedAt() { return createdAt; }
}
