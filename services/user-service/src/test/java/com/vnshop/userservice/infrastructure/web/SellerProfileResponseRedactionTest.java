package com.vnshop.userservice.infrastructure.web;

import static org.assertj.core.api.Assertions.assertThat;

import com.vnshop.userservice.domain.SellerProfile;
import com.vnshop.userservice.domain.Tier;
import com.vnshop.userservice.domain.payoutdestination.SellerPayoutDestination;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class SellerProfileResponseRedactionTest {

    @Test
    void selfAndAdminResponseExposeMaskedLastFourOnly() {
        SellerProfile profile = new SellerProfile(
                "seller-1", "Shop", "Vietcombank", null, true, Tier.VERIFIED, false,
                null, null, null, Instant.parse("2026-07-26T00:00:00Z"),
                new SellerPayoutDestination(
                        "destination-1", "seller-1", "Vietcombank", "7890", "fingerprint-1", 1,
                        "AES-256-GCM", "v1.ciphertext", SellerPayoutDestination.VerificationState.VERIFIED,
                        Instant.parse("2026-07-26T00:00:00Z"), Instant.parse("2026-07-26T00:00:00Z")));

        SellerProfileResponse response = SellerProfileResponse.fromDomain(profile);

        assertThat(response.destination().last4()).isEqualTo("****7890");
        assertThat(response.destination().verificationState()).isEqualTo("VERIFIED");
        assertThat(response.toString()).doesNotContain("v1.ciphertext");
        assertThat(response.toString()).doesNotContain("1234567890");
    }
}
