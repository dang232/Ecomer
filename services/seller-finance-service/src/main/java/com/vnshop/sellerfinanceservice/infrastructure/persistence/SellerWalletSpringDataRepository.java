package com.vnshop.sellerfinanceservice.infrastructure.persistence;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SellerWalletSpringDataRepository
        extends JpaRepository<SellerWalletJpaEntity, String> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select wallet from SellerWalletJpaEntity wallet where wallet.sellerId = :sellerId")
    Optional<SellerWalletJpaEntity> findBySellerIdForUpdate(@Param("sellerId") String sellerId);
}
