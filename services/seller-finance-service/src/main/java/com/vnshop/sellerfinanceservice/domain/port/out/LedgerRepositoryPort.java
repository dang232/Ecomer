package com.vnshop.sellerfinanceservice.domain.port.out;

import com.vnshop.sellerfinanceservice.domain.LedgerJournal;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface LedgerRepositoryPort {
    Optional<LedgerJournal> findBySourceOperation(String sourceType, UUID sourceId, String operationType);

    LedgerJournal save(LedgerJournal journal);

    /**
     * Sum the debits and credits per account for the given seller. Used by the
     * payout-eligibility check to detect projection mismatches.
     */
    default List<LedgerJournal> findBySellerId(String sellerId) {
        return List.of();
    }
}