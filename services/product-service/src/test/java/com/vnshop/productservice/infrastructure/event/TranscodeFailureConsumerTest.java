package com.vnshop.productservice.infrastructure.event;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.mock;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.vnshop.productservice.application.video.VideoUploadService;
import com.vnshop.productservice.application.ValidationException;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
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

    @Test
    void consume_rejectsMalformedEventWithStableValidationCode() {
        TranscodeFailureConsumer consumer = new TranscodeFailureConsumer(new ObjectMapper(), mock(VideoUploadService.class));

        assertThatThrownBy(() -> consumer.consume("{\"videoId\":\"not-a-uuid\"}"))
                .isInstanceOf(ValidationException.class)
                .extracting(exception -> ((ValidationException) exception).code())
                .isEqualTo("VIDEO_TRANSCODE_FAILURE_EVENT_INVALID");
    }
}
