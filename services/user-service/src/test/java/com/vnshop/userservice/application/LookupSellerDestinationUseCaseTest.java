package com.vnshop.userservice.application;

import com.vnshop.userservice.domain.SellerProfile;
import com.vnshop.userservice.domain.Tier;
import com.vnshop.userservice.domain.payoutdestination.DestinationMaterial;
import com.vnshop.userservice.domain.payoutdestination.SellerPayoutDestination;
import com.vnshop.userservice.domain.payoutdestination.SellerPayoutDestination.VerificationState;
import com.vnshop.userservice.domain.port.out.UserRepositoryPort;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LookupSellerDestinationUseCaseTest {

    private static final String SELLER_ID = "seller-xyz";
    private static final Instant NOW = Instant.parse("2024-06-01T00:00:00Z");

    @Mock
    private UserRepositoryPort userRepositoryPort;

    private LookupSellerDestinationUseCase useCase() {
        return new LookupSellerDestinationUseCase(userRepositoryPort);
    }

    private static SellerPayoutDestination destination(String destId) {
        return new SellerPayoutDestination(
                destId,
                SELLER_ID,
                "VNBank",
                "7890",
                "fp_abc123",
                1,
                "AES/GCM/NoPadding",
                "Abc123==",
                VerificationState.VERIFIED,
                NOW,
                NOW
        );
    }

    private static SellerProfile sellerProfile(SellerPayoutDestination dest) {
        return new SellerProfile(
                SELLER_ID, "My Shop", "VNBank", null,
                true, Tier.VERIFIED, false,
                null, null, null, NOW, dest
        );
    }

    // --- constructor ---

    @Test
    void constructor_nullPort_throwsNullPointerException() {
        assertThatThrownBy(() -> new LookupSellerDestinationUseCase(null))
                .isInstanceOf(NullPointerException.class)
                .hasMessageContaining("userRepositoryPort");
    }

    // --- sellerId validation ---

    @Test
    void lookup_nullSellerId_throwsIllegalArgumentException() {
        assertThatThrownBy(() -> useCase().lookup(null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("sellerId is required");
    }

    @Test
    void lookup_blankSellerId_throwsIllegalArgumentException() {
        assertThatThrownBy(() -> useCase().lookup("   "))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("sellerId is required");
    }

    // --- seller not found ---

    @Test
    void lookup_sellerNotFound_throwsIllegalArgumentException() {
        when(userRepositoryPort.findSellerById(SELLER_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> useCase().lookup(SELLER_ID))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("seller profile not found");
    }

    // --- destination not enrolled ---

    @Test
    void lookup_noDestination_throwsIllegalStateException() {
        SellerProfile profileWithoutDestination = new SellerProfile(
                SELLER_ID, "My Shop", "VNBank", null,
                true, Tier.VERIFIED, false
        );
        when(userRepositoryPort.findSellerById(SELLER_ID)).thenReturn(Optional.of(profileWithoutDestination));

        assertThatThrownBy(() -> useCase().lookup(SELLER_ID))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("no enrolled payout destination");
    }

    // --- happy path ---

    @Test
    void lookup_withDestination_returnsEncryptedMaterial() {
        SellerPayoutDestination dest = destination("dest-001");
        SellerProfile profile = sellerProfile(dest);
        when(userRepositoryPort.findSellerById(SELLER_ID)).thenReturn(Optional.of(profile));

        DestinationMaterial result = useCase().lookup(SELLER_ID);

        assertThat(result.destinationId()).isEqualTo("dest-001");
        assertThat(result.sellerId()).isEqualTo(SELLER_ID);
        assertThat(result.ciphertext()).isEqualTo("Abc123==");
        assertThat(result.keyVersion()).isEqualTo(1);
        assertThat(result.algorithm()).isEqualTo("AES/GCM/NoPadding");
        assertThat(result.fingerprint()).isEqualTo("fp_abc123");
    }

    @Test
    void lookup_unverifiedDestination_failsClosed() {
        SellerPayoutDestination dest = new SellerPayoutDestination(
                "dest-001", SELLER_ID, "VNBank", "7890", "fp_abc123", 1,
                "AES-256-GCM", "v1.envelope", VerificationState.PENDING, NOW, NOW);
        when(userRepositoryPort.findSellerById(SELLER_ID)).thenReturn(Optional.of(sellerProfile(dest)));

        assertThatThrownBy(() -> useCase().lookup(SELLER_ID))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("not verified");
    }
}
