# VNShop Commerce Functional Repair Design

## Context

The current branch contains substantial modernization work, but the live
runtime and the web contracts are not yet strong enough to claim that buyer,
seller, admin, registration, and media workflows work end to end. The domain
graph was refreshed and validated with the Understand-Anything graph schema.
The first reproducible failures are a stale refresh cookie blocking login, a
missing seller-owned product list endpoint, and an unverified browser-to-MinIO
upload boundary.

## Goals

- Make login and registration independent of stale refresh-cookie state while
  preserving CSRF protection for cookie-authenticated state-changing routes.
- Give the seller console an authenticated, owner-scoped product-management
  read model that includes drafts and inactive products without changing the
  public buyer catalog contract.
- Make local MinIO a complete browser-facing media boundary for product images,
  avatars, and the video lifecycle, including CORS, presigning, activation,
  publication, and durable object visibility.
- Exercise the real buyer, seller, admin, duplicate-registration, approval,
  order, return, payout, image, and video workflows in the in-app browser and
  preserve every confirmed failure as a regression test.

## Non-goals

- Do not expose Keycloak or internal service ports to the browser.
- Do not replace the public `GET /products` buyer catalog with seller data.
- Do not add UI controls for backend capabilities that do not exist.
- Do not repair failures with browser-only state, hard-coded product rows, or
  other temporary fallbacks.
- Do not wipe Docker volumes or reset unrelated worktree changes.

## Design

### Authentication boundary

The gateway CSRF matcher will apply only to the cookie-authenticated refresh
and logout flows that need CSRF protection. Login and registration remain
usable when an expired or unrelated `vnshop_rt` cookie is present. A gateway
regression test will prove that the stale-cookie login path reaches the auth
endpoint and that refresh/logout remain protected.

### Seller product data boundary

Product-service will expose `GET /sellers/me/products` to a seller principal.
The application and repository layers will apply the authenticated seller ID
as an ownership predicate, with explicit pagination and management filters
where the existing UI needs them. The response will use the existing API
envelope and product runtime contract. The seller feature will consume this
endpoint through its shared endpoint module; the public catalog query remains
reserved for buyer-facing ACTIVE products.

### Local object storage boundary

MinIO will be provisioned by the existing Compose/Kubernetes bootstrap with
the product, avatar, review, invoice, temporary video, staging video, and
published video buckets. Bootstrap will configure browser CORS for the local
frontend origins and the methods/headers used by presigned PUT and TUS
workflows. Services will continue to use the Docker-internal endpoint, while
presigned URLs returned to the browser will use the configured public endpoint.
Verification will perform actual browser-facing uploads, activation/finalising
calls, and public reads; a curl-only check is not sufficient.

### Functional QA loop

Two independent read-only agents will audit the application: one will inspect
every actionable surface and API contract, and one will execute real persona
flows. A separate storage audit will check bucket policy, CORS, endpoint
translation, and lifecycle state. Confirmed failures will be fixed in
disjoint slices with a failing regression test first, followed by focused
service tests, frontend type/lint/build checks, and in-app browser evidence.

## Error handling and ownership

Unauthorized seller reads must fail at the gateway/controller boundary, and
repository queries must still scope by seller ID so a route or role mistake
cannot leak another seller's products. Upload failures must surface the
failed boundary and preserve resumable/retry state rather than reporting a
successful activation before the object exists. Browser workflows will use
deterministic disposable accounts and clean up only data created by the test.

## Verification

- Gateway stale-cookie login, refresh, and logout security tests.
- Product-service controller/application/repository tests for seller-owned
  management reads and public ACTIVE-only reads.
- Frontend endpoint, query, form, and seller workflow tests.
- MinIO health, bucket/CORS, presigned URL, actual PUT, activation, and public
  object checks for images and avatars; equivalent TUS/finalisation/public
  checks for videos.
- In-app browser flows for duplicate registration, seller application and
  approval, seller hub navigation, product create/edit/publish, buyer product
  visibility, admin order actions, and the major buyer checkout/account paths.
- Final frontend typecheck, lint, build, focused service tests, and the
  broadest available Playwright/API regression suite, with unavailable
  protected-environment gates reported separately.
