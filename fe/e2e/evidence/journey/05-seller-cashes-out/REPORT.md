# Chapter 5 — Seller cashes out

**Persona:** seller
**Verdict:** PASS
**Generated:** 2026-07-22T03:29:32.729Z

## Business outcomes verified

| AC | Outcome | Status |
|---|---|---|
| AC-5.1 | Seller with positive wallet balance can submit a payout request | PASS |
| AC-5.2 | Submitted payout immediately appears in admin's pending payout queue | PASS |

## Stakeholder summary

All 2 acceptance criteria verified for the seller flow. No business-rule regressions detected this run.

## Steps (engineer view)

### 01. AC-5.1 — Predecessor chapters left a fulfilled order in state.json — PASS

![Predecessor chapters left a fulfilled order in state.json](screenshots/01-ac-5-1-predecessor-chapters-left-a-fulfilled-order-in-state-.png)

### 02. AC-5.1 — Seller's wallet shows positive available balance from chapter 3's fulfillment — PASS

![Seller's wallet shows positive available balance from chapter 3's fulfillment](screenshots/02-ac-5-1-seller-s-wallet-shows-positive-available-balance-from.png)

### 03. AC-5.1 — Seller logs into the SPA and the Wallet tab shows the same balance — PASS

![Seller logs into the SPA and the Wallet tab shows the same balance](screenshots/03-ac-5-1-seller-logs-into-the-spa-and-the-wallet-tab-shows-the.png)

### 04. AC-5.1 — Seller submits a payout request for the full balance (97271100 ₫) — PASS

![Seller submits a payout request for the full balance (97271100 ₫)](screenshots/04-ac-5-1-seller-submits-a-payout-request-for-the-full-balance-.png)

### 05. AC-5.2 — Submitted payout appears in admin's pending payout queue — PASS

![Submitted payout appears in admin's pending payout queue](screenshots/05-ac-5-2-submitted-payout-appears-in-admin-s-pending-payout-qu.png)

### 06. AC-5.2 — Seller logs out — chapter state persists payoutId for chapter 6 — PASS

![Seller logs out — chapter state persists payoutId for chapter 6](screenshots/06-ac-5-2-seller-logs-out-chapter-state-persists-payoutid-for-c.png)

## Artifacts

- `trace.zip` — open with `npx playwright show-trace trace.zip`
- `video.webm` — full session recording (gitignored)
- `screenshots/` — one `NN-slug.png` per step, regenerated each run
