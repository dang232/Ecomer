package com.vnshop.productservice.application;

public class ValidationException extends RuntimeException {
    private final String code;

    public ValidationException(String code, String message, Throwable cause) {
        super(message, cause);
        this.code = code;
    }

    public String code() {
        return code;
    }
}
