package com.vnshop.orderservice.domain.projection;

import com.vnshop.orderservice.domain.FulfillmentStatus;

import java.util.Collection;
import java.util.List;

public final class OrderSummaryStatus {
    private OrderSummaryStatus() {
    }

    public static String from(Collection<FulfillmentStatus> statuses) {
        List<FulfillmentStatus> active = statuses == null
                ? List.of()
                : statuses.stream()
                    .filter(status -> status != FulfillmentStatus.CANCELLED)
                    .filter(status -> status != FulfillmentStatus.REJECTED)
                    .toList();

        if (statuses == null || statuses.isEmpty()) return "PENDING";
        if (active.isEmpty()) return "CANCELLED";
        if (active.contains(FulfillmentStatus.PENDING_ACCEPTANCE)) return "PENDING";
        if (active.contains(FulfillmentStatus.ACCEPTED)
                || active.contains(FulfillmentStatus.PACKED)) {
            return "CONFIRMED";
        }
        if (active.contains(FulfillmentStatus.SHIPPED)) return "SHIPPED";
        if (active.stream().allMatch(status -> status == FulfillmentStatus.DELIVERED)) {
            return "DELIVERED";
        }
        return "PENDING";
    }
}
