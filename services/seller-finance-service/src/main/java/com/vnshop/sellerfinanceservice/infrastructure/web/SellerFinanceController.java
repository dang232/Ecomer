package com.vnshop.sellerfinanceservice.infrastructure.web;

import com.vnshop.sellerfinanceservice.application.ListPayoutsUseCase;
import com.vnshop.sellerfinanceservice.application.RequestPayoutUseCase;
import com.vnshop.sellerfinanceservice.application.ViewWalletUseCase;
import com.vnshop.sellerfinanceservice.infrastructure.config.JwtPrincipalUtil;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Note: POST /sellers/me/finance/credits intentionally removed in the
 * pt13 audit pass. The endpoint allowed any authenticated seller to
 * credit their own wallet with any orderAmount they chose, bypassing
 * the legitimate Kafka-driven flow. CreditWalletUseCase is still wired
 * via OrderCreatedFinanceListener — that's the only path that should
 * ever credit a seller's wallet. Re-exposing it would require either
 * an ADMIN role check or moving it under /admin/finance/**.
 */
@RestController
@RequestMapping("/sellers/me/finance")
@PreAuthorize("hasRole('SELLER')")
public class SellerFinanceController {
    private final ViewWalletUseCase viewWalletUseCase;
    private final ListPayoutsUseCase listPayoutsUseCase;
    private final RequestPayoutUseCase requestPayoutUseCase;

    public SellerFinanceController(
            ViewWalletUseCase viewWalletUseCase,
            ListPayoutsUseCase listPayoutsUseCase,
            RequestPayoutUseCase requestPayoutUseCase
    ) {
        this.viewWalletUseCase = viewWalletUseCase;
        this.listPayoutsUseCase = listPayoutsUseCase;
        this.requestPayoutUseCase = requestPayoutUseCase;
    }

    @GetMapping("/wallet")
    public ApiResponse<WalletResponse> wallet() {
        return ApiResponse.ok(WalletResponse.fromDomain(viewWalletUseCase.view(JwtPrincipalUtil.currentSellerId())));
    }

    @GetMapping("/payouts")
    public ApiResponse<List<PayoutResponse>> payouts() {
        return ApiResponse.ok(listPayoutsUseCase.listBySellerId(JwtPrincipalUtil.currentSellerId()).stream()
                .map(PayoutResponse::fromDomain).toList());
    }

    @PostMapping("/payouts")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<PayoutResponse> requestPayout(
            @RequestHeader(value = "Idempotency-Key", required = false) String idempotencyKey,
            @Valid @RequestBody PayoutRequest request) {
        String sellerId = JwtPrincipalUtil.currentSellerId();
        // Keep the legacy route callable during the client migration. New clients must
        // send Idempotency-Key and use the canonical reservation path.
        var payout = idempotencyKey == null || idempotencyKey.isBlank()
                ? requestPayoutUseCase.request(sellerId, request.amount())
                : requestPayoutUseCase.request(sellerId, request.amount(),
                        request.currency() == null || request.currency().isBlank() ? "VND" : request.currency(),
                        idempotencyKey);
        return ApiResponse.ok(PayoutResponse.fromDomain(payout));
    }
}
