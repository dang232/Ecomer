package com.vnshop.productservice.infrastructure.web.review;

import jakarta.validation.constraints.NotBlank;

public record RejectReviewRequest(@NotBlank String reason) {
}
