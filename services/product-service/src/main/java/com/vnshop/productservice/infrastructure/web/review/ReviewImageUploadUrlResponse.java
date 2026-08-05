package com.vnshop.productservice.infrastructure.web.review;

import com.vnshop.productservice.application.review.image.ReviewImageUploadResponse;

import java.net.URI;
import java.util.Map;

public record ReviewImageUploadUrlResponse(String objectKey, URI uploadUrl, Map<String, String> uploadHeaders,
        String checksumSha256, String quarantineState,
        long expiresInSeconds) {
    static ReviewImageUploadUrlResponse fromApplication(ReviewImageUploadResponse response) {
        return new ReviewImageUploadUrlResponse(response.objectKey(), response.uploadUrl(), response.uploadHeaders(),
                response.checksumSha256(),
                response.quarantineState(), response.expiresInSeconds());
    }
}
