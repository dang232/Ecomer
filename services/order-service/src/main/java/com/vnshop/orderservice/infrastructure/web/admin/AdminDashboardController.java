package com.vnshop.orderservice.infrastructure.web.admin;

import com.vnshop.orderservice.application.GetDashboardUseCase;
import com.vnshop.orderservice.infrastructure.web.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/admin/dashboard")
public class AdminDashboardController {
    private final GetDashboardUseCase getDashboardUseCase;

    public AdminDashboardController(GetDashboardUseCase getDashboardUseCase) {
        this.getDashboardUseCase = getDashboardUseCase;
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/summary")
    public ApiResponse<DashboardSummaryResponse> summary() {
        return ApiResponse.ok(DashboardSummaryResponse.fromDomain(getDashboardUseCase.summary()));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/revenue")
    public ApiResponse<RevenueTimeSeriesResponse> revenue() {
        return ApiResponse.ok(RevenueTimeSeriesResponse.fromDomain(getDashboardUseCase.revenue()));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/top-products")
    public ApiResponse<List<TopItemResponse>> topProducts() {
        return ApiResponse.ok(getDashboardUseCase.topProducts().stream().map(TopItemResponse::fromDomain).toList());
    }

    @PreAuthorize("hasRole('ADMIN')")
    @GetMapping("/top-sellers")
    public ApiResponse<List<TopItemResponse>> topSellers() {
        return ApiResponse.ok(getDashboardUseCase.topSellers().stream().map(TopItemResponse::fromDomain).toList());
    }
}
