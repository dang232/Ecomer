package com.vnshop.productservice.infrastructure.storage;

import com.vnshop.productservice.application.video.LocalStagingStore;
import com.vnshop.productservice.domain.port.out.ObjectStoragePort;
import com.vnshop.productservice.domain.storage.ObjectMetadata;
import com.vnshop.productservice.domain.storage.ObjectStorageClass;
import com.vnshop.productservice.domain.storage.ObjectQuarantineState;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.io.RandomAccessFile;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.UUID;

/**
 * Default {@link LocalStagingStore} implementation backed by local disk
 * (tmpfs in production). Buffers chunks to {@code ${video.upload.local-staging-dir:}}
 * and assembles them into a single S3 object on {@link #putObject}.
 */
@Component
@RequiredArgsConstructor
public class LocalStagingStoreImpl implements LocalStagingStore {

    private static final Logger LOGGER = LoggerFactory.getLogger(LocalStagingStoreImpl.class);

    private final ObjectStoragePort objectStoragePort;

    @Value("${video.upload.local-staging-dir:/tmp/video-uploads}")
    private String stagingDir;

    @Override
    public long writeChunk(UUID videoId, long chunkOffset, byte[] chunkData, int chunkLength) throws IOException {
        Path path = localPath(videoId);
        Files.createDirectories(path.getParent());

        // RandomAccessFile with "rw" supports both fresh creation and offset-based resume writes.
        try (RandomAccessFile raf = new RandomAccessFile(path.toFile(), "rw")) {
            raf.seek(chunkOffset);
            raf.write(chunkData, 0, chunkLength);
            return raf.length();
        }
    }

    @Override
    public InputStream openForRead(UUID videoId) throws IOException {
        return Files.newInputStream(localPath(videoId));
    }

    @Override
    public String putObject(UUID videoId, String targetKey) throws IOException {
        Path path = localPath(videoId);
        if (!Files.exists(path)) {
            throw new IOException("Local staging file missing for videoId=" + videoId);
        }
        long size = Files.size(path);

        // Compute SHA-256 while streaming — gives us a single pass instead of two.
        MessageDigest digest;
        try {
            digest = MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException ex) {
            throw new IOException("SHA-256 unavailable", ex);
        }
        try (InputStream in = Files.newInputStream(path);
             DigestComputingInputStream wrapped = new DigestComputingInputStream(in, digest)) {
            objectStoragePort.putObject(
                    targetKey,
                    wrapped,
                    ObjectMetadata.builder()
                            .key(targetKey)
                            .storageClass(ObjectStorageClass.VIDEO_STAGING)
                            .contentType(contentTypeFor(targetKey))
                            .contentLength(size)
                            .quarantineState(ObjectQuarantineState.PENDING_VALIDATION)
                            .createdAt(Instant.now())
                            .build());
        }

        String sha256Hex = HexFormat.of().formatHex(digest.digest());
        LOGGER.info("Uploaded staging file videoId={} key={} size={} sha256={}", videoId, targetKey, size, sha256Hex);

        // Clean up local file once it's safely in S3.
        try {
            Files.deleteIfExists(path);
        } catch (IOException ex) {
            LOGGER.warn("Could not delete local staging file {}: {}", path, ex.getMessage());
        }

        return sha256Hex;
    }

    @Override
    public void delete(UUID videoId) {
        try {
            Files.deleteIfExists(localPath(videoId));
        } catch (IOException ex) {
            LOGGER.warn("Could not delete local staging file for videoId={}: {}", videoId, ex.getMessage());
        }
    }

    @Override
    public Path localPath(UUID videoId) {
        return Paths.get(stagingDir, videoId.toString() + ".bin");
    }

    @Override
    public long currentSize(UUID videoId) throws IOException {
        Path path = localPath(videoId);
        return Files.exists(path) ? Files.size(path) : 0L;
    }

    private static String contentTypeFor(String key) {
        String lowercaseKey = key.toLowerCase(java.util.Locale.ROOT);
        if (lowercaseKey.endsWith(".mov")) return "video/quicktime";
        if (lowercaseKey.endsWith(".webm")) return "video/webm";
        if (lowercaseKey.endsWith(".mkv")) return "video/x-matroska";
        return "video/mp4";
    }
}
