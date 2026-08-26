package com.vnshop.orderservice.infrastructure.web;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ProblemDetails(
        String type, String title, int status, String detail, String instance, String code,
        String requestId, String traceId, boolean retryable, Map<String, List<String>> fields,
        @Deprecated String errorCode) {
    public static ProblemDetails of(String type, String title, int status, String detail, String instance,
                                    String code, String requestId, String traceId, boolean retryable,
                                    Map<String, List<String>> fields) {
        return new ProblemDetails(type, title, status, detail, instance, code,
                requestId, traceId, retryable, fields, code);
    }

    public static ProblemDetails of(String code, String detail, int status, String traceId) {
        String requestId = traceId == null || traceId.isBlank() ? UUID.randomUUID().toString() : traceId;
        return of("https://api.vnshop.com/problems/" + code.toLowerCase(),
                title(status), status, detail, "", code, requestId, traceId, status >= 500,
                Map.of());
    }

    private static String title(int status) {
        return switch (status) {
            case 401 -> "Unauthorized";
            case 403 -> "Forbidden";
            case 404 -> "Not Found";
            case 409 -> "Conflict";
            case 422 -> "Validation failed";
            case 425 -> "Too Early";
            case 429 -> "Too Many Requests";
            default -> status >= 500 ? "Internal Server Error" : "Bad Request";
        };
    }
}
