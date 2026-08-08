package com.vnshop.productservice.domain.video.port.out;

import com.vnshop.productservice.domain.video.Video;
import com.vnshop.productservice.domain.video.VideoStatus;
import com.vnshop.productservice.domain.video.VideoStatusHistory;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface VideoRepositoryPort {
    Optional<Video> findById(UUID videoId);

    Page<Video> findByStatus(VideoStatus status, Pageable pageable);

    default List<Video> findByStatusCursor(VideoStatus status, VideoCursorAnchor anchor, int limit) {
        throw new UnsupportedOperationException("video cursor listing is not available for this repository");
    }

    Video save(Video video);

    void saveHistory(VideoStatusHistory history);

    /**
     * Returns videos that have been in a non-terminal pipeline state since
     * before {@code cutoff}, used by the stuck-video reaper.
     */
    List<Video> findStuckVideos(Instant cutoff);
}
