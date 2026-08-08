package com.vnshop.userservice.infrastructure.web;

import com.vnshop.userservice.application.NoSessionException;
import com.vnshop.userservice.application.PhoneAlreadyRegisteredException;
import com.vnshop.userservice.application.RefreshTokenRejectedException;
import com.vnshop.userservice.application.RegistrationIdentityCompensationException;
import com.vnshop.userservice.domain.SellerNotFoundException;
import com.vnshop.userservice.infrastructure.keycloak.KeycloakAdminException;
import com.vnshop.userservice.infrastructure.web.pagination.AdminCursorCodec.InvalidCursorException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@Slf4j
@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(SellerNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ApiResponse<Void> sellerNotFound(SellerNotFoundException exception) {
        return ApiResponse.error(exception.getMessage(), "not_found");
    }

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> badRequest(IllegalArgumentException exception) {
        return ApiResponse.error(exception.getMessage(), "bad_request");
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

    @ExceptionHandler(PhoneAlreadyRegisteredException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public ApiResponse<Void> phoneAlreadyRegistered(PhoneAlreadyRegisteredException exception) {
        return ApiResponse.error(exception.getMessage(), "phone_taken");
    }

    @ExceptionHandler(RegistrationIdentityCompensationException.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ApiResponse<Void> registrationCompensationFailure(RegistrationIdentityCompensationException exception) {
        log.error("Registration identity compensation failed", exception);
        return ApiResponse.error("Registration could not be completed safely", "registration_failed");
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> validation(MethodArgumentNotValidException exception) {
        String message = exception.getBindingResult().getFieldErrors().stream()
                .findFirst()
                .map(err -> err.getField() + ": " + err.getDefaultMessage())
                .orElse("Validation failed");
        return ApiResponse.error(message, "validation_error");
    }

    @ExceptionHandler(KeycloakAdminException.class)
    public ResponseEntity<ApiResponse<Void>> keycloakAdmin(KeycloakAdminException exception) {
        HttpStatus status = HttpStatus.resolve(exception.statusCode());
        if (status == null) status = HttpStatus.INTERNAL_SERVER_ERROR;
        return ResponseEntity.status(status)
                .body(ApiResponse.error(exception.getMessage(), exception.errorCode()));
    }

    @ExceptionHandler(NoSessionException.class)
    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    public ApiResponse<Void> noSession(NoSessionException exception) {
        return ApiResponse.error(exception.getMessage(), "no_session");
    }

    @ExceptionHandler(RefreshTokenRejectedException.class)
    @ResponseStatus(HttpStatus.UNAUTHORIZED)
    public ApiResponse<Void> refreshTokenRejected(RefreshTokenRejectedException exception) {
        return ApiResponse.error(exception.getMessage(), "refresh_rejected");
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ApiResponse<Void> internal(Exception exception) {
        log.error("Unhandled exception", exception);
        return ApiResponse.error("An unexpected error occurred", "internal_error");
    }
}
