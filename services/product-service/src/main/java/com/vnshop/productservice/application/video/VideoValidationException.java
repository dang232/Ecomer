package com.vnshop.productservice.application.video;

public class VideoValidationException extends RuntimeException {
    private final String code;

    public VideoValidationException(String message) {
        super(message);
        this.code = null;
    }

    public VideoValidationException(String code, String message) {
        super(message);
        this.code = code;
    }

    public String code() {
        return code;
    }
}
