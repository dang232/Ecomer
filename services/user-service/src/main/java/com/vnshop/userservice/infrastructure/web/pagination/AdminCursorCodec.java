package com.vnshop.userservice.infrastructure.web.pagination;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Objects;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

public final class AdminCursorCodec {
    private static final String ALGORITHM = "HmacSHA256";
    private static final int VERSION = 1;
    private static final int MAX_TOKEN_LENGTH = 4096;
    private final byte[] secret;
    private final Duration ttl;
    private final Clock clock;
    private final ObjectMapper mapper = new ObjectMapper();
    public AdminCursorCodec(String secret, Duration ttl, Clock clock) {
        if (secret == null || secret.isBlank()) throw new IllegalArgumentException("cursor secret is required");
        if (ttl == null || ttl.isNegative() || ttl.isZero()) throw new IllegalArgumentException("cursor ttl must be positive");
        this.secret = secret.getBytes(StandardCharsets.UTF_8); this.ttl = ttl; this.clock = Objects.requireNonNull(clock, "clock is required");
    }
    public String encode(Cursor cursor) {
        Objects.requireNonNull(cursor, "cursor is required"); ObjectNode n = mapper.createObjectNode();
        n.put("v", VERSION); n.put("resource", required(cursor.resource(), "resource")); n.put("filterHash", required(cursor.filterHash(), "filterHash")); n.put("sort", required(cursor.sort(), "sort")); n.put("sortKey", required(cursor.sortKey(), "sortKey")); n.put("uniqueId", required(cursor.uniqueId(), "uniqueId"));
        if (cursor.asOf() != null) n.put("asOf", cursor.asOf().toString()); n.put("expiresAt", clock.instant().plus(ttl).toString()); return sign(n.toString());
    }
    public Cursor decode(String token, String resource, String filterHash, String sort) {
        try {
            if (token == null || token.isBlank() || token.length() > MAX_TOKEN_LENGTH) throw reject(RejectionReason.MALFORMED);
            String[] parts = token.split("\\.", -1); if (parts.length != 2 || parts[0].isBlank() || parts[1].isBlank()) throw reject(RejectionReason.MALFORMED);
            byte[] payload = decode(parts[0]); if (!MessageDigest.isEqual(hmac(payload), decode(parts[1]))) throw reject(RejectionReason.TAMPERED);
            JsonNode n = mapper.readTree(payload); if (!n.isObject()) throw reject(RejectionReason.MALFORMED); if (!n.has("v") || n.path("v").asInt(-1) != VERSION) throw reject(RejectionReason.UNSUPPORTED_VERSION);
            String r = text(n, "resource"), f = text(n, "filterHash"), s = text(n, "sort"), k = text(n, "sortKey"), id = text(n, "uniqueId"); Instant exp = Instant.parse(text(n, "expiresAt")); Instant as = n.has("asOf") ? Instant.parse(text(n, "asOf")) : null;
            if (!clock.instant().isBefore(exp)) throw reject(RejectionReason.EXPIRED); if (!Objects.equals(resource, r)) throw reject(RejectionReason.RESOURCE_MISMATCH); if (!Objects.equals(filterHash, f)) throw reject(RejectionReason.FILTER_MISMATCH); if (!Objects.equals(sort, s)) throw reject(RejectionReason.SORT_MISMATCH);
            return new Cursor(r, f, s, k, id, as, exp);
        } catch (InvalidCursorException e) { throw e; } catch (Exception e) { throw reject(RejectionReason.MALFORMED); }
    }

    String tokenForTesting(String json) {
        return sign(json);
    }
    private String sign(String json) { byte[] p = json.getBytes(StandardCharsets.UTF_8); return Base64.getUrlEncoder().withoutPadding().encodeToString(p) + "." + Base64.getUrlEncoder().withoutPadding().encodeToString(hmac(p)); }
    private byte[] hmac(byte[] p) { try { Mac m = Mac.getInstance(ALGORITHM); m.init(new SecretKeySpec(secret, ALGORITHM)); return m.doFinal(p); } catch (Exception e) { throw new IllegalStateException("could not sign cursor", e); } }
    private static byte[] decode(String v) { return Base64.getUrlDecoder().decode(v); }
    private static String required(String v, String f) { if (v == null || v.isBlank()) throw new IllegalArgumentException(f + " is required"); return v; }
    private static String text(JsonNode n, String f) { JsonNode v = n.get(f); if (v == null || !v.isTextual() || v.asText().isBlank()) throw reject(RejectionReason.MISSING_FIELD); return v.asText(); }
    private static InvalidCursorException reject(RejectionReason r) { return new InvalidCursorException(r); }
    public record Cursor(String resource, String filterHash, String sort, String sortKey, String uniqueId, Instant asOf, Instant expiresAt) { public Cursor withExpiresAt(Instant v) { return new Cursor(resource, filterHash, sort, sortKey, uniqueId, asOf, v); } }
    public enum RejectionReason { MALFORMED, TAMPERED, EXPIRED, RESOURCE_MISMATCH, FILTER_MISMATCH, SORT_MISMATCH, MISSING_FIELD, UNSUPPORTED_VERSION }
    public static final class InvalidCursorException extends IllegalArgumentException { private final RejectionReason reason; public InvalidCursorException(RejectionReason r) { super(r.name().toLowerCase()); reason = r; } public RejectionReason reason() { return reason; } }
}
