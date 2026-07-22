package com.vnshop.productservice.infrastructure.web.review;

import com.vnshop.productservice.infrastructure.web.ApiResponse;
import com.vnshop.productservice.application.review.ModerateReviewUseCase;
import com.vnshop.productservice.application.review.AdminReviewListUseCase;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import jakarta.validation.Valid;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/admin/reviews")
@PreAuthorize("hasRole('ADMIN')")
public class AdminReviewController {
    private final ModerateReviewUseCase moderateReviewUseCase;
    private final AdminReviewListUseCase adminReviewListUseCase;

    public AdminReviewController(ModerateReviewUseCase moderateReviewUseCase,
            AdminReviewListUseCase adminReviewListUseCase) {
        this.moderateReviewUseCase = moderateReviewUseCase;
        this.adminReviewListUseCase = adminReviewListUseCase;
    }

    @GetMapping("/pending")
    public ApiResponse<List<ReviewResponse>> pending(@RequestParam(value = "q", required = false) String query) {
        return ApiResponse.ok(adminReviewListUseCase.pending(query).stream()
                .map(ReviewResponse::fromEnriched)
                .toList());
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
