package com.vnshop.productservice.infrastructure.event;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.mock;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.productservice.application.video.VideoUploadService;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TranscodeFailureConsumerTest {
    @Test
    void consume_delegatesVideoIdAndFailureReason() {
        VideoUploadService service = mock(VideoUploadService.class);
        TranscodeFailureConsumer consumer = new TranscodeFailureConsumer(new ObjectMapper(), service);
        UUID videoId = UUID.randomUUID();

        consumer.consume("{\"videoId\":\"" + videoId + "\",\"errorMessage\":\"ffmpeg failed\"}");

        verify(service).markTranscodeFailed(videoId, "ffmpeg failed");
    }
}
