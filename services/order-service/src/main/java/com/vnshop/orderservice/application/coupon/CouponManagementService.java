package com.vnshop.orderservice.application.coupon;

import com.vnshop.orderservice.domain.Money;
import com.vnshop.orderservice.domain.coupon.Coupon;
import com.vnshop.orderservice.domain.coupon.CouponException;
import com.vnshop.orderservice.domain.coupon.CouponId;
import com.vnshop.orderservice.domain.coupon.CouponRepository;
import com.vnshop.orderservice.domain.coupon.DiscountType;
import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.cache.annotation.CacheEvict;

public class CouponManagementService {
    private static final int DEFAULT_PER_USER_LIMIT = 1;

    private final CouponRepository coupons;
    private final Clock clock;

    public CouponManagementService(CouponRepository coupons, Clock clock) {
        this.coupons = Objects.requireNonNull(coupons, "coupons is required");
        this.clock = Objects.requireNonNull(clock, "clock is required");
    }

    @Transactional(readOnly = true)
    public List<Coupon> all() {
        return coupons.findAll();
    }

    @Transactional(readOnly = true)
    public List<Coupon> active() {
        LocalDateTime now = now();
        return coupons.findAll().stream()
                .filter(Coupon::active)
                .filter(coupon -> !now.isBefore(coupon.validFrom()))
                .filter(coupon -> !now.isAfter(coupon.validUntil()))
                .filter(coupon -> coupon.totalUsed() < coupon.totalLimit())
                .toList();
    }

    @Transactional
    @CacheEvict(value = "coupon", allEntries = true)
    public Coupon create(CouponTerms terms) {
        Objects.requireNonNull(terms, "terms is required");
        if (coupons.findByCode(terms.code()).isPresent()) {
            throw new CouponException("COUPON_CODE_EXISTS", "Coupon code already exists");
        }
        return coupons.save(Coupon.create(
                CouponId.generate(), terms.code(), parseType(terms.type()), terms.value(),
                moneyOrNull(terms.maxDiscount()), moneyOrZero(terms.minOrderValue()),
                terms.maxUses(), terms.perUserLimitOrDefault(), terms.validFromOr(now()),
                terms.validUntilLocal()));
    }

    @Transactional
    @CacheEvict(value = "coupon", allEntries = true)
    public Coupon update(String reference, CouponTerms terms) {
        Coupon current = find(reference);
        Coupon byCode = coupons.findByCode(terms.code()).orElse(null);
        if (byCode != null && !byCode.id().equals(current.id())) {
            throw new CouponException("COUPON_CODE_EXISTS", "Coupon code already exists");
        }
        Coupon replacement = current.replaceTerms(
                terms.code(), parseType(terms.type()), terms.value(), moneyOrNull(terms.maxDiscount()),
                moneyOrZero(terms.minOrderValue()), terms.maxUses(), terms.perUserLimitOrDefault(),
                terms.validFromOr(current.validFrom()), terms.validUntilLocal());
        return coupons.save(replacement);
    }

    @Transactional
    @CacheEvict(value = "coupon", allEntries = true)
    public Coupon deactivate(String reference) {
        Coupon coupon = find(reference);
        coupon.deactivate();
        return coupons.save(coupon);
    }

    private Coupon find(String reference) {
        if (reference == null || reference.isBlank()) throw notFound(reference);
        try {
            return coupons.findById(CouponId.of(UUID.fromString(reference)))
                    .orElseThrow(() -> notFound(reference));
        } catch (IllegalArgumentException ignored) {
            try {
                return coupons.findByLegacyId(Long.parseLong(reference))
                        .orElseThrow(() -> notFound(reference));
            } catch (NumberFormatException invalidReference) {
                throw notFound(reference);
            }
        }
    }

    private static CouponException notFound(String reference) {
        return new CouponException("COUPON_NOT_FOUND", "Coupon not found: " + reference);
    }

    private LocalDateTime now() {
        return LocalDateTime.ofInstant(clock.instant(), ZoneOffset.UTC);
    }

    private static DiscountType parseType(String type) {
        if (type == null) throw new IllegalArgumentException("type is required");
        return switch (type.trim().toUpperCase()) {
            case "PERCENT", "PERCENTAGE" -> DiscountType.PERCENTAGE;
            case "FIXED" -> DiscountType.FIXED;
            case "FREE_SHIPPING" -> DiscountType.FREE_SHIPPING;
            default -> throw new IllegalArgumentException("unsupported coupon type: " + type);
        };
    }

    private static Money moneyOrNull(BigDecimal amount) {
        return amount == null ? null : new Money(amount);
    }

    private static Money moneyOrZero(BigDecimal amount) {
        return amount == null ? Money.ZERO : new Money(amount);
    }

    public record CouponTerms(
            String code,
            String type,
            BigDecimal value,
            BigDecimal minOrderValue,
            BigDecimal maxDiscount,
            int maxUses,
            Integer perUserLimit,
            Instant validFrom,
            Instant validUntil) {

        public CouponTerms {
            Objects.requireNonNull(code, "code is required");
            Objects.requireNonNull(value, "value is required");
            Objects.requireNonNull(validUntil, "validUntil is required");
            if (maxUses <= 0) throw new IllegalArgumentException("maxUses must be positive");
        }

        int perUserLimitOrDefault() {
            return perUserLimit == null ? DEFAULT_PER_USER_LIMIT : perUserLimit;
        }

        LocalDateTime validFromOr(LocalDateTime fallback) {
            return validFrom == null ? fallback : LocalDateTime.ofInstant(validFrom, ZoneOffset.UTC);
        }

        LocalDateTime validUntilLocal() {
            return LocalDateTime.ofInstant(validUntil, ZoneOffset.UTC);
        }
    }
}
