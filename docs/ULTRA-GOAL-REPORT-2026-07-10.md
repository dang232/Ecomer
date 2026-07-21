# VNShop Ultra-Goal Report
## From Audit → Implementation Roadmap

**Date:** July 10, 2026
**Source:** `COMPREHENSIVE-AUDIT-2026-07-10.md` v2.1
**Verification:** Live codebase grep + file read + web source-of-truth
**Author:** Claude Code (Anthropic)

---

## Executive Summary

The audit reveals **88/120 features implemented (~73%)**. Of the "missing" items, **3 were false negatives** (variants, guest cart, returns — all backend-implemented). The real gaps are:

| Category | Gap Type | Count | Top Priority |
|----------|----------|-------|-------------|
| **Frontend UI** | Backend done, no UI | 4 | Variant selector, Guest cart banner, Return request form |
| **Payment Production** | Stubs only | 4 | VietQR, MoMo, Stripe, PayPal |
| **Shipping Production** | Stubs only | 3 | GHTK, GHN, Real-time tracking |
| **Compliance** | Partial or unverified | 2 | GDT e-invoice submission, GDPR deletion |
| **Infrastructure** | Missing | 5 | CDN, Secrets vault, Image optimization |

---

## What NOT to Build (Already Implemented)

These were flagged as "Critical Missing" in earlier audits — confirmed done by live code:

| Feature | Audit Said | Reality | Evidence |
|---------|-----------|---------|----------|
| Product Variants backend | ❌ Missing | ✅ Done | `ProductVariant.java` — 44-line record |
| Guest Cart backend | ❌ Missing | ✅ Done | `MergeCartUseCase.ts` |
| Return/Refund backend | ❌ Missing | ✅ Done | `Return.java` + 4 use cases + 4 tests |
| Dark Mode UI | ❌ Not started | ✅ Done | e2e test + 47-file codemod |
| Real-time notifications | ⚠️ Polling | ✅ Done | Socket.IO (not polling) |
| Admin Dashboard MVP | ❌ Needs full build | ⚠️ MVP done | `AdminDashboard.tsx` — 231 lines |
| Order sync (not async) | "202 async" | ⚠️ Sync, 201 | `CreateOrderUseCase.java` synchronous |

---

## Critical Path (Do in Week 0)

### 🔴 T0.1 — GDT E-Invoice: Upgrade Sandbox → Production [CRITICAL]
**Status:** ✅ SUBSTANTIALLY MORE BUILT THAN ASSUMED — full submission pipeline is wired
**Effort:** 1–2 days (config change, not implementation)
**Risk if skipped:** CRITICAL — Decree 123/2020 compliance
**What exists:** XML generation (304 lines, XSD-validated) + `GdtApiClient.submitInvoice()` (RestTemplate POST, circuit breaker, bearer token) + `InvoiceSubmissionService` orchestrator (SUBMITTED → ACCEPTED/REJECTED state machine, resubmit logic, 10-year XML retention)
**What remains:**
1. Swap sandbox URL → production GDT endpoint: `@Value("${gdt.api.url:...sandbox.gdt.gov.vn}")` in `GdtApiClient.java:39`
2. Wire HSM-backed digital certificate (placeholder at line 62: "production must attach a digital certificate signature here")
3. Configure `GDT_API_TOKEN` in secrets vault
**Evidence:** `GdtApiClient.java:67` — `restTemplate.postForEntity(baseUrl + SUBMIT_PATH, ...)`, `RestTemplateConfig.java` — 5s connect/10s read timeouts

### 🟡 T0.3 — Vite 6.3.5: ✅ Real Installation [LOW]
**Status:** `npm ls vite` confirmed — 6.3.5 IS installed (real npm package, not git tag)
**Effort:** None
**Action:** No action needed. Vite 6.x exists on npm registry (6.0.0–6.3.x) — just no corresponding git tag. Deduped across `@tailwindcss/vite` and `@vitejs/plugin-react`. Vitest has its own vite@5.4.21. No ghost dependency.
**Evidence:** `npm ls vite` output: `vite@6.3.5` direct + deduped in two plugins.

### 🟡 T0.4 — React Upgrade to 19.x [MEDIUM]
**Status:** React 18.3.1 installed. React 19.2.7 is latest.
**Effort:** 3–5 days (upgrade + test)
**Action:** Branch and upgrade to React 19.2.7. Run e2e tests. Fix breaking changes (hydration strictness, new actions API).
**Evidence:** React 19.2.7 confirmed on `github.com/facebook/react/tags` page 1.

### 🟢 T0.5 — Remove seller-finance-service [LOW]
**Status:** DEPRECATED.md exists (2026-05-12) but service still in docker-compose.yml
**Effort:** 2 days
**Action:** Verify migration to order-service complete, remove from compose, remove from api-gateway routes, delete directory.

---

## Epic 1: Frontend Completeness (Weeks 1–3)

> The core insight: backend for variants, guest cart, and returns **already exists**. The work is entirely frontend.

| Task | Backend | Effort | Risk | What to Build |
|------|---------|--------|------|--------------|
| **T1.1** Product Variant Selector | ✅ | 3 days | HIGH | Swatch/dropdown UI, price update on selection, variant image swap, admin matrix editor |
| **T1.2** Guest Cart Banner + Merge UI | ✅ | 2 days | MEDIUM | Session persistence, guest cart banner, merge prompt on login, merge feedback |
| **T1.3** Return Request UI + Tracking | ✅ | 3 days | MEDIUM | Return form (reason, photos, pickup), status tracking, dispute UI, seller approve/reject |
| **T1.4** Related Products in Frontend | ✅ | 1 day | LOW | "Frequently Bought Together" component connecting to recommendations service |
| **T1.5** Cart Real-Time Stock Check | ⚠️ Partial | 2 days | HIGH | Pre-checkout stock validation call, out-of-stock feedback, flash sale reservation on add-to-cart |

