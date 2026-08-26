package com.vnshop.paymentservice.infrastructure.web;

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
        return new ErrorResponse("https://api.vnshop.com/problems/" + code.toLowerCase(), "Request failed",
                400, message, "", code, java.util.UUID.randomUUID().toString(), traceId, false,
                details.isEmpty() ? Map.of() : Map.of("_global", details), code);
    }

    public static ErrorResponse of(String code, String message, String traceId) {
        return of(code, message, List.of(), traceId);
    }
}
