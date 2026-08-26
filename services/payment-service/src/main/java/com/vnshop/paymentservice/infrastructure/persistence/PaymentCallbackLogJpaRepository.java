package com.vnshop.paymentservice.infrastructure.persistence;

import com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackAttempt;
import com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackLogStore;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public class PaymentCallbackLogJpaRepository implements PaymentCallbackLogStore {
    private final PaymentCallbackLogSpringDataRepository springDataRepository;

    public PaymentCallbackLogJpaRepository(PaymentCallbackLogSpringDataRepository springDataRepository) {
        this.springDataRepository = springDataRepository;
    }

    @Override
    public Optional<PaymentCallbackAttempt> findProcessed(String provider, String eventId, String payloadHash, String signatureHash) {
        List<String> terminalStatuses = List.of("PROCESSED", "FAILED", "IGNORED");
        Optional<PaymentCallbackLogJpaEntity> eventMatch = eventId == null || eventId.isBlank()
                ? Optional.empty()
                : springDataRepository.findFirstByProviderAndEventIdAndPayloadHashAndSignatureHashAndProcessingStatusIn(provider, eventId, payloadHash, signatureHash, terminalStatuses);
        return eventMatch.or(() -> springDataRepository.findFirstByProviderAndPayloadHashAndSignatureHashAndProcessingStatusIn(provider, payloadHash, signatureHash, terminalStatuses))
                .map(PaymentCallbackLogJpaEntity::toAttempt);
    }

    @Override
    @org.springframework.transaction.annotation.Transactional
    public boolean claim(PaymentCallbackAttempt attempt) {
        return springDataRepository.claim(
                attempt.callbackId(), attempt.provider(), attempt.eventId(), attempt.payloadHash(),
                attempt.signatureHash(), attempt.headersJson(), attempt.bodyJson(), attempt.receivedAt(),
                attempt.processingStatus(), attempt.duplicateReplay()) == 1;
    }

    @Override
    public PaymentCallbackAttempt save(PaymentCallbackAttempt attempt) {
        return springDataRepository.save(PaymentCallbackLogJpaEntity.fromAttempt(attempt)).toAttempt();
    }
}
