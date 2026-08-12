package com.vnshop.couponservice.infrastructure.web;

import com.vnshop.couponservice.application.CouponDomainException;
import com.vnshop.couponservice.application.CouponNotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Translates application-layer signals into HTTP responses. Keeps the
 * controller free of {@code ResponseStatusException} plumbing.
 */
@RestControllerAdvice
public class CouponExceptionHandler {

    @ExceptionHandler(CouponNotFoundException.class)
    public ResponseEntity<String> handleNotFound(CouponNotFoundException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
    }

    @ExceptionHandler(CouponDomainException.class)
    public ResponseEntity<String> handleDomain(CouponDomainException e) {
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(e.getMessage());
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<String> handleDuplicateUsage(DataIntegrityViolationException e) {
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
                .body("Coupon already used by this user");
    }
}
