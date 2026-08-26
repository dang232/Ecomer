package com.vnshop.productservice.application.video;

import com.vnshop.productservice.domain.Product;
import com.vnshop.productservice.domain.port.out.ProductRepositoryPort;
import com.vnshop.productservice.domain.review.Review;
import com.vnshop.productservice.domain.review.port.out.ReviewRepositoryPort;
import com.vnshop.productservice.domain.video.Video;
import com.vnshop.productservice.domain.video.VideoOwnerType;
import com.vnshop.productservice.domain.video.port.out.VideoEventPublisherPort;
import com.vnshop.productservice.infrastructure.persistence.video.VideoJpaRepository;
import com.vnshop.productservice.infrastructure.storage.VideoStorageProperties;

import java.util.UUID;

/** Public facade for the tus video lifecycle application operations. */
public class VideoUploadService {

    static final long MAX_PRODUCT_VIDEO_BYTES = VideoUploadPolicy.MAX_PRODUCT_VIDEO_BYTES;
    static final long MAX_REVIEW_VIDEO_BYTES = VideoUploadPolicy.MAX_REVIEW_VIDEO_BYTES;
    static final int MAX_VIDEOS_PER_DAY = VideoUploadPolicy.MAX_VIDEOS_PER_DAY;
    static final int MAX_VIDEOS_PER_PRODUCT = VideoUploadPolicy.MAX_VIDEOS_PER_PRODUCT;
    static final int MAX_CONCURRENT_SESSIONS = VideoUploadPolicy.MAX_CONCURRENT_SESSIONS;

    private final VideoUploadSessionService sessions;
    private final VideoChunkUploadService chunks;
    private final VideoLifecycleService lifecycle;

    public VideoUploadService(VideoJpaRepository videoJpaRepository, LocalStagingStore localStagingStore,
            VideoEventPublisherPort videoEventPublisherPort, VideoRedisPort videoRedis,
            VideoStorageProperties videoStorageProperties) {
        this(videoJpaRepository, localStagingStore, videoEventPublisherPort, videoRedis,
                videoStorageProperties, null, null);
    }

    public VideoUploadService(VideoJpaRepository videoJpaRepository, LocalStagingStore localStagingStore,
            VideoEventPublisherPort videoEventPublisherPort, VideoRedisPort videoRedis,
            VideoStorageProperties videoStorageProperties, ProductRepositoryPort productRepository,
            ReviewRepositoryPort reviewRepository) {
        VideoUploadPolicy policy = new VideoUploadPolicy(videoJpaRepository, videoRedis,
                productRepository, reviewRepository);
        VideoUploadSupport support = new VideoUploadSupport(videoJpaRepository, videoRedis);
        this.lifecycle = new VideoLifecycleService(videoJpaRepository, localStagingStore,
                videoEventPublisherPort, videoRedis, support);
        this.sessions = new VideoUploadSessionService(videoJpaRepository, videoRedis,
                videoStorageProperties, policy, support);
        this.chunks = new VideoChunkUploadService(videoJpaRepository, localStagingStore,
                videoRedis, policy, support, lifecycle);
    }

    public Video createUploadSession(String uploaderId, VideoOwnerType ownerType, UUID ownerId,
            String idempotencyKey, long contentLength) {
        return createUploadSession(uploaderId, ownerType, ownerId, idempotencyKey, contentLength, "mp4");
    }

    public Video createUploadSession(String uploaderId, VideoOwnerType ownerType, UUID ownerId,
            String idempotencyKey, long contentLength, String extension) {
        return sessions.create(uploaderId, ownerType, ownerId, idempotencyKey, contentLength, extension);
    }

    public long appendChunk(UUID videoId, String uploaderId, long chunkOffset,
            int chunkLength, byte[] chunkData) {
        return chunks.append(videoId, uploaderId, chunkOffset, chunkLength, chunkData);
    }

    public Video finaliseUpload(UUID videoId, String uploaderId) {
        return lifecycle.finalise(videoId, uploaderId);
    }

    public long getUploadOffset(UUID videoId, String uploaderId) {
        lifecycle.authorise(videoId, uploaderId);
        return lifecycle.getOffset(videoId);
    }

    public Video getVideoStatus(UUID videoId, String uploaderId) {
        return lifecycle.authorise(videoId, uploaderId);
    }

    public void markTranscodeFailed(UUID videoId, String reason) {
        lifecycle.markTranscodeFailed(videoId, reason);
    }

    public void cancelUpload(UUID videoId, String uploaderId) {
        lifecycle.cancel(videoId, uploaderId);
    }

    public Video deleteVideo(UUID videoId, String uploaderId) {
        return lifecycle.delete(videoId, uploaderId);
    }

    public Video submitAppeal(UUID videoId, String uploaderId, String appealReason) {
        return lifecycle.submitAppeal(videoId, uploaderId, appealReason);
    }
}
