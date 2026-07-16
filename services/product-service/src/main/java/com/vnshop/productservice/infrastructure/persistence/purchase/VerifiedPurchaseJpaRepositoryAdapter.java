package com.vnshop.productservice.infrastructure.persistence.purchase;

import com.vnshop.productservice.domain.review.port.out.PurchaseVerificationPort;
import java.time.Instant;
import java.util.Objects;
import java.util.UUID;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

@Repository
public class VerifiedPurchaseJpaRepositoryAdapter implements PurchaseVerificationPort {
    private final VerifiedPurchaseJpaSpringDataRepository repository;

    public VerifiedPurchaseJpaRepositoryAdapter(VerifiedPurchaseJpaSpringDataRepository repository) {
        this.repository = Objects.requireNonNull(repository, "repository is required");
    }

    @Override
    @Transactional(readOnly = true)
    public boolean hasDeliveredPurchase(String buyerId, String productId, String orderId) {
        if (orderId == null || orderId.isBlank()) {
            return repository.existsByBuyerIdAndProductId(buyerId, productId);
        }
        return repository.existsByBuyerIdAndProductIdAndOrderId(buyerId, productId, orderId);
    }

    @Override
    @Transactional
    public void recordDeliveredPurchase(String orderId, String buyerId, String productId, Instant deliveredAt) {
        repository.insertIfAbsent(UUID.randomUUID(), orderId, buyerId, productId, deliveredAt);
    }
}
