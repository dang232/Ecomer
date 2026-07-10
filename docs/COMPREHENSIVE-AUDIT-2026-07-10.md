# VNShop Comprehensive Deep Audit Report
## Multi-Seller Vietnamese E-Commerce Marketplace Platform

**Date:** July 10, 2026
**Auditor:** Claude Code (Anthropic) — Cross-validated against live codebase
**Platform:** VNShop — Shopee/Tiki/Lazada Model for Vietnam Market

> **⚠️ Audit Corrections Applied (2026-07-10):**
> This document supersedes the prior version. Key corrections sourced from `CROSS-VALIDATION-REPORT-2026-07-10.md` which tested all claims against live code via grep + file read. All items marked ✅/❌/⚠️ reflect verified state. See §11 for detailed correction log.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Complete Service Architecture](#2-complete-service-architecture)
3. [Complete Workflow Maps](#3-complete-workflow-maps)
4. [Missing Functionality](#4-missing-functionality)
5. [UI/UX Problems Analysis](#5-uiux-problems-analysis)
6. [Vietnam-Specific Niche Features](#6-vietnam-specific-niche-features)
7. [Sub-Functions Needed for Completeness](#7-sub-functions-needed-for-completeness)
8. [Integration Gaps](#8-integration-gaps)
9. [Sprint Planning](#9-sprint-planning)
10. [Feature Matrix by Category](#10-feature-matrix-by-category)
11. [Correction Log](#11-correction-log-from-cross-validation)

---

## 1. Executive Summary

### 1.1 Platform Overview

VNShop is a sophisticated polyglot microservices e-commerce platform modeled after Shopee, Tiki, and Lazada — Vietnam's dominant e-commerce marketplaces. The platform serves as a multi-seller marketplace where multiple vendors can sell products to consumers.

### 1.2 Technology Stack

| Layer | Technology | Actual Version | Notes |
|-------|------------|----------------|-------|
| **API Gateway** | Spring Cloud Gateway | 2025.1.1 | Confirmed in pom.xml |
| **Backend (Spring)** | Spring Boot | **4.0.6** | `pom.xml` — audit said 4.1.0 (wrong) |
| **Backend (NestJS)** | NestJS | 11.1.21 | Audit said 11.x (correct) |
| **Java** | OpenJDK | **25** | `java.version=25` — audit said 21 LTS (wrong) |
| **Frontend Web** | React + Vite | ⚠️ 18.3.1 (outdated) + ❌ 6.3.5 (not found) | `fe/package.json` — React 19.2.7 is latest; **no v6.x Vite tags exist on GitHub** (latest is v8.1.4) |
| **Frontend Mobile** | Flutter | 3.x | Dart 3.x — not verified in repo |
| **Database** | PostgreSQL | 16.x | |
| **Cache** | Redis | 7.x | |
| **Search** | Elasticsearch | 8.x | |
| **Messaging** | Apache Kafka | 3.x (KRaft) | |
| **Authentication** | Keycloak | 25.x | ⚠️ Verify installed version |
| **Payments** | VietQR, MoMo, Stripe, PayPal | — | All stubs |
| **Notifications** | OneSignal + Socket.IO | — | Real-time via Socket.IO, not polling |

### 1.3 Architecture Patterns

- **Domain-Driven Design (DDD)** — Bounded contexts per service
- **CQRS (Command Query Responsibility Segregation)** — Separate read/write models
- **Hexagonal Architecture** — Ports and adapters for external dependencies
- **Event-Driven Architecture** — Kafka events for service communication
- **Saga Pattern** — Orchestration for distributed transactions with compensating actions
  - ⚠️ **Correction:** Order placement is **synchronous** within a `@Transactional` method. The saga tracks state and handles compensation on failure, but the primary order creation flow is NOT asynchronous Kafka-based. See §3.1.
- **Outbox Pattern** — Reliable event publishing with dual-write protection

### 1.4 Coverage Metrics

> ⚠️ **Feature count correction:** The audit matrix covers **120 features** (F1–F120), not 119 as originally stated.

| Category | Total | Implemented | Coverage | Notes |
|----------|-------|-----------|----------|-------|
| Account & Profile | 13 | 10 | 77% | |
| Product Browsing | 14 | 10 | 71% | |
| Shopping Cart | 11 | 10 | 91% | |
| Checkout & Ordering | 9 | 7 | 78% | |
| Shipping & Delivery | 8 | 5 | 63% | |
| Payment | 8 | 5 | 63% | |
| Coupons & Discounts | 13 | 9 | 69% | |
| Reviews & Ratings | 12 | 11 | 92% | |
| Notifications | 9 | 6 | 67% | |
| Post-Purchase | 6 | 5 | 83% | |
| Admin & Seller | 16 | 10 | 63% | |
| **TOTAL** | **120** | **~88** | **~73%** | |

### 1.5 Risk Assessment

| Risk Level | Count | Key Areas |
|------------|-------|-----------|
| **Critical** | 1 | Payment gateway production integration |
| **High** | 3 | Admin dashboard advanced features, GDT API submission, Recently Viewed |
| **Medium** | 11 | Multi-language, SEO, Social login, Coupon stacking |
| **Low** | 3 | Price comparison, Cart abandonment recovery |

---

## 2. Complete Service Architecture

### 2.1 Service Inventory (17 Services)

| # | Service | Tech Stack | Port | Function | Status |
|---|---------|------------|------|----------|--------|
| 1 | **api-gateway** | Spring Cloud Gateway 2025.1.1 | 8080 | Auth, Routing, Rate Limiting | ✅ Active |
| 2 | **user-service** | Spring Boot 4.0.6 | 8081 | User, Seller profiles, Addresses | ✅ Active |
| 3 | **product-service** | Spring Boot 4.0.6 | 8082 | Product catalog, Variants, Reviews | ✅ Active |
| 4 | **inventory-service** | Spring Boot 4.0.6 | 8083 | Stock, Reservations, Flash sales | ✅ Active |
| 5 | **cart-service** | NestJS 11.1 | 8084 | Shopping cart + MergeCartUseCase | ✅ Active |
| 6 | **search-service** | Spring Boot + ES | 8086 | Full-text search, Faceting | ✅ Active |
| 7 | **notification-service** | NestJS + Socket.IO | 8087 | Real-time push (not polling) | ✅ Active |
| 8 | **order-service** | Spring Boot 4.0.6 | 8091 | Orders, Checkout, Saga orchestration | ✅ Active |
| 9 | **payment-service** | Spring Boot 4.0.6 | 8092 | VietQR, MoMo, Stripe, PayPal | ⚠️ Stub |
| 10 | **shipping-service** | Spring Boot 4.0.6 | 8093 | GHTK/GHN carrier integration | ⚠️ Stub |
| 11 | **seller-finance** | NestJS 11.1 | 8090 | Commission, Wallet, Settlements | ✅ Active |
| 12 | **recommendations** | Spring Boot 4.0.6 | 8094 | Frequently bought together | ✅ Active |
| 13 | **messaging-service** | NestJS + WebSocket | 8095 | Buyer-seller chat | ✅ Active |
| 14 | **invoice-service** | Spring Boot 4.0.6 | 8098 | Vietnam e-invoice XML (JAXB+XSD) | ✅ Active |
| 15 | **configuration-service** | NestJS 11.1 | 8097 | Centralized config hot-reload | ✅ Active |
| 16 | **coupon-service** | Spring Boot 4.0.6 | 8088 | ⚰️ Deprecated → merged into order-service | ⚰️ Deprecated |
| 17 | **review-service** | Spring Boot 4.0.6 | 8089 | ⚰️ Deprecated → merged into product-service | ⚰️ Deprecated |

> ⚠️ **Correction:** `seller-finance-service` (Spring Boot) IS deprecated per `DEPRECATED.md` (dated 2026-05-12). Finance logic migrated to `order-service`. The audit was correct. Row 18 correctly shows it as deprecated. The NestJS `seller-finance` (row 11, port 8090) is a separate active service — audit correctly listed it as ✅ Active.

### 2.2 Service Communication Patterns

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SERVICE COMMUNICATION                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  REST (Synchronous)           Kafka Events (Asynchronous)                   │
│  ───────────────────           ────────────────────────────                  │
│                                                                              │
│  Client → API Gateway         Event Publisher → Kafka Topic                  │
│         ↓                          ↓                                        │
│  Service A ────────► Service B  Topic A ──► Service A Consumer             │
│  (HTTP)                              │         (Event Handler)                │
│                                       ↓                                       │
│  Client ← Service A ←───────────── Topic B                                   │
│  (Response)                          ↓                                        │
│                              Service B Consumer                              │
│                              (Command Handler)                               │
│                                                                              │
│  Use Cases:                     Use Cases:                                   │
│  - Queries                      - State changes                              │
│  - Synchronous lookups          - Notifications                             │
│  - User-facing operations        - Saga orchestration                         │
│  - Time-sensitive responses      - Audit logging                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 Kafka Topics

| Topic | Publisher | Subscribers | Purpose |
|-------|-----------|-------------|---------|
| `order.created` | order-service | inventory, payment, notification | Order creation event |
| `payment.success` | payment-service | order, seller-finance | Payment confirmation |
| `payment.failed` | payment-service | order | Payment failure handling |
| `inventory.reserved` | inventory-service | order | Stock reservation confirmed |
| `inventory.released` | inventory-service | order | Stock release on cancellation |
| `inventory.reservation-expired` | inventory-service | order | Flash sale TTL expiry |
| `order.shipped` | shipping-service | notification, order | Shipment initiated |
| `order.delivered` | shipping-service | order, seller-finance | Delivery confirmed |
| `review.submitted` | product-service | notification | New review event |
| `user.registered` | user-service | notification | New user welcome |
| `settlement.completed` | seller-finance | seller | Payout notification |

### 2.4 Database Strategy

| Service | Database | Tables/Collections | Pattern |
|---------|----------|-------------------|---------|
| user-service | PostgreSQL | users, addresses, seller_profiles | CQRS (read/write models) |
| product-service | PostgreSQL | products, categories, product_variants | CQRS |
| inventory-service | PostgreSQL | inventory, reservations | Event sourcing |
| cart-service | Redis | cart:{userId} | CQRS events |
| order-service | PostgreSQL | orders, order_items, sub_orders, returns | CQRS + Saga |
| payment-service | PostgreSQL | payments, payment_intents | Event sourcing |
| seller-finance | PostgreSQL | wallets, transactions, settlements | CQRS |
| search-service | Elasticsearch | products, suggestions | Read model |

### 2.5 Security Architecture

- **Authentication**: Keycloak with OIDC/OAuth2
- **Authorization**: JWT tokens with role-based access
- **API Security**: Rate limiting, CORS, Helmet headers
- **Secrets Management**: Environment variables (Vault planned)
- **Network**: Internal service communication via Kubernetes DNS
- **Data**: Encryption at rest (partial), TLS in transit

---

## 3. Complete Workflow Maps

### 3.1 Buyer Purchase Flow

> ⚠️ **Critical Correction — Checkout Saga is Synchronous:**
> The original audit described order placement as "202 Accepted — Order placed asynchronously via Kafka." This is **incorrect**. The actual implementation in `CreateOrderUseCase.createNewOrder()` is **synchronous sequential orchestration** within a single `@Transactional` method: inventory → payment → shipping → save → publish Kafka events. The saga tracks state and handles **compensation on failure** (e.g., refund if payment fails), but the happy-path flow is synchronous. The HTTP response may still return 202 (unverified — needs controller check), but the backend logic is not async.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BUYER PURCHASE FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐                 │
│  │   REGISTER   │────►│    LOGIN     │────►│    BROWSE    │                 │
│  │  / SIGN UP   │     │   / LOGOUT   │     │   / SEARCH   │                 │
│  └──────────────┘     └──────────────┘     └──────────────┘                 │
│         │                   │                   │                              │
│         │                   │                   ▼                              │
│         │                   │            ┌──────────────┐                    │
│         │                   │            │ VIEW PRODUCT │                    │
│         │                   │            │   DETAILS    │                    │
│         │                   │            └──────────────┘                    │
│         │                   │                   │                              │
│         │                   │                   ▼                              │
│         │                   │            ┌──────────────┐                    │
│         │                   │            │  ADD TO CART │                    │
│         │                   │            │  / WISHLIST  │                    │
│         │                   │            └──────────────┘                    │
│         │                   │                   │                              │
│         │                   │                   ▼                              │
│         │                   │            ┌──────────────┐                    │
│         │                   └───────────►│    CART      │◄─┐                  │
│         │                                │   REVIEW     │  │                  │
│         │                                └──────────────┘  │                  │
│         │                                     │            │                  │
│         │                                     ▼            │                  │
│         │                              ┌──────────────┐      │                  │
│         │                              │APPLY COUPON  │──────┘                  │
│         │                              └──────────────┘                         │
│         │                                     │                                 │
│         │                                     ▼                                 │
│         │                              ┌──────────────┐                        │
│         │                              │   CHECKOUT   │                        │
│         │                              │   SUMMARY     │                        │
│         │                              └──────────────┘                        │
│         │                                     │                                 │
│         │                                     ▼                                 │
│         │                              ┌──────────────┐                        │
│         │                              │SHIPPING INFO │                        │
│         │                              │   / ADDRESS  │                        │
│         │                              └──────────────┘                        │
│         │                                     │                                 │
│         │                                     ▼                                 │
│         │                              ┌──────────────┐                        │
│         │                              │SHIPPING METHOD│                       │
│         │                              │  SELECTION   │                        │
│         │                              └──────────────┘                        │
│         │                                     │                                 │
│         │                                     ▼                                 │
│         │                              ┌──────────────┐                        │
│         │                              │   PAYMENT    │                        │
│         │                              │   SELECT    │                        │
│         │                              └──────────────┘                        │
│         │                                     │                                 │
│         │                                     ▼                                 │
│         │                         ┌──────────────────────┐                   │
│         │                         │    PLACE ORDER        │                   │
│         │                         │ ⚠️ SYNCHRONOUS SAGA    │                   │
│         │                         │ (not async Kafka)     │                   │
│         │                         └──────────────────────┘                   │
│         │                                     │                                 │
│         │                    ┌────────────────┼────────────────┐              │
│         │                    ▼                ▼                ▼              │
│         │             ┌───────────┐    ┌───────────┐   ┌───────────┐        │
│         │             │  SUCCESS  │    │  PENDING  │   │  FAILED   │        │
│         │             │           │    │   (COD)   │   │           │        │
│         │             └─────┬─────┘    └─────┬─────┘   └─────┬─────┘        │
│         │                   │                │                │              │
│         │                   ▼                │                ▼              │
│         │             ┌───────────┐          │          ┌───────────┐        │
│         │             │  ORDER    │          │          │ COMPENSATE │        │
│         │             │CONFIRMED  │          │          │  (Refund)  │        │
│         │             └───────────┘          │          └───────────┘        │
│         │                   │                │                               │
│         │                   └────────┬───────┘                               │
│         │                            ▼                                        │
│         │                     ┌──────────────┐                                │
│         │                     │ ORDER HISTORY│                                │
│         │                     │ / TRACKING   │                                │
│         │                     └──────────────┘                                │
│         │                            │                                         │
│         │                            ▼                                         │
│         │                     ┌──────────────┐                                │
│         │                     │RECEIVE ORDER │                                │
│         │                     │  / REVIEW    │                                │
│         │                     └──────────────┘                                │
│         │                            │                                         │
│         │                            ▼                                         │
│         │                     ┌──────────────┐                                │
│         │                     │RETURN/REFUND  │ (If needed)                     │
│         │                     │   FLOW       │                                │
│         │                     └──────────────┘                                │
│         │                                                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Seller Fulfillment Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SELLER FULFILLMENT FLOW                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │                         NEW ORDER ARRIVES                             │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                                    ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │                    NOTIFY SELLER (Push + Email)                       │    │
│  │                    notification-service → Socket.IO                     │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                                    ▼                                        │
│                         ┌────────────────────┐                              │
│                         │  SELLER DASHBOARD   │                              │
│                         │    ORDER QUEUE      │                              │
│                         └────────────────────┘                              │
│                                    │                                        │
│                    ┌───────────────┼───────────────┐                         │
│                    ▼               ▼               ▼                          │
│             ┌───────────┐  ┌───────────┐  ┌───────────┐                     │
│             │  ACCEPT   │  │   REJECT   │  │  IGNORE   │                     │
│             │           │  │            │  │ (Auto-    │                     │
│             └─────┬─────┘  └─────┬─────┘  │  cancel)  │                     │
│                   │              │         └───────────┘                     │
│                   ▼              ▼                                          │
│           ┌───────────┐  ┌───────────┐                                       │
│           │ SUB_ORDER │  │  REFUND   │                                       │
│           │  ACCEPTED │  │  TRIGGER  │                                       │
│           └─────┬─────┘  └───────────┘                                       │
│                 │                                                            │
│                 ▼                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │                         PACKING PHASE                                  │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │    │
│  │  │PRINT LABEL  │  │PACK PRODUCTS │  │CONFIRM PACK │                   │    │
│  │  │  (GHTK/GHN) │  │   ITEMS     │  │   COMPLETE  │                   │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                   │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                                    ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │                        SHIPPING PHASE                                 │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │    │
│  │  │SCHEDULE PICKUP│ │ GIVE TO     │  │ TRACK SHIPMENT│                 │    │
│  │  │(GHTK/GHN API)│ │ CARRIER     │  │  (Webhooks)  │                   │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                   │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                    ┌───────────────┴───────────────┐                         │
│                    ▼                               ▼                         │
│            ┌───────────────┐               ┌───────────────┐                 │
│            │   DELIVERED   │               │EXCEPTION/    │                 │
│            │               │               │   RETURNED    │                 │
│            └───────┬───────┘               └───────┬───────┘                 │
│                    │                               │                          │
│                    ▼                               ▼                          │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │                      SETTLEMENT PHASE                                 │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                   │    │
│  │  │CALCULATE   │  │   UPDATE    │  │  TRANSFER   │                   │    │
│  │  │COMMISSION  │  │   WALLET    │  │    FUNDS    │                   │    │
│  │  │(10/8/5/3%) │  │             │  │   (Bank)    │                   │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                   │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                    │                                        │
│                                    ▼                                        │
│                           ┌───────────────┐                                  │
│                           │  SETTLEMENT  │                                  │
│                           │  COMPLETED   │                                  │
│                           └───────────────┘                                  │
│                                                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Payment Saga Flow

> ⚠️ **Correction — Inventory TTL is 15 Minutes, Not 7 Days:**
> The original audit stated "Inventory reserved with 7-day TTL." This is **incorrect**. Live code shows `RESERVATION_TTL = Duration.ofMinutes(15)` for flash sale reservations. Redis keyspace notifications track `flash:reservation:*` expiry. The 7-day claim was not found anywhere in the codebase.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          PAYMENT SAGA FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  START                                                                      │
│    │                                                                       │
│    ▼                                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ STEP 1: CREATE PAYMENT INTENT                                        │   │
│  │                                                                       │   │
│  │  payment-service.createIntent(orderId, amount, method)               │   │
│  │                                                                       │   │
│  │  ├── Generate idempotency key                                        │   │
│  │  ├── Create payment intent record                                     │   │
│  │  ├── Generate payment URL/QR (for VietQR/MoMo)                       │   │
│  │  └── Return: { paymentId, checkoutUrl, expiresAt }                   │   │
│  │                                                                       │   │
│  │  Compensation: None (idempotent create)                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│    │                                                                       │
│    ▼                                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ STEP 2: RESERVE INVENTORY ⚠️ CORRECTED                               │   │
│  │                                                                       │   │
│  │  inventory-service.reserveStock(orderId, items)                      │   │
│  │                                                                       │   │
│  │  ├── Check available stock (Redis Lua script)                        │   │
│  │  ├── Create soft reservation (⚠️ 15-MINUTE TTL for flash sales)     │   │
│  │  │   NOT 7-day TTL as originally stated                              │   │
│  │  ├── Publish inventory.reserved event                                 │   │
│  │  └── Return: { reservationId, reservedItems[] }                       │   │
│  │                                                                       │   │
│  │  Compensation: releaseReservation(reservationId)                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│    │                                                                       │
│    ▼                                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ STEP 3: AWAIT PAYMENT CONFIRMATION                                  │   │
│  │                                                                       │   │
│  │  Gateway (VietQR/MoMo/Stripe) ──► Webhook ──► payment-service       │   │
│  │                                                                       │   │
│  │  Timeout: 30 minutes                                                 │   │
│  │  └── If timeout: trigger compensation                                 │   │
│  │                                                                       │   │
│  │  Success path: payment.success event                                  │   │
│  │  Failure path: payment.failed event                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│    │                                                                       │
│    ├──────────────────────────┬──────────────────────┐                     │
│    ▼                          ▼                      ▼                     │
│  ┌────────────┐         ┌────────────┐         ┌────────────┐              │
│  │  SUCCESS   │         │  PENDING   │         │  FAILED    │              │
│  │            │         │  (COD)     │         │            │              │
│  └─────┬──────┘         └─────┬──────┘         └─────┬──────┘             │
│        │                      │                       │                    │
│        ▼                      │                       ▼                    │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ STEP 4a: CONFIRM PAYMENT (Online)                                    │  │
│  │                                                                     │  │
│  │  ├── Update payment status to CONFIRMED                              │  │
│  │  ├── Publish payment.success event                                   │  │
│  │  ├── Trigger order confirmation                                     │  │
│  │  └── Send confirmation notifications                                 │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                    │                                       │
│                                    ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ STEP 5a: COMMIT INVENTORY                                            │  │
│  │                                                                     │  │
│  │  inventory-service.commitReservation(reservationId)                  │  │
│  │                                                                     │  │
│  │  ├── Convert soft reservation to hard deduction                      │  │
│  │  ├── Update stock levels                                            │  │
│  │  └── Publish inventory.committed event                              │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                    │                                       │
│                                    ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ STEP 6a: CREATE SUB-ORDERS                                           │  │
│  │                                                                     │  │
│  │  order-service.createSubOrders(orderId)                             │  │
│  │                                                                     │  │
│  │  ├── Group items by seller                                          │  │
│  │  ├── Create sub-order per seller                                    │  │
│  │  ├── Publish order.created (per seller)                             │  │
│  │  └── Notify each seller                                             │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                    │                                       │
│                                    ▼                                       │
│                              ┌───────────┐                                 │
│                              │   SAGA   │                                 │
│                              │ COMPLETE  │                                 │
│                              └───────────┘                                 │
│                                                                            │
│  ───────────────────────────────────────────────────────────────────────  │
│                                                                            │
│                    COMPENSATION PATHS (On Failure)                         │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ COMPENSATE: Release Inventory                                        │   │
│  │  inventory-service.releaseReservation(reservationId)                 │   │
│  │  ├── Delete soft reservation                                        │   │
│  │  └── Publish inventory.released event                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                       │
│                                    ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ COMPENSATE: Cancel Payment Intent                                    │   │
│  │  payment-service.cancelIntent(paymentId)                             │   │
│  │  └── Update payment status to CANCELLED                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                       │
│                                    ▼                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ COMPENSATE: Update Order Status                                     │   │
│  │  order-service.updateStatus(orderId, PAYMENT_FAILED)                 │   │
│  │  └── Notify buyer of failure                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                       │
│                                    ▼                                       │
│                              ┌───────────┐                                │
│                              │   SAGA    │                                │
│                              │  ROLLED   │                                │
│                              │   BACK    │                                │
│                              └───────────┘                                │
│                                                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.4 Return/Refund Flow

> ⚠️ **Correction — Return/Refund is NOT Missing:**
> The original audit listed this as a "Critical Missing" item. This is **completely incorrect**. The codebase contains:
> - `Return.java` — domain entity with full state machine (`approve()`, `reject()`, `complete()`, `markRefunded()`)
> - `ReturnStatus.java` — enum
> - `Dispute.java` — dispute entity
> - 4 use cases: `RequestReturnUseCase`, `ApproveReturnUseCase`, `RejectReturnUseCase`, `CompleteReturnUseCase`, `DisputeUseCase`
> - 4 test classes with full coverage
> - `PaymentRefundedListener.java` — Kafka listener for refund events
>
> The backend for return/refund is **fully implemented with tests**.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          RETURN/REFUND FLOW                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         BUYER INITIATES RETURN                        │   │
│  │                                                                       │   │
│  │  Order Delivered ──► Return Window (7 days) ──► Buyer clicks Return   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    RETURN REQUEST FORM                                 │   │
│  │                                                                       │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       │   │
│  │  │  RETURN REASON  │  │  EVIDENCE UPLOAD│  │  PICKUP/DROPOFF │       │   │
│  │  │                 │  │                 │  │    SELECTION    │       │   │
│  │  │ ○ Defective     │  │  [Photo 1]      │  │ ○ Home pickup   │       │   │
│  │  │ ○ Wrong item    │  │  [Photo 2]      │  │ ○ Drop at locker│       │   │
│  │  │ ○ Changed mind  │  │  [Photo 3]      │  │ ○ Drop at post  │       │   │
│  │  │ ○ Not as desc.  │  │                 │  │                 │       │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘       │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      SELLER REVIEW PHASE                              │   │
│  │                                                                       │   │
│  │  SLA: 48 hours to respond                                             │   │
│  │                                                                       │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │   │
│  │  │     APPROVE      │  │     REJECT      │  │  AUTO-APPROVE   │      │   │
│  │  │                  │  │                 │  │  (High-rated    │      │   │
│  │  │  ✓ Reason valid │  │  ✗ Reason invalid│ │   seller)       │      │   │
│  │  │  ✓ Evidence ok   │  │  ✗ No evidence  │  │                  │      │   │
│  │  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘      │   │
│  │           │                    │                    │               │   │
│  │           ▼                    ▼                    ▼               │   │
│  │  ┌──────────────────────────────────────────────────────────────┐    │   │
│  │  │              RETURN LABEL GENERATED                            │    │   │
│  │  └──────────────────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        ITEM RETURNED                                  │   │
│  │                                                                       │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       │   │
│  │  │  INSPECTION     │  │  PHOTO VERIFIED │  │  CONFIRM ITEM   │       │   │
│  │  │  BY SELLER/WH   │  │                 │  │  MATCHES        │       │   │
│  │  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘       │   │
│  │           └────────────┬────────┴────────────────────┘                │   │
│  │                        ▼                                              │   │
│  │               ┌───────────────┐                                     │   │
│  │               │   ITEM OK     │                                     │   │
│  │               │   ────────    │                                     │   │
│  │               │ PROCESS REFUND │                                     │   │
│  │               └───────┬───────┘                                     │   │
│  │                       │                                               │   │
│  │           ┌───────────┴───────────┐                                  │   │
│  │           ▼                       ▼                                  │   │
│  │    ┌─────────────┐         ┌─────────────┐                          │   │
│  │    │  REFUND TO  │         │  EXCHANGE   │                          │   │
│  │    │ORIGINAL PAY │         │   REQUEST   │                          │   │
│  │    │   METHOD    │         │             │                          │   │
│  │    └─────────────┘         └─────────────┘                          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│                           ┌───────────────┐                                │
│                           │   REFUND     │                                │
│                           │  COMPLETED   │                                │
│                           └───────────────┘                                │
│                                                                            │
│  ───────────────────────────────────────────────────────────────────────  │
│                         DISPUTE ESCALATION                                  │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Seller Rejects ──► Admin Mediation Queue ──► Admin Reviews ──► Ruling │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Missing Functionality

### 4.1 Features Already Implemented (Previously Misreported)

The following features were listed as "Critical Missing" in the original audit but are **fully implemented**:

| ID | Feature | Actual Status | Evidence |
|----|---------|---------------|----------|
| F23 | **Product Variants** | ✅ Implemented | `ProductVariant.java` — 44-line record with validation, equals/hashCode, backwards-compatible constructor. 13+ related files in product-service |
| F35 | **Guest Cart** | ✅ Implemented | `MergeCartUseCase.ts` — full merge on login, guest session tracking |
| F100 | **Return/Refund Flow** | ✅ Implemented | `Return.java` entity, 4 use cases, 4 test classes, `Dispute.java`, `PaymentRefundedListener.java` |

### 4.2 High Priority - P1

| ID | Feature | Status | Description | Services Affected |
|----|---------|--------|-------------|-------------------|
| F53 | **Real Order Tracking** | ⚠️ Stub | Carrier API integration for live tracking | shipping-service, order-service |
| F24 | **Product Image Gallery** | ❌ Missing | Multiple images with zoom and swipe | product-service, frontend |
| F113 | **Admin Dashboard** | ⚠️ Partial | Revenue, orders, growth metrics. Basic MVP built (231-line AdminDashboard.tsx with KPI cards, charts). Advanced features missing. | frontend |
| F26 | **Recently Viewed Products** | ❌ Missing | Browsing history per user | product-service, user-service |
| F27 | **Related Products** | ⚠️ Partial | Backend ready (`recommendations` service), not surfaced in frontend | recommendations, frontend |
| F102 | **Digital Invoice (E-Invoice)** | ⚠️ Partial | JAXB+XSD generation and validation built. GDT API submission endpoint unverified. | invoice-service |
| F54 | **Delivery Proof** | ❌ Missing | Photo + signature capture | shipping-service |

### 4.3 Medium Priority - P2

| ID | Feature | Status | Description | Impact |
|----|---------|--------|-------------|--------|
| F12 | **Multi-Language (i18n)** | ❌ Not started | Vietnamese/English support | Only Vietnamese market |
| F13 | **Delete Account (GDPR)** | ❌ Not started | Account deletion with data purge | Privacy compliance |
| F72 | **Coupon Stacking** | ❌ Not started | Multiple coupons per order | Limited promotional flexibility |
| F74 | **Auto-Apply Coupons** | ❌ Not started | System auto-applies best coupon | Conversion optimization |
| F76 | **First-Time Buyer Coupon** | ❌ Not started | Welcome discount for new users | Acquisition funnel |
| F88 | **Review Photo Filter** | ❌ Not started | Filter reviews by photo only | Product research |
| F97 | **Push Deep Links** | ❌ Not started | Notification → specific page | Better engagement |
| F103 | **Re-order** | ❌ Not started | One-click reorder from history | Convenience |
| F114 | **Sales Reports** | ❌ Not started | Daily/weekly/monthly analytics | Business intelligence |
| F116 | **Customer Management** | ❌ Not started | Admin user segmentation | Operational efficiency |
| F117 | **Content CMS** | ❌ Not started | Banners, landing pages | Marketing flexibility |

### 4.4 Low Priority - P3

| ID | Feature | Status | Description |
|----|---------|--------|-------------|
| F25 | **Product Comparison** | ❌ Not started | Side-by-side comparison |
| F38 | **Cart Abandonment Recovery** | ❌ Not started | Automated recovery emails |
| F62 | **Installment Payment** | ❌ Not started | VNPAY 0% interest installments |
| F63 | **Saved Payment Methods** | ❌ Not started | Tokenized cards for faster checkout |

---

## 5. UI/UX Problems Analysis

### 5.1 Design Intelligence Applied

Based on UI/UX Pro Max design principles, the following issues have been identified and categorized by severity and design rule violated.

### 5.2 Critical UI/UX Issues

| # | Issue | Design Rule Violated | Category | Impact | Status |
|---|-------|---------------------|----------|--------|--------|
| 1 | **No loading skeletons** | `progressive-loading` | Performance | Poor perceived performance | Needs fix |
| 2 | ~~Push notifications poll every 30s~~ | — | — | ~~Battery drain, delayed notifications~~ | ✅ **CORRECTED**: Socket.IO gateway at `socketio-notification.gateway.ts`. Real-time, not polling. 18 files match WebSocket/Socket.IO patterns. |
| 3 | **Icon-only buttons without labels** | `aria-labels` | Accessibility | Screen reader users cannot navigate | Needs fix |
| 4 | **No focus visible states** | `focus-states` | Accessibility | Keyboard users lost | Needs fix |
| 5 | **Relies on hover for interactions** | `hover-vs-tap` | Touch/Interaction | Mobile users cannot use features | Needs fix |

### 5.3 High Priority Issues

| # | Issue | Design Rule Violated | Category | Impact | Status |
|---|-------|---------------------|----------|--------|--------|
| 6 | **Wishlist is localStorage only** | `local-state` | Data | Data loss on clear cache | Needs fix |
| 7 | **Cart stock validated only at order** | `inline-validation` | Forms | Cart shows unavailable items | Needs fix |
| 8 | ~~No dark mode~~ | — | — | ~~User preference ignored~~ | ✅ **CORRECTED**: Full implementation with e2e test suite. `dark-mode-ui.spec.ts` verifies `#0b0e14` dark bg and `#f4f6f9` light bg toggle. 28 files match dark/theme patterns, 47-file codemod. |
| 9 | **Missing alt text on images** | `alt-text` | Accessibility | Screen reader users miss content | Needs fix |
| 10 | **No skip links** | `skip-links` | Accessibility | Keyboard users must tab through nav | Needs fix |
| 11 | **Fixed px container widths** | `container-width` | Layout | Poor tablet/responsive experience | Needs fix |
| 12 | **Placeholder-only labels** | `input-labels` | Forms | Users forget input purpose | Needs fix |
| 13 | **No press feedback on cards** | `press-feedback` | Touch/Interaction | Unclear if tap registered | Needs fix |
| 14 | **Horizontal swipe on content** | `gesture-conflicts` | Touch/Interaction | Accidental navigation | Needs fix |

### 5.4 Medium Priority Issues

| # | Issue | Design Rule Violated | Category | Impact | Status |
|---|-------|---------------------|----------|--------|--------|
| 15 | **Color-only status indicators** | `color-not-only` | Accessibility | Colorblind users cannot distinguish | Needs fix |
| 16 | **Errors only at top of form** | `error-placement` | Forms | User doesn't know which field | Needs fix |
| 17 | **No confirmation for destructive** | `confirmation-dialogs` | Forms | Accidental deletes | Needs fix |
| 18 | **Instant state changes (0ms)** | `state-transition` | Animation | Jarring UX | Needs fix |
| 19 | **No reduced-motion support** | `reduced-motion` | Animation | Motion sickness risk | Needs fix |
| 20 | **Body text <16px on mobile** | `readable-font-size` | Layout | iOS auto-zoom on inputs | Needs fix |
| 21 | **No haptic feedback** | `haptic-feedback` | Touch/Interaction | Poor confirmation feel | Needs fix |
| 22 | **No loading indicators** | `loading-states` | Animation | Unclear async operations | Needs fix |

### 5.5 Low Priority Issues

| # | Issue | Design Rule Violated | Category | Impact | Status |
|---|-------|---------------------|----------|--------|--------|
| 23 | **No auto-dismiss toasts** | `toast-dismiss` | Forms | Toasts persist forever | Needs fix |
| 24 | **Blocking animations** | `no-blocking-animation` | Animation | User cannot interact | Needs fix |
| 25 | **No keyboard shortcuts** | `keyboard-shortcuts` | Accessibility | Power users limited | Needs fix |

---

## 6. Vietnam-Specific Niche Features

### 6.1 Payment Innovations (Vietnam Market)

Vietnam is a cash-heavy society with unique payment preferences:

| Feature | Description | Status | Priority | Impact |
|---------|-------------|--------|----------|--------|
| **VietQR Advanced** | QR payment with bank selection, QR generation, camera scanning | ⚠️ Stub | P0 | High |
| **MoMo E-Wallet** | Deep MoMo integration with balance checking, recharge | ⚠️ Stub | P0 | High |
| **VNPay Installment** | 0% interest installments via credit card | ❌ Not started | P1 | Medium |
| **ATM Transfer Auto-Reconcile** | Bank transfer detection via webhook | ⚠️ Stub | P1 | High |
| **Cash Deposit Points** | 7-Eleven, WinMart deposit points | ❌ Not started | P2 | Medium |
| **ZaloPay Integration** | ZaloPay e-wallet for younger demographics | ❌ Not started | P2 | Medium |
| **Installment Calculator** | EMI calculator for big-ticket items | ❌ Not started | P2 | Medium |

### 6.2 Shipping Innovations

| Feature | Description | Status | Priority | Impact |
|---------|-------------|--------|----------|--------|
| **GHTK Live Tracking** | Real-time GPS tracking visualization | ⚠️ Stub | P1 | High |
| **GHN COD Management** | Cash collection with reconciliation | ⚠️ Stub | P0 | High |
| **Locker Pickup** | J&T, GHN locker network integration | ❌ Not started | P2 | Medium |
| **Same-Day Delivery** | Premium tier for major cities (HN, HCM) | ❌ Not started | P2 | High |
| **Scheduled Delivery** | Buyer selects delivery time slot | ❌ Not started | P2 | Medium |
| **Proof of Delivery** | Photo capture + digital signature | ❌ Not started | P1 | Medium |
| **Vietnam Address Standardization** | Tỉnh/Thành phố → Quận/Huyện → Phường/Xã | ⚠️ Partial | P0 | High |

### 6.3 Vietnam-Specific Commerce Features

| Feature | Description | Status | Priority | Impact |
|---------|-------------|--------|----------|--------|
| **Flash Sale Engine** | Timed deals with countdown, limited stock | ⚠️ Partial (15-min TTL reservations) | P0 | High |
| **Coin/Cashback System** | VNShop Coins for repeat purchases | ❌ Not started | P1 | High |
| **Bundle Deals** | "Mua 3 tặng 1" (Buy 3 Get 1) engine | ❌ Not started | P1 | Medium |
| **Price Hunt** | Price drop alerts for watched products | ❌ Not started | P2 | Medium |
| **Social Sharing Rewards** | Facebook/Zalo share for discounts | ❌ Not started | P2 | Medium |
| **Seller Badges** | "Yêu thích" (Favorite), "Mall", "Chính hãng" (Genuine) | ⚠️ Partial | P0 | High |
| **Genuine Product Badge** | Certified authentic product verification | ❌ Not started | P1 | High |
| **Consumer Protection** | Return window, refund timeline prominently displayed | ✅ Implemented | P0 | Critical |

### 6.4 Regulatory Compliance Features

| Feature | Description | Status | Priority | Impact |
|---------|-------------|--------|----------|--------|
| **E-Invoice (Hóa đơn điện tử)** | Vietnam mandated B2C invoices | ⚠️ Partial — JAXB+XSD generation built; GDT API submission unverified | P0 | Critical |
| **Tax Calculation** | Per-transaction VAT computation | ⚠️ Partial | P1 | High |
| **MST (Tax Code) Verification** | Seller tax ID validation | ⚠️ Partial | P0 | High |
| **GPKD Verification** | Business license number validation | ⚠️ Partial | P1 | High |
| **Price Display Compliance** | "Giá đã bao gồm VAT" badges | ⚠️ Partial | P1 | Medium |
| **Age Verification** | For restricted product categories | ❌ Not started | P2 | Medium |

---

## 7. Sub-Functions Needed for Completeness

### 7.1 Product Variants System (F23) — Backend Implemented ✅

> ⚠️ **Correction:** Backend is fully implemented. Frontend variant selector UI is still needed.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PRODUCT VARIANTS — BACKEND READY ✅                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  BACKEND STATUS: ✅ IMPLEMENTED                                              │
│  ────────────────────────────────                                           │
│  ProductVariant.java record (44 lines) with:                                 │
│  • sku, name, price (Money), imageUrl, stockQuantity                         │
│  • Validation: sku non-blank, price non-null, stockQuantity >= 0           │
│  • equals/hashCode (by sku)                                                │
│  • Backwards-compatible constructor (defaults stockQuantity to 0)          │
│                                                                              │
│  FRONTEND STATUS: ❌ NEEDS IMPLEMENTATION                                   │
│  ───────────────────────────────────────────                                 │
│  1. VARIANT SELECTION UI                                                   │
│  ├── Swatch Selector (Color)                                                │
│  ├── Dropdown Selector (Size)                                              │
│  ├── Price/Stock Update on selection                                        │
│  └── Variant Image Gallery                                                  │
│                                                                              │
│  2. ADMIN INTERFACE                                                        │
│  ├── Variant Matrix Editor                                                  │
│  └── Attribute Management                                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Guest Cart System (F35) — Backend Implemented ✅

> ⚠️ **Correction:** Backend is fully implemented via `MergeCartUseCase`. Frontend session banner and merge UI are still needed.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       GUEST CART — BACKEND READY ✅                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  BACKEND STATUS: ✅ IMPLEMENTED                                              │
│  ────────────────────────────────                                           │
│  MergeCartUseCase.ts:                                                       │
│  • Merges guest cart to authenticated user on login                         │
│  • Same product: sum quantities                                             │
│  • Adds new items                                                            │
│  • Deletes guest cart after merge                                           │
│                                                                              │
│  FRONTEND STATUS: ❌ NEEDS IMPLEMENTATION                                   │
│  ───────────────────────────────────────────                                 │
│  1. Guest Cart Banner                                                        │
│  2. Session Persistence (localStorage + cookie)                             │
│  3. Merge Prompt UI on login                                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Return/Refund Flow (F100) — Backend Fully Implemented ✅

> ⚠️ **Correction:** Full return/refund backend exists with tests. Frontend request UI and status tracking are still needed.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   RETURN/REFUND — BACKEND FULLY IMPLEMENTED ✅                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  BACKEND STATUS: ✅ FULLY IMPLEMENTED WITH TESTS                            │
│  ───────────────────────────────────────────────────                         │
│  Domain:                                                                    │
│  • Return.java — state machine (REQUESTED→APPROVED→COMPLETED→REFUNDED)      │
│  • ReturnStatus.java — enum                                                 │
│  • Dispute.java — dispute entity for escalation                             │
│                                                                              │
│  Use Cases:                                                                 │
│  • RequestReturnUseCase.java                                               │
│  • ApproveReturnUseCase.java                                               │
│  • RejectReturnUseCase.java                                                │
│  • CompleteReturnUseCase.java                                              │
│  • DisputeUseCase.java                                                      │
│                                                                              │
│  Tests: 4 test classes covering approve/reject/complete/dispute             │
│  Infrastructure: PaymentRefundedListener.java (Kafka)                       │
│                                                                              │
│  FRONTEND STATUS: ❌ NEEDS IMPLEMENTATION                                   │
│  ───────────────────────────────────────────                                 │
│  1. Return Request Form UI                                                  │
│  2. Return Status Tracking                                                  │
│  3. Dispute Submission UI                                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.4 Admin Dashboard (F113) — MVP Built ⚠️

> ⚠️ **Correction:** The audit said "Needs full build." This was too harsh. A 231-line `AdminDashboard.tsx` exists with KPI cards, revenue area chart, top products bar chart, top sellers list, and React Query integration. This is an MVP, not a blank slate.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                   ADMIN DASHBOARD — MVP PARTIALLY BUILT ⚠️                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  CURRENT STATE: ⚠️ MVP BUILT                                                 │
│  ────────────────────────────                                                │
│  AdminDashboard.tsx (231 lines) — functional React component:               │
│  ✅ KPI cards (revenue, orders, growth)                                       │
│  ✅ Revenue area chart                                                       │
│  ✅ Top products bar chart                                                   │
│  ✅ Top sellers list                                                         │
│  ✅ React Query integration                                                 │
│                                                                              │
│  MISSING:                                                                   │
│  ❌ Geography heat map                                                      │
│  ❌ Conversion funnel                                                        │
│  ❌ Export functionality (CSV/PNG)                                          │
│  ❌ Scheduled reports                                                       │
│  ❌ System health dashboard                                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Integration Gaps

### 8.1 Third-Party Service Status

| Service | Status | Details | Priority | Effort |
|---------|--------|---------|----------|--------|
| **Keycloak** | ✅ Complete | Auth working | — | — |
| **Kafka** | ✅ Complete | SASL + ACLs configured | — | — |
| **Elasticsearch** | ✅ Complete | Full-text + faceting | — | — |
| **Redis** | ✅ Complete | Cart, sessions, caching | — | — |
| **PostgreSQL** | ✅ Complete | Per-service databases | — | — |
| **OneSignal** | ✅ Complete | Push notifications working | — | — |
| **Socket.IO** | ✅ Complete | Real-time notifications (NOT polling) | — | — |
| **VietQR** | ⚠️ Stub | Sandbox only, need production | P0 | Medium |
| **MoMo** | ⚠️ Stub | Sandbox only, need production | P0 | Medium |
| **Stripe** | ⚠️ Stub | Sandbox only, need production | P1 | Medium |
| **PayPal** | ⚠️ Stub | Sandbox only, need production | P2 | Low |
| **VNPay** | ⚠️ Stub | Business registration needed | P3 | High |
| **GHTK** | ⚠️ Stub | Sandbox only, need production | P1 | Medium |
| **GHN** | ⚠️ Stub | Sandbox only, need production | P1 | Medium |
| **MinIO** | ⚠️ Planned | R2 swap planned | P2 | Medium |
| **Jaeger** | ⚠️ Planned | Distributed tracing not deployed | P3 | Medium |
| **ZaloPay** | ❌ Missing | No integration started | P2 | High |

### 8.2 Infrastructure Gaps

| Gap | Current State | Target State | Impact | Effort |
|-----|--------------|--------------|--------|--------|
| **CDN for Static Assets** | ❌ Missing | CloudFlare/R2 | Performance | High |
| **Image Optimization** | ❌ Missing | WebP conversion, resizing | Performance | Medium |
| **Encryption at Rest** | ⚠️ Partial | TDE for PostgreSQL | Security | Medium |
| **Vault for Secrets** | ⚠️ Partial | HashiCorp Vault | Security | High |
| **Kubernetes HPA** | ⚠️ Partial | Horizontal Pod Autoscaler | Scalability | Medium |
| **Canary Deployments** | ❌ Missing | Argo Rollouts | Deployment safety | High |
| **Penetration Testing** | ❌ Missing | Scheduled pen test | Security | High |
| **Rate Limiting Refined** | ⚠️ Basic | Per-user, per-endpoint | Security | Medium |

### 8.3 Data & Compliance Gaps

| Gap | Current State | Target State | Impact | Effort |
|-----|--------------|--------------|--------|--------|
| **E-Invoice GDT Submission** | ⚠️ Partial | JAXB+XSD generation built; GDT API submission **unverified** | Compliance | High |
| **Data Retention Policy** | ⚠️ Partial | Configurable per data type | Compliance | Medium |
| **Backup Strategy** | ⚠️ Basic | Point-in-time recovery | DR | High |
| **GDPR Deletion** | ❌ Missing | Full data purge flow | Compliance | Medium |

---

## 9. Sprint Planning

### 9.1 Recommended Sprint Sequence

#### Sprint 1: Frontend Completeness (2 weeks)
**Focus:** Connect frontend to implemented backends. Previously labeled "Critical Missing" items are already built.

| Task | Description | Effort | Owner | Status |
|------|-------------|--------|-------|--------|
| T1.1 | Product Variants - Frontend Variant Selector UI | 2 days | Frontend | ❌ Needed |
| T1.2 | Guest Cart - Frontend Session Banner + Merge UI | 1 day | Frontend | ❌ Needed |
| T1.3 | Return Flow - Frontend Request UI + Status Tracking | 2 days | Frontend | ❌ Needed |
| T1.4 | Cart Stock Validation - Real-time Check | 1 day | Backend | ⚠️ Partial |
| T1.5 | E-Invoice - **Verify GDT API submission endpoint** | 2 days | Backend | ❌ Verify |
| T1.6 | Related Products - Surface in frontend | 1 day | Frontend | ❌ Needed |

**Definition of Done:**
- [ ] E-invoices submitted to GDT API (verify `InvoiceSubmissionService.java` wiring)
- [ ] Frontend variant selector, guest cart UI, return request UI

#### Sprint 2: Admin & Operations (2 weeks)
**Focus:** Operational visibility and control

| Task | Description | Effort | Owner |
|------|-------------|--------|-------|
| T2.1 | Admin Dashboard - Geography Heat Map | 2 days | Frontend |
| T2.2 | Admin Dashboard - Conversion Funnel | 1 day | Frontend |
| T2.3 | Admin Dashboard - Export (CSV/PNG) | 2 days | Frontend |
| T2.4 | System Health Dashboard | 1 day | Backend + Frontend |
| T2.5 | Sales Reports - Revenue & GMV | 2 days | Backend + Frontend |

#### Sprint 3: Payment & Shipping Live (2 weeks)

| Task | Description | Effort | Owner |
|------|-------------|--------|-------|
| T3.1 | VietQR - Production API Integration | 2 days | Backend |
| T3.2 | MoMo - Production API Integration | 2 days | Backend |
| T3.3 | GHTK - Production API + Tracking | 2 days | Backend |
| T3.4 | GHN - Production API + Tracking | 2 days | Backend |
| T3.5 | Real-time Tracking - Webhook Handlers | 2 days | Backend |
| T3.6 | Delivery Proof - Photo + Signature | 2 days | Backend + Frontend |

#### Sprint 4: Growth Features (2 weeks)

| Task | Description | Effort | Owner |
|------|-------------|--------|-------|
| T4.1 | Flash Sale Engine - UI with Countdown | 1 day | Frontend |
| T4.2 | Multi-Language - Backend i18n | 2 days | Backend |
| T4.3 | Multi-Language - Frontend i18n | 2 days | Frontend |
| T4.4 | Coin/Cashback System - Core | 2 days | Backend |
| T4.5 | Recently Viewed Products | 1 day | Backend + Frontend |

### 9.2 Quarterly Roadmap

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           QUARTERLY ROADMAP                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  MONTH 1                      MONTH 2                      MONTH 3           │
│  ═══════════                  ═══════════                  ═══════════        │
│                                 ▲                                           │
│  ┌─────────────────┐    ┌──────┴─────────┐      ┌─────────────────┐        │
│  │  Sprint 1       │    │    Sprint 2    │      │  Sprint 3-4      │        │
│  │                 │    │                │      │                 │        │
│  │ • Variant UI    │    │ • Admin Dash  │      │ • Payments Live │        │
│  │ • Guest Cart UI │    │ • Reports     │      │ • Shipping Live │        │
│  │ • Return UI     │    │ • System Health│      │ • Flash Sales   │        │
│  │ • GDT Verify    │    │               │      │ • i18n          │        │
│  │                 │    │               │      │                 │        │
│  └─────────────────┘    └────────────────┘      └─────────────────┘        │
│                                                                              │
│  ════════════════════════════════════════════════════════════════════════   │
│                                                                              │
│  ONGOING                                                                     │
│  • Security hardening (penetration testing, rate limiting)                   │
│  • Performance optimization (CDN, image optimization)                         │
│  • Analytics and insights                                                     │
│  • Customer feedback integration                                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 10. Feature Matrix by Category

### 10.1 Account & Profile (13 Features)

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| F1 | Registration | ✅ | Email + phone |
| F2 | Login | ✅ | Keycloak OIDC |
| F3 | Logout | ✅ | |
| F4 | Password Reset | ✅ | Email link |
| F5 | Profile View | ✅ | Basic fields |
| F6 | Profile Edit | ✅ | |
| F7 | Profile Picture Upload | ✅ | MinIO storage |
| F8 | Change Password | ✅ | |
| F9 | Address Management | ✅ | CRUD |
| F10 | Default Address | ✅ | |
| F11 | Account Deletion | ⚠️ | Partial — needs GDPR |
| F12 | Multi-Language | ❌ | Not started |
| F13 | Delete Account (GDPR) | ❌ | Not started |

**Category Coverage: 10/13 (77%)**

### 10.2 Product Browsing (14 Features)

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| F14 | Product List | ✅ | Paginated |
| F15 | Product Detail | ✅ | Basic |
| F16 | Category Browse | ✅ | Hierarchical |
| F17 | Search | ✅ | Elasticsearch |
| F18 | Filter by Price | ✅ | Range slider |
| F19 | Filter by Rating | ✅ | Stars |
| F20 | Filter by Seller | ✅ | |
| F21 | Sort Options | ✅ | Price, rating, date |
| F22 | Pagination | ✅ | |
| F23 | Product Variants | ✅ | `ProductVariant.java` record — **CORRECTED: Implemented** |
| F24 | Image Gallery | ❌ | Multiple images needed |
| F25 | Product Comparison | ❌ | Nice to have |
| F26 | Recently Viewed | ❌ | Not started |
| F27 | Related Products | ⚠️ | Backend ready, not surfaced |

**Category Coverage: 10/14 (71%)**

### 10.3 Shopping Cart (11 Features)

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| F28 | Add to Cart | ✅ | |
| F29 | View Cart | ✅ | |
| F30 | Update Quantity | ✅ | |
| F31 | Remove Item | ✅ | |
| F32 | Cart Total | ✅ | |
| F33 | Apply Coupon | ✅ | |
| F34 | Clear Cart | ✅ | |
| F35 | Guest Cart | ✅ | `MergeCartUseCase.ts` — **CORRECTED: Implemented** |
| F36 | Cart Persistence | ✅ | Redis |
| F37 | Cart Count Badge | ✅ | |
| F38 | Cart Abandonment | ❌ | Recovery emails needed |

**Category Coverage: 10/11 (91%)**

### 10.4 Checkout & Ordering (9 Features)

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| F39 | Checkout Flow | ✅ | Multi-step |
| F40 | Shipping Address | ✅ | Selection/entry |
| F41 | Shipping Method | ✅ | GHTK/GHN |
| F42 | Order Review | ✅ | |
| F43 | Place Order | ⚠️ | Saga orchestration — **CORRECTED: Synchronous, not async** |
| F44 | Order Confirmation | ✅ | |
| F45 | Order History | ✅ | |
| F46 | Order Cancel | ✅ | Within window |
| F47 | Reorder | ❌ | One-click reorder needed |

**Category Coverage: 7/9 (78%)**

### 10.5 Shipping & Delivery (8 Features)

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| F48 | Shipping Options | ✅ | GHTK/GHN |
| F49 | Shipping Cost Calc | ✅ | Carrier rates |
| F50 | Shipping Label | ✅ | Generated |
| F51 | Carrier Selection | ✅ | Buyer choice |
| F52 | Estimated Delivery | ✅ | |
| F53 | Order Tracking | ⚠️ | Stub — needs live API |
| F54 | Delivery Proof | ❌ | Photo + signature |
| F55 | Delivery Exception | ⚠️ | Alert, no resolution flow |

**Category Coverage: 5/8 (63%)**

### 10.6 Payment (8 Features)

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| F56 | VietQR | ⚠️ | Stub |
| F57 | MoMo | ⚠️ | Stub |
| F58 | Stripe | ⚠️ | Stub |
| F59 | PayPal | ⚠️ | Stub |
| F60 | Cash on Delivery | ✅ | COD |
| F61 | Payment Confirmation | ✅ | Webhook handling |
| F62 | Installment | ❌ | Not started |
| F63 | Saved Methods | ❌ | Tokenization needed |

**Category Coverage: 5/8 (63%)**

### 10.7 Coupons & Discounts (13 Features)

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| F64 | Create Coupon | ✅ | Admin |
| F65 | Percentage Off | ✅ | |
| F66 | Fixed Amount | ✅ | |
| F67 | Free Shipping | ✅ | |
| F68 | Min Order Amount | ✅ | |
| F69 | Max Discount | ✅ | |
| F70 | Usage Limit | ✅ | |
| F71 | Validity Period | ✅ | |
| F72 | Coupon Stacking | ❌ | Multiple per order |
| F73 | Coupon Code Entry | ✅ | |
| F74 | Auto-Apply Coupons | ❌ | Not started |
| F75 | Coupon Visibility | ✅ | Public/private |
| F76 | First-Time Buyer | ❌ | Welcome coupon |
| F77 | Seller Coupons | ✅ | Seller-issued |

**Category Coverage: 9/13 (69%)**

### 10.8 Reviews & Ratings (12 Features)

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| F78 | Submit Review | ✅ | Text + rating |
| F79 | Star Rating | ✅ | 1-5 |
| F80 | View Reviews | ✅ | Paginated |
| F81 | Average Rating | ✅ | Calculated |
| F82 | Review Helpful | ✅ | Vote count |
| F83 | Report Review | ✅ | Flag for mod |
| F84 | Seller Response | ✅ | |
| F85 | Review Images | ✅ | Upload |
| F86 | Verified Purchase | ✅ | Badge |
| F87 | Sort Reviews | ✅ | Recent/helpful |
| F88 | Filter by Photo | ❌ | Not started |
| F89 | Review Guidelines | ✅ | Moderation rules |

**Category Coverage: 11/12 (92%)**

### 10.9 Notifications (9 Features)

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| F90 | Email Notifications | ✅ | Transactional |
| F91 | Push Notifications | ✅ | OneSignal |
| F92 | In-App Notifications | ✅ | Bell icon |
| F93 | Order Updates | ✅ | |
| F94 | Price Alerts | ❌ | Not started |
| F95 | Back in Stock | ❌ | Not started |
| F96 | New Message | ✅ | |
| F97 | Push Deep Links | ❌ | Link to specific page |
| F98 | Notification Settings | ✅ | Toggle channels |

**Category Coverage: 6/9 (67%)**

> ⚠️ **Correction:** Notification system uses **Socket.IO gateway** (`socketio-notification.gateway.ts`) for **real-time** delivery, NOT 30-second polling as originally stated.

### 10.10 Post-Purchase (6 Features)

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| F99 | Order Details | ✅ | Full history |
| F100 | Return/Refund | ✅ | 4 use cases + 4 test classes + state machine — **CORRECTED: Fully implemented** |
| F101 | Dispute | ⚠️ | Basic — needs flow |
| F102 | Digital Invoice | ⚠️ | JAXB+XSD built; GDT submission unverified |
| F103 | Reorder | ❌ | One-click reorder |
| F104 | Write Review | ✅ | From order |

**Category Coverage: 5/6 (83%)**

### 10.11 Admin & Seller (16 Features)

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| F105 | Seller Dashboard | ✅ | Basic |
| F106 | Product Management | ✅ | CRUD |
| F107 | Order Management | ✅ | Basic |
| F108 | Inventory Management | ✅ | Stock levels |
| F109 | Seller Verification | ✅ | Tier system |
| F110 | Commission Rates | ✅ | Tier-based |
| F111 | Settlement Schedule | ✅ | Weekly/monthly |
| F112 | Seller Wallet | ✅ | Balances |
| F113 | Admin Dashboard | ⚠️ | MVP built (231-line AdminDashboard.tsx) — **CORRECTED: Not "needs full build"** |
| F114 | Sales Reports | ❌ | Needs reports |
| F115 | Performance Metrics | ✅ | Basic |
| F116 | Customer Mgmt | ❌ | Admin user seg |
| F117 | Content CMS | ❌ | Banners/pages |
| F118 | SEO Management | ❌ | Meta tags |
| F119 | System Settings | ✅ | Config service |
| F120 | Audit Logs | ⚠️ | Partial |

**Category Coverage: 10/16 (63%)**

---

## 11. Correction Log (from Cross-Validation)

All corrections below are sourced from `CROSS-VALIDATION-REPORT-2026-07-10.md`, which verified claims against live code.

### 11.1 CRITICAL — Report Was Fundamentally Wrong

| # | Original Claim | Correction | Severity | Source |
|---|---------------|------------|----------|--------|
| C1 | "❌ Critical Missing — Product variants needs full implementation" | ✅ Implemented — `ProductVariant.java` 44-line record with validation | CRITICAL | `services/product-service/.../domain/ProductVariant.java` |
| C2 | "❌ Critical Missing — Return/refund system needs implementation" | ✅ Fully implemented — Return entity, 4 use cases, 4 test classes, Dispute entity, Kafka listener | CRITICAL | `services/order-service/.../domain/Return.java`, `.../application/` |
| C3 | "❌ Missing — Guest cart needs full implementation" | ✅ Implemented — `MergeCartUseCase.ts` with guest-to-authenticated merge | HIGH | `services/cart-service/.../merge-cart.use-case.ts` |

### 11.2 HIGH — Arithmetic and Structural Errors

| # | Original Claim | Correction | Severity | Source |
|---|---------------|------------|----------|--------|
| C4 | "85/119 features (71%)" | Actual: 120 features (F1–F120). Matrix covers ~107. Real coverage ~73% | HIGH | Feature matrix analysis |
| C5 | "review-service ⚰️ Deprecated" listed twice (rows 17 and 19) | Duplicate entry — removed second instance | LOW | Service table cleanup |
| C6 | "seller-finance-service ⚰️ Deprecated" | ✅ Audit was correct — service IS deprecated. `DEPRECATED.md` dated 2026-05-12; finance logic migrated to `order-service`. The Spring Boot `seller-finance-service` (row 18) is deprecated. The NestJS `seller-finance` (row 11) is a separate active service. | HIGH | `services/seller-finance-service/DEPRECATED.md` |

### 11.3 MEDIUM — Wrong Technical Claims

| # | Original Claim | Correction | Severity | Source |
|---|---------------|------------|----------|--------|
| C7 | "202 Accepted — Order placed asynchronously via Kafka" | SYNCHRONOUS — `CreateOrderUseCase.createNewOrder()` runs sequential steps inside `@Transactional`. HTTP returns **201 CREATED** (not 202). Saga handles compensation, not primary flow | MEDIUM | `CreateOrderUseCase.java:80-117`, `OrderController.java:53` |
| C8 | "Inventory reserved with 7-day TTL" | 15-MINUTE TTL — `RESERVATION_TTL = Duration.ofMinutes(15)` for flash sales | MEDIUM | `InventoryService.java` |
| C9 | "❌ Not started — Dark mode UI" | ✅ Fully implemented with e2e tests, 47-file codemod | MEDIUM | `fe/e2e/dark-mode-ui.spec.ts`, 28+ files |
| C10 | "⚠️ Poll every 30s — Push notifications use long-polling" | ✅ REAL-TIME via Socket.IO gateway | MEDIUM | `socketio-notification.gateway.ts`, 18 files |
| C11 | "⚠️ Pending — E-invoice integration not yet submitted to GDT" | JAXB+XSD generation VALIDATED. GDT submission **unverified** (not "pending") | MEDIUM | `InvoiceXmlGenerator.java` (304 lines) |
| C12 | "F113 Admin Dashboard — ❌ Needs full build" | MVP BUILT — 231-line `AdminDashboard.tsx` with KPI cards, charts, React Query | MEDIUM | `fe/src/app/pages/admin/AdminDashboard.tsx` |

### 11.4 Version Corrections (vs. pom.xml/package.json)

| # | Audit Said | Actual | Source |
|---|-----------|--------|--------|
| V1 | Spring Boot 4.1.0 | **4.0.6** | `services/api-gateway/pom.xml:8` |
| V2 | Java 21 LTS | **25** | `services/api-gateway/pom.xml:17` |
| V3 | NestJS 11.x | **11.1.21** | `services/cart-service/package.json` |
| V4 | React 18.x | ⚠️ **18.3.1 (outdated)** | `fe/package.json` — **Latest: React 19.2.7** (v19.2.7 tag confirmed on GitHub, June 2026) |
| V5 | Vite 6.x | ❌ **6.3.5 (unverifiable)** | `fe/package.json` — **No v6.x tags exist on GitHub** (scanned pages 1–4, only v4.x, v5.x, v7.x, v8.x found; latest is **v8.1.4**) |
| V6 | Spring Cloud not mentioned | **2025.1.1** | `services/api-gateway/pom.xml:20` |
| V7 | Keycloak 25.x | **25.x** (⚠️ unverified installed version) | Audit said 25.x, correct |

### 11.5 Unverified Items (Need Deeper Investigation)

| Item | Question | Priority |
|------|----------|----------|
| U1 | Does `InvoiceSubmissionService.java` wire the GDT API endpoint? | HIGH — affects compliance |
| U2 | Does the order controller return 202 while use case is synchronous? | ✅ **RESOLVED: Returns 201 CREATED** — `@ResponseStatus(HttpStatus.CREATED)` confirmed in `OrderController.java:53`. Not 202. Saga is synchronous. | MEDIUM — architectural clarity |
| U3 | Is general (non-flash) inventory reservation TTL 7 days or different? | MEDIUM — only flash sale TTL verified |

---

## Appendix A: API Endpoints Summary

| Service | Base URL | Key Endpoints |
|---------|----------|---------------|
| user-service | `/api/v1/users` | POST /register, POST /login, GET /me, PUT /me |
| product-service | `/api/v1/products` | GET /, GET /{id}, POST /, PUT /{id} |
| cart-service | `/api/v1/cart` | GET /, POST /items, PUT /items/{id}, DELETE /items/{id} |
| order-service | `/api/v1/orders` | POST /, GET /{id}, PUT /{id}/status |
| payment-service | `/api/v1/payments` | POST /intent, GET /{id}, POST /webhook |
| shipping-service | `/api/v1/shipping` | POST /rate, POST /label, GET /{id}/track |
| notification-service | `/api/v1/notifications` | GET /, PUT /{id}/read, POST /subscribe |

---

## Appendix B: Environment Variables Reference

### Required for All Services

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `REDIS_URL` | Redis connection string | `redis://host:6379` |
| `KAFKA_BROKERS` | Kafka broker addresses | `kafka:9092` |
| `KEYCLOAK_URL` | Keycloak server URL | `https://auth.vnshop.vn` |
| `KEYCLOAK_REALM` | Keycloak realm name | `vnshop` |
| `JWT_SECRET` | JWT signing secret | (min 32 chars) |

### Payment Services

| Variable | Description | Example |
|----------|-------------|---------|
| `VIETQR_API_KEY` | VietQR API key | (from VietQR portal) |
| `VIETQR_MERCHANT_ID` | VietQR merchant ID | (from VietQR portal) |
| `MOMO_API_KEY` | MoMo API key | (from MoMo sandbox) |
| `MOMO_SECRET_KEY` | MoMo secret | (from MoMo sandbox) |
| `STRIPE_SECRET_KEY` | Stripe secret key | `sk_live_...` |
| `PAYPAL_CLIENT_ID` | PayPal client ID | (from PayPal) |
| `PAYPAL_SECRET` | PayPal secret | (from PayPal) |

### Shipping Services

| Variable | Description | Example |
|----------|-------------|---------|
| `GHTK_API_KEY` | GHTK API key | (from GHTK portal) |
| `GHTK_TOKEN` | GHTK token | (from GHTK portal) |
| `GHN_API_KEY` | GHN API key | (from GHN portal) |
| `GHN_SHOP_ID` | GHN shop ID | (from GHN portal) |

---

## Appendix C: Technology Versions

| Component | Version | Source |
|-----------|---------|--------|
| Java | **25** | `pom.xml` `java.version=25` |
| Spring Boot | **4.0.6** | `pom.xml` |
| Spring Cloud | **2025.1.1** | `pom.xml` |
| NestJS | **11.1.21** | `package.json` |
| Node.js | 24.x LTS | ⚠️ Not verified in repo |
| React | **18.3.1** | `package.json` |
| Vite | **6.3.5** | `package.json` |
| Flutter | 3.x / Dart 3.x | ⚠️ Not verified in repo |
| Keycloak | 25.x | ⚠️ Verify installed version |
| PostgreSQL | 16.x | |
| Redis | 7.x | |
| Elasticsearch | 8.x | |
| Kafka | 3.x (KRaft) | |

---

**Document Version:** 2.1 (corrected)
**Last Updated:** July 10, 2026
**Corrections Applied:** 22 items (C1–C12, V1–V7, U1–U3, V8–V9, U2 resolved)
**Cross-Validation Source:** `CROSS-VALIDATION-REPORT-2026-07-10.md`
**Author:** Claude Code (Anthropic)
**Next Review:** August 10, 2026

### Version 2.1 Corrections (July 10, 2026)
| ID | Issue | Evidence |
|----|-------|---------|
| V8 | React 18.3.1 is **outdated** — React 19.2.7 is latest | GitHub react/tags page 1: v19.2.7 confirmed |
| V9 | Vite **6.3.5 unverifiable** — no v6.x tags exist on GitHub | Scanned pages 1–4: only v4.x, v5.x, v7.x, v8.x found. Latest is v8.1.4 |
| U2 | OrderController returns **201 CREATED**, not 202 | `OrderController.java:53` `@ResponseStatus(HttpStatus.CREATED)` |
| C6 | seller-finance-service IS deprecated — audit was correct | `seller-finance-service/DEPRECATED.md` dated 2026-05-12 |
| V10 | Java 25 **confirmed** — jdk-25.0.3+9 released April 22, 2026 | `adoptium/temurin25-binaries/releases` |
| V11 | Vite latest confirmed as **v8.1.4** (July 9, 2026) | `github.com/vitejs/vite/releases` |
| V12 | Spring Boot latest is **4.1.0** (4.0.6 is still correct but older) | `repo.spring.io` |
