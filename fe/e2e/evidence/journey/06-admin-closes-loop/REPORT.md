# Chapter 6 — Admin closes the loop

**Persona:** admin
**Verdict:** PASS
**Generated:** 2026-07-22T03:29:38.564Z

## Business outcomes verified

| AC | Outcome | Status |
|---|---|---|
| AC-6.1 | Admin's payout queue surfaces the seller's pending payout with the right amount | PASS |
| AC-6.2 | Admin can mark the payout complete and the payout leaves the pending queue | PASS |
| AC-6.3 | Seller's wallet pendingBalance drops by exactly the payout amount once the projection settles | PASS |
| AC-6.4 | Completed-payout audit trail surfaces who completed the payout and when, on the Completed tab and the BE /completed endpoint | PASS |

## Stakeholder summary

All 4 acceptance criteria verified for the admin flow. No business-rule regressions detected this run.

## Steps (engineer view)

### 01. AC-6.1 — Predecessor chapter 5 left a PENDING payoutId in state.json — PASS

![Predecessor chapter 5 left a PENDING payoutId in state.json](screenshots/01-ac-6-1-predecessor-chapter-5-left-a-pending-payoutid-in-stat.png)

### 02. AC-6.3 — Capture seller1's pendingBalance before admin closes the payout — PASS

![Capture seller1's pendingBalance before admin closes the payout](screenshots/02-ac-6-3-capture-seller1-s-pendingbalance-before-admin-closes-.png)

### 03. AC-6.1 — Admin opens the Payouts tab and the seller's pending payout is listed — PASS

![Admin opens the Payouts tab and the seller's pending payout is listed](screenshots/03-ac-6-1-admin-opens-the-payouts-tab-and-the-seller-s-pending-.png)

### 04. AC-6.2 — Admin clicks Complete on the row and the payout leaves the pending queue — PASS

![Admin clicks Complete on the row and the payout leaves the pending queue](screenshots/04-ac-6-2-admin-clicks-complete-on-the-row-and-the-payout-leave.png)

### 05. AC-6.3 — Seller's pendingBalance drops by exactly the payout amount — PASS

![Seller's pendingBalance drops by exactly the payout amount](screenshots/05-ac-6-3-seller-s-pendingbalance-drops-by-exactly-the-payout-a.png)

### 06. AC-6.4 — Completed tab surfaces the audit row, and the BE /completed endpoint returns the captured admin — PASS

![Completed tab surfaces the audit row, and the BE /completed endpoint returns the captured admin](screenshots/06-ac-6-4-completed-tab-surfaces-the-audit-row-and-the-be-compl.png)

### 07. AC-6.3 — Admin logs out — journey complete; chapter 6 leaves no new state — PASS

![Admin logs out — journey complete; chapter 6 leaves no new state](screenshots/07-ac-6-3-admin-logs-out-journey-complete-chapter-6-leaves-no-n.png)

## Artifacts

- `trace.zip` — open with `npx playwright show-trace trace.zip`
- `video.webm` — full session recording (gitignored)
- `screenshots/` — one `NN-slug.png` per step, regenerated each run
