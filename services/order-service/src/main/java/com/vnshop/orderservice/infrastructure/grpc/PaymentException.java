package com.vnshop.orderservice.infrastructure.grpc;

public class PaymentException extends RuntimeException {
    private final String code;

    public PaymentException(String code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    public String code() {
        return code;
    }
}
