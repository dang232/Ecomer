package com.vnshop.recommendationsservice.infrastructure.dlt;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

@Service
public class DurableDltListener {
    private final DurableDltService service;

    public DurableDltListener(DurableDltService service) {
        this.service = service;
    }

    @KafkaListener(topics = "order.created.DLT", groupId = "recommendations-service-durable-dlt")
    public void onDlt(ConsumerRecord<String, String> record) {
        service.store(record, "order.created DLT payload received", 3);
    }
}
