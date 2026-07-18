package com.vnshop.paymentservice.infrastructure.web;

import com.vnshop.paymentservice.application.chargeback.ChargebackNotFoundException;
import com.vnshop.paymentservice.application.chargeback.ChargebackService;
import com.vnshop.paymentservice.domain.Chargeback;
import io.swagger.v3.oas.annotations.Hidden;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.Objects;
import java.util.UUID;

/**
 * Admin-only API for chargeback counter-evidence and acceptance.
 * Both endpoints require the {@code ROLE_ADMIN} authority.
 */
@RestController
@Hidden
@RequestMapping("/api/v1/chargebacks")
@PreAuthorize("hasRole('ADMIN')")
public class AdminChargebackController {

    private final ChargebackService chargebackService;

    public AdminChargebackController(ChargebackService chargebackService) {
        this.chargebackService = Objects.requireNonNull(chargebackService, "chargebackService is required");
    }

    /**
     * Submit counter-evidence JSON for an open chargeback.
     * Body: {@code { "evidenceJson": "..." }}
     */
    @PostMapping("/{id}/counter")
    public ResponseEntity<ApiResponse<ChargebackResponse>> submitCounterEvidence(
            @PathVariable UUID id,
            @RequestBody Map<String, String> body) {

        String evidenceJson = body.get("evidenceJson");
        if (evidenceJson == null || evidenceJson.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("evidenceJson is required", "BAD_REQUEST"));
        }
        try {
            Chargeback updated = chargebackService.submitCounterEvidence(id, evidenceJson);
            return ResponseEntity.ok(ApiResponse.ok(ChargebackResponse.from(updated)));
        } catch (ChargebackNotFoundException ex) {
            return ResponseEntity.status(404)
                    .body(ApiResponse.error(ex.getMessage(), "NOT_FOUND"));
        }
    }

    /**
     * Accept (concede) a chargeback — marks it ACCEPTED.
     */
    @PostMapping("/{id}/accept")
    public ResponseEntity<ApiResponse<ChargebackResponse>> accept(@PathVariable UUID id) {
        try {
            Chargeback updated = chargebackService.accept(id);
            return ResponseEntity.ok(ApiResponse.ok(ChargebackResponse.from(updated)));
        } catch (ChargebackNotFoundException ex) {
            return ResponseEntity.status(404)
                    .body(ApiResponse.error(ex.getMessage(), "NOT_FOUND"));
        }
    }

    public record ChargebackResponse(UUID id, String orderId, String provider,
                                     String reason, String status, String evidenceJson) {
        static ChargebackResponse from(Chargeback cb) {
            return new ChargebackResponse(cb.id(), cb.orderId(),
                    cb.provider().name(), cb.reason(), cb.status().name(), cb.evidenceJson());
        }
    }
}
