package com.vnshop.paymentservice.infrastructure.sepay;

import com.vnshop.paymentservice.application.PaymentPromotionService;
import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.paymentservice.domain.PaymentMethod;
import com.vnshop.paymentservice.domain.PaymentStatus;
import com.vnshop.paymentservice.domain.port.out.PaymentRepositoryPort;
import com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackHasher;
import com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackAttempt;
import com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackLogStore;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
@ConditionalOnProperty(name = "payment.sepay.enabled", havingValue = "true")
public class SepayPoller {
    private static final Logger log = LoggerFactory.getLogger(SepayPoller.class);
    private static final Pattern UUID_PATTERN = Pattern.compile(
            "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", Pattern.CASE_INSENSITIVE);

    private final SepayClient client;
    private final SepayCursorRepository cursorRepository;
    private final PaymentRepositoryPort paymentRepository;
    private final PaymentPromotionService promotionService;
    private final SepayTransactionValidator transactionValidator;
    private final PaymentCallbackLogStore callbackLogStore;

    public SepayPoller(SepayProperties properties, SepayClient client, SepayCursorRepository cursorRepository,
                       PaymentRepositoryPort paymentRepository, PaymentPromotionService promotionService) {
        this(properties, client, cursorRepository, paymentRepository, promotionService, null);
    }

    @Autowired
    public SepayPoller(SepayProperties properties, SepayClient client, SepayCursorRepository cursorRepository,
                       PaymentRepositoryPort paymentRepository, PaymentPromotionService promotionService,
                       PaymentCallbackLogStore callbackLogStore) {
        Objects.requireNonNull(properties, "properties is required");
        if (properties.apiKey() == null || properties.apiKey().isBlank()) {
            throw new IllegalArgumentException("payment.sepay.apiKey is required when payment.sepay.enabled=true");
        }
        this.client = Objects.requireNonNull(client, "client is required");
        this.cursorRepository = Objects.requireNonNull(cursorRepository, "cursorRepository is required");
        this.paymentRepository = Objects.requireNonNull(paymentRepository, "paymentRepository is required");
        this.promotionService = Objects.requireNonNull(promotionService, "promotionService is required");
        this.transactionValidator = new SepayTransactionValidator(properties);
        this.callbackLogStore = callbackLogStore;
    }

    @Scheduled(fixedRateString = "${payment.sepay.poll-interval-seconds}000")
    public void poll() {
        SepayTransactionsResponse response;
        try {
            response = client.listTransactions(cursorRepository.readCursor().orElse(null));
        } catch (RuntimeException ex) {
            log.warn("sepay-poll-failed reason={}", ex.getMessage());
            return;
        }
        if (response == null || (response.status() != 0 && response.status() != 200)) return;
        List<SepayTransactionsResponse.SepayTransaction> transactions = response.transactions();
        if (transactions == null || transactions.isEmpty()) return;
        for (SepayTransactionsResponse.SepayTransaction tx : transactions) {
            if (!promote(tx)) return;
            cursorRepository.writeCursor(tx.id());
        }
    }

    private boolean promote(SepayTransactionsResponse.SepayTransaction tx) {
        if (tx == null || tx.id() == null || tx.id().isBlank()) return false;
        String memo = tx.transaction_content();
        if (memo == null || memo.isBlank()) return false;
        Matcher matcher = UUID_PATTERN.matcher(memo);
        if (!matcher.find()) return false;
        UUID paymentId;
        try {
            paymentId = UUID.fromString(matcher.group());
        } catch (IllegalArgumentException ex) {
            return false;
        }
        Optional<Payment> existing = paymentRepository.findById(paymentId);
        if (existing.isEmpty()) return false;
        Payment payment = existing.get();
        if (payment.method() != PaymentMethod.VIETQR) return false;
        if (payment.status() != PaymentStatus.PENDING) return payment.status() == PaymentStatus.COMPLETED;
        SepayTransactionValidator.Validation validation = transactionValidator.validate(
                payment, tx.id(), tx.amount_in(), memo, tx.account_number(), tx.currency(), tx.transfer_type());
        if (!validation.accepted()) {
            log.warn("sepay-skip-invalid txId={} paymentId={} reason={}", tx.id(), paymentId, validation.reason());
            return false;
        }
        String body = canonical(tx);
        String payloadHash = PaymentCallbackHasher.sha256(body);
        PaymentCallbackAttempt attempt = new PaymentCallbackAttempt(
                UUID.randomUUID(), "SEPAY", tx.id(), payloadHash, PaymentCallbackHasher.sha256(""), "{}", body,
                java.time.Instant.now(), "RECEIVED", false);
        if (callbackLogStore != null && !callbackLogStore.claim(attempt)) {
            return true;
        }
        PaymentPromotionService.PromotionResult result = promotionService.promote(PaymentPromotionService.PromotionCommand.fromCallback(
                paymentId, "SEPAY", tx.id(), attempt.callbackId(), attempt.eventId(), attempt.payloadHash()));
        if (result.isSuccess() && callbackLogStore != null) {
            callbackLogStore.save(new PaymentCallbackAttempt(attempt.callbackId(), attempt.provider(), attempt.eventId(),
                    attempt.payloadHash(), attempt.signatureHash(), attempt.headersJson(), attempt.bodyJson(), attempt.receivedAt(),
                    "PROCESSED", false));
        }
        return result.isSuccess();
    }

    private static String canonical(SepayTransactionsResponse.SepayTransaction tx) {
        return "id=" + nvl(tx.id()) + "&transaction_content=" + nvl(tx.transaction_content())
                + "&transferAmount=" + nvl(tx.amount_in()) + "&accountNumber=" + nvl(tx.account_number())
                + "&currency=" + nvl(tx.currency()) + "&transferType=" + nvl(tx.transfer_type());
    }

    private static String nvl(String value) { return value == null ? "" : value; }
}
