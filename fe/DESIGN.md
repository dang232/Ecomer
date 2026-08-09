# VNShop Web Design System

> Extracted from the existing frontend token files and shared primitives on 2026-08-08. This document is the visual and interaction contract for new frontend work. It records the system that exists today; it does not authorize a broad reskin.

## 1. Atmosphere & Identity

VNShop is a practical marketplace with a compact operational console: clear, dense enough for work, and softened by warm commerce accents. The signature is semantic color carried through quiet layered surfaces: a pale canvas or charcoal dark canvas, white/raised panels, restrained borders, cobalt operational actions, red marketplace branding, and gold campaign emphasis. Admin queues should feel like a calm control room rather than a marketing dashboard: information hierarchy, status meaning, and fast row-to-detail movement come before decoration.

The active web stack is Tailwind CSS v4 plus CSS custom properties. New components consume semantic utilities such as `bg-background`, `bg-card`, `bg-muted`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, and `ring-ring`. Do not introduce a second palette or raw color values in product components.

## 2. Color

### Palette

Primitive values are generated from `design-system/tokens.json` into `src/styles/generated-tokens.css`. Semantic aliases and Tailwind mappings live in `src/styles/theme.css`. The values below are the current source of truth.

| Role | Token | Light | Dark | Usage |
|---|---|---|---|---|
| Canvas | `--color-canvas` / `--background` | `#f6f7f9` | `#101116` | Page background |
| Surface | `--color-surface` / `--card` | `#ffffff` | `#17191f` | Cards, tables, panels |
| Surface subtle | `--color-surface-subtle` / `--muted` | `#eef1f5` | `#20232b` | Toolbars, muted blocks, selected supporting content |
| Surface raised | `--color-surface-raised` / `--surface-elevated` | `#ffffff` | `#262a33` | Popovers, raised surfaces, icon wells |
| Border | `--color-border` / `--border` | `#d7dce5` | `#363a46` | Dividers and outlines |
| Border strong | `--color-border-strong` / `--border-hover` | `#aeb6c5` | `#596173` | Hover and emphasized boundaries |
| Text primary | `--color-text` / `--foreground` | `#17191f` | `#f7f8fa` | Headings and body text |
| Text muted | `--color-text-muted` / `--muted-foreground` | `#596273` | `#b4bac7` | Descriptions and metadata |
| Text subtle | `--color-text-subtle` | `#737d8f` | `#949cab` | Low-emphasis metadata |
| Operational action | `--color-action-primary` | `#3347c7` | `#8ea0ff` | Focus, operational action semantics |
| Operational hover | `--color-action-primary-hover` | `#2738a8` | `#aab7ff` | Action hover |
| Marketplace brand | `--web-brand` / `--primary` | `#d63c2f` | `#ff8b7b` | Marketplace CTAs and brand accents |
| Marketplace hover | `--web-brand-hover` / `--primary-hover` | `#be3027` | `#ffa296` | Marketplace hover |
| Marketplace subtle | `--web-brand-subtle` / `--primary-light` | `#fff0ed` | `#4a1f1a` | Selected rows and soft brand emphasis |
| Commerce accent | `--web-campaign-accent` / `--accent` | `#f2ad00` | `#ffc247` | Campaigns, ratings, warnings |
| Success | `--color-success` / `--success` | `#147a4e` | `#5fd29a` | Approved, paid, completed |
| Success subtle | `--color-success-subtle` / `--success-light` | `#e8f7ef` | `#173c2b` | Success background |
| Danger | `--color-danger` / `--error` | `#b42318` | `#ff8a80` | Reject, fail, destructive action |
| Danger subtle | `--color-danger-subtle` / `--error-light` | `#feeceb` | `#4a211e` | Error background |
| Info | `--color-info` / `--info` | `#0b6e99` | `#67c7f0` | Informational state |
| Info subtle | `--color-info-subtle` / `--info-light` | `#e8f5fa` | `#173845` | Informational background |
| Warning text | `--color-warning-text` / `--warning` | `#6a4600` | `#f8cf82` | Warning copy |
| Focus | `--color-focus` / `--ring` | `#3347c7` | `#aab7ff` | Visible keyboard focus |

