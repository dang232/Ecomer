package com.vnshop.couponservice.infrastructure.web;

import com.vnshop.couponservice.application.ApplyCouponUseCase;
import com.vnshop.couponservice.application.CouponTermsCommand;
import com.vnshop.couponservice.application.DeactivateCouponUseCase;
import com.vnshop.couponservice.application.IssueCouponUseCase;
import com.vnshop.couponservice.application.ListCouponsUseCase;
import com.vnshop.couponservice.application.UpdateCouponUseCase;
import com.vnshop.couponservice.application.ValidateCouponUseCase;
import jakarta.servlet.http.HttpServletRequest;
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

/**
 * Thin inbound adapter. Maps HTTP wire shapes onto application use cases and
 * back; all coupon rules (discount math, validity, exhaustion) live in
 * {@link com.vnshop.couponservice.domain.Coupon} and the use cases in the
 * application package.
 */
@RestController
public class CouponController {
    private final IssueCouponUseCase issueCouponUseCase;
    private final UpdateCouponUseCase updateCouponUseCase;
    private final DeactivateCouponUseCase deactivateCouponUseCase;
    private final ValidateCouponUseCase validateCouponUseCase;
    private final ApplyCouponUseCase applyCouponUseCase;
    private final ListCouponsUseCase listCouponsUseCase;

    public CouponController(
            IssueCouponUseCase issueCouponUseCase,
            UpdateCouponUseCase updateCouponUseCase,
            DeactivateCouponUseCase deactivateCouponUseCase,
            ValidateCouponUseCase validateCouponUseCase,
            ApplyCouponUseCase applyCouponUseCase,
            ListCouponsUseCase listCouponsUseCase) {
        this.issueCouponUseCase = issueCouponUseCase;
        this.updateCouponUseCase = updateCouponUseCase;
        this.deactivateCouponUseCase = deactivateCouponUseCase;
        this.validateCouponUseCase = validateCouponUseCase;
        this.applyCouponUseCase = applyCouponUseCase;
        this.listCouponsUseCase = listCouponsUseCase;
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping({"/coupons", "/admin/coupons"})
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<CouponResponse> createCoupon(@RequestBody CreateCouponRequest request) {
        return ApiResponse.ok(CouponResponse.from(issueCouponUseCase.issue(toCommand(request))));
    }

    @GetMapping("/coupons")
    public ApiResponse<List<CouponResponse>> listActiveCoupons() {
        return ApiResponse.ok(
                listCouponsUseCase.active().stream().map(CouponResponse::from).toList());
    }

    @GetMapping("/admin/coupons")
    public ApiResponse<List<CouponResponse>> listCoupons() {
        return ApiResponse.ok(
                listCouponsUseCase.all().stream().map(CouponResponse::from).toList());
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PutMapping("/admin/coupons/{id}")
    public ApiResponse<CouponResponse> updateCoupon(@PathVariable Long id, @RequestBody CreateCouponRequest request) {
        return ApiResponse.ok(CouponResponse.from(updateCouponUseCase.update(id, toCommand(request))));
    }

    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping("/admin/coupons/{id}/deactivate")
    public ApiResponse<CouponResponse> deactivateCoupon(@PathVariable Long id) {
        return ApiResponse.ok(CouponResponse.from(deactivateCouponUseCase.deactivate(id)));
    }

    @PostMapping({"/coupons/validate", "/checkout/validate-coupon"})
    public ApiResponse<ValidateCouponResponse> validateCoupon(@RequestBody ValidateCouponRequest request) {
        return ApiResponse.ok(ValidateCouponResponse.from(
                validateCouponUseCase.validate(request.code(), request.effectiveOrderAmount())));
    }

    @PostMapping("/checkout/apply-coupon")
    public ApiResponse<ApplyCouponResponse> applyCoupon(
            @RequestBody ApplyCouponRequest request,
            HttpServletRequest httpRequest) {
        // The api-gateway forwards x-user-id from the JWT — use it when the
        // body omits userId (the FE never has to know how to send it; the
        // body field stays for direct /coupons callers).
        String userId = request.userId();
        if (userId == null || userId.isBlank()) {
            userId = httpRequest.getHeader("x-user-id");
        }
        return ApiResponse.ok(ApplyCouponResponse.from(
                applyCouponUseCase.apply(request.code(), request.effectiveOrderAmount(), userId)));
    }

    private static CouponTermsCommand toCommand(CreateCouponRequest request) {
        return new CouponTermsCommand(
                request.code(),
                request.type(),
                request.value(),
                request.minOrderValue(),
                request.maxDiscount(),
                request.maxUses(),
                request.validUntil());
    }
}
