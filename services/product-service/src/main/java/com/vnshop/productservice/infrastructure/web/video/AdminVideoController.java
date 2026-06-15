package com.vnshop.productservice.infrastructure.web.video;

import com.vnshop.productservice.application.video.VideoAdminService;
import com.vnshop.productservice.infrastructure.config.JwtPrincipalUtil;
import com.vnshop.productservice.infrastructure.web.ApiResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.UUID;

@RestController
@RequestMapping("/admin/videos")
@PreAuthorize("hasRole('ADMIN')")
public class AdminVideoController {

    private final VideoAdminService videoAdminService;

    public AdminVideoController(VideoAdminService videoAdminService) {
        this.videoAdminService = videoAdminService;
    }

    /** GET /admin/videos/moderation-queue — paginated PENDING_REVIEW videos, oldest first. */
    @GetMapping("/moderation-queue")
    public ApiResponse<Page<VideoModerationResponse>> moderationQueue(
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.ASC) Pageable pageable) {
        return ApiResponse.ok(videoAdminService.getModerationQueue(pageable)
                .map(VideoModerationResponse::fromDomain));
    }

    /** GET /admin/videos/{videoId}/preview — presigned staging URL for admin preview. */
    @GetMapping("/{videoId}/preview")
    public ApiResponse<String> preview(@PathVariable UUID videoId) {
        URI url = videoAdminService.getPreviewUrl(videoId);
        return ApiResponse.ok(url.toString());
    }

    /** POST /admin/videos/{videoId}/approve — move to public bucket, mark PUBLISHED. */
    @PostMapping("/{videoId}/approve")
    public ApiResponse<VideoModerationResponse> approve(@PathVariable UUID videoId) {
        String adminId = JwtPrincipalUtil.currentUserId();
        return ApiResponse.ok(VideoModerationResponse.fromDomain(
                videoAdminService.approve(videoId, adminId)));
    }

    /** POST /admin/videos/{videoId}/reject — mark REJECTED with reason. */
    @PostMapping("/{videoId}/reject")
    public ApiResponse<VideoModerationResponse> reject(
            @PathVariable UUID videoId,
            @RequestBody RejectVideoRequest request) {
        String adminId = JwtPrincipalUtil.currentUserId();
        return ApiResponse.ok(VideoModerationResponse.fromDomain(
                videoAdminService.reject(videoId, adminId, request.reason())));
    }

    /** GET /admin/videos/appeal-queue — paginated APPEAL_PENDING videos. */
    @GetMapping("/appeal-queue")
    public ApiResponse<Page<VideoModerationResponse>> appeals(
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.ASC) Pageable pageable) {
        return ApiResponse.ok(videoAdminService.getAppealsQueue(pageable)
                .map(VideoModerationResponse::fromDomain));
    }

    /** POST /admin/videos/{videoId}/appeal/approve — re-review approve after appeal. */
    @PostMapping("/{videoId}/appeal/approve")
    public ApiResponse<VideoModerationResponse> approveAppeal(@PathVariable UUID videoId) {
        String adminId = JwtPrincipalUtil.currentUserId();
        return ApiResponse.ok(VideoModerationResponse.fromDomain(
                videoAdminService.approveAppeal(videoId, adminId)));
    }

    /** POST /admin/videos/{videoId}/appeal/reject — final rejection after appeal. */
    @PostMapping("/{videoId}/appeal/reject")
    public ApiResponse<VideoModerationResponse> rejectAppeal(
            @PathVariable UUID videoId,
            @RequestBody RejectVideoRequest request) {
        String adminId = JwtPrincipalUtil.currentUserId();
        return ApiResponse.ok(VideoModerationResponse.fromDomain(
                videoAdminService.rejectAppeal(videoId, adminId, request.reason())));
    }
}