### Rules

- Accent colors carry meaning; they are not decorative gradients.
- Use semantic aliases in components. Extend `design-system/tokens.json` and regenerate before adding a genuine semantic role.
- Status components use `StatusPill`, `StatusIndicator`, or `InlineAlert`; do not recreate per-page status palettes.
- Dark mode is activated by `.dark` on the document and must preserve contrast and meaning, not merely invert values.
- Accessibility pairs are checked by `scripts/generate-design-tokens.mjs`; body text targets at least 4.5:1 contrast.

## 3. Typography

### Font stack

- Primary: `"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`.
- Fallback: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`.
- Inter is loaded remotely in `index.html` at weights 300, 400, 500, 600, 700, and 800.
- No custom serif or project-specific monospace stack exists. `font-mono` is reserved for IDs and code-like values.
- The legacy `Be Vietnam Pro` declaration in `src/app/lib/ui/theme.ts` is not active and must not be expanded without an explicit typography migration.

### Scale

| Token | Size | Line height | Use |
|---|---:|---:|---|
| `--type-caption` / `text-xs` | 12px | 1.5 | Metadata, helper/error copy, table headings |
| `--type-body-small` / `text-sm` | 13px | 1.5 | Dense body, controls, descriptions |
| `--type-body` / `text-base` | 14px | 1.5 | Default body |
| `--type-body-large` / `text-lg` | 16px | 1.5 | Larger supporting copy |
| `--type-title-small` / `text-xl` | 18px | 1.2–1.3 | Section and dialog titles |
| `--type-title` / `text-2xl` | 22px | 1.2–1.3 | Mobile page title |
| `--type-headline` / `text-3xl` | 28px | 1.2 | Larger page title and headline |
| `--type-display` / `text-4xl` | 36px | 1.2 | Financial/KPI emphasis |

Common hierarchy:

- Page eyebrow: `text-sm font-semibold text-primary`.
- Page title: `text-2xl font-bold sm:text-3xl`.
- Page description: `text-sm text-muted-foreground sm:text-base`, maximum `max-w-3xl`.
- Table headings: `text-xs font-semibold uppercase`.
- Labels and compact controls: `text-sm` with `font-medium` or `font-semibold`.
- IDs and external references: `font-mono text-xs` or `font-mono text-sm`.

Body text is not intentionally set below 12px. KPI `font-black` usage exists, although only Inter through 800 is loaded; treat 900-weight synthesis as existing debt, not a new pattern.

## 4. Spacing & Layout

### Base scale

Spacing derives from a 4px base:

| Token | Value | Usage |
|---|---:|---|
| `--space-xs` / `--space-1` | 4px | Icon gaps and tight group separation |
| `--space-sm` / `--space-2` | 8px | Compact controls and toolbar gaps |
| `--space-md` / `--space-3` | 12px | Field padding and table vertical rhythm |
| `--space-lg` / `--space-4` | 16px | Standard page/container padding |
| `--space-xl` / `--space-6` | 24px | Comfortable surface padding |
| `--space-xxl` / `--space-8` | 32px | Group separation |
| `--space-xxxl` / `--space-12` | 48px | Major section separation |

Compatibility aliases also expose 20px (`--space-5`) and 40px (`--space-10`). Browser mechanics such as `clamp()`, `min()`, `max()`, intrinsic sizing, and `minmax()` remain mechanics rather than tokens.

### Page and shell geometry

- `PageContainer`: `mx-auto w-full max-w-[1440px] px-4 sm:px-6 lg:px-8`.
- Standard page vertical density: `py-6`; admin queues use compact `py-4`.
- Header inner rail: `max-w-7xl`, 1280px, with 16px padding.
- Admin console header: sticky, 56px (`h-14`), `top-0`, `z-50`.
- Desktop admin navigation: `lg` and above, 240px wide, sticky, independently vertically scrollable.
- Mobile admin navigation: below `lg`, a horizontally scrollable rail with 16px horizontal padding.
- Tailwind breakpoints in use: `sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px, `2xl` 1536px.

### Admin queue composition

The default queue is a `stack`:

