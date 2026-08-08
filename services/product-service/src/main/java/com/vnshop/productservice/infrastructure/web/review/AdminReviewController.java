package com.vnshop.productservice.infrastructure.web.review;

import com.vnshop.productservice.infrastructure.web.ApiResponse;
import com.vnshop.productservice.application.review.ModerateReviewUseCase;
import com.vnshop.productservice.application.review.AdminReviewListUseCase;
import com.vnshop.productservice.application.review.AdminReviewCursorPage;
import com.vnshop.productservice.domain.review.Review;
import com.vnshop.productservice.domain.review.port.out.ReviewCursorAnchor;
import com.vnshop.productservice.infrastructure.web.AdminCursorPage;
import com.vnshop.productservice.infrastructure.web.pagination.AdminCursorCodec;
import com.vnshop.productservice.infrastructure.web.pagination.AdminCursorFilterHash;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.beans.factory.annotation.Autowired;
import jakarta.validation.Valid;

import java.util.List;
import java.util.UUID;
import java.time.Instant;

@RestController
@RequestMapping("/admin/reviews")
@PreAuthorize("hasRole('ADMIN')")
public class AdminReviewController {
    private final ModerateReviewUseCase moderateReviewUseCase;
    private final AdminReviewListUseCase adminReviewListUseCase;
    private final AdminCursorCodec cursorCodec;

    @Autowired
    public AdminReviewController(ModerateReviewUseCase moderateReviewUseCase,
            AdminReviewListUseCase adminReviewListUseCase, AdminCursorCodec cursorCodec) {
        this.moderateReviewUseCase = moderateReviewUseCase;
        this.adminReviewListUseCase = adminReviewListUseCase;
        this.cursorCodec = cursorCodec;
    }

    public AdminReviewController(ModerateReviewUseCase moderateReviewUseCase,
            AdminReviewListUseCase adminReviewListUseCase) {
        this(moderateReviewUseCase, adminReviewListUseCase, null);
    }

    @GetMapping("/pending")
    public ApiResponse<?> pending(@RequestParam(value = "q", required = false) String query,
            @RequestParam(required = false) Integer limit, @RequestParam(required = false) String cursor) {
        if (limit != null || cursor != null) return cursorPage(query, limit, cursor);
        return ApiResponse.ok(adminReviewListUseCase.pending(query).stream()
                .map(ReviewResponse::fromEnriched)
                .toList());
    }

    private ApiResponse<AdminCursorPage<ReviewResponse>> cursorPage(String query, Integer requestedLimit, String token) {
        int pageSize = requestedLimit == null ? 50 : requestedLimit;
        if (pageSize < 1 || pageSize > 100) throw new IllegalArgumentException("invalid_page_size");
        String resource = "admin-reviews-pending";
        String sort = "createdAt:desc,reviewId:desc";
        String filterHash = AdminCursorFilterHash.forQuery(query);
        ReviewCursorAnchor anchor = null;
        if (token != null) {
            AdminCursorCodec.Cursor decoded = cursorCodec.decode(token, resource, filterHash, sort);
            try {
                anchor = new ReviewCursorAnchor(Instant.parse(decoded.sortKey()), UUID.fromString(decoded.uniqueId()));
            } catch (RuntimeException exception) {
                throw AdminCursorCodec.InvalidCursorException.invalidAnchor();
            }
        }
        AdminReviewCursorPage result = adminReviewListUseCase.pendingCursor(query, anchor, pageSize);
        List<ReviewResponse> items = result.items().stream().map(ReviewResponse::fromEnriched).toList();
        String next = null;
        if (result.hasMore()) {
            Review last = result.items().getLast().review();
            next = cursorCodec.encode(new AdminCursorCodec.Cursor(resource, filterHash, sort,
                    last.createdAt().toString(), last.reviewId().toString(), null, null));
        }
        return ApiResponse.ok(new AdminCursorPage<>(items, next, result.hasMore(), pageSize,
                new AdminCursorPage.Sort("createdAt,reviewId", "desc"), null));
    }

    @PutMapping("/{id}/approve")
    public ApiResponse<ReviewResponse> approve(@PathVariable UUID id) {
        return ApiResponse.ok(ReviewResponse.fromDomain(moderateReviewUseCase.approve(id)));
    }

    @PutMapping("/{id}/reject")
    public ApiResponse<ReviewResponse> reject(@PathVariable UUID id, @Valid @RequestBody RejectReviewRequest request) {
        return ApiResponse.ok(ReviewResponse.fromDomain(moderateReviewUseCase.reject(id, request.reason())));
    }
}
