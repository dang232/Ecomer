# VNShop Mobile App - Design Requirements Document
**Status:** Ready for Implementation  
**Version:** 1.0  
**Date:** 2026-07-08

---

## 1. Design Vision

VNShop is a Vietnamese e-commerce marketplace mobile app focused on:
- **Trust & Reliability**: Clean, professional interface that builds confidence
- **Speed**: Offline-first architecture for unreliable networks
- **Local Market Fit**: Vietnamese language, VND currency, local payment methods

### Visual Identity

| Element | Value |
|---------|-------|
| Primary Color | `#00796B` (Teal 700) |
| Secondary Color | `#FFB300` (Amber 600) |
| Error Color | `#D32F2F` |
| Success Color | `#388E3C` |
| Background | `#FAFAFA` (Light Grey) |
| Surface | `#FFFFFF` |
| On Primary | `#FFFFFF` |
| On Surface | `#212121` |
| Text Primary | `#212121` |
| Text Secondary | `#757575` |

### Typography

| Style | Font | Size | Weight |
|-------|------|------|--------|
| Headline Large | Roboto | 32sp | Bold (700) |
| Headline Medium | Roboto | 28sp | SemiBold (600) |
| Title Large | Roboto | 22sp | Medium (500) |
| Title Medium | Roboto | 16sp | Medium (500) |
| Body Large | Roboto | 16sp | Regular (400) |
| Body Medium | Roboto | 14sp | Regular (400) |
| Label Large | Roboto | 14sp | Medium (500) |
| Label Small | Roboto | 11sp | Medium (500) |

### Spacing System (8pt Grid)

| Token | Value |
|-------|-------|
| xs | 4px |
| sm | 8px |
| md | 16px |
| lg | 24px |
| xl | 32px |
| xxl | 48px |

### Border Radius

| Element | Radius |
|---------|--------|
| Small (chips, buttons) | 8px |
| Medium (cards, inputs) | 12px |
| Large (modals, sheets) | 16px |
| Full (avatars, icons) | 50% |

---

## 2. Screen Designs

### 2.1 Home Screen (`/`)

```
┌─────────────────────────────────────┐
│ ≡  VNShop              🔔  👤      │  ← AppBar (elevation: 0)
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ 🔍  Tìm kiếm sản phẩm...       │ │  ← Search Bar (rounded, sm radius)
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ [🔥 Khuyến mãi] [👗 Thời trang]    │  ← Category Chips (horizontal scroll)
│ [📱 Điện tử] [🏠 Gia dụng] ...    │
├─────────────────────────────────────┤
│ ┌─────────┐  ┌─────────┐          │
│ │  🛍️     │  │  🛍️     │          │  ← Product Grid (2 columns)
│ │ Product  │  │ Product  │          │
│ │ 250.000₫│  │ 150.000₫│          │
│ │ ─────── │  │ -20% OFF │          │
│ └─────────┘  └─────────┘          │
│                                     │
│ ┌─────────┐  ┌─────────┐          │
│ │  🛍️     │  │  🛍️     │          │
│ │ Product  │  │ Product  │          │
│ └─────────┘  └─────────┘          │
├─────────────────────────────────────┤
│ [Trang chủ] [Danh mục] [🛒] [Đơn] │  ← Bottom Nav (4 items, md height)
└─────────────────────────────────────┘
```

**Components:**
- `SearchBar`: Rounded input with search icon, debounced 300ms
- `CategoryChips`: Horizontal scrollable chips, single select
- `ProductCard`: Image, title (2 lines max), price, discount badge
- `BottomNavBar`: 4 items, active state with primary color

### 2.2 Login Screen (`/login`)

```
┌─────────────────────────────────────┐
│          ←                          │  ← Back button
├─────────────────────────────────────┤
│                                     │
│            🛒                       │  ← App Logo (72x72)
│         VNShop                      │  ← Title (Headline Medium)
│                                     │
│  ┌───────────────────────────────┐  │
│  │ 📧  Email hoặc số điện thoại │  │  ← Email input
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ 🔒  Mật khẩu           👁️    │  │  ← Password input (toggle visibility)
│  └───────────────────────────────┘  │
│                                     │
│  ☐ Ghi nhớ đăng nhập              │  ← Remember me checkbox
│                                     │
│  ┌───────────────────────────────┐  │
│  │         ĐĂNG NHẬP             │  │  ← Primary button (full width)
│  └───────────────────────────────┘  │
│                                     │
│  Quên mật khẩu?  Đăng ký ngay     │  ← Text buttons
│                                     │
└─────────────────────────────────────┘
```

