package com.vnshop.couponservice.application;

/**
 * Application-layer signal that the application step failed an aggregate
 * invariant the caller can recover from with a 422 response. The web layer
 * maps this onto {@code UNPROCESSABLE_ENTITY}.
 */
public class CouponDomainException extends RuntimeException {
    public CouponDomainException(String message) {
        super(message);
    }

    public CouponDomainException(String message, Throwable cause) {
        super(message, cause);
    }
}
