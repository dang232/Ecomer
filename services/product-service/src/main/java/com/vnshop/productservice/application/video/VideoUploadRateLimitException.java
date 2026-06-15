package com.vnshop.productservice.application.video;

public class VideoUploadRateLimitException extends RuntimeException {
    public VideoUploadRateLimitException(String message) {
        super(message);
    }
}
