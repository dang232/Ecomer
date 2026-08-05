package com.vnshop.productservice.application.image;

import java.net.URI;
import java.util.Map;
import lombok.Builder;

@Builder
public record ProductImageUploadResponse(
        String objectKey,
        URI uploadUrl,
        Map<String, String> uploadHeaders,
        String checksumSha256,
        String quarantineState,
        long expiresInSeconds
) {
}
