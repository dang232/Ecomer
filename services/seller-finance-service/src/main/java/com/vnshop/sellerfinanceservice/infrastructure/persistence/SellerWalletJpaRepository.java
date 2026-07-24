package com.vnshop.sellerfinanceservice.infrastructure.persistence;

import com.vnshop.sellerfinanceservice.domain.SellerWallet;
import com.vnshop.sellerfinanceservice.domain.port.out.SellerWalletRepositoryPort;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public class SellerWalletJpaRepository implements SellerWalletRepositoryPort {
    private final SellerWalletSpringDataRepository repository;

    public SellerWalletJpaRepository(SellerWalletSpringDataRepository repository) {
        this.repository = repository;
    }

    @Override
    public Optional<SellerWallet> findBySellerId(String sellerId) {
        return repository.findById(sellerId).map(SellerWalletJpaEntity::toDomain);
    }

    @Override
    public Optional<SellerWallet> findBySellerIdForUpdate(String sellerId) {
        return repository.findBySellerIdForUpdate(sellerId).map(SellerWalletJpaEntity::toDomain);
    }

    @Override
    public SellerWallet save(SellerWallet wallet) {
        SellerWalletJpaEntity entity = repository.findById(wallet.sellerId()).orElse(null);
        if (entity == null) {
            entity = SellerWalletJpaEntity.fromDomain(wallet);
        } else {
            entity.applyDomain(wallet);
        }
        return repository.save(entity).toDomain();
    }
}
