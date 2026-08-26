package com.vnshop.productservice.infrastructure.web;

import com.vnshop.productservice.application.ProductAccessDeniedException;
import com.vnshop.productservice.application.ValidationException;
import com.vnshop.productservice.application.video.VideoModerationException;
import com.vnshop.productservice.application.video.VideoNotFoundException;
import com.vnshop.productservice.application.video.VideoQuotaExceededException;
import com.vnshop.productservice.application.video.VideoUploadRateLimitException;
import com.vnshop.productservice.application.video.VideoValidationException;
import com.vnshop.productservice.domain.review.ReviewEligibilityException;
import com.vnshop.productservice.infrastructure.web.pagination.AdminCursorCodec.InvalidCursorException;
import io.opentelemetry.api.trace.Span;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(InvalidCursorException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ProblemDetails invalidCursor(InvalidCursorException exception) {
        String code = switch (exception.reason()) {
            case RESOURCE_MISMATCH, FILTER_MISMATCH, SORT_MISMATCH -> "cursor_scope_mismatch";
            default -> "cursor_invalid";
        };
        return problem(code, code, 400);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ProblemDetails badRequest(IllegalArgumentException exception) {
        String code = "invalid_page_size".equals(exception.getMessage()) ? "invalid_page_size" : "bad_request";
        return problem(code, exception.getMessage(), 400);
    }

    @ExceptionHandler(ReviewEligibilityException.class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    public ProblemDetails reviewEligibility(ReviewEligibilityException exception) { return problem("review_purchase_required", exception.getMessage(), 403); }

    @ExceptionHandler(ProductAccessDeniedException.class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    public ProblemDetails productAccessDenied(ProductAccessDeniedException exception) { return problem("forbidden", exception.getMessage(), 403); }

    @ExceptionHandler(VideoNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ProblemDetails videoNotFound(VideoNotFoundException exception) { return problem("video_not_found", exception.getMessage(), 404); }

    @ExceptionHandler(VideoModerationException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public ProblemDetails videoModerationConflict(VideoModerationException exception) { return problem("video_moderation_conflict", exception.getMessage(), 409); }

    @ExceptionHandler(VideoUploadRateLimitException.class)
    @ResponseStatus(HttpStatus.TOO_MANY_REQUESTS)
    public ProblemDetails videoRateLimit(VideoUploadRateLimitException exception) { return problem("video_rate_limit", exception.getMessage(), 429); }

    @ExceptionHandler(VideoQuotaExceededException.class)
    @ResponseStatus(HttpStatus.UNPROCESSABLE_ENTITY)
    public ProblemDetails videoQuotaExceeded(VideoQuotaExceededException exception) { return problem("video_quota_exceeded", exception.getMessage(), 422); }

    @ExceptionHandler(VideoValidationException.class)
    @ResponseStatus(HttpStatus.UNPROCESSABLE_ENTITY)
    public ProblemDetails videoValidation(VideoValidationException exception) { return problem("video_validation_error", exception.getMessage(), 422); }

    @ExceptionHandler(ValidationException.class)
    @ResponseStatus(HttpStatus.UNPROCESSABLE_ENTITY)
    public ProblemDetails validation(ValidationException exception) { return problem(exception.code(), exception.getMessage(), 422); }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ProblemDetails internal(Exception exception) { return problem("internal_error", "An unexpected error occurred", 500); }

    private static ProblemDetails problem(String code, String detail, int status) {
        String trace = Span.current().getSpanContext().getTraceId();
        return ProblemDetails.of(code, detail == null ? "Request failed" : detail, status,
                "0000000000000000".equals(trace) ? null : trace);
    }
}
