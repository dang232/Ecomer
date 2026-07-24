package com.vnshop.orderservice.application.fraud;

import com.vnshop.orderservice.domain.Money;
import com.vnshop.orderservice.domain.Order;
import com.vnshop.orderservice.domain.port.out.FraudOrderCountPort;
import com.vnshop.orderservice.domain.port.out.OutboxPort;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Evaluates fraud rules against a newly created order before payment proceeds.
 *
 * <p>Rules applied in order:
 * <ol>
 *   <li>Velocity check — max 3 orders per 60 minutes per buyer.</li>
 *   <li>Amount threshold — orders above 10,000,000 VND are flagged.</li>
 *   <li>Geographic anomaly — shipping country != IP-derived country.</li>
 * </ol>
 *
 * <p>Device fingerprint (from {@code X-Device-Fingerprint} header) is logged
 * for audit purposes but does not trigger a flag on its own.
 *
 * <p>A flagged order has its {@link com.vnshop.orderservice.domain.PaymentStatus}
 * set to {@code FLAGGED} and a {@code ORDER_FRAUD_FLAGGED} event is published to
 * the outbox (topic: {@code order.fraud-flagged}).
 */
@Service
public class FraudDetectionService {

    private static final Logger LOG = LoggerFactory.getLogger(FraudDetectionService.class);
    private static final String AGGREGATE_TYPE = "Order";
    private static final String EVENT_TYPE = "ORDER_FRAUD_FLAGGED";

    /** Maximum allowed orders for a buyer within the velocity window. */
    private static final int VELOCITY_MAX_ORDERS = 3;
    /** Velocity window in minutes. */
    private static final int VELOCITY_WINDOW_MINUTES = 60;
    /** Amount (in VND) above which an order is flagged for manual review. */
    private static final long AMOUNT_FLAG_THRESHOLD = 10_000_000L;

    private final FraudOrderCountPort fraudOrderCountPort;
    private final OutboxPort outboxPort;
    private final GeoIpService geoIpService;

    public FraudDetectionService(
            FraudOrderCountPort fraudOrderCountPort,
            OutboxPort outboxPort,
            GeoIpService geoIpService
    ) {
        this.fraudOrderCountPort = Objects.requireNonNull(fraudOrderCountPort, "fraudOrderCountPort is required");
        this.outboxPort = Objects.requireNonNull(outboxPort, "outboxPort is required");
        this.geoIpService = Objects.requireNonNull(geoIpService, "geoIpService is required");
    }

    /**
     * Evaluates fraud rules and, if any trigger, flags the order.
     *
     * @param order             the order to evaluate (domain object, not yet persisted)
     * @param forwardedFor      value of X-Forwarded-For header (may be null)
     * @param deviceFingerprint value of X-Device-Fingerprint header (may be null)
     * @param shippingCountry   ISO-3166-1 alpha-2 country of the shipping address (e.g. "VN")
     * @return the fraud check result; caller should inspect {@code flagged()} before proceeding
     */
    public FraudCheckResult evaluate(
            Order order,
            String forwardedFor,
            String deviceFingerprint,
            String shippingCountry
    ) {
        Objects.requireNonNull(order, "order is required");

        // Log device fingerprint for audit regardless of flag outcome.
        if (deviceFingerprint != null && !deviceFingerprint.isBlank()) {
            LOG.info("fraud-check orderId={} buyerId={} deviceFingerprint={}",
                    order.id(), order.buyerId(), deviceFingerprint);
        }

        List<String> reasons = new ArrayList<>();

        // Rule 1: Velocity check
        Instant windowStart = Instant.now().minusSeconds(VELOCITY_WINDOW_MINUTES * 60L);
        long recentCount = fraudOrderCountPort.countRecentOrders(order.buyerId(), windowStart);
        if (recentCount >= VELOCITY_MAX_ORDERS) {
            reasons.add(String.format("VELOCITY: %d orders in last %d min (max %d)",
                    recentCount, VELOCITY_WINDOW_MINUTES, VELOCITY_MAX_ORDERS));
            LOG.warn("fraud-check VELOCITY triggered orderId={} buyerId={} recentCount={}",
                    order.id(), order.buyerId(), recentCount);
        }

        // Rule 2: Amount threshold
        Money finalAmount = order.finalAmount();
        if (finalAmount != null && finalAmount.amount().compareTo(BigDecimal.valueOf(AMOUNT_FLAG_THRESHOLD)) > 0) {
            reasons.add(String.format("AMOUNT: %s VND exceeds threshold %d VND",
                    finalAmount.amount().toPlainString(), AMOUNT_FLAG_THRESHOLD));
            LOG.warn("fraud-check AMOUNT triggered orderId={} amount={}", order.id(), finalAmount.amount());
        }

        // Rule 3: Geographic anomaly
        String ipCountry = geoIpService.countryFor(forwardedFor);
        String shipCountry = shippingCountry != null ? shippingCountry.toUpperCase() : "VN";
        if (!ipCountry.equalsIgnoreCase(shipCountry)) {
            reasons.add(String.format("GEO: shipping country %s != IP country %s", shipCountry, ipCountry));
            LOG.warn("fraud-check GEO triggered orderId={} shipCountry={} ipCountry={}",
                    order.id(), shipCountry, ipCountry);
        }

        if (reasons.isEmpty()) {
            LOG.debug("fraud-check PASSED orderId={}", order.id());
            return FraudCheckResult.clean();
        }

        // Publish fraud-flagged event via outbox (topic: order.fraud-flagged)
        String payload = buildFraudPayload(order, reasons);
        outboxPort.publish(AGGREGATE_TYPE, order.id().toString(), EVENT_TYPE, payload);
        outboxPort.publish(AGGREGATE_TYPE, order.id().toString(), "SETTLEMENT_HOLD",
                buildSettlementHoldPayload(order));

        LOG.warn("fraud-check FLAGGED orderId={} reasons={}", order.id(), reasons);
        return FraudCheckResult.flagged(reasons);
    }

    private static String buildFraudPayload(Order order, List<String> reasons) {
        // Build a compact JSON payload without pulling in Jackson here — the
        // outbox publisher serialises the OutboxEvent domain record to JSON
        // already; the payload field is already a JSON string literal.
        StringBuilder sb = new StringBuilder("{");
        sb.append("\"orderId\":\"").append(order.id()).append("\",");
        sb.append("\"userId\":\"").append(order.buyerId()).append("\",");
        sb.append("\"amount\":").append(
                order.finalAmount() != null ? order.finalAmount().amount().toPlainString() : "0"
        ).append(",");
        sb.append("\"timestamp\":\"").append(Instant.now()).append("\",");
        sb.append("\"reasons\":[");
        for (int i = 0; i < reasons.size(); i++) {
            if (i > 0) sb.append(",");
            sb.append("\"").append(reasons.get(i).replace("\"", "'")).append("\"");
        }
        sb.append("]}");
        return sb.toString();
    }

    private static String buildSettlementHoldPayload(Order order) {
        return "{\"orderId\":\"" + order.id() + "\",\"subOrderId\":null"
                + ",\"holdType\":\"FRAUD\",\"open\":true}";
    }
}
