package com.vnshop.productservice.infrastructure.persistence.review;

import com.vnshop.productservice.infrastructure.persistence.BaseJpaEntity;
import com.vnshop.productservice.domain.review.Review;
import com.vnshop.productservice.domain.review.ReviewStatus;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(schema = "product_svc", name = "reviews")
@Getter
@Setter
public class ReviewJpaEntity extends BaseJpaEntity {
    @Id
    @Column(name = "review_id", columnDefinition = "uuid")
    private UUID reviewId;

    @Column(name = "product_id", nullable = false)
    private String productId;

    @Column(name = "buyer_id", nullable = false)
    private String buyerId;

    @Column(name = "order_id")
    private String orderId;

    @Column(name = "rating", nullable = false)
    private int rating;

    @Column(name = "text", nullable = false, length = 1000)
    private String text;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(schema = "product_svc", name = "review_images", joinColumns = @JoinColumn(name = "review_id"))
    @OrderColumn(name = "image_order")
    @Column(name = "image_url", nullable = false, length = 1024)
    private List<String> images = new ArrayList<>();

    @Column(name = "verified_purchase", nullable = false)
    private boolean verifiedPurchase;

    @Column(name = "helpful_votes", nullable = false)
    private int helpfulVotes;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(schema = "product_svc", name = "review_helpful_voters", joinColumns = @JoinColumn(name = "review_id"))
    @Column(name = "voter_id", nullable = false, length = 64)
    private Set<String> helpfulVoterIds = new HashSet<>();

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private ReviewStatus status;

    @Column(name = "rejection_reason", length = 1000)
    private String rejectionReason;


    protected ReviewJpaEntity() {
    }

    public static ReviewJpaEntity fromDomain(Review review) {
        ReviewJpaEntity entity = new ReviewJpaEntity();
        entity.reviewId = review.reviewId();
        entity.productId = review.productId();
        entity.buyerId = review.buyerId();
        entity.orderId = review.orderId();
        entity.rating = review.rating();
        entity.text = review.text();
        entity.images = new ArrayList<>(review.images());
        entity.verifiedPurchase = review.verifiedPurchase();
        entity.helpfulVotes = review.helpfulVotes();
        entity.helpfulVoterIds = new HashSet<>(review.helpfulVoterIds());
        entity.status = review.status();
        entity.rejectionReason = review.rejectionReason();
        entity.restoreCreatedAt(review.createdAt());
        return entity;
    }

    public Review toDomain() {
        return new Review(reviewId, productId, buyerId, orderId, rating, text, images, verifiedPurchase,
                helpfulVotes, helpfulVoterIds, status, rejectionReason, getCreatedAt());
    }
}
