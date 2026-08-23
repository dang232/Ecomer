package com.vnshop.paymentservice.infrastructure.paypal;

public interface PayPalWebhookVerifier {
    PayPalWebhookVerificationResult verify(PayPalWebhookHeaders headers, String webhookId, String rawPayload);

    enum PayPalWebhookVerificationResult {
        VERIFIED,
        REJECTED,
        UNAVAILABLE
    }
}
