package com.vnshop.orderservice.domain.projection;

import com.vnshop.orderservice.domain.FulfillmentStatus;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class OrderSummaryStatusTest {

    @Test
    void theLeastAdvancedActiveSubOrderDefinesTheBuyerStatus() {
        assertThat(OrderSummaryStatus.from(List.of(
                FulfillmentStatus.ACCEPTED,
                FulfillmentStatus.PENDING_ACCEPTANCE
        ))).isEqualTo("PENDING");
        assertThat(OrderSummaryStatus.from(List.of(
                FulfillmentStatus.PACKED,
                FulfillmentStatus.ACCEPTED
        ))).isEqualTo("CONFIRMED");
        assertThat(OrderSummaryStatus.from(List.of(
                FulfillmentStatus.DELIVERED,
                FulfillmentStatus.SHIPPED
        ))).isEqualTo("SHIPPED");
    }

    @Test
    void terminalSubOrdersDoNotHideTheStateOfTheRemainingOrder() {
        assertThat(OrderSummaryStatus.from(List.of(
                FulfillmentStatus.DELIVERED,
                FulfillmentStatus.CANCELLED
        ))).isEqualTo("DELIVERED");
        assertThat(OrderSummaryStatus.from(List.of(
                FulfillmentStatus.REJECTED,
                FulfillmentStatus.CANCELLED
        ))).isEqualTo("CANCELLED");
    }
}
