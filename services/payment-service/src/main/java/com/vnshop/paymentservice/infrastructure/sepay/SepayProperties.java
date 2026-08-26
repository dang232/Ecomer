package com.vnshop.paymentservice.infrastructure.sepay;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.ConstructorBinding;

/**
 * SePay polling configuration. {@code apiKey} is required when
 * {@link #enabled} is true — startup-validated in {@link SepayPoller} so a
 * misconfigured deploy fails fast instead of thrashing the API with 401s.
 *
 * <p>{@code accountId} is the bank account id registered with SePay (the
 * dashboard exposes it as a numeric id under each linked account).
 */
@ConfigurationProperties(prefix = "payment.sepay")
public record SepayProperties(
        boolean enabled,
        String apiKey,
        String accountId,
        String baseUrl,
        long pollIntervalSeconds,
        /** Shared secret sent by SePay in the {@code Authorization: Apikey <secret>} header on push callbacks. */
        String webhookSecret,
        String overpaymentPolicy) {
    public SepayProperties(boolean enabled, String apiKey, String accountId, String baseUrl,
                           long pollIntervalSeconds, String webhookSecret) {
        this(enabled, apiKey, accountId, baseUrl, pollIntervalSeconds, webhookSecret, "HOLD");
    }

    @ConstructorBinding
    public SepayProperties {
        if (baseUrl == null || baseUrl.isBlank()) {
            throw new IllegalStateException("payment.sepay.base-url must be configured");
        }
        if (pollIntervalSeconds <= 0) {
            throw new IllegalStateException("payment.sepay.poll-interval-seconds must be positive");
        }
        if (overpaymentPolicy == null || overpaymentPolicy.isBlank()) {
            throw new IllegalStateException("payment.sepay.overpayment-policy must be configured");
        }
    }
}
