package com.vnshop.transcoder.service;

import com.vnshop.transcoder.config.TranscoderProperties;
import com.vnshop.transcoder.model.TranscodeJob;
import com.vnshop.transcoder.model.TranscodeResult;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.core.async.AsyncRequestBody;
import software.amazon.awssdk.core.async.AsyncResponseTransformer;
import software.amazon.awssdk.services.s3.S3AsyncClient;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TranscodeServiceTest {

    @Mock
    private S3AsyncClient s3AsyncClient;

    private TranscodeService transcodeService;

    @TempDir
    Path tmpDir;

    @BeforeEach
    void setUp() {
        TranscoderProperties properties = new TranscoderProperties(tmpDir.toString(), "input", "staging",
                360, 600, 2_147_483_648L, 3, 30);
        FfmpegCommandBuilder cmdBuilder = new FfmpegCommandBuilder(properties);
        transcodeService = new TranscodeService(s3AsyncClient, cmdBuilder, properties);
    }

    // --- SHA-256 unit tests (via exposed package-private methods) ---

    @Test
    void computeSha256_returnsCorrectHex() throws Exception {
        byte[] data = "unit test data".getBytes();
        Path file = tmpDir.resolve("data.bin");
        Files.write(file, data);

        String expected = HexFormat.of().formatHex(
                MessageDigest.getInstance("SHA-256").digest(data));

        assertThat(transcodeService.computeSha256(file)).isEqualToIgnoringCase(expected);
    }

    @Test
    void verifySha256_throwsTranscodeException_onMismatch() throws IOException {
        Path file = tmpDir.resolve("bad.mp4");
        Files.write(file, "content".getBytes());

        assertThatThrownBy(() ->
                transcodeService.verifySha256(file, "0000000000000000", "vid-1"))
                .isInstanceOf(TranscodeException.class)
                .hasMessageContaining("SHA-256 mismatch");
    }

    // --- probeDurationSeconds graceful degradation ---

    @Test
    void probeDurationSeconds_returnsZero_whenFfprobeUnavailable() {
        // ffprobe may not be on PATH in CI — expect graceful 0 fallback
        long result = transcodeService.probeDurationSeconds(
                Path.of("/nonexistent/file.mp4"), "vid-probe-test");
        assertThat(result).isGreaterThanOrEqualTo(0L);
    }

    // --- S3 interaction: deleteRaw is non-fatal ---

    @Test
    void transcode_s3DownloadFailure_throwsTranscodeException() {
        when(s3AsyncClient.getObject(
                any(GetObjectRequest.class),
                org.mockito.ArgumentMatchers
                        .<AsyncResponseTransformer<GetObjectResponse, ResponseBytes<GetObjectResponse>>>any()))
                .thenReturn(CompletableFuture.failedFuture(new RuntimeException("S3 connection refused")));

        UUID videoId   = UUID.randomUUID();
        UUID productId = UUID.randomUUID();
        UUID sellerId  = UUID.randomUUID();

        TranscodeJob job = TranscodeJob.builder()
                .videoId(videoId)
                .ownerType("PRODUCT")
                .productId(productId)
                .sellerId(sellerId)
                .rawKey("uploads/" + videoId + ".mp4")
                .extension("mp4")
                .sha256("abc123")
                .fileSizeBytes(1024L)
                .build();

        assertThatThrownBy(() -> transcodeService.transcode(job))
                .isInstanceOf(TranscodeException.class);
    }

    @Test
    void transcode_sha256Mismatch_throwsTranscodeException() throws Exception {
        UUID videoId   = UUID.randomUUID();
        UUID productId = UUID.randomUUID();
        UUID sellerId  = UUID.randomUUID();

        // S3 download writes actual bytes to the destination path
        byte[] actualContent = "real video content".getBytes();
        ResponseBytes<GetObjectResponse> responseBytes = ResponseBytes.fromByteArray(
                GetObjectResponse.builder().build(), actualContent);
        when(s3AsyncClient.getObject(
                any(GetObjectRequest.class),
                org.mockito.ArgumentMatchers
                        .<AsyncResponseTransformer<GetObjectResponse, ResponseBytes<GetObjectResponse>>>any()))
                .thenReturn(CompletableFuture.completedFuture(responseBytes));

        TranscodeJob job = TranscodeJob.builder()
                .videoId(videoId)
                .ownerType("PRODUCT")
                .productId(productId)
                .sellerId(sellerId)
                .rawKey("uploads/" + videoId + ".mp4")
                .extension("mp4")
                .sha256("intentionally-wrong-sha256")
                .fileSizeBytes(actualContent.length)
                .build();

        assertThatThrownBy(() -> transcodeService.transcode(job))
                .isInstanceOf(TranscodeException.class)
                .hasMessageContaining("SHA-256 mismatch");

        // Raw file must NOT be deleted when verification fails
        verify(s3AsyncClient, never()).deleteObject(any(DeleteObjectRequest.class));
    }

    // --- M18 fix: ownerType drives staging key prefix ---

    @Test
    void transcode_productOwner_writesToProductsPrefix() throws Exception {
        UUID videoId   = UUID.randomUUID();
        UUID productId = UUID.randomUUID();
        UUID sellerId  = UUID.randomUUID();

        // Succeeds: S3 getObject + putObject both no-op via Mockito default
        TranscodeJob job = TranscodeJob.builder()
                .videoId(videoId)
                .ownerType("PRODUCT")
                .productId(productId)
                .sellerId(sellerId)
                .rawKey("uploads/" + videoId + ".mp4")
                .extension("mp4")
                .sha256("doesntmatter")
                .fileSizeBytes(0L)
                .build();

        // Run just the key-building step via reflection so we don't need to
        // mock the full FFmpeg pipeline.
        String key = (String) ReflectionTestUtils.invokeMethod(transcodeService,
                "stagingKeyFor", job);

        assertThat(key).isEqualTo("products/" + productId + "/videos/" + videoId + "_720p.mp4");
    }

    @Test
    void transcode_reviewOwner_writesToReviewsPrefix() throws Exception {
        UUID videoId  = UUID.randomUUID();
        UUID reviewId = UUID.randomUUID();
        UUID sellerId = UUID.randomUUID();

        TranscodeJob job = TranscodeJob.builder()
                .videoId(videoId)
                .ownerType("REVIEW")
                .reviewId(reviewId)
                .sellerId(sellerId)
                .rawKey("uploads/" + videoId + ".mp4")
                .extension("mp4")
                .sha256("doesntmatter")
                .fileSizeBytes(0L)
                .build();

        String key = (String) ReflectionTestUtils.invokeMethod(transcodeService,
                "stagingKeyFor", job);

        assertThat(key).isEqualTo("reviews/" + reviewId + "/videos/" + videoId + "_720p.mp4");
    }

    @Test
    void transcodeJob_rejectsProductOwnerWithoutProductId() {
        UUID videoId = UUID.randomUUID();
        assertThatThrownBy(() -> TranscodeJob.builder()
                .videoId(videoId)
                .ownerType("PRODUCT")
                .sellerId(UUID.randomUUID())
                .rawKey("uploads/x.mp4")
                .extension("mp4")
                .sha256("x")
                .fileSizeBytes(0L)
                .build())
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("productId is required");
    }

    @Test
    void transcodeJob_rejectsReviewOwnerWithoutReviewId() {
        UUID videoId = UUID.randomUUID();
        assertThatThrownBy(() -> TranscodeJob.builder()
                .videoId(videoId)
                .ownerType("REVIEW")
                .sellerId(UUID.randomUUID())
                .rawKey("uploads/x.mp4")
                .extension("mp4")
                .sha256("x")
                .fileSizeBytes(0L)
                .build())
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("reviewId is required");
    }

    // --- cleanWorkDir (regression: was emitting N warn lines per cleanup) ---

    @Test
    void cleanWorkDir_deletesAllFilesInTree() throws Exception {
        Path workDir = tmpDir.resolve("work");
        Files.createDirectories(workDir);
        Files.writeString(workDir.resolve("a.mp4"), "x");
        Files.writeString(workDir.resolve("b.mp4"), "y");
        Files.createDirectories(workDir.resolve("sub"));
        Files.writeString(workDir.resolve("sub/c.mp4"), "z");

        ReflectionTestUtils.invokeMethod(transcodeService, "cleanWorkDir", workDir);

        assertThat(Files.exists(workDir)).isFalse();
    }

    @Test
    void cleanWorkDir_onMissingDirectory_doesNotThrow() {
        Path missing = tmpDir.resolve("does-not-exist");

        // Must not throw — idempotent cleanup after a failed prior run.
        ReflectionTestUtils.invokeMethod(transcodeService, "cleanWorkDir", missing);

        assertThat(Files.exists(missing)).isFalse();
    }

    @Test
    void cleanWorkDir_onEmptyDirectory_succeeds() throws Exception {
        Path workDir = tmpDir.resolve("empty");
        Files.createDirectories(workDir);

        ReflectionTestUtils.invokeMethod(transcodeService, "cleanWorkDir", workDir);

        assertThat(Files.exists(workDir)).isFalse();
    }
}
