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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

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

    @GetMapping("/payouts")
    public ApiResponse<Page<PayoutResponse>> allPayouts(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String q,
            Pageable pageable) {
        return ApiResponse.ok(adminPayoutReadUseCase.all(q, status, pageable)
                .map(this::toResponse));
    }

    @PostMapping("/payouts/{payoutId}/complete")
    public ApiResponse<PayoutResponse> complete(@PathVariable String payoutId,
            @org.springframework.web.bind.annotation.RequestBody(required = false) PayoutActionRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("manual payment evidence is required");
        }
        request.requireManualPaymentEvidence();
        String adminId = JwtPrincipalUtil.currentUserId();
        var payout = processPayoutUseCase.complete(payoutId, adminId, request.reason(), request.evidenceReference());
        return ApiResponse.ok(toResponse(adminPayoutReadUseCase.enrich(
                payout)));
    }

    @PostMapping("/payouts/{payoutId}/approve")
    public ApiResponse<PayoutResponse> approve(@PathVariable String payoutId,
            @RequestParam String reason) {
        return ApiResponse.ok(toResponse(adminPayoutReadUseCase.enrich(
                processPayoutUseCase.approve(payoutId, JwtPrincipalUtil.currentUserId(), reason))));
    }

    @PostMapping("/payouts/{payoutId}/submit")
    public ApiResponse<PayoutResponse> submit(@PathVariable String payoutId,
            @RequestParam String providerReference, @RequestParam String attemptId) {
        return ApiResponse.ok(toResponse(adminPayoutReadUseCase.enrich(
                processPayoutUseCase.markSubmitted(payoutId, JwtPrincipalUtil.currentUserId(), providerReference, attemptId))));
    }

    @PostMapping("/payouts/{payoutId}/unknown")
    public ApiResponse<PayoutResponse> unknown(@PathVariable String payoutId, @RequestParam String reason) {
        return ApiResponse.ok(toResponse(adminPayoutReadUseCase.enrich(
                processPayoutUseCase.markUnknown(payoutId, JwtPrincipalUtil.currentUserId(), reason))));
    }

    @PostMapping("/payouts/{payoutId}/paid")
    public ApiResponse<PayoutResponse> paid(@PathVariable String payoutId,
            @RequestParam String providerReference, @RequestParam String evidence) {
        return ApiResponse.ok(toResponse(adminPayoutReadUseCase.enrich(
                processPayoutUseCase.markPaid(payoutId, JwtPrincipalUtil.currentUserId(), providerReference, evidence, true))));
    }

    @PostMapping("/payouts/{payoutId}/reject")
    public ApiResponse<PayoutResponse> reject(@PathVariable String payoutId, @RequestParam String reason) {
        return ApiResponse.ok(toResponse(adminPayoutReadUseCase.enrich(
                processPayoutUseCase.reject(payoutId, JwtPrincipalUtil.currentUserId(), reason))));
    }

    @PostMapping("/payouts/{payoutId}/fail")
    public ApiResponse<PayoutResponse> fail(@PathVariable String payoutId,
            @org.springframework.web.bind.annotation.RequestBody(required = false) PayoutActionRequest request) {
        if (request == null) {
            throw new IllegalArgumentException("failure evidence is required");
        }
        request.requireFailureEvidence();
        var payout = processPayoutUseCase.fail(payoutId, JwtPrincipalUtil.currentUserId(), request.reason(), request.evidenceReference());
        return ApiResponse.ok(toResponse(adminPayoutReadUseCase.enrich(payout)));
    }

    private PayoutResponse toResponse(AdminPayoutReadUseCase.EnrichedPayout payout) {
        return PayoutResponse.fromDomain(payout.payout(), payout.sellerName());
    }
}
