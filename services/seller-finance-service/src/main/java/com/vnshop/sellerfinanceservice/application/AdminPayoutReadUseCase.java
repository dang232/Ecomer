package com.vnshop.sellerfinanceservice.application;

import com.vnshop.sellerfinanceservice.domain.Payout;
import com.vnshop.sellerfinanceservice.domain.PayoutStatus;
import com.vnshop.sellerfinanceservice.domain.port.out.PayoutRepositoryPort;
import com.vnshop.sellerfinanceservice.domain.port.out.SellerDirectoryPort;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.time.Instant;
import java.util.UUID;

/** Builds the admin payout read model without leaking remote lookups into web adapters. */
public class AdminPayoutReadUseCase {
    private final PayoutRepositoryPort payoutRepositoryPort;
    private final SellerDirectoryPort sellerDirectoryPort;

    public AdminPayoutReadUseCase(PayoutRepositoryPort payoutRepositoryPort, SellerDirectoryPort sellerDirectoryPort) {
        this.payoutRepositoryPort = Objects.requireNonNull(payoutRepositoryPort, "payoutRepositoryPort is required");
        this.sellerDirectoryPort = Objects.requireNonNull(sellerDirectoryPort, "sellerDirectoryPort is required");
    }

    public List<EnrichedPayout> pending(String query) {
        List<Payout> payouts = new java.util.ArrayList<>();
        for (PayoutStatus status : List.of(PayoutStatus.REQUESTED, PayoutStatus.APPROVED,
                PayoutStatus.SUBMITTING, PayoutStatus.SUBMITTED, PayoutStatus.UNKNOWN, PayoutStatus.PENDING)) {
            payouts.addAll(query == null || query.isBlank()
                    ? payoutRepositoryPort.findByStatus(status)
                    : payoutRepositoryPort.findByStatus(status, query));
        }
        return enrich(payouts);
    }

    public List<EnrichedPayout> completed(String query) {
        List<Payout> payouts = new java.util.ArrayList<>(query == null || query.isBlank()
                ? payoutRepositoryPort.findCompleted()
                : payoutRepositoryPort.findCompleted(query));
        payouts.addAll(query == null || query.isBlank()
                ? payoutRepositoryPort.findByStatus(PayoutStatus.PAID)
                : payoutRepositoryPort.findByStatus(PayoutStatus.PAID, query));
        return enrich(payouts);
    }

    /**
     * Read model used by the admin queue. The repository remains the source of
     * truth for exact wire statuses; this method only combines the legacy
     * pending/completed groups when no filter is selected and applies the
     * requested page after seller-name enrichment.
     */
    public Page<EnrichedPayout> all(String query, String status, Pageable pageable) {
        List<EnrichedPayout> rows;
        if (status == null || status.isBlank() || "ALL".equalsIgnoreCase(status)) {
            rows = new java.util.ArrayList<>(pending(query));
            rows.addAll(completed(query));
        } else {
            PayoutStatus requestedStatus;
            try {
                requestedStatus = PayoutStatus.valueOf(status.trim().toUpperCase());
            } catch (IllegalArgumentException exception) {
                throw new IllegalArgumentException("status is invalid: " + status, exception);
            }
            List<Payout> payouts = query == null || query.isBlank()
                    ? payoutRepositoryPort.findByStatus(requestedStatus)
                    : payoutRepositoryPort.findByStatus(requestedStatus, query);
            rows = enrich(payouts);
        }

        int pageNumber = pageable.getPageNumber();
        int pageSize = pageable.getPageSize();
        int fromIndex = Math.min(pageNumber * pageSize, rows.size());
        int toIndex = Math.min(fromIndex + pageSize, rows.size());
        return new PageImpl<>(rows.subList(fromIndex, toIndex), pageable, rows.size());
    }

    public CursorPage cursor(String query, PayoutStatus status, Instant beforeCreatedAt,
            UUID beforePayoutId, int limit) {
        List<Payout> rows = payoutRepositoryPort.findAdminCursor(
                query, status, beforeCreatedAt, beforePayoutId, limit + 1);
        boolean hasMore = rows.size() > limit;
        List<Payout> visible = hasMore ? rows.subList(0, limit) : rows;
        return new CursorPage(enrich(visible), hasMore);
    }

    public EnrichedPayout enrich(Payout payout) {
        Map<String, String> names = sellerDirectoryPort.lookup(List.of(payout.sellerId()));
        return new EnrichedPayout(payout, names == null ? null : names.get(payout.sellerId()));
    }

    private List<EnrichedPayout> enrich(List<Payout> payouts) {
        if (payouts == null || payouts.isEmpty()) {
            return List.of();
        }
        Map<String, String> names = sellerDirectoryPort.lookup(
                payouts.stream().map(Payout::sellerId).distinct().toList());
        names = names == null ? Map.of() : names;
        Map<String, String> resolvedNames = names;
        return payouts.stream().map(payout -> new EnrichedPayout(payout, resolvedNames.get(payout.sellerId()))).toList();
    }

    public record EnrichedPayout(Payout payout, String sellerName) {
    }

    public record CursorPage(List<EnrichedPayout> items, boolean hasMore) {
    }
}
