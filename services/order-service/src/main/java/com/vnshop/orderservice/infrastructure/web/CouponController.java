package com.vnshop.orderservice.infrastructure.web;

import com.vnshop.orderservice.application.coupon.CouponManagementService;
import com.vnshop.orderservice.application.coupon.CouponQuote;
import com.vnshop.orderservice.application.coupon.CouponRedemptionService;
import com.vnshop.orderservice.domain.Money;
import com.vnshop.orderservice.domain.coupon.CouponException;
import com.vnshop.orderservice.infrastructure.config.JwtPrincipalUtil;
import jakarta.servlet.http.HttpServletRequest;
import java.math.BigDecimal;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class CouponController {
    private final CouponManagementService management;
    private final CouponRedemptionService redemption;

    public CouponController(CouponManagementService management, CouponRedemptionService redemption) {
        this.management = management;
        this.redemption = redemption;
    }

    @GetMapping("/coupons")
    public ApiResponse<List<CouponResponse>> activeCoupons() {
        return ApiResponse.ok(management.active().stream().map(CouponResponse::from).toList());
    }

    @GetMapping("/admin/coupons")
    public ApiResponse<List<CouponResponse>> allCoupons() {
        return ApiResponse.ok(management.all().stream().map(CouponResponse::from).toList());
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/admin/coupons")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<CouponResponse> create(@RequestBody CouponWriteRequest request) {
        return ApiResponse.ok(CouponResponse.from(management.create(request.toTerms())));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/admin/coupons/{id}")
    public ApiResponse<CouponResponse> update(
            @PathVariable String id, @RequestBody CouponWriteRequest request) {
        return ApiResponse.ok(CouponResponse.from(management.update(id, request.toTerms())));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/admin/coupons/{id}/deactivate")
    public ApiResponse<CouponResponse> deactivate(@PathVariable String id) {
        return ApiResponse.ok(CouponResponse.from(management.deactivate(id)));
    }

    @PostMapping({"/coupons/validate", "/checkout/validate-coupon"})
    public ApiResponse<CouponValidationResponse> validate(
            @RequestBody CouponRequest request, HttpServletRequest httpRequest) {
        CouponQuote quote = quote(request, httpRequest);
        return ApiResponse.ok(CouponValidationResponse.from(quote));
    }

    /**
     * Compatibility endpoint retained as a quote. Usage is consumed only by
     * the transactional place-order flow.
     */
    @PostMapping("/checkout/apply-coupon")
    public ApiResponse<CouponQuoteResponse> applyQuote(
            @RequestBody CouponRequest request, HttpServletRequest httpRequest) {
        CouponQuote quote = quote(request, httpRequest);
        if (!quote.valid()) {
            throw new CouponException(quote.reasonCode(), "Coupon cannot be applied");
        }
        return ApiResponse.ok(CouponQuoteResponse.from(quote));
    }

    private CouponQuote quote(CouponRequest request, HttpServletRequest httpRequest) {
        BigDecimal amount = request.effectiveOrderAmount();
        if (amount == null || amount.signum() <= 0) {
            throw new IllegalArgumentException("orderAmount must be positive");
        }
        return redemption.quote(request.code(), new Money(amount), effectiveUserId(request, httpRequest));
    }

    private static String effectiveUserId(CouponRequest request, HttpServletRequest httpRequest) {
        try {
            return JwtPrincipalUtil.currentUserId();
        } catch (RuntimeException ignored) {
            String forwarded = httpRequest.getHeader("x-user-id");
            return forwarded == null || forwarded.isBlank() ? request.userId() : forwarded;
        }
    }
}
