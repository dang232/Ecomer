package com.vnshop.productservice.application.review.image;

import java.net.URI;

public record ReviewImageActivationResponse(
        String objectKey,
        String quarantineState,
        String checksumSha256,
        URI url) {
}
