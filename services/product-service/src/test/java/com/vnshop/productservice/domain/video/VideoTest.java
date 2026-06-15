package com.vnshop.productservice.domain.video;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.UUID;

class VideoTest {

    private Video pendingReview() {
        return new Video(UUID.randomUUID(), "seller-1", "product-1", null,
                "staging/vid.mp4", null, VideoStatus.PENDING_REVIEW,
                null, null, null, null, Instant.now());
    }

    @Test
    void withApproval_setsStatusToPublishedAndPublicKey() {
        Video approved = pendingReview().withApproval("admin-1", "vnshop-videos/vid.mp4");

        assertThat(approved.status()).isEqualTo(VideoStatus.PUBLISHED);
        assertThat(approved.publicKey()).isEqualTo("vnshop-videos/vid.mp4");
        assertThat(approved.moderatedBy()).isEqualTo("admin-1");
        assertThat(approved.moderatedAt()).isNotNull();
        assertThat(approved.publishedAt()).isNotNull();
        assertThat(approved.rejectionReason()).isNull();
    }

    @Test
    void withApproval_preservesOriginalVideoIdAndOwner() {
        Video original = pendingReview();
        Video approved = original.withApproval("admin-1", "vnshop-videos/vid.mp4");

        assertThat(approved.videoId()).isEqualTo(original.videoId());
        assertThat(approved.ownerId()).isEqualTo(original.ownerId());
        assertThat(approved.productId()).isEqualTo(original.productId());
    }

    @Test
    void withRejection_setsStatusToRejectedWithReason() {
        Video rejected = pendingReview().withRejection("admin-2", "NSFW content");

        assertThat(rejected.status()).isEqualTo(VideoStatus.REJECTED);
        assertThat(rejected.rejectionReason()).isEqualTo("NSFW content");
        assertThat(rejected.moderatedBy()).isEqualTo("admin-2");
        assertThat(rejected.moderatedAt()).isNotNull();
        assertThat(rejected.publicKey()).isNull();
        assertThat(rejected.publishedAt()).isNull();
    }

    @Test
    void withRejection_preservesOriginalStagingKey() {
        Video original = pendingReview();
        Video rejected = original.withRejection("admin-2", "reason");

        assertThat(rejected.stagingKey()).isEqualTo(original.stagingKey());
    }

    @Test
    void withAppeal_setsStatusToAppealPending() {
        Video rejected = pendingReview().withRejection("admin-1", "bad content");
        Video appealed = rejected.withAppeal();

        assertThat(appealed.status()).isEqualTo(VideoStatus.APPEAL_PENDING);
        // rejectionReason retained for context
        assertThat(appealed.rejectionReason()).isEqualTo("bad content");
    }

    @Test
    void withStatus_changesOnlyStatus() {
        Video original = pendingReview();
        Video updated = original.withStatus(VideoStatus.TRANSCODING);

        assertThat(updated.status()).isEqualTo(VideoStatus.TRANSCODING);
        assertThat(updated.videoId()).isEqualTo(original.videoId());
        assertThat(updated.ownerId()).isEqualTo(original.ownerId());
        assertThat(updated.stagingKey()).isEqualTo(original.stagingKey());
    }

    @Test
    void constructor_throwsWhenVideoIdIsNull() {
        assertThatThrownBy(() -> new Video(null, "seller-1", "product-1", null,
                "staging/vid.mp4", null, VideoStatus.PENDING_REVIEW,
                null, null, null, null, Instant.now()))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void constructor_throwsWhenOwnerIdIsNull() {
        assertThatThrownBy(() -> new Video(UUID.randomUUID(), null, "product-1", null,
                "staging/vid.mp4", null, VideoStatus.PENDING_REVIEW,
                null, null, null, null, Instant.now()))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void constructor_throwsWhenStatusIsNull() {
        assertThatThrownBy(() -> new Video(UUID.randomUUID(), "seller-1", "product-1", null,
                "staging/vid.mp4", null, null,
                null, null, null, null, Instant.now()))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void constructor_setsCreatedAtToNowWhenNull() {
        Instant before = Instant.now();
        Video video = new Video(UUID.randomUUID(), "seller-1", "product-1", null,
                "staging/vid.mp4", null, VideoStatus.PENDING_REVIEW,
                null, null, null, null, null);
        Instant after = Instant.now();

        assertThat(video.createdAt()).isBetween(before, after);
    }

    @Test
    void constructor_preservesExplicitCreatedAt() {
        Instant ts = Instant.parse("2024-06-01T12:00:00Z");
        Video video = new Video(UUID.randomUUID(), "seller-1", "product-1", null,
                "staging/vid.mp4", null, VideoStatus.PENDING_REVIEW,
                null, null, null, null, ts);

        assertThat(video.createdAt()).isEqualTo(ts);
    }

    @Test
    void withApproval_isImmutable_doesNotMutateOriginal() {
        Video original = pendingReview();
        original.withApproval("admin-1", "vnshop-videos/vid.mp4");

        assertThat(original.status()).isEqualTo(VideoStatus.PENDING_REVIEW);
        assertThat(original.publicKey()).isNull();
    }
}
