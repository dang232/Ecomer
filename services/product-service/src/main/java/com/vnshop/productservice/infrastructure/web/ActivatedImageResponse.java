package com.vnshop.productservice.infrastructure.web;

import com.vnshop.productservice.application.image.ProductImageActivationResponse;
import java.net.URI;

public record ActivatedImageResponse(String objectKey, String checksumSha256, String quarantineState, URI url) {
    static ActivatedImageResponse fromApplication(ProductImageActivationResponse response) {
        return new ActivatedImageResponse(response.objectKey(), response.checksumSha256(), response.quarantineState(), response.url());
    }
}
