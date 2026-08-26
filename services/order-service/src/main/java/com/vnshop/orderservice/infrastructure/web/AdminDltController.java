package com.vnshop.orderservice.infrastructure.web;

import com.vnshop.orderservice.infrastructure.dlt.DurableDltService;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController @RequestMapping("/admin/dlt")
public class AdminDltController {
    private final DurableDltService service; private final KafkaTemplate<String, Object> template;
    public AdminDltController(DurableDltService service, KafkaTemplate<String, Object> template) { this.service = service; this.template = template; }
    @PostMapping("/{id}/replay") @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> replay(@PathVariable UUID id) { service.replay(id, template); return ResponseEntity.accepted().build(); }
}
