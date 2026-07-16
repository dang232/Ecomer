package com.vnshop.orderservice.infrastructure.web;

import org.junit.jupiter.api.Test;
import org.springframework.security.authorization.AuthorizationDeniedException;
import org.springframework.validation.BindingResult;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ApiExceptionHandlerTest {

    private final ApiExceptionHandler handler = new ApiExceptionHandler();

    @Test
    void authorizationDeniedReturnsForbiddenEnvelope() {
        ApiResponse<Void> response = handler.authorizationDenied(new AuthorizationDeniedException("Access Denied"));

        assertThat(response.success()).isFalse();
        assertThat(response.errorCode()).isEqualTo("FORBIDDEN");
    }

    @Test
    void validationFailureReturnsBadRequestEnvelope() {
        MethodArgumentNotValidException exception = mock(MethodArgumentNotValidException.class);
        BindingResult bindingResult = mock(BindingResult.class);
        when(exception.getBindingResult()).thenReturn(bindingResult);
        when(bindingResult.getFieldErrors()).thenReturn(
                List.of(new FieldError("request", "address", "must not be null"))
        );

        ApiResponse<Void> response = handler.validationFailure(exception);

        assertThat(response.success()).isFalse();
        assertThat(response.errorCode()).isEqualTo("VALIDATION_ERROR");
        assertThat(response.message()).contains("address");
    }
}
