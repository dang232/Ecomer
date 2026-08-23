package com.vnshop.userservice.infrastructure.web;

import static org.assertj.core.api.Assertions.assertThat;

import com.vnshop.userservice.domain.BuyerProfile;
import java.util.List;
import org.junit.jupiter.api.Test;

class BuyerProfileResponseTest {
    @Test
    void rewritesLegacyLocalMinioAvatarUrlOnly() {
        BuyerProfile profile = new BuyerProfile("id", "email", "Buyer", null,
                "http://localhost:9000/vnshop-avatars/avatars/id/a.jpg", false, List.of());
        assertThat(BuyerProfileResponse.fromDomain(profile).avatarUrl())
                .isEqualTo("http://localhost:8080/vnshop-avatars/avatars/id/a.jpg");
    }

    @Test
    void preservesExternalAvatarUrl() {
        BuyerProfile profile = new BuyerProfile("id", "email", "Buyer", null,
                "https://cdn.example.com/avatar.jpg", false, List.of());
        assertThat(BuyerProfileResponse.fromDomain(profile).avatarUrl())
                .isEqualTo("https://cdn.example.com/avatar.jpg");
    }
}
