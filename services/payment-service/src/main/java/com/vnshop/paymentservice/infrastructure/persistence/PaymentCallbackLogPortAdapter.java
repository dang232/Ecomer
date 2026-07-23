package com.vnshop.paymentservice.infrastructure.persistence;

import com.vnshop.paymentservice.domain.PaymentCallbackLogEntry;
import com.vnshop.paymentservice.domain.port.out.PaymentCallbackLogPort;
import com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackAttempt;
import com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackLogStore;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public class PaymentCallbackLogPortAdapter implements PaymentCallbackLogPort {
    private final PaymentCallbackLogStore callbackLogStore;

    public PaymentCallbackLogPortAdapter(PaymentCallbackLogStore callbackLogStore) {
        this.callbackLogStore = callbackLogStore;
    }

    @Override
    public Optional<PaymentCallbackLogEntry> findProcessed(
            String provider, String eventId, String payloadHash, String signatureHash) {
        return callbackLogStore.findProcessed(provider, eventId, payloadHash, signatureHash)
                .map(PaymentCallbackLogPortAdapter::toDomain);
    }

    @Override
    public PaymentCallbackLogEntry save(PaymentCallbackLogEntry entry) {
        return toDomain(callbackLogStore.save(new PaymentCallbackAttempt(
                entry.callbackId(), entry.provider(), entry.eventId(), entry.payloadHash(),
                entry.signatureHash(), entry.headersJson(), entry.bodyJson(), entry.receivedAt(),
                entry.processingStatus(), entry.duplicateReplay())));
    }

    private static PaymentCallbackLogEntry toDomain(PaymentCallbackAttempt attempt) {
        return new PaymentCallbackLogEntry(
                attempt.callbackId(), attempt.provider(), attempt.eventId(), attempt.payloadHash(),
                attempt.signatureHash(), attempt.headersJson(), attempt.bodyJson(), attempt.receivedAt(),
                attempt.processingStatus(), attempt.duplicateReplay());
    }
}
