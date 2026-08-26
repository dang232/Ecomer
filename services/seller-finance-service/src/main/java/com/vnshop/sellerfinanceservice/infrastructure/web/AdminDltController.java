package com.vnshop.sellerfinanceservice.infrastructure.web;

import com.vnshop.sellerfinanceservice.infrastructure.dlt.DurableDltService;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;

@RestController
@ConditionalOnBean(DurableDltService.class)
@RequestMapping("/admin/dlt")
public class AdminDltController {
    private final DurableDltService service;
    private final KafkaTemplate<String, Object> kafka;
    public AdminDltController(DurableDltService service, KafkaTemplate<String, Object> kafka) { this.service = service; this.kafka = kafka; }
    @PostMapping("/{id}/replay")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> replay(@PathVariable UUID id) { service.replay(id, kafka); return ResponseEntity.accepted().build(); }
}
