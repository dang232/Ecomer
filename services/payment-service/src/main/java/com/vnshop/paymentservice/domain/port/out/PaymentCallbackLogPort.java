package com.vnshop.paymentservice.domain.port.out;

import com.vnshop.paymentservice.domain.PaymentCallbackLogEntry;

import java.util.Optional;

public interface PaymentCallbackLogPort {
    Optional<PaymentCallbackLogEntry> findProcessed(
            String provider, String eventId, String payloadHash, String signatureHash);

    PaymentCallbackLogEntry save(PaymentCallbackLogEntry entry);
}
