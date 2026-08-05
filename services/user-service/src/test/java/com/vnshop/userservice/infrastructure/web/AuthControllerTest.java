package com.vnshop.userservice.infrastructure.web;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.when;

import com.vnshop.userservice.application.PhoneAlreadyRegisteredException;
import com.vnshop.userservice.application.RegisterBuyerUseCase;
import com.vnshop.userservice.infrastructure.keycloak.KeycloakAdminClient;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    @Mock
    private KeycloakAdminClient keycloakAdmin;

    @Mock
    private RegisterBuyerUseCase registerBuyerUseCase;

    @Test
    void register_phoneAlreadyOwned_doesNotCreateAnIdentityProviderUser() {
        doThrow(new PhoneAlreadyRegisteredException()).when(registerBuyerUseCase)
                .assertPhoneAvailable(any());

        AuthController controller = new AuthController(keycloakAdmin, registerBuyerUseCase);

        assertThatThrownBy(() -> controller.register(new RegisterRequest(
                "buyer@example.com", "Password1", "Buyer", "One", "+84912345678")))
                .isInstanceOf(PhoneAlreadyRegisteredException.class);

        verify(keycloakAdmin, never()).createUser(any(), any(), any(), any());
    }

    @Test
    void register_phoneCollisionAfterIdentityCreation_deletesTheNewIdentity() {
        when(keycloakAdmin.createUser("buyer@example.com", "Password1", "Buyer", "One"))
                .thenReturn("kc-new-buyer");
        doThrow(new PhoneAlreadyRegisteredException()).when(registerBuyerUseCase)
                .register(any());

        AuthController controller = new AuthController(keycloakAdmin, registerBuyerUseCase);

        assertThatThrownBy(() -> controller.register(new RegisterRequest(
                "buyer@example.com", "Password1", "Buyer", "One", "+84912345678")))
                .isInstanceOf(PhoneAlreadyRegisteredException.class);

        verify(keycloakAdmin).deleteUser("kc-new-buyer");
    }
}