1. Compact `PageContainer`.
2. Responsive `PageHeader`.
3. Wrapping `TableToolbar`.
4. Loading, error, empty, or data state.
5. Optional server pagination.
6. URL-selected `AdminRecordDrawer`.

The document/body owns primary vertical page scrolling. Named nested scroll owners are:

- Desktop sidenav: vertical scroll (`h-screen overflow-y-auto`).
- Mobile admin navigation: horizontal scroll (`overflow-x-auto`).
- Data table wrapper: horizontal scroll (`overflow-x-auto`).
- Drawer content: vertical scroll (`min-h-0 overflow-y-auto`); header and footer remain fixed.

New fixed or split admin surfaces must name their scroll owner before implementation. Do not add unnamed nested scrollbars.

### Responsive rules

- Page headers stack below `sm` and become title/actions rows at `sm`.
- Toolbar controls wrap rather than force a second viewport scrollbar.
- Data tables use a semantic table with `min-w-[36rem]` and an inner horizontal scroll owner. `secondary` columns hide below `md`; `tertiary` columns hide below `lg`.
- Drawers are full-width on narrow screens and capped at `36rem` on larger screens.
- Primary content must remain readable at 375px. If a table cannot reflow, its nested scroll must be discoverable and must not cause page-level horizontal overflow.
- Long labels, IDs, URLs, and localized strings must use `min-w-0`, wrapping, truncation, or `overflow-wrap: anywhere` as appropriate.

## 5. Components

Only existing shared primitives and the next queue primitive are documented here.

### Button and IconButton

- **Structure**: semantic `<button>`; `IconButton` composes `Button size="icon"` and requires a human-readable `label`.
- **Variants**: primary, accent, outline, ghost, success, danger.
- **Sizes**: sm, md, lg, icon.
- **Spacing**: 44px web target; 48px large/mobile target; control radius; 8–12px internal padding.
- **States**: default, hover, active/native press, visible focus, disabled, pending/loading with `aria-busy`.
- **Accessibility**: native button semantics; visible `focus-visible` ring; icon-only controls always expose `aria-label` and tooltip/title where useful.
- **Motion**: color transition at the fast token; pending spinner may animate, with reduced-motion fallback.
- **Layout**: cluster of actions; action groups wrap rather than overflow.

### PageContainer, PageHeader, and TableToolbar

- **Structure**: page limiter, responsive header, then semantic `role="toolbar"`.
- **Variants**: standard/compact page density; optional eyebrow, description, actions; capability-driven search/status/sort controls.
- **Spacing**: container padding 16/24/32px by breakpoint; compact vertical padding 16px; toolbar gap 12px.
- **States**: normal, loading/error/empty content supplied by the queue frame; controls retain native focus/disabled states.
- **Accessibility**: heading hierarchy; toolbar has an accessible label; every input/select has an accessible label.
- **Motion**: no decorative motion; use tokenized color transitions for control feedback.
- **Layout**: `stack` plus wrapping `cluster`; page body remains the document scroll owner.

### DataTable

- **Structure**: bordered `overflow-x-auto` wrapper containing semantic `<table>`, caption, `thead`, and `tbody`.
- **Variants**: column priority primary/secondary/tertiary; start/center/end alignment; selected row; empty status.
- **Spacing**: 16px horizontal and 12px vertical cell padding; 576px minimum table width.
- **States**: selected, empty, keyboard row-open affordance, action-disabled states supplied by callers.
- **Accessibility**: visually hidden caption, `scope="col"`, semantic table structure, focus-revealed row-open button in the first cell.
- **Motion**: no row animation; selected/hover color changes must not move layout.
- **Layout**: table wrapper owns horizontal scrolling; primary page does not. At 375px, verify scroll discoverability and long/unbroken content.

### Pagination and CursorPagination

- **Structure**: semantic `<nav>` with previous/next `IconButton`s and an `aria-live="polite"` status.
- **Variants**: existing offset pagination; cursor mode will use the same target sizing and semantic navigation with range text, previous/next, refresh, and page-size selection.
- **Spacing**: minimum 44px web target, 8px control gap, centered status with 96px minimum width.
- **States**: first/previous disabled, last/next disabled, loading/disabled, empty, invalid/expired cursor reset.
- **Accessibility**: labelled navigation, native buttons, live current-range announcement, keyboard reachability.
- **Motion**: no layout animation; loading state may use opacity/color only and must respect reduced motion.
- **Layout**: compact footer within the queue content width; never place pagination inside a wide table scroll wrapper.

