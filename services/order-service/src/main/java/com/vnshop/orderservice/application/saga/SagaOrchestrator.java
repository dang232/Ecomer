package com.vnshop.orderservice.application.saga;

import com.vnshop.orderservice.domain.port.out.OutboxPort;
import com.vnshop.orderservice.domain.port.out.SagaCompensationPublisherPort;
import com.vnshop.orderservice.domain.port.out.SagaStateRepository;
import com.vnshop.orderservice.domain.saga.SagaState;
import com.vnshop.orderservice.domain.saga.SagaStepStatus;
import com.vnshop.orderservice.domain.saga.SagaStatus;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.annotation.Propagation;

@Service
public class SagaOrchestrator {
    private static final Logger LOG = LoggerFactory.getLogger(SagaOrchestrator.class);
    private static final String AGGREGATE_TYPE = "SAGA";

    private final SagaStateRepository sagaStateRepository;
    private final OutboxPort outboxPort;
    private final SagaCompensationPublisherPort compensationPublisher;
    private final long compensationTimeoutMs;

    public SagaOrchestrator(
            SagaStateRepository sagaStateRepository,
            OutboxPort outboxPort,
            SagaCompensationPublisherPort compensationPublisher,
            @Value("${saga.compensation-timeout-ms:300000}") long compensationTimeoutMs
    ) {
        this.sagaStateRepository = sagaStateRepository;
        this.outboxPort = outboxPort;
        this.compensationPublisher = compensationPublisher;
        this.compensationTimeoutMs = compensationTimeoutMs;
    }

    @Transactional
    public SagaState startOrderSaga(String orderId) {
        String sagaId = UUID.randomUUID().toString();
        Instant now = Instant.now();
        SagaState sagaState = new SagaState(sagaId, orderId, SagaStatus.STARTED, now, now);
        SagaState saved = sagaStateRepository.save(sagaState);

        outboxPort.publish(AGGREGATE_TYPE, sagaId, "SAGA_STARTED",
            "{\"orderId\":\"" + orderId + "\",\"sagaId\":\"" + sagaId + "\",\"step\":\"INVENTORY_RESERVE\"}");

        LOG.info("Saga {} started for order {}", sagaId, orderId);
        return saved;
    }

    @Transactional
    public void onInventoryReserved(String sagaId) {
        Optional<SagaState> opt = sagaStateRepository.findBySagaId(sagaId);
        if (opt.isEmpty()) {
            LOG.warn("Saga {} not found for inventory reserved", sagaId);
            return;
        }
        SagaState current = opt.get();
        SagaState updated = new SagaState(current.sagaId(), current.orderId(), SagaStatus.INVENTORY_RESERVED, current.createdAt(), Instant.now(), current.requiredSteps());
        sagaStateRepository.save(updated);

        outboxPort.publish(AGGREGATE_TYPE, sagaId, "SAGA_STEP_COMPLETED",
            "{\"orderId\":\"" + current.orderId() + "\",\"sagaId\":\"" + sagaId + "\",\"step\":\"PAYMENT_CHARGE\"}");

        LOG.info("Saga {} step: INVENTORY_RESERVED -> PAYMENT_CHARGED", sagaId);
    }

    @Transactional
    public void onPaymentCharged(String sagaId) {
        Optional<SagaState> opt = sagaStateRepository.findBySagaId(sagaId);
        if (opt.isEmpty()) {
            LOG.warn("Saga {} not found for payment charged", sagaId);
            return;
        }
        SagaState current = opt.get();
        SagaState updated = new SagaState(current.sagaId(), current.orderId(), SagaStatus.PAYMENT_CHARGED, current.createdAt(), Instant.now(), current.requiredSteps());
        sagaStateRepository.save(updated);

        outboxPort.publish(AGGREGATE_TYPE, sagaId, "SAGA_STEP_COMPLETED",
            "{\"orderId\":\"" + current.orderId() + "\",\"sagaId\":\"" + sagaId + "\",\"step\":\"SHIPPING_CREATE\"}");

        LOG.info("Saga {} step: PAYMENT_CHARGED -> SHIPPING_CREATED", sagaId);
    }

