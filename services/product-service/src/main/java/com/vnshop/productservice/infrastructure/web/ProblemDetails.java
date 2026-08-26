package com.vnshop.productservice.infrastructure.web;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ProblemDetails(String type, String title, int status, String detail, String instance,
                             String code, String requestId, String traceId, boolean retryable,
                             Map<String, List<String>> fields, @Deprecated String errorCode) {
    @JsonProperty("success")
    public boolean success() {
        return false;
    }

    @JsonProperty("message")
    public String message() {
        return detail;
    }

    @JsonProperty("data")
    @JsonInclude(JsonInclude.Include.ALWAYS)
    public Object data() {
        return null;
    }

    public static ProblemDetails of(String code, String detail, int status, String traceId) {
        String id = traceId == null || traceId.isBlank() ? UUID.randomUUID().toString() : traceId;
        return new ProblemDetails("https://api.vnshop.com/problems/" + code.toLowerCase(),
                status == 422 ? "Validation failed" : status == 403 ? "Forbidden" : status == 404 ? "Not Found" : "Request failed",
                status, detail, "", code, id, traceId, status == 425 || status == 429 || status >= 500, Map.of(), code);
    }
}
