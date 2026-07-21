package com.vnshop.shippingservice.infrastructure.web;

import com.vnshop.shippingservice.application.ReceiveCarrierWebhookUseCase;
import com.vnshop.shippingservice.infrastructure.webhook.GhtkWebhookMapper;
import com.vnshop.shippingservice.infrastructure.webhook.GhtkWebhookPayload;
import com.vnshop.shippingservice.infrastructure.webhook.GhtkWebhookSignatureService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/webhooks/ghtk")
public class GhtkWebhookController {
    private static final Logger LOG = LoggerFactory.getLogger(GhtkWebhookController.class);

    private final ReceiveCarrierWebhookUseCase receiveWebhook;
    private final GhtkWebhookSignatureService signatureService;
    private final GhtkWebhookMapper mapper;

    public GhtkWebhookController(
            ReceiveCarrierWebhookUseCase receiveWebhook,
            GhtkWebhookSignatureService signatureService,
            GhtkWebhookMapper mapper) {
        this.receiveWebhook = receiveWebhook;
        this.signatureService = signatureService;
        this.mapper = mapper;
    }

    @PostMapping(consumes = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> handleJsonWebhook(
            @RequestBody GhtkWebhookPayload payload,
            @RequestHeader(value = "X-GHTK-Signature", required = false) String signature) {
        return process(payload, signature);
    }

    @PostMapping(consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    public ResponseEntity<Map<String, Object>> handleFormWebhook(
            @RequestParam Map<String, String> form,
            @RequestHeader(value = "X-GHTK-Signature", required = false) String signature) {
        GhtkWebhookPayload payload = new GhtkWebhookPayload(
                first(form, "label_id", "label", "tracking_code"),
                first(form, "status", "status_id"),
                first(form, "status_text", "reason"),
                first(form, "updated_at", "action_time"),
                first(form, "order_id", "order_code"));
        return process(payload, signature);
    }

    private ResponseEntity<Map<String, Object>> process(GhtkWebhookPayload payload, String signature) {
        String labelId = payload == null ? "unknown" : payload.labelId();
        if (payload == null || labelId == null || labelId.isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Missing required field: label_id"));
        }

        if (!signatureService.isValid(payload, signature)) {
            LOG.warn("Invalid GHTK webhook credentials for label {}", labelId);
            return ResponseEntity.status(401).body(Map.of("error", "Invalid signature"));
        }

        try {
            ReceiveCarrierWebhookUseCase.Result result = receiveWebhook.receive(mapper.toEvent(payload));
            return ResponseEntity.ok(Map.of("status", result == ReceiveCarrierWebhookUseCase.Result.DUPLICATE
                    ? "duplicate" : "ok"));
        } catch (RuntimeException e) {
            LOG.error("Unable to durably accept GHTK webhook for label {}", labelId, e);
            return ResponseEntity.status(503)
                    .body(Map.of("status", "error", "message", "Event delivery unavailable"));
        }
    }

    private String first(Map<String, String> values, String... names) {
        for (String name : names) {
            String value = values.get(name);
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }
}
