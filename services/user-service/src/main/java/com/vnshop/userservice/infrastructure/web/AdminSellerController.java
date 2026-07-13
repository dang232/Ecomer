package com.vnshop.userservice.infrastructure.web;

import com.vnshop.userservice.application.ApproveSellerUseCase;
import com.vnshop.userservice.application.ListPendingSellersUseCase;
import com.vnshop.userservice.application.RejectSellerUseCase;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/admin/sellers")
@PreAuthorize("hasRole('ADMIN')")
public class AdminSellerController {
    private final ListPendingSellersUseCase listPendingSellersUseCase;
    private final ApproveSellerUseCase approveSellerUseCase;
    private final RejectSellerUseCase rejectSellerUseCase;

    public AdminSellerController(ListPendingSellersUseCase listPendingSellersUseCase, ApproveSellerUseCase approveSellerUseCase, RejectSellerUseCase rejectSellerUseCase) {
        this.listPendingSellersUseCase = listPendingSellersUseCase;
        this.approveSellerUseCase = approveSellerUseCase;
        this.rejectSellerUseCase = rejectSellerUseCase;
    }

    @GetMapping
    public ApiResponse<List<SellerProfileResponse>> pendingSellers() {
        return ApiResponse.ok(listPendingSellersUseCase.listPending().stream()
                .map(SellerProfileResponse::fromDomain)
                .toList());
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
