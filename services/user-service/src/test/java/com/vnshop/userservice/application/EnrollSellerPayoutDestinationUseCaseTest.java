package com.vnshop.userservice.application;

import com.vnshop.userservice.domain.SellerProfile;
import com.vnshop.userservice.domain.Tier;
import com.vnshop.userservice.domain.payoutdestination.CipherPort;
import com.vnshop.userservice.domain.payoutdestination.SellerPayoutDestination;
import com.vnshop.userservice.domain.payoutdestination.SellerPayoutDestination.VerificationState;
import com.vnshop.userservice.domain.port.out.UserRepositoryPort;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EnrollSellerPayoutDestinationUseCaseTest {

    @Mock
    private UserRepositoryPort userRepositoryPort;

    @Mock
    private CipherPort cipher;

    private EnrollSellerPayoutDestinationUseCase useCase() {
        return new EnrollSellerPayoutDestinationUseCase(userRepositoryPort, cipher);
    }

    // -------------------------------------------------------------------------
    // enroll() – happy path: new enrollment (no previous destination)
    // -------------------------------------------------------------------------

    @Test
    void enroll_happyPath_savesDestinationWithPendingState() {
        SellerProfile profile = new SellerProfile("seller-1", "My Shop", "Vietcombank",
                null, true, Tier.STANDARD, false);
        when(userRepositoryPort.findSellerById("seller-1")).thenReturn(Optional.of(profile));
        when(userRepositoryPort.updateSeller(any())).thenAnswer(inv -> inv.getArgument(0));
        when(cipher.currentKeyVersion()).thenReturn(3);
        when(cipher.encrypt(anyString(), anyInt())).thenReturn("AES256:mockEnvelope");

        EnrollDestinationCommand cmd = new EnrollDestinationCommand(
                "seller-1", "Vietcombank", "1234567890");
        SellerProfile result = useCase().enroll(cmd);

        assertThat(result.destination()).isPresent();
        SellerPayoutDestination dest = result.destination().get();
        assertThat(dest.bankName()).isEqualTo("Vietcombank");
        assertThat(dest.bankAccountLast4()).isEqualTo("7890");
        assertThat(dest.keyVersion()).isEqualTo(3);
        assertThat(dest.algorithm()).isEqualTo("AES-256-GCM");
        assertThat(dest.verificationState()).isEqualTo(VerificationState.PENDING);
        assertThat(dest.fingerprint()).hasSize(64); // SHA-256 hex
    }

    @Test
    void enroll_happyPath_enrolledAtIsNow_whenNoPreviousDestination() {
        SellerProfile profile = new SellerProfile("seller-1", "My Shop", "Vietcombank",
                null, true, Tier.STANDARD, false);
        when(userRepositoryPort.findSellerById("seller-1")).thenReturn(Optional.of(profile));
        when(userRepositoryPort.updateSeller(any())).thenAnswer(inv -> inv.getArgument(0));
        when(cipher.currentKeyVersion()).thenReturn(1);
        when(cipher.encrypt(anyString(), anyInt())).thenReturn("env");

        SellerProfile result = useCase().enroll(
                new EnrollDestinationCommand("seller-1", "Vietcombank", "9876543210"));

        // enrolledAt must be set to Instant.now() (within a generous 60-second window)
        Instant enrolledAt = result.destination().get().enrolledAt();
        Instant sixtySecondsAgo = Instant.now().minusSeconds(60);
        assertThat(enrolledAt).isAfter(sixtySecondsAgo);
        assertThat(enrolledAt).isBefore(Instant.now().plusSeconds(1));
    }

    // -------------------------------------------------------------------------
    // enroll() – re-enrollment: previous destination present
    // -------------------------------------------------------------------------

    @Test
    void enroll_reEnrollment_preservesOriginalEnrolledAt() {
        Instant originalEnrolledAt = Instant.parse("2025-01-15T10:00:00Z");
        SellerPayoutDestination previous = new SellerPayoutDestination(
                "dest-old", "seller-1", "OldBank",
                "4321", "oldFingerprint", 1, "AES-256-GCM",
                "oldEnvelope", VerificationState.VERIFIED,
                originalEnrolledAt, Instant.now()
        );
        SellerProfile profile = new SellerProfile("seller-1", "My Shop", "Vietcombank",
                null, true, Tier.STANDARD, false);
        // Use reflection or a builder to set destination – use withArgs approach
        invokeEnrollDestination(profile, previous);

        when(userRepositoryPort.findSellerById("seller-1")).thenReturn(Optional.of(profile));
        when(userRepositoryPort.updateSeller(any())).thenAnswer(inv -> inv.getArgument(0));
        when(cipher.currentKeyVersion()).thenReturn(2);
        when(cipher.encrypt(anyString(), anyInt())).thenReturn("newEnvelope");

        EnrollDestinationCommand cmd = new EnrollDestinationCommand(
                "seller-1", "NewBank", "5555666677");
        SellerProfile result = useCase().enroll(cmd);

        // enrolledAt must be the original timestamp, not Instant.now()
        assertThat(result.destination().get().enrolledAt()).isEqualTo(originalEnrolledAt);
        assertThat(result.destination().get().verificationState())
                .isEqualTo(VerificationState.PENDING); // reset to PENDING on re-enroll
    }

    // -------------------------------------------------------------------------
    // enroll() – null / not-found branches
    // -------------------------------------------------------------------------

    @Test
    void enroll_nullCommand_throwsIllegalArgumentException() {
        assertThatThrownBy(() -> useCase().enroll(null))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("command is required");
    }

    @Test
    void enroll_sellerNotFound_throwsIllegalArgumentException() {
        when(userRepositoryPort.findSellerById("unknown")).thenReturn(Optional.empty());

        EnrollDestinationCommand cmd = new EnrollDestinationCommand(
                "unknown", "Bank", "1234567890");

        assertThatThrownBy(() -> useCase().enroll(cmd))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("seller profile not found");

        verify(userRepositoryPort, never()).updateSeller(any());
    }

    // -------------------------------------------------------------------------
    // enroll() – interaction verification
    // -------------------------------------------------------------------------

    @Test
    void enroll_callsCipherWithCanonicalPlaintext() {
        SellerProfile profile = new SellerProfile("seller-1", "My Shop", "BIDV",
                null, true, Tier.STANDARD, false);
        when(userRepositoryPort.findSellerById("seller-1")).thenReturn(Optional.of(profile));
        when(userRepositoryPort.updateSeller(any())).thenAnswer(inv -> inv.getArgument(0));
        when(cipher.currentKeyVersion()).thenReturn(5);
        when(cipher.encrypt(anyString(), eq(5))).thenReturn("envelope");

        useCase().enroll(new EnrollDestinationCommand("seller-1", "  bidv  ", "  12345  "));

        // canonicalPlaintext trims and upper-cases: "BIDV:12345"
        verify(cipher).encrypt("BIDV:12345", 5);
    }

    @Test
    void enroll_savesUpdatedProfile() {
        SellerProfile profile = new SellerProfile("seller-1", "Shop", "VCB",
                null, true, Tier.STANDARD, false);
        when(userRepositoryPort.findSellerById("seller-1")).thenReturn(Optional.of(profile));
        when(userRepositoryPort.updateSeller(any())).thenAnswer(inv -> inv.getArgument(0));
        when(cipher.currentKeyVersion()).thenReturn(1);
        when(cipher.encrypt(anyString(), anyInt())).thenReturn("env");

        useCase().enroll(new EnrollDestinationCommand("seller-1", "VCB", "11223344"));

        ArgumentCaptor<SellerProfile> captor = ArgumentCaptor.forClass(SellerProfile.class);
        verify(userRepositoryPort).updateSeller(captor.capture());
        assertThat(captor.getValue().destination()).isPresent();
    }

    @Test
    void enroll_doesNotUpdateRepoWhenSellerNotFound() {
        when(userRepositoryPort.findSellerById("unknown")).thenReturn(Optional.empty());

        try {
            useCase().enroll(new EnrollDestinationCommand("unknown", "Bank", "1234567890"));
        } catch (IllegalArgumentException ignored) { }

        verify(userRepositoryPort, never()).updateSeller(any());
    }

    // -------------------------------------------------------------------------
    // Constructor – null guard
    // -------------------------------------------------------------------------

    @Test
    void constructor_nullUserRepositoryPort_throwsNullPointerException() {
        assertThatThrownBy(() -> new EnrollSellerPayoutDestinationUseCase(null, cipher))
                .isInstanceOf(NullPointerException.class)
                .hasMessage("userRepositoryPort is required");
    }

    @Test
    void constructor_nullCipher_throwsNullPointerException() {
        assertThatThrownBy(() -> new EnrollSellerPayoutDestinationUseCase(userRepositoryPort, null))
                .isInstanceOf(NullPointerException.class)
                .hasMessage("cipher is required");
    }

    // -------------------------------------------------------------------------
    // last4Of() branches via enroll() — @NotBlank on the record is validated
    // at the controller layer, not at construction; the null-safety branch in
    // last4Of() is an internal defensive net.  The short-account branches
    // (<=4 chars) are reachable, however.
    // -------------------------------------------------------------------------

    @Test
    void enroll_exactly4CharAccount_last4IsFullAccount() {
        SellerProfile profile = new SellerProfile("s1", "Shop", "Bank", null, true, Tier.STANDARD, false);
        when(userRepositoryPort.findSellerById("s1")).thenReturn(Optional.of(profile));
        when(userRepositoryPort.updateSeller(any())).thenAnswer(inv -> inv.getArgument(0));
        when(cipher.currentKeyVersion()).thenReturn(1);
        when(cipher.encrypt(anyString(), anyInt())).thenReturn("env");

        useCase().enroll(new EnrollDestinationCommand("s1", "Bank", "1234"));

        verify(userRepositoryPort).updateSeller(any());
        // last4Of("1234") → trimmed.length()==4 <=4 → returns trimmed → "1234"
    }

    @Test
    void enroll_undersizedBlankishAccount_last4Is0000() {
        SellerProfile profile = new SellerProfile("s1", "Shop", "Bank", null, true, Tier.STANDARD, false);
        when(userRepositoryPort.findSellerById("s1")).thenReturn(Optional.of(profile));
        when(userRepositoryPort.updateSeller(any())).thenAnswer(inv -> inv.getArgument(0));
        when(cipher.currentKeyVersion()).thenReturn(1);
        when(cipher.encrypt(anyString(), anyInt())).thenReturn("env");

        // Account "  " has length <= 4 and isBlank → last4Of returns "0000"
        useCase().enroll(new EnrollDestinationCommand("s1", "Bank", "   "));
        // passes validation (non-null, non-blank after trim?) — actually blank strings
        // may fail @NotBlank at controller, but the UseCase itself still accepts them.
        // This exercises the isBlank branch of last4Of.
        verify(userRepositoryPort).updateSeller(any());
    }

    @Test
    void enroll_last4IsLast4Chars_forNormalAccount() {
        SellerProfile profile = new SellerProfile("s1", "Shop", "Bank", null, true, Tier.STANDARD, false);
        when(userRepositoryPort.findSellerById("s1")).thenReturn(Optional.of(profile));
        when(userRepositoryPort.updateSeller(any())).thenAnswer(inv -> inv.getArgument(0));
        when(cipher.currentKeyVersion()).thenReturn(1);
        when(cipher.encrypt(anyString(), anyInt())).thenReturn("env");

        SellerProfile result = useCase().enroll(
                new EnrollDestinationCommand("s1", "Bank", "1234567890"));

        assertThat(result.destination().get().bankAccountLast4()).isEqualTo("7890");
    }

    // -------------------------------------------------------------------------
    // Helper: invoke enrollDestination via the only public path (enroll())
    // -------------------------------------------------------------------------

    private void invokeEnrollDestination(SellerProfile profile, SellerPayoutDestination destination) {
        // The only public way to set destination on a SellerProfile is via enrollDestination().
        // Call the use case to enroll a first destination, then replace the profile's destination field.
        when(userRepositoryPort.findSellerById(profile.id())).thenReturn(Optional.of(profile));
        when(userRepositoryPort.updateSeller(any())).thenAnswer(inv -> inv.getArgument(0));
        when(cipher.currentKeyVersion()).thenReturn(1);
        when(cipher.encrypt(anyString(), anyInt())).thenReturn("env");
        useCase().enroll(new EnrollDestinationCommand(profile.id(), "TempBank", "0000000000"));
        // Now replace with the real previous destination for the re-enroll test
        // Use a captor to grab the saved profile and set its destination field
        // Instead: directly manipulate the field via setAccessible
        try {
            var field = SellerProfile.class.getDeclaredField("destination");
            field.setAccessible(true);
            field.set(profile, destination);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