### Surface, Dialog, and Drawer

- **Structure**: bordered surface; centered modal; right-side full-height drawer with header/content/footer grid.
- **Variants**: surface default/subtle/raised; dialog sm/md/lg/xl; drawer full-width up to 36rem.
- **Spacing**: surface padding 12/16–20/20–24px; overlay padding 16px; drawer content 20px then 24px at `sm`.
- **States**: open/closed, focus trapped/restored, Escape close, backdrop close where allowed, loading/pending footer actions.
- **Accessibility**: `role="dialog"`, `aria-modal`, labelled title/description, focus management, keyboard trap, Escape behavior.
- **Motion**: existing transitions remain short and interruptible; do not animate layout dimensions without documenting the mechanism. Reduced motion removes non-essential transforms.
- **Layout**: drawer content is the named vertical scroll owner; header/footer are fixed within the panel.

### StatusPill, StatusIndicator, InlineAlert, AsyncState, EmptyState, Skeleton

- **Structure**: semantic status/alert primitives with tone mapping; lifecycle primitives choose loading/error/empty/partial/content.
- **Variants**: success, warning, danger, info, neutral; loading, error, empty, partial, content.
- **Spacing**: compact pills use 8–10px horizontal padding; empty states use generous 64px vertical padding; controls retain 44px targets.
- **States**: each named state is part of the contract, not an afterthought.
- **Accessibility**: `role="status"` for passive state, `role="alert"` for danger/errors, `aria-busy` for loading, semantic progress values where relevant.
- **Motion**: skeleton pulse and loading indicators have `motion-reduce` fallbacks; no decorative status animation.
- **Layout**: status content reflows and wraps; no status chip may force page overflow.

### QueueRecordDrawer

- **Structure**: `AdminRecordDrawer` composes the shared `Drawer` for one selected record.
- **Variants**: queue-specific detail content; optional footer actions.
- **Spacing**: label/value stacks and muted rounded detail panels follow surface tokens.
- **States**: unselected (no dialog mounted), selected, loading detail, action pending, close/reset.
- **Accessibility**: selection is URL-owned; drawer focus, Escape, and scroll behavior come from the shared drawer.
- **Motion**: use the existing drawer mechanism only; reduced motion must retain open/close semantics without movement.
- **Layout**: `list-detail` relationship with the queue as document content and the drawer as a portal-owned overlay scroll context.

### Legacy and specialized exceptions

- `AdminUserQueue` has a legacy card-wrapped table and inline range controls; do not copy this pattern into new queues.
- Video moderation queues use specialized preview drawers and may diverge from `AdminQueueFrame` where the media preview requires it.
- These exceptions are recorded, not silently promoted to the default system.

## 6. Motion & Interaction

### Timing tokens

| Token | Duration | Easing | Usage |
|---|---:|---|---|
| `--duration-fast` | 150ms | `--ease-out` | Button/control color feedback |
| `--duration-base` | 250ms | `--ease-out` | Standard surface/control transition |
| `--duration-slow` | 400ms | `--ease-out` | Theme/background transition |

Existing easing tokens include `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)`, `--ease-in-out`, and `--ease-spring`. New motion must use these tokens or add a named token here first.

### Rules

- Motion serves state or affordance: hover, focus, press, loading, open/close, or navigation feedback only.
- Animate `transform`, `opacity`, `filter`, or color. Do not animate layout properties such as width, height, margin, padding, top, or left.
- Every interactive element has visible hover/active/focus/disabled behavior appropriate to its semantics.
- `prefers-reduced-motion: reduce` disables non-essential animation. Existing skeletons use `motion-reduce:animate-none`; the admin shell disables fade-in under reduced motion.
- Cursor pagination must not animate rows or delay navigation. Preserve the current page while the next page loads when the queue implementation introduces placeholder data.
- New complex motion must record its mechanism and reduced-motion path here before implementation. No additional animation library is needed for the current queue controls; Motion is already installed but should not be imported for simple transitions.

