package com.vnshop.productservice.infrastructure.web.video;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.vnshop.productservice.application.video.VideoUploadService;
import com.vnshop.productservice.domain.video.Video;
import com.vnshop.productservice.domain.video.VideoOwnerType;
import com.vnshop.productservice.domain.video.VideoStatus;
import com.vnshop.productservice.infrastructure.web.ApiResponse;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

/**
 * Unit tests for VideoController. Uses plain Mockito with a manually installed
 * JWT security context — matching the project's established test style.
 */
class VideoControllerTest {

    private final VideoUploadService service = mock(VideoUploadService.class);
    private final VideoController controller = new VideoController(service);

    private static final UUID VIDEO_ID = UUID.fromString("00000000-0000-0000-0000-000000000099");
    private static final UUID PRODUCT_ID = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final String UPLOADER = "user-123";

    @BeforeEach
    void setUpSecurityContext() {
        // JwtPrincipalUtil reads SecurityContextHolder.getContext().getAuthentication().getPrincipal()
        // and casts it to Jwt. Install a real Jwt so the controller can resolve the caller id.
        Jwt jwt = Jwt.withTokenValue("test-token")
                .header("alg", "none")
                .claim("sub", UPLOADER)
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
        Authentication auth = mock(Authentication.class);
        when(auth.getPrincipal()).thenReturn(jwt);
        SecurityContext ctx = mock(SecurityContext.class);
        when(ctx.getAuthentication()).thenReturn(auth);
        SecurityContextHolder.setContext(ctx);
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    private static String b64(String value) {
        return Base64.getEncoder().encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    private static String validMetadata() {
        return "ownerType " + b64("PRODUCT") + ",ownerId " + b64(PRODUCT_ID.toString())
                + ",idempotencyKey " + b64("idem-1");
    }

    private Video uploadingVideo() {
        return new Video(VIDEO_ID, UPLOADER, PRODUCT_ID.toString(), null,
                "videos/staging/" + VIDEO_ID, null,
                VideoStatus.UPLOADING, null, null, null, null, Instant.now());
    }

    // -------------------------------------------------------------------------
    // POST /upload — tus Creation
    // -------------------------------------------------------------------------

    @Test
    void createUpload_returns201WithLocationAndTusHeader() {
        when(service.createUploadSession(eq(UPLOADER), eq(VideoOwnerType.PRODUCT), eq(PRODUCT_ID), eq("idem-1"), eq(1024L), eq("mp4")))
                .thenReturn(uploadingVideo());

        ResponseEntity<Void> response = controller.createUpload(1024L, validMetadata(), "1.0.0");

        assertThat(response.getStatusCode().value()).isEqualTo(201);
        assertThat(response.getHeaders().getFirst("Location"))
                .isEqualTo("/videos/upload/" + VIDEO_ID);
        assertThat(response.getHeaders().getFirst("Tus-Resumable")).isEqualTo("1.0.0");
    }

    @Test
    void createUpload_parsesOwnerTypeAndOwnerIdFromMetadata() {
        when(service.createUploadSession(any(), any(), any(), any(), any(Long.class), any()))
                .thenReturn(uploadingVideo());

        controller.createUpload(512L, validMetadata(), "1.0.0");

        verify(service).createUploadSession(eq(UPLOADER), eq(VideoOwnerType.PRODUCT), eq(PRODUCT_ID), eq("idem-1"), eq(512L), eq("mp4"));
    }

    // -------------------------------------------------------------------------
    // HEAD /upload/{id} — offset query
    // -------------------------------------------------------------------------

    @Test
    void getOffset_returns200WithOffsetHeader() {
        when(service.getUploadOffset(eq(VIDEO_ID), eq(UPLOADER))).thenReturn(256L);

        ResponseEntity<Void> response = controller.getOffset(VIDEO_ID);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getHeaders().getFirst("Upload-Offset")).isEqualTo("256");
        assertThat(response.getHeaders().getFirst("Tus-Resumable")).isEqualTo("1.0.0");
    }

    // -------------------------------------------------------------------------
    // DELETE /upload/{id} — cancel
    // -------------------------------------------------------------------------

    @Test
    void cancelUpload_returns204AndDelegates() {
        ResponseEntity<Void> response = controller.cancelUpload(VIDEO_ID);

        assertThat(response.getStatusCode().value()).isEqualTo(204);
        verify(service).cancelUpload(eq(VIDEO_ID), eq(UPLOADER));
    }

    // -------------------------------------------------------------------------
    // DELETE /videos/{videoId} — soft-delete
    // -------------------------------------------------------------------------

    @Test
    void deleteVideo_returns200WithDeletedStatus() {
        Video deleted = new Video(VIDEO_ID, UPLOADER, PRODUCT_ID.toString(), null,
                null, null, VideoStatus.DELETED, null, null, null, null, Instant.now());
        when(service.deleteVideo(eq(VIDEO_ID), eq(UPLOADER))).thenReturn(deleted);

        ApiResponse<VideoUploadResponse> response = controller.deleteVideo(VIDEO_ID);

        assertThat(response.success()).isTrue();
        assertThat(response.data().status()).isEqualTo("DELETED");
    }

    // -------------------------------------------------------------------------
    // POST /videos/{videoId}/appeal
    // -------------------------------------------------------------------------

    @Test
    void submitAppeal_returns200WithAppealPendingStatus() {
        Video appealed = new Video(VIDEO_ID, UPLOADER, PRODUCT_ID.toString(), null,
                null, null, VideoStatus.APPEAL_PENDING, "original reason", null, null, null, Instant.now());
        when(service.submitAppeal(eq(VIDEO_ID), eq(UPLOADER), eq("I disagree"))).thenReturn(appealed);

        ApiResponse<VideoUploadResponse> response =
                controller.submitAppeal(VIDEO_ID, new AppealRequest("I disagree"));

        assertThat(response.success()).isTrue();
        assertThat(response.data().status()).isEqualTo("APPEAL_PENDING");
    }

    @Test
    void submitAppeal_delegatesReasonToService() {
        Video appealed = new Video(VIDEO_ID, UPLOADER, PRODUCT_ID.toString(), null,
                null, null, VideoStatus.APPEAL_PENDING, null, null, null, null, Instant.now());
        when(service.submitAppeal(any(), any(), any())).thenReturn(appealed);

        controller.submitAppeal(VIDEO_ID, new AppealRequest("My reason"));

        verify(service).submitAppeal(eq(VIDEO_ID), eq(UPLOADER), eq("My reason"));
    }

    // -------------------------------------------------------------------------
    // TusMetadata parser
    // -------------------------------------------------------------------------

    @Test
    void tusMetadata_parsesAllFields() {
        TusMetadata metadata = TusMetadata.parse(validMetadata());

        assertThat(metadata.ownerType()).isEqualTo(VideoOwnerType.PRODUCT);
        assertThat(metadata.ownerId()).isEqualTo(PRODUCT_ID.toString());
        assertThat(metadata.idempotencyKey()).isEqualTo("idem-1");
        assertThat(metadata.extension()).isEqualTo("mp4");
    }

    @Test
    void tusMetadata_rejectsInvalidOwnerType() {
        String bad = "ownerType " + b64("ADMIN") + ",ownerId " + b64(PRODUCT_ID.toString())
                + ",idempotencyKey " + b64("k");

        assertThatThrownBy(() -> TusMetadata.parse(bad))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("ownerType");
    }
}
