package com.vnshop.sellerfinanceservice.infrastructure.persistence;

import com.vnshop.sellerfinanceservice.domain.SellerWallet;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

interface ChargebackHoldAllocationSpringDataRepository
        extends JpaRepository<ChargebackHoldAllocationJpaEntity, UUID> {
    List<ChargebackHoldAllocationJpaEntity> findBySellerIdAndStatus(
            String sellerId, SellerWallet.HoldStatus status);
}
