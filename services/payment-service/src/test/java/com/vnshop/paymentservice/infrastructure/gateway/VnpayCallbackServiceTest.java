package com.vnshop.paymentservice.infrastructure.gateway;

import com.vnshop.paymentservice.domain.PaymentCallbackOutboxRecord;
import com.vnshop.paymentservice.domain.port.out.PaymentCallbackOutbox;
import com.vnshop.paymentservice.application.PaymentPromotionService;
import com.vnshop.paymentservice.application.ledger.LedgerService;
import com.vnshop.paymentservice.domain.JournalEntry;
import com.vnshop.paymentservice.domain.LedgerEntry;
import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.paymentservice.domain.PaymentMethod;
import com.vnshop.paymentservice.domain.PaymentStatus;
import com.vnshop.paymentservice.domain.port.out.LedgerRepositoryPort;
import com.vnshop.paymentservice.domain.port.out.PaymentRepositoryPort;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

class VnpayCallbackServiceTest {
    private static final VnpayProperties PROPERTIES = new VnpayProperties(
            "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
            "TESTTMN",
            "secret-key",
            "https://shop.example/payment/vnpay/return",
            "https://shop.example/payment/vnpay/ipn",
            "2.1.0",
            "pay",
            "other",
            "vn",
            "VND",
            15
    );

    @Test
    void duplicateSignedIpnsAcknowledgeWithoutRepeatingStateChangeOrLedgerWrites() {
        CapturingPaymentRepository repository = new CapturingPaymentRepository(payment(PaymentStatus.PENDING, null));
        CapturingLedgerRepository ledgerRepository = new CapturingLedgerRepository();
        CapturingCallbackLogStore callbackLogStore = new CapturingCallbackLogStore();
        CapturingPaymentCallbackOutbox outbox = new CapturingPaymentCallbackOutbox();
        VnpayCallbackService service = service(repository, ledgerRepository, callbackLogStore, outbox);
        Map<String, String> parameters = completedIpn(paymentId().toString(), "14123456");

        for (int attempt = 0; attempt < 100; attempt++) {
            VnpayCallbackService.VnpayIpnResult result = service.handleIpn(parameters);
            assertThat(result.responseCode()).isEqualTo("00");
        }

        assertThat(repository.savedPayments).hasSize(1);
        assertThat(ledgerRepository.savedEntries).hasSize(2);
        assertThat(callbackLogStore.savedAttempts).hasSize(100);
        assertThat(callbackLogStore.savedAttempts).filteredOn(PaymentCallbackAttempt::duplicateReplay).hasSize(99);
        assertThat(outbox.savedRecords).hasSize(1);
        assertThat(outbox.savedRecords.get(0).transactionRef()).isEqualTo("14123456");
    }

    @Test
    void invalidSignatureIsLoggedWithoutStateChange() {
        CapturingPaymentRepository repository = new CapturingPaymentRepository(payment(PaymentStatus.PENDING, null));
        CapturingLedgerRepository ledgerRepository = new CapturingLedgerRepository();
        CapturingCallbackLogStore callbackLogStore = new CapturingCallbackLogStore();
        CapturingPaymentCallbackOutbox outbox = new CapturingPaymentCallbackOutbox();
        VnpayCallbackService service = service(repository, ledgerRepository, callbackLogStore, outbox);
        Map<String, String> parameters = completedIpn(paymentId().toString(), "14123456");
        parameters.put("vnp_Amount", "1");

        VnpayCallbackService.VnpayIpnResult result = service.handleIpn(parameters);

        assertThat(result.responseCode()).isEqualTo("97");
        assertThat(repository.payment.status()).isEqualTo(PaymentStatus.PENDING);
        assertThat(repository.savedPayments).isEmpty();
        assertThat(ledgerRepository.savedEntries).isEmpty();
        assertThat(callbackLogStore.savedAttempts).hasSize(1);
        assertThat(callbackLogStore.savedAttempts.get(0).processingStatus()).isEqualTo("INVALID_SIGNATURE");
        assertThat(outbox.savedRecords).isEmpty();
    }

