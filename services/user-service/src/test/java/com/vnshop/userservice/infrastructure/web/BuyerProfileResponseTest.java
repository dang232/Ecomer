package com.vnshop.userservice.infrastructure.web;

import static org.assertj.core.api.Assertions.assertThat;

import com.vnshop.userservice.domain.BuyerProfile;
import com.vnshop.userservice.infrastructure.storage.ObjectStorageProperties;
import java.util.List;
import org.junit.jupiter.api.Test;

class BuyerProfileResponseTest {
    @Test
    void rewritesLegacyAvatarUrlToDefaultConfiguredEndpoint() {
        ObjectStorageProperties properties = properties("http://localhost:8080", null, "vnshop-avatars");
        BuyerProfile profile = profile("http://localhost:9000/vnshop-avatars/avatars/id/a.jpg");

        assertThat(mapper(properties).fromDomain(profile).avatarUrl())
                .isEqualTo("http://localhost:8080/vnshop-avatars/avatars/id/a.jpg");
    }

    @Test
    void rewritesLegacyAvatarUrlToOverriddenEndpointAndBucket() {
        ObjectStorageProperties properties = properties(
                "http://localhost:8080/", "https://avatars.example.com:9443/", "buyer-images");
        BuyerProfile profile = profile("http://localhost:9000/vnshop-avatars/avatars/id/a.jpg");

        assertThat(mapper(properties).fromDomain(profile).avatarUrl())
                .isEqualTo("https://avatars.example.com:9443/buyer-images/avatars/id/a.jpg");
    }

    @Test
    void preservesExternalAvatarUrl() {
        BuyerProfile profile = profile("https://cdn.example.com/avatar.jpg");

        assertThat(mapper(properties("http://localhost:8080", null, "vnshop-avatars"))
                .fromDomain(profile).avatarUrl())
                .isEqualTo("https://cdn.example.com/avatar.jpg");
    }

    @Test
    void preservesConfiguredNewAvatarUrl() {
        String avatarUrl = "https://avatars.example.com/vnshop-avatars/avatars/id/a.jpg";

        assertThat(mapper(properties("http://localhost:8080", "https://avatars.example.com", "vnshop-avatars"))
                .fromDomain(profile(avatarUrl)).avatarUrl())
                .isEqualTo(avatarUrl);
    }

    @Test
    void preservesOtherLocalStoragePath() {
        String avatarUrl = "http://localhost:9000/other-bucket/avatars/id/a.jpg";

        assertThat(mapper(properties("http://localhost:8080", null, "vnshop-avatars"))
                .fromDomain(profile(avatarUrl)).avatarUrl())
                .isEqualTo(avatarUrl);
    }

    @Test
    void preservesNullAvatarUrl() {
        assertThat(mapper(properties("http://localhost:8080", null, "vnshop-avatars"))
                .fromDomain(profile(null)).avatarUrl()).isNull();
    }

    private static BuyerProfileResponseMapper mapper(ObjectStorageProperties properties) {
        return new BuyerProfileResponseMapper(properties);
    }

    private static ObjectStorageProperties properties(String endpoint, String publicEndpoint, String bucket) {
        ObjectStorageProperties properties = new ObjectStorageProperties();
        properties.setEndpoint(endpoint);
        properties.setPublicEndpoint(publicEndpoint);
        properties.setBucket(bucket);
        return properties;
    }

    private static BuyerProfile profile(String avatarUrl) {
        return new BuyerProfile("id", "email", "Buyer", null, avatarUrl, false, List.of());
    }
}
