package com.vnshop.sellerfinanceservice.domain.port.out;

import com.vnshop.sellerfinanceservice.domain.LedgerJournal;
import java.util.Optional;
import java.util.UUID;

public interface LedgerRepositoryPort {
    Optional<LedgerJournal> findBySourceOperation(String sourceType, UUID sourceId, String operationType);

    LedgerJournal save(LedgerJournal journal);
}
