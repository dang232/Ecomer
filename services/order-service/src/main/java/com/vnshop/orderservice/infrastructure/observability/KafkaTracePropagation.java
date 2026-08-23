package com.vnshop.orderservice.infrastructure.observability;

import io.opentelemetry.api.trace.propagation.W3CTraceContextPropagator;
import io.opentelemetry.context.Context;
import io.opentelemetry.context.propagation.TextMapSetter;
import java.nio.charset.StandardCharsets;
import org.apache.kafka.clients.producer.ProducerRecord;

public final class KafkaTracePropagation {
    private static final TextMapSetter<ProducerRecord<?, ?>> SETTER = (carrier, key, value) -> {
        if (carrier != null && value != null) {
            carrier.headers().remove(key);
            carrier.headers().add(key, value.getBytes(StandardCharsets.UTF_8));
        }
    };

    private KafkaTracePropagation() {
    }

    public static <K, V> ProducerRecord<K, V> inject(ProducerRecord<K, V> record) {
        W3CTraceContextPropagator.getInstance().inject(Context.current(), record, SETTER);
        return record;
    }

}
