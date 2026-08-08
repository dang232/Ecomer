package com.vnshop.productservice.infrastructure.web;

import static org.assertj.core.api.Assertions.assertThat;

import com.vnshop.productservice.infrastructure.web.pagination.AdminCursorCodec;
import org.junit.jupiter.api.Test;

class ApiExceptionHandlerCursorTest {
    @Test
    void invalidCursorUsesStableCursorErrorCodeInsteadOfGenericBadRequest() {
        ApiResponse<Void> response = new ApiExceptionHandler().invalidCursor(
                new AdminCursorCodec.InvalidCursorException(AdminCursorCodec.RejectionReason.TAMPERED));

        assertThat(response.errorCode()).isEqualTo("cursor_invalid");
        assertThat(response.message()).isEqualTo("cursor_invalid");
    }

    @Test
    void cursorScopeMismatchUsesDedicatedErrorCode() {
        ApiResponse<Void> response = new ApiExceptionHandler().invalidCursor(
                new AdminCursorCodec.InvalidCursorException(AdminCursorCodec.RejectionReason.FILTER_MISMATCH));

        assertThat(response.errorCode()).isEqualTo("cursor_scope_mismatch");
    }
}
