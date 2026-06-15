package com.vnshop.transcoder.service;

/**
 * Signals a recoverable or terminal transcode pipeline failure.
 * Thrown by {@link TranscodeService} and handled by {@link com.vnshop.transcoder.consumer.TranscodeEventConsumer}.
 */
public class TranscodeException extends RuntimeException {

    public TranscodeException(String message) {
        super(message);
    }

    public TranscodeException(String message, Throwable cause) {
        super(message, cause);
    }
}
