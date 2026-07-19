package com.vnshop.recommendationsservice.infrastructure.persistence;

import com.vnshop.recommendationsservice.application.CoPurchase;
import com.vnshop.recommendationsservice.application.CoPurchasePort;
import com.vnshop.recommendationsservice.application.ProcessedOrderPort;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Repository;

@Repository
public class RecommendationPersistenceAdapter implements CoPurchasePort, ProcessedOrderPort {
    private final CoPurchaseRepository coPurchaseRepository;
    private final ProcessedOrderRepository processedOrderRepository;

    public RecommendationPersistenceAdapter(
            CoPurchaseRepository coPurchaseRepository,
            ProcessedOrderRepository processedOrderRepository
    ) {
        this.coPurchaseRepository = coPurchaseRepository;
        this.processedOrderRepository = processedOrderRepository;
    }

    @Override
    public Optional<CoPurchase> find(String productA, String productB) {
        return coPurchaseRepository
                .findById(new CoPurchaseJpaEntity.CoPurchaseId(productA, productB))
                .map(RecommendationPersistenceAdapter::toApplication);
    }

    @Override
    public CoPurchase save(CoPurchase coPurchase) {
        CoPurchaseJpaEntity entity = new CoPurchaseJpaEntity(
                coPurchase.productA(),
                coPurchase.productB(),
                coPurchase.count(),
                coPurchase.lastSeenAt());
        return toApplication(coPurchaseRepository.save(entity));
    }

    @Override
    public List<CoPurchase> findTopByProductA(String productA, int limit) {
        return coPurchaseRepository.findTopByProductA(productA, PageRequest.of(0, limit)).stream()
                .map(RecommendationPersistenceAdapter::toApplication)
                .toList();
    }

    @Override
    public boolean exists(String orderId) {
        return processedOrderRepository.existsById(orderId);
    }

    @Override
    public void save(String orderId) {
        processedOrderRepository.save(new ProcessedOrderJpaEntity(orderId));
    }

    private static CoPurchase toApplication(CoPurchaseJpaEntity entity) {
        return new CoPurchase(
                entity.productA(),
                entity.productB(),
                entity.getCoCount(),
                entity.getLastSeenAt());
    }
}
