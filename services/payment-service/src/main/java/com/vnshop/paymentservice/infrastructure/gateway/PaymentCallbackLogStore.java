package com.vnshop.paymentservice.infrastructure.gateway;

import java.util.Optional;

public interface PaymentCallbackLogStore {
    Optional<PaymentCallbackAttempt> findProcessed(String provider, String eventId, String payloadHash, String signatureHash);

    default boolean claim(PaymentCallbackAttempt attempt) {
        save(attempt);
        return true;
    }

    PaymentCallbackAttempt save(PaymentCallbackAttempt attempt);
}
