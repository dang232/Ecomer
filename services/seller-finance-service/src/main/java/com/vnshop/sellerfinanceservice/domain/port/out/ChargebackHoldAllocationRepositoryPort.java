package com.vnshop.sellerfinanceservice.domain.port.out;

import com.vnshop.sellerfinanceservice.domain.SellerWallet;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Persistent record of the funding source for every chargeback hold so release/finalize
 * never has to guess where the funds originally came from. Persistence is owned by the
 * seller-finance ledger; this port lets the use case record allocations transactionally
 * with the journal and projection writes.
 *
 */
public interface ChargebackHoldAllocationRepositoryPort {
    void record(UUID holdId, String sellerId, BigDecimal amount,
                SellerWallet.WalletBucket sourceBucket, SellerWallet.HoldStatus status);

    Optional<HoldRecord> find(UUID holdId);

    List<HoldRecord> findHeldBySellerId(String sellerId);

    record HoldRecord(UUID holdId, String sellerId, BigDecimal amount,
                      SellerWallet.WalletBucket sourceBucket, SellerWallet.HoldStatus status) {
    }
}
