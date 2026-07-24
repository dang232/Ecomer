package com.vnshop.sellerfinanceservice.domain.port.out;

import java.util.Optional;
import java.util.UUID;

public interface FinanceEventInboxPort {
    Optional<UUID> findJournalIdByEventId(UUID eventId);

    void record(UUID eventId, UUID journalId);
}
