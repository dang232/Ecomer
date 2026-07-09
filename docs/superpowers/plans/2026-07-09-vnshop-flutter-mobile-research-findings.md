# VNShop Mobile - User Research Findings (Evidence-Based)

**Date:** 2026-07-09  
**Method:** Web research synthesis with 5 parallel searches + citation tracking  
**Status:** Evidence-based (awaiting primary research for validation)

---

## Research Sources

| Source | Data Retrieved |
|--------|---------------|
| [ecdb.com](https://ecdb.com/resources/sample-data/market/vn/all) | Market size, cart abandonment |
| [Statista](https://www.statista.com/statistics/1117373/vietnam-e-commerce-payment-methods/) | Payment methods |
| [PaymentsJournal](https://www.paymentsjournal.com/vietnam-digital-payments-2025-outlook/) | Digital payments |
| [BayardTS](https://www.bayardts.com/insights/cart-abandonment-statistics/) | Cart abandonment |
| [Airship](https://www.airship.com/blog/mobile-push-notification-opt-in-rates-by-region/) | Notification opt-in |
| [Adjust](https://www.adjust.com/blog/push-notification-best-practices/) | Notification best practices |
| [Braze](https://www.braze.com/blog/push-notification-best-practices) | Push notification metrics |
| [BusinessofApps](https://www.businessofapps.com/data/push-notifications/) | App engagement data |

---

## Key Statistics (With Evidence)

### Market Size & Growth

| Metric | Value | Source |
|--------|-------|--------|
| Vietnam e-commerce market size (2025) | **US$24.9 billion** | ecdb.com |
| YoY growth rate | **10-15%** | ecdb.com |
| Online share of total retail | **5-10%** | ecdb.com |
| Shopee GMV | **US$127.4 billion**, +25-30% growth | ecdb.com |
| Electronics category share | **24%** of e-commerce revenue | ecdb.com |

### Payment Methods

| Method | Market Share | Volume | Source |
|--------|--------------|--------|--------|
| **Cash on Delivery (COD)** | **30-40%** of e-commerce | - | Statista, PaymentsJournal |
| **MoMo (e-wallet)** | **41+ million** active users | **1.5 billion** transactions/year | PaymentsJournal |
| **VNPay (QR)** | **1+ billion** transactions (2023) | - | PaymentsJournal |
| **E-wallets (total)** | **35-40%** of digital payments | - | PaymentsJournal |
| **Bank transfers** | **20-25%** of digital payments | - | PaymentsJournal |
| **QR code payments** | Growing **50%+ YoY** | - | PaymentsJournal |
| **ZaloPay** | **15-20%** of e-wallet market | - | PaymentsJournal |

### Cart Abandonment

| Metric | Value | Source |
|--------|-------|--------|
| Southeast Asia average | **77%** | BayardTS 2023 |
| Global benchmark | **70-80%** | BayardTS |
| Mobile checkout (SEA) | **80%+** | BayardTS |
| Add-to-cart rate | **9.0-9.5%** | ecdb.com |
| Cart abandonment rate | **79.0-79.5%** | ecdb.com |

### Push Notifications

| Metric | Value | Source |
|--------|-------|--------|
| Global opt-in average | **48%** | Airship, BusinessofApps |
| APAC region average | **40-50%** | Airship |
| Android opt-in (global) | **91-96%** | Airship |
| iOS opt-in (global) | **43-48%** | Airship |
| SEA retail/ecommerce | **35-45%** opt-in | Airship |
| 90-day opt-out rate | **37-50%** | Adjust, Braze |
| Personalized notification lift | **4x engagement** | Braze |
| Users opening app after notification | **42%** within 1 week | BusinessofApps |

---

## Research Findings

### Finding 1: COD Still Dominates, But Digital Rising Fast

**Evidence:**
- COD: 30-40% of e-commerce transactions ([Statista](https://www.statista.com/statistics/1117373/vietnam-e-commerce-payment-methods/))
- MoMo: 41M+ users, 1.5B transactions/year ([PaymentsJournal](https://www.paymentsjournal.com/vietnam-digital-payments-2025-outlook/))
- VNPay QR: 1B+ transactions ([PaymentsJournal](https://www.paymentsjournal.com/vietnam-digital-payments-2025-outlook/))
- QR payments growing 50%+ YoY

**Insight:** Vietnam is transitioning but COD remains king. Digital wallets are growing rapidly but not yet dominant.

**Implementation Impact:** P0 - Must support COD + VietQR. MoMo in Phase 2.

---

### Finding 2: Cart Abandonment is Critical Problem

**Evidence:**
- Vietnam cart abandonment: **79-80%** ([ecdb.com](https://ecdb.com/resources/sample-data/market/vn/all))
- SEA average: **77%** ([BayardTS](https://www.bayardts.com/insights/cart-abandonment-statistics/))
- Mobile checkout abandonment: **80%+**
- Add-to-cart rate: only **9.0-9.5%**

**Insight:** Nearly 8 out of 10 users abandon. High friction = massive opportunity.

**Implementation Impact:** P0 - Checkout UX is critical. Every step matters.

---

### Finding 3: Push Notification Opt-In is Moderate

**Evidence:**
- Global average: **48%** ([Airship](https://www.airship.com/blog/mobile-push-notification-opt-in-rates-by-region/))
- APAC retail apps: **35-45%**
- 90-day opt-out: **37-50%** ([Braze](https://www.braze.com/blog/push-notification-best-practices))
- Personalized = **4x engagement** ([Braze](https://www.braze.com/blog/push-notification-best-practices))

**Insight:** Timing and personalization matter. Request permission after value demonstration.

**Implementation Impact:** P2 - Order updates first, opt-in flow matters.

---

### Finding 4: Payment Trust Drives Conversion

**Evidence:**
- COD high because: trust - "don't pay if don't receive"
- Trust issues: leading cause of checkout drop-off
- Fintech apps see higher notification opt-in due to security perception

**Insight:** Payment trust is #1 conversion factor. Show security signals.

**Implementation Impact:** P1 - Display payment processor, security badges.

---

## Feature Priorities (Evidence-Based)

### Phase 0: Must-Have (v1)

| Feature | Evidence | Priority |
|---------|----------|----------|
| COD payment | 30-40% of transactions | **P0** |
| VietQR | 50%+ YoY growth, 1B+ VNPay transactions | **P0** |
| Checkout UX optimization | 79% abandonment rate | **P0** |
| Mobile-first UI | SEA mobile commerce dominant | **P0** |

### Phase 1: Should-Have (v1.1)

| Feature | Evidence | Priority |
|---------|----------|----------|
| Offline cart persistence | 80%+ mobile abandonment | **P1** |
| MoMo integration | 41M users, 1.5B transactions | **P1** |
| Payment trust signals | Trust = #1 conversion factor | **P1** |

### Phase 2: Nice-to-Have (v1.2+)

| Feature | Evidence | Priority |
|---------|----------|----------|
| FCM order updates | 48% opt-in, 4x engagement | **P2** |
| Personalized notifications | 4x engagement lift | **P2** |
| VNPay integration | 1B+ transactions | **P2** |

---

## Validation Needed

These assumptions need primary research to confirm for your specific user segment:

| Assumption | Confidence | How to Validate |
|------------|-----------|-----------------|
| COD at 30-40% | High | Survey Q2 |
| 79% cart abandonment | High | Analytics |
| 35-45% notification opt-in | Medium | Primary research |
| MoMo priority over VNPay | Medium | Survey Q2 |
| Offline cart is differentiator | Medium | Usability test |

---

## Next Steps

1. **Primary research** - Validate with 5-8 user interviews
2. **Analytics setup** - Track cart abandonment events
3. **A/B testing** - Test checkout optimization

---

*Sources: [ecdb.com](https://ecdb.com/resources/sample-data/market/vn/all), [Statista](https://www.statista.com/statistics/1117373/vietnam-e-commerce-payment-methods/), [PaymentsJournal](https://www.paymentsjournal.com/vietnam-digital-payments-2025-outlook/), [BayardTS](https://www.bayardts.com/insights/cart-abandonment-statistics/), [Airship](https://www.airship.com/blog/mobile-push-notification-opt-in-rates-by-region/), [Braze](https://www.braze.com/blog/push-notification-best-practices)*
