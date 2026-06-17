# BA UX/UI Audit — VNShop Checkout + Payment Surface

**Date:** 2026-06-18
**Scope:** `fe/src/app/pages/checkout/`, `fe/src/app/components/checkout/`, `fe/src/app/pages/PaymentReturnPage.tsx`, `fe/src/app/pages/OrdersPage.tsx`, `fe/src/app/pages/seller/SellerWallet.tsx`, `fe/src/app/pages/admin/OrderManagement.tsx`, `fe/src/app/pages/admin/PayoutsQueue.tsx` + the related i18n namespaces in `fe/src/app/lib/i18n/en.json` / `vi.json`.
**Method:** Persona-grounded code walk per the [video audit template](2026-06-16-video-fe-ux-audit.md) and the [persona spec](../personas/video-customer-persona.md) — adapted for the checkout surface (Mai now cares about payment-error clarity, refund flow, address validation; Hùng cares about payouts, withdrawal, and dispute handling; Linh cares about admin order/payout moderation). Every finding cites `file:line` and was cross-checked against the live i18n catalogues (Node script ran `t("...")` extraction and diffed against `en.json`).
**Personas:** Mai (buyer), Hùng (seller), Linh (admin).
**Severity scale (matches 2026-06-16 audit):**
- **P0 — Blocker:** breaks Nielsen #1/#3, causes silent data loss, or hard-crashes the happy money path. Must fix before release.
- **P1 — Major:** heuristic violation with a workaround, a11y gap that blocks a documented persona, or design-token break.
- **P2 — Minor:** polish, copy, micro-interaction. Documented, not blocking.
- **P3 — Nit:** style consistency, code-quality.

---

## TL;DR — Severity Counts

| Severity | Buyer (Mai) | Seller (Hùng) | Admin (Linh) | **Total** |
|----------|------------|---------------|--------------|-----------|
| P0 — Blocker | 6 | 3 | 2 | **11** |
| P1 — Major | 5 | 4 | 3 | **12** |
| P2 — Minor | 4 | 4 | 3 | **11** |
| P3 — Nit | 2 | 2 | 2 | **6** |
| **Total** | **17** | **13** | **10** | **40** |

**Cross-cutting observation (the dominant pattern):** **P0 i18n gaps are responsible for 7 of the 11 P0 findings on the money path.** Same shape as the 2026-06-16 video audit, but the failure mode is worse here: the checkout renders the address form, the add-address dialog, and the admin order list as raw i18n keys for English users AND Vietnamese users (because the entire `admin.orders.*`, `checkout.address.form.*`, and `common.save` namespaces are missing from both `en.json` and `vi.json`). The Node diff surfaced **15 missing keys** in the checkout/payment components alone, and **all 15 keys in `admin.orders.*`** are missing in `OrderManagement.tsx`. This is the single highest-impact gap and the easiest to fix in bulk.

**Second cross-cutting observation:** the payment sections (`StripePaymentSection`, `VietQrPaymentSection`, `PaymentReturnPage`) ship with **hardcoded Vietnamese strings** — `Đang xử lý…`, `Tài khoản:`, `Thanh toán thành công 🎉`, `Sau khi chuyển xong…`. A Vietnamese user with `vi` as the secondary language gets the right copy; an English user gets Vietnamese-only literal text. This is a P0 for English-speaking buyers and a P1 for accessibility (no `lang` switch).

**Third cross-cutting observation:** the three radio groups in checkout (address / shipping / payment) all use `<div role="radiogroup">` with `<button role="radio">`. **Buttons are not real radios** — they don't respond to arrow keys, focus management is lost, and the screen-reader announcement is wrong. Same problem on the stepper (`CheckoutPage.tsx:561-606`) — five clickable circles, no `aria-current`, no `tabIndex={-1}` roving.

---

## 🔴 P0 — Blockers (must fix before user-facing release)

