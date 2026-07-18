package com.vnshop.searchservice.application;

import com.vnshop.searchservice.domain.ProductReadModel;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;

/** Encodes an opaque, signed cursor so it cannot be edited or reused for another filter set. */
public final class SearchCursorCodec {
    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private static final String VERSION = "1";

    private final byte[] secret;

    public SearchCursorCodec(String secret) {
        if (secret == null || secret.isBlank()) {
            throw new IllegalArgumentException("cursor secret is required");
        }
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
    }

    public String filterHash(SearchV2Query query) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(query.canonicalFilters().getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    public String encode(SearchV2Query query, ProductReadModel product) {
        String filterHash = filterHash(query);
        String anchor = query.sort() == CursorSort.NEWEST
                ? product.createdAt().toString()
                : product.minPrice().stripTrailingZeros().toPlainString();
        String payload = String.join("|",
                VERSION,
                query.sort().wireValue(),
                filterHash,
                encodePart(anchor),
                encodePart(product.productId())
        );
        return payload + "." + encodePart(sign(payload));
    }

    public SearchCursor decode(String token, SearchV2Query query) {
        if (token == null || token.isBlank()) {
            return null;
        }
        try {
            String[] tokenParts = token.split("\\.", -1);
            if (tokenParts.length != 2) {
                throw new IllegalArgumentException("invalid cursor");
            }
            String payload = tokenParts[0];
            String expectedSignature = sign(payload);
            String actualSignature = decodePart(tokenParts[1]);
            if (!MessageDigest.isEqual(
                    expectedSignature.getBytes(StandardCharsets.UTF_8),
                    actualSignature.getBytes(StandardCharsets.UTF_8))) {
                throw new IllegalArgumentException("invalid cursor signature");
            }

            String[] fields = payload.split("\\|", -1);
            if (fields.length != 5 || !VERSION.equals(fields[0])) {
                throw new IllegalArgumentException("invalid cursor version");
            }
            CursorSort sort = CursorSort.parse(fields[1]);
            String filterHash = fields[2];
            if (sort != query.sort() || !filterHash.equals(filterHash(query))) {
                throw new IllegalArgumentException("cursor does not match the requested filters");
            }
            String anchor = decodePart(fields[3]);
            String productId = decodePart(fields[4]);
            Instant createdAt = sort == CursorSort.NEWEST ? Instant.parse(anchor) : null;
            BigDecimal price = sort == CursorSort.NEWEST ? null : new BigDecimal(anchor);
            return new SearchCursor(sort, filterHash, createdAt, price, productId);
        } catch (IllegalArgumentException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new IllegalArgumentException("invalid cursor", exception);
        }
    }

    private String sign(String payload) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(secret, HMAC_ALGORITHM));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(
                    mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("could not sign search cursor", exception);
        }
    }

    private static String encodePart(String value) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    private static String decodePart(String value) {
        return new String(Base64.getUrlDecoder().decode(value), StandardCharsets.UTF_8);
    }
}
