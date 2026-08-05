package com.vnshop.userservice.infrastructure.web;

import com.vnshop.userservice.application.PhoneAlreadyRegisteredException;
import com.vnshop.userservice.application.RegisterBuyerUseCase;
import com.vnshop.userservice.infrastructure.keycloak.KeycloakAdminClient;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.springframework.http.MediaType.APPLICATION_JSON;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class ApiExceptionHandlerTest {

    @Test
    void duplicatePhoneReturnsStandardConflictEnvelope() throws Exception {
        KeycloakAdminClient keycloakAdmin = mock(KeycloakAdminClient.class);
        RegisterBuyerUseCase registerBuyerUseCase = mock(RegisterBuyerUseCase.class);
        doThrow(new PhoneAlreadyRegisteredException())
                .when(registerBuyerUseCase)
                .assertPhoneAvailable(any());

        MockMvc mvc = MockMvcBuilders
                .standaloneSetup(new AuthController(keycloakAdmin, registerBuyerUseCase))
                .setControllerAdvice(new ApiExceptionHandler())
                .build();

        mvc.perform(post("/auth/register")
                        .contentType(APPLICATION_JSON)
                        .content("""
                                {
                                  "email": "new@example.com",
                                  "password": "Password1",
                                  "firstName": "New",
                                  "lastName": "Buyer",
                                  "phone": "+84912345678"
                                }
                                """))
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith(APPLICATION_JSON))
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.errorCode").value("phone_taken"))
                .andExpect(jsonPath("$.message").value("An account with that phone number already exists"));

        verify(keycloakAdmin, never()).createUser(any(), any(), any(), any());
    }
}
