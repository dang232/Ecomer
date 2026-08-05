package com.vnshop.paymentservice.infrastructure.gateway;

import com.vnshop.paymentservice.domain.PaymentCallbackOutboxRecord;
import com.vnshop.paymentservice.domain.port.out.PaymentCallbackOutbox;
import com.vnshop.paymentservice.application.PaymentPromotionService;
import com.vnshop.paymentservice.domain.JournalEntry;
import com.vnshop.paymentservice.domain.LedgerEntry;
import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.paymentservice.domain.PaymentMethod;
import com.vnshop.paymentservice.domain.PaymentStatus;
import com.vnshop.paymentservice.domain.port.out.LedgerRepositoryPort;
import com.vnshop.paymentservice.domain.port.out.PaymentRepositoryPort;
import com.vnshop.paymentservice.application.ledger.LedgerService;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class MomoCallbackServiceTest {
    private static final MomoProperties PROPERTIES = new MomoProperties(
            "https://test-payment.momo.vn/v2/gateway/api/create",
            "https://test-payment.momo.vn/v2/gateway/api/query",
            "MOMOTEST",
            "access-key",
            "secret-key",
            "https://shop.example/payment/momo/return",
            "https://shop.example/payment/momo/ipn",
            "captureWallet",
            "vi"
    );

    @Test
    void ipnUpdatesPendingMomoPaymentAndRecordsLedgerAfterValidSignature() {
        CapturingPaymentRepository repository = new CapturingPaymentRepository(payment(PaymentStatus.PENDING, null));
        CapturingLedgerRepository ledgerRepository = new CapturingLedgerRepository();
        CapturingCallbackLogStore callbackLogStore = new CapturingCallbackLogStore();
        CapturingPaymentCallbackOutbox outbox = new CapturingPaymentCallbackOutbox();
        MomoCallbackService service = service(repository, ledgerRepository, callbackLogStore, outbox);

        MomoCallbackService.MomoIpnResult result = service.handleIpn(MomoGatewayTest.ipn(paymentId().toString(), 2812345678L, 0, 120000L));

        assertThat(result.resultCode()).isEqualTo(0);
        assertThat(repository.payment.status()).isEqualTo(PaymentStatus.COMPLETED);
        assertThat(repository.payment.transactionRef()).isEqualTo("2812345678");
        assertThat(repository.savedPayments).hasSize(1);
        assertThat(ledgerRepository.savedEntries).hasSize(2);
        assertThat(outbox.savedRecords).hasSize(1);
        assertThat(outbox.savedRecords.get(0).transactionRef()).isEqualTo("2812345678");
    }

    @Test
    void duplicateSignedIpnsAcknowledgeWithoutRepeatingStateChangeOrLedgerWrites() {
        CapturingPaymentRepository repository = new CapturingPaymentRepository(payment(PaymentStatus.PENDING, null));
        CapturingLedgerRepository ledgerRepository = new CapturingLedgerRepository();
        CapturingCallbackLogStore callbackLogStore = new CapturingCallbackLogStore();
        CapturingPaymentCallbackOutbox outbox = new CapturingPaymentCallbackOutbox();
        MomoCallbackService service = service(repository, ledgerRepository, callbackLogStore, outbox);
        MomoIpnRequest request = MomoGatewayTest.ipn(paymentId().toString(), 2812345678L, 0, 120000L);

        for (int attempt = 0; attempt < 100; attempt++) {
            MomoCallbackService.MomoIpnResult result = service.handleIpn(request);
            assertThat(result.resultCode()).isEqualTo(0);
        }

        assertThat(repository.savedPayments).hasSize(1);
        assertThat(ledgerRepository.savedEntries).hasSize(2);
        assertThat(callbackLogStore.savedAttempts).hasSize(100);
        assertThat(callbackLogStore.savedAttempts).filteredOn(PaymentCallbackAttempt::duplicateReplay).hasSize(99);
        assertThat(outbox.savedRecords).hasSize(1);
    }

    @Test
    void ipnRejectsTamperedSignatureWithoutStateChange() {
        CapturingPaymentRepository repository = new CapturingPaymentRepository(payment(PaymentStatus.PENDING, null));
        CapturingLedgerRepository ledgerRepository = new CapturingLedgerRepository();
        CapturingCallbackLogStore callbackLogStore = new CapturingCallbackLogStore();
        CapturingPaymentCallbackOutbox outbox = new CapturingPaymentCallbackOutbox();
        MomoCallbackService service = service(repository, ledgerRepository, callbackLogStore, outbox);
        MomoIpnRequest signed = MomoGatewayTest.ipn(paymentId().toString(), 2812345678L, 0, 120000L);
        MomoIpnRequest tampered = new MomoIpnRequest(signed.partnerCode(), signed.accessKey(), signed.requestId(), 1L, signed.orderId(), signed.orderInfo(), signed.orderType(), signed.transId(), signed.resultCode(), signed.message(), signed.payType(), signed.responseTime(), signed.extraData(), signed.signature());

        MomoCallbackService.MomoIpnResult result = service.handleIpn(tampered);

        assertThat(result.resultCode()).isEqualTo(97);
        assertThat(repository.payment.status()).isEqualTo(PaymentStatus.PENDING);
        assertThat(repository.savedPayments).isEmpty();
        assertThat(ledgerRepository.savedEntries).isEmpty();
        assertThat(callbackLogStore.savedAttempts).hasSize(1);
        assertThat(callbackLogStore.savedAttempts.get(0).processingStatus()).isEqualTo("INVALID_SIGNATURE");
        assertThat(outbox.savedRecords).isEmpty();
    }

    @Test
    void ipnWithFailedResultPersistsTerminalStatusWithoutCreditingLedger() {
        CapturingPaymentRepository repository = new CapturingPaymentRepository(payment(PaymentStatus.PENDING, null));
        CapturingLedgerRepository ledgerRepository = new CapturingLedgerRepository();
        CapturingCallbackLogStore callbackLogStore = new CapturingCallbackLogStore();
        CapturingPaymentCallbackOutbox outbox = new CapturingPaymentCallbackOutbox();
        MomoCallbackService service = service(repository, ledgerRepository, callbackLogStore, outbox);

        // resultCode != 0 → MomoGateway.verifyIpn returns FAILED
        MomoCallbackService.MomoIpnResult result = service.handleIpn(MomoGatewayTest.ipn(paymentId().toString(), 2812345678L, 1006, 120000L));

        assertThat(result.resultCode()).isEqualTo(0);
        assertThat(repository.payment.status()).isEqualTo(PaymentStatus.FAILED);
        assertThat(repository.payment.transactionRef()).isEqualTo("2812345678");
        assertThat(repository.savedPayments).hasSize(1);
        assertThat(ledgerRepository.savedEntries).isEmpty();
        assertThat(callbackLogStore.savedAttempts).hasSize(1);
        assertThat(callbackLogStore.savedAttempts.get(0).processingStatus()).isEqualTo("FAILED");
        assertThat(outbox.savedRecords).hasSize(1);
        assertThat(outbox.savedRecords.get(0).status()).isEqualTo("FAILED");
    }

    @Test
    void ipnAcknowledgedWithoutLedgerOrOutboxWritesWhenPaymentAlreadyCompleted() {
        CapturingPaymentRepository repository = new CapturingPaymentRepository(
                payment(PaymentStatus.COMPLETED, "pre-existing-txn"));
        CapturingLedgerRepository ledgerRepository = new CapturingLedgerRepository();
        CapturingCallbackLogStore callbackLogStore = new CapturingCallbackLogStore();
        CapturingPaymentCallbackOutbox outbox = new CapturingPaymentCallbackOutbox();
        MomoCallbackService service = service(repository, ledgerRepository, callbackLogStore, outbox);

        MomoIpnRequest request = MomoGatewayTest.ipn(paymentId().toString(), 2812345678L, 0, 120000L);
        MomoCallbackService.MomoIpnResult result = service.handleIpn(request);

        assertThat(result.resultCode()).isEqualTo(0);
        assertThat(repository.payment.status()).isEqualTo(PaymentStatus.COMPLETED);
        assertThat(repository.payment.transactionRef()).isEqualTo("pre-existing-txn");
        assertThat(repository.savedPayments).isEmpty(); // no re-save
        assertThat(ledgerRepository.savedEntries).isEmpty();
        assertThat(outbox.savedRecords).isEmpty();
    }

    @Test
    void gatewayReturnVerificationDoesNotMutatePayment() {
        CapturingPaymentRepository repository = new CapturingPaymentRepository(payment(PaymentStatus.PENDING, null));
        MomoGateway gateway = new MomoGateway(PROPERTIES, new CapturingMomoClient());

        MomoGateway.MomoVerification verification = gateway.verifyIpn(MomoGatewayTest.ipn(paymentId().toString(), 2812345678L, 0, 120000L));

        assertThat(verification.validSignature()).isTrue();
        assertThat(verification.status()).isEqualTo(PaymentStatus.COMPLETED);
        assertThat(repository.payment.status()).isEqualTo(PaymentStatus.PENDING);
        assertThat(repository.savedPayments).isEmpty();
    }

    private static MomoCallbackService service(CapturingPaymentRepository repository, CapturingLedgerRepository ledgerRepository) {
        return service(repository, ledgerRepository, new CapturingCallbackLogStore(), new CapturingPaymentCallbackOutbox());
    }

    private static MomoCallbackService service(CapturingPaymentRepository repository, CapturingLedgerRepository ledgerRepository, CapturingCallbackLogStore callbackLogStore, CapturingPaymentCallbackOutbox outbox) {
        LedgerService ledgerService = new LedgerService(ledgerRepository);
        PaymentPromotionService promotion = new PaymentPromotionService(repository, ledgerService, outbox);
        return new MomoCallbackService(repository, new MomoGateway(PROPERTIES, new CapturingMomoClient()), callbackLogStore, outbox, promotion);
    }

    private static Payment payment(PaymentStatus status, String transactionRef) {
        return new Payment(paymentId(), "ORDER-1", "BUYER-1", new BigDecimal("120000.00"), PaymentMethod.MOMO, status, transactionRef, Instant.parse("2026-05-10T09:00:00Z"));
    }

    private static UUID paymentId() {
        return UUID.fromString("00000000-0000-0000-0000-000000000001");
    }

    private static final class CapturingMomoClient implements MomoClient {
        @Override
        public MomoCreateResponse create(MomoCreateRequest request) {
            return null;
        }

        @Override
        public MomoQueryDrResponse query(MomoQueryDrRequest request) {
            return null;
        }
    }

    private static final class CapturingPaymentRepository implements PaymentRepositoryPort {
        private Payment payment;
        private final List<Payment> savedPayments = new ArrayList<>();

        private CapturingPaymentRepository(Payment payment) {
            this.payment = payment;
        }

        @Override
        public Payment save(Payment payment) {
            this.payment = payment;
            savedPayments.add(payment);
            return payment;
        }

        @Override
        public Optional<Payment> findById(UUID paymentId) {
            return payment.paymentId().equals(paymentId) ? Optional.of(payment) : Optional.empty();
        }

        @Override
        public Optional<Payment> findByOrderId(String orderId) {
            return Optional.empty();
        }

        @Override
        public List<Payment> findByMethodAndStatusAndCreatedAtBefore(com.vnshop.paymentservice.domain.PaymentMethod method, PaymentStatus status, java.time.Instant before) {
            return List.of();
        }

        public List<Payment> findByStatus(PaymentStatus status) {
            return List.of();
        }
    }

    private static final class CapturingCallbackLogStore implements PaymentCallbackLogStore {
        private final List<PaymentCallbackAttempt> savedAttempts = new ArrayList<>();

        @Override
        public Optional<PaymentCallbackAttempt> findProcessed(String provider, String eventId, String payloadHash, String signatureHash) {
            return savedAttempts.stream()
                    .filter(attempt -> attempt.provider().equals(provider))
                    .filter(attempt -> attempt.eventId().equals(eventId) || attempt.payloadHash().equals(payloadHash))
                    .filter(attempt -> attempt.signatureHash().equals(signatureHash))
                    .filter(attempt -> !attempt.duplicateReplay())
                    .filter(attempt -> attempt.processingStatus().equals("PROCESSED") || attempt.processingStatus().equals("FAILED"))
                    .findFirst();
        }

        @Override
        public PaymentCallbackAttempt save(PaymentCallbackAttempt attempt) {
            savedAttempts.add(attempt);
            return attempt;
        }
    }

    private static final class CapturingPaymentCallbackOutbox implements PaymentCallbackOutbox {
        private final List<PaymentCallbackOutboxRecord> savedRecords = new ArrayList<>();

        @Override
        public PaymentCallbackOutboxRecord save(PaymentCallbackOutboxRecord record) {
            savedRecords.add(record);
            return record;
        }

        @Override
        public List<PaymentCallbackOutboxRecord> findUnpublished(int limit) {
            return List.of();
        }

        @Override
        public List<PaymentCallbackOutboxRecord> findRetryable(int limit) {
            return List.of();
        }

        @Override
        public void markPublished(Long id) {
        }

        @Override
        public void recordFailure(Long id, int attemptCount, String error, java.time.Instant nextAttemptAt, boolean dead) {
        }
    }

    private static final class CapturingLedgerRepository implements LedgerRepositoryPort {
        private final List<LedgerEntry> savedEntries = new ArrayList<>();

        @Override
        public List<LedgerEntry> append(JournalEntry journalEntry) {
            List<LedgerEntry> entries = journalEntry.postings().stream()
                    .map(posting -> LedgerEntry.fromJournalPosting(journalEntry, posting))
                    .toList();
            savedEntries.addAll(entries);
            return entries;
        }

        @Override
        public List<LedgerEntry> findByOrderId(String orderId) {
            return List.of();
        }

        @Override
        public List<LedgerEntry> findByJournalId(UUID journalId) {
            return List.of();
        }
    }
}
