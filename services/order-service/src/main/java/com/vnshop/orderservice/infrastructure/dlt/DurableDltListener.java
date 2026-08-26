package com.vnshop.orderservice.infrastructure.dlt;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

@Service
public class DurableDltListener {
    private final DurableDltService service;
    public DurableDltListener(DurableDltService service) { this.service = service; }
    @KafkaListener(topics = {"order.created.DLT", "order.updated.DLT", "order.paid.DLT", "order.shipped.DLT", "order.cancelled.DLT", "order.confirmed.DLT", "order.delivered.DLT", "payment.completed.DLT", "payment.refunded.DLT", "payment.chargeback.created.DLT", "payment.chargeback.resolved.DLT", "inventory.released.DLT", "shipping.cancelled.DLT"}, groupId = "order-service-durable-dlt", concurrency = "3")
    public void onDlt(ConsumerRecord<String, String> record) { service.store(record, "Kafka DLT listener received exhausted record", 3); }
}
