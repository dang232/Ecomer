package com.vnshop.inventoryservice.application;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.UUID;

public record ReserveFlashSaleCommand(
        String productId,
        String buyerId,
        int quantity,
        String idempotencyKey,
        String requestHash
) {
    public ReserveFlashSaleCommand(String productId, String buyerId, int quantity) {
        this(productId, buyerId, quantity, UUID.randomUUID().toString(), hash(productId, quantity));
    }

    public ReserveFlashSaleCommand {
        if (productId == null || productId.isBlank() || buyerId == null || buyerId.isBlank()) {
            throw new IllegalArgumentException("productId and buyerId are required");
        }
        if (quantity < 1 || quantity > 5) {
            throw new IllegalArgumentException("quantity must be between 1 and 5");
        }
        if (idempotencyKey == null || idempotencyKey.isBlank() || idempotencyKey.length() > 200) {
            throw new IllegalArgumentException("Idempotency-Key is required and must be at most 200 characters");
        }
        if (requestHash == null || requestHash.isBlank()) {
            throw new IllegalArgumentException("request hash is required");
        }
    }

    private static String hash(String productId, int quantity) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest((productId + "\n" + quantity).getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }
}
