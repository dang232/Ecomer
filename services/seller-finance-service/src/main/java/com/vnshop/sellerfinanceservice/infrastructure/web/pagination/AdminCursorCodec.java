package com.vnshop.sellerfinanceservice.infrastructure.web.pagination;

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
    private final byte[] secret; private final Duration ttl; private final Clock clock; private final ObjectMapper mapper = new ObjectMapper();
    public AdminCursorCodec(String secret, Duration ttl, Clock clock) { if (secret == null || secret.isBlank()) throw new IllegalArgumentException("cursor secret is required"); if (ttl == null || ttl.isNegative() || ttl.isZero()) throw new IllegalArgumentException("cursor ttl must be positive"); this.secret = secret.getBytes(StandardCharsets.UTF_8); this.ttl = ttl; this.clock = Objects.requireNonNull(clock, "clock is required"); }
    public String encode(Cursor cursor) { Objects.requireNonNull(cursor, "cursor is required"); ObjectNode node = mapper.createObjectNode(); node.put("v", VERSION); node.put("resource", required(cursor.resource(), "resource")); node.put("filterHash", required(cursor.filterHash(), "filterHash")); node.put("sort", required(cursor.sort(), "sort")); node.put("sortKey", required(cursor.sortKey(), "sortKey")); node.put("uniqueId", required(cursor.uniqueId(), "uniqueId")); if (cursor.asOf() != null) node.put("asOf", cursor.asOf().toString()); node.put("expiresAt", clock.instant().plus(ttl).toString()); return sign(node.toString()); }
    public Cursor decode(String token, String resource, String filterHash, String sort) { try { if (token == null || token.isBlank() || token.length() > MAX_TOKEN_LENGTH) throw reject(RejectionReason.MALFORMED); String[] parts = token.split("\\.", -1); if (parts.length != 2 || parts[0].isBlank() || parts[1].isBlank()) throw reject(RejectionReason.MALFORMED); byte[] payload = decode(parts[0]); if (!MessageDigest.isEqual(hmac(payload), decode(parts[1]))) throw reject(RejectionReason.TAMPERED); JsonNode node = mapper.readTree(payload); if (!node.isObject()) throw reject(RejectionReason.MALFORMED); if (!node.has("v") || node.path("v").asInt(-1) != VERSION) throw reject(RejectionReason.UNSUPPORTED_VERSION); String r = text(node, "resource"), f = text(node, "filterHash"), s = text(node, "sort"), k = text(node, "sortKey"), id = text(node, "uniqueId"); Instant exp = Instant.parse(text(node, "expiresAt")); Instant as = node.has("asOf") ? Instant.parse(text(node, "asOf")) : null; if (!clock.instant().isBefore(exp)) throw reject(RejectionReason.EXPIRED); if (!Objects.equals(resource, r)) throw reject(RejectionReason.RESOURCE_MISMATCH); if (!Objects.equals(filterHash, f)) throw reject(RejectionReason.FILTER_MISMATCH); if (!Objects.equals(sort, s)) throw reject(RejectionReason.SORT_MISMATCH); return new Cursor(r, f, s, k, id, as, exp); } catch (InvalidCursorException exception) { throw exception; } catch (Exception exception) { throw reject(RejectionReason.MALFORMED); } }
    String tokenForTesting(String json) { return sign(json); }
    private String sign(String json) { byte[] payload = json.getBytes(StandardCharsets.UTF_8); return Base64.getUrlEncoder().withoutPadding().encodeToString(payload) + "." + Base64.getUrlEncoder().withoutPadding().encodeToString(hmac(payload)); }
    private byte[] hmac(byte[] payload) { try { Mac mac = Mac.getInstance(ALGORITHM); mac.init(new SecretKeySpec(secret, ALGORITHM)); return mac.doFinal(payload); } catch (Exception exception) { throw new IllegalStateException("could not sign cursor", exception); } }
    private static byte[] decode(String value) { return Base64.getUrlDecoder().decode(value); }
    private static String required(String value, String field) { if (value == null || value.isBlank()) throw new IllegalArgumentException(field + " is required"); return value; }
    private static String text(JsonNode node, String field) { JsonNode value = node.get(field); if (value == null || !value.isTextual() || value.asText().isBlank()) throw reject(RejectionReason.MISSING_FIELD); return value.asText(); }
    private static InvalidCursorException reject(RejectionReason reason) { return new InvalidCursorException(reason); }
    public record Cursor(String resource, String filterHash, String sort, String sortKey, String uniqueId, Instant asOf, Instant expiresAt) { public Cursor withExpiresAt(Instant value) { return new Cursor(resource, filterHash, sort, sortKey, uniqueId, asOf, value); } }
    public enum RejectionReason { MALFORMED, TAMPERED, EXPIRED, RESOURCE_MISMATCH, FILTER_MISMATCH, SORT_MISMATCH, MISSING_FIELD, UNSUPPORTED_VERSION }
    public static final class InvalidCursorException extends IllegalArgumentException { private final RejectionReason reason; public InvalidCursorException(RejectionReason reason) { super(reason.name().toLowerCase()); this.reason = reason; } public RejectionReason reason() { return reason; } }
}
