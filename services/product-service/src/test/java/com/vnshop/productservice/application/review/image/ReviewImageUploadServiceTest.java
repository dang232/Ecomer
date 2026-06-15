package com.vnshop.productservice.application.review.image;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.vnshop.productservice.application.ProductAccessDeniedException;
import com.vnshop.productservice.application.image.FakeObjectMetadataRepository;
import com.vnshop.productservice.application.storage.ObjectValidationPolicy;
import com.vnshop.productservice.application.storage.ObjectValidationService;
import com.vnshop.productservice.domain.review.ProductQuestion;
import com.vnshop.productservice.domain.review.Review;
import com.vnshop.productservice.domain.review.ReviewStatus;
import com.vnshop.productservice.domain.review.SellerReviewSummary;
import com.vnshop.productservice.domain.review.port.out.ReviewRepositoryPort;
import com.vnshop.productservice.domain.port.out.ObjectMetadataRepositoryPort;
import com.vnshop.productservice.domain.port.out.ObjectStoragePort;
import com.vnshop.productservice.domain.storage.ObjectMetadata;
import com.vnshop.productservice.domain.storage.ObjectStorageClass;
import java.io.InputStream;
import java.net.URI;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * Locks the pt20 ownership gate on ReviewImageUploadService.activate.
 * Same three branches as ProductImageUploadServiceTest:
 *   - review not found
 *   - buyer mismatch (different JWT sub from review.buyerId)
 *   - objectKey path-prefix targets a different review
 *
 * Without this test, the review-side activate gate could drift from the
 * product-side without any signal — pt20's commit reasoned about both
 * variants together, but only the product variant has dedicated coverage.
 */
class ReviewImageUploadServiceTest {
    private final FakeReviewRepository reviewRepository = new FakeReviewRepository();
    private final FakeObjectStorage objectStorage = new FakeObjectStorage();
    private final FakeObjectMetadataRepository metadataRepository = new FakeObjectMetadataRepository();
    private final ReviewImageUploadService service = new ReviewImageUploadService(
            reviewRepository, objectStorage, metadataRepository,
            new ObjectValidationService(ObjectValidationPolicy.builder()
                    .storageClass(ObjectStorageClass.REVIEW_IMAGE)
                    .maxBytes(5 * 1024 * 1024)
                    .allowedContentTypes(Set.of("image/jpeg", "image/png", "image/webp"))
                    .maxImageWidth(4096)
                    .maxImageHeight(4096)
                    .build()));

    @Test
    void activateRejectsRequestForUnknownReviewWithAccessDenied() {
        UUID reviewId = UUID.randomUUID();

        assertThatThrownBy(() -> service.activate(
                reviewId.toString(),
                "buyer-1",
                "reviews/" + reviewId + "/images/x.png",
                activationRequest()))
                .isInstanceOf(ProductAccessDeniedException.class);
        assertThat(metadataRepository.findByKeyCalls).isEmpty();
    }

    @Test
    void activateRejectsRequestFromWrongBuyerWithAccessDenied() {
        UUID reviewId = UUID.randomUUID();
        Review seeded = new Review(reviewId, "product-1", "buyer-1", "order-1", 5,
                "great", List.of(), true, 0, java.util.Set.of(), ReviewStatus.PENDING, java.time.Instant.now());
        reviewRepository.save(seeded);

        assertThatThrownBy(() -> service.activate(
                reviewId.toString(),
                "buyer-2",  // not the author
                "reviews/" + reviewId + "/images/x.png",
                activationRequest()))
                .isInstanceOf(ProductAccessDeniedException.class);
        assertThat(metadataRepository.findByKeyCalls).isEmpty();
    }

    @Test
    void activateRejectsObjectKeyForDifferentReviewWithAccessDenied() {
        UUID reviewId = UUID.randomUUID();
        Review seeded = new Review(reviewId, "product-1", "buyer-1", "order-1", 5,
                "great", List.of(), true, 0, java.util.Set.of(), ReviewStatus.PENDING, java.time.Instant.now());
        reviewRepository.save(seeded);

        assertThatThrownBy(() -> service.activate(
                reviewId.toString(),
                "buyer-1",
                "reviews/" + UUID.randomUUID() + "/images/x.png",  // different review
                activationRequest()))
                .isInstanceOf(ProductAccessDeniedException.class);
        assertThat(metadataRepository.findByKeyCalls).isEmpty();
    }

    private static ReviewImageActivationRequest activationRequest() {
        return new ReviewImageActivationRequest(
                "image/png", 1024, "a".repeat(64), 800, 600);
    }

    private static final class FakeReviewRepository implements ReviewRepositoryPort {
        private final Map<UUID, Review> reviews = new HashMap<>();

        @Override
        public Review save(Review review) {
            reviews.put(review.reviewId(), review);
            return review;
        }

        @Override
        public Optional<Review> findReviewById(UUID reviewId) {
            return Optional.ofNullable(reviews.get(reviewId));
        }

        @Override public List<Review> findByProductId(String productId) { return List.of(); }
        @Override public List<Review> findByBuyerId(String buyerId) { return List.of(); }
        @Override public List<Review> findByStatus(ReviewStatus status) { return List.of(); }
        @Override public boolean existsByProductIdAndBuyerId(String productId, String buyerId) { return false; }
        @Override public Review moderate(UUID reviewId, ReviewStatus status) { return reviews.get(reviewId).withStatus(status); }
        @Override public ProductQuestion saveQuestion(ProductQuestion question) { return question; }
        @Override public List<ProductQuestion> findQuestionsByProductId(String productId) { return List.of(); }
        @Override public Optional<ProductQuestion> findQuestionById(UUID questionId) { return Optional.empty(); }
        @Override public SellerReviewSummary getSellerReviewSummary(String sellerId) { return null; }
        @Override public Map<String, SellerReviewSummary> getSellerReviewSummaries(Set<String> sellerIds) { return Map.of(); }
    }

    private static final class FakeObjectStorage implements ObjectStoragePort {
        @Override public void putObject(String key, InputStream content, ObjectMetadata metadata) {}
        @Override public URI getSignedUploadUrl(String key, ObjectMetadata metadata) { return URI.create("https://storage.test/" + key); }
        @Override public URI getSignedDownloadUrl(String key, ObjectStorageClass storageClass) { return URI.create("https://storage.test/" + key); }
        @Override public void deleteObject(String key) {}
        @Override public URI publicUrl(String key) { return URI.create("https://cdn.test/" + key); }
        @Override public Optional<ObjectMetadata> headObject(String key) { return Optional.empty(); }
        @Override public void copyObject(String sourceKey, String destinationKey) {}
    }
}
