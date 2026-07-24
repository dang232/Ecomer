package com.vnshop.sellerfinanceservice.domain.port.out;

import com.vnshop.sellerfinanceservice.domain.SellerWallet;

import java.util.Optional;

public interface SellerWalletRepositoryPort {
    Optional<SellerWallet> findBySellerId(String sellerId);

    default Optional<SellerWallet> findBySellerIdForUpdate(String sellerId) {
        return findBySellerId(sellerId);
    }

    SellerWallet save(SellerWallet wallet);
}
