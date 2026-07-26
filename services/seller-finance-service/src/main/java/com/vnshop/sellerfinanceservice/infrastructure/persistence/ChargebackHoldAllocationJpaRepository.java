package com.vnshop.sellerfinanceservice.infrastructure.persistence;

import com.vnshop.sellerfinanceservice.domain.SellerWallet;
import com.vnshop.sellerfinanceservice.domain.port.out.ChargebackHoldAllocationRepositoryPort;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;

@Repository
@ConditionalOnProperty(name = "seller-finance.hold-allocation.persistence-mode", havingValue = "jdbc", matchIfMissing = true)
public class ChargebackHoldAllocationJpaRepository implements ChargebackHoldAllocationRepositoryPort {
    private final ChargebackHoldAllocationSpringDataRepository repository;

    public ChargebackHoldAllocationJpaRepository(ChargebackHoldAllocationSpringDataRepository repository) {
        this.repository = repository;
    }

    @Override
    @Transactional
    public void record(UUID holdId, String sellerId, BigDecimal amount,
                       SellerWallet.WalletBucket sourceBucket, SellerWallet.HoldStatus status) {
        ChargebackHoldAllocationJpaEntity entity = repository.findById(holdId).orElse(null);
        if (entity == null) {
            repository.save(new ChargebackHoldAllocationJpaEntity(holdId, sellerId, amount, sourceBucket, status));
            return;
        }
        if (!entity.hasSameAllocation(sellerId, amount, sourceBucket)) {
            throw new IllegalStateException("chargeback hold allocation cannot be changed");
        }
        entity.updateStatus(status);
        repository.save(entity);
    }

    @Override
    @Transactional(readOnly = true)
    public Optional<HoldRecord> find(UUID holdId) {
        return repository.findById(holdId).map(ChargebackHoldAllocationJpaEntity::toRecord);
    }

    @Override
    @Transactional(readOnly = true)
    public List<HoldRecord> findHeldBySellerId(String sellerId) {
        return repository.findBySellerIdAndStatus(sellerId, SellerWallet.HoldStatus.HELD).stream()
                .map(ChargebackHoldAllocationJpaEntity::toRecord)
                .toList();
    }
}
