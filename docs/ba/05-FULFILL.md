# 5. Fulfill

## The Core Question

**"Did I get what I paid for?"**

Fulfillment is where marketplaces become operational businesses. It's also where most customer anxiety lives — after money leaves their account and before product arrives in their hands.

---

## Order State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                     ORDER LIFECYCLE                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  CREATED ──→ AWAITING_PAYMENT ──→ PAID                          │
│     │              │                │                            │
│     │         [timeout 24h]         │                            │
│     │              ↓                │                            │
│     │         CANCELLED             │                            │
│     │                               ↓                            │
│     │ (COD skips payment)     SELLER_PENDING                     │
│     └──────────────────────→       │                            │
│                                    ├──→ ACCEPTED                 │
│                                    │        │                    │
│                                    │        ↓                    │
│                                    │     PACKED                  │
│                                    │        │                    │
│                                    │        ↓                    │
│                                    │     SHIPPED                 │
│                                    │        │                    │
│                                    │        ↓                    │
│                                    │     IN_TRANSIT              │
│                                    │        │                    │
│                                    │        ↓                    │
│                                    │     DELIVERED               │
│                                    │        │                    │
│                                    │        ├──→ CONFIRMED       │
│                                    │        │    (buyer clicks   │
│                                    │        │     or 7d auto)    │
│                                    │        │        │           │
│                                    │        │        ↓           │
│                                    │        │  ESCROW_RELEASED   │
│                                    │        │        │           │
│                                    │        │        ↓           │
│                                    │        │     COMPLETED      │
│                                    │        │                    │
│                                    │        └──→ DISPUTED        │
│                                    │               (see §8)      │
│                                    │                             │
│                                    └──→ REJECTED (by seller)     │
│                                            │                     │
│                                            ↓                     │
│                                       AUTO_REFUND                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Notification Matrix (Every State Change)

| State Transition | Buyer Gets | Seller Gets | Admin Gets | Channel |
|---|---|---|---|---|
| Order Created | "Order #X placed" | — | — | In-app, email |
| Payment Received | "Payment confirmed" | "New order! Accept within 24h" | — | In-app, push, email |
| Seller Accepted | "Seller is preparing your order" | — | — | In-app, push |
| Seller Rejected | "Order cancelled — refund processing" | — | Flag if repeat | In-app, email |
| Packed | "Your order is packed" | — | — | In-app |
| Shipped | "Shipped! Tracking: XXX" | — | — | In-app, push, email |
| In Transit | "Your order is on the way" | — | — | Push |
| Out for Delivery | "Arriving today!" | — | — | Push |
| Delivered | "Delivered — Confirm receipt" | "Buyer received order" | — | In-app, push, email |
| Auto-confirmed (7d) | "Order auto-confirmed" | "Settlement review started" | — | In-app |
| Buyer Confirmed | "Thanks for confirming!" | "Settlement review started" | — | In-app |
| Dispute Opened | "Dispute #X opened" | "Buyer disputed order #X — respond within 48h" | "New dispute" | In-app, email |

---

## SLA Requirements

| Action | Who | Deadline | If Missed |
|---|---|---|---|
| Seller accepts order | Seller | 24 hours | Auto-reject + refund |
| Seller ships order | Seller | 48 hours after accept | Warning → penalty after 3 violations |
| Buyer confirms receipt | Buyer | 7 days after delivered | Auto-confirm, settlement review becomes eligible |
| Buyer opens dispute | Buyer | 15 days after delivered | Window closes, cannot dispute |
| Seller responds to dispute | Seller | 48 hours | Auto-escalate to admin |
| Admin resolves dispute | Admin | 72 hours | Escalate to senior |
| Refund processed | Platform | 3 business days | SLA violation |
| Seller payout | Platform | 3 days after confirmed | SLA violation |

---

## Fulfillment from Seller Perspective

### Seller Order Management Flow

```
[New Order notification]
      ↓
[View order details: items, buyer address, payment status]
      ↓
[Accept] or [Reject with reason]
      ↓ (if accepted)
[Pack items]
      ↓
[Choose shipping method]
  ├── Platform carrier (GHN/GHTK): auto-generate label + tracking
  └── Self-ship: enter carrier name + tracking number manually
      ↓
[Mark as shipped]
      ↓
[Track delivery status]
      ↓
[Await settlement eligibility]
      ↓
[Seller payable is posted from verified finance facts]
```

### Seller Requirements per State

