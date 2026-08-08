package com.vnshop.productservice.infrastructure.web.video;

import com.vnshop.productservice.application.video.VideoAdminService;
import com.vnshop.productservice.infrastructure.config.JwtPrincipalUtil;
import com.vnshop.productservice.infrastructure.web.ApiResponse;
import com.vnshop.productservice.infrastructure.web.AdminCursorPage;
import com.vnshop.productservice.infrastructure.web.pagination.AdminCursorCodec;
import com.vnshop.productservice.infrastructure.web.pagination.AdminCursorFilterHash;
import com.vnshop.productservice.domain.video.Video;
import com.vnshop.productservice.domain.video.VideoStatus;
import com.vnshop.productservice.domain.video.port.out.VideoCursorAnchor;
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
import java.time.Instant;
import java.util.List;

@RestController
@RequestMapping("/admin/videos")
@PreAuthorize("hasRole('ADMIN')")
public class AdminVideoController {

    private final VideoAdminService videoAdminService;
    private final AdminCursorCodec cursorCodec;

    public AdminVideoController(VideoAdminService videoAdminService, AdminCursorCodec cursorCodec) {
        this.videoAdminService = videoAdminService;
        this.cursorCodec = cursorCodec;
    }

    public AdminVideoController(VideoAdminService videoAdminService) {
        this(videoAdminService, null);
    }

    /** GET /admin/videos/moderation-queue — paginated PENDING_REVIEW videos, oldest first. */
    @GetMapping("/moderation-queue")
    public ApiResponse<?> moderationQueue(
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.ASC) Pageable pageable,
            @org.springframework.web.bind.annotation.RequestParam(required = false) Integer limit,
            @org.springframework.web.bind.annotation.RequestParam(required = false) String cursor) {
        if (limit != null || cursor != null) return cursorPage(VideoStatus.PENDING_REVIEW, "admin-videos-moderation", limit, cursor);
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
    public ApiResponse<?> appeals(
            @PageableDefault(size = 20, sort = "createdAt", direction = Sort.Direction.ASC) Pageable pageable,
            @org.springframework.web.bind.annotation.RequestParam(required = false) Integer limit,
            @org.springframework.web.bind.annotation.RequestParam(required = false) String cursor) {
        if (limit != null || cursor != null) return cursorPage(VideoStatus.APPEAL_PENDING, "admin-videos-appeals", limit, cursor);
        return ApiResponse.ok(videoAdminService.getAppealsQueue(pageable)
                .map(VideoModerationResponse::fromDomain));
    }

    private ApiResponse<AdminCursorPage<VideoModerationResponse>> cursorPage(VideoStatus status, String resource,
            Integer requestedLimit, String token) {
        int pageSize = requestedLimit == null ? 50 : requestedLimit;
        if (pageSize < 1 || pageSize > 100) throw new IllegalArgumentException("invalid_page_size");
        String sort = "createdAt:asc,videoId:asc";
        String filterHash = AdminCursorFilterHash.forQuery(status.name());
        VideoCursorAnchor anchor = null;
        if (token != null) {
            AdminCursorCodec.Cursor decoded = cursorCodec.decode(token, resource, filterHash, sort);
            try {
                anchor = new VideoCursorAnchor(Instant.parse(decoded.sortKey()), UUID.fromString(decoded.uniqueId()));
            } catch (RuntimeException exception) {
                throw AdminCursorCodec.InvalidCursorException.invalidAnchor();
            }
        }
        List<Video> rows = videoAdminService.getCursorQueue(status, anchor, pageSize);
        boolean hasMore = rows.size() > pageSize;
        List<Video> items = hasMore ? rows.subList(0, pageSize) : rows;
        String next = null;
        if (hasMore) {
            Video last = items.getLast();
            next = cursorCodec.encode(new AdminCursorCodec.Cursor(resource, filterHash, sort,
                    last.createdAt().toString(), last.videoId().toString(), null, null));
        }
        return ApiResponse.ok(new AdminCursorPage<>(items.stream().map(VideoModerationResponse::fromDomain).toList(),
                next, hasMore, pageSize, new AdminCursorPage.Sort("createdAt,videoId", "asc"), null));
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
