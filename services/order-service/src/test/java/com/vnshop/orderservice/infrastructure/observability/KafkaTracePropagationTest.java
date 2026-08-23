package com.vnshop.orderservice.infrastructure.observability;

import static org.assertj.core.api.Assertions.assertThat;

import io.opentelemetry.api.trace.Span;
import io.opentelemetry.api.trace.SpanContext;
import io.opentelemetry.api.trace.TraceFlags;
import io.opentelemetry.api.trace.TraceState;
import io.opentelemetry.context.Context;
import org.apache.kafka.clients.producer.ProducerRecord;
import org.junit.jupiter.api.Test;

class KafkaTracePropagationTest {
    @Test
    void injectsAndExtractsW3cTraceContextFromKafkaHeaders() {
        SpanContext spanContext = SpanContext.create(
                "4bf92f3577b34da6a3ce929d0e0e4736",
                "00f067aa0ba902b7",
                TraceFlags.getSampled(),
                TraceState.getDefault());
        ProducerRecord<String, String> record;
        try (var ignored = Context.root().with(Span.wrap(spanContext)).makeCurrent()) {
            record = KafkaTracePropagation.inject(new ProducerRecord<>("topic", "key", "payload"));
        }

        assertThat(new String(record.headers().lastHeader("traceparent").value()))
                .isEqualTo("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01");
        assertThat(record.value()).isEqualTo("payload");
    }
}
