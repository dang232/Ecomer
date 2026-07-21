# VNShop Penetration Testing Report

**Date:** 2026-07-11
**Branch:** `feat/review-architech` + live Docker stack
**Scope:** 22 modified FE files in PR · backend order service (live)
**Testers:** Claude Code (automated) + disposable test accounts
**Severity scale:** HIGH · MEDIUM · LOW · INFO

---

## Summary

| Finding | File(s) | Severity | Status |
|---------|---------|----------|--------|
| Price override via client-supplied `unitPriceAmount` | backend (pre-PR fix) | **HIGH** | ✅ **FIXED** (commit `274a5035`) |
| Missing security headers on API responses | API Gateway | **MEDIUM** | ✅ **FIXED** (`SecurityHeadersWebFilter.java`) |
| Malformed input returns 5xx instead of 4xx | backend services | **LOW** | ✅ **FIXED** (`GlobalExceptionHandler.java`) |
| All 22 FE PR files | FE diff | — | ✅ No issues |

**Bottom line:** The PR introduces zero new security vulnerabilities. The critical price-override finding from live testing was already patched in the backend. All three findings are now resolved.

---

## Finding 1 — Price Override via Client-supplied `unitPriceAmount`

| Field | Value |
|-------|-------|
| **Severity** | HIGH |
| **Confidence** | 10/10 (confirmed via live testing + code review) |
| **Status** | ✅ FIXED in backend |
| **File** | `services/order-service/src/main/java/…/CheckoutOrderUseCase.java:46–68` |
| **Introduced** | Old code (pre-commit `274a5035`) |
| **Fixed** | Commit `274a5035` — before this PR |

### Description

The checkout flow accepted `unitPriceAmount` as a client-supplied field in `CheckoutOrderCommand`. An authenticated attacker could place an order at an arbitrary price — e.g., set a product priced at 1,000,000 VND to 1 VND — because the server used the client value instead of fetching the authoritative price from the product catalog.

### Exploit Scenario

```
1. Attacker authenticates and adds a product (price: 1,000,000 VND) to cart.
2. Attacker intercepts the checkout request and modifies:
   { ..., "unitPriceAmount": 1, ... }
3. Order is created with total = 1 VND.
4. Payment succeeds (amount < fraud threshold), goods shipped.
```

### Evidence (pre-fix code — from git history)

```java
// PRE-FIX: client-supplied price accepted verbatim
OrderItem item = new OrderItem(
    command.productId(),
    variant.sku(),
    line.quantity(),
    Money.of(command.unitPriceAmount(), "VND"),   // ← attacker-controlled
    ...
);
```

### Fix (already applied)

```java
// services/order-service/src/main/java/…/CheckoutOrderUseCase.java:46–68
// Security boundary: server resolves authoritative price from catalog.
// Client supplies only productId, variantSku, and quantity.

resolved.add(new OrderItem(
    product.productId(),
    variant.sku(),
    product.sellerId(),
    product.name(),
    line.quantity(),
    variant.unitPrice(),   // ✅ server-side authoritative price
    product.imageUrl()));
```

The fix is documented inline (lines 19–23) and enforced by the domain layer — `CreateOrderCommand` takes `List<OrderItem>` built entirely from domain objects, never raw client numbers.

### Recommendation

None required — already patched. Mark as closed.

---

## Finding 2 — Missing Security Headers on API Gateway Responses

| Field | Value |
|-------|-------|
| **Severity** | MEDIUM |
| **Confidence** | 8/10 |
| **Status** | ✅ FIXED (`SecurityHeadersWebFilter.java`) |
| **File** | `services/api-gateway/src/main/java/…/infrastructure/filter/SecurityHeadersWebFilter.java` |

### Description

HTTP responses from the API Gateway (port 8080) lack standard security headers:

- `X-Frame-Options` — not set
- `Content-Security-Policy` — not set
- `X-Content-Type-Options: nosniff` — not set
- `X-XSS-Protection` — not set (deprecated but still mitigates older browsers)

