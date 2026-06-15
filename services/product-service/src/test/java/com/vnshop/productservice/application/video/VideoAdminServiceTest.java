package com.vnshop.productservice.application.video;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.vnshop.productservice.domain.port.out.ObjectStoragePort;
import com.vnshop.productservice.domain.video.Video;
import com.vnshop.productservice.domain.video.VideoEvent;
import com.vnshop.productservice.domain.video.VideoStatus;
import com.vnshop.productservice.domain.video.VideoStatusHistory;
import com.vnshop.productservice.domain.video.port.out.VideoEventPublisherPort;
import com.vnshop.productservice.domain.video.port.out.VideoRepositoryPort;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

class VideoAdminServiceTest {

    private final VideoRepositoryPort videoRepositoryPort = mock(VideoRepositoryPort.class);
    private final ObjectStoragePort objectStoragePort = mock(ObjectStoragePort.class);
    private final VideoEventPublisherPort videoEventPublisherPort = mock(VideoEventPublisherPort.class);

    private final VideoAdminService service = new VideoAdminService(
            videoRepositoryPort, objectStoragePort, videoEventPublisherPort);

    private UUID videoId;
    private Video pendingVideo;

    @BeforeEach
    void setUp() {
        videoId = UUID.randomUUID();
        pendingVideo = new Video(videoId, "owner-1", "product-1", null,
                "vnshop-videos-staging/abc.mp4", null,
                VideoStatus.PENDING_REVIEW, null, null, null, null, Instant.now());
    }

