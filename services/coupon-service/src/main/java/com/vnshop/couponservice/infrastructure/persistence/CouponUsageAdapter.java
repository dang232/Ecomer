package com.vnshop.couponservice.infrastructure.persistence;

import com.vnshop.couponservice.application.CouponDomainException;
import com.vnshop.couponservice.domain.port.out.CouponUsagePort;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Component;

@Component
public class CouponUsageAdapter implements CouponUsagePort {

    private final CouponUsageRepository repository;

    public CouponUsageAdapter(CouponUsageRepository repository) {
        this.repository = repository;
    }

    @Override
    public boolean hasUserUsedCoupon(Long couponId, String userId) {
        return repository.existsByCouponIdAndUserId(couponId, userId);
    }

    @Override
    public void recordUsage(Long couponId, String userId) {
        try {
            repository.saveAndFlush(new CouponUsageJpaEntity(couponId, userId));
        } catch (DataIntegrityViolationException exception) {
            if (isCouponUserUniquenessViolation(exception)) {
                throw new CouponDomainException("Coupon already used by this user", exception);
            }
            throw exception;
        }
    }

    private static boolean isCouponUserUniquenessViolation(DataIntegrityViolationException exception) {
        Throwable cause = exception;
        while (cause != null) {
            String message = cause.getMessage();
            if (message != null && message.contains("uq_coupon_user")) {
                return true;
            }
            cause = cause.getCause();
        }
        return false;
    }
}