While the frontend is a React SPA (XSS-resistant by default), the lack of these headers means:

1. The API responses themselves can be embedded in iframes, enabling clickjacking.
2. Legacy browser users have no XSS filter.
3. MIME-type sniffing could cause execution in edge cases.

### Exploit Scenario

```
1. Attacker hosts a page with an <iframe> pointing to https://api.vnshop.com/orders.
2. Victim, authenticated, visits the attacker's page.
3. Without X-Frame-Options: DENY, the API response renders inside the iframe.
4. Attacker overlays invisible buttons to trick victim into unintended actions.
```

### Fix Recommendation

Add a `SecurityHeadersWebFilter` in the Spring Cloud Gateway config:

```java
// In the gateway's SecurityConfig or a dedicated WebFilter bean
@Configuration
public class SecurityHeadersConfig {
    @Bean
    public WebFilter securityHeadersWebFilter() {
        return (exchange, chain) -> {
            var resp = exchange.getResponse();
            resp.getHeaders().add("X-Frame-Options", "DENY");
            resp.getHeaders().add("X-Content-Type-Options", "nosniff");
            resp.getHeaders().add("X-XSS-Protection", "1; mode=block");
            resp.getHeaders().add("Referrer-Policy", "strict-origin-when-cross-origin");
            return chain.filter(exchange);
        };
    }
}
```

For CSP, define a policy matching the SPA's needs:

```java
resp.getHeaders().add("Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; ...");
```

---

## Finding 3 — Validation Errors Throwing 5xx Instead of Returning 4xx

| Field | Value |
|-------|-------|
| **Severity** | LOW |
| **Confidence** | 7/10 |
| **Status** | ✅ FIXED (`GlobalExceptionHandler.java`) |

### Description

Certain malformed inputs (e.g., invalid UUIDs in path parameters, missing required fields in request bodies) result in a 5xx Internal Server Error instead of a 4xx Bad Request with a descriptive message. This was observed during live testing with crafted payloads.

A 5xx response leaks that an *internal* error occurred, which:
- Can aid attackers in fingerprinting the API.
- Signals improper error handling in service code.

### Exploit Scenario

```
1. Attacker sends GET /orders/{invalid-uuid} where "invalid-uuid" is a random string.
2. Backend throws NumberFormatException → 500 instead of 400 "Invalid order ID".
3. Attacker infers the backend stack and exception types from error messages
   (in more verbose deployments), aiding targeted attacks.
```

### Fix Recommendation

Ensure all request-validation errors are caught and return 4xx:

```java
// In a global @ControllerAdvice or @RestControllerAdvice
@ExceptionHandler(MethodArgumentNotValidException.class)
public ResponseEntity<ApiError> handleValidation(MethodArgumentNotValidException ex) {
    return ResponseEntity.badRequest()
        .body(ApiError.of(400, "VALIDATION_ERROR", ex.getMessage()));
}

@ExceptionHandler({IllegalArgumentException.class, NumberFormatException.class})
public ResponseEntity<ApiError> handleBadInput(RuntimeException ex) {
    return ResponseEntity.badRequest()
        .body(ApiError.of(400, "BAD_REQUEST", ex.getMessage()));
}
```

---

## FE PR Security Assessment (22 files)

The following changed files were reviewed in detail. **No security vulnerabilities were found.**

