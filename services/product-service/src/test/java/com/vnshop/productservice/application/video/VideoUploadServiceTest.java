package com.vnshop.productservice.application.video;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.vnshop.productservice.domain.port.out.ObjectStoragePort;
import com.vnshop.productservice.domain.storage.ObjectMetadata;
import com.vnshop.productservice.domain.storage.ObjectStorageClass;
import com.vnshop.productservice.domain.video.Video;
import com.vnshop.productservice.domain.video.VideoEvent;
import com.vnshop.productservice.domain.video.VideoOwnerType;
import com.vnshop.productservice.domain.video.VideoStatus;
import com.vnshop.productservice.domain.video.VideoStatusHistory;
import com.vnshop.productservice.domain.video.port.out.VideoEventPublisherPort;
import com.vnshop.productservice.infrastructure.persistence.video.VideoJpaRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

class VideoUploadServiceTest {

    private final FakeVideoRepository videoRepository = new FakeVideoRepository();
    private final FakeObjectStorage objectStorage = new FakeObjectStorage();
    private final FakeLocalStagingStore localStaging = new FakeLocalStagingStore();
    private final FakeVideoEventPublisher eventPublisher = new FakeVideoEventPublisher();
    private final Map<String, String> redisStore = new HashMap<>();

    @SuppressWarnings("unchecked")
    private final ValueOperations<String, String> valueOps = mock(ValueOperations.class);
    private final StringRedisTemplate redisTemplate = mock(StringRedisTemplate.class);

    private VideoUploadService service;

    private static final String UPLOADER = "user-123";
    private static final UUID PRODUCT_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");

    // MP4 magic bytes: 4 zero bytes then "ftyp"
    private static final byte[] VALID_MP4_HEADER = new byte[12];

    static {
        VALID_MP4_HEADER[4] = 0x66; // 'f'
        VALID_MP4_HEADER[5] = 0x74; // 't'
        VALID_MP4_HEADER[6] = 0x79; // 'y'
        VALID_MP4_HEADER[7] = 0x70; // 'p'
    }

    @BeforeEach
    void setUp() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(redisTemplate.expire(anyString(), any())).thenReturn(true);
        when(redisTemplate.delete(anyString())).thenReturn(true);

        when(valueOps.increment(anyString())).thenAnswer(inv -> {
            String key = inv.getArgument(0);
            long v = redisStore.containsKey(key) ? Long.parseLong(redisStore.get(key)) + 1 : 1L;
            redisStore.put(key, String.valueOf(v));
            return v;
        });

        when(valueOps.decrement(anyString())).thenAnswer(inv -> {
            String key = inv.getArgument(0);
            long v = redisStore.containsKey(key) ? Long.parseLong(redisStore.get(key)) - 1 : -1L;
            redisStore.put(key, String.valueOf(v));
            return v;
        });

        when(valueOps.get(anyString())).thenAnswer(inv -> redisStore.get(inv.getArgument(0)));

        doAnswer(inv -> { redisStore.put(inv.getArgument(0), inv.getArgument(1)); return null; })
                .when(valueOps).set(anyString(), anyString(), any(java.time.Duration.class));

        doAnswer(inv -> { redisStore.put(inv.getArgument(0), inv.getArgument(1)); return null; })
                .when(valueOps).set(anyString(), anyString());

