package com.vnshop.productservice.infrastructure.web;

import java.time.LocalDateTime;
import com.fasterxml.jackson.annotation.JsonInclude;

public record ApiResponse<T>(
    boolean success,
    String message,
    T data,
    String errorCode,
    LocalDateTime timestamp,
    @JsonInclude(JsonInclude.Include.NON_NULL) ApiMeta meta
) {
    public ApiResponse(boolean success, String message, T data, String errorCode, LocalDateTime timestamp) {
        this(success, message, data, errorCode, timestamp, null);
    }

    public static <T> ApiResponse<T> ok(T data) {
        return new ApiResponse<>(true, "Success", data, null, LocalDateTime.now());
    }

    public static <T> ApiResponse<T> ok(String message, T data) {
        return new ApiResponse<>(true, message, data, null, LocalDateTime.now());
    }

    public static <T> ApiResponse<T> error(String message, String errorCode) {
        return new ApiResponse<>(false, message, null, errorCode, LocalDateTime.now());
    }

    public static <T> ApiResponse<T> okWithMeta(T data, ApiMeta meta) {
        return new ApiResponse<>(true, "Success", data, null, LocalDateTime.now(), meta);
    }
}
