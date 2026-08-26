package com.vnshop.paymentservice.infrastructure.persistence;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.time.Instant;

public interface DurableDltRepository extends JpaRepository<DurableDltJpaEntity, UUID> {
    @Query("select min(d.firstSeen) from DurableDltJpaEntity d where d.replayedAt is null")
    Optional<Instant> findOldestUnreplayedFirstSeen();
    Optional<DurableDltJpaEntity> findByTopicAndPartitionAndOffsetAndPayloadHash(
            String topic, int partition, long offset, String payloadHash);

    @Modifying
    @Query("update DurableDltJpaEntity d set d.replayClaimedAt = :claimedAt, d.replayClaimedUntil = :claimedUntil "
            + "where d.id = :id and d.replayedAt is null and "
            + "(d.replayClaimedUntil is null or d.replayClaimedUntil < :claimedAt)")
    int claimReplay(@Param("id") UUID id, @Param("claimedAt") java.time.Instant claimedAt,
                    @Param("claimedUntil") java.time.Instant claimedUntil);

    @Modifying
    @Query("update DurableDltJpaEntity d set d.replayedAt = :replayedAt, d.replayClaimedUntil = null "
            + "where d.id = :id and d.replayedAt is null and d.replayClaimedAt = :claimedAt")
    int markReplayed(@Param("id") UUID id, @Param("claimedAt") java.time.Instant claimedAt,
                     @Param("replayedAt") java.time.Instant replayedAt);

    @Modifying
    @Query("update DurableDltJpaEntity d set d.replayClaimedUntil = null "
            + "where d.id = :id and d.replayedAt is null and d.replayClaimedAt = :claimedAt")
    int releaseReplayClaim(@Param("id") UUID id, @Param("claimedAt") java.time.Instant claimedAt);
}
