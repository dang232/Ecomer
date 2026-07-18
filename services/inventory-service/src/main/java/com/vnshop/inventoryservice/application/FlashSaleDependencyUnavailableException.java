package com.vnshop.inventoryservice.application;

public class FlashSaleDependencyUnavailableException extends RuntimeException {
    public FlashSaleDependencyUnavailableException(Throwable cause) {
        super("flash-sale reservation dependency is unavailable", cause);
    }
}
