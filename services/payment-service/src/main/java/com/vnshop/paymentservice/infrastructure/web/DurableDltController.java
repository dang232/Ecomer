package com.vnshop.paymentservice.infrastructure.web;

import com.vnshop.paymentservice.infrastructure.dlt.DurableDltService;
import com.vnshop.paymentservice.domain.DurableDltRecord;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/admin/dlt")
public class DurableDltController {
    private final DurableDltService durableDltService;
    private final KafkaTemplate<String, Object> kafkaTemplate;

    public DurableDltController(DurableDltService durableDltService, KafkaTemplate<String, Object> kafkaTemplate) {
        this.durableDltService = durableDltService;
        this.kafkaTemplate = kafkaTemplate;
    }

    @PostMapping("/{id}/replay")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<DurableDltRecord> replay(@PathVariable UUID id) {
        return ResponseEntity.accepted().body(durableDltService.replay(id, kafkaTemplate));
    }
}
