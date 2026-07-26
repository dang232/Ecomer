package com.vnshop.inventoryservice.infrastructure.flash;

import com.vnshop.inventoryservice.domain.DuplicateFlashSaleReservationException;
import com.vnshop.inventoryservice.application.FlashSaleAccessDeniedException;
import com.vnshop.inventoryservice.application.FlashSaleIdempotencyConflictException;
import com.vnshop.inventoryservice.application.FlashSaleOutOfStockException;
import com.vnshop.inventoryservice.application.FlashSaleDependencyUnavailableException;
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

    @ExceptionHandler(DuplicateFlashSaleReservationException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public ApiResponse<Void> duplicateFlashSaleReservation(DuplicateFlashSaleReservationException exception) {
        return ApiResponse.error(exception.getMessage(), "CONFLICT");
    }

    @ExceptionHandler({FlashSaleIdempotencyConflictException.class, FlashSaleOutOfStockException.class})
    @ResponseStatus(HttpStatus.CONFLICT)
    public ApiResponse<Void> conflict(RuntimeException exception) {
        return ApiResponse.error(exception.getMessage(), "CONFLICT");
    }

    @ExceptionHandler(FlashSaleDependencyUnavailableException.class)
    @ResponseStatus(HttpStatus.SERVICE_UNAVAILABLE)
    public ApiResponse<Void> unavailable(FlashSaleDependencyUnavailableException exception) {
        return ApiResponse.error(exception.getMessage(), "SERVICE_UNAVAILABLE");
    }

    @ExceptionHandler(FlashSaleAccessDeniedException.class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    public ApiResponse<Void> flashSaleAccessDenied(FlashSaleAccessDeniedException exception) {
        return ApiResponse.error(exception.getMessage(), "FORBIDDEN");
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ApiResponse<Void> internal(Exception exception) {
        // Log the actual cause — the previous handler swallowed it silently,
        // which made the flash-sale "all 500s, no logs" mystery untriagable.
        log.error("Unhandled exception", exception);
        return ApiResponse.error("An unexpected error occurred", "INTERNAL_SERVER_ERROR");
    }
}
