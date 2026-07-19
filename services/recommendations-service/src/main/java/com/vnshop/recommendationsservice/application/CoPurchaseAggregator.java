package com.vnshop.recommendationsservice.application;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Aggregates co-purchase counts when a new order arrives.
 *
 * <p>For every distinct product pair in an order's items list we record the
 * pair both ways — (A,B) and (B,A) — so the read-side query against
 * {@code product_a = ?} always returns the right candidates without having
 * to UNION two indexes. Self-pairs are skipped (a product appearing twice
 * in an order shouldn't co-purchase with itself).
 *
 * <p>Idempotency: each order id is recorded in {@code processed_orders}
 * before counts are touched. A redelivery of the same {@code order.created}
 * event short-circuits at the existence check and never inflates counts.
 *
 * <p>Note: Hibernate's saveAndFlush is sufficient here because each order
 * is processed in a single transaction. Concurrent processing of different
 * orders that touch the same (A,B) pair will serialize on the row lock for
 * that pair — that's fine and correct at current write volumes; revisit
 * when contention shows up in metrics.
 */
@Service
public class CoPurchaseAggregator {
    private static final Logger LOGGER = LoggerFactory.getLogger(CoPurchaseAggregator.class);

    private final CoPurchasePort coPurchasePort;
    private final ProcessedOrderPort processedOrderPort;

    public CoPurchaseAggregator(
            CoPurchasePort coPurchasePort,
            ProcessedOrderPort processedOrderPort
    ) {
        this.coPurchasePort = Objects.requireNonNull(coPurchasePort, "coPurchasePort is required");
        this.processedOrderPort = Objects.requireNonNull(processedOrderPort, "processedOrderPort is required");
    }

    @Transactional
    public void recordOrder(String orderId, List<String> productIds) {
        if (orderId == null || orderId.isBlank()) {
            LOGGER.warn("Skipping order with blank id");
            return;
        }
        if (productIds == null || productIds.size() < 2) {
            // Single-item orders contribute no co-purchase signal.
            // Mark as processed anyway so a retry doesn't re-evaluate.
            markProcessed(orderId);
            return;
        }
        if (processedOrderPort.exists(orderId)) {
            LOGGER.debug("Skipping already-processed order {}", orderId);
            return;
        }

        List<String> distinctProducts = productIds.stream()
                .filter(Objects::nonNull)
                .filter(s -> !s.isBlank())
                .distinct()
                .toList();
        if (distinctProducts.size() < 2) {
            markProcessed(orderId);
            return;
        }

        for (int i = 0; i < distinctProducts.size(); i++) {
            for (int j = i + 1; j < distinctProducts.size(); j++) {
                String a = distinctProducts.get(i);
                String b = distinctProducts.get(j);
                incrementPair(a, b);
                incrementPair(b, a);
            }
        }
        markProcessed(orderId);
        LOGGER.debug("Recorded co-purchases for order {} ({} distinct products)", orderId, distinctProducts.size());
    }

    private void incrementPair(String productA, String productB) {
        Instant now = Instant.now();
        CoPurchase updated = coPurchasePort.find(productA, productB)
                .map(row -> row.incrementedAt(now))
                .orElseGet(() -> new CoPurchase(productA, productB, 1L, now));
        coPurchasePort.save(updated);
    }

    private void markProcessed(String orderId) {
        if (!processedOrderPort.exists(orderId)) {
            processedOrderPort.save(orderId);
        }
    }
}