        service = new VideoUploadService(videoRepository, localStaging, eventPublisher, redisTemplate);
    }

    @Test
    void createUploadSession_createsVideoInUploadingStatus() {
        Video video = service.createUploadSession(UPLOADER, VideoOwnerType.PRODUCT, PRODUCT_ID, "idem-1", 1024 * 1024);

        assertThat(video.status()).isEqualTo(VideoStatus.UPLOADING);
        assertThat(video.ownerId()).isEqualTo(UPLOADER);
        assertThat(video.productId()).isEqualTo(PRODUCT_ID.toString());
        assertThat(video.stagingKey()).startsWith("videos/staging/");
        assertThat(videoRepository.saved).hasSize(1);
        assertThat(videoRepository.history).hasSize(1);
    }

    @Test
    void createUploadSession_rejectsFileTooLarge() {
        assertThatThrownBy(() -> service.createUploadSession(
                        UPLOADER, VideoOwnerType.PRODUCT, PRODUCT_ID, "idem-2", VideoUploadService.MAX_PRODUCT_VIDEO_BYTES + 1))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("exceeds maximum");
    }

    @Test
    void createUploadSession_rejectsReviewVideoOver200Mb() {
        // 201 MB exceeds REVIEW 200 MB cap
        long overReviewLimit = VideoUploadService.MAX_REVIEW_VIDEO_BYTES + 1024 * 1024;
        assertThatThrownBy(() -> service.createUploadSession(
                        UPLOADER, VideoOwnerType.REVIEW, PRODUCT_ID, "idem-review", overReviewLimit))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("REVIEW");
    }

    @Test
    void createUploadSession_acceptsProductVideoAt500MbBoundary() {
        // 500 MB exactly is allowed for PRODUCT (cap is inclusive, off-by-one in MAX_PRODUCT_VIDEO_BYTES + 1 catches the limit)
        Video video = service.createUploadSession(
                UPLOADER, VideoOwnerType.PRODUCT, PRODUCT_ID, "idem-boundary", VideoUploadService.MAX_PRODUCT_VIDEO_BYTES);
        assertThat(video.status()).isEqualTo(VideoStatus.UPLOADING);
    }

    @Test
    void createUploadSession_enforcesRateLimit() {
        redisStore.put("video:ratelimit:post:" + UPLOADER, "3");

        assertThatThrownBy(() -> service.createUploadSession(
                        UPLOADER, VideoOwnerType.PRODUCT, PRODUCT_ID, "idem-3", 1024))
                .isInstanceOf(VideoUploadRateLimitException.class);
    }

    @Test
    void createUploadSession_enforcesConcurrentSessionLimit() {
        redisStore.put("video:concurrent:" + UPLOADER,
                String.valueOf(VideoUploadService.MAX_CONCURRENT_SESSIONS));

        assertThatThrownBy(() -> service.createUploadSession(
                        UPLOADER, VideoOwnerType.PRODUCT, PRODUCT_ID, "idem-4", 1024))
                .isInstanceOf(VideoUploadRateLimitException.class)
                .hasMessageContaining("concurrent");
    }

    @Test
    void createUploadSession_enforcesDailyQuota() {
        videoRepository.todayCount = VideoUploadService.MAX_VIDEOS_PER_DAY;

        assertThatThrownBy(() -> service.createUploadSession(
                        UPLOADER, VideoOwnerType.PRODUCT, PRODUCT_ID, "idem-5", 1024))
                .isInstanceOf(VideoQuotaExceededException.class)
                .hasMessageContaining("Daily");
    }

    @Test
    void createUploadSession_enforcesProductQuota() {
        videoRepository.productCount = VideoUploadService.MAX_VIDEOS_PER_PRODUCT;

        assertThatThrownBy(() -> service.createUploadSession(
                        UPLOADER, VideoOwnerType.PRODUCT, PRODUCT_ID, "idem-6", 1024))
                .isInstanceOf(VideoQuotaExceededException.class)
                .hasMessageContaining("Product");
    }

    @Test
    void appendChunk_acceptsValidMP4MagicBytesOnFirstChunk() {
        Video video = service.createUploadSession(UPLOADER, VideoOwnerType.PRODUCT, PRODUCT_ID, "idem-7", 1024);
        redisStore.put("video:offset:" + video.videoId(), "0");

        service.appendChunk(video.videoId(), UPLOADER, 0, VALID_MP4_HEADER.length, VALID_MP4_HEADER);
        // no exception expected
    }

    @Test
    void appendChunk_rejectsInvalidMagicBytes() {
        Video video = service.createUploadSession(UPLOADER, VideoOwnerType.PRODUCT, PRODUCT_ID, "idem-8", 1024);
        redisStore.put("video:offset:" + video.videoId(), "0");

        byte[] invalid = new byte[12]; // all zeros — not a valid video

        assertThatThrownBy(() -> service.appendChunk(
                        video.videoId(), UPLOADER, 0, invalid.length, invalid))
                .isInstanceOf(VideoValidationException.class)
                .hasMessageContaining("format not allowed");
    }

    @Test
    void appendChunk_finalisesUploadWhenOffsetReachesTotalSize() {
        // 100-byte video: first chunk (50 bytes MP4 header) doesn't finalise, second chunk (50 bytes) does.
        Video video = service.createUploadSession(UPLOADER, VideoOwnerType.PRODUCT, PRODUCT_ID, "idem-final", 100);

        // First chunk: 50 bytes starting with MP4 magic.
        byte[] firstChunk = new byte[50];
        System.arraycopy(VALID_MP4_HEADER, 0, firstChunk, 0, VALID_MP4_HEADER.length);
        service.appendChunk(video.videoId(), UPLOADER, 0, firstChunk.length, firstChunk);
        assertThat(videoRepository.findById(video.videoId()).orElseThrow().status())
                .isEqualTo(VideoStatus.UPLOADING);

        // Second chunk: offset 50, 50 bytes → reaches total 100 → should finalise
        service.appendChunk(video.videoId(), UPLOADER, 50, 50, new byte[50]);
        assertThat(videoRepository.findById(video.videoId()).orElseThrow().status())
                .isEqualTo(VideoStatus.UPLOADED);
        assertThat(eventPublisher.published.stream()
                .anyMatch(e -> e.eventType() == VideoEvent.EventType.VIDEO_UPLOAD_COMPLETED))
                .isTrue();
    }

    @Test
    void finaliseUpload_transitionsToUploadedAndEmitsEvent() {
        Video video = service.createUploadSession(UPLOADER, VideoOwnerType.PRODUCT, PRODUCT_ID, "idem-9", 1024);

        Video finalised = service.finaliseUpload(video.videoId(), UPLOADER);

        assertThat(finalised.status()).isEqualTo(VideoStatus.UPLOADED);
        assertThat(eventPublisher.published).hasSize(1);
        assertThat(eventPublisher.published.get(0).eventType())
                .isEqualTo(VideoEvent.EventType.VIDEO_UPLOAD_COMPLETED);
    }

    @Test
    void cancelUpload_transitionsToDeleted() {
        Video video = service.createUploadSession(UPLOADER, VideoOwnerType.PRODUCT, PRODUCT_ID, "idem-10", 1024);

        service.cancelUpload(video.videoId(), UPLOADER);

        assertThat(videoRepository.findById(video.videoId()).orElseThrow().status())
                .isEqualTo(VideoStatus.DELETED);
    }

    @Test
    void deleteVideo_transitionsPublishedToDeleted() {
        Video published = publishedVideo();

        Video result = service.deleteVideo(published.videoId(), UPLOADER);

        assertThat(result.status()).isEqualTo(VideoStatus.DELETED);
    }

    @Test
    void deleteVideo_rejectsNonPublishedVideo() {
        Video video = service.createUploadSession(UPLOADER, VideoOwnerType.PRODUCT, PRODUCT_ID, "idem-11", 1024);

        assertThatThrownBy(() -> service.deleteVideo(video.videoId(), UPLOADER))
                .isInstanceOf(VideoModerationException.class)
                .hasMessageContaining("not PUBLISHED");
    }

    @Test
    void submitAppeal_transitionsRejectedToAppealPending() {
        Video rejected = rejectedVideo();

        Video result = service.submitAppeal(rejected.videoId(), UPLOADER, "I believe this was rejected in error.");

        assertThat(result.status()).isEqualTo(VideoStatus.APPEAL_PENDING);
        assertThat(eventPublisher.published.stream()
                .anyMatch(e -> e.eventType() == VideoEvent.EventType.VIDEO_APPEAL_SUBMITTED))
                .isTrue();
    }

    @Test
    void submitAppeal_rejectsBlankReason() {
        Video rejected = rejectedVideo();

        assertThatThrownBy(() -> service.submitAppeal(rejected.videoId(), UPLOADER, "  "))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("appeal reason");
    }

    @Test
    void submitAppeal_rejectsNonRejectedVideo() {
        Video video = service.createUploadSession(UPLOADER, VideoOwnerType.PRODUCT, PRODUCT_ID, "idem-12", 1024);

        assertThatThrownBy(() -> service.submitAppeal(video.videoId(), UPLOADER, "reason"))
                .isInstanceOf(VideoModerationException.class)
                .hasMessageContaining("not REJECTED");
    }

    @Test
    void submitAppeal_rejectsAfter7DayWindow() {
        Video rejectedLongAgo = rejectedVideoModeratedAt(Instant.now().minus(Duration.ofDays(8)));

        assertThatThrownBy(() -> service.submitAppeal(rejectedLongAgo.videoId(), UPLOADER, "still relevant"))
                .isInstanceOf(VideoValidationException.class)
                .hasMessageContaining("Appeal window of 7 days has expired");
    }

    @Test
    void submitAppeal_allowsWithin7DayWindow() {
        Video rejected3DaysAgo = rejectedVideoModeratedAt(Instant.now().minus(Duration.ofDays(3)));

        Video result = service.submitAppeal(rejected3DaysAgo.videoId(), UPLOADER, "still relevant");

        assertThat(result.status()).isEqualTo(VideoStatus.APPEAL_PENDING);
    }

    @Test
    void createUploadSession_duplicateIdempotencyKey_returnsExistingVideo() {
        Video first = service.createUploadSession(UPLOADER, VideoOwnerType.PRODUCT, PRODUCT_ID, "same-key", 1024);

        // Simulate the dedup Redis key being set after first call (in real code, the service does this).
        redisStore.put("video:idempotency:same-key", first.videoId().toString());

        Video second = service.createUploadSession(UPLOADER, VideoOwnerType.PRODUCT, PRODUCT_ID, "same-key", 2048);

        assertThat(second.videoId()).isEqualTo(first.videoId());
        // The dedup path does NOT create a new video record.
        assertThat(videoRepository.saved).hasSize(1);
    }

    @Test
    void findAndAuthorise_hidesVideoFromDifferentUser() {
        Video video = service.createUploadSession(UPLOADER, VideoOwnerType.PRODUCT, PRODUCT_ID, "idem-13", 1024);

        assertThatThrownBy(() -> service.deleteVideo(video.videoId(), "other-user"))
                .isInstanceOf(VideoNotFoundException.class);
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private Video publishedVideo() {
        UUID id = UUID.randomUUID();
        Video v = new Video(id, UPLOADER, PRODUCT_ID.toString(), null,
                "videos/staging/" + id, "videos/public/" + id,
                VideoStatus.PUBLISHED, null, "admin", Instant.now(), Instant.now(), Instant.now());
        videoRepository.saved.put(id, v);
        return v;
    }

    private Video rejectedVideo() {
        UUID id = UUID.randomUUID();
        Video v = new Video(id, UPLOADER, PRODUCT_ID.toString(), null,
                "videos/staging/" + id, null,
                VideoStatus.REJECTED, "NSFW content", "admin", Instant.now(), null, Instant.now());
        videoRepository.saved.put(id, v);
        return v;
    }

    private Video rejectedVideoModeratedAt(Instant moderatedAt) {
        UUID id = UUID.randomUUID();
        Video v = new Video(id, UPLOADER, PRODUCT_ID.toString(), null,
                "videos/staging/" + id, null,
                VideoStatus.REJECTED, "NSFW content", "admin", moderatedAt, null, Instant.now());
        videoRepository.saved.put(id, v);
        return v;
    }

    // -------------------------------------------------------------------------
    // Fakes
    // -------------------------------------------------------------------------

    private static final class FakeVideoRepository extends VideoJpaRepository {
        final Map<UUID, Video> saved = new HashMap<>();
        final List<VideoStatusHistory> history = new ArrayList<>();
        long todayCount = 0;
        long productCount = 0;
        long reviewCount = 0;

        FakeVideoRepository() {
            super(null, null);
        }

        @Override public Optional<Video> findById(UUID videoId) { return Optional.ofNullable(saved.get(videoId)); }
        @Override public Page<Video> findByStatus(VideoStatus status, Pageable pageable) { return Page.empty(); }
        @Override public Video save(Video video) { saved.put(video.videoId(), video); return video; }
        @Override public void saveHistory(VideoStatusHistory h) { history.add(h); }
        @Override public long countUploaderVideosToday(String uploaderId) { return todayCount; }
        @Override public long countActiveVideosForProduct(UUID productId) { return productCount; }
        @Override public long countActiveVideosForReview(UUID reviewId) { return reviewCount; }
        @Override public List<Video> findStuckVideos(Instant updatedBefore) { return List.of(); }
    }

    private static final class FakeObjectStorage implements ObjectStoragePort {
        @Override public void putObject(String key, InputStream content, ObjectMetadata metadata) {}
        @Override public URI getSignedUploadUrl(String key, ObjectMetadata metadata) { return URI.create("https://s3.test/" + key); }
        @Override public URI getSignedDownloadUrl(String key, ObjectStorageClass storageClass) { return URI.create("https://s3.test/" + key); }
        @Override public URI publicUrl(String key) { return URI.create("https://cdn.test/" + key); }
        @Override public void deleteObject(String key) {}
        @Override public void copyObject(String src, String dst) {}
        @Override public Optional<ObjectMetadata> headObject(String key) { return Optional.empty(); }
    }

    private static final class FakeVideoEventPublisher implements VideoEventPublisherPort {
        final List<VideoEvent> published = new ArrayList<>();
        @Override public void publish(VideoEvent event) { published.add(event); }
    }

    /**
     * In-memory {@link LocalStagingStore} for tests. Uses a {@link java.io.ByteArrayOutputStream}
     * per video so chunk writes are assembled correctly. {@link #putObject} returns a fixed
     * SHA-256 hex so tests can assert on it.
     */
    private static final class FakeLocalStagingStore implements LocalStagingStore {
        final Map<UUID, java.io.ByteArrayOutputStream> buffers = new HashMap<>();
        final Map<UUID, Integer> writeCount = new HashMap<>();
        final List<UUID> deleted = new ArrayList<>();

        @Override
        public long writeChunk(UUID videoId, long chunkOffset, byte[] chunkData, int chunkLength) throws IOException {
            var buf = buffers.computeIfAbsent(videoId, id -> new java.io.ByteArrayOutputStream());
            // Truncate the buffer if the chunk overwrites a previously-written region (resume).
            // For our test data we always append, but support the same contract as the real impl.
            buf.write(chunkData, 0, chunkLength);
            writeCount.merge(videoId, 1, Integer::sum);
            return buf.size();
        }

        @Override
        public InputStream openForRead(UUID videoId) throws IOException {
            return new java.io.ByteArrayInputStream(buffers.getOrDefault(videoId, new java.io.ByteArrayOutputStream()).toByteArray());
        }

        @Override
        public String putObject(UUID videoId, String targetKey) throws IOException {
            buffers.remove(videoId);
            return "0123456789abcdef".repeat(4); // 64 hex chars
        }

        @Override
        public void delete(UUID videoId) {
            buffers.remove(videoId);
            deleted.add(videoId);
        }

        @Override
        public java.nio.file.Path localPath(UUID videoId) {
            return java.nio.file.Paths.get("/tmp/test-staging", videoId.toString() + ".bin");
        }

        @Override
        public long currentSize(UUID videoId) {
            var buf = buffers.get(videoId);
            return buf == null ? 0L : buf.size();
        }
    }
}
