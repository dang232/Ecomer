package com.vnshop.productservice.application.image;

import java.net.URI;

public record ProductImageActivationResponse(String objectKey, String checksumSha256, String quarantineState, URI url) {
}
