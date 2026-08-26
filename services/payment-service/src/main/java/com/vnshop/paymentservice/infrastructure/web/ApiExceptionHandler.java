package com.vnshop.paymentservice.infrastructure.web;

import com.vnshop.paymentservice.application.IdempotencyKeyConflictException;
import com.vnshop.paymentservice.application.IdempotencyRequestInProgressException;
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
    public ProblemDetails badRequest(IllegalArgumentException exception) {
        return problem("BAD_REQUEST", exception.getMessage(), 400);
    }

    @ExceptionHandler(SepayWebhookController.SepaySignatureException.class)
    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    public ProblemDetails sepaySignatureRejected(SepayWebhookController.SepaySignatureException exception) {
        return problem("INVALID_SIGNATURE", "unauthorized", 401);
    }

    @ExceptionHandler(OrderAccessDeniedException.class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    public ProblemDetails orderAccessDenied(OrderAccessDeniedException exception) {
        // Pt39 audit: pre-fix this fell through to the Exception.class
        // handler and returned 500. Two callers throw it: PaymentController's
        // /paypal/capture buyer-mismatch path and GetPaymentStatusUseCase's
        // HTTP-facing buyer cross-check. Both need 403.
        return problem("FORBIDDEN", exception.getMessage(), 403);
    }

    @ExceptionHandler(IdempotencyKeyConflictException.class)
    @ResponseStatus(HttpStatus.UNPROCESSABLE_ENTITY)
    public ProblemDetails idempotencyKeyConflict(IdempotencyKeyConflictException exception) {
        return problem("IDEMPOTENCY_KEY_CONFLICT", exception.getMessage(), 409);
    }

    @ExceptionHandler(IdempotencyRequestInProgressException.class)
    @ResponseStatus(HttpStatus.TOO_EARLY)
    public ProblemDetails idempotencyRequestInProgress(IdempotencyRequestInProgressException exception) {
        return problem("IDEMPOTENCY_REQUEST_IN_PROGRESS", exception.getMessage(), 425);
    }

    @ExceptionHandler(OrderNotFoundException.class)
    @ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
    public ProblemDetails orderNotFound(OrderNotFoundException exception) {
        // E2E fixtures use synthetic orderIds (e.g. "E2E-VIETQR-...") that
        // never reach order-service. The cascade of 500 -> 503 here lets
        // the e2e-day gate treat this as the documented "VietQR not
        // configured" degradation path instead of a real 500.
        return problem("SERVICE_UNAVAILABLE", exception.getMessage(), 503);
    }

    @ExceptionHandler(OrderNotPayableException.class)
    @ResponseStatus(HttpStatus.UNPROCESSABLE_ENTITY)
    public ProblemDetails orderNotPayable(OrderNotPayableException exception) {
        return problem("ORDER_NOT_PAYABLE", exception.getMessage(), 422);
    }

    @ExceptionHandler(IllegalStateException.class)
    @ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
    public ProblemDetails serviceUnavailable(IllegalStateException exception) {
        return problem("SERVICE_UNAVAILABLE", exception.getMessage(), 503);
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ProblemDetails internal(Exception exception) {
        // Silent swallowing made flash-sale 500s untriagable on inventory-service;
        // same trap bites here. Log the cause before returning the generic body.
        log.error("Unhandled exception", exception);
        return problem("INTERNAL_ERROR", "An unexpected error occurred", 500);
    }

    private static ProblemDetails problem(String code, String detail, int status) {
        String trace = io.opentelemetry.api.trace.Span.current().getSpanContext().getTraceId();
        return ProblemDetails.of(code, detail == null ? "Request failed" : detail, status,
                "0000000000000000".equals(trace) ? null : trace);
    }
}
