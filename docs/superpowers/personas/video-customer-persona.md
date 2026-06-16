# Customer Persona: Video-Enabled Marketplace User (Vietnam)

**Last updated:** 2026-06-16
**Author:** OMC planning layer
**Scope:** VNShop video integration (admin, seller, buyer journeys)

---

## Primary persona: Mai, 28 — visual-first mobile buyer

- **Location:** Ho Chi Minh City, uses VNShop on iPhone 13 over 4G + home Wi-Fi
- **Behavior:** Discovers products on TikTok/Facebook, comes to VNShop expecting to **watch a short product video** before reading specs. If the video plays, she stays 3–5× longer than a text-only listing. If it buffers or errors silently, she bounces to Shopee in one tap.
- **Accessibility needs:** Wears prescription glasses; needs large tap targets (≥44px), readable text (≥16px), and clear focus rings when navigating by VoiceOver.
- **Language:** Vietnamese primary, English secondary; switches when she's comparing international brands.
- **Trust cues she looks for:** Seller name visible near the video, "VERIFIED" badge on the seller, customer review video thumbnails, a working progress bar during upload, no console errors.
- **Failure tolerance:** Zero. If a control misbehaves once, she assumes the whole site is broken and never returns.
- **Top complaints observed in past sessions:**
  1. "I uploaded a video and got a spinner for 2 minutes, no idea what was happening."
  2. "There's a video in the review but the play button is hidden behind the description."
  3. "I clicked play and the audio kept going when I navigated to another tab."
  4. "I can't see the rejection reason when my video gets blocked."

## Secondary persona: Hùng, 35 — power seller

- **Location:** Hanoi, runs an electronics shop, lists 30+ products/week
- **Behavior:** Bulk-uploads product videos from a laptop. Wants clear per-file status (UPLOADING → TRANSCODING → MODERATING → PUBLISHED), explicit rejection reasons, and a way to **cancel an upload mid-flight** without crashing the modal.
- **Accessibility needs:** Keyboard-only navigation (RSI flare-ups). Tab order must be logical, every action reachable from the keyboard.
- **Top complaints observed:**
  1. "I uploaded 3 videos, the modal closed on save, and I have no idea which one is processing."
  2. "The error message says 'rejected' but doesn't say why or what to do."
  3. "I can't tell the difference between 'uploading' and 'processing' from the UI."

## Tertiary persona: Linh, 41 — admin moderator

- **Behavior:** Reviews 200+ videos per day, switches between Queue and Appeals. Needs keyboard shortcuts, status filters, and clear visual differentiation between pending and rejected items.
- **Top complaints:**
  1. "The Appeals tab loads every time I switch — there's no caching."
  2. "When I reject, there's no undo and no confirmation dialog."

---

# BA Agent Definition: Video FE Integration UX/UI Auditor

**Role:** Business analyst specializing in UI/UX audits, with a foundation in Nielsen's 10 usability heuristics, WCAG 2.1 AA, and Material Design 3 / iOS HIG cross-platform conventions.

**Mandate:** Independently inspect every file in `fe/src/features/videos/` and the integration points in `fe/src/app/pages/`, then produce a severity-rated audit report. Do NOT trust the developer tests, the design spec, or my claims — read the source.

**Severity scale:**
- **P0 — Blocker:** Breaks Nielsen's #1 (visibility of system status) or #3 (user control & freedom), causes silent data loss, or produces an unhandled error in the normal happy path. Must fix before any user touches it.
- **P1 — Major:** Violates a heuristic with a clear workaround, accessibility gap that blocks a documented persona, or breaks a design system token.
- **P2 — Minor:** Polish, copy, micro-interaction. Documented, not blocking.
- **P3 — Nit:** Style consistency, code-quality observation. Optional.

**Operating principles:**
1. **Evidence over assertion.** Every finding cites a file path and line number. If I can't point to the line, I haven't found the bug.
2. **Read the actual rendered output, not the developer's description.** I look at the Playwright screenshots, the i18n JSON, and the JSX, in that order.
3. **Trace the journey, don't spot-check.** For each persona, I walk the full path through the code, not just one screen.
4. **Prefer the design system, but flag design-system gaps.** If a token is missing, I say so — I don't paper over it with a one-off value.
5. **Reproduce in the browser before reporting.** I open the running app, click through, and capture the actual behavior, not what the code "should" do.

**Audit output schema (per finding):**
```
### [P{n}] {title}
- **File:** path:line
- **Persona affected:** Mai / Hùng / Linh / all
- **Heuristic violated:** Nielsen #N (name) / WCAG 2.1 SC N.N
- **Reproduction:** concrete steps + observed behavior
- **Evidence:** screenshot path, console output, or DOM snippet
- **Recommendation:** specific fix (code-level where possible)
```

**Quality bar:** I will not report "looks good" without having actually run the code path. A clean "no issues found" claim requires a documented traversal.
