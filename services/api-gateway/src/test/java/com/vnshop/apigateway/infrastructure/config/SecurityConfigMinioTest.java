package com.vnshop.apigateway.infrastructure.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Method;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpCookie;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.security.web.server.util.matcher.ServerWebExchangeMatcher;

class SecurityConfigMinioTest {
    @Test
    void cookieAuthenticatedPutToPublicObjectsIsNotCsrfProtected() throws Exception {
        Method method = SecurityConfig.class.getDeclaredMethod("requiresCsrfProtection", org.springframework.web.server.ServerWebExchange.class);
        method.setAccessible(true);
        for (String prefix : List.of("vnshop-avatars", "vnshop-products", "vnshop-reviews", "vnshop-videos")) {
            var exchange = MockServerWebExchange.from(MockServerHttpRequest.method(HttpMethod.PUT, "/" + prefix + "/u/a.jpg")
                    .cookie(new HttpCookie("vnshop_rt", "refresh-token"))
                    .build());
            assertThat(((reactor.core.publisher.Mono<ServerWebExchangeMatcher.MatchResult>) method.invoke(new SecurityConfig(), exchange))
                    .block().isMatch()).isFalse();
        }
    }

    @Test
    void cookieAuthenticatedPutToProtectedEndpointRequiresCsrf() throws Exception {
        Method method = SecurityConfig.class.getDeclaredMethod("requiresCsrfProtection", org.springframework.web.server.ServerWebExchange.class);
        method.setAccessible(true);
        var exchange = MockServerWebExchange.from(MockServerHttpRequest.put("/sellers/me/products")
                .cookie(new HttpCookie("vnshop_rt", "refresh-token"))
                .build());

        assertThat(((reactor.core.publisher.Mono<ServerWebExchangeMatcher.MatchResult>) method.invoke(new SecurityConfig(), exchange))
                .block().isMatch()).isTrue();
    }
}
