package com.vnshop.paymentservice.infrastructure.dlt;

import com.vnshop.paymentservice.infrastructure.persistence.DurableDltRepository;
import java.time.Instant;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class DurableDltReplayTransactions {
    private final DurableDltRepository repository;

    public DurableDltReplayTransactions(DurableDltRepository repository) {
        this.repository = repository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean claim(UUID id, Instant claimedAt, Instant claimedUntil) {
        return repository.claimReplay(id, claimedAt, claimedUntil) == 1;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean markReplayed(UUID id, Instant claimedAt, Instant replayedAt) {
        return repository.markReplayed(id, claimedAt, replayedAt) == 1;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public boolean release(UUID id, Instant claimedAt) {
        return repository.releaseReplayClaim(id, claimedAt) == 1;
    }
}
