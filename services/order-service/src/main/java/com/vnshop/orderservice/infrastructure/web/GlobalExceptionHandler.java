package com.vnshop.orderservice.infrastructure.web;

import com.vnshop.orderservice.application.OrderAccessDeniedException;
import com.vnshop.orderservice.application.CheckoutOrderUseCase;
import com.vnshop.orderservice.domain.InvoiceAccessDeniedException;
import com.vnshop.orderservice.infrastructure.cart.CartUnavailableException;
import com.vnshop.orderservice.infrastructure.product.ProductCatalogUnavailableException;
import com.vnshop.orderservice.infrastructure.grpc.PaymentException;
import com.vnshop.orderservice.infrastructure.shipping.ShippingException;
import com.vnshop.orderservice.infrastructure.dlt.DurableDltReplayConflictException;
import io.opentelemetry.api.trace.Span;
import jakarta.validation.ConstraintViolationException;
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
@org.springframework.web.bind.annotation.RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(DurableDltReplayConflictException.class)
    public ResponseEntity<ErrorResponse> dltReplayConflict(DurableDltReplayConflictException ex) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(ErrorResponse.of("DLT_REPLAY_CONFLICT", ex.getMessage(), traceId()));
    }

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
        if ("invalid_page_size".equals(ex.getMessage())) {
            return ResponseEntity.badRequest()
                .body(ErrorResponse.of("invalid_page_size", "invalid_page_size", traceId()));
        }
        return ResponseEntity.badRequest()
            .body(ErrorResponse.of("BAD_REQUEST", ex.getMessage(), traceId()));
    }

    @ExceptionHandler(NumberFormatException.class)
    public ResponseEntity<ErrorResponse> numberFormatException(NumberFormatException ex) {
        return ResponseEntity.badRequest()
            .body(ErrorResponse.of("BAD_REQUEST", "Invalid numeric value: " + ex.getMessage(), traceId()));
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<ErrorResponse> constraintViolation(ConstraintViolationException ex) {
        List<String> details = ex.getConstraintViolations().stream()
            .map(v -> v.getPropertyPath() + ": " + v.getMessage())
            .toList();
        return ResponseEntity.badRequest()
            .body(ErrorResponse.of("VALIDATION_ERROR", "Constraint violation", details, traceId()));
    }

    // --- 401 / 403 -------------------------------------------------------------

    @ExceptionHandler(InvoiceAccessDeniedException.class)
    public ResponseEntity<ErrorResponse> invoiceAccessDenied(InvoiceAccessDeniedException ex) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(ErrorResponse.of("INVOICE_ACCESS_DENIED", ex.getMessage(), traceId()));
    }

    @ExceptionHandler(OrderAccessDeniedException.class)
    public ResponseEntity<ErrorResponse> orderAccessDenied(OrderAccessDeniedException ex) {
        log.warn("order-access-denied: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
            .body(ErrorResponse.of("ORDER_ACCESS_DENIED", "Not authorized for this order", traceId()));
    }

    // --- 404 Not Found ---------------------------------------------------------

    @ExceptionHandler(CheckoutOrderUseCase.ProductNotFoundException.class)
    public ResponseEntity<ErrorResponse> productNotFound(CheckoutOrderUseCase.ProductNotFoundException ex) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
            .body(ErrorResponse.of("PRODUCT_NOT_FOUND", ex.getMessage(), traceId()));
    }

    // --- 503 Service Unavailable -----------------------------------------------

    @ExceptionHandler(ProductCatalogUnavailableException.class)
    public ResponseEntity<ErrorResponse> productCatalogUnavailable(ProductCatalogUnavailableException ex) {
        log.warn("product-catalog-unavailable: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
            .body(ErrorResponse.of("PRODUCT_CATALOG_UNAVAILABLE", "Product catalog is temporarily unavailable", traceId()));
    }

    @ExceptionHandler(CartUnavailableException.class)
    public ResponseEntity<ErrorResponse> cartUnavailable(CartUnavailableException ex) {
        log.warn("cart-unavailable: {}", ex.getMessage());
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
            .body(ErrorResponse.of("CART_UNAVAILABLE", "Cart service is temporarily unavailable", traceId()));
    }

    @ExceptionHandler(ShippingException.class)
    public ResponseEntity<ErrorResponse> shippingUnavailable(ShippingException ex) {
        log.warn("shipping-quote-failed code={} traceId={}", ex.code(), traceId(), ex);
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
            .body(ErrorResponse.of(ex.code(), "Shipping service is temporarily unavailable", traceId()));
    }

    @ExceptionHandler(PaymentException.class)
    public ResponseEntity<ErrorResponse> paymentFailure(PaymentException ex) {
        log.error("payment-request-failed code={} traceId={}", ex.code(), traceId(), ex);
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
            .body(ErrorResponse.of(ex.code(), "Payment service is temporarily unavailable", traceId()));
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
        // OTEL returns "0000000000000000" when there is no active span
        return "0000000000000000".equals(id) ? null : id;
    }
}