**Components:**
- `LogoHeader`: Centered logo and title
- `TextInputField`: Email/phone with icon, validation states
- `PasswordInputField`: With visibility toggle, strength indicator
- `PrimaryButton`: Full width, loading state with spinner
- `TextLink`: Inline text links for "Forgot password" / "Register"

### 2.3 Product Detail Screen (`/products/:id`)

```
┌─────────────────────────────────────┐
│ ←  ❤️  📤  ⋮                       │  ← AppBar with back, favorite, share
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │                                 │ │
│ │         [Product Image]         │ │  ← Image carousel with dots
│ │                                 │ │
│ ○ ● ○ ○                           │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ Ao phong nam cao cap              │  ← Title (Title Large)
│                                     │
│ ₫250.000          -20%             │  ← Price + Discount badge
│ ₫312.500           Đã bán 1.2k    │  ← Original price + sold count
├─────────────────────────────────────┤
│ Màu sắc:                           │
│ [🔴] [🔵] [⚫] [⚪]               │  ← Color variants
│                                     │
│ Kích thuoc:                        │
│ [S] [M] [L] [XL]                  │  ← Size chips (single select)
├─────────────────────────────────────┤
│ Mô tả                              │  ← Expandable section
│ ────────────────────────────────   │
│ Chất liệu vải cotton 100%,...      │
│ [Xem thêm ▼]                       │
├─────────────────────────────────────┤
│                                     │
│ ┌───────────────────────┐  ┌────┐ │
│ │    THÊM VÀO GIỎ       │  │ 🛒 │ │  ← Add to cart + Cart button
│ └───────────────────────┘  └────┘ │
└─────────────────────────────────────┘
```

**Components:**
- `ImageCarousel`: Swipeable images with indicator dots
- `ColorSelector`: Circular color buttons with border on selected
- `SizeSelector`: Chip-style size buttons
- `ExpandableText`: "See more" collapse behavior
- `PriceDisplay`: Formatted VND with strikethrough original
- `StickyBottomBar`: Add to cart + cart preview

### 2.4 Cart Screen (`/cart`)

```
┌─────────────────────────────────────┐
│ Giỏ hàng (3)              🗑️      │  ← Title + Clear all
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ ☑️  │ 🛍️ │ Áo phong nam      │ │
│ │     │     │ M / Xanh duong     │ │
│ │     │     │ ₫250.000  [-] 1 [+]│ │
│ │     │     │              🗑️   │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ☑️  │ 🛍️ │ Giay the thao     │ │
│ │     │     │ 42 / Đen           │ │
│ │     │     │ ₫450.000  [-] 2 [+]│ │
│ │     │     │              🗑️   │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ Mã giảm giá                    │ │
│ │ [Nhập mã...      ] [Áp dụng]  │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ Tổng cộng: ₫1.150.000             │  ← Summary
│ (3 sản phẩm)                       │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │     TIẾN HÀNH ĐẶT HÀNG         │ │  ← Primary CTA
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**Components:**
- `CartItemCard`: Checkbox, image, details, quantity stepper, delete
- `QuantityStepper`: Minus/Plus buttons with count display
- `CouponInput`: Input + Apply button
- `CartSummary`: Total items, total price
- `CheckoutButton`: Full width, sticky at bottom

### 2.5 Checkout Screen (`/checkout`)

```
┌─────────────────────────────────────┐
│ ←  Thanh toán                     │
├─────────────────────────────────────┤
│ Địa chỉ giao hàng                  │
│ ┌─────────────────────────────────┐ │
│ │ 👤 Nguyễn Văn A                 │ │
│ │ 📱 0912 345 678                 │ │
│ │ 123 Đường ABC, P4, Q5, TP.HCM  │ │
│ │              [Thay đổi]         │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ Vận chuyển                        │
│ ┌─────────────────────────────────┐ │
│ │ ○ ⚡ Giao nhanh (1-2 ngày)     │ │
│ │   ₫25.000                       │ │
│ ├─────────────────────────────────┤ │
│ │ ● 📦 Giao thuong (3-5 ngày)    │ │
│ │   Miễn phí                      │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ Phương thức thanh toán             │
│ ┌─────────────────────────────────┐ │
│ │ 💳  VNPay                       │ │
│ │ 📱  MoMo                        │ │
│ │ 📱  VietQR                      │ │
│ │ 💵  Thanh toán khi nhận hàng   │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ Đơn hàng (3 sản phẩm)             │
│ ┌─────────────────────────────────┐ │
│ │ Áo phong nam x1    ₫250.000    │ │
│ │ Giay the thao x2   ₫900.000    │ │
│ │ ────────────────────────────   │ │
│ │ Phí giao hàng      ₫0          │ │
│ │ Tổng              ₫1.150.000   │ │
│ └─────────────────────────────────┘ │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │     ĐẶT HÀNG NGAY               │ │
│ │   Thanh toán ₫1.150.000        │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**Components:**
- `AddressCard`: Saved address display with edit button
- `ShippingOption`: Radio button with option name, time, price
- `PaymentMethodSelector`: List of payment options with icons
- `OrderSummary`: Itemized list with totals
- `PlaceOrderButton`: Full width, shows total

