package com.vnshop.paymentservice.application.chargeback;

import com.vnshop.paymentservice.domain.Chargeback;
import com.vnshop.paymentservice.domain.port.out.ChargebackRepositoryPort;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * Core chargeback lifecycle: create on provider webhook, accept or submit
 * counter-evidence via admin API. Publishes {@code payment.chargeback.created}
 * so order-service can flip the order to DISPUTED.
 */
@Service
public class ChargebackService {

    static final String TOPIC = "payment.chargeback.created";
    private static final Logger log = LoggerFactory.getLogger(ChargebackService.class);

    private final ChargebackRepositoryPort repository;
    private final ObjectProvider<KafkaTemplate<String, Object>> kafkaTemplateProvider;

    public ChargebackService(ChargebackRepositoryPort repository,
                             ObjectProvider<KafkaTemplate<String, Object>> kafkaTemplateProvider) {
        this.repository = repository;
        this.kafkaTemplateProvider = kafkaTemplateProvider;
    }

    /**
     * Idempotently create a chargeback from a provider webhook. If the
     * {@code externalChargebackId} already exists the call is a no-op (returns
     * the string "duplicate") so replayed webhooks don't double-fire Kafka.
     */
    @Transactional
    public Chargeback createFromWebhook(String orderId,
                                        String externalChargebackId,
                                        Chargeback.ChargebackProvider provider,
                                        String reason,
                                        LocalDate dueDate) {
        if (repository.existsByExternalChargebackId(externalChargebackId)) {
            log.info("chargeback-duplicate externalId={}", externalChargebackId);
            return null;
        }

        Chargeback cb = new Chargeback(
                UUID.randomUUID(),
                orderId,
                externalChargebackId,
                provider,
                reason,
                Chargeback.ChargebackStatus.OPEN,
                null,
                dueDate,
                Instant.now(),
                Instant.now());

        Chargeback saved = repository.save(cb);
        publishCreated(saved);
        log.info("chargeback-created id={} orderId={} provider={}", saved.id(), orderId, provider);
        return saved;
    }

    /**
     * Admin: submit counter-evidence JSON for an open chargeback.
     */
    @Transactional
    public Chargeback submitCounterEvidence(UUID chargebackId, String evidenceJson) {
        Chargeback cb = findOrThrow(chargebackId);
        Chargeback updated = repository.save(cb.withEvidence(evidenceJson));
        log.info("chargeback-evidence-submitted id={}", chargebackId);
        return updated;
    }

    /**
     * Admin: accept the chargeback (concede, mark as ACCEPTED).
     */
    @Transactional
    public Chargeback accept(UUID chargebackId) {
        Chargeback cb = findOrThrow(chargebackId);
        Chargeback updated = repository.save(cb.withStatus(Chargeback.ChargebackStatus.ACCEPTED));
        log.info("chargeback-accepted id={}", chargebackId);
        return updated;
    }

    private Chargeback findOrThrow(UUID id) {
        return repository.findById(id)
                .orElseThrow(() -> new ChargebackNotFoundException(id));
    }

    private void publishCreated(Chargeback cb) {
        KafkaTemplate<String, Object> kafka = kafkaTemplateProvider.getIfAvailable();
        if (kafka == null) {
            log.warn("chargeback-kafka-unavailable — order DISPUTED status will not be set for orderId={}", cb.orderId());
            return;
        }
        kafka.send(TOPIC, cb.orderId(), ChargebackCreatedEvent.from(cb));
    }
}
