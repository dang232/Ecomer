package com.vnshop.userservice.infrastructure.web;

import com.vnshop.userservice.application.GdprDeleteUseCase;
import com.vnshop.userservice.application.GdprExportUseCase;
import com.vnshop.userservice.domain.GdprExportRequest;
import io.swagger.v3.oas.annotations.Hidden;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import java.util.Map;

@RestController
@Hidden
@RequestMapping("/api/v1/gdpr")
public class GdprController {
    private static final Logger log = LoggerFactory.getLogger(GdprController.class);

    private final GdprExportUseCase exportUseCase;
    private final GdprDeleteUseCase deleteUseCase;

    public GdprController(GdprExportUseCase exportUseCase, GdprDeleteUseCase deleteUseCase) {
        this.exportUseCase = exportUseCase;
        this.deleteUseCase = deleteUseCase;
    }

    @PostMapping("/export/{userId}")
    @PreAuthorize("#userId == authentication.name or hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> requestExport(@PathVariable String userId) {
        try {
            String requestId = exportUseCase.initiateExport(userId);
            return ResponseEntity.accepted().body(Map.of("requestId", requestId, "status", "PENDING"));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(429).body(Map.of("error", e.getMessage()));
        } catch (Exception e) {
            log.error("Failed to initiate GDPR export for userId={}", userId, e);
            return ResponseEntity.internalServerError().body(Map.of("error", "Export request failed"));
        }
    }

    @GetMapping("/export/{userId}/status/{requestId}")
    @PreAuthorize("#userId == authentication.name or hasRole('ADMIN')")
    public ResponseEntity<Map<String, Object>> getExportStatus(
            @PathVariable String userId, @PathVariable String requestId) {
        try {
            GdprExportRequest request = exportUseCase.getExportStatus(userId, requestId);
            return ResponseEntity.ok(Map.of(
                    "requestId", request.getRequestId(),
                    "status", request.getStatus().name(),
                    "missingServices", request.getMissingServices()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("Failed to retrieve GDPR export status for userId={} requestId={}", userId, requestId, e);
            return ResponseEntity.internalServerError().build();
        }
    }

    @DeleteMapping("/delete/{userId}")
    @PreAuthorize("#userId == authentication.name or hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> requestDeletion(@PathVariable String userId) {
        try {
            String requestId = deleteUseCase.initiateDelete(userId);
            return ResponseEntity.accepted().body(Map.of("requestId", requestId, "status", "DELETION_INITIATED"));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("Failed to initiate GDPR deletion for userId={}", userId, e);
            return ResponseEntity.internalServerError().body(Map.of("error", "Deletion request failed"));
        }
    }
}
