package com.vnshop.orderservice.infrastructure.outbox;

import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.SpanContext;
import io.opentelemetry.api.trace.TraceFlags;
import io.opentelemetry.api.trace.TraceState;
import io.opentelemetry.context.Context;
import org.apache.kafka.clients.producer.ProducerRecord;
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

    @Test
    void injectsW3cTraceContextIntoKafkaHeadersWithoutChangingPayload() {
        SpanContext spanContext = SpanContext.create(
                "4bf92f3577b34da6a3ce929d0e0e4736",
                "00f067aa0ba902b7",
                TraceFlags.getSampled(),
                TraceState.getDefault());

        try (var scope = Context.root().with(Span.wrap(spanContext)).makeCurrent()) {
            ProducerRecord<String, Object> record = OutboxPublisher.propagatedRecord(
                    "orders", "order-1", "payload");

            assertThat(record.value()).isEqualTo("payload");
            assertThat(record.headers().lastHeader("traceparent")).isNotNull();
            assertThat(new String(record.headers().lastHeader("traceparent").value()))
                    .isEqualTo("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01");
        }
    }
}
