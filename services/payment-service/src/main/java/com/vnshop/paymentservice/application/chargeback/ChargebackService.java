package com.vnshop.paymentservice.application.chargeback;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.paymentservice.domain.FinancialEventOutboxRecord;
import com.vnshop.paymentservice.domain.Chargeback;
import com.vnshop.paymentservice.domain.port.out.ChargebackRepositoryPort;
import com.vnshop.paymentservice.domain.port.out.FinancialEventOutboxPort;
import org.springframework.beans.factory.annotation.Autowired;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.math.BigDecimal;
import java.util.UUID;

/**
 * Core chargeback lifecycle: create on provider webhook, accept or submit
 * counter-evidence via admin API. Publishes {@code payment.chargeback.created}
 * so order-service can flip the order to DISPUTED.
 */
@Service
public class ChargebackService {

    static final String TOPIC = "payment.chargeback.created";
    static final String RESOLVED_TOPIC = "payment.chargeback.resolved";
    private static final Logger log = LoggerFactory.getLogger(ChargebackService.class);

    private final ChargebackRepositoryPort repository;
    private final ObjectProvider<KafkaTemplate<String, Object>> kafkaTemplateProvider;
    private final FinancialEventOutboxPort financialEventOutbox;
    private final ObjectMapper objectMapper;

    public ChargebackService(ChargebackRepositoryPort repository,
                             ObjectProvider<KafkaTemplate<String, Object>> kafkaTemplateProvider) {
        this(repository, kafkaTemplateProvider, null, null);
    }

    @Autowired
    public ChargebackService(ChargebackRepositoryPort repository,
                             ObjectProvider<KafkaTemplate<String, Object>> kafkaTemplateProvider,
                             FinancialEventOutboxPort financialEventOutbox,
                             ObjectMapper objectMapper) {
        this.repository = repository;
        this.kafkaTemplateProvider = kafkaTemplateProvider;
        this.financialEventOutbox = financialEventOutbox;
        this.objectMapper = objectMapper;
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
        return createFromWebhook(orderId, externalChargebackId, provider, reason, dueDate, null, "VND", null);
    }

    @Transactional
    public Chargeback createFromWebhook(String orderId,
                                        String externalChargebackId,
                                        Chargeback.ChargebackProvider provider,
                                        String reason,
                                        LocalDate dueDate,
                                        BigDecimal challengedAmount,
                                        String currency,
                                        String providerPaymentId) {
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
                challengedAmount,
                currency == null ? "VND" : currency.toUpperCase(java.util.Locale.ROOT),
                providerPaymentId,
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
        return resolve(chargebackId, Chargeback.ChargebackStatus.ACCEPTED);
    }

    @Transactional
    public Chargeback resolve(UUID chargebackId, Chargeback.ChargebackStatus outcome) {
        if (outcome != Chargeback.ChargebackStatus.WON
                && outcome != Chargeback.ChargebackStatus.LOST
                && outcome != Chargeback.ChargebackStatus.ACCEPTED) {
            throw new IllegalArgumentException("chargeback outcome must be WON, LOST, or ACCEPTED");
        }
        Chargeback cb = findOrThrow(chargebackId);
        if (cb.status() == outcome) return cb;
        if (cb.status() != Chargeback.ChargebackStatus.OPEN) {
            throw new IllegalStateException("chargeback is already resolved");
        }
        Chargeback updated = repository.save(cb.withStatus(outcome));
        publishResolved(updated);
        log.info("chargeback-resolved id={} outcome={}", chargebackId, outcome);
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

    private void publishResolved(Chargeback cb) {
        if (financialEventOutbox != null && objectMapper != null) {
            try {
                String payload = objectMapper.writeValueAsString(ChargebackResolvedEvent.from(cb));
                financialEventOutbox.save(FinancialEventOutboxRecord.pending(
                        UUID.randomUUID(), "CHARGEBACK_RESOLVED", cb.orderId(), payload));
                return;
            } catch (JsonProcessingException exception) {
                throw new IllegalStateException("failed to serialize chargeback resolution", exception);
            }
        }
        KafkaTemplate<String, Object> kafka = kafkaTemplateProvider.getIfAvailable();
        if (kafka != null) kafka.send(RESOLVED_TOPIC, cb.orderId(), ChargebackResolvedEvent.from(cb));
    }
}
