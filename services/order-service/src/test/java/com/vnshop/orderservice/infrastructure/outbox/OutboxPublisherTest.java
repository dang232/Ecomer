package com.vnshop.orderservice.infrastructure.outbox;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class OutboxPublisherTest {

    @Test
    void topicForConvertsUnderscoresToDots() {
        assertThat(OutboxPublisher.topicFor("PAYMENT_REFUND_REQUESTED"))
                .isEqualTo("payment.refund.requested");
    }

    @Test
    void topicForPreservesAlreadyDottedLowercaseEventTypes() {
        assertThat(OutboxPublisher.topicFor("order.created"))
                .isEqualTo("order.created");
    }

    @Test
    void topicForHandlesUppercaseWithUnderscores() {
        assertThat(OutboxPublisher.topicFor("ORDER_CREATED"))
                .isEqualTo("order.created");
    }

    @Test
    void usesPayloadSellerIdAsTheAdjustmentKafkaKey() {
        assertThat(OutboxPublisher.keyFor("SELLER_FINANCE_ADJUSTMENT", "order-id",
                "{\"payload\":{\"sellerId\":\"seller-42\"}}"))
                .isEqualTo("seller-42");
    }

    @Test
    void usesSellerIdWhenGivenTheSerializedOutboxWrapper() {
        assertThat(OutboxPublisher.keyFor("SELLER_FINANCE_ADJUSTMENT", "order-id",
                "{\"payload\":\"{\\\"payload\\\":{\\\"sellerId\\\":\\\"seller-42\\\"}}\"}"))
                .isEqualTo("seller-42");
    }
}
