package com.vnshop.paymentservice.infrastructure.fx;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.math.BigDecimal;
import java.time.Duration;

/**
 * FX adapter configuration. Defaults match the spec:
 * Frankfurter ECB-sourced rates, 24h cache, 25500 VND/USD fallback.
 *
 * <p>Bound from {@code payment.fx.*} (see application.yml). The fallback rate
 * is applied any time the upstream lookup fails — and the adapter logs a WARN
 * on every fallback hit so an outage doesn't ship as a stale-rate slow leak.
 */
@ConfigurationProperties(prefix = "payment.fx")
public record FxProperties(
        String baseUrl,
        Duration cacheTtl,
        int cacheMaxEntries,
        BigDecimal fallbackUsdToVnd) {
    public FxProperties {
        if (baseUrl == null || baseUrl.isBlank()) {
            throw new IllegalStateException("payment.fx.base-url must be configured");
        }
        if (cacheTtl == null || cacheTtl.isNegative() || cacheTtl.isZero()) {
            throw new IllegalStateException("payment.fx.cache-ttl must be positive");
        }
        if (cacheMaxEntries <= 0) {
            throw new IllegalStateException("payment.fx.cache-max-entries must be positive");
        }
        if (fallbackUsdToVnd == null || fallbackUsdToVnd.signum() <= 0) {
            throw new IllegalStateException("payment.fx.fallback-usd-to-vnd must be positive");
        }
    }
}
