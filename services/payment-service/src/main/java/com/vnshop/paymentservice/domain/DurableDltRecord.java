package com.vnshop.paymentservice.domain;

import java.time.Instant;
import java.util.UUID;

public record DurableDltRecord(
        UUID id,
        String topic,
        int partition,
        long offset,
        String key,
        String payload,
        String payloadHash,
        String reason,
        int attempts,
        Instant firstSeen,
        Instant replayedAt
) {}
