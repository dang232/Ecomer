package com.vnshop.productservice.domain.review;

/**
 * Provider-neutral moderation outcome. REVIEW keeps the item in the existing
 * human queue; REJECT is reserved for high-confidence external providers.
 */
public enum ReviewModerationDecision {
    APPROVE,
    REVIEW,
    REJECT
}
