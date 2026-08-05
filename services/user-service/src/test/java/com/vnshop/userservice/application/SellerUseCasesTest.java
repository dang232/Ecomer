package com.vnshop.userservice.application;

import com.vnshop.userservice.domain.SellerProfile;
import com.vnshop.userservice.domain.Tier;
import com.vnshop.userservice.domain.port.out.KeycloakAdminPort;
import com.vnshop.userservice.domain.port.out.UserRepositoryPort;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SellerUseCasesTest {

    @Mock
    private UserRepositoryPort userRepositoryPort;

    @Mock
    private KeycloakAdminPort keycloakAdminPort;

    private static SellerProfile seller(String id) {
        return new SellerProfile(id, "Shop", "Bank", null, false, Tier.STANDARD, false);
    }

    // --- ApproveSellerUseCase ---

    @Test
    void approve_happyPath_approvesAndUpdates() {
        SellerProfile s = seller("s1");
        when(userRepositoryPort.findSellerById("s1")).thenReturn(Optional.of(s));
        when(userRepositoryPort.updateSeller(s)).thenReturn(s);

        ApproveSellerUseCase useCase = new ApproveSellerUseCase(userRepositoryPort, keycloakAdminPort);
        SellerProfile result = useCase.approve("s1");

        assertThat(result.approved()).isTrue();
        verify(userRepositoryPort).updateSeller(s);
        verify(keycloakAdminPort).assignSellerRole("s1");
    }

    @Test
    void approve_notFound_throws() {
        when(userRepositoryPort.findSellerById("s1")).thenReturn(Optional.empty());

        ApproveSellerUseCase useCase = new ApproveSellerUseCase(userRepositoryPort, keycloakAdminPort);
        assertThatThrownBy(() -> useCase.approve("s1"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("seller profile not found");
    }

    @Test
    void approve_roleAssignmentFails_keepsApplicationPending() {
        SellerProfile s = seller("s1");
        when(userRepositoryPort.findSellerById("s1")).thenReturn(Optional.of(s));
        doThrow(new IllegalStateException("Keycloak unavailable"))
                .when(keycloakAdminPort).assignSellerRole("s1");

        ApproveSellerUseCase useCase = new ApproveSellerUseCase(userRepositoryPort, keycloakAdminPort);

        assertThatThrownBy(() -> useCase.approve("s1"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("Keycloak unavailable");
        assertThat(s.approved()).isFalse();
        verify(userRepositoryPort, never()).updateSeller(any());
    }

    @Test
    void approve_nullRepo_throws() {
        assertThatThrownBy(() -> new ApproveSellerUseCase(null, keycloakAdminPort))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void approve_nullKeycloakAdmin_throws() {
        assertThatThrownBy(() -> new ApproveSellerUseCase(userRepositoryPort, null))
                .isInstanceOf(NullPointerException.class);
    }

    // --- ListPendingSellersUseCase ---

    @Test
    void listPending_returnsPendingSellers() {
        List<SellerProfile> pending = List.of(seller("s1"), seller("s2"));
        when(userRepositoryPort.findPendingSellers(null)).thenReturn(pending);

        ListPendingSellersUseCase useCase = new ListPendingSellersUseCase(userRepositoryPort);
        List<SellerProfile> result = useCase.listPending();

        assertThat(result).hasSize(2);
    }

    // --- ViewSellerProfileUseCase ---

    @Test
    void viewSeller_happyPath_returnsSeller() {
        SellerProfile s = seller("s1");
        when(userRepositoryPort.findSellerById("s1")).thenReturn(Optional.of(s));

        ViewSellerProfileUseCase useCase = new ViewSellerProfileUseCase(userRepositoryPort);
        SellerProfile result = useCase.view("s1");

        assertThat(result.id()).isEqualTo("s1");
    }

    @Test
    void viewSeller_notFound_throws() {
        when(userRepositoryPort.findSellerById("s1")).thenReturn(Optional.empty());

        ViewSellerProfileUseCase useCase = new ViewSellerProfileUseCase(userRepositoryPort);
        assertThatThrownBy(() -> useCase.view("s1"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("seller profile not found");
    }

    // --- RegisterSellerUseCase ---

    @Test
    void register_savesAndReturnsSeller() {
        RegisterSellerCommand cmd = new RegisterSellerCommand("kc-1", "My Shop", "BankA");
        SellerProfile saved = new SellerProfile("kc-1", "My Shop", "BankA", null, false, Tier.STANDARD, false);
        when(userRepositoryPort.saveSeller(any())).thenReturn(saved);

        RegisterSellerUseCase useCase = new RegisterSellerUseCase(userRepositoryPort);
        SellerProfile result = useCase.register(cmd);

        assertThat(result.id()).isEqualTo("kc-1");
        assertThat(result.shopName()).isEqualTo("My Shop");
        verify(userRepositoryPort).saveSeller(any());
    }

    @Test
    void register_existingApplication_returnsItWithoutReplacingShop() {
        SellerProfile existing = new SellerProfile("kc-1", "Approved Shop", "BankA", null, true,
                Tier.VERIFIED, false);
        when(userRepositoryPort.findSellerById("kc-1")).thenReturn(Optional.of(existing));

        RegisterSellerUseCase useCase = new RegisterSellerUseCase(userRepositoryPort);
        SellerProfile result = useCase.register(new RegisterSellerCommand("kc-1", "New Shop", "BankB"));

        assertThat(result).isSameAs(existing);
        verify(userRepositoryPort, org.mockito.Mockito.never()).saveSeller(any());
    }

    @Test
    void register_nullRepo_throws() {
        assertThatThrownBy(() -> new RegisterSellerUseCase(null))
                .isInstanceOf(NullPointerException.class);
    }
}
