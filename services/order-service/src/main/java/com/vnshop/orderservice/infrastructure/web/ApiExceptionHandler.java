package com.vnshop.orderservice.infrastructure.web;

import com.vnshop.orderservice.application.CheckoutOrderUseCase;
import com.vnshop.orderservice.application.FindOrderByIdempotencyKeyUseCase.OrderByIdempotencyKeyNotFoundException;
import com.vnshop.orderservice.application.OrderAccessDeniedException;
import com.vnshop.orderservice.application.ListReturnsUseCase.ReturnNotFoundException;
import com.vnshop.orderservice.domain.InvoiceAccessDeniedException;
import com.vnshop.orderservice.domain.coupon.CouponException;
import com.vnshop.orderservice.infrastructure.cart.CartUnavailableException;
import com.vnshop.orderservice.infrastructure.product.ProductCatalogUnavailableException;
import com.vnshop.orderservice.infrastructure.grpc.PaymentException;
import com.vnshop.orderservice.infrastructure.shipping.ShippingException;
import io.opentelemetry.api.trace.Span;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.security.authorization.AuthorizationDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import com.vnshop.orderservice.infrastructure.web.pagination.AdminCursorCodec.InvalidCursorException;

@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(InvoiceAccessDeniedException.class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    public ProblemDetails forbidden(InvoiceAccessDeniedException exception) {
        return problem("INVOICE_ACCESS_DENIED", exception.getMessage(), 403);
    }

    @ExceptionHandler(AuthorizationDeniedException.class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    public ProblemDetails authorizationDenied(AuthorizationDeniedException exception) {
        log.warn("authorization-denied: {}", exception.getMessage());
        return problem("FORBIDDEN", "Not authorized", 403);
    }

    @ExceptionHandler(OrderAccessDeniedException.class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    public ProblemDetails orderAccessDenied(OrderAccessDeniedException exception) {
        log.warn("order-access-denied: {}", exception.getMessage());
        return problem("ORDER_ACCESS_DENIED", "Not authorized for this order", 403);
    }

    @ExceptionHandler(ReturnNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ProblemDetails returnNotFound(ReturnNotFoundException exception) {
        return problem("NOT_FOUND", "Resource not found", 404);
    }

    @ExceptionHandler(OrderByIdempotencyKeyNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ProblemDetails idempotencyKeyOrderNotFound(OrderByIdempotencyKeyNotFoundException exception) {
        return problem("NOT_FOUND", "Resource not found", 404);
    }

    @ExceptionHandler(CheckoutOrderUseCase.ProductNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ProblemDetails productNotFound(CheckoutOrderUseCase.ProductNotFoundException exception) {
        return problem("PRODUCT_NOT_FOUND", exception.getMessage(), 404);
    }

    @ExceptionHandler(ProductCatalogUnavailableException.class)
    @ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
    public ProblemDetails productCatalogDown(ProductCatalogUnavailableException exception) {
        log.warn("product-catalog-unavailable: {}", exception.getMessage());
        return problem("PRODUCT_CATALOG_UNAVAILABLE", "Product catalog is temporarily unavailable", 503);
    }

    @ExceptionHandler(CartUnavailableException.class)
    @ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
    public ProblemDetails cartUnavailable(CartUnavailableException exception) {
        log.warn("cart-unavailable: {}", exception.getMessage());
        return problem("CART_UNAVAILABLE", "Cart service is temporarily unavailable", 503);
    }

    @ExceptionHandler(ShippingException.class)
    @ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
    public ProblemDetails shippingUnavailable(ShippingException exception) {
        log.warn("shipping-quote-failed code={} traceId={}", exception.code(), traceId(), exception);
        return problem(exception.code(), "Shipping service is temporarily unavailable", 503);
    }

    @ExceptionHandler(PaymentException.class)
    @ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
    public ProblemDetails paymentFailure(PaymentException exception) {
        log.error("payment-request-failed code={} traceId={}", exception.code(), traceId(), exception);
        return problem(exception.code(), "Payment service is temporarily unavailable", 503);
    }

    @ExceptionHandler(CouponException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ProblemDetails couponFailure(CouponException exception) {
        return problem(exception.code(), exception.getMessage(), 400);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ProblemDetails badRequest(IllegalArgumentException exception) {
        if ("invalid_page_size".equals(exception.getMessage())) {
            return problem("invalid_page_size", "invalid_page_size", 400);
        }
        return problem("BAD_REQUEST", exception.getMessage(), 400);
    }

    @ExceptionHandler(InvalidCursorException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ProblemDetails invalidCursor(InvalidCursorException exception) {
        String code = switch (exception.reason()) {
            case RESOURCE_MISMATCH, FILTER_MISMATCH, SORT_MISMATCH -> "cursor_scope_mismatch";
            default -> "cursor_invalid";
        };
        return problem(code, code, 400);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ProblemDetails validationFailure(MethodArgumentNotValidException exception) {
        var messages = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .toList();
        String message = messages.isEmpty() ? "Request validation failed" : String.join(", ", messages);
        return ProblemDetails.of("VALIDATION_ERROR", message, 422, traceId());
    }

    /**
     * Synthetic/non-UUID ids (e2e fixtures like "E2E-VIETQR-...") hit a
     * path variable typed as UUID and Spring throws this. Return 404 so the
     * caller treats it as "order doesn't exist" without surfacing a 500.
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ProblemDetails pathVariableTypeMismatch(MethodArgumentTypeMismatchException exception) {
        return problem("NOT_FOUND", "Resource not found", 404);
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ProblemDetails internal(Exception exception) {
        // Log the full stack so operators can pinpoint the failing query/code path —
        // the generic INTERNAL_ERROR response leaves callers blind otherwise.
        log.error("Unhandled exception bubbled to ApiExceptionHandler", exception);
        return problem("INTERNAL_ERROR", "An unexpected error occurred", 500);
    }

    private static String traceId() {
        String id = Span.current().getSpanContext().getTraceId();
        return "0000000000000000".equals(id) ? null : id;
    }

    private static ProblemDetails problem(String code, String detail, int status) {
        return ProblemDetails.of(code, detail == null ? "Request failed" : detail, status, traceId());
    }
}
