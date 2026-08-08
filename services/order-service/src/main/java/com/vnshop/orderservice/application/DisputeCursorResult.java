package com.vnshop.orderservice.application;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record DisputeCursorResult(List<EnrichedDispute> items, boolean hasMore, Instant lastCreatedAt, UUID lastDisputeId) {}
