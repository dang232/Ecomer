package com.vnshop.transcoder.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;

class Sha256VerificationTest {

    /** Thin subclass to expose package-private helpers without mocking S3 */
    private final TranscodeService service = new TranscodeService(
            mock(software.amazon.awssdk.services.s3.S3AsyncClient.class),
            new FfmpegCommandBuilder()
    );

    @TempDir
    Path tmp;

    @Test
    void computeSha256_matchesKnownDigest(@TempDir Path dir) throws Exception {
        byte[] content = "hello vnshop".getBytes();
        Path file = dir.resolve("test.bin");
        Files.write(file, content);

        String expected = HexFormat.of().formatHex(
                MessageDigest.getInstance("SHA-256")
                             .digest(content));

        assertThat(service.computeSha256(file)).isEqualToIgnoringCase(expected);
    }

    @Test
    void verifySha256_passesOnMatch() throws Exception {
        byte[] content = "video bytes".getBytes();
        Path file = tmp.resolve("raw.mp4");
        Files.write(file, content);

        String hex = HexFormat.of().formatHex(
                MessageDigest.getInstance("SHA-256").digest(content));

        // Should not throw
        service.verifySha256(file, hex, "video-id-123");
    }

    @Test
    void verifySha256_throwsOnMismatch() throws IOException {
        Path file = tmp.resolve("raw.mp4");
        Files.write(file, "video bytes".getBytes());

        assertThatThrownBy(() -> service.verifySha256(file, "deadbeef00", "video-id-456"))
                .isInstanceOf(TranscodeException.class)
                .hasMessageContaining("SHA-256 mismatch")
                .hasMessageContaining("video-id-456");
    }

    @Test
    void verifySha256_caseInsensitive() throws Exception {
        byte[] content = "case test".getBytes();
        Path file = tmp.resolve("case.mp4");
        Files.write(file, content);

        String hex = HexFormat.of().formatHex(
                MessageDigest.getInstance("SHA-256").digest(content));

        // Upper-case expected should still pass
        service.verifySha256(file, hex.toUpperCase(), "video-id-789");
    }
}
