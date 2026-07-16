package com.vnshop.productservice.infrastructure.moderation;

import com.vnshop.productservice.domain.review.ReviewModerationDecision;
import com.vnshop.productservice.domain.review.ReviewModerationRequest;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class RuleBasedReviewModerationTest {
    private final RuleBasedReviewModeration moderation = new RuleBasedReviewModeration();

    @Test
    void autoApprovesLowRiskTextFromAVerifiedPurchase() {
        ReviewModerationDecision decision = moderation.assess(new ReviewModerationRequest(
                "The sound is clear and delivery was careful.", 5, true, List.of()));

        assertThat(decision).isEqualTo(ReviewModerationDecision.APPROVE);
    }

    @Test
    void requiresHumanReviewWhenPurchaseOrMediaCannotBeVerifiedByThisPolicy() {
        assertThat(moderation.assess(new ReviewModerationRequest(
                "The sound is clear.", 5, false, List.of())))
                .isEqualTo(ReviewModerationDecision.REVIEW);
        assertThat(moderation.assess(new ReviewModerationRequest(
                "The sound is clear.", 5, true, List.of("https://cdn.example/review.jpg"))))
                .isEqualTo(ReviewModerationDecision.REVIEW);
    }

    @Test
    void requiresHumanReviewForContactLinksAndSpamSignals() {
        assertThat(moderation.assess(new ReviewModerationRequest(
                "Contact me at buyer@example.com", 4, true, List.of())))
                .isEqualTo(ReviewModerationDecision.REVIEW);
        assertThat(moderation.assess(new ReviewModerationRequest(
                "See https://example.com/deal", 4, true, List.of())))
                .isEqualTo(ReviewModerationDecision.REVIEW);
        assertThat(moderation.assess(new ReviewModerationRequest(
                "goooooooooood", 4, true, List.of())))
                .isEqualTo(ReviewModerationDecision.REVIEW);
    }

    @Test
    void doesNotAutoRejectContentWithoutAnExternalHighConfidenceProvider() {
        ReviewModerationDecision decision = moderation.assess(new ReviewModerationRequest(
                "Contact 0901234567 for details", 1, true, List.of()));

        assertThat(decision).isEqualTo(ReviewModerationDecision.REVIEW);
    }
}
