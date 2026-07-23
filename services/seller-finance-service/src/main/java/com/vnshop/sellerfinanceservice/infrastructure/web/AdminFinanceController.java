package com.vnshop.sellerfinanceservice.infrastructure.web;

import com.vnshop.sellerfinanceservice.application.ProcessPayoutUseCase;
import com.vnshop.sellerfinanceservice.application.AdminPayoutReadUseCase;
import com.vnshop.sellerfinanceservice.infrastructure.config.JwtPrincipalUtil;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/admin/finance")
public class AdminFinanceController {
    private final ProcessPayoutUseCase processPayoutUseCase;
    private final AdminPayoutReadUseCase adminPayoutReadUseCase;

    public AdminFinanceController(ProcessPayoutUseCase processPayoutUseCase,
            AdminPayoutReadUseCase adminPayoutReadUseCase) {
        this.processPayoutUseCase = processPayoutUseCase;
        this.adminPayoutReadUseCase = adminPayoutReadUseCase;
    }

    @GetMapping("/payouts/pending")
    public ApiResponse<List<PayoutResponse>> pendingPayouts(@RequestParam(required = false) String q) {
        return ApiResponse.ok(adminPayoutReadUseCase.pending(q).stream()
                .map(payout -> PayoutResponse.fromDomain(payout.payout(), payout.sellerName()))
                .toList());
    }

    @GetMapping("/payouts/completed")
    public ApiResponse<List<PayoutResponse>> completedPayouts(@RequestParam(required = false) String q) {
        return ApiResponse.ok(adminPayoutReadUseCase.completed(q).stream()
                .map(payout -> PayoutResponse.fromDomain(payout.payout(), payout.sellerName()))
                .toList());
    }

    @PostMapping("/payouts/{payoutId}/complete")
    public ApiResponse<PayoutResponse> complete(@PathVariable String payoutId) {
        String adminId = JwtPrincipalUtil.currentUserId();
        return ApiResponse.ok(toResponse(adminPayoutReadUseCase.enrich(
                processPayoutUseCase.complete(payoutId, adminId))));
    }

    @PostMapping("/payouts/{payoutId}/fail")
    public ApiResponse<PayoutResponse> fail(@PathVariable String payoutId) {
        return ApiResponse.ok(toResponse(adminPayoutReadUseCase.enrich(processPayoutUseCase.fail(payoutId))));
    }

    private PayoutResponse toResponse(AdminPayoutReadUseCase.EnrichedPayout payout) {
        return PayoutResponse.fromDomain(payout.payout(), payout.sellerName());
    }
}
