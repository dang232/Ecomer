package com.vnshop.recommendationsservice.infrastructure.dlt;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface DurableDltRepository extends JpaRepository<DurableDltJpaEntity, UUID> {
    Optional<DurableDltJpaEntity> findByTopicAndPartitionAndOffsetAndPayloadHash(
            String topic, int partition, long offset, String payloadHash);

    @Modifying
    @Query("update DurableDltJpaEntity d set d.replayClaimedAt=:at,d.replayClaimedUntil=:until "
            + "where d.id=:id and d.replayedAt is null and (d.replayClaimedUntil is null or d.replayClaimedUntil < :at)")
    int claim(@Param("id") UUID id, @Param("at") Instant at, @Param("until") Instant until);

    @Modifying
    @Query("update DurableDltJpaEntity d set d.replayedAt=:replayedAt,d.replayClaimedUntil=null "
            + "where d.id=:id and d.replayedAt is null and d.replayClaimedAt=:claimedAt")
    int markReplayed(@Param("id") UUID id, @Param("claimedAt") Instant claimedAt,
                     @Param("replayedAt") Instant replayedAt);

    @Modifying
    @Query("update DurableDltJpaEntity d set d.replayClaimedUntil=null "
            + "where d.id=:id and d.replayedAt is null and d.replayClaimedAt=:claimedAt")
    int release(@Param("id") UUID id, @Param("claimedAt") Instant claimedAt);
}
