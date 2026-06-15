package com.vnshop.productservice.application.video;

public class VideoQuotaExceededException extends RuntimeException {
    public VideoQuotaExceededException(String message) {
        super(message);
    }
}
