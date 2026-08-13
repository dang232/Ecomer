package com.vnshop.couponservice.infrastructure.persistence;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;

import com.vnshop.couponservice.application.CouponDomainException;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

class CouponUsageAdapterTest {
    @Test
    void translatesCouponUserUniquenessViolation() {
        CouponUsageRepository repository = mock(CouponUsageRepository.class);
        DataIntegrityViolationException duplicate = new DataIntegrityViolationException(
                "duplicate key value violates unique constraint \"uq_coupon_user\"");
        doThrow(duplicate).when(repository).saveAndFlush(any(CouponUsageJpaEntity.class));

        CouponUsageAdapter adapter = new CouponUsageAdapter(repository);

        assertThatThrownBy(() -> adapter.recordUsage(7L, "buyer-1"))
                .isInstanceOf(CouponDomainException.class)
                .hasMessage("Coupon already used by this user")
                .hasCause(duplicate);
    }

    @Test
    void propagatesUnrelatedIntegrityViolation() {
        CouponUsageRepository repository = mock(CouponUsageRepository.class);
        DataIntegrityViolationException unrelated = new DataIntegrityViolationException(
                "duplicate key value violates unique constraint \"coupons_code_key\"");
        doThrow(unrelated).when(repository).saveAndFlush(any(CouponUsageJpaEntity.class));

        CouponUsageAdapter adapter = new CouponUsageAdapter(repository);

        assertThatThrownBy(() -> adapter.recordUsage(7L, "buyer-1"))
                .isSameAs(unrelated);
    }
}