    @Test
    void getModerationQueue_returnsPendingReviewPage() {
        PageRequest pageable = PageRequest.of(0, 20);
        when(videoRepositoryPort.findByStatus(VideoStatus.PENDING_REVIEW, pageable))
                .thenReturn(new PageImpl<>(List.of(pendingVideo)));

        var result = service.getModerationQueue(pageable);

        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().get(0).status()).isEqualTo(VideoStatus.PENDING_REVIEW);
    }

    @Test
    void getPreviewUrl_throwsWhenVideoNotFound() {
        when(videoRepositoryPort.findById(videoId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getPreviewUrl(videoId))
                .isInstanceOf(VideoNotFoundException.class);
    }

    @Test
    void getPreviewUrl_throwsWhenNoStagingKey() {
        Video noStaging = new Video(videoId, "owner-1", "product-1", null,
                null, null, VideoStatus.PENDING_REVIEW, null, null, null, null, Instant.now());
        when(videoRepositoryPort.findById(videoId)).thenReturn(Optional.of(noStaging));

        assertThatThrownBy(() -> service.getPreviewUrl(videoId))
                .isInstanceOf(VideoNotFoundException.class)
                .hasMessageContaining("no staging file");
    }

    @Test
    void approve_copiesAndDeletesStagingThenPublishes() {
        when(videoRepositoryPort.findById(videoId)).thenReturn(Optional.of(pendingVideo));
        when(videoRepositoryPort.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Video result = service.approve(videoId, "admin-1");

        assertThat(result.status()).isEqualTo(VideoStatus.PUBLISHED);
        assertThat(result.moderatedBy()).isEqualTo("admin-1");
        assertThat(result.publishedAt()).isNotNull();

        verify(objectStoragePort).copyObject("vnshop-videos-staging/abc.mp4", "vnshop-videos/" + videoId);
        verify(objectStoragePort).deleteObject("vnshop-videos-staging/abc.mp4");

        ArgumentCaptor<VideoEvent> eventCaptor = ArgumentCaptor.forClass(VideoEvent.class);
        verify(videoEventPublisherPort).publish(eventCaptor.capture());
        assertThat(eventCaptor.getValue().eventType()).isEqualTo(VideoEvent.EventType.VIDEO_PUBLISHED);

        ArgumentCaptor<VideoStatusHistory> historyCaptor = ArgumentCaptor.forClass(VideoStatusHistory.class);
        verify(videoRepositoryPort).saveHistory(historyCaptor.capture());
        assertThat(historyCaptor.getValue().toStatus()).isEqualTo(VideoStatus.PUBLISHED);
    }

    @Test
    void approve_throwsWhenVideoNotInModerableStatus() {
        Video uploaded = new Video(videoId, "owner-1", "product-1", null,
                "key", null, VideoStatus.UPLOADED, null, null, null, null, Instant.now());
        when(videoRepositoryPort.findById(videoId)).thenReturn(Optional.of(uploaded));

        assertThatThrownBy(() -> service.approve(videoId, "admin-1"))
                .isInstanceOf(VideoModerationException.class);

        verify(objectStoragePort, never()).copyObject(any(), any());
        verify(videoEventPublisherPort, never()).publish(any());
    }

    @Test
    void reject_updatesStatusAndEmitsEvent() {
        when(videoRepositoryPort.findById(videoId)).thenReturn(Optional.of(pendingVideo));
        when(videoRepositoryPort.save(any())).thenAnswer(inv -> inv.getArgument(0));

        Video result = service.reject(videoId, "admin-1", "contains nudity");

        assertThat(result.status()).isEqualTo(VideoStatus.REJECTED);
        assertThat(result.rejectionReason()).isEqualTo("contains nudity");
        assertThat(result.moderatedBy()).isEqualTo("admin-1");

        verify(objectStoragePort, never()).deleteObject(any());

        ArgumentCaptor<VideoEvent> eventCaptor = ArgumentCaptor.forClass(VideoEvent.class);
        verify(videoEventPublisherPort).publish(eventCaptor.capture());
        assertThat(eventCaptor.getValue().eventType()).isEqualTo(VideoEvent.EventType.VIDEO_REJECTED);
    }

    @Test
    void reject_throwsOnBlankReason() {
        when(videoRepositoryPort.findById(videoId)).thenReturn(Optional.of(pendingVideo));

        assertThatThrownBy(() -> service.reject(videoId, "admin-1", "  "))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void reject_throwsOnNullReason() {
        when(videoRepositoryPort.findById(videoId)).thenReturn(Optional.of(pendingVideo));

        assertThatThrownBy(() -> service.reject(videoId, "admin-1", null))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void getAppealsQueue_returnsAppealPendingPage() {
        Video appealVideo = new Video(videoId, "owner-1", "product-1", null,
                "vnshop-videos-staging/abc.mp4", null,
                VideoStatus.APPEAL_PENDING, "reason", "admin-1", Instant.now(), null, Instant.now());
        PageRequest pageable = PageRequest.of(0, 20);
        when(videoRepositoryPort.findByStatus(VideoStatus.APPEAL_PENDING, pageable))
                .thenReturn(new PageImpl<>(List.of(appealVideo)));

        var result = service.getAppealsQueue(pageable);

        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().get(0).status()).isEqualTo(VideoStatus.APPEAL_PENDING);
    }

    @Test
    void approveAppeal_throwsWhenNotInAppealPending() {
        when(videoRepositoryPort.findById(videoId)).thenReturn(Optional.of(pendingVideo));

        assertThatThrownBy(() -> service.approveAppeal(videoId, "admin-1"))
                .isInstanceOf(VideoModerationException.class)
                .hasMessageContaining("APPEAL_PENDING");
    }

    @Test
    void rejectAppeal_throwsWhenNotInAppealPending() {
        when(videoRepositoryPort.findById(videoId)).thenReturn(Optional.of(pendingVideo));

        assertThatThrownBy(() -> service.rejectAppeal(videoId, "admin-1", "final decision"))
                .isInstanceOf(VideoModerationException.class)
                .hasMessageContaining("APPEAL_PENDING");
    }

    @Test
    void constructor_rejectsNullRepository() {
        assertThatThrownBy(() -> new VideoAdminService(null, objectStoragePort, videoEventPublisherPort))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void constructor_rejectsNullStorage() {
        assertThatThrownBy(() -> new VideoAdminService(videoRepositoryPort, null, videoEventPublisherPort))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void constructor_rejectsNullEventPublisher() {
        assertThatThrownBy(() -> new VideoAdminService(videoRepositoryPort, objectStoragePort, null))
                .isInstanceOf(NullPointerException.class);
    }
}