### 2.6 Orders Screen (`/orders`)

```
┌─────────────────────────────────────┐
│ Đơn hàng                    🔔     │
├─────────────────────────────────────┤
│ [Chờ xác nhận] [Dang giao] [Da nhan]│  ← Tab bar
│ [Đã hủy]                           │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ #ORD-20240608-001              │ │
│ │ 🛍️🛍️🛍️                        │ │  ← Order preview images
│ │ Áo phong nam, Giay the thao...  │ │
│ │ 02/06/2024 14:30               │ │
│ │ Chờ xác nhận    ₫1.150.000    │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ #ORD-20240607-002              │ │
│ │ 🛍️🛍️                          │ │
│ │ ...                             │ │
│ │ Đang giao hàng  ₫750.000       │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**Components:**
- `OrderTabBar`: Filter by status (4 tabs)
- `OrderCard`: Order ID, preview images, date, status badge, total

---

## 3. State Management

### BLoC Pattern Structure

```
features/
├── auth/
│   ├── data/
│   │   ├── models/
│   │   └── repositories/
│   ├── domain/
│   │   └── entities/
│   └── presentation/
│       ├── bloc/
│       ├── pages/
│       └── widgets/
├── products/
│   └── ...
├── cart/
│   └── ...
└── orders/
    └── ...
