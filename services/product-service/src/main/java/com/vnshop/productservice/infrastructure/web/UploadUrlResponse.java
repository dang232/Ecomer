package com.vnshop.productservice.infrastructure.web;

import com.vnshop.productservice.application.image.ProductImageUploadResponse;
import java.net.URI;
import java.util.Map;

public record UploadUrlResponse(String objectKey, URI uploadUrl, Map<String, String> uploadHeaders,
        String checksumSha256, String quarantineState,
        long expiresInSeconds) {
    static UploadUrlResponse fromApplication(ProductImageUploadResponse response) {
        return new UploadUrlResponse(response.objectKey(), response.uploadUrl(), response.uploadHeaders(), response.checksumSha256(),
                response.quarantineState(), response.expiresInSeconds());
    }
}
