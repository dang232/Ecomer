package com.vnshop.orderservice.infrastructure.cart;

public class CartUnavailableException extends RuntimeException {
    private final String code = "CART_UNAVAILABLE";
    public CartUnavailableException(String message) {
        super(message);
    }

    public CartUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }

    public String code() {
        return code;
    }
}
