# Workday - Admin

**Verdict:** PASS
**Steps:** 9 / 9 passed
**Generated:** 2026-08-06T00:49:05.238Z

## Steps

### 01. Login as admin via /login form - PASS

![Login as admin via /login form](screenshots/01-login-as-admin-via-login-form.png)

### 02. /admin dashboard mounts as default tab - PASS

![/admin dashboard mounts as default tab](screenshots/02-admin-dashboard-mounts-as-default-tab.png)

### 03. Sellers approval queue renders - PASS

![Sellers approval queue renders](screenshots/03-sellers-approval-queue-renders.png)

### 04. Open Coupons tab - PASS

![Open Coupons tab](screenshots/04-open-coupons-tab.png)

### 05. Create FIXED coupon WORKDAY338524 round-trips - PASS

![Create FIXED coupon WORKDAY338524 round-trips](screenshots/05-create-fixed-coupon-workday338524-round-trips.png)

### 06. Deactivate coupon WORKDAY338524 flips to Paused - PASS

![Deactivate coupon WORKDAY338524 flips to Paused](screenshots/06-deactivate-coupon-workday338524-flips-to-paused.png)

### 07. Disputes tab parses - PASS

![Disputes tab parses](screenshots/07-disputes-tab-parses.png)

### 08. Payouts tab parses - PASS

![Payouts tab parses](screenshots/08-payouts-tab-parses.png)

### 09. Logout returns to home with Login CTA - PASS

![Logout returns to home with Login CTA](screenshots/09-logout-returns-to-home-with-login-cta.png)

## Artifacts

- `trace.zip` - open with `npx playwright show-trace trace.zip`
- `video.webm` - full session recording (gitignored)
- `screenshots/` - one `NN-slug.png` per step, regenerated each run
