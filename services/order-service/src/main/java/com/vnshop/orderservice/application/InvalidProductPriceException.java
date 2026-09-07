package com.vnshop.orderservice.application;

public class InvalidProductPriceException extends RuntimeException {
    public InvalidProductPriceException(String message) {
        super(message);
    }
}
