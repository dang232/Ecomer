package com.vnshop.userservice.infrastructure.web;

import com.vnshop.userservice.application.AdminUserUseCase;
import com.vnshop.userservice.domain.BuyerProfile;
import com.vnshop.userservice.domain.port.out.AdminBuyerCursor;
import com.vnshop.userservice.infrastructure.web.pagination.AdminCursorCodec;
import com.vnshop.userservice.infrastructure.web.pagination.AdminCursorFilterHash;
import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.beans.factory.annotation.Autowired;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;

@RestController
@RequestMapping("/admin/users")
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {
    private static final int DEFAULT_LIMIT = 50;
    private static final int MAX_LIMIT = 100;
    private static final String RESOURCE = "admin-users";
    private static final String SORT = "name:asc,id:asc";

    private final AdminUserUseCase adminUserUseCase;
    private final AdminCursorCodec cursorCodec;

    @Autowired
    public AdminUserController(AdminUserUseCase adminUserUseCase, AdminCursorCodec cursorCodec) {
        this.adminUserUseCase = adminUserUseCase;
        this.cursorCodec = cursorCodec;
    }

    public AdminUserController(AdminUserUseCase adminUserUseCase) {
        this(adminUserUseCase, null);
    }

    @GetMapping
    public ApiResponse<?> searchUsers(
            @RequestParam(required = false, name = "q") String query,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) String cursor,
            @PageableDefault(size = 50, sort = "name") Pageable pageable
    ) {
        if (limit != null || cursor != null) return cursorPage(query, limit, cursor);
        return ApiResponse.ok(
                adminUserUseCase.searchUsers(query, pageable).map(BuyerProfileResponse::fromDomain)
        );
    }

    private ApiResponse<AdminCursorPage<BuyerProfileResponse>> cursorPage(String query, Integer requestedLimit, String token) {
        int limit = requestedLimit == null ? DEFAULT_LIMIT : requestedLimit;
        if (limit < 1 || limit > MAX_LIMIT) throw new IllegalArgumentException("invalid_page_size");
        String filterHash = AdminCursorFilterHash.forQuery(query);
        AdminBuyerCursor anchor = null;
        if (token != null) {
            AdminCursorCodec.Cursor decoded = cursorCodec.decode(token, RESOURCE, filterHash, SORT);
            try {
                anchor = new AdminBuyerCursor("\u0000".equals(decoded.sortKey()) ? "" : decoded.sortKey(),
                        decoded.uniqueId().toLowerCase(java.util.Locale.ROOT));
            } catch (RuntimeException exception) {
                throw AdminCursorCodec.InvalidCursorException.invalidAnchor();
            }
        }
        List<BuyerProfile> rows = adminUserUseCase.searchUsersCursor(query, anchor, limit + 1);
        boolean hasMore = rows.size() > limit;
        List<BuyerProfile> items = hasMore ? rows.subList(0, limit) : rows;
        String next = hasMore ? cursorCodec.encode(new AdminCursorCodec.Cursor(RESOURCE, filterHash, SORT,
                nameKey(items.getLast()), items.getLast().keycloakId(), null, null)) : null;
        return ApiResponse.ok(new AdminCursorPage<>(items.stream().map(BuyerProfileResponse::fromDomain).toList(), next,
                hasMore, limit, new AdminCursorPage.Sort("name", "asc"), null));
    }

    private static String nameKey(BuyerProfile profile) {
        String value = profile.name() == null ? "" : profile.name().toLowerCase(java.util.Locale.ROOT);
        return value.isEmpty() ? "\u0000" : value;
    }

    @PostMapping("/{id}/ban")
    public ApiResponse<BuyerProfileResponse> ban(@PathVariable String id) {
        return ApiResponse.ok(BuyerProfileResponse.fromDomain(adminUserUseCase.banUser(id)));
    }

    @PostMapping("/{id}/unban")
    public ApiResponse<BuyerProfileResponse> unban(@PathVariable String id) {
        return ApiResponse.ok(BuyerProfileResponse.fromDomain(adminUserUseCase.unbanUser(id)));
    }
}
