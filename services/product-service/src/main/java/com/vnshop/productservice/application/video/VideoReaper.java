package com.vnshop.productservice.application.video;

import com.vnshop.productservice.domain.video.Video;
import com.vnshop.productservice.domain.video.VideoStatus;
import com.vnshop.productservice.domain.video.VideoStatusHistory;
import com.vnshop.productservice.domain.video.port.out.VideoRepositoryPort;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;

/**
 * H3 fix: extracted from {@code VideoUploadService} so the upload service
 * stays focused on the tus lifecycle. Marks videos stuck in
 * UPLOADING/TRANSCODING/MODERATING for longer than
 * {@link #STUCK_VIDEO_THRESHOLD} as FAILED.
 *
 * <p>DELETED is reserved for user-initiated deletions only — this reaper
 * never produces a DELETED transition.
 *
 * <p>Scheduled every 1 minute. On match: transition to FAILED, decrement
 * the user's concurrent session counter, clean up the local staging file.
 */
@Component
@RequiredArgsConstructor
public class VideoReaper {

    private static final Logger LOGGER = LoggerFactory.getLogger(VideoReaper.class);

    static final Duration STUCK_VIDEO_THRESHOLD = Duration.ofMinutes(10);

    private final VideoRepositoryPort videoRepository;
    private final LocalStagingStore localStagingStore;
    private final VideoRedisPort videoRedis;

    @Scheduled(fixedDelay = 60_000)
    public void reaperSweep() {
        Instant cutoff = Instant.now().minus(STUCK_VIDEO_THRESHOLD);
        var stuckVideos = videoRepository.findStuckVideos(cutoff);
        for (Video stuck : stuckVideos) {
            LOGGER.warn("Reaper: marking stuck video {} (status={}) as FAILED", stuck.videoId(), stuck.status());
            videoRepository.save(stuck.withStatus(VideoStatus.FAILED));
            videoRepository.saveHistory(VideoStatusHistory.record(
                    stuck.videoId(), stuck.status(), VideoStatus.FAILED, "reaper", "stuck > 10 min"));
            videoRedis.decrementConcurrentSessions(stuck.ownerId());
            localStagingStore.delete(stuck.videoId());
        }
    }
}
