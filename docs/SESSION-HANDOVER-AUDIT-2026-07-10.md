# Session Handover — Audit Update + Ultra-Goal

**Date:** July 10, 2026
**Session ID:** 42512644-d7a3-4cd2-b248-eaf7a82d91ab

---

## What Was Done

### 1. Updated `COMPREHENSIVE-AUDIT-2026-07-10.md` (v2.1)

Six targeted edits made, all backed by evidence:

| # | What changed | Evidence source |
|---|-------------|----------------|
| Tech stack table | React 18.3.1 → ⚠️ outdated; Vite 6.3.5 → ❌ unverifiable | `github.com/facebook/react/tags` (React 19.2.7 confirmed); GitHub tags pages 1-4 (no v6.x Vite found) |
| §11.4 V4, V5 | Version corrections expanded with web evidence | Same web sources |
| §11.5 U2 | **RESOLVED** — OrderController returns 201 CREATED, not 202 | `OrderController.java:53` `@ResponseStatus(HttpStatus.CREATED)` |
| §11.2 C6 | **CORRECTION** — seller-finance-service IS deprecated (audit was correct) | `seller-finance-service/DEPRECATED.md` dated 2026-05-12 |
| §3.1 note | Updated to reflect 201 not 202 | Same controller evidence |
| Footer | Version 2.1, new corrections V8-V12 (Java 25 confirmed, Vite 8.1.4 latest, Spring Boot 4.1.0 newer) | `adoptium/temurin25-binaries/releases`, `vitejs/vite/releases` |

### 2. Found Critical Self-Correction

The previous session's **cross-validation report was itself wrong** about seller-finance-service. I found the DEPRECATED.md file and corrected the audit back to "correct." The audit was right, the validator was wrong. Trusted code over the validator's conclusion.

### 3. Created Ultra-Goal Report

**Two deliverables created:**
- `docs/ULTRA-GOAL-REPORT-2026-07-10.md` — executive summary + sprint sequence
- `.omc/wiki/vnshop-ultra-goal-implementation-roadmap-2026-07.md` — detailed wiki page with all tasks

---

## Key Findings

### Version Corrections (web-verified)
- **React 18.3.1** → outdated (React 19.2.7 is latest, June 2026)
- **Vite 6.3.5** → unverifiable (no v6.x tags on GitHub, latest is 8.1.4)
- **Java 25** → ✅ confirmed (jdk-25.0.3+9, April 22, 2026)
- **Vite latest** → v8.1.4 (July 9, 2026)
- **Spring Boot 4.0.6** → correct but 4.1.0 is newer

### Code-Verified Corrections
- **OrderController** returns **201 CREATED**, not 202 (OrderController.java:53)
- **seller-finance-service** IS deprecated (DEPRECATED.md, 2026-05-12)
- **seller-finance** (NestJS, port 8090) is separate active service

### What Already Exists (False Negatives Fixed)
- ProductVariant.java — 44-line record with full validation
- MergeCartUseCase.ts — full guest-to-auth merge
- Return.java — state machine + 4 use cases + 4 tests
- AdminDashboard.tsx — 231-line MVP with KPI, charts, React Query
- Socket.IO notifications — not polling
- Dark mode — e2e tested, 47-file codemod

---

## Verified Findings — Week 0 Tasks Complete

### T0.1 — GDT E-Invoice: ✅ SUBSTANTIALLY MORE BUILT THAN EXPECTED
The full submission pipeline is wired. Not a stub — real HTTP call path:

| File | What it does | Evidence |
|------|-------------|---------|
| `GdtApiClient.java` | RestTemplate POST to GDT endpoint, circuit breaker (Resilience4j), bearer token auth | Lines 54-78: `restTemplate.postForEntity(baseUrl + SUBMIT_PATH, ...)` |
| `RestTemplateConfig.java` | 5s connect, 10s read timeouts | Lines 27-30: `SimpleClientHttpRequestFactory` |
| `GdtSubmissionResult.java` | accepted/rejected record | 20-line clean record |
| `InvoiceSubmissionService.java` | Orchestrates: SUBMITTED → ACCEPTED/REJECTED, resubmit logic, 10-year XML retention | Lines 66-91: `doSubmit()` |

**⚠️ Two gaps remain (not unverified, but needs attention):**
1. **Sandbox URL by default** — `@Value("${gdt.api.url:https://hoadondientu-sandbox.gdt.gov.vn/api/v1}")` — production needs real GDT production endpoint + cert
2. **Certificate signing is placeholder** — comment at line 62: "production must attach a digital certificate signature here" — HSM-backed cert from licensed CA required
3. **`GDT_API_TOKEN` env var** — needs production token configured in secrets vault

**Action for T0.1:** Not "wire it" — it's already wired. Upgrade from sandbox to production: swap URL, configure cert, add token.

### T0.3 — Vite 6.3.5: ✅ IS Installed (real dep)
```
fe/package.json:79: "vite": "6.3.5"
npm ls vite:
  +-- vite@6.3.5 (direct dep)
  +-- @vitejs/plugin-react@4.7.0
  |   `-- vite@6.3.5 deduped
  +-- @tailwindcss/vite@4.1.12
  |   `-- vite@6.3.5 deduped
  `-- vitest@2.1.9
      `-- vite@5.4.21 (test runner)
```
This is a real installation — likely `npm install vite@6.3.5` from npm registry (not git tag). Vite 6.x exists on npm (6.0.0 through 6.3.x), just no corresponding git tag. **Not a ghost dep.**

**Action for T0.3:** ✅ No change needed. Vite 6.3.5 is valid on npm.

### Still Unverified
| Item | Priority | Action |
|------|---------|--------|
| General inventory TTL (non-flash) | MEDIUM | Search for Duration.ofDays across inventory-service |
| React 19 upgrade path | MEDIUM | Branch + upgrade + test |

---

## Files Changed
- `docs/COMPREHENSIVE-AUDIT-2026-07-10.md` — edited (v2.1)
- `docs/ULTRA-GOAL-REPORT-2026-07-10.md` — created
- `.omc/wiki/vnshop-ultra-goal-implementation-roadmap-2026-07.md` — created

## Next Session Should
1. ~~Read `InvoiceSubmissionService.java`~~ ✅ DONE — GDT submission IS wired. Remaining: swap sandbox→production URL, wire HSM cert, add GDT_API_TOKEN.
2. ~~Run `npm ls vite`~~ ✅ DONE — 6.3.5 is a real npm installation. No action needed.
3. **T0.4 React 19 upgrade** — branch + upgrade to 19.2.7 + test
4. **T1.1 Variant selector** — survey product types, build variant UI component
5. **T3.x payment credentials** — coordinate with business team for VietQR + MoMo API keys
