package com.vnshop.productservice.infrastructure.storage;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class ObjectStoragePropertiesTest {
    @Test
    void usesPublicEndpointForBrowserFacingUrls() {
        ObjectStorageProperties properties = new ObjectStorageProperties();
        properties.setEndpoint("http://minio:9000");
        properties.setPublicEndpoint("https://storage.vnshop.invalid");

        assertThat(properties.resolvePublicEndpoint()).isEqualTo("https://storage.vnshop.invalid");
    }

    @Test
    void fallsBackToInternalEndpointWhenPublicEndpointIsUnset() {
        ObjectStorageProperties properties = new ObjectStorageProperties();
        properties.setEndpoint("http://minio:9000");

        assertThat(properties.resolvePublicEndpoint()).isEqualTo("http://minio:9000");
    }
}
