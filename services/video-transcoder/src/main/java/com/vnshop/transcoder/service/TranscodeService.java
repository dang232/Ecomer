package com.vnshop.transcoder.service;

import com.vnshop.transcoder.model.TranscodeJob;
import com.vnshop.transcoder.model.TranscodeResult;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.retry.annotation.Backoff;
import org.springframework.retry.annotation.Retryable;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class TranscodeService {

    private static final String UPLOADS_BUCKET  = "vnshop-video-uploads-tmp";
    private static final String STAGING_BUCKET  = "vnshop-videos-staging";
    private static final int    PROCESS_TIMEOUT = 360; // seconds

    private final S3Client            s3Client;
    private final FfmpegCommandBuilder ffmpegCommandBuilder;

    @Value("${transcoder.tmpfs-dir:/tmp/transcoder}")
    private String tmpfsDir;

    /**
     * Full transcode pipeline for one job.
     * Retried up to 3 times with exponential backoff (1 s → 5 s → 30 s).
     */
    @Retryable(
            retryFor = TranscodeException.class,
            maxAttempts = 3,
            backoff = @Backoff(delay = 1_000, multiplier = 5, maxDelay = 30_000)
    )
    public TranscodeResult transcode(TranscodeJob job) {
        Path workDir = Path.of(tmpfsDir, job.videoId().toString());
        try {
            Files.createDirectories(workDir);

            // 1. Download raw file from uploads bucket
            Path rawFile = workDir.resolve("input." + job.extension());
            downloadRaw(job.rawKey(), rawFile);
            log.info("Downloaded raw file videoId={} bytes={}", job.videoId(), Files.size(rawFile));

            // 2. Verify SHA-256
            verifySha256(rawFile, job.sha256(), job.videoId().toString());

            // 3. Run FFmpeg transcode
            Path outputFile = workDir.resolve("output_720p.mp4");
            runProcess(ffmpegCommandBuilder.buildTranscodeCommand(rawFile, outputFile),
                    "transcode", job.videoId().toString());

            // 4. Probe duration of transcoded file
            long durationSeconds = probeDurationSeconds(outputFile, job.videoId().toString());

            // 5. Generate poster frame
            double seekSecs = ffmpegCommandBuilder.posterSeekSeconds(durationSeconds);
            Path posterFile = workDir.resolve("poster.jpg");
            runProcess(ffmpegCommandBuilder.buildPosterCommand(outputFile, posterFile, seekSecs),
                    "poster", job.videoId().toString());

            // 6. Upload transcoded + poster to staging bucket
            String transcodedKey = "videos/" + job.productId() + "/" + job.videoId() + "/720p.mp4";
            String posterKey     = "videos/" + job.productId() + "/" + job.videoId() + "/poster.jpg";
            uploadToStaging(outputFile, transcodedKey);
            uploadToStaging(posterFile, posterKey);
            log.info("Uploaded transcoded videoId={} key={}", job.videoId(), transcodedKey);

            // 7. Delete raw file from uploads bucket
            deleteRaw(job.rawKey());

            return TranscodeResult.builder()
                    .videoId(job.videoId())
                    .productId(job.productId())
                    .sellerId(job.sellerId())
                    .success(true)
                    .transcodedKey(transcodedKey)
                    .posterKey(posterKey)
                    .durationSeconds(durationSeconds)
                    .completedAt(Instant.now())
                    .build();

        } catch (TranscodeException e) {
            throw e; // let @Retryable handle
        } catch (Exception e) {
            throw new TranscodeException("Transcode pipeline failed for videoId=" + job.videoId(), e);
        } finally {
            // 8. Clean tmpfs work directory
            cleanWorkDir(workDir);
        }
    }

    // --- private helpers ---

    private void downloadRaw(String key, Path destination) {
        s3Client.getObject(
                GetObjectRequest.builder().bucket(UPLOADS_BUCKET).key(key).build(),
                destination
        );
    }

    /**
     * Verifies that the SHA-256 digest of {@code file} matches {@code expectedHex}.
     * Throws {@link TranscodeException} on mismatch.
     */
    void verifySha256(Path file, String expectedHex, String videoId) throws IOException {
        String actual = computeSha256(file);
        if (!actual.equalsIgnoreCase(expectedHex)) {
            throw new TranscodeException(
                    "SHA-256 mismatch for videoId=" + videoId +
                    " expected=" + expectedHex + " actual=" + actual);
        }
        log.debug("SHA-256 verified videoId={}", videoId);
    }

    String computeSha256(Path file) throws IOException {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] buffer = new byte[64 * 1024]; // 64 KB chunks
            try (var in = Files.newInputStream(file)) {
                int read;
                while ((read = in.read(buffer)) != -1) {
                    digest.update(buffer, 0, read);
                }
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 is guaranteed present in every JVM
            throw new IllegalStateException("SHA-256 algorithm unavailable", e);
        }
    }

    private void runProcess(List<String> command, String phase, String videoId)
            throws IOException, InterruptedException {
        log.debug("Running {} phase for videoId={} cmd={}", phase, videoId, command);
        Process process = new ProcessBuilder(command)
                .redirectErrorStream(true)
                .start();

        boolean finished = process.waitFor(PROCESS_TIMEOUT, TimeUnit.SECONDS);
        if (!finished) {
            process.destroyForcibly();
            throw new TranscodeException(phase + " timed out for videoId=" + videoId);
        }
        int exit = process.exitValue();
        if (exit != 0) {
            String output = new String(process.getInputStream().readAllBytes());
            throw new TranscodeException(phase + " failed exitCode=" + exit +
                    " videoId=" + videoId + " output=" + output);
        }
    }

    /**
     * Uses ffprobe to read the duration of the transcoded file.
     * Returns 0 if ffprobe is unavailable or the output cannot be parsed.
     */
    long probeDurationSeconds(Path file, String videoId) {
        try {
            Process p = new ProcessBuilder(
                    "ffprobe", "-v", "error",
                    "-show_entries", "format=duration",
                    "-of", "default=noprint_wrappers=1:nokey=1",
                    file.toAbsolutePath().toString()
            ).start();
            boolean done = p.waitFor(30, TimeUnit.SECONDS);
            if (!done || p.exitValue() != 0) {
                return 0L;
            }
            String out = new String(p.getInputStream().readAllBytes()).trim();
            return (long) Double.parseDouble(out);
        } catch (Exception e) {
            log.warn("Could not probe duration for videoId={}: {}", videoId, e.getMessage());
            return 0L;
        }
    }

    private void uploadToStaging(Path file, String key) throws IOException {
        s3Client.putObject(
                PutObjectRequest.builder().bucket(STAGING_BUCKET).key(key).build(),
                RequestBody.fromFile(file)
        );
    }

    private void deleteRaw(String key) {
        try {
            s3Client.deleteObject(
                    DeleteObjectRequest.builder().bucket(UPLOADS_BUCKET).key(key).build());
            log.info("Deleted raw file key={}", key);
        } catch (Exception e) {
            // Non-fatal: raw bucket has its own lifecycle policy
            log.warn("Could not delete raw file key={}: {}", key, e.getMessage());
        }
    }

    private void cleanWorkDir(Path workDir) {
        if (!Files.exists(workDir)) return;

        int[] counts = {0, 0}; // [deleted, failed]

        try (var stream = Files.walk(workDir)) {
            stream.sorted(java.util.Comparator.reverseOrder())
                  .forEach(p -> {
                      try {
                          Files.deleteIfExists(p);
                          counts[0]++;
                      } catch (IOException ex) {
                          counts[1]++;
                          if (log.isDebugEnabled()) {
                              log.debug("Could not delete temp file {}: {}", p, ex.getMessage());
                          }
                      }
                  });
        } catch (IOException e) {
            // Files.walk itself failed (e.g. permission denied on root) — genuinely unexpected.
            log.warn("Could not walk work dir {}: {}", workDir, e.getMessage());
        }

        if (counts[1] > 0) {
            log.warn("Cleaned work dir {} — deleted: {}, failed: {}", workDir, counts[0], counts[1]);
        } else {
            log.debug("Cleaned work dir {} — {} files removed", workDir, counts[0]);
        }
    }
}