---

## Epic 2: Admin & Operations (Weeks 3–5)

| Task | Current State | Effort | Risk | What to Build |
|------|-------------|--------|------|--------------|
| **T2.1** Geography Heat Map | MVP done | 2 days | MEDIUM | Leaflet/Mapbox choropleth, orders by province |
| **T2.2** Conversion Funnel | ❌ | 1 day | MEDIUM | Visit → Cart → Checkout → Purchase funnel viz |
| **T2.3** Export CSV/PNG | ❌ | 2 days | MEDIUM | Export order/revenue data, chart screenshots |
| **T2.4** System Health Dashboard | ❌ | 2 days | MEDIUM | Service status panel, Kafka lag, DB pool, error rates |
| **T2.5** Sales Reports | ❌ | 3 days | MEDIUM | Daily/weekly/monthly GMV, AOV, top categories, seller rankings |

---

## Epic 3: Payment & Shipping Production (Weeks 5–8)

> These are the **actual business blockers**. Nothing ships to production without these.

| Task | Current | Effort | Risk | What to Build |
|------|---------|--------|------|--------------|
| **T3.1** VietQR Production | ⚠️ Stub | 3 days | **CRITICAL** | Production API keys, webhook, QR generation with merchant info |
| **T3.2** MoMo Production | ⚠️ Stub | 3 days | **CRITICAL** | Production keys, webhook, refund flow |
| **T3.3** GHTK + GHN | ⚠️ Stub | 8 days | HIGH | Production tokens, pickup scheduling, label printing, tracking webhooks, COD reconciliation |
| **T3.4** Real-Time Tracking | ⚠️ Stub | 3 days | MEDIUM | Webhook/polling tracking, status timeline UI, SMS notifications |
| **T3.5** Delivery Proof | ❌ | 2 days | MEDIUM | Photo capture, digital signature, S3/MinIO upload |
| **T3.6** Stripe + PayPal | ⚠️ Stub | 3 days | MEDIUM | Production keys, webhooks, refunds, currency conversion |

---

## Epic 4: Compliance & Infrastructure (Weeks 8–10)

| Task | Current | Effort | Risk | What to Build |
|------|---------|--------|------|--------------|
| **T4.1** GDT Production | ✅ Sandbox wired | 1–2 days | **CRITICAL** | Swap sandbox URL → production endpoint, wire HSM cert, configure GDT_API_TOKEN |
| **T4.2** GDPR Account Deletion | ❌ | 3 days | MEDIUM | Full data purge across services, cascade deletes, anonymization logs |
| **T4.3** CDN for Static Assets | ❌ | 2 days | MEDIUM | CloudFlare/R2, cache product images, static JS/CSS |
| **T4.4** HashiCorp Vault | ⚠️ Partial | 5 days | HIGH | Dynamic DB credentials, secret rotation, env var replacement |

---

## Epic 5: Growth (Week 10+)

| Task | Effort | Risk |
|------|--------|------|
| Flash Sale Countdown UI | 2 days | MEDIUM |
| Multi-Language (i18n) | 5 days | MEDIUM |
| Coin/Cashback System | 5 days | LOW |
| Recently Viewed Products | 2 days | LOW |
| Coupon Stacking | 2 days | LOW |
| Auto-Apply Best Coupon | 2 days | LOW |
| ZaloPay Integration | 5 days | MEDIUM |
| Cart Abandonment Recovery | 3 days | LOW |

---

## Recommended Sprint Sequence

```
WEEK 0          WEEK 1-2          WEEK 3-4          WEEK 5-8
────────        ────────          ────────          ────────
T0.1 (GDT)  →  T1.1 (Variant) →  T2.1-5 (Admin) →  T3.1 (VietQR)
T0.3 (Vite)     T1.2 (Guest) →  T0.4 (React)   →  T3.2 (MoMo)
T0.5 (Deprec)   T1.3 (Return)                     T3.3 (GHTK+GHN)
                 T1.4 (Related)                    T3.6 (Stripe+PP)

WEEK 8-10           WEEK 10+
──────────           ─────────
T4.1 (GDT)      →   Epic 5 Growth
T4.4 (Vault)
T4.2 (GDPR)
```

---

## Immediate Action Items (This Week)

1. **T0.1 GDT → Production:** Swap sandbox URL to real GDT endpoint in `GdtApiClient.java:39`; wire HSM cert (placeholder line 62); configure `GDT_API_TOKEN` in vault.
2. **T0.4 React 19:** Branch + upgrade to 19.2.7. Run e2e tests. Fix hydration/hooks breaking changes.
3. **T1.1 Variant selector scope:** Survey product types — which categories need size/color variants vs simple products?
4. **T3.x Payment credentials:** Get VietQR + MoMo production API keys — business team action, not dev.
5. ~~T0.3 Vite~~ ✅ **RESOLVED** — 6.3.5 is a real npm package, not a ghost dep.

---

**Document Version:** 1.0
**Cross-Reference:** `docs/COMPREHENSIVE-AUDIT-2026-07-10.md` v2.1
**Wiki:** `.omc/wiki/vnshop-ultra-goal-implementation-roadmap-2026-07.md`
**Next Review:** July 17, 2026