    @Test
    void paymentNotFound_acknowledgesWithoutStateChange() {
        CapturingPaymentRepository repository = new CapturingPaymentRepository(null);
        CapturingLedgerRepository ledgerRepository = new CapturingLedgerRepository();
        CapturingCallbackLogStore callbackLogStore = new CapturingCallbackLogStore();
        CapturingPaymentCallbackOutbox outbox = new CapturingPaymentCallbackOutbox();
        VnpayCallbackService service = service(repository, ledgerRepository, callbackLogStore, outbox);
        Map<String, String> params = completedIpn(paymentId().toString(), "14123456");

        VnpayCallbackService.VnpayIpnResult result = service.handleIpn(params);

        assertThat(result.responseCode()).isEqualTo("01");
        assertThat(callbackLogStore.savedAttempts).hasSize(1);
        assertThat(callbackLogStore.savedAttempts.get(0).processingStatus()).isEqualTo("PAYMENT_NOT_FOUND");
        assertThat(ledgerRepository.savedEntries).isEmpty();
        assertThat(outbox.savedRecords).isEmpty();
    }

    @Test
    void returnVerificationDoesNotMutatePayment() {
        CapturingPaymentRepository repository = new CapturingPaymentRepository(payment(PaymentStatus.PENDING, null));
        CapturingLedgerRepository ledgerRepository = new CapturingLedgerRepository();
        VnpayCallbackService service = service(repository, ledgerRepository, new CapturingCallbackLogStore(), new CapturingPaymentCallbackOutbox());

        VnpayGateway.VnpayVerification verification = service.verifyReturn(completedIpn(paymentId().toString(), "14123456"));

        assertThat(verification.validSignature()).isTrue();
        assertThat(repository.payment.status()).isEqualTo(PaymentStatus.PENDING);
        assertThat(repository.savedPayments).isEmpty();
        assertThat(ledgerRepository.savedEntries).isEmpty();
    }

    private static VnpayCallbackService service(CapturingPaymentRepository repository, CapturingLedgerRepository ledgerRepository, CapturingCallbackLogStore callbackLogStore, CapturingPaymentCallbackOutbox outbox) {
        PaymentPromotionService promotionService = new PaymentPromotionService(
                repository, new LedgerService(ledgerRepository), outbox);
        return new VnpayCallbackService(repository, gateway(), callbackLogStore, promotionService);
    }

    private static VnpayGateway gateway() {
        Clock clock = Clock.fixed(Instant.parse("2026-05-10T05:00:00Z"), ZoneId.of("Asia/Ho_Chi_Minh"));
        return new VnpayGateway(PROPERTIES, new LedgerService(new CapturingLedgerRepository()), clock);
    }

    private static Map<String, String> completedIpn(String paymentId, String transactionNo) {
        Map<String, String> parameters = queryParameters(gateway().createPaymentUrl(payment(PaymentStatus.PENDING, null), "203.0.113.10"));
        parameters.put("vnp_TxnRef", paymentId);
        parameters.put("vnp_ResponseCode", "00");
        parameters.put("vnp_TransactionStatus", "00");
        parameters.put("vnp_TransactionNo", transactionNo);
        parameters.put("vnp_SecureHash", new VnpaySigner(PROPERTIES.hashSecret()).sign(parameters));
        return parameters;
    }

    private static Map<String, String> queryParameters(String url) {
        String query = url.substring(url.indexOf('?') + 1);
        return Arrays.stream(query.split("&"))
                .map(pair -> pair.split("=", 2))
                .collect(Collectors.toMap(
                        pair -> decode(pair[0]),
                        pair -> pair.length == 2 ? decode(pair[1]) : ""));
    }

    private static String decode(String value) {
        return URLDecoder.decode(value, StandardCharsets.UTF_8);
    }

    private static Payment payment(PaymentStatus status, String transactionRef) {
        return new Payment(paymentId(), "ORDER-1", "BUYER-1", new BigDecimal("120000.00"), PaymentMethod.VNPAY, status, transactionRef, Instant.parse("2026-05-10T09:00:00Z"));
    }

    private static UUID paymentId() {
        return UUID.fromString("00000000-0000-0000-0000-000000000001");
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
            return payment != null && payment.paymentId().equals(paymentId)
                    ? Optional.of(payment)
                    : Optional.empty();
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
