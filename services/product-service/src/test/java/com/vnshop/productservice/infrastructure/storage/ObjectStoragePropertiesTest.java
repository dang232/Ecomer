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

    @Test
    void logicalProductKeysUseTheConfiguredProductBucket() {
        ObjectStorageProperties properties = new ObjectStorageProperties();
        properties.setBucket("vnshop-products");
        properties.setEndpoint("http://minio:9000");
        properties.setPublicEndpoint("http://localhost:9000");
        properties.setPathStyleAccess(true);

        S3ObjectStorageAdapter adapter = new S3ObjectStorageAdapter(
                null,
                null,
                properties,
                new VideoStorageProperties(
                        "vnshop-video-uploads-tmp",
                        "vnshop-videos-staging",
                        "vnshop-videos"));

        assertThat(adapter.publicUrl("products/product-1/images/front.png").toString())
                .isEqualTo("http://localhost:9000/vnshop-products/products/product-1/images/front.png");
    }

    @Test
    void logicalReviewKeysUseTheConfiguredReviewBucket() {
        ObjectStorageProperties properties = new ObjectStorageProperties();
        properties.setBucket("vnshop-products");
        properties.setReviewBucket("vnshop-reviews");
        properties.setEndpoint("http://minio:9000");
        properties.setPublicEndpoint("http://localhost:9000");
        properties.setPathStyleAccess(true);

        S3ObjectStorageAdapter adapter = new S3ObjectStorageAdapter(
                null,
                null,
                properties,
                new VideoStorageProperties(
                        "vnshop-video-uploads-tmp",
                        "vnshop-videos-staging",
                        "vnshop-videos"));

        assertThat(adapter.publicUrl("reviews/review-1/images/front.png").toString())
                .isEqualTo("http://localhost:9000/vnshop-reviews/reviews/review-1/images/front.png");
    }
}
