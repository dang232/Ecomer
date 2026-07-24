package com.vnshop.sellerfinanceservice.infrastructure.persistence;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LedgerJournalSpringDataRepository extends JpaRepository<LedgerJournalJpaEntity, UUID> {
    Optional<LedgerJournalJpaEntity> findBySourceTypeAndSourceIdAndOperationType(
            String sourceType, UUID sourceId, String operationType);
}
