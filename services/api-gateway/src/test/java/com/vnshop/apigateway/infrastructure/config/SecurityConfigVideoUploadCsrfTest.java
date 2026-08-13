package com.vnshop.apigateway.infrastructure.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Method;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpCookie;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.security.web.server.util.matcher.ServerWebExchangeMatcher;

class SecurityConfigVideoUploadCsrfTest {

    @Test
    void tusUploadBoundaryDoesNotRequireCsrfWhenARefreshCookieIsPresent() throws Exception {
        ServerWebExchangeMatcher matcher = csrfMatcher();

        assertThat(matcher.matches(exchange(HttpMethod.POST, "/videos/upload")).block().isMatch()).isFalse();
        assertThat(matcher.matches(exchange(HttpMethod.POST, "/videos/upload/00000000-0000-0000-0000-000000000001"))
                .block().isMatch()).isFalse();
        assertThat(matcher.matches(exchange(HttpMethod.PATCH, "/videos/upload/00000000-0000-0000-0000-000000000001"))
                .block().isMatch()).isFalse();
    }

    @Test
    void unrelatedStateChangingRequestsStillRequireCsrfWhenARefreshCookieIsPresent() throws Exception {
        ServerWebExchangeMatcher matcher = csrfMatcher();

        var exchange = exchange(HttpMethod.POST, "/sellers/me/products");

        assertThat(matcher.matches(exchange).block().isMatch()).isTrue();
    }

    @Test
    void proxiedKeycloakStateChangingRequestsDoNotRequireApplicationCsrf() throws Exception {
        ServerWebExchangeMatcher matcher = csrfMatcher();

        assertThat(matcher.matches(exchange(HttpMethod.POST, "/realms/vnshop/protocol/openid-connect/token"))
                .block().isMatch()).isFalse();
    }

    @SuppressWarnings("unchecked")
    private static ServerWebExchangeMatcher csrfMatcher() throws Exception {
        Method method = SecurityConfig.class.getDeclaredMethod("requiresCsrfProtection", org.springframework.web.server.ServerWebExchange.class);
        method.setAccessible(true);
        return exchange -> {
            try {
                return (reactor.core.publisher.Mono<ServerWebExchangeMatcher.MatchResult>) method.invoke(
                        new SecurityConfig(), exchange);
            } catch (ReflectiveOperationException exception) {
                return reactor.core.publisher.Mono.error(exception);
            }
        };
    }

    private static org.springframework.web.server.ServerWebExchange exchange(HttpMethod method, String path) {
        return MockServerWebExchange.from(
                MockServerHttpRequest.method(method, path)
                        .cookie(new HttpCookie("vnshop_rt", "refresh-token"))
                        .build());
    }
}
