package com.vnshop.orderservice.infrastructure.web;

import com.vnshop.orderservice.application.ApproveReturnUseCase;
import com.vnshop.orderservice.application.CompleteReturnUseCase;
import com.vnshop.orderservice.application.DisputeUseCase;
import com.vnshop.orderservice.application.ListReturnsUseCase;
import com.vnshop.orderservice.application.RejectReturnUseCase;
import com.vnshop.orderservice.application.RequestReturnUseCase;
import com.vnshop.orderservice.infrastructure.config.JwtPrincipalUtil;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

import org.springframework.security.access.prepost.PreAuthorize;

@RestController
@RequestMapping("/returns")
public class ReturnController {
    private final RequestReturnUseCase requestReturnUseCase;
    private final ApproveReturnUseCase approveReturnUseCase;
    private final RejectReturnUseCase rejectReturnUseCase;
    private final CompleteReturnUseCase completeReturnUseCase;
    private final DisputeUseCase disputeUseCase;
    private final ListReturnsUseCase listReturnsUseCase;

    public ReturnController(
            RequestReturnUseCase requestReturnUseCase,
            ApproveReturnUseCase approveReturnUseCase,
            RejectReturnUseCase rejectReturnUseCase,
            CompleteReturnUseCase completeReturnUseCase,
            DisputeUseCase disputeUseCase,
            ListReturnsUseCase listReturnsUseCase
    ) {
        this.requestReturnUseCase = requestReturnUseCase;
        this.approveReturnUseCase = approveReturnUseCase;
        this.rejectReturnUseCase = rejectReturnUseCase;
        this.completeReturnUseCase = completeReturnUseCase;
        this.disputeUseCase = disputeUseCase;
        this.listReturnsUseCase = listReturnsUseCase;
    }

    @PreAuthorize("isAuthenticated()")
    @PostMapping
    public ApiResponse<ReturnResponse> request(@Valid @RequestBody RequestReturnRequest request) {
        return ApiResponse.ok(ReturnResponse.fromDomain(requestReturnUseCase.request(JwtPrincipalUtil.currentUserId(), request.subOrderId(), request.reason())));
    }

    @PreAuthorize("isAuthenticated()")
    @GetMapping
    public ApiResponse<List<ReturnResponse>> list() {
        return ApiResponse.ok(listReturnsUseCase.listByBuyerId(JwtPrincipalUtil.currentUserId()).stream()
                .map(ReturnResponse::fromDomain).toList());
    }

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/{returnId}")
    public ApiResponse<ReturnResponse> get(@PathVariable UUID returnId) {
        return ApiResponse.ok(ReturnResponse.fromDomain(
                listReturnsUseCase.findByIdForBuyer(returnId, JwtPrincipalUtil.currentUserId())));
    }

    @PreAuthorize("hasRole('SELLER')")
    @GetMapping("/seller")
    public ApiResponse<List<ReturnResponse>> listForSeller() {
        return ApiResponse.ok(listReturnsUseCase.listBySellerId(JwtPrincipalUtil.currentSellerId()).stream()
                .map(ReturnResponse::fromDomain).toList());
    }

    @PreAuthorize("hasAnyRole('SELLER', 'ADMIN')")
    @PostMapping("/{returnId}/approve")
    public ApiResponse<ReturnResponse> approve(@PathVariable UUID returnId) {
        return ApiResponse.ok(ReturnResponse.fromDomain(
                approveReturnUseCase.approve(returnId, JwtPrincipalUtil.currentSellerId(), JwtPrincipalUtil.currentActorRole())));
    }

    @PreAuthorize("hasAnyRole('SELLER', 'ADMIN')")
    @PostMapping("/{returnId}/reject")
    public ApiResponse<ReturnResponse> reject(@PathVariable UUID returnId) {
        return ApiResponse.ok(ReturnResponse.fromDomain(
                rejectReturnUseCase.reject(returnId, JwtPrincipalUtil.currentSellerId(), JwtPrincipalUtil.currentActorRole())));
    }

    @PreAuthorize("hasAnyRole('SELLER', 'ADMIN')")
    @PostMapping("/{returnId}/complete")
    public ApiResponse<ReturnResponse> complete(@PathVariable UUID returnId) {
        return ApiResponse.ok(ReturnResponse.fromDomain(
                completeReturnUseCase.complete(returnId, JwtPrincipalUtil.currentSellerId(), JwtPrincipalUtil.currentActorRole())));
    }

    @PreAuthorize("isAuthenticated()")
    @PostMapping("/{returnId}/disputes")
    public ApiResponse<DisputeResponse> dispute(@PathVariable UUID returnId, @Valid @RequestBody DisputeRequest request) {
        return ApiResponse.ok(DisputeResponse.fromDomain(
                disputeUseCase.open(returnId, JwtPrincipalUtil.currentUserId(), request.buyerReason(), request.sellerResponse())));
    }

}
