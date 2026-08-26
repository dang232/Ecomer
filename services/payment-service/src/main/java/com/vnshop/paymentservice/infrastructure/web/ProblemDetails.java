package com.vnshop.paymentservice.infrastructure.web;

import com.fasterxml.jackson.annotation.JsonInclude;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ProblemDetails(
        String type, String title, int status, String detail, String instance, String code,
        String requestId, String traceId, boolean retryable, Map<String, List<String>> fields,
        @Deprecated String errorCode) {
    public static ProblemDetails of(String code, String detail, int status, String traceId) {
        return new ProblemDetails("https://api.vnshop.com/problems/" + code.toLowerCase(),
                status == 422 ? "Validation failed" : status == 425 ? "Too Early" : status == 409 ? "Conflict" : "Request failed",
                status, detail, "", code, traceId == null || traceId.isBlank() ? UUID.randomUUID().toString() : traceId, traceId, status >= 500,
                Map.of(), code);
    }
}