| State | Seller Must See | Seller Can Do |
|---|---|---|
| New order | Buyer name, items, address, total | Accept / Reject |
| Accepted | Packing checklist, shipping deadline | Mark as packed |
| Packed | Shipping options, label generation | Ship (enter tracking) |
| Shipped | Tracking status, estimated delivery | View tracking |
| Delivered | Confirmation countdown timer | Wait |
| Disputed | Buyer's complaint + evidence | Respond with evidence |
| Completed | Settlement status and any reserve hold | Request payout only from available posted funds |

### Current State (Seller)

| Feature | Status | Gap |
|---|---|---|
| Order list with status tabs | ✅ SellerOrders exists | OK |
| Accept/Reject order | ✅ Built | OK |
| Ship with tracking entry | ✅ ShipDialog exists | OK |
| Platform carrier label generation | ❌ Not integrated | P1 |
| Packing confirmation step | ❌ Not distinct from shipping | P2 |
| Auto-reject after 24h SLA | ❌ Not implemented | P0 |
| Shipping deadline warning | ❌ Not shown | P1 |
| Delivery status from carrier API | ❌ Not integrated | P2 |

---

## Fulfillment from Buyer Perspective

### Buyer Order Tracking Flow

```
[My Orders page]
      ↓
[Order list with status badges]
      ↓
[Click order → Order Detail]
      ↓
[See: Status timeline / Items / Tracking / Actions]
      ↓
[Available actions based on state:]
  ├── SHIPPED: "Track package" → carrier tracking page
  ├── DELIVERED: "Confirm receipt" → releases escrow
  ├── DELIVERED: "Report problem" → opens dispute
  └── CONFIRMED: "Write review" → review form
```

### Buyer Requirements per State

| State | Buyer Must See | Buyer Can Do |
|---|---|---|
| Pending payment | QR code or payment instructions | Pay / Cancel |
| Seller pending | "Waiting for seller" with countdown | Cancel (if >24h) |
| Accepted | "Seller is preparing" | Nothing (wait) |
| Shipped | Tracking number, carrier name, link | Track package |
| Delivered | "Confirm you received it" CTA | Confirm / Dispute |
| Confirmation countdown | "Auto-confirms in X days" | Confirm early |
| Completed | Items received, rated | Write review |

### Current State (Buyer)

| Feature | Status | Gap |
|---|---|---|
| Orders page with list | ✅ OrdersPage exists | OK |
| Order detail with items | ✅ | OK |
| Status badge per order | ✅ StatusPill component | OK |
| Status timeline (visual) | ❌ No step-by-step progress | P1 |
| Tracking link | ❌ Not linked to carrier | P1 |
| "Confirm receipt" button | ❌ Not built | P0 |
| "Report problem" button | ❌ Not built | P0 |
| Auto-confirm countdown | ❌ Not displayed | P0 |
| Cancel order (before ship) | ❌ Not built | P1 |
| Re-order button | ❌ Not built | P2 |

---

## Settlement and Collection Logic

### Settlement States

```
┌─────────────────────────────────────────────────┐
│ Payment Method   │ Settlement Behavior          │
├──────────────────┼──────────────────────────────┤
│ Prepaid          │ Verified capture → held       │
│                  │ → eligible after release fact │
├──────────────────┼──────────────────────────────┤
│ COD              │ Verified delivery alone does   │
│                  │ not settle; verified carrier  │
│                  │ collection is required        │
├──────────────────┼──────────────────────────────┤
│ All methods      │ seller-finance posts append-  │
│                  │ only payable/reserve journals │
└──────────────────┴──────────────────────────────┘
```

### Settlement Visibility to Buyer

The settlement status MUST be visible on the order detail page without exposing bank data:

```
┌─────────────────────────────────────────────────┐
│ Payment and Settlement Status                   │
│                                                 │
│ [●━━━━━━●━━━━━━●━━━━━━○]                        │
│  Captured  Held  Delivered  Eligible             │
│                                                 │
│ "Seller settlement follows verified payment or  │
│  COD collection and the applicable release      │
│  rules."                                        │
└─────────────────────────────────────────────────┘
```

### Current State

| Feature | Status | Gap |
|---|---|---|
| Settlement ledger | ❌ Not implemented | P0: append-only postings from verified facts |
| Prepaid release | ❌ No settlement trigger | P0: require verified capture and release fact |
| COD collection verification | ❌ No collection fact | P0: delivery alone must not settle COD |
| Settlement visibility to buyer | ❌ Not shown in UI | P0: show status without bank data |
| Reserve and dispute hold | ❌ Not implemented | P0: explicit journaled reserve/reversal |

---

## Shipping Integration

### Platform Carriers

