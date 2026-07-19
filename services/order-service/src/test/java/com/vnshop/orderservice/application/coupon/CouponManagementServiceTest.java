package com.vnshop.orderservice.application.coupon;

import com.vnshop.orderservice.application.coupon.CouponManagementService.CouponTerms;
import com.vnshop.orderservice.domain.Money;
import com.vnshop.orderservice.domain.coupon.Coupon;
import com.vnshop.orderservice.domain.coupon.CouponId;
import com.vnshop.orderservice.domain.coupon.CouponRepository;
import com.vnshop.orderservice.domain.coupon.DiscountType;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class CouponManagementServiceTest {
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-07-19T12:00:00Z"), ZoneOffset.UTC);
    private final InMemoryCoupons coupons = new InMemoryCoupons();
    private final CouponManagementService service = new CouponManagementService(coupons, CLOCK);

    @Test
    void createsFrontendCompatibleTermsAndDefaultsPerUserLimit() {
        Coupon coupon = service.create(new CouponTerms(
                " summer 10 ", "PERCENT", BigDecimal.TEN, BigDecimal.valueOf(100_000),
                BigDecimal.valueOf(50_000), 1000, null, null,
                Instant.parse("2026-08-19T12:00:00Z")));

        assertThat(coupon.code()).isEqualTo("SUMMER10");
        assertThat(coupon.discountType()).isEqualTo(DiscountType.PERCENTAGE);
        assertThat(coupon.perUserLimit()).isOne();
        assertThat(coupon.validFrom()).isEqualTo(LocalDateTime.ofInstant(CLOCK.instant(), ZoneOffset.UTC));
    }

    @Test
    void resolvesLegacyNumericReferenceDuringDeactivate() {
        Coupon coupon = coupons.save(coupon("LEGACY"));
        coupons.legacy.put(42L, coupon);

        Coupon deactivated = service.deactivate("42");

        assertThat(deactivated.active()).isFalse();
        assertThat(coupons.findById(coupon.id())).containsSame(coupon);
    }

    @Test
    void activeListExcludesExpiredInactiveAndExhaustedCoupons() {
        Coupon active = coupons.save(coupon("ACTIVE"));
        Coupon inactive = coupons.save(coupon("INACTIVE"));
        inactive.deactivate();
        Coupon exhausted = coupons.save(coupon("EXHAUSTED"));
        exhausted.recordUsage();

        assertThat(service.active()).containsExactly(active);
    }

    private static Coupon coupon(String code) {
        LocalDateTime now = LocalDateTime.ofInstant(CLOCK.instant(), ZoneOffset.UTC);
        return Coupon.create(
                CouponId.generate(), code, DiscountType.FIXED, BigDecimal.valueOf(10_000), null,
                Money.ZERO, 1, 1, now.minusDays(1), now.plusDays(1));
    }

    private static final class InMemoryCoupons implements CouponRepository {
        private final Map<CouponId, Coupon> rows = new LinkedHashMap<>();
        private final Map<Long, Coupon> legacy = new LinkedHashMap<>();

        @Override
        public Optional<Coupon> findByCode(String code) {
            String normalized = code.trim().toUpperCase().replaceAll("\\s+", "");
            return rows.values().stream().filter(coupon -> coupon.code().equals(normalized)).findFirst();
        }

        @Override
        public Optional<Coupon> findById(CouponId id) {
            return Optional.ofNullable(rows.get(id));
        }

        @Override
        public Optional<Coupon> findByLegacyId(long legacyId) {
            return Optional.ofNullable(legacy.get(legacyId));
        }

        @Override
        public Coupon save(Coupon coupon) {
            rows.put(coupon.id(), coupon);
            return coupon;
        }

        @Override
        public List<Coupon> findAll() {
            return List.copyOf(rows.values());
        }
    }
}
