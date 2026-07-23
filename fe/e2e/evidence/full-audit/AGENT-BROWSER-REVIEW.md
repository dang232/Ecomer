# Agent Browser Persona Review

Generated during the 2026-07-22 Docker audit. Sessions were isolated and named
`vnshop-audit-guest`, `vnshop-audit-admin`, and `vnshop-audit-seller`.

## Evidence Captured

| Persona | Browser coverage                                              | Evidence                                                                                                                                    |
| ------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Guest   | Home, catalog sections, product detail, login | `agent-browser-audit/screenshots/guest-home.png`, `guest-product-detail.png`, `login-page.png` and matching snapshots |
| Seller  | Home, dashboard, account menu                                 | `seller-home.png`, `seller-dashboard.png`, `seller-account-menu-before.txt`, `seller-account-menu-after.txt`                                |
| Admin   | Login, dashboard, sellers queue                               | `admin-login-page.txt`, `admin-keycloak-login.txt`, `admin-dashboard.png`, `admin-sellers.png` and matching snapshots                       |

The snapshots were taken after navigation with fresh accessibility references.
They show the actual rendered navbar, catalog, product gallery, seller console,
admin console, role-specific navigation, and login boundaries. No browser
session was left open after capture.

## What This Pass Proves

- The guest storefront mounts with product discovery, category navigation,
  trust content, and a usable product detail page.
- The historical OIDC entry evidence is superseded by the native gateway login
  boundary; current browser auth is covered by the auth-focused Playwright tests.
- Seller and admin role shells render their expected dashboards and navigation.
- The UI is not relying on a blank loading screen for these representative
  routes.

## Coverage Boundary

Agent Browser was a visual/accessibility evidence pass, not the complete
behavioral gate. Authenticated buyer checkout, order cancellation, seller
accept/ship, payout, review moderation, admin coupon mutation, disputes, and
payment/shipping API contracts are covered by the Playwright and API suites.
The full map is in [`FLOW-INVENTORY.md`](FLOW-INVENTORY.md).

The browser evidence also exposed the important distinction between a rendered
console shell and a production integration: the local environment contains
seed/demo data, carrier mode is stubbed, and external payment/social-provider
callbacks were not exercised with live credentials. Those are release findings,
not passing signals; see [`EVIDENCE-REVIEW.md`](EVIDENCE-REVIEW.md).
