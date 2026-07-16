# Workday — Seller

**Verdict:** PASS
**Steps:** 8 / 8 passed
**Generated:** 2026-07-15T09:53:16.105Z

## Steps

### 01. Login as seller1 via /login form — PASS

![Login as seller1 via /login form](screenshots/01-login-as-seller1-via-login-form.png)

### 02. /seller dashboard mounts with four KPI cards — PASS

![/seller dashboard mounts with four KPI cards](screenshots/02-seller-dashboard-mounts-with-four-kpi-cards.png)

### 03. Revenue + Orders 30-day sections render — PASS

![Revenue + Orders 30-day sections render](screenshots/03-revenue-orders-30-day-sections-render.png)

### 04. Products tab table chrome renders — PASS

![Products tab table chrome renders](screenshots/04-products-tab-table-chrome-renders.png)

### 05. Orders tab queue parses without Zod leak — PASS

![Orders tab queue parses without Zod leak](screenshots/05-orders-tab-queue-parses-without-zod-leak.png)

### 06. Wallet tab renders balance + history sections — PASS

![Wallet tab renders balance + history sections](screenshots/06-wallet-tab-renders-balance-history-sections.png)

### 07. View own public storefront at /sellers/{id} — PASS

![View own public storefront at /sellers/{id}](screenshots/07-view-own-public-storefront-at-sellers-id.png)

### 08. Logout returns to home with Login CTA — PASS

![Logout returns to home with Login CTA](screenshots/08-logout-returns-to-home-with-login-cta.png)

## Artifacts

- `trace.zip` — open with `npx playwright show-trace trace.zip`
- `video.webm` — full session recording (gitignored)
- `screenshots/` — one `NN-slug.png` per step, regenerated each run
