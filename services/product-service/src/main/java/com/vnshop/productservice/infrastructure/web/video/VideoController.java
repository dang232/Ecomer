package com.vnshop.productservice.infrastructure.web.video;

import com.vnshop.productservice.application.video.VideoUploadService;
import com.vnshop.productservice.domain.video.Video;
import com.vnshop.productservice.infrastructure.config.JwtPrincipalUtil;
import com.vnshop.productservice.infrastructure.web.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.util.UUID;

/**
 * tus 1.0 upload endpoints for video.
 *
 * <p>Endpoints:
 * <ul>
 *   <li>POST  /api/v1/videos/upload           — tus Creation</li>
 *   <li>PATCH /api/v1/videos/upload/{id}       — chunk upload</li>
 *   <li>HEAD  /api/v1/videos/upload/{id}       — offset query</li>
 *   <li>DELETE /api/v1/videos/upload/{id}      — cancel</li>
 *   <li>DELETE /api/v1/videos/{videoId}        — owner soft-delete (PUBLISHED → DELETED)</li>
 *   <li>POST  /api/v1/videos/{videoId}/appeal  — submit appeal (REJECTED → APPEAL_PENDING)</li>
 * </ul>
 *
 * <p>Rate limiting (POST only, 1 req/s burst 3) and concurrent session limits
 * are enforced inside {@link VideoUploadService}.
 */
@RestController
@RequestMapping("/videos")
@RequiredArgsConstructor
public class VideoController {

    static final String TUS_RESUMABLE = "1.0.0";
    static final String HEADER_TUS_RESUMABLE  = "Tus-Resumable";
    static final String HEADER_UPLOAD_OFFSET  = "Upload-Offset";
    static final String HEADER_UPLOAD_LENGTH  = "Upload-Length";
    static final String HEADER_UPLOAD_METADATA = "Upload-Metadata";
    static final String HEADER_CONTENT_TYPE_TUS = "application/offset+octet-stream";

    private final VideoUploadService videoUploadService;

    // -------------------------------------------------------------------------
    // POST /api/v1/videos/upload — tus Creation
    // -------------------------------------------------------------------------

    @PostMapping("/upload")
    public ResponseEntity<Void> createUpload(
            @RequestHeader(HEADER_UPLOAD_LENGTH) long uploadLength,
            @RequestHeader(HEADER_UPLOAD_METADATA) String uploadMetadata,
            @RequestHeader(value = HEADER_TUS_RESUMABLE, defaultValue = TUS_RESUMABLE) String tusResumable) {

        String uploaderId = JwtPrincipalUtil.currentUserId();
        TusMetadata metadata = TusMetadata.parse(uploadMetadata);

        Video video = videoUploadService.createUploadSession(
                uploaderId,
                metadata.ownerType(),
                UUID.fromString(metadata.ownerId()),
                metadata.idempotencyKey(),
                uploadLength,
                metadata.extension());

        HttpHeaders headers = new HttpHeaders();
        headers.set(HEADER_TUS_RESUMABLE, TUS_RESUMABLE);
        headers.set("Location", "/videos/upload/" + video.videoId());
        return ResponseEntity.status(HttpStatus.CREATED).headers(headers).build();
    }

    // -------------------------------------------------------------------------
    // PATCH /api/v1/videos/upload/{id} — chunk upload
    // -------------------------------------------------------------------------

    @RequestMapping(value = "/upload/{id}", method = RequestMethod.PATCH)
    public ResponseEntity<Void> uploadChunk(
            @PathVariable UUID id,
            @RequestHeader(HEADER_UPLOAD_OFFSET) long uploadOffset,
            HttpServletRequest request) throws IOException {

        String uploaderId = JwtPrincipalUtil.currentUserId();
        byte[] chunkData = request.getInputStream().readAllBytes();

        // H4 fix: appendChunk now owns final-chunk detection via the service's stored totalSize.
        videoUploadService.appendChunk(id, uploaderId, uploadOffset, chunkData.length, chunkData);

        long newOffset = uploadOffset + chunkData.length;
        HttpHeaders headers = new HttpHeaders();
        headers.set(HEADER_TUS_RESUMABLE, TUS_RESUMABLE);
        headers.set(HEADER_UPLOAD_OFFSET, String.valueOf(newOffset));
        return ResponseEntity.status(HttpStatus.NO_CONTENT).headers(headers).build();
    }

    // -------------------------------------------------------------------------
    // HEAD /api/v1/videos/upload/{id} — offset query
    // -------------------------------------------------------------------------

    @RequestMapping(value = "/upload/{id}", method = RequestMethod.HEAD)
    public ResponseEntity<Void> getOffset(@PathVariable UUID id) {
        String uploaderId = JwtPrincipalUtil.currentUserId();
        long offset = videoUploadService.getUploadOffset(id, uploaderId);

        HttpHeaders headers = new HttpHeaders();
        headers.set(HEADER_TUS_RESUMABLE, TUS_RESUMABLE);
        headers.set(HEADER_UPLOAD_OFFSET, String.valueOf(offset));
        headers.setCacheControl("no-store");
        return ResponseEntity.status(HttpStatus.OK).headers(headers).build();
    }

    @org.springframework.web.bind.annotation.GetMapping("/{videoId}/status")
    public ApiResponse<VideoStatusResponse> status(@PathVariable UUID videoId) {
        String uploaderId = JwtPrincipalUtil.currentUserId();
        return ApiResponse.ok(VideoStatusResponse.fromDomain(
                videoUploadService.getVideoStatus(videoId, uploaderId)));
    }

    // -------------------------------------------------------------------------
    // DELETE /api/v1/videos/upload/{id} — cancel upload
    // -------------------------------------------------------------------------

    @DeleteMapping("/upload/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public ResponseEntity<Void> cancelUpload(@PathVariable UUID id) {
        String uploaderId = JwtPrincipalUtil.currentUserId();
        videoUploadService.cancelUpload(id, uploaderId);

        HttpHeaders headers = new HttpHeaders();
        headers.set(HEADER_TUS_RESUMABLE, TUS_RESUMABLE);
        return ResponseEntity.status(HttpStatus.NO_CONTENT).headers(headers).build();
    }

    // -------------------------------------------------------------------------
    // DELETE /api/v1/videos/{videoId} — owner soft-delete
    // -------------------------------------------------------------------------

    @DeleteMapping("/{videoId}")
    public ApiResponse<VideoUploadResponse> deleteVideo(@PathVariable UUID videoId) {
        String uploaderId = JwtPrincipalUtil.currentUserId();
        Video video = videoUploadService.deleteVideo(videoId, uploaderId);
        return ApiResponse.ok(VideoUploadResponse.fromDomain(video));
    }

    // -------------------------------------------------------------------------
    // POST /api/v1/videos/{videoId}/appeal — submit appeal
    // -------------------------------------------------------------------------

    @PostMapping("/{videoId}/appeal")
    public ApiResponse<VideoUploadResponse> submitAppeal(
            @PathVariable UUID videoId,
            @org.springframework.web.bind.annotation.RequestBody AppealRequest request) {
        String uploaderId = JwtPrincipalUtil.currentUserId();
        Video video = videoUploadService.submitAppeal(videoId, uploaderId, request.reason());
        return ApiResponse.ok(VideoUploadResponse.fromDomain(video));
    }
}