| Carrier | Coverage | Speed | API Status |
|---|---|---|---|
| GHN (Giao Hàng Nhanh) | Nationwide | 2-5 days | Config exists, stub mode |
| GHTK (Giao Hàng Tiết Kiệm) | Nationwide | 3-7 days | Config exists, stub mode |
| Self-ship (seller arranges) | Seller decides | Varies | Manual tracking entry |

### Shipping Fee Calculation

```
Given: seller address (origin) + buyer address (destination) + package weight
Calculate: fee from carrier API (or stub formula)
Show: fee at checkout per carrier option
```

### Current State

| Feature | Status | Gap |
|---|---|---|
| Shipping service | ✅ shipping-service exists | — |
| GHN integration | ⚠️ Config + stub mode | P2 (live when ready) |
| GHTK integration | ⚠️ Config + stub mode | P2 (live when ready) |
| Fee calculation (stub) | ✅ Deterministic pricing | OK for launch |
| Tracking number storage | ✅ Seller enters at ship | OK |
| Live tracking from carrier | ❌ Not polling carrier API | P2 |
| Shipping label generation | ❌ Not built | P2 |

---

## Acceptance Criteria

### AC-1: Seller Accepts Order

```
Given seller receives a new order notification
When they open the order and click "Accept"
Then:
  - Order status changes to ACCEPTED
  - Buyer receives push notification: "Seller is preparing your order"
  - Seller sees shipping deadline countdown (48h)
  - Accept button is replaced with "Pack & Ship" flow
```

### AC-2: Seller Ships Order

```
Given seller has accepted an order
When they enter tracking number + carrier and click "Ship"
Then:
  - Order status changes to SHIPPED
  - Buyer receives push + in-app: "Your order has been shipped! Tracking: XXX"
  - Tracking number is visible on buyer's order detail
  - Carrier name + tracking number stored
```

### AC-3: Buyer Confirms Receipt

```
Given order status is DELIVERED
When buyer clicks "Confirm Receipt"
Then:
  - Order status changes to CONFIRMED
  - A fulfillment-release fact is available for settlement review
  - Seller receives notification: "Order #X is being reviewed for settlement"
  - Buyer is prompted: "Write a review?"
  - Dispute window starts (15 days)
```

### AC-4: Auto-Confirm Timer

```
Given order status is DELIVERED
And buyer has NOT confirmed within 7 days
Then:
  - System auto-confirms the order
  - A fulfillment-release fact is available for settlement review
  - Buyer receives: "Order #X auto-confirmed. If you have issues, you can still open a dispute within 15 days."
```

### AC-5: Seller Misses Accept SLA

```
Given order is in SELLER_PENDING for >24 hours
And seller has not accepted or rejected
Then:
  - Order is auto-rejected
  - Buyer receives: "Seller did not respond. Your order has been cancelled and refund initiated."
  - Refund is processed automatically
  - Seller receives penalty warning
  - After 3 missed SLAs: seller account flagged for admin review
```

### AC-6: Order Cancellation (Pre-Ship)

```
Given buyer has an order in PENDING or ACCEPTED status (not yet shipped)
When buyer clicks "Cancel Order"
Then:
  - Confirmation dialog: "Are you sure? This cannot be undone."
  - If confirmed: order status → CANCELLED
  - If prepaid: refund initiated automatically
  - Seller notified: "Buyer cancelled order #X"
  - Inventory reservation released
```

### AC-7: Order Status Timeline

```
Given buyer views order detail for a SHIPPED order
Then they see a visual timeline:
  - [✓] Order Placed — June 10, 11:30
  - [✓] Seller Confirmed — June 10, 14:00
  - [✓] Packed — June 11, 09:00
  - [✓] Shipped — June 11, 10:30 (Tracking: GHN123456)
  - [ ] Delivered — Expected June 13-14
  - [ ] Completed

Each completed step shows timestamp.
Current step is highlighted.
Future steps are greyed.
```

---

## KPIs

| KPI | Definition | Target |
|---|---|---|
| Seller accept rate | % orders accepted within SLA | >95% |
| Ship time | Time from accept → shipped | <36 hours avg |
| Delivery time | Time from shipped → delivered | <5 days avg |
| Confirm rate (manual) | % buyers who manually confirm | >30% |
| Auto-confirm rate | % that reach 7-day auto | <70% (means buyers engage) |
| Dispute rate | % of delivered orders disputed | <3% |
| Return rate | % of orders returned | <5% |
| Seller SLA miss rate | % of orders missing any SLA | <5% |
| Fulfillment cost | Shipping subsidy / order | Track only |
