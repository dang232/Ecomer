package com.vnshop.apigateway.infrastructure.web;

import java.util.List;
import java.util.Map;

/**
 * Standard error response shape returned by GlobalExceptionHandler.
 * Matches the VNShop API error contract:
 * { code, message, details, timestamp, traceId }
 */
public record ErrorResponse(
    String type, String title, int status, String detail, String instance, String code,
    String requestId, String traceId, boolean retryable, Map<String, List<String>> fields,
    @Deprecated String errorCode
) {
    public static ErrorResponse of(String code, String message, List<String> details, String traceId) {
        return of(code, message, 400, details, traceId);
    }

    public static ErrorResponse of(String code, String message, int status, List<String> details, String traceId) {
        return new ErrorResponse("https://api.vnshop.com/problems/" + code.toLowerCase(), title(status), status,
            message, "", code, traceId == null ? java.util.UUID.randomUUID().toString() : traceId, traceId, status == 425 || status == 429 || status >= 500,
            details.isEmpty() ? Map.of() : Map.of("_global", details), code);
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
            default -> status >= 500 ? "Internal Server Error" : "Request failed";
        };
    }

    public static ErrorResponse of(String code, String message, String traceId) {
        return of(code, message, List.of(), traceId);
    }
}
