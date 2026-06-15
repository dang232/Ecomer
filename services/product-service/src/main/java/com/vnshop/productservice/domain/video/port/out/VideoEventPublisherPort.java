package com.vnshop.productservice.domain.video.port.out;

import com.vnshop.productservice.domain.video.VideoEvent;

public interface VideoEventPublisherPort {
    void publish(VideoEvent event);
}
