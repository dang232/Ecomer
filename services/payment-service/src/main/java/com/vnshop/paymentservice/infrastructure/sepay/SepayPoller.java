package com.vnshop.paymentservice.infrastructure.sepay;

import com.vnshop.paymentservice.application.PaymentPromotionService;
import com.vnshop.paymentservice.domain.Payment;
import com.vnshop.paymentservice.domain.PaymentMethod;
import com.vnshop.paymentservice.domain.PaymentStatus;
import com.vnshop.paymentservice.domain.port.out.PaymentRepositoryPort;
import com.vnshop.paymentservice.infrastructure.gateway.PaymentCallbackHasher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * SePay polling worker. Reads new bank credits since the last cursor, matches
 * each credit's memo against PENDING VietQR payments by extracting the UUID
 * the QR generator embedded in {@code addInfo}, and promotes matches via
 * {@link PaymentPromotionService}.
 *
 * <p>Misses (memo malformed, SePay outage, key wrong) drop into the manual
 * {@code AdminVietQrController} fallback — buyer's transfer still landed in
 * the account, the merchant just confirms by hand.
 *
 * <p>Cursor advances regardless of match outcome so a single bad payload
 * doesn't pin the poller forever.
 */
@Component
@ConditionalOnProperty(name = "payment.sepay.enabled", havingValue = "true")
public class SepayPoller {
    private static final Logger log = LoggerFactory.getLogger(SepayPoller.class);
    private static final Pattern UUID_PATTERN = Pattern.compile(
            "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
            Pattern.CASE_INSENSITIVE);

    private final SepayClient client;
    private final SepayCursorRepository cursorRepository;
    private final PaymentRepositoryPort paymentRepository;
    private final PaymentPromotionService promotionService;

    public SepayPoller(
            SepayProperties properties,
            SepayClient client,
            SepayCursorRepository cursorRepository,
            PaymentRepositoryPort paymentRepository,
            PaymentPromotionService promotionService) {
        Objects.requireNonNull(properties, "properties is required");
        if (properties.apiKey() == null || properties.apiKey().isBlank()) {
            throw new IllegalArgumentException(
                    "payment.sepay.apiKey is required when payment.sepay.enabled=true");
        }
        this.client = Objects.requireNonNull(client, "client is required");
        this.cursorRepository = Objects.requireNonNull(cursorRepository, "cursorRepository is required");
        this.paymentRepository = Objects.requireNonNull(paymentRepository, "paymentRepository is required");
        this.promotionService = Objects.requireNonNull(promotionService, "promotionService is required");
    }

    @Scheduled(fixedRateString = "${payment.sepay.poll-interval-seconds}000")
    public void poll() {
        String cursor = cursorRepository.readCursor().orElse(null);
        SepayTransactionsResponse response;
        try {
            response = client.listTransactions(cursor);
        } catch (RuntimeException ex) {
            log.warn("sepay-poll-failed reason={}", ex.getMessage());
            return;
        }
        List<SepayTransactionsResponse.SepayTransaction> transactions = response.transactions();
        if (transactions == null || transactions.isEmpty()) {
            return;
        }
        for (SepayTransactionsResponse.SepayTransaction tx : transactions) {
            promote(tx);
        }
        // Cursor = newest tx id processed (first element on SePay's API, which sorts DESC).
        cursorRepository.writeCursor(transactions.get(0).id());
    }

    private void promote(SepayTransactionsResponse.SepayTransaction tx) {
        String memo = tx.transaction_content();
        if (memo == null || memo.isBlank()) {
            log.debug("sepay-skip-empty-memo txId={}", tx.id());
            return;
        }
        Matcher matcher = UUID_PATTERN.matcher(memo);
        if (!matcher.find()) {
            log.info("sepay-skip-no-uuid-in-memo txId={} memo={}", tx.id(), memo);
            return;
        }
        UUID paymentId;
        try {
            paymentId = UUID.fromString(matcher.group());
        } catch (IllegalArgumentException ex) {
            log.warn("sepay-skip-bad-uuid txId={} match={}", tx.id(), matcher.group());
            return;
        }

        Optional<Payment> existing = paymentRepository.findById(paymentId);
        if (existing.isEmpty()) {
            log.info("sepay-skip-unknown-payment txId={} paymentId={}", tx.id(), paymentId);
            return;
        }
        Payment payment = existing.get();
        if (payment.method() != PaymentMethod.VIETQR) {
            log.info("sepay-skip-non-vietqr txId={} paymentId={} method={}",
                    tx.id(), paymentId, payment.method());
            return;
        }
        if (payment.status() != PaymentStatus.PENDING) {
            log.debug("sepay-skip-non-pending txId={} paymentId={} status={}",
                    tx.id(), paymentId, payment.status());
            return;
        }

        promotionService.promote(PaymentPromotionService.PromotionCommand.fromCallback(
                paymentId, "SEPAY", tx.id(),
                UUID.randomUUID(), "SEPAY:" + tx.id(),
                PaymentCallbackHasher.sha256(tx.id())));
    }
}