    @Transactional
    public void onShippingCreated(String sagaId) {
        Optional<SagaState> opt = sagaStateRepository.findBySagaId(sagaId);
        if (opt.isEmpty()) {
            LOG.warn("Saga {} not found for shipping created", sagaId);
            return;
        }
        SagaState current = opt.get();
        SagaState updated = new SagaState(current.sagaId(), current.orderId(), SagaStatus.SHIPPING_CREATED, current.createdAt(), Instant.now(), current.requiredSteps());
        sagaStateRepository.save(updated);

        outboxPort.publish(AGGREGATE_TYPE, sagaId, "SAGA_COMPLETED",
            "{\"orderId\":\"" + current.orderId() + "\",\"sagaId\":\"" + sagaId + "\",\"step\":\"COMPLETE\"}");

        // Persist terminal COMPLETED state
        SagaState completed = new SagaState(current.sagaId(), current.orderId(), SagaStatus.COMPLETED, current.createdAt(), Instant.now(), current.requiredSteps());
        sagaStateRepository.save(completed);

        LOG.info("Saga {} completed for order {}", sagaId, current.orderId());
    }

    @Transactional
    public void compensate(String sagaId, String failedStep) {
        Optional<SagaState> opt = sagaStateRepository.findBySagaId(sagaId);
        if (opt.isEmpty()) {
            LOG.warn("Saga {} not found for compensation", sagaId);
            return;
        }
        SagaState current = opt.get();
        Map<String, SagaStepStatus> requiredSteps = SagaCompensationPolicy.requiredStepsFor(failedStep);
        SagaState compensating = new SagaState(current.sagaId(), current.orderId(),
            SagaStatus.COMPENSATING, current.createdAt(), Instant.now(), requiredSteps);
        sagaStateRepository.save(compensating);

        String orderId = current.orderId();
        outboxPort.publish("Order", orderId, "SAGA_COMPENSATING",
            "{\"sagaId\":\"" + sagaId + "\",\"orderId\":\"" + orderId + "\",\"failedStep\":\"" + failedStep + "\"}");

        switch (failedStep) {
            case "SHIPPING":
                // Payment was charged, inventory was reserved — reverse both
                compensationPublisher.publishPaymentRefundRequested(orderId, sagaId);
                compensationPublisher.publishInventoryReleaseRequested(orderId, sagaId);
                compensationPublisher.publishShippingCancellationRequested(
                        orderId, sagaId, "shipping-step-failed");
                break;
            case "PAYMENT":
            case "PAYMENT_CHARGE":
                // Only inventory was reserved — release it
                compensationPublisher.publishInventoryReleaseRequested(orderId, sagaId);
                break;
            case "INVENTORY":
                // Nothing to compensate — first step failed
                markFailed(sagaId, requiredSteps);
                break;
            default:
                LOG.error("Unknown saga step: {}", failedStep);
                markFailed(sagaId, requiredSteps);
        }
        LOG.warn("Saga {} compensation initiated at step: {}", sagaId, failedStep);
    }

