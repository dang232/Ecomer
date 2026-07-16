package com.vnshop.productservice.infrastructure.moderation;

import com.vnshop.productservice.domain.review.ReviewModerationDecision;
import com.vnshop.productservice.domain.review.ReviewModerationRequest;
import com.vnshop.productservice.domain.review.port.out.ReviewModerationPort;
import org.springframework.stereotype.Component;

import java.util.regex.Pattern;

/**
 * Conservative local fallback used when no external classifier is configured.
 * It auto-approves only low-risk verified text and sends every uncertain case
 * to a human. It deliberately never auto-rejects content.
 */
@Component
public class RuleBasedReviewModeration implements ReviewModerationPort {
    private static final int MAX_AUTO_APPROVE_LENGTH = 500;
    private static final Pattern URL = Pattern.compile("(?i)\\b(?:https?://|www\\.)\\S+");
    private static final Pattern EMAIL = Pattern.compile(
            "(?i)\\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}\\b");
    private static final Pattern PHONE = Pattern.compile("(?:\\+?\\d[\\d .-]{7,}\\d)");
    private static final Pattern REPEATED_CHARACTER = Pattern.compile("(?iu)([\\p{L}\\p{N}])\\1{7,}");

    @Override
    public ReviewModerationDecision assess(ReviewModerationRequest request) {
        String text = request.text().strip();
        if (!request.verifiedPurchase()
                || !request.images().isEmpty()
                || text.length() > MAX_AUTO_APPROVE_LENGTH
                || URL.matcher(text).find()
                || EMAIL.matcher(text).find()
                || PHONE.matcher(text).find()
                || REPEATED_CHARACTER.matcher(text).find()) {
            return ReviewModerationDecision.REVIEW;
        }
        return ReviewModerationDecision.APPROVE;
    }
}
