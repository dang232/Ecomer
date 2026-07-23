# VNShop Journey — End-to-End Business Outcome Report

**Generated:** 2026-07-22T03:25:15.917Z

This report aggregates every chapter of the BA-grade persona journey. Each row is a single business outcome the platform must support; columns map to the chapter and persona that exercises it.

## Journey verdict: PASS

- **Acceptance criteria passed:** 18 / 18
- **Chapters run:** 6 of 6

## Chapter 1 — Admin onboards the marketplace — PASS

Persona: admin. Detail: [`journey/01-admin-onboards/REPORT.md`](journey/01-admin-onboards/REPORT.md).

| AC | Outcome | Status |
|---|---|---|
| AC-1.1 | Admin can review a pending seller's application and approve them | PASS |
| AC-1.2 | An approved seller appears in the public sellers list within 30 s | PASS |
| AC-1.3 | Admin can publish a fixed-discount coupon that is immediately redeemable at checkout | PASS |

## Chapter 2 — Buyer discovers and orders — PASS

Persona: buyer. Detail: [`journey/02-buyer-orders/REPORT.md`](journey/02-buyer-orders/REPORT.md).

| AC | Outcome | Status |
|---|---|---|
| AC-2.1 | A new visitor can register and start shopping in a single browser session | PASS |
| AC-2.2 | A coupon applied at checkout reduces the order total by exactly the published discount | PASS |
| AC-2.3 | A placed COD order is visible in the buyer's order history within 30 s | PASS |
| AC-2.4 | A product the buyer can browse via /products is also discoverable via /search within 30 s — proves the kafka product-event → search-index projection is live | PASS |

## Chapter 3 — Seller fulfills the order — PASS

Persona: seller. Detail: [`journey/03-seller-fulfills/REPORT.md`](journey/03-seller-fulfills/REPORT.md).

| AC | Outcome | Status |
|---|---|---|
| AC-3.1 | A seller sees the buyer's new order in their pending queue within 30 s | PASS |
| AC-3.2 | A seller can accept and ship the order with a tracking number | PASS |

## Chapter 4 — Buyer reviews the ordered product — PASS

Persona: buyer. Detail: [`journey/04-buyer-reviews/REPORT.md`](journey/04-buyer-reviews/REPORT.md).

| AC | Outcome | Status |
|---|---|---|
| AC-4.1 | Buyer who placed the order can return to their /orders history and see it | PASS |
| AC-4.2 | Buyer can submit a 5-star written review on the ordered product | PASS |
| AC-4.3 | Buyer sees review publication status; approved reviews are public and pending reviews show moderation | PASS |

## Chapter 5 — Seller cashes out — PASS

Persona: seller. Detail: [`journey/05-seller-cashes-out/REPORT.md`](journey/05-seller-cashes-out/REPORT.md).

| AC | Outcome | Status |
|---|---|---|
| AC-5.1 | Seller with positive wallet balance can submit a payout request | PASS |
| AC-5.2 | Submitted payout immediately appears in admin's pending payout queue | PASS |

## Chapter 6 — Admin closes the loop — PASS

Persona: admin. Detail: [`journey/06-admin-closes-loop/REPORT.md`](journey/06-admin-closes-loop/REPORT.md).

| AC | Outcome | Status |
|---|---|---|
| AC-6.1 | Admin's payout queue surfaces the seller's pending payout with the right amount | PASS |
| AC-6.2 | Admin can mark the payout complete and the payout leaves the pending queue | PASS |
| AC-6.3 | Seller's wallet pendingBalance drops by exactly the payout amount once the projection settles | PASS |
| AC-6.4 | Completed-payout audit trail surfaces who completed the payout and when, on the Completed tab and the BE /completed endpoint | PASS |

