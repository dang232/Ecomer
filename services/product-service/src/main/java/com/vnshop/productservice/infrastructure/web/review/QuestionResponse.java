package com.vnshop.productservice.infrastructure.web.review;

import com.vnshop.productservice.domain.review.ProductQuestion;

import java.time.Instant;

public record QuestionResponse(String id, String productId, String userId, String question,
        String answer, Instant answeredAt, Instant createdAt) {
    static QuestionResponse fromDomain(ProductQuestion question) {
        return new QuestionResponse(question.questionId().toString(), question.productId(), question.buyerId(),
                question.question(), question.answer(), question.answeredAt(), question.createdAt());
    }
}
