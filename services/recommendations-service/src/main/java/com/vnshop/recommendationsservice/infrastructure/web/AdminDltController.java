package com.vnshop.recommendationsservice.infrastructure.web;

import com.vnshop.recommendationsservice.infrastructure.dlt.DurableDltService;
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
public class AdminDltController {
    private final DurableDltService service;
    private final KafkaTemplate<String, Object> kafka;

    public AdminDltController(DurableDltService service, KafkaTemplate<String, Object> kafka) {
        this.service = service;
        this.kafka = kafka;
    }

    @PostMapping("/{id}/replay")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> replay(@PathVariable UUID id) {
        service.replay(id, kafka);
        return ResponseEntity.accepted().build();
    }
}
