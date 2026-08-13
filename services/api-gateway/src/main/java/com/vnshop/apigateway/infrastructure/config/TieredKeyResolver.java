package com.vnshop.apigateway.infrastructure.config;

import org.springframework.cloud.gateway.filter.ratelimit.KeyResolver;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.net.InetSocketAddress;
import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Arrays;
import java.util.List;

/**
 * Resolves a rate-limit key from the incoming exchange.
 *
 * <p>If the request carries a validated JWT (already verified by the Spring
 * Security resource-server filter upstream), the key is {@code "user:<sub>"}
 * so that each authenticated user gets an independent bucket regardless of
 * their source IP.  This prevents CGNAT from conflating multiple users behind
 * a shared IP into one bucket.
 *
 * <p>Anonymous requests (no valid JWT) fall back to
 * {@code "anon:<client-ip>"}.  Forwarded headers are used only when explicitly
 * enabled and the direct peer is a private address controlled by the platform.
 */
public class TieredKeyResolver implements KeyResolver {

    static final String USER_PREFIX = "user:";
    static final String ANON_PREFIX = "anon:";

    private final List<Cidr> trustedProxyCidrs;

    public TieredKeyResolver() {
        this("");
    }

    TieredKeyResolver(String trustedProxyCidrs) {
        this.trustedProxyCidrs = Arrays.stream(trustedProxyCidrs.split(","))
                .map(String::trim)
                .filter(value -> !value.isEmpty())
                .map(Cidr::parse)
                .toList();
    }

    @Override
    public Mono<String> resolve(ServerWebExchange exchange) {
        return ReactiveSecurityContextHolder.getContext()
            .flatMap(ctx -> {
                var auth = ctx.getAuthentication();
                if (auth instanceof JwtAuthenticationToken jwtAuth
                        && Boolean.TRUE.equals(auth.isAuthenticated())
                        && !(auth instanceof AnonymousAuthenticationToken)) {
                    String sub = jwtAuth.getToken().getSubject();
                    if (sub != null && !sub.isBlank()) {
                        return Mono.just(USER_PREFIX + sub);
                    }
                }
                return Mono.empty();
            })
            .switchIfEmpty(Mono.fromCallable(() -> ANON_PREFIX + resolveClientIp(exchange)));
    }

    private String resolveClientIp(ServerWebExchange exchange) {
        InetSocketAddress remote = exchange.getRequest().getRemoteAddress();
        String remoteAddress = remote != null && remote.getAddress() != null
                ? remote.getAddress().getHostAddress() : "unknown";
        if (!trustedProxyCidrs.stream().anyMatch(cidr -> cidr.matches(remoteAddress))) {
            return remoteAddress;
        }
        String forwarded = exchange.getRequest().getHeaders().getFirst("X-Forwarded-For");
        if (forwarded == null || forwarded.isBlank()) return remoteAddress;
        String clientAddress = forwarded.split(",", 2)[0].trim();
        return clientAddress.isBlank() ? remoteAddress : clientAddress;
    }

    private record Cidr(byte[] network, int prefixLength) {
        private static Cidr parse(String value) {
            String[] parts = value.split("/", 2);
            try {
                InetAddress address = InetAddress.getByName(parts[0]);
                int prefixLength = parts.length == 2
                        ? Integer.parseInt(parts[1]) : address.getAddress().length * 8;
                if (prefixLength < 0 || prefixLength > address.getAddress().length * 8) {
                    throw new IllegalArgumentException("invalid trusted proxy CIDR: " + value);
                }
                return new Cidr(address.getAddress(), prefixLength);
            } catch (UnknownHostException | NumberFormatException exception) {
                throw new IllegalArgumentException("invalid trusted proxy CIDR: " + value, exception);
            }
        }

        private boolean matches(String value) {
            try {
                byte[] candidate = InetAddress.getByName(value).getAddress();
                if (candidate.length != network.length) return false;
                int fullBytes = prefixLength / 8;
                int remainingBits = prefixLength % 8;
                if (!Arrays.equals(candidate, 0, fullBytes, network, 0, fullBytes)) return false;
                if (remainingBits == 0) return true;
                int mask = 0xFF << (8 - remainingBits);
                return (candidate[fullBytes] & mask) == (network[fullBytes] & mask);
            } catch (UnknownHostException exception) {
                return false;
            }
        }
    }
}
