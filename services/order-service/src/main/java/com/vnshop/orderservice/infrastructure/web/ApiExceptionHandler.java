package com.vnshop.orderservice.infrastructure.web;

import com.vnshop.orderservice.application.CheckoutOrderUseCase;
import com.vnshop.orderservice.application.FindOrderByIdempotencyKeyUseCase.OrderByIdempotencyKeyNotFoundException;
import com.vnshop.orderservice.application.OrderAccessDeniedException;
import com.vnshop.orderservice.application.ListReturnsUseCase.ReturnNotFoundException;
import com.vnshop.orderservice.domain.InvoiceAccessDeniedException;
import com.vnshop.orderservice.domain.coupon.CouponException;
import com.vnshop.orderservice.infrastructure.cart.CartUnavailableException;
import com.vnshop.orderservice.infrastructure.product.ProductCatalogUnavailableException;
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
    public ApiResponse<Void> forbidden(InvoiceAccessDeniedException exception) {
        return ApiResponse.error(exception.getMessage(), "INVOICE_ACCESS_DENIED");
    }

    @ExceptionHandler(AuthorizationDeniedException.class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    public ApiResponse<Void> authorizationDenied(AuthorizationDeniedException exception) {
        log.warn("authorization-denied: {}", exception.getMessage());
        return ApiResponse.error("Not authorized", "FORBIDDEN");
    }

    @ExceptionHandler(OrderAccessDeniedException.class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    public ApiResponse<Void> orderAccessDenied(OrderAccessDeniedException exception) {
        log.warn("order-access-denied: {}", exception.getMessage());
        return ApiResponse.error("Not authorized for this order", "ORDER_ACCESS_DENIED");
    }

    @ExceptionHandler(ReturnNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ApiResponse<Void> returnNotFound(ReturnNotFoundException exception) {
        return ApiResponse.error("Resource not found", "NOT_FOUND");
    }

    @ExceptionHandler(OrderByIdempotencyKeyNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ApiResponse<Void> idempotencyKeyOrderNotFound(OrderByIdempotencyKeyNotFoundException exception) {
        return ApiResponse.error("Resource not found", "NOT_FOUND");
    }

    @ExceptionHandler(CheckoutOrderUseCase.ProductNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ApiResponse<Void> productNotFound(CheckoutOrderUseCase.ProductNotFoundException exception) {
        return ApiResponse.error(exception.getMessage(), "PRODUCT_NOT_FOUND");
    }

    @ExceptionHandler(ProductCatalogUnavailableException.class)
    @ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
    public ApiResponse<Void> productCatalogDown(ProductCatalogUnavailableException exception) {
        log.warn("product-catalog-unavailable: {}", exception.getMessage());
        return ApiResponse.error("Product catalog is temporarily unavailable", "PRODUCT_CATALOG_UNAVAILABLE");
    }

    @ExceptionHandler(CartUnavailableException.class)
    @ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
    public ApiResponse<Void> cartUnavailable(CartUnavailableException exception) {
        log.warn("cart-unavailable: {}", exception.getMessage());
        return ApiResponse.error("Cart service is temporarily unavailable", "CART_UNAVAILABLE");
    }

    @ExceptionHandler(CouponException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> couponFailure(CouponException exception) {
        return ApiResponse.error(exception.getMessage(), exception.code());
    }

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> badRequest(IllegalArgumentException exception) {
        return ApiResponse.error(exception.getMessage(), "BAD_REQUEST");
    }

    @ExceptionHandler(InvalidCursorException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> invalidCursor(InvalidCursorException exception) {
        String code = switch (exception.reason()) {
            case RESOURCE_MISMATCH, FILTER_MISMATCH, SORT_MISMATCH -> "cursor_scope_mismatch";
            default -> "cursor_invalid";
        };
        return ApiResponse.error(code, code);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> validationFailure(MethodArgumentNotValidException exception) {
        var messages = exception.getBindingResult().getFieldErrors().stream()
                .map(error -> error.getField() + ": " + error.getDefaultMessage())
                .toList();
        String message = messages.isEmpty() ? "Request validation failed" : String.join(", ", messages);
        return ApiResponse.error(message, "VALIDATION_ERROR");
    }

    /**
     * Synthetic/non-UUID ids (e2e fixtures like "E2E-VIETQR-...") hit a
     * path variable typed as UUID and Spring throws this. Return 404 so the
     * caller treats it as "order doesn't exist" without surfacing a 500.
     */
    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ApiResponse<Void> pathVariableTypeMismatch(MethodArgumentTypeMismatchException exception) {
        return ApiResponse.error("Resource not found", "NOT_FOUND");
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ApiResponse<Void> internal(Exception exception) {
        // Log the full stack so operators can pinpoint the failing query/code path —
        // the generic INTERNAL_ERROR response leaves callers blind otherwise.
        log.error("Unhandled exception bubbled to ApiExceptionHandler", exception);
        return ApiResponse.error("An unexpected error occurred", "INTERNAL_ERROR");
    }
}
