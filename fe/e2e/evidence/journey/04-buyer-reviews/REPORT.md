# Chapter 4 — Buyer reviews the ordered product

**Persona:** buyer
**Verdict:** PASS
**Generated:** 2026-07-22T03:29:27.107Z

## Business outcomes verified

| AC | Outcome | Status |
|---|---|---|
| AC-4.1 | Buyer who placed the order can return to their /orders history and see it | PASS |
| AC-4.2 | Buyer can submit a 5-star written review on the ordered product | PASS |
| AC-4.3 | Buyer sees review publication status; approved reviews are public and pending reviews show moderation | PASS |

## Stakeholder summary

All 3 acceptance criteria verified for the buyer flow. No business-rule regressions detected this run.

## Steps (engineer view)

### 01. AC-4.1 — Predecessor chapters left the buyer + product + order in state.json — PASS

![Predecessor chapters left the buyer + product + order in state.json](screenshots/01-ac-4-1-predecessor-chapters-left-the-buyer-product-order-in-.png)

### 02. AC-4.1 — Buyer logs back in and reaches /orders showing chapter 2's order — PASS

![Buyer logs back in and reaches /orders showing chapter 2's order](screenshots/02-ac-4-1-buyer-logs-back-in-and-reaches-orders-showing-chapter.png)

### 03. AC-4.2 — Buyer opens the product detail page for the ordered product — PASS

![Buyer opens the product detail page for the ordered product](screenshots/03-ac-4-2-buyer-opens-the-product-detail-page-for-the-ordered-p.png)

### 04. AC-4.2 — Buyer fills the review form and submits — success toast confirms — PASS

![Buyer fills the review form and submits — success toast confirms](screenshots/04-ac-4-2-buyer-fills-the-review-form-and-submits-success-toast.png)

### 05. AC-4.3 — Buyer sees review publication status; approved reviews are public and pending reviews show moderation — PASS

![Buyer sees review publication status; approved reviews are public and pending reviews show moderation](screenshots/05-ac-4-3-buyer-sees-review-publication-status-approved-reviews.png)

### 06. AC-4.3 — Buyer logs out — chapter 4 leaves no new state for downstream chapters — PASS

![Buyer logs out — chapter 4 leaves no new state for downstream chapters](screenshots/06-ac-4-3-buyer-logs-out-chapter-4-leaves-no-new-state-for-down.png)

## Artifacts

- `trace.zip` — open with `npx playwright show-trace trace.zip`
- `video.webm` — full session recording (gitignored)
- `screenshots/` — one `NN-slug.png` per step, regenerated each run
