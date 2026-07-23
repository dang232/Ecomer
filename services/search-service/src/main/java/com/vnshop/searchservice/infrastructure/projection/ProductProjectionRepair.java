package com.vnshop.searchservice.infrastructure.projection;

import com.vnshop.searchservice.infrastructure.kafka.ProductEventConsumer.ProductEvent;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import lombok.Getter;

@Entity
@Table(schema = "search_svc", name = "product_projection_repairs")
@Getter
public class ProductProjectionRepair {
    @Id
    @Column(name = "event_id", nullable = false)
    private String eventId;
    @Column(name = "product_id", nullable = false)
    private String productId;
    @Column(name = "event_type", nullable = false)
    private String eventType;
    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    protected ProductProjectionRepair() { }

    private ProductProjectionRepair(String eventId, String productId, String eventType, Instant createdAt) {
        this.eventId = eventId;
        this.productId = productId;
        this.eventType = eventType;
        this.createdAt = createdAt;
    }

    public static ProductProjectionRepair from(ProductEvent event) {
        return new ProductProjectionRepair(
                event.deduplicationId(), event.productId(), event.eventType().name(), Instant.now());
    }

    public String getEventId() { return eventId; }
    public String getProductId() { return productId; }
    public String getEventType() { return eventType; }
}
