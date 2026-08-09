package com.vnshop.sellerfinanceservice.infrastructure.web;

import com.vnshop.sellerfinanceservice.application.ProcessPayoutUseCase;
import com.vnshop.sellerfinanceservice.application.AdminPayoutReadUseCase;
import com.vnshop.sellerfinanceservice.infrastructure.config.JwtPrincipalUtil;
import com.vnshop.sellerfinanceservice.domain.PayoutStatus;
import com.vnshop.sellerfinanceservice.infrastructure.web.pagination.AdminCursorCodec;
import com.vnshop.sellerfinanceservice.infrastructure.web.pagination.AdminCursorFilterHash;
import java.time.Instant;
import java.util.UUID;
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
    private final AdminCursorCodec cursorCodec;

    public AdminFinanceController(ProcessPayoutUseCase processPayoutUseCase,
            AdminPayoutReadUseCase adminPayoutReadUseCase, AdminCursorCodec cursorCodec) {
        this.processPayoutUseCase = processPayoutUseCase;
        this.adminPayoutReadUseCase = adminPayoutReadUseCase;
        this.cursorCodec = cursorCodec;
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
    public ApiResponse<?> allPayouts(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String q,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) String cursor,
            Pageable pageable) {
        if (limit != null || cursor != null) {
            return cursorPage(q, status, limit, cursor);
        }
        return ApiResponse.ok(adminPayoutReadUseCase.all(q, status, pageable)
                .map(this::toResponse));
    }

    private ApiResponse<AdminCursorPage<PayoutResponse>> cursorPage(
            String query, String status, Integer requestedLimit, String token) {
        int pageSize = requestedLimit == null ? 50 : requestedLimit;
        if (pageSize < 1 || pageSize > 100) {
            throw new IllegalArgumentException("invalid_page_size");
        }
        String normalizedStatus = status == null ? "" : status.trim().toUpperCase(java.util.Locale.ROOT);
        PayoutStatus requestedStatus = parseStatus(normalizedStatus);
        String resource = "admin-payouts";
        String sort = "createdAt:desc,payoutId:desc";
        String filterHash = AdminCursorFilterHash.forPayouts(query, normalizedStatus);
        Instant beforeCreatedAt = null;
        UUID beforePayoutId = null;
        if (token != null) {
            AdminCursorCodec.Cursor decoded = cursorCodec.decode(token, resource, filterHash, sort);
            try {
                beforeCreatedAt = Instant.parse(decoded.sortKey());
                beforePayoutId = UUID.fromString(decoded.uniqueId());
            } catch (RuntimeException exception) {
                throw new AdminCursorCodec.InvalidCursorException(
                        AdminCursorCodec.RejectionReason.MISSING_FIELD);
            }
        }
        AdminPayoutReadUseCase.CursorPage result = adminPayoutReadUseCase.cursor(
                query, requestedStatus, beforeCreatedAt, beforePayoutId, pageSize);
        String next = null;
        if (result.hasMore()) {
            PayoutResponse last = toResponse(result.items().getLast());
            next = cursorCodec.encode(new AdminCursorCodec.Cursor(
                    resource, filterHash, sort, last.createdAt().toString(), last.payoutId(), null, null));
        }
        return ApiResponse.ok(new AdminCursorPage<>(result.items().stream().map(this::toResponse).toList(),
                next, result.hasMore(), pageSize,
                new AdminCursorPage.Sort("createdAt,payoutId", "desc"), null));
    }

    private static PayoutStatus parseStatus(String status) {
        if (status.isBlank() || "ALL".equals(status)) {
            return null;
        }
        try {
            return PayoutStatus.valueOf(status);
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("status is invalid: " + status, exception);
        }
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