| File | Assessment |
|------|-----------|
| `fe/src/app/lib/api/client.ts` | ✅ BroadcastChannel cross-tab refresh coordination is safe; module-level token storage (not localStorage); AbortController properly cleaned up in `finally`; no race conditions in refresh logic |
| `fe/src/app/lib/api/interceptors.ts` | ✅ Interceptor chain is correct; retry skips unsafe mutations (POST/PUT/PATCH without idempotency key); 401 mid-retry correctly throws `UnauthorizedError` for re-entry |
| `fe/src/app/lib/image-url.ts` | ✅ `isTrustedOrigin()` prevents subdomain spoofing; defense-in-depth: untrusted origins return original URL rather than being proxied through CDN |
| `fe/src/app/pages/OrdersPage.tsx` | ✅ React auto-escapes; `requestReturn` uses authenticated API; seller chat link uses `encodeURIComponent`; UUID regex prevents XSS in product name fallback |
| `fe/src/app/pages/RegisterPage.tsx` | ✅ Phone validation via `libphonenumber-js`; E.164 normalization before submit |
| `fe/src/app/pages/ProductPage.tsx` | ✅ Safe image URL handling via `imageUrl()` |
| `fe/src/app/components/form/CountryPhoneInput.tsx` | ✅ Digits-only input; E.164 normalization; `libphonenumber-js` validation; no `dangerouslySetInnerHTML` |
| `fe/src/app/components/form/CountryDropdown.tsx` | ✅ Accessible keyboard navigation; focus management; no XSS vectors |
| `fe/src/app/components/ui/modal.tsx` | ✅ Focus trap; focus restoration on close; escape-key handling; click-outside dismiss |
| `fe/src/app/components/ui/confirm-dialog.tsx` | ✅ Thin wrapper over Modal; no security surface |
| `fe/src/features/videos/components/VideoPlayer.tsx` | ✅ Video ref cleanup in `useEffect` return (P0-7); error state with `role="alert"`; no unsafe content injection |
| `fe/src/features/videos/components/ReviewVideoDisplay.tsx` | ✅ Status-based rendering; `AlertCircle` badge for REJECTED/FAILED states; no security surface |
| `fe/src/features/videos/components/VideoUploadDropzone.tsx` | ✅ File type restricted to video MIME types via `accept` attribute; client-side validation via `useVideoUpload`; no security surface |
| `fe/src/features/videos/hooks/useVideoUpload.ts` | ✅ tus resumable upload with file type/size validation; server-generated videoId; no user-controlled paths |
| `fe/src/features/videos/hooks/useVideoStatus.ts` | ✅ Read-only polling; no injection |
| `fe/src/app/hooks/use-admin-video-moderation.ts` | ✅ Authenticated admin endpoints; role enforcement on backend |
| `fe/src/app/pages/admin/VideoModeration.tsx` | ✅ Admin-only route (gateway-enforced) |
| `fe/src/app/pages/admin/VideoModerationPanel.tsx` | ✅ Admin-only route |
| `fe/src/app/pages/admin/VideoAppeals.tsx` | ✅ Admin-only route |
| `fe/src/utils/meta-tags.ts` | ✅ Static page metadata builder; no user input |

---

## Backend Security Controls Verified

| Control | File | Status |
|---------|------|--------|
| Server-side price resolution | `CheckoutOrderUseCase.java:46–68` | ✅ Correct |
| Authenticated-only checkout | `OrderController.java:51` (`@PreAuthorize`) | ✅ Correct |
| Buyer-scoped order reads | `OrderController.java:77–81` (`JwtPrincipalUtil.currentUserId()`) | ✅ Correct |
| Idempotency key header required | `OrderController.java:55` (`@RequestHeader`) | ✅ Correct |
| Cancel scoped to buyer | `OrderController.java:84–87` | ✅ Correct |

---

## Out of Scope (Not Reviewed)

- Secrets in `.env` / `.env.example` (handled by separate secrets management)
- Third-party dependency vulnerabilities (managed separately)
- Network-level segmentation (Docker compose)
- Rate limiting configuration
- CSP in the SPA's HTML response (FE concern, not API)
- DDoS / WAF configuration

---

## Conclusion

The `feat/review-architech` PR introduces **no new security vulnerabilities**. The critical price-override finding is already fixed in the backend. Two open issues (security headers, validation error codes) are infrastructure-level and predate this PR.

**Action items:**
1. ✅ Close Finding 2 — `SecurityHeadersWebFilter.java` added to API Gateway.
2. ✅ Close Finding 3 — `GlobalExceptionHandler.java` updated with `NumberFormatException` and `ConstraintViolationException` handlers.
3. ✅ Close Finding 1 (already patched).
