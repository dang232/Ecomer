package com.vnshop.productservice.domain.video.port.out;

import com.vnshop.productservice.domain.video.Video;
import com.vnshop.productservice.domain.video.VideoStatus;
import com.vnshop.productservice.domain.video.VideoStatusHistory;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.util.Optional;
import java.util.UUID;

public interface VideoRepositoryPort {
    Optional<Video> findById(UUID videoId);

    Page<Video> findByStatus(VideoStatus status, Pageable pageable);

    Video save(Video video);

    void saveHistory(VideoStatusHistory history);
}
