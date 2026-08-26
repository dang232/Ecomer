package com.vnshop.productservice.application.video;

import com.vnshop.productservice.domain.video.Video;
import com.vnshop.productservice.domain.video.VideoStatus;
import com.vnshop.productservice.infrastructure.persistence.video.VideoJpaRepository;

import java.io.IOException;
import java.util.Arrays;
import java.util.UUID;

final class VideoChunkUploadService {
    private static final Object[] UPLOAD_LOCKS = new Object[64];
    static {
        Arrays.setAll(UPLOAD_LOCKS, ignored -> new Object());
    }

    private final VideoJpaRepository videoRepository;
    private final LocalStagingStore localStagingStore;
    private final VideoRedisPort videoRedis;
    private final VideoUploadPolicy policy;
    private final VideoUploadSupport support;
    private final VideoLifecycleService lifecycle;

    VideoChunkUploadService(VideoJpaRepository videoRepository, LocalStagingStore localStagingStore,
            VideoRedisPort videoRedis, VideoUploadPolicy policy, VideoUploadSupport support,
            VideoLifecycleService lifecycle) {
        this.videoRepository = videoRepository;
        this.localStagingStore = localStagingStore;
        this.videoRedis = videoRedis;
        this.policy = policy;
        this.support = support;
        this.lifecycle = lifecycle;
    }

    long append(UUID videoId, String uploaderId, long chunkOffset, int chunkLength, byte[] chunkData) {
        synchronized (UPLOAD_LOCKS[Math.floorMod(videoId.hashCode(), UPLOAD_LOCKS.length)]) {
            Video video = support.authorise(videoId, uploaderId);
            support.requireStatus(video, VideoStatus.UPLOADING);
            if (chunkData == null || chunkLength != chunkData.length) {
                throw new VideoValidationException("invalid_chunk_length", "Declared chunk length must match payload length");
            }
            long currentOffset = videoRedis.getOffset(videoId);
            if (chunkOffset != currentOffset) {
                throw new VideoValidationException("invalid_upload_offset", "Upload offset must equal the server offset " + currentOffset);
            }
            long declaredTotal = videoRedis.getTotalSize(videoId);
            if (chunkLength > declaredTotal - chunkOffset) {
                throw new VideoValidationException("chunk_exceeds_upload_length", "Chunk exceeds the declared upload length");
            }
            if (chunkOffset == 0L) {
                policy.validateMagicBytes(chunkData);
            }
            long newOffset;
            try {
                newOffset = localStagingStore.writeChunk(videoId, chunkOffset, chunkData, chunkLength);
            } catch (IOException ex) {
                throw new VideoValidationException("staging_write_failed",
                        "Could not write chunk to local staging: " + ex.getMessage());
            }
            videoRedis.setOffset(videoId, newOffset, VideoUploadPolicy.UPLOAD_STATE_TTL);
            if (declaredTotal > 0 && newOffset == declaredTotal) {
                lifecycle.finalise(videoId, uploaderId);
            }
            return newOffset;
        }
    }
}
