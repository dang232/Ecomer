package com.vnshop.productservice.application.review.image;

import java.net.URI;
import java.util.Map;

public record ReviewImageUploadResponse(
        String objectKey,
        URI uploadUrl,
        Map<String, String> uploadHeaders,
        String checksumSha256,
        String quarantineState,
        long expiresInSeconds
) {}
