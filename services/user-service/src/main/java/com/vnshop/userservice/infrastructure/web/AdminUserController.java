package com.vnshop.userservice.infrastructure.web;

import com.vnshop.userservice.application.AdminUserUseCase;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;

@RestController
@RequestMapping("/admin/users")
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {

    private final AdminUserUseCase adminUserUseCase;

    public AdminUserController(AdminUserUseCase adminUserUseCase) {
        this.adminUserUseCase = adminUserUseCase;
    }

    @GetMapping
    public ApiResponse<Page<BuyerProfileResponse>> searchUsers(
            @RequestParam(required = false, name = "q") String query,
            @PageableDefault(size = 50, sort = "name") Pageable pageable
    ) {
        return ApiResponse.ok(
                adminUserUseCase.searchUsers(query, pageable).map(BuyerProfileResponse::fromDomain)
        );
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
