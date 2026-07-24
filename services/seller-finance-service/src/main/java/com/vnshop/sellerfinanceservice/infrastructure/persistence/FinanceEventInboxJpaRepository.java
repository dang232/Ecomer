package com.vnshop.sellerfinanceservice.infrastructure.persistence;

import com.vnshop.sellerfinanceservice.domain.port.out.FinanceEventInboxPort;
import java.util.Optional;
import java.util.UUID;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Repository;

@Repository
public class FinanceEventInboxJpaRepository implements FinanceEventInboxPort {
    private final ObjectProvider<FinanceEventInboxSpringDataRepository> repositoryProvider;

    public FinanceEventInboxJpaRepository(ObjectProvider<FinanceEventInboxSpringDataRepository> repositoryProvider) {
        this.repositoryProvider = repositoryProvider;
    }

    @Override
    public Optional<UUID> findJournalIdByEventId(UUID eventId) {
        return repository().findById(eventId).map(FinanceEventInboxJpaEntity::journalId);
    }

    @Override
    public void record(UUID eventId, UUID journalId) {
        repository().saveAndFlush(new FinanceEventInboxJpaEntity(eventId, journalId));
    }

    private FinanceEventInboxSpringDataRepository repository() {
        return repositoryProvider.getIfAvailable(() -> {
            throw new IllegalStateException("finance inbox persistence is unavailable without JPA");
        });
    }
}
