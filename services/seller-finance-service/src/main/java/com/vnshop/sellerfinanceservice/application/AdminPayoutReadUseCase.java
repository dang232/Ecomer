package com.vnshop.sellerfinanceservice.application;

import com.vnshop.sellerfinanceservice.domain.Payout;
import com.vnshop.sellerfinanceservice.domain.PayoutStatus;
import com.vnshop.sellerfinanceservice.domain.port.out.PayoutRepositoryPort;
import com.vnshop.sellerfinanceservice.domain.port.out.SellerDirectoryPort;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/** Builds the admin payout read model without leaking remote lookups into web adapters. */
public class AdminPayoutReadUseCase {
    private final PayoutRepositoryPort payoutRepositoryPort;
    private final SellerDirectoryPort sellerDirectoryPort;

    public AdminPayoutReadUseCase(PayoutRepositoryPort payoutRepositoryPort, SellerDirectoryPort sellerDirectoryPort) {
        this.payoutRepositoryPort = Objects.requireNonNull(payoutRepositoryPort, "payoutRepositoryPort is required");
        this.sellerDirectoryPort = Objects.requireNonNull(sellerDirectoryPort, "sellerDirectoryPort is required");
    }

    public List<EnrichedPayout> pending(String query) {
        List<Payout> payouts = query == null || query.isBlank()
                ? payoutRepositoryPort.findByStatus(PayoutStatus.PENDING)
                : payoutRepositoryPort.findByStatus(PayoutStatus.PENDING, query);
        return enrich(payouts);
    }

    public List<EnrichedPayout> completed(String query) {
        List<Payout> payouts = query == null || query.isBlank()
                ? payoutRepositoryPort.findCompleted()
                : payoutRepositoryPort.findCompleted(query);
        return enrich(payouts);
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
}
