package com.vnshop.paymentservice.domain;

import java.time.Instant;
import java.util.UUID;

public record PaymentCallbackLogEntry(
        UUID callbackId,
        String provider,
        String eventId,
        String payloadHash,
        String signatureHash,
        String headersJson,
        String bodyJson,
        Instant receivedAt,
        String processingStatus,
        boolean duplicateReplay
) {
}
