package com.vnshop.orderservice.application.coupon;

import com.vnshop.orderservice.domain.Money;
import com.vnshop.orderservice.domain.coupon.Coupon;
import com.vnshop.orderservice.domain.coupon.CouponException;
import com.vnshop.orderservice.domain.coupon.CouponId;
import com.vnshop.orderservice.domain.coupon.CouponRepository;
import com.vnshop.orderservice.domain.coupon.CouponUsage;
import com.vnshop.orderservice.domain.coupon.CouponUsageRepository;
import com.vnshop.orderservice.domain.coupon.DiscountType;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class CouponRedemptionServiceTest {
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-07-19T12:00:00Z"), ZoneOffset.UTC);
    private static final LocalDateTime NOW = LocalDateTime.ofInstant(CLOCK.instant(), CLOCK.getZone());
    private final InMemoryCoupons coupons = new InMemoryCoupons();
    private final InMemoryUsages usages = new InMemoryUsages();
    private final CouponRedemptionService service = new CouponRedemptionService(coupons, usages, CLOCK);

    @Test
    void quoteIsReadOnly() {
        Coupon coupon = coupons.save(coupon("SAVE10", 5, 2));

        CouponQuote quote = service.quote("save 10", money(200_000), "buyer-1");

        assertThat(quote.valid()).isTrue();
        assertThat(quote.discount().amount()).isEqualByComparingTo("20000");
        assertThat(coupon.totalUsed()).isZero();
        assertThat(usages.rows).isEmpty();
    }

    @Test
    void consumeRecordsOneUsageAndRetryForSameOrderReturnsSameDiscount() {
        Coupon coupon = coupons.save(coupon("SAVE10", 5, 2));
        UUID orderId = UUID.randomUUID();

        Money first = service.consume("SAVE10", money(200_000), "buyer-1", orderId);
        Money retry = service.consume("SAVE10", money(200_000), "buyer-1", orderId);

        assertThat(first.amount()).isEqualByComparingTo("20000");
        assertThat(retry).isEqualTo(first);
        assertThat(coupon.totalUsed()).isOne();
        assertThat(usages.rows).hasSize(1);
        assertThat(usages.rows.getFirst().status()).isEqualTo(CouponUsage.Status.CONSUMED);
    }

    @Test
    void consumeEnforcesTotalAndPerUserLimits() {
        coupons.save(coupon("ONCE", 1, 1));
        service.consume("ONCE", money(200_000), "buyer-1", UUID.randomUUID());

        assertThatThrownBy(() -> service.consume("ONCE", money(200_000), "buyer-2", UUID.randomUUID()))
                .isInstanceOf(CouponException.class)
                .satisfies(error -> assertThat(((CouponException) error).code()).isEqualTo("COUPON_EXHAUSTED"));

        coupons.save(coupon("PERUSER", 10, 1));
        service.consume("PERUSER", money(200_000), "buyer-1", UUID.randomUUID());
        assertThatThrownBy(() -> service.consume("PERUSER", money(200_000), "buyer-1", UUID.randomUUID()))
                .isInstanceOf(CouponException.class)
                .satisfies(error -> assertThat(((CouponException) error).code()).isEqualTo("COUPON_USER_LIMIT"));
    }

    @Test
    void cancellationReleasesConsumedUsageExactlyOnce() {
        Coupon coupon = coupons.save(coupon("SAVE10", 5, 2));
        UUID orderId = UUID.randomUUID();
        service.consume("SAVE10", money(200_000), "buyer-1", orderId);

        assertThat(service.release(orderId)).isTrue();
        assertThat(service.release(orderId)).isFalse();

        assertThat(coupon.totalUsed()).isZero();
        assertThat(usages.rows.getFirst().status()).isEqualTo(CouponUsage.Status.RELEASED);
    }

    @Test
    void legacyCouponIdsMapToStableUuidValues() {
        assertThat(CouponId.fromLegacy(42)).isEqualTo(CouponId.fromLegacy(42));
        assertThat(CouponId.fromLegacy(42)).isNotEqualTo(CouponId.fromLegacy(43));
        assertThat(CouponId.fromLegacy(42).toString())
                .isEqualTo("607273bd-ca49-6a89-2f6a-b4a9286a246f");
    }

    private static Coupon coupon(String code, int totalLimit, int perUserLimit) {
        return Coupon.create(
                CouponId.generate(), code, DiscountType.PERCENTAGE, BigDecimal.TEN, null,
                money(100_000), totalLimit, perUserLimit, NOW.minusDays(1), NOW.plusDays(1));
    }

    private static Money money(long amount) {
        return new Money(BigDecimal.valueOf(amount));
    }

    private static final class InMemoryCoupons implements CouponRepository {
        private final Map<CouponId, Coupon> byId = new LinkedHashMap<>();

        @Override
        public Coupon save(Coupon coupon) {
            byId.put(coupon.id(), coupon);
            return coupon;
        }

        @Override
        public Optional<Coupon> findByCode(String code) {
            String normalized = code.replaceAll("\\s+", "").toUpperCase();
            return byId.values().stream().filter(coupon -> coupon.code().equals(normalized)).findFirst();
        }

        @Override
        public Optional<Coupon> findByCodeForUpdate(String code) {
            return findByCode(code);
        }

        @Override
        public Optional<Coupon> findByIdForUpdate(CouponId id) {
            return Optional.ofNullable(byId.get(id));
        }

        @Override
        public List<Coupon> findAll() {
            return List.copyOf(byId.values());
        }
    }

    private static final class InMemoryUsages implements CouponUsageRepository {
        private final List<CouponUsage> rows = new ArrayList<>();

        @Override
        public int getUsageCount(CouponId couponId, String buyerId) {
            return (int) rows.stream()
                    .filter(row -> row.couponId().equals(couponId))
                    .filter(row -> row.userId().equals(buyerId))
                    .filter(CouponUsage::consumed)
                    .count();
        }

        @Override
        public Optional<CouponUsage> findByOrderIdForUpdate(UUID orderId) {
            return rows.stream().filter(row -> row.orderId().equals(orderId)).findFirst();
        }

        @Override
        public CouponUsage save(CouponUsage usage) {
            rows.removeIf(row -> row.id().equals(usage.id()));
            rows.add(usage);
            return usage;
        }
    }
}
