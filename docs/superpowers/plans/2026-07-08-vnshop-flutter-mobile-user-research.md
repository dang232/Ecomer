# VNShop Mobile - User Research Plan

**Created:** 2026-07-08  
**For:** VNShop Flutter Mobile Implementation  
**Status:** Draft

---

## Research Objectives

| # | Objective | Why It Matters |
|---|-----------|----------------|
| 1 | Understand mobile shopping behavior in Vietnam | Informs offline-first architecture decisions |
| 2 | Validate checkout flow pain points | Directs payment method prioritization (VNPay/MoMo/COD) |
| 3 | Gauge notification tolerance | Shapes FCM strategy and frequency |
| 4 | Identify trust signals for first-time users | Influences auth and onboarding design |
| 5 | Uncover cart abandonment triggers | Validates offline-queue feature priority |

---

## Research Methods

### Phase 1: Discovery (Week 1-2)

**Method: User Interviews (5-8 participants)**

Target: Vietnamese mobile shoppers, 18-45, who shop online at least weekly on mobile.

| Participant Profile | Screening Criteria |
|---------------------|-------------------|
| P1 | Weekly mobile shopper, uses MoMo or VNPay |
| P2 | Weekly mobile shopper, prefers COD |
| P3 | Monthly mobile shopper, carts but abandons |
| P4 | Heavy mobile shopper, shops in poor connectivity areas |
| P5 | Uses both app and website |

**Interview Guide: Mobile Shopping Behavior**

```markdown
## Warm-up (5 min)
- Tell me about how you typically shop on your phone
- What apps do you use for shopping?

## Context: Current Mobile Shopping (10 min)
- Walk me through the last time you bought something on your phone
- What did you like about that experience?
- What frustrated you?

## Deep Dive: Cart Behavior (15 min)
- Have you ever added items to a cart and then not bought them? What happened?
- [Probe: connectivity issues, changed mind, price, checkout friction]
- How do you feel when you're shopping and lose internet connection?
- What would make you come back and finish that purchase?

## Deep Dive: Payments (10 min)
- How do you usually pay for online purchases?
- What makes you trust a payment method?
- Have you ever avoided buying something because you didn't trust the payment?

## Notifications (5 min)
- How do you feel about push notifications from shopping apps?
- What notifications do you find useful vs annoying?

## Reaction: App Concept (10 min)
- [Show app mockups/screenshots]
- What would make you want to download this app?
- What would make you delete it immediately?

## Wrap-up (5 min)
- Is there anything about mobile shopping we haven't talked about?
```

---

### Phase 2: Validation (Week 2-3)

**Method: Usability Testing (5-8 participants)**

Test the checkout flow with prototype or staging build.

| Task | Success Criteria |
|------|------------------|
| T1: Sign up / Login | Complete in <2 min |
| T2: Browse and add item to cart | <30 seconds |
| T3: Complete checkout (mock) | Complete without help |
| T4: Handle "offline" scenario | User understands what's happening |

**Test Script:**

```markdown
## Setup
- Hand phone to participant
- "Think aloud as you use this app"

## Task 1: First-time checkout
"Please buy this item as if this were a real purchase."
[Observe: payment method selection, address entry, confirmation]

## Task 2: Offline scenario
[At appropriate moment, disable network]
"Keep going as best you can."
[Observe: error handling, recovery, frustration signals]

## Debrief
- What was easiest/hardest?
- What did you wish had happened that didn't?
```

---

### Phase 3: Quantification (Week 3-4)

**Method: Survey (100+ respondents)**

For scaling insights across user base.

| Question | Type | Purpose |
|----------|------|---------|
| Primary payment method | Single select | Prioritize payment integrations |
| Biggest checkout frustration | Multi-select | Validate pain points |
| Notification preference | Scale (1-5) | FCM opt-in strategy |
| Connection quality at home | Single select | Offline feature importance |
| Would use offline cart feature | Yes/No | Validate feature investment |

---

## Research Timeline

```
Week 1: Recruit participants, finalize guides
Week 2: Conduct 5-8 interviews
Week 3: Conduct usability tests, launch survey
Week 4: Synthesize, write report
```

---

## Synthesis Framework

### Affinity Map Categories

Group findings into:
- **Cart & Offline**: Behaviors, frustrations, workarounds
- **Trust & Payments**: Security concerns, method preferences
- **Notifications**: Tolerance levels, valued vs annoying
- **Onboarding**: Drop-off points, simplification opportunities

### Impact/Effort Matrix

| Finding | Impact | Effort | Priority |
|---------|--------|--------|----------|
| Offline cart is valued | High | Medium | P1 |
| COD preferred by many | High | Low | P1 |
| Notification fatigue real | High | Low | P1 |
| Complex checkout is #1 abandonment cause | Very High | High | P2 |

---

## Deliverables

| Deliverable | Owner | Due |
|-------------|-------|-----|
| Research Plan (this doc) | You | Done |
| Interview Guide | You | Week 1 |
| Usability Test Script | You | Week 1 |
| Survey Questions | You | Week 2 |
| Synthesis Report | Researcher | Week 4 |
| Highlight Reel | Researcher | Week 4 |
| Recommendations for Dev Team | Researcher | Week 4 |

---

## Next Steps

1. **Approve this plan** — or adjust objectives/methods
2. **Identify participants** — internal contacts, or use screening survey
3. **Create prototype** — for usability testing (can use existing app if staged)
4. **Draft survey** — based on interview findings

---

*This research plan supports the implementation at `docs/superpowers/plans/2026-07-08-vnshop-flutter-mobile-implementation.md`*
