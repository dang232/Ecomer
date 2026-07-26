package com.vnshop.productservice.infrastructure.persistence.review;

import com.vnshop.productservice.domain.review.ProductQuestion;
import com.vnshop.productservice.domain.review.ProductReviewSummary;
import com.vnshop.productservice.domain.review.Review;
import com.vnshop.productservice.domain.review.ReviewStatus;
import com.vnshop.productservice.domain.review.SellerReviewSummary;
import com.vnshop.productservice.domain.review.port.out.ReviewRepositoryPort;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

@Repository
public class ReviewJpaRepository implements ReviewRepositoryPort {
    private final ReviewJpaSpringDataRepository reviewRepository;
    private final QuestionJpaSpringDataRepository questionRepository;

    public ReviewJpaRepository(ReviewJpaSpringDataRepository reviewRepository,
            QuestionJpaSpringDataRepository questionRepository) {
        this.reviewRepository = reviewRepository;
        this.questionRepository = questionRepository;
    }

    @Override
    public Review save(Review review) {
        return reviewRepository.save(ReviewJpaEntity.fromDomain(review)).toDomain();
    }

    @Override
    public boolean existsByProductIdAndBuyerId(String productId, String buyerId) {
        return reviewRepository.existsByProductIdAndBuyerId(productId, buyerId);
    }

    @Override
    public List<Review> findByProductId(String productId) {
        return reviewRepository.findByProductIdAndStatus(productId, ReviewStatus.APPROVED).stream()
                .map(ReviewJpaEntity::toDomain)
                .toList();
    }

    @Override
    public ProductReviewSummary getProductReviewSummary(String productId) {
        List<Object[]> rows = reviewRepository.findProductReviewStats(productId);
        if (rows.isEmpty()) {
            return ProductReviewSummary.empty();
        }
        Object[] row = rows.getFirst();
        long count = row.length < 2 || row[1] == null ? 0L : ((Number) row[1]).longValue();
        Double average = count == 0 || row[0] == null ? null : ((Number) row[0]).doubleValue();
        return new ProductReviewSummary(average, count);
    }

    @Override
    public Map<String, ProductReviewSummary> getProductReviewSummaries(Collection<String> productIds) {
        Map<String, ProductReviewSummary> result = new HashMap<>();
        if (productIds == null || productIds.isEmpty()) {
            return result;
        }
        productIds.stream()
                .filter(id -> id != null && !id.isBlank())
                .distinct()
                .forEach(id -> result.put(id, ProductReviewSummary.empty()));
        if (result.isEmpty()) {
            return result;
        }
        for (Object[] row : reviewRepository.findProductReviewStatsBatch(result.keySet())) {
            if (row == null || row.length < 3 || row[0] == null) {
                continue;
            }
            String productId = String.valueOf(row[0]);
            long count = row[2] == null ? 0L : ((Number) row[2]).longValue();
            Double average = count == 0 || row[1] == null ? null : ((Number) row[1]).doubleValue();
            result.put(productId, new ProductReviewSummary(average, count));
        }
        return result;
    }

    @Override
    public List<String> findProductIdsWithApprovedReviews() {
        return reviewRepository.findProductIdsWithApprovedReviews();
    }

    @Override
    public List<Review> findByBuyerId(String buyerId) {
        return reviewRepository.findByBuyerId(buyerId).stream().map(ReviewJpaEntity::toDomain).toList();
    }

    @Override
    public List<Review> findByStatus(ReviewStatus status) {
        return reviewRepository.findByStatus(status).stream().map(ReviewJpaEntity::toDomain).toList();
    }

    @Override
    public List<Review> findByStatus(ReviewStatus status, String query) {
        String normalizedQuery = query == null ? "" : query.trim().toLowerCase();
        return reviewRepository.findByStatusAndQuery(status.name(), normalizedQuery).stream()
                .map(ReviewJpaEntity::toDomain)
                .toList();
    }

    @Override
    public Page<Review> findApprovedBySellerId(String sellerId, String query, Pageable pageable) {
        String normalizedSellerId = sellerId == null ? "" : sellerId.trim();
        String normalizedQuery = query == null ? "" : query.trim().toLowerCase();
        return reviewRepository.findApprovedBySellerId(normalizedSellerId, normalizedQuery, pageable)
                .map(ReviewJpaEntity::toDomain);
    }

    @Override
    public Optional<Review> findReviewById(UUID reviewId) {
        return reviewRepository.findById(reviewId).map(ReviewJpaEntity::toDomain);
    }

    @Override
    public Review moderate(UUID reviewId, ReviewStatus status) {
        return moderate(reviewId, status, null);
    }

    @Override
    public Review moderate(UUID reviewId, ReviewStatus status, String rejectionReason) {
        Review review = findReviewById(reviewId)
                .orElseThrow(() -> new IllegalArgumentException("review not found: " + reviewId));
        return save(review.withStatus(status).withRejectionReason(rejectionReason));
    }

    @Override
    public ProductQuestion saveQuestion(ProductQuestion question) {
        return questionRepository.save(QuestionJpaEntity.fromDomain(question)).toDomain();
    }

    @Override
    public List<ProductQuestion> findQuestionsByProductId(String productId) {
        return questionRepository.findByProductId(productId).stream().map(QuestionJpaEntity::toDomain).toList();
    }

    @Override
    public Optional<ProductQuestion> findQuestionById(UUID questionId) {
        return questionRepository.findById(questionId).map(QuestionJpaEntity::toDomain);
    }

    @Override
    public SellerReviewSummary getSellerReviewSummary(String sellerId) {
        java.util.List<Object[]> rows = reviewRepository.findSellerReviewStats(sellerId);
        if (rows.isEmpty()) return new SellerReviewSummary(null, 0L);
        Object[] row = rows.get(0);
        long count = row.length < 2 || row[1] == null ? 0L : ((Number) row[1]).longValue();
        Double avg = (count == 0 || row[0] == null) ? null : ((Number) row[0]).doubleValue();
        return new SellerReviewSummary(avg, count);
    }

    @Override
    public Map<String, SellerReviewSummary> getSellerReviewSummaries(Set<String> sellerIds) {
        Map<String, SellerReviewSummary> result = new HashMap<>();
        // Pre-fill all requested sellers with zero defaults
        for (String id : sellerIds) {
            result.put(id, new SellerReviewSummary(null, 0L));
        }
        if (sellerIds.isEmpty()) {
            return result;
        }
        List<Object[]> rows = reviewRepository.findSellerReviewStatsBatch(sellerIds);
        for (Object[] row : rows) {
            String sellerId = (String) row[0];
            long count = row[2] == null ? 0L : ((Number) row[2]).longValue();
            Double avg = (count == 0 || row[1] == null) ? null : ((Number) row[1]).doubleValue();
            result.put(sellerId, new SellerReviewSummary(avg, count));
        }
        return result;
    }
}
