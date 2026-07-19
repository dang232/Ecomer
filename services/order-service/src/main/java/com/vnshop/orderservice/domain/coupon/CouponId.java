package com.vnshop.orderservice.domain.coupon;

import java.util.Objects;
import java.util.UUID;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

public record CouponId(UUID value) {

    public CouponId {
        Objects.requireNonNull(value, "value is required");
    }

    public static CouponId generate() {
        return new CouponId(UUID.randomUUID());
    }

    public static CouponId of(UUID value) {
        return new CouponId(value);
    }

    public static CouponId fromLegacy(long legacyId) {
        try {
            byte[] digest = MessageDigest.getInstance("MD5")
                    .digest(("vnshop-coupon:" + legacyId).getBytes(StandardCharsets.UTF_8));
            long mostSignificant = 0;
            long leastSignificant = 0;
            for (int index = 0; index < 8; index++) {
                mostSignificant = (mostSignificant << 8) | (digest[index] & 0xffL);
                leastSignificant = (leastSignificant << 8) | (digest[index + 8] & 0xffL);
            }
            return new CouponId(new UUID(mostSignificant, leastSignificant));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("MD5 is required by the Java runtime", impossible);
        }
    }

    @Override
    public String toString() {
        return value.toString();
    }
}
