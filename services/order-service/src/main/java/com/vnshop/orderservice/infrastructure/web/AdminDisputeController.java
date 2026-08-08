package com.vnshop.orderservice.infrastructure.web;

import com.vnshop.orderservice.application.DisputeUseCase;
import com.vnshop.orderservice.application.ListOpenDisputesUseCase;
import com.vnshop.orderservice.infrastructure.config.JwtPrincipalUtil;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.beans.factory.annotation.Autowired;
import com.vnshop.orderservice.infrastructure.web.pagination.AdminCursorCodec;
import com.vnshop.orderservice.application.DisputeCursorResult;
import java.time.Instant;

@RestController
@RequestMapping("/admin/disputes")
public class AdminDisputeController {
    private final DisputeUseCase disputeUseCase;
    private final ListOpenDisputesUseCase listOpenDisputesUseCase;
    private final AdminCursorCodec cursorCodec;

    @Autowired
    public AdminDisputeController(DisputeUseCase disputeUseCase, ListOpenDisputesUseCase listOpenDisputesUseCase,
            AdminCursorCodec cursorCodec) {
        this.disputeUseCase = disputeUseCase;
        this.listOpenDisputesUseCase = listOpenDisputesUseCase;
        this.cursorCodec = cursorCodec;
    }

    public AdminDisputeController(DisputeUseCase disputeUseCase, ListOpenDisputesUseCase listOpenDisputesUseCase) {
        this(disputeUseCase, listOpenDisputesUseCase,
                new AdminCursorCodec("dev-only-change-me", java.time.Duration.ofHours(1), java.time.Clock.systemUTC()));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/open")
    public ApiResponse<?> open(@RequestParam(required = false) String q,
            @RequestParam(required = false) Integer limit, @RequestParam(required = false) String cursor) {
        if (limit != null || cursor != null) return cursorPage(q, limit, cursor);
        return ApiResponse.ok(listOpenDisputesUseCase.listOpenEnriched(q).stream()
                .map(DisputeResponse::fromEnriched)
                .toList());
    }

    private ApiResponse<AdminCursorPage<DisputeResponse>> cursorPage(String query, Integer requestedLimit, String token) {
        int pageSize = requestedLimit == null ? 50 : requestedLimit;
        if (pageSize < 1 || pageSize > 100) throw new IllegalArgumentException("invalid_page_size");
        String filterHash = filterHash(query);
        Instant before = null; UUID beforeId = null;
        if (token != null) {
            var decoded = cursorCodec.decode(token, "admin-disputes-open", filterHash, "createdAt:desc,disputeId:desc");
            before = Instant.parse(decoded.sortKey()); beforeId = UUID.fromString(decoded.uniqueId());
        }
        DisputeCursorResult result = listOpenDisputesUseCase.listOpenEnrichedCursor(query, before, beforeId, pageSize);
        String next = result.hasMore() ? cursorCodec.encode(new AdminCursorCodec.Cursor("admin-disputes-open", filterHash,
                "createdAt:desc,disputeId:desc", result.lastCreatedAt().toString(), result.lastDisputeId().toString(), null, null)) : null;
        return ApiResponse.ok(new AdminCursorPage<>(result.items().stream().map(DisputeResponse::fromEnriched).toList(), next,
                result.hasMore(), pageSize, new AdminCursorPage.Sort("createdAt", "desc"), null));
    }

    private static String filterHash(String query) {
        try { return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256")
                .digest((query == null ? "" : query.trim().toLowerCase()).getBytes(java.nio.charset.StandardCharsets.UTF_8))); }
        catch (java.security.NoSuchAlgorithmException exception) { throw new IllegalStateException(exception); }
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/{disputeId}/resolve")
    public ApiResponse<DisputeResponse> resolve(@PathVariable UUID disputeId, @Valid @RequestBody ResolveDisputeRequest request) {
        return ApiResponse.ok(DisputeResponse.fromDomain(
                disputeUseCase.resolve(disputeId, request.adminResolution(), JwtPrincipalUtil.currentUserId())));
    }
}
