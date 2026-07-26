package com.vnshop.sellerfinanceservice.infrastructure.persistence;

import com.vnshop.sellerfinanceservice.domain.SellerWallet;
import com.vnshop.sellerfinanceservice.domain.port.out.ChargebackHoldAllocationRepositoryPort;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

/**
 * Adapter that exposes the in-memory implementation via the port. Used as the
 * default while Task 8/12 owns the persistent allocation table migration —
 * the empty-table adapter is the canonical implementation until then.
 *
 * Lives in the infrastructure layer because the only meaningful "default" is
 * the in-memory persistence policy, which is itself an infrastructure concern.
 */
public class InMemoryChargebackHoldAllocationHolder implements ChargebackHoldAllocationRepositoryPort {
    private final Map<UUID, HoldRecord> records = new LinkedHashMap<>();

    @Override
    public synchronized void record(UUID holdId, String sellerId, BigDecimal amount,
                                    SellerWallet.WalletBucket sourceBucket, SellerWallet.HoldStatus status) {
        Objects.requireNonNull(holdId, "holdId is required");
        records.put(holdId, new HoldRecord(holdId, sellerId, amount, sourceBucket, status));
    }

    @Override
    public synchronized Optional<HoldRecord> find(UUID holdId) {
        return Optional.ofNullable(records.get(holdId));
    }

    @Override
    public synchronized List<HoldRecord> findHeldBySellerId(String sellerId) {
        return records.values().stream()
                .filter(record -> record.sellerId().equals(sellerId)
                        && record.status() == SellerWallet.HoldStatus.HELD)
                .toList();
    }
}
