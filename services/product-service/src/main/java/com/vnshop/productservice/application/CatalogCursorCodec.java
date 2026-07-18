package com.vnshop.productservice.application;

import com.vnshop.productservice.domain.CatalogProduct;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

public final class CatalogCursorCodec {
    private static final String HMAC = "HmacSHA256";
    private final byte[] secret;

    public CatalogCursorCodec(String secret) {
        if (secret == null || secret.isBlank()) throw new IllegalArgumentException("cursor secret is required");
        this.secret = secret.getBytes(StandardCharsets.UTF_8);
    }

    public String encode(CatalogV2Query query, CatalogProduct product) {
        String anchor = query.sort() == CatalogCursorSort.NEWEST
                ? product.createdAt().toString()
                : product.minPrice().stripTrailingZeros().toPlainString();
        String payload = String.join("|", "1", query.sort().wireValue(), filterHash(query),
                part(anchor), part(product.product().productId().toString()));
        return payload + "." + part(sign(payload));
    }

    public CatalogCursor decode(String token, CatalogV2Query query) {
        if (token == null || token.isBlank()) return null;
        try {
            String[] tokenParts = token.split("\\.", -1);
            if (tokenParts.length != 2) throw new IllegalArgumentException("invalid cursor");
            String payload = tokenParts[0];
            if (!MessageDigest.isEqual(sign(payload).getBytes(StandardCharsets.UTF_8), decodePart(tokenParts[1]).getBytes(StandardCharsets.UTF_8))) {
                throw new IllegalArgumentException("invalid cursor signature");
            }
            String[] fields = payload.split("\\|", -1);
            if (fields.length != 5 || !"1".equals(fields[0])) throw new IllegalArgumentException("invalid cursor version");
            CatalogCursorSort sort = CatalogCursorSort.parse(fields[1]);
            if (sort != query.sort() || !filterHash(query).equals(fields[2])) {
                throw new IllegalArgumentException("cursor does not match the requested filters");
            }
            String anchor = decodePart(fields[3]);
            String productId = decodePart(fields[4]);
            return new CatalogCursor(sort, fields[2], sort == CatalogCursorSort.NEWEST ? Instant.parse(anchor) : null,
                    sort == CatalogCursorSort.NEWEST ? null : new BigDecimal(anchor), productId);
        } catch (IllegalArgumentException exception) {
            throw exception;
        } catch (Exception exception) {
            throw new IllegalArgumentException("invalid cursor", exception);
        }
    }

    private String filterHash(CatalogV2Query query) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(query.canonicalFilters().getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("SHA-256 is unavailable", exception);
        }
    }

    private String sign(String payload) {
        try {
            Mac mac = Mac.getInstance(HMAC);
            mac.init(new SecretKeySpec(secret, HMAC));
            return Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception exception) {
            throw new IllegalStateException("could not sign cursor", exception);
        }
    }

    private static String part(String value) { return Base64.getUrlEncoder().withoutPadding().encodeToString(value.getBytes(StandardCharsets.UTF_8)); }
    private static String decodePart(String value) { return new String(Base64.getUrlDecoder().decode(value), StandardCharsets.UTF_8); }
}
