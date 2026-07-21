package com.vnshop.shippingservice.infrastructure.web;

import com.vnshop.shippingservice.application.ReceiveCarrierWebhookUseCase;
import com.vnshop.shippingservice.infrastructure.webhook.GhnWebhookMapper;
import com.vnshop.shippingservice.infrastructure.webhook.GhnWebhookPayload;
import com.vnshop.shippingservice.infrastructure.webhook.GhnWebhookSignatureService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/webhooks/ghn")
public class GhnWebhookController {
    private static final Logger LOG = LoggerFactory.getLogger(GhnWebhookController.class);

    private final ReceiveCarrierWebhookUseCase receiveWebhook;
    private final GhnWebhookSignatureService signatureService;
    private final GhnWebhookMapper mapper;

    public GhnWebhookController(
            ReceiveCarrierWebhookUseCase receiveWebhook,
            GhnWebhookSignatureService signatureService,
            GhnWebhookMapper mapper) {
        this.receiveWebhook = receiveWebhook;
        this.signatureService = signatureService;
        this.mapper = mapper;
    }

    @PostMapping
    public ResponseEntity<Map<String, Object>> handleWebhook(
            @RequestBody GhnWebhookPayload payload,
            @RequestHeader(value = "X-GHN-Signature", required = false) String signature,
            @RequestHeader(value = "X-GHN-Token", required = false) String token) {
        String orderCode = payload == null ? "unknown" : payload.orderCode();
        if (payload == null || payload.orderCode() == null || payload.orderCode().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("error", "Missing required field: OrderCode"));
        }

        if (!signatureService.isValid(payload, signature, token)) {
            LOG.warn("Invalid GHN webhook credentials for order {}", orderCode);
            return ResponseEntity.status(401).body(Map.of("error", "Invalid signature"));
        }

        try {
            ReceiveCarrierWebhookUseCase.Result result = receiveWebhook.receive(mapper.toEvent(payload));
            return ResponseEntity.ok(Map.of("status", result == ReceiveCarrierWebhookUseCase.Result.DUPLICATE
                    ? "duplicate" : "ok"));
        } catch (RuntimeException e) {
            LOG.error("Unable to durably accept GHN webhook for order {}", orderCode, e);
            return ResponseEntity.status(503)
                    .body(Map.of("status", "error", "message", "Event delivery unavailable"));
        }
    }
}
