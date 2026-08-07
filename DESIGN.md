# VNShop Frontend Design Contract

## 0. Source of truth

The active web design system is generated from `design-system/tokens.json` by
`scripts/generate-design-tokens.mjs`. Components consume the generated tokens
through `fe/src/styles/generated-tokens.css` and the semantic aliases in
`fe/src/styles/theme.css`. The legacy `fe/default_shadcn_theme.css` is not part
of the active import chain.

## 1. Visual language

- Marketplace utility with clear commerce hierarchy and restrained depth.
- Light canvas with white cards; dark mode mirrors the same semantic surfaces.
- VNShop red is the storefront brand accent; cobalt is reserved for utility and
  information states; campaign gold is reserved for ratings and promotions.
- Prefer shared primitives (`Button`, `IconButton`, `Surface`, `PageContainer`,
  `Pagination`, `Tabs`) over page-local controls.

## 2. Tokens

- Spacing: 4, 8, 12, 16, 24, 32, and 48px.
- Radii: 6px controls, 8px cards, 12px overlays, full round pills.
- Targets: 44px web controls and 48px mobile controls.
- Type: 12/13/14/16px body scale, 18/22/28/36px headings.
- Motion: 150ms fast, 250ms base, 400ms slow; animate only opacity,
  transform, or filter and honor reduced motion.

## 3. Layout and responsive behavior

- Storefront content uses the shared max-width container and responsive padding.
- `md` is the storefront mobile/desktop boundary.
- The global mobile navigation is fixed at the viewport bottom and the layout
  reserves its height. Product purchase actions sit above it and product detail
  reserves both bars before the page footer.
- Use stacked controls on narrow screens and avoid horizontal overflow.

## 4. Accessibility constraints

- Every icon-only control has an accessible label.
- Focus-visible indicators use the semantic focus ring.
- Headings remain present in the accessibility tree even when visual layout
  requires a compact treatment.
- Disabled controls must communicate why an action is unavailable; do not show
  unexplained disabled social-login buttons.
- Respect `prefers-reduced-motion`.

## 5. Content and metadata

- Page titles use `usePageMeta` and end with `| VNShop`.
- Product pages use product-specific title, description, image, and URL metadata.
- Search pages expose a visible page heading for the current query.
- Cart and auth pages have route-specific titles rather than inheriting the
  previously rendered product title.

## 6. Data display rules

- Buyer-facing lists are bounded by server-side pagination or cursor limits.
- Page summaries must come from aggregate response metadata, never from only
  the currently visible page.
- Stable ordering is required for numbered pages: newest first with a unique
  tie-breaker where relevant.

## 7. Accepted debt

- Informational footer topics remain dialog-backed until dedicated content pages
  are product requirements.
- Some legacy pages still use older semantic aliases; new and touched code must
  use the active token chain.
- Notification-service deep links for video surfaces remain blocked until a web
  video detail/appeal experience exists.
