package com.vnshop.sellerfinanceservice.infrastructure.persistence;

import com.vnshop.sellerfinanceservice.domain.LedgerJournal;
import com.vnshop.sellerfinanceservice.domain.port.out.LedgerRepositoryPort;
import java.util.Optional;
import java.util.UUID;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Repository;

@Repository
public class LedgerJpaRepository implements LedgerRepositoryPort {
    private final ObjectProvider<LedgerJournalSpringDataRepository> repositoryProvider;

    public LedgerJpaRepository(ObjectProvider<LedgerJournalSpringDataRepository> repositoryProvider) {
        this.repositoryProvider = repositoryProvider;
    }

    @Override
    public Optional<LedgerJournal> findBySourceOperation(String sourceType, UUID sourceId, String operationType) {
        return repository().findBySourceTypeAndSourceIdAndOperationType(sourceType, sourceId, operationType)
                .map(LedgerJournalJpaEntity::toDomain);
    }

    @Override
    public LedgerJournal save(LedgerJournal journal) {
        return repository().saveAndFlush(LedgerJournalJpaEntity.fromDomain(journal)).toDomain();
    }

    private LedgerJournalSpringDataRepository repository() {
        return repositoryProvider.getIfAvailable(() -> {
            throw new IllegalStateException("ledger persistence is unavailable without JPA");
        });
    }
}