```

### Key BLoCs

| BLoC | States | Events |
|------|--------|--------|
| AuthBloc | Initial, Loading, Authenticated, Unauthenticated, Error | Login, Logout, CheckSession, RefreshToken |
| ProductListBloc | Initial, Loading, Success, Error, SearchDebouncing | Load, Search, LoadMore, Refresh |
| CartBloc | Initial, Loaded, Syncing, Error | Load, AddItem, UpdateQuantity, RemoveItem, ApplyCoupon, Checkout |
| CheckoutBloc | Initial, Loading, PaymentReady, Processing, Success, Error | SelectAddress, SelectShipping, SelectPayment, PlaceOrder, ConfirmPayment |
| OrderBloc | Initial, Loading, Loaded, Error | Load, LoadMore, Cancel |

---

## 4. Animation Specifications

### Screen Transitions

| Transition | Duration | Curve | Type |
|------------|----------|-------|------|
| Push | 300ms | easeInOut | Slide from right |
| Pop | 300ms | easeInOut | Slide to right |
| Modal | 350ms | easeOutCubic | Slide from bottom |

### Micro-interactions

| Element | Animation | Duration | Values |
|---------|-----------|----------|--------|
| Button press | Scale | 100ms | 1.0 → 0.96 → 1.0 |
| Card tap | Elevation + Scale | 150ms | 2dp → 4dp, 1.0 → 0.98 |
| Loading spinner | Rotation | 1000ms | 0° → 360° (repeat) |
| Toast | Fade + Slide | 250ms | opacity 0→1, translateY 20→0 |
| Add to cart | Scale bounce | 300ms | 1.0 → 1.2 → 1.0 |
| Quantity change | Scale | 150ms | 1.0 → 1.1 → 1.0 |

### List Animations

| Action | Animation | Stagger |
|--------|-----------|--------|
| Initial load | FadeIn + SlideUp | 50ms between items |
| Load more | FadeIn | 30ms between items |
| Remove | SlideOut + FadeOut | 200ms |

---

## 5. Offline Behavior

### Cache Strategy

| Data | Cache | TTL | Sync |
|------|-------|-----|------|
| Products | Hive | 1 hour | Pull-to-refresh |
| Categories | Hive | 24 hours | Background sync |
| Cart | Hive + Secure | Session | Immediate sync on reconnect |
| User Profile | Secure Storage | Session | On login |
| Orders | Hive | 7 days | On app open |

### Offline Indicators

- **Cart**: "Đang chờ đồng bộ" badge with pending count
- **Products**: "Đang tải..." with cached data visible
- **Checkout**: Block with "Đang offline, vui lòng thử lại"

---

## 6. Error States

### Empty States

| Screen | Message | Icon | Action |
|--------|---------|------|--------|
| Cart | Giỏ hàng trống | 🛒 | Khám phá ngay |
| Orders | Chưa có đơn hàng | 📦 | Mua sắm ngay |
| Search | Không tìm thấy kết quả | 🔍 | Thử từ khóa khác |
| Favorites | Chưa có sản phẩm yêu thích | ❤️ | Khám phá |

### Error States

| Type | Display | Action |
|------|---------|--------|
| Network Error | "Không có kết nối mạng" + retry button | Retry button |
| Server Error | "Đã xảy ra lỗi, vui lòng thử lại" | Retry button |
| Session Expired | Auto-redirect to login | None |
| Payment Failed | Error message + support link | Thử lại / Liên hệ |

---

## 7. Accessibility

### Requirements

- All images have `alt` text
- Minimum touch target: 48x48dp
- Color contrast ratio: 4.5:1 minimum
- Screen reader support for all interactive elements
- Focus indicators visible
- Font scaling support up to 200%

### Semantic Structure

```dart
// Example: Product Card
Semantics(
  label: 'Sản phẩm Áo phong nam, giá 250.000 đồng, giảm 20%',
  button: true,
  child: ProductCard(...),
)
```

---

## 8. Responsive Breakpoints

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile | < 600dp | Single column, bottom nav |
| Tablet | >= 600dp | 2 columns, side rail |
| Desktop | >= 900dp | 3 columns, persistent nav |

---

## 9. Implementation Priorities

### Phase 2: Auth (High Priority)
- Login/Register forms with validation
- Secure token storage
- Session management
- Auth redirect in router

### Phase 3: Products (High Priority)
- Product listing with pagination
- Search with 300ms debounce
- Product detail view
- Offline product cache

### Phase 4: Cart + Checkout (Critical)
- Add/remove/update items
- Cart persistence (Hive)
- Offline queue for operations
- Address selection
- Shipping options
- Payment method selection
- Order placement

### Phase 5: Orders + FCM (Medium)
- Order history
- Order detail
- Order status tracking
- Push notifications
- Deep link handling

### Phase 6: Localization (Medium)
- Vietnamese as default
- VND currency formatting: `1.250.000₫`
- Date formatting for Vietnamese locale

### Phase 7: CI/CD (Medium)
- GitHub Actions workflow
- Android debug build
- Firebase integration
- Test coverage reporting

---

## 10. Technical Constraints

1. **No Firebase yet**: Use mock FCM until `flutterfire configure` completes
2. **Payment backend**: Use existing `/payment/**` routes, not `/payments/**`
3. **Android SDK**: Required for APK build - currently missing
4. **Web build**: Works as smoke test only, not production target
5. **iOS**: No macOS runner, iOS CI will fail until provisioned

---

*Document Version: 1.0*  
*Last Updated: 2026-07-08*
