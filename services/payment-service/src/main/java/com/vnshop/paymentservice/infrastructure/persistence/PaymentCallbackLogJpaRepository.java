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
                : springDataRepository.findFirstByProviderAndEventIdAndSignatureHashAndProcessingStatusIn(provider, eventId, signatureHash, terminalStatuses);
        return eventMatch.or(() -> springDataRepository.findFirstByProviderAndPayloadHashAndSignatureHashAndProcessingStatusIn(provider, payloadHash, signatureHash, terminalStatuses))
                .map(PaymentCallbackLogJpaEntity::toAttempt);
    }

    @Override
    public PaymentCallbackAttempt save(PaymentCallbackAttempt attempt) {
        return springDataRepository.save(PaymentCallbackLogJpaEntity.fromAttempt(attempt)).toAttempt();
    }
}
