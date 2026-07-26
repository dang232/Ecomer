package com.vnshop.userservice.domain;

import com.vnshop.userservice.domain.payoutdestination.SellerPayoutDestination;
import com.vnshop.userservice.domain.payoutdestination.SellerPayoutDestination.VerificationState;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SellerProfileTest {

    private static final Instant NOW = Instant.parse("2026-07-24T00:00:00Z");

    private static SellerPayoutDestination destination(VerificationState state) {
        return new SellerPayoutDestination(
                "dest-1", "seller-1", "Vietcombank", "1234", "fp-001", 1,
                "AES/GCM/NoPadding", "ciphertext", state, NOW, NOW);
    }

    @Test
    void sevenArgConstructor_defaultsNewFieldsToNull() {
        SellerProfile p = new SellerProfile("id", "Shop", "Bank", null, true, Tier.STANDARD, false);
        assertThat(p.description()).isNull();
        assertThat(p.logoUrl()).isNull();
        assertThat(p.bannerUrl()).isNull();
        assertThat(p.createdAt()).isNull();
        assertThat(p.destination()).isEmpty();
    }

    @Test
    void fullConstructor_surfacesAllFields() {
        Instant now = Instant.now();
        SellerProfile p = new SellerProfile(
                "id", "Shop", "Bank", null, true, Tier.VERIFIED, false,
                "desc", "http://logo", "http://banner", now, null
        );
        assertThat(p.description()).isEqualTo("desc");
        assertThat(p.logoUrl()).isEqualTo("http://logo");
        assertThat(p.bannerUrl()).isEqualTo("http://banner");
        assertThat(p.createdAt()).isEqualTo(now);
        assertThat(p.tier()).isEqualTo(Tier.VERIFIED);
    }

    @Test
    void nullTier_defaultsToStandard() {
        SellerProfile p = new SellerProfile("id", "Shop", "Bank", null, false, null, false);
        assertThat(p.tier()).isEqualTo(Tier.STANDARD);
    }

    @Test
    void blankShopName_throwsIllegalArgument() {
        assertThatThrownBy(() -> new SellerProfile("id", " ", "Bank", null, false, Tier.STANDARD, false))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("shopName");
    }

    @Test
    void updateShop_changesShopName() {
        SellerProfile p = new SellerProfile("id", "Shop", "Bank", null, false, Tier.STANDARD, false);
        p.updateShop("New Shop", null);
        assertThat(p.shopName()).isEqualTo("New Shop");
    }

    @Test
    void approve_setsApprovedTrue() {
        SellerProfile p = new SellerProfile("id", "Shop", "Bank", null, false, Tier.STANDARD, false);
        p.approve();
        assertThat(p.approved()).isTrue();
    }

    @Test
    void changeTier_updatesTier() {
        SellerProfile p = new SellerProfile("id", "Shop", "Bank", null, false, Tier.STANDARD, false);
        p.changeTier(Tier.PREFERRED);
        assertThat(p.tier()).isEqualTo(Tier.PREFERRED);
    }

    @Test
    void setVacationMode_updatesFlag() {
        SellerProfile p = new SellerProfile("id", "Shop", "Bank", null, false, Tier.STANDARD, false);
        p.setVacationMode(true);
        assertThat(p.vacationMode()).isTrue();
    }

    @Test
    void blankBankName_throwsIllegalArgument() {
        assertThatThrownBy(() -> new SellerProfile("id", "Shop", " ", null, false, Tier.STANDARD, false))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("bankName");
    }

    @Test
    void updateShop_blankShopName_throws() {
        SellerProfile p = new SellerProfile("id", "Shop", "Bank", null, false, Tier.STANDARD, false);
        assertThatThrownBy(() -> p.updateShop("  ", null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("shopName");
    }

    @Test
    void changeTier_null_throwsNullPointer() {
        SellerProfile p = new SellerProfile("id", "Shop", "Bank", null, false, Tier.STANDARD, false);
        assertThatThrownBy(() -> p.changeTier(null))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void allTierValues_roundTrip() {
        for (Tier t : Tier.values()) {
            SellerProfile p = new SellerProfile("id", "Shop", "Bank", null, false, t, false);
            assertThat(p.tier()).isEqualTo(t);
        }
    }

    @Test
    void sellerNotFoundException_containsSellerId() {
        SellerNotFoundException ex = new SellerNotFoundException("seller-xyz");
        assertThat(ex.getMessage()).contains("seller-xyz");
    }

    @Test
    void reject_setsApprovedFalseAndReason() {
        SellerProfile p = new SellerProfile("id", "Shop", "Bank", null, true, Tier.STANDARD, false);
        p.reject("KYC missing");
        assertThat(p.approved()).isFalse();
        assertThat(p.rejectionReason()).isEqualTo("KYC missing");
    }

    @Test
    void withRejectionReason_setsReasonAndReturnsSameInstance() {
        SellerProfile p = new SellerProfile("id", "Shop", "Bank", null, true, Tier.STANDARD, false);
        SellerProfile returned = p.withRejectionReason("needs review");
        assertThat(returned).isSameAs(p);
        assertThat(p.rejectionReason()).isEqualTo("needs review");
    }

    @Test
    void enrollDestination_replacesAndExposes() {
        SellerProfile p = new SellerProfile("id", "Shop", "Bank", null, false, Tier.STANDARD, false);
        p.enrollDestination(destination(VerificationState.VERIFIED));
        assertThat(p.destination()).isPresent();
    }

    @Test
    void enrollDestination_null_throws() {
        SellerProfile p = new SellerProfile("id", "Shop", "Bank", null, false, Tier.STANDARD, false);
        assertThatThrownBy(() -> p.enrollDestination(null))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void hasVerifiedDestination_trueOnlyWhenVerified() {
        SellerProfile p = new SellerProfile("id", "Shop", "Bank", null, false, Tier.STANDARD, false);
        assertThat(p.hasVerifiedDestination()).isFalse();

        p.enrollDestination(destination(VerificationState.PENDING));
        assertThat(p.hasVerifiedDestination()).isFalse();

        p.enrollDestination(destination(VerificationState.VERIFIED));
        assertThat(p.hasVerifiedDestination()).isTrue();
    }

    @Test
    void destinationMask_emptyWhenNoDestination() {
        SellerProfile p = new SellerProfile("id", "Shop", "Bank", null, false, Tier.STANDARD, false);
        assertThat(p.destinationMask()).isEmpty();
    }

    @Test
    void destinationMask_exposesLastFourAndStateButNotCiphertext() {
        SellerProfile p = new SellerProfile("id", "Shop", "Bank", null, false, Tier.STANDARD, false);
        p.enrollDestination(destination(VerificationState.VERIFIED));
        SellerProfile.DestinationMask mask = p.destinationMask().orElseThrow();
        assertThat(mask.destinationId()).isEqualTo("dest-1");
        assertThat(mask.bankName()).isEqualTo("Vietcombank");
        assertThat(mask.last4()).isEqualTo("****1234");
        assertThat(mask.verificationState()).isEqualTo("VERIFIED");
        assertThat(mask.toString()).doesNotContain("ciphertext");
    }

    @Test
    void toString_redactsFingerprint() {
        SellerProfile p = new SellerProfile("id", "Shop", "Bank", null, false, Tier.STANDARD, false);
        p.enrollDestination(destination(VerificationState.VERIFIED));
        String string = p.toString();
        assertThat(string).contains("destination=");
        assertThat(string).contains("id='id'");
        assertThat(string).contains("shopName='Shop'");
    }

    @Test
    void setVacationMode_false_clearsFlag() {
        SellerProfile p = new SellerProfile("id", "Shop", "Bank", null, false, Tier.STANDARD, true);
        assertThat(p.vacationMode()).isTrue();

        p.setVacationMode(false);

        assertThat(p.vacationMode()).isFalse();
    }

    @Test
    void updateShop_setsNonNullPickupAddress() {
        Address newAddr = new Address("New Street", "Ward 5", "District 7", "HCMC", false);
        SellerProfile p = new SellerProfile("id", "Shop", "Bank", null, false, Tier.STANDARD, false);

        p.updateShop("Renamed", newAddr);

        assertThat(p.shopName()).isEqualTo("Renamed");
        assertThat(p.pickupAddress()).isEqualTo(newAddr);
    }

    @Test
    void accessors_returnConstructorArguments() {
        Address addr = new Address("S", "W", "D", "C", false);
        Instant created = Instant.parse("2026-01-01T00:00:00Z");
        SellerProfile p = new SellerProfile(
                "id", "Shop", "Bank", addr, true, Tier.PREFERRED, false,
                "desc", "http://logo", "http://banner", created, null);

        assertThat(p.id()).isEqualTo("id");
        assertThat(p.bankName()).isEqualTo("Bank");
        assertThat(p.pickupAddress()).isEqualTo(addr);
        assertThat(p.approved()).isTrue();
        assertThat(p.description()).isEqualTo("desc");
        assertThat(p.logoUrl()).isEqualTo("http://logo");
        assertThat(p.bannerUrl()).isEqualTo("http://banner");
        assertThat(p.createdAt()).isEqualTo(created);
    }
}
