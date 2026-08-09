package com.vnshop.productservice.domain.review.port.out;

import java.time.Instant;
import java.util.UUID;

public record ReviewCursorAnchor(Instant createdAt, UUID reviewId) {}
