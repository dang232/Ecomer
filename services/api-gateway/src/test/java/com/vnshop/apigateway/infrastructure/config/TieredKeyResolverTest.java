package com.vnshop.apigateway.infrastructure.config;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import reactor.test.StepVerifier;

import java.time.Instant;
import java.util.List;
import java.util.Map;

class TieredKeyResolverTest {

    private final TieredKeyResolver resolver = new TieredKeyResolver();

    @Test
    void anonymous_request_resolves_to_anon_prefix_plus_remote_address() {
        MockServerHttpRequest request = MockServerHttpRequest
            .get("/payment/create")
            .remoteAddress(new java.net.InetSocketAddress("203.0.113.5", 54321))
            .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        StepVerifier.create(resolver.resolve(exchange))
            .expectNext("anon:203.0.113.5")
            .verifyComplete();
    }

    @Test
    void anonymous_request_uses_remote_address_ignoring_x_forwarded_for() {
        MockServerHttpRequest request = MockServerHttpRequest
            .get("/payment/create")
            .header("X-Forwarded-For", "198.51.100.7, 10.0.0.1")
            .remoteAddress(new java.net.InetSocketAddress("10.0.0.1", 54321))
            .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        StepVerifier.create(resolver.resolve(exchange))
            .expectNext("anon:10.0.0.1")
            .verifyComplete();
    }

    @Test
    void trusted_proxy_request_uses_first_forwarded_address() {
        TieredKeyResolver trustedResolver = new TieredKeyResolver("10.0.0.0/8");
        MockServerHttpRequest request = MockServerHttpRequest
            .get("/payment/create")
            .header("X-Forwarded-For", "198.51.100.7, 10.0.0.2")
            .remoteAddress(new java.net.InetSocketAddress("10.0.0.1", 54321))
            .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        StepVerifier.create(trustedResolver.resolve(exchange))
            .expectNext("anon:198.51.100.7")
            .verifyComplete();
    }

    @Test
    void configured_forwarded_headers_are_ignored_from_untrusted_peer() {
        TieredKeyResolver trustedResolver = new TieredKeyResolver("10.0.0.0/8");
        MockServerHttpRequest request = MockServerHttpRequest
            .get("/payment/create")
            .header("X-Forwarded-For", "198.51.100.7")
            .remoteAddress(new java.net.InetSocketAddress("203.0.113.5", 54321))
            .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        StepVerifier.create(trustedResolver.resolve(exchange))
            .expectNext("anon:203.0.113.5")
            .verifyComplete();
    }

    @Test
    void authenticated_request_resolves_to_user_prefix_plus_subject() {
        Jwt jwt = Jwt.withTokenValue("token")
            .header("alg", "RS256")
            .subject("user-uuid-abc")
            .issuedAt(Instant.now())
            .expiresAt(Instant.now().plusSeconds(300))
            .claims(c -> c.put("realm_access", Map.of("roles", List.of("ROLE_BUYER"))))
            .build();
        JwtAuthenticationToken auth = new JwtAuthenticationToken(
            jwt, List.of(new SimpleGrantedAuthority("ROLE_BUYER")), "user-uuid-abc");

        MockServerHttpRequest request = MockServerHttpRequest
            .get("/payment/create")
            .remoteAddress(new java.net.InetSocketAddress("203.0.113.5", 54321))
            .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        StepVerifier.create(
                resolver.resolve(exchange)
                    .contextWrite(ReactiveSecurityContextHolder.withAuthentication(auth))
            )
            .expectNext("user:user-uuid-abc")
            .verifyComplete();
    }

    @Test
    void two_authenticated_users_behind_same_ip_get_distinct_keys() {
        Jwt jwtAlice = Jwt.withTokenValue("token-alice")
            .header("alg", "RS256")
            .subject("alice-uuid")
            .issuedAt(Instant.now())
            .expiresAt(Instant.now().plusSeconds(300))
            .build();
        Jwt jwtBob = Jwt.withTokenValue("token-bob")
            .header("alg", "RS256")
            .subject("bob-uuid")
            .issuedAt(Instant.now())
            .expiresAt(Instant.now().plusSeconds(300))
            .build();

        JwtAuthenticationToken alice = new JwtAuthenticationToken(jwtAlice, List.of(), "alice-uuid");
        JwtAuthenticationToken bob = new JwtAuthenticationToken(jwtBob, List.of(), "bob-uuid");

        MockServerHttpRequest request = MockServerHttpRequest
            .get("/auth/login")
            .header("X-Forwarded-For", "100.64.0.1") // shared CGNAT IP
            .build();

        StepVerifier.create(
                resolver.resolve(MockServerWebExchange.from(request))
                    .contextWrite(ReactiveSecurityContextHolder.withAuthentication(alice))
            )
            .expectNext("user:alice-uuid")
            .verifyComplete();

        StepVerifier.create(
                resolver.resolve(MockServerWebExchange.from(request))
                    .contextWrite(ReactiveSecurityContextHolder.withAuthentication(bob))
            )
            .expectNext("user:bob-uuid")
            .verifyComplete();
    }
}
