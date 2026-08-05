package com.vnshop.userservice.infrastructure.web;

import com.vnshop.userservice.application.RegisterBuyerCommand;
import com.vnshop.userservice.application.RegisterBuyerUseCase;
import com.vnshop.userservice.infrastructure.keycloak.KeycloakAdminClient;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthControllerRegistrationTest {

    @Mock
    private KeycloakAdminClient keycloakAdmin;

    @Mock
    private RegisterBuyerUseCase registerBuyerUseCase;

    @Test
    void register_persistsTheSubmittedEmailOnTheBuyerProfile() {
        when(keycloakAdmin.createUser("buyer@example.com", "Password1", "Buyer", "One"))
                .thenReturn("kc-buyer");
        AuthController controller = new AuthController(keycloakAdmin, registerBuyerUseCase);

        ApiResponse<RegisterResponse> response = controller.register(
                new RegisterRequest("buyer@example.com", "Password1", "Buyer", "One", null));

        ArgumentCaptor<RegisterBuyerCommand> command = ArgumentCaptor.forClass(RegisterBuyerCommand.class);
        verify(registerBuyerUseCase).register(command.capture());
        assertThat(command.getValue().keycloakId()).isEqualTo("kc-buyer");
        assertThat(command.getValue().email()).isEqualTo("buyer@example.com");
        assertThat(response.data().email()).isEqualTo("buyer@example.com");
    }
}
