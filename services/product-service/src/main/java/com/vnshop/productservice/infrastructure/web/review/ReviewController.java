package com.vnshop.productservice.infrastructure.web.review;

import com.vnshop.productservice.infrastructure.web.ApiResponse;
import com.vnshop.productservice.application.review.CreateReviewCommand;
import com.vnshop.productservice.application.review.CreateReviewUseCase;
import com.vnshop.productservice.application.review.GetProductReviewsUseCase;
import com.vnshop.productservice.application.review.SellerReviewSummaryUseCase;
import com.vnshop.productservice.application.review.SellerReviewListUseCase;
import com.vnshop.productservice.application.review.VoteHelpfulUseCase;
import com.vnshop.productservice.domain.review.SellerReviewSummary;
import com.vnshop.productservice.infrastructure.config.JwtPrincipalUtil;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/reviews")
public class ReviewController {
    private final CreateReviewUseCase createReviewUseCase;
    private final GetProductReviewsUseCase getProductReviewsUseCase;
    private final VoteHelpfulUseCase voteHelpfulUseCase;
    private final SellerReviewSummaryUseCase sellerReviewSummaryUseCase;
    private final SellerReviewListUseCase sellerReviewListUseCase;

    public ReviewController(CreateReviewUseCase createReviewUseCase, GetProductReviewsUseCase getProductReviewsUseCase,
            VoteHelpfulUseCase voteHelpfulUseCase, SellerReviewSummaryUseCase sellerReviewSummaryUseCase,
            SellerReviewListUseCase sellerReviewListUseCase) {
        this.createReviewUseCase = createReviewUseCase;
        this.getProductReviewsUseCase = getProductReviewsUseCase;
        this.voteHelpfulUseCase = voteHelpfulUseCase;
        this.sellerReviewSummaryUseCase = sellerReviewSummaryUseCase;
        this.sellerReviewListUseCase = sellerReviewListUseCase;
    }

    @GetMapping("/product/{productId}")
    public ApiResponse<List<ReviewResponse>> byProduct(@PathVariable String productId) {
        return ApiResponse.ok(getProductReviewsUseCase.get(productId).stream().map(ReviewResponse::fromEnriched).toList());
    }

    @GetMapping("/seller/{sellerId}/summary")
    public ApiResponse<SellerReviewSummary> sellerSummary(@PathVariable String sellerId) {
        return ApiResponse.ok(sellerReviewSummaryUseCase.getSummary(sellerId));
    }

    @GetMapping("/seller/me")
    @PreAuthorize("hasRole('SELLER')")
    public ApiResponse<Page<ReviewResponse>> sellerReviews(
            @RequestParam(value = "q", required = false) String query,
            @PageableDefault(size = 20) Pageable pageable) {
        return ApiResponse.ok(sellerReviewListUseCase.list(JwtPrincipalUtil.currentSellerId(), query, pageable)
                .map(ReviewResponse::fromEnriched));
    }

    @PostMapping("/seller-summaries")
    public ApiResponse<SellerSummariesResponse> sellerSummaries(@Valid @RequestBody SellerSummariesRequest request) {
        return ApiResponse.ok(new SellerSummariesResponse(sellerReviewSummaryUseCase.getSummaries(request.sellerIds())));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<ReviewResponse> create(@Valid @RequestBody CreateReviewRequest request) {
        // buyerId always comes from the JWT — never trust a body field for identity.
        // orderId is optional; the use case validates it when present.
        String orderId = request.orderId() == null || request.orderId().isBlank() ? null : request.orderId();
        return ApiResponse.ok(ReviewResponse.fromDomain(createReviewUseCase.create(new CreateReviewCommand(
                request.productId(),
                JwtPrincipalUtil.currentUserId(),
                orderId,
                request.rating(),
                request.comment(),
                request.images()))));
    }

    @PutMapping("/{id}/helpful")
    @PreAuthorize("isAuthenticated()")
    public ApiResponse<ReviewResponse> voteHelpful(@PathVariable UUID id) {
        String voterId = JwtPrincipalUtil.currentUserId();
        return ApiResponse.ok(ReviewResponse.fromDomain(voteHelpfulUseCase.vote(id, voterId)));
    }
}

