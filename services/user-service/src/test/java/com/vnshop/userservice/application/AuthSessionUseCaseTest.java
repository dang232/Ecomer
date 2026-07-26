package com.vnshop.userservice.application;

import com.vnshop.userservice.domain.port.out.KeycloakTokenPort;
import com.vnshop.userservice.domain.port.out.KeycloakTokenPort.TokenSet;
import com.vnshop.userservice.infrastructure.keycloak.KeycloakAdminException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthSessionUseCaseTest {

    @Mock
    private KeycloakTokenPort tokenClient;

    private AuthSessionUseCase useCase;

    private static final TokenSet TOKENS = new TokenSet("access", "refresh", 300, 1800);

    @BeforeEach
    void setUp() {
        useCase = new AuthSessionUseCase(tokenClient);
    }

    // --- login ---

    @Test
    void login_delegatesToPasswordGrant() {
        when(tokenClient.passwordGrant("user", "pass")).thenReturn(TOKENS);

        TokenSet result = useCase.login("user", "pass");

        assertThat(result).isEqualTo(TOKENS);
        verify(tokenClient).passwordGrant("user", "pass");
    }

    // --- refresh ---

    @Test
    void refresh_nullToken_throwsNoSessionException() {
        assertThatThrownBy(() -> useCase.refresh(null))
                .isInstanceOf(NoSessionException.class);
        verify(tokenClient, never()).refresh(null);
    }

    @Test
    void refresh_blankToken_throwsNoSessionException() {
        assertThatThrownBy(() -> useCase.refresh("   "))
                .isInstanceOf(NoSessionException.class);
    }

    @Test
    void refresh_validToken_returnsNewTokenSet() {
        when(tokenClient.refresh("refresh")).thenReturn(TOKENS);

        TokenSet result = useCase.refresh("refresh");

        assertThat(result).isEqualTo(TOKENS);
    }

    @Test
    void refresh_keycloakRejects_throwsRefreshTokenRejectedException() {
        when(tokenClient.refresh("bad")).thenThrow(new KeycloakAdminException(401, "invalid_grant", "Token expired"));

        assertThatThrownBy(() -> useCase.refresh("bad"))
                .isInstanceOf(RefreshTokenRejectedException.class)
                .hasCauseInstanceOf(KeycloakAdminException.class);
    }

    // --- logout ---

    @Test
    void logout_nullToken_doesNotCallRevoke() {
        useCase.logout(null);

        verify(tokenClient, never()).revoke(null);
    }

    @Test
    void logout_blankToken_doesNotCallRevoke() {
        useCase.logout("  ");

        verify(tokenClient, never()).revoke("  ");
    }

    @Test
    void logout_validToken_callsRevoke() {
        useCase.logout("refresh");

        verify(tokenClient).revoke("refresh");
    }

    @Test
    void logout_revokeThrows_swallowsException() {
        doThrow(new KeycloakAdminException(500, "error", "KC down")).when(tokenClient).revoke("refresh");

        // must not propagate
        useCase.logout("refresh");
    }
}
