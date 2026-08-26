package com.vnshop.paymentservice.infrastructure.web;

import com.vnshop.paymentservice.application.IdempotencyKeyConflictException;
import com.vnshop.paymentservice.application.DurableDltReplayConflictException;
import com.vnshop.paymentservice.application.OrderAccessDeniedException;
import com.vnshop.paymentservice.application.OrderNotFoundException;
import com.vnshop.paymentservice.application.OrderNotPayableException;
import com.vnshop.paymentservice.application.PaymentNotRefundableException;
import com.vnshop.paymentservice.application.UnsupportedPaymentMethodException;
import com.vnshop.paymentservice.application.chargeback.ChargebackNotFoundException;
import io.opentelemetry.api.trace.Span;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.List;

/**
 * Centralized exception handler that returns the standard VNShop error shape:
 * { code, message, details, timestamp, traceId }
 *
 * traceId is pulled from the active OTEL span so callers can correlate with traces.
 */
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    // --- 400 Bad Request -------------------------------------------------------

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> validationError(MethodArgumentNotValidException ex) {
        List<String> details = ex.getBindingResult().getAllErrors().stream()
            .map(err -> err instanceof FieldError fe
                ? fe.getField() + ": " + fe.getDefaultMessage()
                : err.getDefaultMessage())
            .toList();
        return ResponseEntity.badRequest()
            .body(ErrorResponse.of("VALIDATION_ERROR", "Request validation failed", details, traceId()));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ErrorResponse> badRequest(IllegalArgumentException ex) {
        return ResponseEntity.badRequest()
            .body(ErrorResponse.of("BAD_REQUEST", ex.getMessage(), traceId()));
    }

    @ExceptionHandler(UnsupportedPaymentMethodException.class)
    public ResponseEntity<ErrorResponse> unsupportedPaymentMethod(UnsupportedPaymentMethodException ex) {
        return ResponseEntity.badRequest()
            .body(ErrorResponse.of("UNSUPPORTED_PAYMENT_METHOD", ex.getMessage(), traceId()));
    }

    // --- 401 Unauthorized / 403 Forbidden --------------------------------------

    @ExceptionHandler(SepayWebhookController.SepaySignatureException.class)
    public ResponseEntity<ErrorResponse> sepaySignatureRejected(SepayWebhookController.SepaySignatureException ex) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
            .body(ErrorResponse.of("INVALID_SIGNATURE", "Webhook signature validation failed", traceId()));
    }

    @ExceptionHandler(OrderAccessDeniedException.class)
    public ResponseEntity<ErrorResponse> orderAccessDenied(OrderAccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(ErrorResponse.of("PAYMENT_ACCESS_DENIED", ex.getMessage(), traceId()));
    }

    // --- 404 Not Found ---------------------------------------------------------

    @ExceptionHandler(OrderNotFoundException.class)
    public ResponseEntity<ErrorResponse> orderNotFound(OrderNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(ErrorResponse.of("ORDER_NOT_FOUND", ex.getMessage(), traceId()));
    }

    @ExceptionHandler(ChargebackNotFoundException.class)
    public ResponseEntity<ErrorResponse> chargebackNotFound(ChargebackNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(ErrorResponse.of("CHARGEBACK_NOT_FOUND", ex.getMessage(), traceId()));
    }

    // --- 409 Conflict ----------------------------------------------------------

    @ExceptionHandler(DurableDltReplayConflictException.class)
    public ResponseEntity<ErrorResponse> dltReplayConflict(DurableDltReplayConflictException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(ErrorResponse.of("DLT_REPLAY_CONFLICT", ex.getMessage(), traceId()));
    }

    @ExceptionHandler(IdempotencyKeyConflictException.class)
    public ResponseEntity<ErrorResponse> idempotencyKeyConflict(IdempotencyKeyConflictException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT)
            .body(ErrorResponse.of("IDEMPOTENCY_KEY_CONFLICT", ex.getMessage(), traceId()));
    }

    // --- 422 Unprocessable Entity ----------------------------------------------

    @ExceptionHandler(OrderNotPayableException.class)
    public ResponseEntity<ErrorResponse> orderNotPayable(OrderNotPayableException ex) {
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
            .body(ErrorResponse.of("ORDER_NOT_PAYABLE", ex.getMessage(), traceId()));
    }

    @ExceptionHandler(PaymentNotRefundableException.class)
    public ResponseEntity<ErrorResponse> paymentNotRefundable(PaymentNotRefundableException ex) {
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY)
            .body(ErrorResponse.of("PAYMENT_NOT_REFUNDABLE", ex.getMessage(), traceId()));
    }

    // --- 503 Service Unavailable -----------------------------------------------

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<ErrorResponse> serviceUnavailable(IllegalStateException ex) {
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
            .body(ErrorResponse.of("SERVICE_UNAVAILABLE", ex.getMessage(), traceId()));
    }

    // --- 500 Internal Server Error ---------------------------------------------

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> internal(Exception ex) {
        log.error("Unhandled exception", ex);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
            .body(ErrorResponse.of("INTERNAL_ERROR", "An unexpected error occurred", traceId()));
    }

    // ---------------------------------------------------------------------------

    private static String traceId() {
        String id = Span.current().getSpanContext().getTraceId();
        return "0000000000000000".equals(id) ? null : id;
    }
}
