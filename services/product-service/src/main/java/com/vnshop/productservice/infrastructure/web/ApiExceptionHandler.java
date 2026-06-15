package com.vnshop.productservice.infrastructure.web;

import com.vnshop.productservice.application.ProductAccessDeniedException;
import com.vnshop.productservice.application.video.VideoModerationException;
import com.vnshop.productservice.application.video.VideoNotFoundException;
import com.vnshop.productservice.application.video.VideoQuotaExceededException;
import com.vnshop.productservice.application.video.VideoUploadRateLimitException;
import com.vnshop.productservice.application.video.VideoValidationException;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {
    @ExceptionHandler(IllegalArgumentException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> badRequest(IllegalArgumentException exception) {
        return ApiResponse.error(exception.getMessage(), "bad_request");
    }

    @ExceptionHandler(ProductAccessDeniedException.class)
    @ResponseStatus(HttpStatus.FORBIDDEN)
    public ApiResponse<Void> productAccessDenied(ProductAccessDeniedException exception) {
        return ApiResponse.error(exception.getMessage(), "forbidden");
    }

    @ExceptionHandler(VideoNotFoundException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public ApiResponse<Void> videoNotFound(VideoNotFoundException exception) {
        return ApiResponse.error(exception.getMessage(), "video_not_found");
    }

    @ExceptionHandler(VideoModerationException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public ApiResponse<Void> videoModerationConflict(VideoModerationException exception) {
        return ApiResponse.error(exception.getMessage(), "video_moderation_conflict");
    }

    @ExceptionHandler(VideoUploadRateLimitException.class)
    @ResponseStatus(HttpStatus.TOO_MANY_REQUESTS)
    public ApiResponse<Void> videoRateLimit(VideoUploadRateLimitException exception) {
        return ApiResponse.error(exception.getMessage(), "video_rate_limit");
    }

    @ExceptionHandler(VideoQuotaExceededException.class)
    @ResponseStatus(HttpStatus.UNPROCESSABLE_ENTITY)
    public ApiResponse<Void> videoQuotaExceeded(VideoQuotaExceededException exception) {
        return ApiResponse.error(exception.getMessage(), "video_quota_exceeded");
    }

    @ExceptionHandler(VideoValidationException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public ApiResponse<Void> videoValidation(VideoValidationException exception) {
        return ApiResponse.error(exception.getMessage(), "video_validation_error");
    }

    @ExceptionHandler(Exception.class)
    @ResponseStatus(HttpStatus.INTERNAL_SERVER_ERROR)
    public ApiResponse<Void> internal(Exception exception) {
        return ApiResponse.error(exception.getMessage(), "internal_error");
    }
}