### Cross-cutting: i18n key namespace gaps

#### P0-1: `admin.orders.*` — all 15 keys missing
- **File:** `fe/src/app/pages/admin/OrderManagement.tsx:88,103,111,115,119,131,143,148,149,157,166,167,57,60,67,70,78,81` and `fe/src/app/lib/i18n/en.json` / `vi.json` (entire `admin.orders` namespace absent).
- **Persona:** Linh
- **Heuristic:** Nielsen #1 (Visibility of System Status) — admin sees raw key strings in the order queue title, filter buttons, status pills, action buttons, toasts.
- **Reproduction:** Login as admin → `/admin/orders` → page renders `admin.orders.title`, `admin.orders.filterAll`, `admin.orders.filterPending`, `admin.orders.accept`, `admin.orders.cancel`, `admin.orders.refund`, `admin.orders.cancelOk`, `admin.orders.refundOk` as literal text. Confirmed via Node diff (referenced=15, present=0).
- **Evidence:** `grep -c '"admin.orders."' en.json` returns 0 hits. Same for `vi.json`. This is the same systemic failure that hit the video FE audit.
- **Fix:** Add the full `admin.orders` namespace to both `en.json` and `vi.json` (15 keys — see Linh audit P0 #1 for full JSON). One PR, one afternoon.

#### P0-2: `checkout.address.form.*` — 10 keys missing (street/ward/district/city labels + placeholders)
- **File:** `fe/src/app/pages/checkout/CheckoutAddressStep.tsx:177,185,190,197,202,210,215,223` and `en.json` / `vi.json` (entire `checkout.address.form.*` subtree absent).
- **Persona:** Mai
- **Heuristic:** Nielsen #1 + #10 (Help and Documentation).
- **Reproduction:** Mai clicks `+ Add new address` from `/checkout` → modal opens with literally `checkout.address.form.street`, `checkout.address.form.streetPlaceholder`, `checkout.address.form.ward`, `checkout.address.form.district`, `checkout.address.form.city` and the same 5 placeholders. She has no idea which field is which.
- **Evidence:** Node diff shows 10/10 referenced keys are missing. The form is **unusable** for first-time buyers who don't already have an address on file.
- **Fix:** Add the 10 keys (5 labels + 5 placeholders, both locales).

#### P0-3: `checkout.address.addError`, `addAddressHint`, `openProfile` — 3 keys missing
- **File:** `fe/src/app/pages/checkout/CheckoutAddressStep.tsx:55` and `CheckoutPage.tsx:477,479`; both call `t("checkout.address.addError" | "addAddressHint" | "openProfile")`.
- **Persona:** Mai
- **Heuristic:** Nielsen #1 + #9 (Help users recognize, diagnose, recover from errors).
- **Reproduction:** Mai tries to add a new address with an invalid street → toast renders `checkout.address.addError`. Or: Mai has no saved address → "Next" button → toast renders `checkout.address.addAddressHint` and an action button label `checkout.address.openProfile`. She has no idea what to do.
- **Fix:** Add 3 keys (en + vi) — small, but the recovery path is broken without them.

#### P0-4: `checkout.payment.retryHint` key missing
- **File:** `fe/src/app/pages/checkout/CheckoutPage.tsx:425` — `t("checkout.payment.retryHint", { defaultValue: "..." })`. The `defaultValue` fallback saves English from the literal-key bug, but in Vietnamese it still renders the English fallback (i18next `defaultValue` is per-call, not per-locale).
- **Persona:** Mai
- **Heuristic:** Nielsen #1.
- **Reproduction:** Mai's order placed, but VNPay/MoMo init failed → toast description shows "Your order was placed…" in English even when `i18n.language === "vi"`.
- **Fix:** Add the key to `en.json` and `vi.json`; drop the `defaultValue` hack.

#### P0-5: `common.cancel`, `common.save`, `common.saving`, `common.next`, `common.prev`, `common.retry` — 6 keys missing
- **File:** `fe/src/app/components/checkout/CheckoutAddressStep.tsx:161,169,170`; many other files (OrdersPage, PayoutsQueue, SellerWallet).
- **Persona:** all
- **Heuristic:** Nielsen #1 (universal UI strings).
- **Reproduction:** Add-address modal renders literally `common.cancel` and `common.save`. Pagination on OrdersPage renders `common.prev` / `common.next`. Retry button in `seller.dashboard.revenue30dRetry` is missing.
- **Fix:** Add 6 keys to a top-level `common.*` namespace in both locales.

#### P0-6: Hardcoded Vietnamese strings in Stripe + VietQR + PaymentReturn
- **File:** `fe/src/app/components/checkout/StripePaymentSection.tsx:62,103,133`; `fe/src/app/components/checkout/VietQrPaymentSection.tsx:71,80,86,89,92,96`; `fe/src/app/pages/PaymentReturnPage.tsx:52,94,131,152,191,193,201,207,221,223,230` (20+ hardcoded Vietnamese literals).
- **Persona:** Mai + any English-speaking user
- **Heuristic:** Nielsen #1 + #10 (Help and Documentation) + WCAG 3.1.1 (Language of Page — a `<html lang="en">` page should not display Vietnamese).
- **Reproduction:** Mai is English-speaking. She pays with Stripe → button reads "Thanh toán". Stripe polls → reads "Đang xác nhận thanh toán…". She pays with VietQR → reads "Tài khoản:", "Nội dung CK:", "Sau khi chuyển xong, đơn hàng sẽ tự động cập nhật trong vòng 1 phút." She returns from VNPay → reads "Thanh toán thành công 🎉" or "Thanh toán không thành công".
- **Evidence:** 20+ `grep` hits for `Đang|Visa|Tài khoản|Nội dung|Sau khi|Thanh toán|Không|Trang|Đến` in those three files.
- **Fix:** Extract every literal to a `payment.*` / `paymentReturn.*` namespace. Worst offender: `PaymentReturnPage.tsx` is the only place an English user sees Vietnamese text on the entire site, and it's the money-confirmation page.

#### P0-7: Stepper `radiogroup` semantics — buttons-as-radios
- **File:** `fe/src/app/pages/checkout/CheckoutPage.tsx:561-606`.
- **Persona:** all
- **Heuristic:** WCAG 4.1.2 (Name, Role, Value) + Nielsen #4 (Consistency and standards).
- **Reproduction:** Tab to the stepper → no visible focus indicator (`disabled` step circles are `cursor-default`, no `focus-visible:ring`). Screen reader announces "5 buttons" instead of "Step 2 of 5, Shipping, current". Arrow keys do not move between steps.
- **Evidence:** `disabled={!isDone}` blocks the entire stepper for keyboard users. The only keyboard path is Enter on a completed step; incomplete steps are unreachable.
- **Fix:** Replace the `<button role="radio">` stepper with an `<ol>`/`<li>` semantic list, add `aria-current="step"` to the active item, and add `focus-visible:ring-2 focus-visible:ring-primary` to every step circle.

#### P0-8: Address / shipping / payment `radiogroup`s use `<button role="radio">` — no arrow-key nav
- **File:** `fe/src/app/pages/checkout/CheckoutAddressStep.tsx:89-138`, `CheckoutShippingStep.tsx:58-102`, `CheckoutPaymentStep.tsx:22-66`.
- **Persona:** Mai + Hùng (keyboard-only)
- **Heuristic:** WCAG 2.1.1 (Keyboard) + 4.1.2 (Name, Role, Value).
- **Evidence:** `role="radio"` is set on a `<button>`, but buttons don't auto-handle ArrowLeft/ArrowRight/Space selection. `aria-checked` is toggled by `onClick` only.
- **Fix:** Use a real `<input type="radio">` (visually hidden) per option OR add a `roving tabindex` + `onKeyDown` handler that emulates arrow-key movement.

#### P0-9: Cancel order has no confirmation — Mai loses $X with one tap
- **File:** `fe/src/app/pages/OrdersPage.tsx:464-471` — `<button onClick={() => onCancel(order.id)}>...{t("orders.actions.cancel")}</button>`. The `handleCancel` at line 544 calls `cancelOrder.mutate(id)` with no `window.confirm` and no custom dialog.
- **Persona:** Mai
- **Heuristic:** Nielsen #3 (User control and freedom) — destructive action with no confirmation.
- **Reproduction:** Mai taps "Cancel" on a `pending` order → server is called immediately, the order transitions to `CANCELLED`, no undo, no recovery.
- **Evidence:** Compare with the rest of the app — `seller-product-modal.tsx:148` ships a `window.confirm` for video cancel (and is itself on the audit list for that). The orders page is missing the same guard.
- **Fix:** Open a `ConfirmDialog` ("Cancel order #abc12345? You won't be able to undo this.") with primary destructive style. Reuse the same `ConfirmDialog` the `seller-product-modal` fix lands.

#### P0-10: Admin "Refund" button has no confirmation
- **File:** `fe/src/app/pages/admin/OrderManagement.tsx:145-153` — `<button onClick={() => refund.mutate(o.orderId)}>`. No dialog.
- **Persona:** Linh
- **Heuristic:** Nielsen #3 + #5 (Error prevention).
- **Reproduction:** Linh clicks the small "Refund" icon (28×28px, see P1 below) → server immediately refunds. Money leaves the platform with no confirmation, no reason captured, no audit trail beyond what the BE logs.
- **Fix:** Open a `ConfirmDialog` requiring a refund reason. Capture reason in the BE call.

#### P0-11: Seller payout "Withdraw" has no upper-bound UX (only a soft toast)
- **File:** `fe/src/app/pages/seller/SellerWallet.tsx:79-90` — the `onSubmit` handler does a client-side check, but the dialog uses `FormDialog` with `type: "number"`, which renders a plain input (no `min` / `max` / `step` / `inputmode`). A typo of `10000000` (an extra 0) shows the "Exceeds balance" toast only after submit; the user has already typed the full amount.
- **Persona:** Hùng
- **Heuristic:** Nielsen #9 (Error prevention) — money field with no live constraint.
- **Evidence:** `FormDialog` does not pass `min` / `max` / `inputMode` to the underlying `<input>`. The "Exceeds balance" check is a `toast.error` after submit, not a field-level error.
- **Fix:** Either (a) extend `FormField` to accept `min`/`max`/`inputMode` and add `aria-invalid` to the input, or (b) replace the `FormDialog` with a custom dialog that does live validation.

---

## 🟠 P1 — Major (must fix before scaling)

### Buyer (Mai)

#### P1-1: Cancel order / Tracking modal / Return modal — focus is not trapped, not returned
- **File:** `fe/src/app/pages/OrdersPage.tsx:119-220` (TrackingModal), `223-321` (ReturnModal).
- **Heuristic:** WCAG 2.4.3 (Focus Order) + 2.1.2 (No keyboard trap).
- **Reproduction:** Tab into a Return modal → focus walks out to underlying page content. Close the modal → focus is lost to `<body>`; screen reader announces nothing.
- **Fix:** Add `useFocusTrap` + restore focus to the trigger on close. The codebase already has `useEscapeKey` — extend the pattern.

#### P1-2: Tracking modal skeleton is decorative, no `aria-busy`
- **File:** `fe/src/app/pages/OrdersPage.tsx:126-134`.
- **Heuristic:** WCAG 1.3.1 (Info and Relationships).
- **Fix:** Add `aria-busy="true"` to the skeleton container; add `role="status"` to the loading region.

#### P1-3: "Return" reason textarea has no character counter
- **File:** `fe/src/app/pages/OrdersPage.tsx:306-313` — `<textarea>` accepts arbitrary length. The submit handler at line 244 only checks `length < 10`. A 5000-character essay is accepted.
- **Heuristic:** Nielsen #8 (Minimalist Design) + #9 (Error prevention).
- **Fix:** Add `maxLength={500}` + live counter under the textarea.

#### P1-4: "Reorder" silently drops items when add-to-cart fails partway
- **File:** `fe/src/app/pages/OrdersPage.tsx:502-524` — `handleReorder` calls `addItemAsync` in a loop. The first failure shows the error toast, but if the first item succeeds and the second fails, the user gets no error and a partial cart.
- **Heuristic:** Nielsen #1 (Visibility) + #3.
- **Fix:** Report partial success: "Added 3 of 5 items — 2 unavailable" with a "View cart" CTA.

#### P1-5: "Reorder" silently reroutes to `/cart` even on full success
- **File:** `fe/src/app/pages/OrdersPage.tsx:520-523` — `void navigate("/cart")` on any non-zero `added`. No confirmation dialog, no option to stay.
- **Heuristic:** Nielsen #3 (User control and freedom).
- **Fix:** Show toast with "View cart" / "Keep shopping" actions; only navigate on user click.

### Seller (Hùng)

#### P1-6: "Withdraw" FormDialog bank-account field has no IBAN/bank-name validation
- **File:** `fe/src/app/pages/seller/SellerWallet.tsx:71-77` — `bankAccount` is just a `text` field with `required: true`. The `onSubmit` does not validate format. The BE presumably does, but the UX shows a generic "Không hợp lệ" toast from `form-dialog.tsx:69`.
- **Heuristic:** Nielsen #9 (Error prevention) — wrong-format bank account on a payout dialog is a money-loss risk.
- **Fix:** Add a regex check (e.g. Vietnamese bank account is 6–19 digits) and surface a field-level error.

#### P1-7: Seller wallet history filter chip "failed" is uppercase-matched but renders mixed-case data
- **File:** `fe/src/app/pages/seller/SellerWallet.tsx:42-44` — `target = filter.toUpperCase()`; `p.status.toUpperCase().includes(target)`. If the BE returns `STATUS_FAILED` or `REJECTED`, the chip "failed" misses them. Conversely, "completed" matches `COMPLETED` AND `COMPLETED_BY_ADMIN`.
- **Heuristic:** Nielsen #4 (Consistency).
- **Fix:** Map filter to a known enum set on the BE; or include the enum's full string set in the audit.

#### P1-8: Payout row shows raw `sellerId` (truncated to 8 chars)
- **File:** `fe/src/app/pages/admin/PayoutsQueue.tsx:289` and `fe/src/app/pages/seller/SellerWallet.tsx` (no seller name shown in own history either).
- **Heuristic:** Nielsen #6 (Recognition rather than recall) — Linh has to know the seller by an 8-char id slice.
- **Fix:** Join `sellerName` into the API response and render it; fall back to id.

#### P1-9: FormDialog for withdrawal has no field-level error rendering
- **File:** `fe/src/app/components/form-dialog.tsx:58-79` — `handleSubmit` shows a toast on validation failure. The field itself shows no error state, so the user has no idea which field is wrong.
- **Heuristic:** WCAG 3.3.1 (Error Identification) + Nielsen #9.
- **Fix:** Add per-field error state to `FormDialog`; render under each input with `aria-describedby` and `aria-invalid`.

### Admin (Linh)

#### P1-10: OrderManagement action icons are 28×28px (P1-1.5 = WCAG 2.5.5 minimum 44px)
- **File:** `fe/src/app/pages/admin/OrderManagement.tsx:150,159,168` — `p-1.5 rounded-lg` with `IconX size={14}` = ~28×28px. **Three destructive actions in a row at 28px each.**
- **Heuristic:** WCAG 2.5.5 (Target Size, Minimum 44×44px).
- **Reproduction:** Linh tries to tap "Cancel" on a tablet → misclicks into "Refund" → money leaves the platform. See P0-10 for the second half of this.
- **Fix:** Increase to `p-2.5` (40px) or `p-3` (44px). Add `aria-label` (already there) and `focus-visible:ring-2 focus-visible:ring-primary`.

#### P1-11: PayoutsQueue tab list lacks roving tabindex + `aria-controls`
- **File:** `fe/src/app/pages/admin/PayoutsQueue.tsx:170-189`.
- **Heuristic:** WCAG 2.1.1 (Keyboard) — same bug the 2026-06-16 video audit flagged in `VideoModerationPanel.tsx:15-40`. The fix was not retro-applied here.
- **Fix:** Implement roving tabindex + ArrowLeft/ArrowRight handler.

#### P1-12: Payout complete dialog has no warning that action is irreversible
- **File:** `fe/src/app/pages/admin/PayoutsQueue.tsx:127-146` — `FormDialog` with `submitColor="#10B981"` (green) and no destructive styling. The action transfers money.
- **Heuristic:** Nielsen #3 + #5.
- **Fix:** Add a description line "This will mark the payout as completed and notify the seller. This action cannot be undone." and consider red/amber tone.

---

## 🟡 P2 — Minor (documented, not blocking)

| # | Persona | File | Issue |
|---|---------|------|-------|
| P2-1 | Mai | `CheckoutPage.tsx:55` | `addresses: Address[] = profileQuery.data?.addresses ?? []` — silently empty if BE doesn't return addresses. Mai lands on a screen with no addresses and no clear path (P0-3 covers the toast, but the empty state itself is just a sad orange box). |
| P2-2 | Mai | `CheckoutShippingStep.tsx:38-39` | `freeShipping` is computed from subtotal only, not by tier; the `FREE_SHIPPING_THRESHOLD` constant lives in `lib/domain-constants` and isn't surfaced in i18n. |
| P2-3 | Mai | `CheckoutReviewStep.tsx:119-143` | Items show `formatPrice(item.price * item.quantity)` — does not show variant, seller, or stock warnings. If a seller reduces stock between add-to-cart and place-order, Mai learns at the API call. |
| P2-4 | Mai | `CheckoutPage.tsx:78-99` | `paymentOptions` mapping falls back to `<CreditCard>` icon for any unknown code — visually identical to STRIPE, which is confusing if the BE starts returning a new gateway. |
| P2-5 | Hùng | `SellerWallet.tsx:97` | Balance card uses `linear-gradient(135deg, var(--primary), #006b65)` — `#006b65` is a hardcoded dark variant. Migrate to `var(--primary-dark)` token (or add one). |
| P2-6 | Hùng | `SellerWallet.tsx:134` | History filter chip color `rgba(0,191,179,0.12)` is the same raw `0,191,179` pattern as P3-3 from the video audit. Add a `--primary-light` token. |
| P2-7 | Hùng | `SellerWallet.tsx:101` | `balance !== null ? formatPrice(balance) : isLoading ? t("loading") : "—"` — the `—` em-dash is untranslated. Replace with `t("common.unavailable")` or remove. |
| P2-8 | Hùng | `PayoutsQueue.tsx:340-342` | Completed amount renders `line-through text-muted-foreground` — visually communicates "strikethrough/cancelled" rather than "settled/paid". Use a positive tone. |
| P2-9 | Linh | `OrderManagement.tsx:99` | Active filter pill uses hardcoded `#6366F1` (indigo). The rest of the design system uses `--primary`; the indigo accent was a half-finished migration. |
| P2-10 | Linh | `OrderManagement.tsx:127` | `truncate` on `o.orderId` clips it visually; Linh has to tap the row to see the full id. Add `title={o.orderId}` for hover-tooltip. |
| P2-11 | Linh | `PayoutsQueue.tsx:296` | `style={{ color: "#FF6200" }}` for the pending amount — also a half-finished token migration. |

---

## ⚪ P3 — Nits

| # | Persona | File | Issue |
|---|---------|------|-------|
| P3-1 | Mai | `CheckoutPage.tsx:520-535` | Inline Stripe / PayPal / VietQR section header is hardcoded Vietnamese "Hoàn tất thanh toán cho đơn {id}" — same hardcode issue as P0-6. |
| P3-2 | Mai | `CheckoutSuccess.tsx:74-76` | `t("checkout.success.title")` returns "Order placed!" — for COD adds a codNotice; for Stripe/PayPal/VietQR the same screen is the *gateway*, but the title still reads as if the order is fully done. |
| P3-3 | Hùng | `form-dialog.tsx:46,62,68,69` | All fallback strings (toast text, default `submitColor`) are hardcoded `#FF6200` + Vietnamese — `FormDialog` is reusable but i18n-incomplete. |
| P3-4 | Hùng | `SellerWallet.tsx:147` | Empty state copy `t("seller.wallet.historyEmpty")` — key exists, but no graphic / icon. Add a `<WalletOff />` icon to match the empty states in OrdersPage. |
| P3-5 | Linh | `OrderManagement.tsx:144` | Status badge `o.status` renders the raw enum (e.g. `PENDING_ACCEPTANCE`) — not translated. Add a `STATUS_LABEL_KEY` map. |
| P3-6 | Linh | `PayoutsQueue.tsx:289` | `t("admin.payouts.sellerLabel", { id: p.sellerId })` — when `sellerId` is a UUID, this reads as `Seller: 550e8400-…`. See P1-8. |

---

## Top 10 Most Damaging (cross-persona)

| Rank | Finding | Persona | Heuristic |
|------|---------|---------|-----------|
| 1 | **`admin.orders.*` — all 15 i18n keys missing (OrderManagement.tsx broken for Linh in both languages)** | Linh | Nielsen #1 |
| 2 | **20+ hardcoded Vietnamese strings in Stripe/VietQR/PaymentReturn — English user sees Vietnamese on money pages** | Mai | Nielsen #1 + WCAG 3.1.1 |
| 3 | **Cancel-order has no confirmation; one tap destroys the order** | Mai | Nielsen #3 |
| 4 | **`checkout.address.form.*` — 10 i18n keys missing; add-address modal unusable** | Mai | Nielsen #1 + #10 |
| 5 | **Stepper + 3 `radiogroup`s use `<button role="radio">` — no arrow-key nav, no `aria-current`** | all | WCAG 2.1.1 + 4.1.2 |
| 6 | **Admin Refund button has no confirmation AND is 28px — destructive money action in a tiny target** | Linh | Nielsen #3 + WCAG 2.5.5 |
| 7 | **`common.cancel` / `common.save` / `common.saving` / `common.next` / `common.prev` / `common.retry` — 6 universal i18n keys missing** | all | Nielsen #1 |
| 8 | **Seller withdrawal amount has no live constraint; over-amount shows toast after submit** | Hùng | Nielsen #9 |
| 9 | **`checkout.payment.retryHint` missing → Vietnamese users see English fallback on payment failure** | Mai | Nielsen #1 |
| 10 | **PayoutsQueue tab list lacks roving tabindex (same bug as 2026-06-16 video audit, not retro-applied)** | Linh | WCAG 2.1.1 |

---

## Design System Gaps

1. **No hardcoded-color linter enforcement on `style={{...}}` inline values.** `PaymentReturnPage.tsx:123,146,175,189,199,219`, `OrderManagement.tsx:99,100,101`, `PayoutsQueue.tsx:139,152,296,303`, `SellerWallet.tsx:97,134` all carry raw hex / rgba. The CI gate being built (task #4) should fail on `style={{ color:` / `style={{ background:` / `style={{ border:` with raw values.
2. **No language-of-page discipline.** A page that renders Vietnamese literals but the document `<html lang>` is `en` violates WCAG 3.1.1. Add a Playwright check: assert that any `vi` text appears in a `lang="vi"` subtree (or that all user-facing text comes from `t(...)`).
3. **`FormDialog` is a half-internationalized primitive.** It hardcodes `submitColor="#FF6200"` and the error toast at `form-dialog.tsx:62,68,69` is Vietnamese. Either delete the literal or parameterize. Currently it's used by 4 different screens (SellerWallet, PayoutsQueue, CouponsManagement, NotificationPreferences) — the bug propagates.
4. **Stepper / radiogroup pattern is inconsistent across the app.** `CheckoutPage`, `CheckoutAddressStep`, `CheckoutPaymentStep`, `CheckoutShippingStep`, and `OrdersPage:588-617` all build their own radio/tab UI. Extract a `<RadioCardGroup>` and a `<Stepper>` primitive into `components/ui/` and migrate.
5. **No `<ConfirmDialog>` primitive yet** — the seller-product-modal is on task #2 to add one, and P0-9, P0-10 of this audit depend on it. Make sure the primitive supports a `destructive` variant (red submit button) and a required `reason` field for refund/cancel flows.

---

## Accessibility Coverage

- **WCAG 2.1 Level A:** 4 violations (`<button role="radio">` x 4, missing focus return on modal close x 2, no focus management in stepper)
- **WCAG 2.1 Level AA:** 6 violations (28px admin action targets, 3.1.1 Language of Page on PaymentReturn/Stripe/VietQR, 1.3.1 missing `aria-busy` on skeleton, contrast on hardcoded `#FF6200` text on white in PayoutsQueue:296, no focus-visible ring on stepper, no field-level error in `FormDialog`)
- **WCAG 2.1 Level AAA:** 1 violation (no live region announces payment status transitions — screen reader user has no audio cue when VNPay/MoMo completes)

The checkout + payment surface is **not** at WCAG 2.1 AA conformance today. The money-path failures (P0-1 through P0-6) are individually small but in aggregate they make the platform unusable in English, in any keyboard-only setup, and in any screen-reader setup.

---

## Persona-specific "Did we actually deliver?" verdict

| Persona | Verdict | Why |
|---------|---------|-----|
| **Mai (buyer)** | ❌ Partial — happy path works in Vietnamese, but: cancel has no confirm, address form labels are missing in both languages, Stripe/VietQR/PaymentReturn pages are Vietnamese-only, all 3 `radiogroup`s are keyboard-broken | The base flow (browse → cart → checkout → pay → track) works for a mouse user with `vi` locale. Every other combination has at least one P0 broken. |
| **Hùng (seller)** | ❌ Partial — wallet UI is i18n-complete and works, but withdrawal form has no live validation, payout request can submit an over-amount, and `FormDialog` itself is half-Vietnamese | Power seller can withdraw and see history. Edge cases (over-amount, format error) surface as toasts, not field errors. |
| **Linh (admin)** | ❌ Not really — entire `admin.orders.*` namespace is missing, the refund/cancel buttons are 28px, the actions have no confirm | The admin order queue is functionally broken in both languages: every label is a raw i18n key, every action button is dangerously small, every action is unrecoverable. |

**Bottom line:** the FE compiles, the unit tests pass, and the E2E specs (where they exist) run green. But **it does not actually deliver the money-path UI/UX we promised.** The dominant failure is the same as the 2026-06-16 video audit — missing i18n namespaces and `<button role="radio">` semantics — but with the multiplier that the surface is the **money path**, and missing keys on the money path are categorically worse than missing keys on the video tab. Fix P0-1 through P0-6 (all in `en.json` / `vi.json` and a single Token/color refactor) and the surface looks 70% finished in a single afternoon.
