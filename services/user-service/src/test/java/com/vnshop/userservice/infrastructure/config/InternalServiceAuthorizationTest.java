package com.vnshop.userservice.infrastructure.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.vnshop.userservice.infrastructure.web.SellerController;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.access.prepost.PreAuthorize;

class InternalServiceAuthorizationTest {

    private final InternalServiceAuthorization authorization =
            new InternalServiceAuthorization("vnshop-api");

    @Test
    void configuredServiceAccountClientIsAuthorized() {
        assertThat(authorization.isAuthorized(jwtAuthentication("vnshop-api"))).isTrue();
    }

    @Test
    void differentClientIsRejectedEvenWhenAuthenticated() {
        assertThat(authorization.isAuthorized(jwtAuthentication("vnshop-web"))).isFalse();
    }

    @Test
    void missingClientClaimIsRejected() {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .claim("sub", "service-account")
                .build();

        assertThat(authorization.isAuthorized(new JwtAuthenticationToken(jwt))).isFalse();
    }

    @Test
    void nonJwtAuthenticationIsRejected() {
        assertThat(authorization.isAuthorized(new TestingAuthenticationToken("user", "password")))
                .isFalse();
    }

    @Test
    void destinationRouteUsesInternalServiceAuthorizationContract() throws NoSuchMethodException {
        PreAuthorize annotation = SellerController.class
                .getMethod("internalLookupDestination", String.class)
                .getAnnotation(PreAuthorize.class);

        assertThat(annotation).isNotNull();
        assertThat(annotation.value())
                .isEqualTo("@internalServiceAuthorization.isAuthorized(authentication)");
    }

    private static JwtAuthenticationToken jwtAuthentication(String clientId) {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .claim("azp", clientId)
                .claim("sub", "service-account-" + clientId)
                .claims(claims -> claims.putAll(Map.of("scope", "service")))
                .build();
        return new JwtAuthenticationToken(jwt);
    }
}
