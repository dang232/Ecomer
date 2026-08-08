package com.vnshop.userservice.infrastructure.web;

import com.vnshop.userservice.application.ApproveSellerUseCase;
import com.vnshop.userservice.application.ListPendingSellersUseCase;
import com.vnshop.userservice.application.RejectSellerUseCase;
import com.vnshop.userservice.domain.SellerProfile;
import com.vnshop.userservice.domain.port.out.AdminSellerCursor;
import com.vnshop.userservice.infrastructure.web.pagination.AdminCursorCodec;
import com.vnshop.userservice.infrastructure.web.pagination.AdminCursorFilterHash;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.beans.factory.annotation.Autowired;

import java.util.List;

@RestController
@RequestMapping("/admin/sellers")
@PreAuthorize("hasRole('ADMIN')")
public class AdminSellerController {
    private static final int DEFAULT_LIMIT = 50;
    private static final int MAX_LIMIT = 100;
    private static final String RESOURCE = "admin-sellers";
    private static final String SORT = "createdAt:desc,keycloakId:desc";
    private final ListPendingSellersUseCase listPendingSellersUseCase;
    private final ApproveSellerUseCase approveSellerUseCase;
    private final RejectSellerUseCase rejectSellerUseCase;
    private final AdminCursorCodec cursorCodec;

    @Autowired
    public AdminSellerController(ListPendingSellersUseCase listPendingSellersUseCase, ApproveSellerUseCase approveSellerUseCase, RejectSellerUseCase rejectSellerUseCase, AdminCursorCodec cursorCodec) {
        this.listPendingSellersUseCase = listPendingSellersUseCase;
        this.approveSellerUseCase = approveSellerUseCase;
        this.rejectSellerUseCase = rejectSellerUseCase;
        this.cursorCodec = cursorCodec;
    }

    public AdminSellerController(ListPendingSellersUseCase listPendingSellersUseCase, ApproveSellerUseCase approveSellerUseCase, RejectSellerUseCase rejectSellerUseCase) {
        this(listPendingSellersUseCase, approveSellerUseCase, rejectSellerUseCase, null);
    }

    @GetMapping
    public ApiResponse<?> pendingSellers(@RequestParam(required = false) String q,
                                         @RequestParam(required = false) Integer limit,
                                         @RequestParam(required = false) String cursor) {
        if (limit != null || cursor != null) return cursorPage(q, limit, cursor);
        return ApiResponse.ok(listPendingSellersUseCase.listPending(q).stream()
                .map(SellerProfileResponse::fromDomain)
                .toList());
    }

    private ApiResponse<AdminCursorPage<SellerProfileResponse>> cursorPage(String query, Integer requestedLimit, String token) {
        int limit = requestedLimit == null ? DEFAULT_LIMIT : requestedLimit;
        if (limit < 1 || limit > MAX_LIMIT) throw new IllegalArgumentException("invalid_page_size");
        String filterHash = AdminCursorFilterHash.forQuery(query);
        AdminSellerCursor anchor = null;
        if (token != null) {
            AdminCursorCodec.Cursor decoded = cursorCodec.decode(token, RESOURCE, filterHash, SORT);
            try {
                anchor = new AdminSellerCursor(java.time.Instant.parse(decoded.sortKey()),
                        decoded.uniqueId());
            } catch (RuntimeException exception) {
                throw AdminCursorCodec.InvalidCursorException.invalidAnchor();
            }
        }
        List<SellerProfile> rows = listPendingSellersUseCase.listPendingCursor(query, anchor, limit + 1);
        boolean hasMore = rows.size() > limit;
        List<SellerProfile> items = hasMore ? rows.subList(0, limit) : rows;
        String next = hasMore ? cursorCodec.encode(new AdminCursorCodec.Cursor(RESOURCE, filterHash, SORT,
                items.getLast().createdAt().toString(), items.getLast().id(), null, null)) : null;
        return ApiResponse.ok(new AdminCursorPage<>(items.stream().map(SellerProfileResponse::fromDomain).toList(), next,
                hasMore, limit, new AdminCursorPage.Sort("createdAt,keycloakId", "desc"), null));
    }

    @PostMapping("/{id}/approve")
    public ApiResponse<SellerProfileResponse> approve(@PathVariable String id) {
        return ApiResponse.ok(SellerProfileResponse.fromDomain(approveSellerUseCase.approve(id)));
    }

    @PostMapping("/{id}/reject")
    public ApiResponse<SellerProfileResponse> reject(@PathVariable String id, @RequestBody RejectRequest request) {
        return ApiResponse.ok(SellerProfileResponse.fromDomain(rejectSellerUseCase.reject(id, request.reason())));
    }

    public record RejectRequest(String reason) {}
}
