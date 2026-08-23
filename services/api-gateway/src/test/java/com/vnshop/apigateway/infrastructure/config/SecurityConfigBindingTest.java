package com.vnshop.apigateway.infrastructure.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Method;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.http.HttpCookie;
import org.springframework.security.web.server.util.matcher.ServerWebExchangeMatcher;

class SecurityConfigBindingTest {

    private final ApplicationContextRunner contextRunner = new ApplicationContextRunner()
            .withUserConfiguration(BindingConfiguration.class)
            .withPropertyValues(
                    "vnshop.gateway.public-buckets.avatar=avatars-runtime",
                    "vnshop.gateway.public-buckets.product=products-runtime",
                    "vnshop.gateway.public-buckets.review=reviews-runtime",
                    "vnshop.gateway.public-buckets.video=videos-runtime");

    @Test
    void springCreatedSecurityConfigUsesBoundCustomBuckets() {
        contextRunner.run(context -> {
            SecurityConfig securityConfig = context.getBean(SecurityConfig.class);
            Method method = SecurityConfig.class.getDeclaredMethod(
                    "requiresCsrfProtection", org.springframework.web.server.ServerWebExchange.class);
            method.setAccessible(true);
            var customObject = MockServerWebExchange.from(MockServerHttpRequest.put("/avatars-runtime/object")
                    .cookie(new HttpCookie("vnshop_rt", "refresh-token"))
                    .build());
            var defaultObject = MockServerWebExchange.from(MockServerHttpRequest.put("/vnshop-avatars/object")
                    .cookie(new HttpCookie("vnshop_rt", "refresh-token"))
                    .build());

            assertThat(context.getBean(PublicBucketProperties.class).avatar()).isEqualTo("avatars-runtime");
            assertThat(match(method, securityConfig, customObject).isMatch()).isFalse();
            assertThat(match(method, securityConfig, defaultObject).isMatch()).isTrue();
        });
    }

    private static ServerWebExchangeMatcher.MatchResult match(
            Method method,
            SecurityConfig securityConfig,
            org.springframework.web.server.ServerWebExchange exchange) throws ReflectiveOperationException {
        @SuppressWarnings("unchecked")
        var result = (reactor.core.publisher.Mono<ServerWebExchangeMatcher.MatchResult>) method.invoke(
                securityConfig, exchange);
        return result.block();
    }

    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(PublicBucketProperties.class)
    static class BindingConfiguration {
        @Bean
        SecurityConfig securityConfig(PublicBucketProperties publicBuckets) {
            return new SecurityConfig(publicBuckets);
        }
    }
}