## 7. Depth & Surface

The active strategy is **mixed, border-led tonal hierarchy**:

- Default surfaces use `bg-card` with `border-border` and `--radius-card`.
- Muted surfaces use `bg-muted` for secondary context, filters, selected supporting panels, and empty/lifecycle states.
- Raised overlays use `--shadow-medium` with `--radius-overlay`; dialogs and drawers use this treatment.
- Buttons may use `--shadow-low`; do not add arbitrary shadows to table rows or controls.
- Light-mode shadow levels currently compress to low and medium; dark mode has stronger opaque shadows. Preserve this contrast behavior.
- Borders are part of table, field, dialog, drawer, and surface anatomy. Do not replace them with arbitrary gradients or raw colors.

## 8. Accessibility Constraints & Accepted Debt

### Constraints

- Target WCAG 2.2 AA: 4.5:1 for body text and 3:1 for large text or UI boundaries where applicable.
- Every interactive control must be keyboard reachable with a visible focus ring from `--ring`, 2px outline, and 2px offset.
- Use native semantic elements: buttons for actions, links for navigation, labelled form controls, table captions and column scopes, dialog semantics for overlays.
- Minimum interactive target is 44px on web and 48px where the mobile token is explicitly required.
- Status meaning must be communicated by text or accessible semantics, not color alone.
- Long, localized, or unbroken content must not create page-level horizontal overflow. The table wrapper and mobile navigation are named horizontal scroll owners.
- Test loading, error, empty, partial, selected, disabled, and pending states in addition to the happy path.
- Verify at 375px, 768px, and 1280px for new admin surfaces, including keyboard focus and reduced-motion mode.

### Accepted debt

| Item | Location | Why accepted | Owner / exit |
|---|---|---|---|
| Header/sidebar sticky offset mismatch | `AdminLayout.tsx`, `admin-nav.tsx` | Existing shell uses a 56px sticky header and `top-0 h-screen` sidebar; changing shell geometry is outside cursor pagination transport work. | Admin shell follow-up; verify/fix before broad responsive redesign |
| Mobile admin navigation is a full-width horizontal rail | `AdminLayout.tsx`, `admin-nav.tsx` | The admin shell now stacks the mobile rail above main content below `lg`; links remain horizontally scrollable within the rail. | Preserve during future admin shell changes |
| Table minimum width is 576px | `shared/ui/data-table.tsx` | Existing semantic table preserves dense desktop columns and delegates narrow behavior to nested horizontal scrolling. | Queue UI follow-up; replace with cards only after design review and visual QA |
| `--nav-height` is 64px while console header is 56px | `theme.css`, `ConsoleChrome.tsx` | Token drift predates this work and is not safe to change as part of pagination. | Shell-token consolidation |
| `--content-max` is 1400px while `PageContainer` is 1440px | `theme.css`, `PageContainer` | Existing routes depend on the component value. | Layout-token consolidation |
| Legacy palette and inactive shadcn tokens remain | `src/app/lib/ui/theme.ts`, `default_shadcn_theme.css` | Removing them is a broad cleanup with unknown consumers. | Token cleanup task with migration inventory |
| Inter remote loading and `font-black` utility mismatch | `index.html`, `fonts.css`, KPI components | Existing performance/typography behavior is shipped and outside queue scope. | Typography/performance follow-up |
| React dev tooling gate is not wired | `main.tsx`, `package.json` | The project currently has no react-grab/react-scan/react-doctor integration. | Install or explicitly opt out before future visual QA workflow |

### Validation gate for future queue UI

Before changing `AdminQueueFrame` or adding responsive record cards:

1. Build a primitive showcase for `Button`, `IconButton`, `DataTable`, `Pagination`, `Drawer`, status feedback, and the new cursor footer.
2. Exercise default, hover, active, focus, disabled, loading, empty, error, and invalid-cursor states.
3. Run browser QA at 375px, 768px, and 1280px, including keyboard navigation and `prefers-reduced-motion: reduce`.
4. Confirm no page-level horizontal overflow and confirm each nested scroll owner remains discoverable.
