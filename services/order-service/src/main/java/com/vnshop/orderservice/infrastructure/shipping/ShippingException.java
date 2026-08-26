package com.vnshop.orderservice.infrastructure.shipping;

public class ShippingException extends RuntimeException {
    private final String code;

    public ShippingException(String code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    public String code() {
        return code;
    }
}
