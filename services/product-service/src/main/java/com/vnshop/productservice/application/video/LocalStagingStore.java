package com.vnshop.productservice.application.video;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Path;
import java.util.UUID;

/**
 * Local-disk staging store for resumable chunked uploads.
 *
 * <p>Chunks are written to local tmpfs (or disk) using random-access writes so
 * that a client can resume from any {@code Upload-Offset}. On finalise, the
 * assembled file is streamed into the {@link #putObject} call which moves it
 * to object storage in a single PUT.
 *
 * <p>Replaces the previous design that wrote each chunk as a separate S3
 * object under {@code stagingKey + "?offset=N"} (CRITICAL-1 in the 2026-06-15
 * quality pass).
 */
public interface LocalStagingStore {

    /**
     * Writes {@code chunkLength} bytes from {@code chunkData} at {@code chunkOffset}
     * in the local staging file for {@code videoId}. Sparse-write friendly so
     * resume from a non-zero offset overwrites only the new bytes.
     *
     * @return the new offset (chunkOffset + chunkLength) after the write
     */
    long writeChunk(UUID videoId, long chunkOffset, byte[] chunkData, int chunkLength) throws IOException;

    /**
     * Returns the assembled file as an InputStream for uploading to object storage.
     * The caller is responsible for closing the stream.
     */
    InputStream openForRead(UUID videoId) throws IOException;

    /**
     * Streams the assembled local file into the given target key in object storage.
     * The local file is deleted on success.
     *
     * @return the SHA-256 hex of the file as uploaded
     */
    String putObject(UUID videoId, String targetKey) throws IOException;

    /** Deletes the local staging file. Idempotent — no-op if it does not exist. */
    void delete(UUID videoId);

    /** Returns the local file path for inspection (tests, debug logging). */
    Path localPath(UUID videoId);

    /** Returns the on-disk size of the staged file, or 0 if not present. */
    long currentSize(UUID videoId) throws IOException;
}
