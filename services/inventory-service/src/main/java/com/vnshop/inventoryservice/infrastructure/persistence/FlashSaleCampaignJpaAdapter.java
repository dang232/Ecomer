package com.vnshop.inventoryservice.infrastructure.persistence;

import com.vnshop.inventoryservice.domain.FlashSaleCampaign;
import com.vnshop.inventoryservice.domain.port.out.FlashSaleCampaignPort;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Component;

/**
 * Read-only JPA adapter for {@link FlashSaleCampaignPort}. Maps the entity
 * to the immutable domain record at the boundary.
 */
@Component
public class FlashSaleCampaignJpaAdapter implements FlashSaleCampaignPort {
    private final FlashSaleCampaignJpaSpringDataRepository repository;

    public FlashSaleCampaignJpaAdapter(FlashSaleCampaignJpaSpringDataRepository repository) {
        this.repository = repository;
    }

    @Override
    public List<FlashSaleCampaign> findActiveAt(Instant now) {
        return repository.findActiveAt(now).stream()
                .map(FlashSaleCampaignJpaAdapter::toDomain)
                .toList();
    }

    private static FlashSaleCampaign toDomain(FlashSaleCampaignJpaEntity entity) {
        return new FlashSaleCampaign(
                entity.getId(),
                entity.getProductId(),
                entity.getOriginalPrice(),
                entity.getSalePrice(),
                entity.getStockTotal(),
                entity.getStartsAt(),
                entity.getEndsAt(),
                entity.isActive(),
                entity.getName(),
                entity.getShopName(),
                entity.isShopOfficial(),
                entity.isShopPreferred(),
                entity.getRawDiscount(),
                entity.getDiscount(),
                entity.getImageHash());
    }
}
