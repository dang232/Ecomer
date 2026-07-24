# Workday — Admin

**Verdict:** PASS
**Steps:** 9 / 9 passed
**Generated:** 2026-07-23T14:53:53.003Z

## Steps

### 01. Login as admin1 via /login form — PASS

![Login as admin1 via /login form](screenshots/01-login-as-admin1-via-login-form.png)

### 02. /admin dashboard mounts as default tab — PASS

![/admin dashboard mounts as default tab](screenshots/02-admin-dashboard-mounts-as-default-tab.png)

### 03. Sellers approval queue renders — PASS

![Sellers approval queue renders](screenshots/03-sellers-approval-queue-renders.png)

### 04. Open Coupons tab — PASS

![Open Coupons tab](screenshots/04-open-coupons-tab.png)

### 05. Create FIXED coupon WORKDAY424221 round-trips — PASS

![Create FIXED coupon WORKDAY424221 round-trips](screenshots/05-create-fixed-coupon-workday424221-round-trips.png)

### 06. Deactivate coupon WORKDAY424221 flips to Paused — PASS

![Deactivate coupon WORKDAY424221 flips to Paused](screenshots/06-deactivate-coupon-workday424221-flips-to-paused.png)

### 07. Disputes tab parses — PASS

![Disputes tab parses](screenshots/07-disputes-tab-parses.png)

### 08. Payouts tab parses — PASS

![Payouts tab parses](screenshots/08-payouts-tab-parses.png)

### 09. Logout returns to home with Login CTA — PASS

![Logout returns to home with Login CTA](screenshots/09-logout-returns-to-home-with-login-cta.png)

## Artifacts

- `trace.zip` — open with `npx playwright show-trace trace.zip`
- `video.webm` — full session recording (gitignored)
- `screenshots/` — one `NN-slug.png` per step, regenerated each run
