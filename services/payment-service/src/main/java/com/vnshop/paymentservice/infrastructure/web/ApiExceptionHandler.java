package com.vnshop.paymentservice.infrastructure.web;

import com.vnshop.paymentservice.application.IdempotencyKeyConflictException;
import com.vnshop.paymentservice.application.OrderAccessDeniedException;
import com.vnshop.paymentservice.application.OrderNotFoundException;
import com.vnshop.paymentservice.application.OrderNotPayableException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> badRequest(IllegalArgumentException exception) {
        return ApiResponse.error(exception.getMessage(), "BAD_REQUEST");
    }

    @ExceptionHandler(SepayWebhookController.SepaySignatureException.class)
    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    public ApiResponse<Void> sepaySignatureRejected(SepayWebhookController.SepaySignatureException exception) {
        return ApiResponse.error("unauthorized", "INVALID_SIGNATURE");
    }

    @ExceptionHandler(OrderAccessDeniedException.class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    public ApiResponse<Void> orderAccessDenied(OrderAccessDeniedException exception) {
        // Pt39 audit: pre-fix this fell through to the Exception.class
        // handler and returned 500. Two callers throw it: PaymentController's
        // /paypal/capture buyer-mismatch path and GetPaymentStatusUseCase's
        // HTTP-facing buyer cross-check. Both need 403.
        return ApiResponse.error(exception.getMessage(), "FORBIDDEN");
    }

    @ExceptionHandler(IdempotencyKeyConflictException.class)
    @ResponseStatus(HttpStatus.UNPROCESSABLE_ENTITY)
    public ApiResponse<Void> idempotencyKeyConflict(IdempotencyKeyConflictException exception) {
        return ApiResponse.error(exception.getMessage(), "IDEMPOTENCY_KEY_CONFLICT");
    }

    @ExceptionHandler(OrderNotFoundException.class)
    @ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
    public ApiResponse<Void> orderNotFound(OrderNotFoundException exception) {
        // E2E fixtures use synthetic orderIds (e.g. "E2E-VIETQR-...") that
        // never reach order-service. The cascade of 500 -> 503 here lets
        // the e2e-day gate treat this as the documented "VietQR not
        // configured" degradation path instead of a real 500.
        return ApiResponse.error(exception.getMessage(), "SERVICE_UNAVAILABLE");
    }

    @ExceptionHandler(OrderNotPayableException.class)
    @ResponseStatus(HttpStatus.UNPROCESSABLE_ENTITY)
    public ApiResponse<Void> orderNotPayable(OrderNotPayableException exception) {
        return ApiResponse.error(exception.getMessage(), "ORDER_NOT_PAYABLE");
    }

    @ExceptionHandler(IllegalStateException.class)
    @ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
    public ApiResponse<Void> serviceUnavailable(IllegalStateException exception) {
        return ApiResponse.error(exception.getMessage(), "SERVICE_UNAVAILABLE");
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ApiResponse<Void> internal(Exception exception) {
        // Silent swallowing made flash-sale 500s untriagable on inventory-service;
        // same trap bites here. Log the cause before returning the generic body.
        log.error("Unhandled exception", exception);
        return ApiResponse.error("An unexpected error occurred", "INTERNAL_ERROR");
    }
}