    @Transactional
    public void onCompensationStepCompleted(String sagaId, String step) {
        LOG.info("Saga {} compensation step completed: {}", sagaId, step);
        onCompensationCompleted(sagaId, step);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void start(String sagaId, String orderId) {
        sagaStateRepository.save(new SagaState(sagaId, orderId, SagaStatus.STARTED, Instant.now(), null));
    }

    /**
     * Records the last successfully completed saga step so that {@link #getLastCompletedStep}
     * can return the correct failed-step name when compensation is needed.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void stepCompleted(String sagaId, String step) {
        sagaStateRepository.findBySagaId(sagaId).ifPresent(current -> {
            SagaStatus newStatus = switch (step) {
                case "INVENTORY" -> SagaStatus.INVENTORY_RESERVED;
                case "PAYMENT" -> SagaStatus.PAYMENT_CHARGED;
                case "SHIPPING" -> SagaStatus.SHIPPING_CREATED;
                default -> current.currentStep();
            };
            if (newStatus != current.currentStep()) {
                sagaStateRepository.save(new SagaState(
                    current.sagaId(), current.orderId(), newStatus, current.createdAt(), Instant.now(), current.requiredSteps()));
            }
        });
        LOG.debug("Saga {} step completed: {}", sagaId, step);
    }

    @Transactional
    public void complete(String sagaId) {
        sagaStateRepository.findBySagaId(sagaId).ifPresent(s -> {
            sagaStateRepository.save(new SagaState(s.sagaId(), s.orderId(),
                SagaStatus.COMPLETED, s.createdAt(), Instant.now(), s.requiredSteps()));
        });
    }

    /**
     * Returns the last step that completed successfully for the given saga, derived from
     * the persisted {@link SagaStatus}. Used by {@link com.vnshop.orderservice.application.CreateOrderUseCase}
     * to determine which compensation actions are needed.
     */
    public Optional<String> getLastCompletedStep(String sagaId) {
        return sagaStateRepository.findBySagaId(sagaId)
            .map(s -> switch (s.currentStep()) {
                case INVENTORY_RESERVED -> "INVENTORY";
                case PAYMENT_CHARGED -> "PAYMENT";
                case SHIPPING_CREATED -> "SHIPPING";
                default -> null;
            });
    }

    private void markFailed(String sagaId, Map<String, SagaStepStatus> requiredSteps) {
        sagaStateRepository.findBySagaId(sagaId).ifPresent(s -> {
            SagaState failed = new SagaState(s.sagaId(), s.orderId(),
                SagaStatus.FAILED, s.createdAt(), Instant.now(), requiredSteps);
            sagaStateRepository.save(failed);
        });
    }

    /**
     * Called when a downstream service confirms its compensation work has completed
     * (e.g. inventory release, payment refund, shipping cancellation). Promotes a
     * COMPENSATING saga directly to FAILED so listeners and dashboards see a real
     * terminal state without waiting for the timeout finalizer.
     */
    @Transactional
    public void onCompensationCompleted(String sagaId, String confirmingStep) {
        Optional<SagaState> opt = sagaStateRepository.findBySagaId(sagaId);
        if (opt.isEmpty()) {
            LOG.warn("Saga {} not found for compensation confirmation from {}", sagaId, confirmingStep);
            return;
        }
        SagaState current = opt.get();
        if (current.currentStep() != SagaStatus.COMPENSATING) {
            return;
        }

        String requiredStep = SagaCompensationPolicy.compensationStepName(confirmingStep);
        if (requiredStep == null || !current.requiredSteps().containsKey(requiredStep)) {
            LOG.warn("Ignoring compensation confirmation for non-required step {} in saga {}", confirmingStep, sagaId);
            return;
        }

        Map<String, SagaStepStatus> updatedSteps = new LinkedHashMap<>(current.requiredSteps());
        if (updatedSteps.get(requiredStep) != SagaStepStatus.COMPLETED) {
            updatedSteps.put(requiredStep, SagaStepStatus.COMPLETED);
            SagaState updated = new SagaState(current.sagaId(), current.orderId(), current.currentStep(),
                    current.createdAt(), Instant.now(), updatedSteps);
            sagaStateRepository.save(updated);
            current = updated;
        }
        if (SagaCompensationPolicy.allRequiredStepsCompleted(current.requiredSteps())) {
            markCompensationFailed(current, "COMPENSATION_CONFIRMED:" + confirmingStep);
        }
    }

    @Scheduled(fixedDelayString = "${saga.compensation-finalizer-interval-ms:60000}")
    @Transactional
    public void failTimedOutCompensations() {
        Instant cutoff = Instant.now().minusMillis(compensationTimeoutMs);
        for (SagaState saga : sagaStateRepository.findCompensatingUpdatedBefore(cutoff)) {
            Map<String, SagaStepStatus> timedOutSteps = new LinkedHashMap<>(saga.requiredSteps());
            timedOutSteps.replaceAll((step, status) -> status == SagaStepStatus.REQUESTED ? SagaStepStatus.TIMED_OUT : status);
            markCompensationFailed(new SagaState(saga.sagaId(), saga.orderId(), saga.currentStep(),
                    saga.createdAt(), saga.updatedAt(), timedOutSteps), "COMPENSATION_TIMEOUT");
        }
    }

    void markCompensationFailed(SagaState current, String reason) {
        if (current.currentStep() != SagaStatus.COMPENSATING) {
            return;
        }

        SagaState failed = new SagaState(current.sagaId(), current.orderId(), SagaStatus.FAILED,
                current.createdAt(), Instant.now(), current.requiredSteps());
        sagaStateRepository.save(failed);

        outboxPort.publish(AGGREGATE_TYPE, current.sagaId(), "SAGA_FAILED",
            "{\"orderId\":\"" + current.orderId() + "\",\"sagaId\":\"" + current.sagaId() + "\",\"reason\":\"" + reason + "\"}");

        LOG.error("Saga {} marked FAILED after compensation: {}", current.sagaId(), reason);
    }

}
