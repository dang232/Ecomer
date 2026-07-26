package com.vnshop.transcoder.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "transcoder")
public record TranscoderProperties(
        String tmpfsDir,
        String inputBucket,
        String stagingBucket,
        int processTimeoutSeconds,
        int inputDurationLimitSeconds,
        long outputSizeLimitBytes,
        int ffmpegThreads,
        int probeTimeoutSeconds) {

    public TranscoderProperties {
        required(tmpfsDir, "transcoder.tmpfs-dir");
        required(inputBucket, "transcoder.input-bucket");
        required(stagingBucket, "transcoder.staging-bucket");
        positive(processTimeoutSeconds, "transcoder.process-timeout-seconds");
        positive(inputDurationLimitSeconds, "transcoder.input-duration-limit-seconds");
        positive(outputSizeLimitBytes, "transcoder.output-size-limit-bytes");
        positive(ffmpegThreads, "transcoder.ffmpeg-threads");
        positive(probeTimeoutSeconds, "transcoder.probe-timeout-seconds");
    }

    private static void required(String value, String propertyName) {
        if (value == null || value.isBlank()) {
            throw new IllegalStateException(propertyName + " must be configured");
        }
    }

    private static void positive(long value, String propertyName) {
        if (value <= 0) {
            throw new IllegalStateException(propertyName + " must be positive");
        }
    }
}
