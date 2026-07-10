# VNShop Comprehensive Deep Audit Report
## Multi-Seller Vietnamese E-Commerce Marketplace Platform

**Date:** July 10, 2026  
**Auditor:** Claude Code (Anthropic)  
**Platform:** VNShop - Shopee/Tiki/Lazada Model for Vietnam Market

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Complete Service Architecture](#2-complete-service-architecture)
3. [Complete Workflow Maps](#3-complete-workflow-maps)
4. [Missing Functionality (26 Features)](#4-missing-functionality-26-features)
5. [UI/UX Problems Analysis](#5-uiux-problems-analysis)
6. [Vietnam-Specific Niche Features](#6-vietnam-specific-niche-features-to-add)
7. [Sub-Functions Needed for Completeness](#7-sub-functions-needed-for-completeness)
8. [Integration Gaps](#8-integration-gaps)
9. [Sprint Planning](#9-sprint-planning)
10. [Feature Matrix by Category](#10-feature-matrix-by-category)

---

## 1. Executive Summary

### 1.1 Platform Overview

VNShop is a sophisticated polyglot microservices e-commerce platform modeled after Shopee, Tiki, and Lazada - Vietnam's dominant e-commerce marketplaces. The platform serves as a multi-seller marketplace where multiple vendors can sell products to consumers.

### 1.2 Technology Stack

| Layer | Technology | Details |
|-------|------------|---------|
| **API Gateway** | Spring Cloud Gateway | Port 8080, Auth, Routing, Rate Limiting |
| **Backend Services** | Spring Boot 4.1 + NestJS 11 | 15 active microservices |
| **Database** | PostgreSQL | Per-service databases |
| **Cache** | Redis | Cart, sessions, CQRS, Lua scripts |
| **Search** | Elasticsearch | Full-text search, faceting |
| **Messaging** | Apache Kafka | Event-driven architecture, SASL authentication |
| **Authentication** | Keycloak | OIDC/OAuth2, JWT tokens |
| **Frontend Web** | React 18 + Vite 6 | SPA with Tailwind CSS v4 |
| **Frontend Mobile** | Flutter 3.x + Dart 3.12 | Cross-platform mobile app |
| **Payments** | VietQR, MoMo, Stripe, PayPal | Multi-gateway support |
| **Notifications** | OneSignal | Push notifications |

### 1.3 Architecture Patterns

- **Domain-Driven Design (DDD)** - Bounded contexts per service
- **CQRS (Command Query Responsibility Segregation)** - Separate read/write models
- **Hexagonal Architecture** - Ports and adapters for external dependencies
- **Event-Driven Architecture** - Kafka events for service communication
- **Saga Pattern** - Distributed transactions with compensating actions
- **Outbox Pattern** - Reliable event publishing with dual-write protection

### 1.4 Coverage Metrics

| Category | Coverage |
|----------|----------|
| **Feature Coverage** | 67/92 features (73%) — see §10 for per-category breakdown |
| **Non-Functional Requirements** | 29/45 requirements (64%) |
| **Authorization Audit** | 18 findings closed, all high-severity resolved |

### 1.5 Risk Assessment

| Risk Level | Count | Key Areas |
|------------|-------|-----------|
| **Critical** | 1 | Payment gateway production integration |
| **High** | 4 | Admin dashboard advanced features, GDT API submission, Recently Viewed, Multi-language i18n |
| **Medium** | 12 | Multi-language, SEO, Social login |
| **Low** | 3 | Price comparison, Cart abandonment recovery |

---

## 2. Complete Service Architecture

### 2.1 Service Inventory (17 Services)

| # | Service | Tech Stack | Port | Function | Status |
|---|---------|------------|------|----------|--------|
| 1 | **api-gateway** | Spring Cloud Gateway | 8080 | Authentication, Routing, Rate Limiting | ✅ Active |
| 2 | **user-service** | Spring Boot | 8081 | User management, Seller profiles, Addresses | ✅ Active |
| 3 | **product-service** | Spring Boot | 8082 | Product catalog, Variants, Reviews | ✅ Active |
| 4 | **inventory-service** | Spring Boot | 8083 | Stock management, Reservations, Flash sales | ✅ Active |
| 5 | **cart-service** | NestJS | 8084 | Shopping cart with Redis CQRS | ✅ Active |
| 6 | **search-service** | Spring Boot + ES | 8086 | Full-text search, Faceting, Filtering | ✅ Active |
| 7 | **notification-service** | NestJS | 8087 | Multi-channel notifications, Socket.IO | ✅ Active |
| 8 | **order-service** | Spring Boot | 8091 | Order management, Checkout, Saga orchestration | ✅ Active |
| 9 | **payment-service** | Spring Boot | 8092 | VietQR, MoMo, Stripe, PayPal | ⚠️ Stub |
| 10 | **shipping-service** | Spring Boot | 8093 | GHTK/GHN carrier integration | ⚠️ Stub |
| 11 | **seller-finance** | NestJS | 8090 | Commission, Wallet, Settlements | ✅ Active |
| 12 | **recommendations** | Spring Boot | 8094 | Frequently bought together | ✅ Active |
| 13 | **messaging-service** | NestJS + WebSocket | 8095 | Buyer-seller chat | ✅ Active |
| 14 | **invoice-service** | Spring Boot | 8098 | Vietnam e-invoice XML generation (JAXB+XSD) | ✅ Active |
| 15 | **configuration-service** | NestJS | 8097 | Centralized config hot-reload | ✅ Active |
| 16 | **coupon-service** | Spring Boot | 8088 | ⚰️ Deprecated → merged into order-service | ⚰️ Deprecated |
| 17 | **review-service** | Spring Boot | 8089 | ⚰️ Deprecated → merged into product-service | ⚰️ Deprecated |

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
| order-service | PostgreSQL | orders, order_items, sub_orders | CQRS + Saga |
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
│         │                         │  (Returns 202 Async)  │                   │
│         │                         └──────────────────────┘                   │
│         │                                     │                                 │
│         │                                     ▼                                 │
│         │                         ┌──────────────────────┐                   │
│         │                         │ SYNCHRONOUS SAGA     │                   │
│         │                         │(State+Compensate)   │                   │
│         │                         └──────────────────────┘                   │
│         │                                     │                                 │
│         │                    ┌────────────────┼────────────────┐              │
│         │                    ▼                ▼                ▼              │
│         │             ┌───────────┐    ┌───────────┐   ┌───────────┐        │
│         │             │  SUCCESS  │    │  PENDING  │   │  FAILED   │        │
│         │             │           │    │           │   │           │        │
│         │             └─────┬─────┘    └─────┬─────┘   └─────┬─────┘        │
│         │                   │                │                │              │
│         │                   ▼                │                ▼              │
│         │             ┌───────────┐          │          ┌───────────┐        │
│         │             │  ORDER    │          │          │ COMPENSATE │        │
│         │             │CONFIRMED  │          │          │  / RETRY   │        │
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
│                                    │                                          │
│                                    ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │                    NOTIFY SELLER (Push + Email)                       │    │
│  │                    seller.notifyOrderReceived()                      │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                    │                                          │
│                                    ▼                                          │
│                         ┌────────────────────┐                               │
│                         │  SELLER DASHBOARD  │                               │
│                         │    ORDER QUEUE     │                               │
│                         └────────────────────┘                               │
│                                    │                                          │
│                    ┌───────────────┼───────────────┐                         │
│                    ▼               ▼               ▼                          │
│             ┌───────────┐  ┌───────────┐  ┌───────────┐                     │
│             │  ACCEPT   │  │   REJECT   │  │  IGNORE   │                     │
│             │           │  │            │  │ (Auto-    │                     │
│             └─────┬─────┘  └─────┬─────┘  │  cancel)  │                     │
│                   │              │         └───────────┘                     │
│                   ▼              ▼                                            │
│           ┌───────────┐  ┌───────────┐                                        │
│           │ SUB_ORDER │  │  REFUND   │                                        │
│           │  ACCEPTED │  │  TRIGGER  │                                        │
│           └─────┬─────┘  └───────────┘                                        │
│                 │                                                             │
│                 ▼                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │                         PACKING PHASE                                 │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │    │
│  │  │PRINT LABEL  │  │PACK PRODUCTS │  │CONFIRM PACK │                  │    │
│  │  │  (GHTK/GHN) │  │   ITEMS     │  │   COMPLETE  │                  │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                  │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                    │                                          │
│                                    ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │                        SHIPPING PHASE                                  │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │    │
│  │  │SCHEDULE PICKUP│ │ GIVE TO     │  │ TRACK SHIPMENT│                │    │
│  │  │(GHTK/GHN API)│ │ CARRIER     │  │  (Webhooks)  │                  │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                  │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                    │                                          │
│                    ┌───────────────┴───────────────┐                         │
│                    ▼                               ▼                          │
│            ┌───────────────┐               ┌───────────────┐                 │
│            │   DELIVERED   │               │EXCEPTION/     │                 │
│            │               │               │   RETURNED     │                 │
│            └───────┬───────┘               └───────┬───────┘                 │
│                    │                               │                          │
│                    ▼                               ▼                          │
│  ┌──────────────────────────────────────────────────────────────────────┐    │
│  │                      SETTLEMENT PHASE                                 │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │    │
│  │  │CALCULATE   │  │   UPDATE    │  │  TRANSFER   │                  │    │
│  │  │COMMISSION  │  │   WALLET    │  │    FUNDS    │                  │    │
│  │  │(10/8/5/3%) │  │             │  │   (Bank)    │                  │    │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                  │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                    │                                          │
│                                    ▼                                          │
│                           ┌───────────────┐                                  │
│                           │  SETTLEMENT   │                                  │
│                           │  COMPLETED    │                                  │
│                           └───────────────┘                                  │
│                                                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Payment Saga Flow

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
│  │ STEP 2: RESERVE INVENTORY                                            │   │
│  │                                                                       │   │
│  │  inventory-service.reserveStock(orderId, items)                      │   │
│  │                                                                       │   │
│  │  ├── Check available stock (Redis Lua script)                       │   │
│  │  ├── Create soft reservation (15-minute TTL for flash sales)        │   │
│  │  ├── Publish inventory.reserved event                                │   │
│  │  └── Return: { reservationId, reservedItems[] }                      │   │
│  │                                                                       │   │
│  │  Compensation: releaseReservation(reservationId)                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│    │                                                                       │
│    ▼                                                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ STEP 3: AWAIT PAYMENT CONFIRMATION                                  │   │
│  │                                                                       │   │
│  │  Gateway (VietQR/MoMo/Stripe) ──► Webhook ──► payment-service        │   │
│  │                                                                       │   │
│  │  Timeout: 30 minutes                                                 │   │
│  │  └── If timeout: trigger compensation                                │   │
│  │                                                                       │   │
│  │  Success path: payment.success event                                 │   │
│  │  Failure path: payment.failed event                                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│    │                                                                       │
│    ├──────────────────────────┬──────────────────────┐                      │
│    ▼                          ▼                      ▼                     │
│  ┌────────────┐         ┌────────────┐         ┌────────────┐             │
│  │  SUCCESS   │         │  PENDING   │         │  FAILED    │             │
│  │            │         │  (COD)     │         │            │             │
│  └─────┬──────┘         └─────┬──────┘         └─────┬──────┘             │
│        │                      │                      │                     │
│        ▼                      │                      ▼                     │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ STEP 4a: CONFIRM PAYMENT (Online)                                    │  │
│  │                                                                     │  │
│  │  ├── Update payment status to CONFIRMED                             │  │
│  │  ├── Publish payment.success event                                   │  │
│  │  ├── Trigger order confirmation                                      │  │
│  │  └── Send confirmation notifications                                  │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ STEP 5a: COMMIT INVENTORY                                            │  │
│  │                                                                     │  │
│  │  inventory-service.commitReservation(reservationId)                  │  │
│  │                                                                     │  │
│  │  ├── Convert soft reservation to hard deduction                      │  │
│  │  ├── Update stock levels                                             │  │
│  │  └── Publish inventory.committed event                              │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │ STEP 6a: CREATE SUB-ORDERS                                           │  │
│  │                                                                     │  │
│  │  order-service.createSubOrders(orderId)                             │  │
│  │                                                                     │  │
│  │  ├── Group items by seller                                          │  │
│  │  ├── Create sub-order per seller                                    │  │
│  │  ├── Publish order.created (per seller)                              │  │
│  │  └── Notify each seller                                             │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│                                    ▼                                        │
│                              ┌───────────┐                                   │
│                              │   SAGA   │                                   │
│                              │ COMPLETE │                                   │
│                              └───────────┘                                   │
│                                                                            │
│  ───────────────────────────────────────────────────────────────────────  │
│                                                                            │
│                    COMPENSATION PATHS (On Failure)                         │
│                                                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ COMPENSATE: Release Inventory                                        │   │
│  │  inventory-service.releaseReservation(reservationId)                │   │
│  │  ├── Delete soft reservation                                        │   │
│  │  └── Publish inventory.released event                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ COMPENSATE: Cancel Payment Intent                                    │   │
│  │  payment-service.cancelIntent(paymentId)                            │   │
│  │  └── Update payment status to CANCELLED                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ COMPENSATE: Update Order Status                                     │   │
│  │  order-service.updateStatus(orderId, PAYMENT_FAILED)                │   │
│  │  └── Notify buyer of failure                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                        │
│                                    ▼                                        │
│                              ┌───────────┐                                   │
│                              │   SAGA    │                                   │
│                              │  ROLLED   │                                   │
│                              │   BACK    │                                   │
│                              └───────────┘                                   │
│                                                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.4 Return/Refund Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          RETURN/REFUND FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         BUYER INITIATES RETURN                         │   │
│  │                                                                       │   │
│  │  Order Delivered ──► Return Window (7 days) ──► Buyer clicks Return   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                          │
│                                    ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    RETURN REQUEST FORM                                 │   │
│  │                                                                       │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │   │
│  │  │  RETURN REASON  │  │  EVIDENCE UPLOAD│  │  PICKUP/DROPOFF │        │   │
│  │  │                 │  │                 │  │    SELECTION    │        │   │
│  │  │ ○ Defective     │  │  [Photo 1]      │  │                 │        │   │
│  │  │ ○ Wrong item    │  │  [Photo 2]      │  │ ○ Home pickup   │        │   │
│  │  │ ○ Changed mind  │  │  [Photo 3]      │  │ ○ Drop at locker │       │   │
│  │  │ ○ Not as desc.  │  │                 │  │ ○ Drop at post   │        │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                          │
│                                    ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                      SELLER REVIEW PHASE                               │   │
│  │                                                                       │   │
│  │  SLA: 48 hours to respond                                            │   │
│  │                                                                       │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       │   │
│  │  │     APPROVE      │  │     REJECT      │  │  AUTO-APPROVE   │       │   │
│  │  │                  │  │                 │  │  (High-rated    │       │   │
│  │  │  ✓ Reason valid │  │  ✗ Reason invalid│  │   seller)      │       │   │
│  │  │  ✓ Evidence ok   │  │  ✗ No evidence  │  │                 │       │   │
│  │  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘       │   │
│  │           │                    │                    │                │   │
│  │           ▼                    ▼                    ▼                │   │
│  │  ┌──────────────────────────────────────────────────────────────┐    │   │
│  │  │              RETURN LABEL GENERATED                            │    │   │
│  │  │                                                               │    │   │
│  │  │  • QR code for drop-off                                       │    │   │
│  │  │  • Prepaid shipping label                                      │    │   │
│  │  │  • Return instructions sent to buyer                           │    │   │
│  │  └──────────────────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                          │
│                                    ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        ITEM RETURNED                                  │   │
│  │                                                                       │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       │   │
│  │  │  INSPECTION     │  │  PHOTO VERIFIED │  │  CONFIRM ITEM   │       │   │
│  │  │  BY SELLER/WH   │  │                 │  │  MATCHES        │       │   │
│  │  │                 │  │                 │  │                 │       │   │
│  │  │ ✓ Matches desc  │  │ ✓ In original   │  │ ✓ Correct qty  │       │   │
│  │  │ ✓ Not damaged   │  │   packaging     │  │ ✓ Original cond│       │   │
│  │  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘       │   │
│  │           │                    │                    │                │   │
│  │           └────────────┬────────┴────────────────────┘                │   │
│  │                        ▼                                              │   │
│  │               ┌───────────────┐                                       │   │
│  │               │   ITEM OK     │                                       │   │
│  │               │   ────────    │                                       │   │
│  │               │ PROCESS REFUND│                                       │   │
│  │               └───────┬───────┘                                       │   │
│  │                       │                                                │   │
│  │           ┌───────────┴───────────┐                                   │   │
│  │           ▼                       ▼                                   │   │
│  │    ┌─────────────┐         ┌─────────────┐                          │   │
│  │    │  REFUND TO  │         │  EXCHANGE   │                          │   │
│  │    │ORIGINAL PAY │         │   REQUEST   │                          │   │
│  │    │   METHOD    │         │             │                          │   │
│  │    └─────────────┘         └─────────────┘                          │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                          │
│                                    ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                       REFUND PROCESSING                                │   │
│  │                                                                       │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │   │
│  │  │   CALCULATE │  │   EXECUTE   │  │   NOTIFY    │                  │   │
│  │  │   REFUND    │  │   REFUND    │  │   BUYERS    │                  │   │
│  │  │             │  │             │  │             │                  │   │
│  │  │ • Full amt  │  │ • Original  │  │ • Email     │                  │   │
│  │  │ • Partial   │  │   payment   │  │ • Push      │                  │   │
│  │  │ • Deductions│  │ • Wallet    │  │ • In-app    │                  │   │
│  │  │   (shipping)│  │   option    │  │             │                  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                          │
│                                    ▼                                          │
│                           ┌───────────────┐                                  │
│                           │   REFUND     │                                  │
│                           │  COMPLETED   │                                  │
│                           │              │                                  │
│                           │ • Refund ID  │                                  │
│                           │ • Timeline   │                                  │
│                           │ • Evidence   │                                  │
│                           └───────────────┘                                  │
│                                                                            │
│  ───────────────────────────────────────────────────────────────────────  │
│                                                                            │
│                         DISPUTE ESCALATION                                  │
│                                                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │  Seller Rejects ──► Admin Mediation Queue ──► Admin Reviews ──► Ruling │
│  │                                                                     │   │
│  │  • Both parties submit evidence                                     │   │
│  │  • Admin has 72h to decide                                           │   │
│  │  • Decision is final and binding                                     │   │
│  │  • Appeals within 48h (one level)                                   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Missing Functionality (26 Features)

### 4.1 Critical - P0 (Blocks Core Shopping)

| ID | Feature | Description | Impact | Effort | Services Affected |
|----|---------|-------------|--------|--------|-------------------|
| F23 | **Product Variants** | ✅ Implemented — `ProductVariant` record with full validation | N/A | N/A | product-service, inventory-service |
| F35 | **Guest Cart** | ✅ Implemented — `MergeCartUseCase` with guest-to-authenticated merge | N/A | N/A | cart-service, user-service |
| F100 | **Return/Refund Flow** | ✅ Implemented — Return entity, 4 use cases, 4 test classes, state machine | N/A | N/A | order-service, payment-service |

### 4.2 High Priority - P1

| ID | Feature | Description | Impact | Effort | Services Affected |
|----|---------|-------------|--------|--------|-------------------|
| F53 | **Real Order Tracking** | Carrier API integration for live tracking | Buyers cannot see delivery status | Medium | shipping-service, order-service |
| F24 | **Product Image Gallery** | Multiple images with zoom and swipe | Cannot showcase products properly | Low | product-service, frontend |
| F113 | **Admin Dashboard** | Revenue, orders, growth metrics | No operational visibility | High | admin-service (new) |
| F26 | **Recently Viewed Products** | Browsing history per user | No "browse again" feature | Low | product-service, user-service |
| F27 | **Related Products** | "Frequently bought together" surfaced | Missing upsell opportunities | Medium | recommendations, product-service |
| F102 | **Digital Invoice (E-Invoice)** | Vietnam B2C e-invoice XML | Regulatory compliance | High | invoice-service |
| F54 | **Delivery Proof** | Photo + signature capture | Delivery confirmation | Medium | shipping-service |

### 4.3 Medium Priority - P2

| ID | Feature | Description | Impact | Effort | Services Affected |
|----|---------|-------------|--------|--------|-------------------|
| F12 | **Multi-Language (i18n)** | Vietnamese/English support | Only Vietnamese market | Medium | All services, frontend |
| F13 | **Delete Account (GDPR)** | Account deletion with data purge | Privacy compliance | Medium | user-service |
| F72 | **Coupon Stacking** | Multiple coupons per order | Limited promotional flexibility | Medium | order-service, coupon-service |
| F74 | **Auto-Apply Coupons** | System auto-applies best coupon | Conversion optimization | Medium | order-service |
| F76 | **First-Time Buyer Coupon** | Welcome discount for new users | Acquisition funnel | Low | order-service, user-service |
| F88 | **Review Photo Filter** | Filter reviews by photo only | Product research | Low | product-service |
| F97 | **Push Deep Links** | Notification → specific page | Better engagement | Medium | notification-service, frontend |
| F103 | **Re-order** | One-click reorder from history | Convenience | Medium | order-service, cart-service |
| F114 | **Sales Reports** | Daily/weekly/monthly analytics | Business intelligence | High | seller-finance, admin |
| F116 | **Customer Management** | Admin user segmentation | Operational efficiency | High | admin-service (new) |
| F117 | **Content CMS** | Banners, landing pages | Marketing flexibility | Medium | cms-service (new) |

### 4.4 Low Priority - P3

| ID | Feature | Description | Impact | Effort | Services Affected |
|----|---------|-------------|--------|--------|-------------------|
| F25 | **Product Comparison** | Side-by-side comparison | Research feature | Medium | product-service |
| F38 | **Cart Abandonment Recovery** | Automated recovery emails | Revenue recovery | Medium | notification-service |
| F62 | **Installment Payment** | VNPAY 0% interest installments | Big-ticket purchases | High | payment-service |
| F63 | **Saved Payment Methods** | Tokenized cards for faster checkout | Conversion optimization | Medium | payment-service |

---

## 5. UI/UX Problems Analysis

### 5.1 Design Intelligence Applied

Based on UI/UX Pro Max design principles, the following issues have been identified and categorized by severity and design rule violated.

### 5.2 Critical UI/UX Issues

| # | Issue | Design Rule Violated | Category | Impact | Recommendation |
|---|-------|---------------------|----------|--------|---------------|
| 1 | **No loading skeletons** | `progressive-loading` | Performance | Poor perceived performance | Add shimmer/skeleton screens for >1s loads |
| 2 | ~~Push notifications poll every 30s~~ | — | — | ~~Battery drain, delayed notifications~~ | ✅ Socket.IO gateway implemented — `socketio-notification.gateway.ts`; real-time, not polling |
| 3 | **Icon-only buttons without labels** | `aria-labels` | Accessibility | Screen reader users cannot navigate | Add `aria-label` to all icon buttons |
| 4 | **No focus visible states** | `focus-states` | Accessibility | Keyboard users lost | Add 2-4px visible focus rings |
| 5 | **Relies on hover for interactions** | `hover-vs-tap` | Touch/Interaction | Mobile users cannot use features | Add tap alternatives for all hover states |

### 5.3 High Priority Issues

| # | Issue | Design Rule Violated | Category | Impact | Recommendation |
|---|-------|---------------------|----------|--------|---------------|
| 6 | **Wishlist is localStorage only** | `local-state` | Data | Data loss on clear cache | Migrate to `/users/me/wishlist` API |
| 7 | **Cart stock validated only at order** | `inline-validation` | Forms | Cart shows unavailable items | Real-time stock check on cart page |
| 8 | ~~No dark mode~~ | — | — | ~~User preference ignored~~ | ✅ Implemented — 47-file codemod with e2e test suite; `dark-mode-ui.spec.ts` verifies `#0b0e14` dark bg and `#f4f6f9` light bg toggle |
| 9 | **Missing alt text on images** | `alt-text` | Accessibility | Screen reader users miss content | Add descriptive alt attributes |
| 10 | **No skip links** | `skip-links` | Accessibility | Keyboard users must tab through nav | Add skip to main content link |
| 11 | **Fixed px container widths** | `container-width` | Layout | Poor tablet/responsive experience | Use responsive max-w classes |
| 12 | **Placeholder-only labels** | `input-labels` | Forms | Users forget input purpose | Add visible labels above inputs |
| 13 | **No press feedback on cards** | `press-feedback` | Touch/Interaction | Unclear if tap registered | Add ripple/highlight on press |
| 14 | **Horizontal swipe on content** | `gesture-conflicts` | Touch/Interaction | Accidental navigation | Use vertical scroll only |

### 5.4 Medium Priority Issues

| # | Issue | Design Rule Violated | Category | Impact | Recommendation |
|---|-------|---------------------|----------|--------|---------------|
| 15 | **Color-only status indicators** | `color-not-only` | Accessibility | Colorblind users cannot distinguish | Add icons/text for status |
| 16 | **Errors only at top of form** | `error-placement` | Forms | User doesn't know which field | Show errors below fields |
| 17 | **No confirmation for destructive** | `confirmation-dialogs` | Forms | Accidental deletes | Add confirm before delete |
| 18 | **Instant state changes (0ms)** | `state-transition` | Animation | Jarring UX | Add 150-300ms transitions |
| 19 | **No reduced-motion support** | `reduced-motion` | Animation | Motion sickness risk | Check `prefers-reduced-motion` |
| 20 | **Body text <16px on mobile** | `readable-font-size` | Layout | iOS auto-zoom on inputs | Enforce 16px minimum body text |
| 21 | **No haptic feedback** | `haptic-feedback` | Touch/Interaction | Poor confirmation feel | Add haptics for confirmations |
| 22 | **No loading indicators** | `loading-states` | Animation | Unclear async operations | Add skeleton for async content |

### 5.5 Low Priority Issues

| # | Issue | Design Rule Violated | Category | Impact | Recommendation |
|---|-------|---------------------|----------|--------|---------------|
| 23 | **No auto-dismiss toasts** | `toast-dismiss` | Forms | Toasts persist forever | Auto-dismiss in 3-5s |
| 24 | **Blocking animations** | `no-blocking-animation` | Animation | User cannot interact | Never block input during animation |
| 25 | **No keyboard shortcuts** | `keyboard-shortcuts` | Accessibility | Power users limited | Add common shortcuts |

---

## 6. Vietnam-Specific Niche Features to Add

### 6.1 Payment Innovations (Vietnam Market)

Vietnam is a cash-heavy society with unique payment preferences. The following payment features are critical for market adoption:

| Feature | Description | Implementation Notes | Priority | Impact |
|---------|-------------|---------------------|----------|--------|
| **VietQR Advanced** | QR payment with bank selection, QR code generation, QR scanning via camera | Use VietQR API for dynamic QR codes; implement camera scanning for MoMo/Stripe | P0 | High |
| **MoMo E-Wallet** | Deep MoMo integration with balance checking, recharge | MoMo sandbox configured; need production API credentials | P0 | High |
| **VNPay Installment** | 0% interest installments via credit card | EMI calculation, bank partner agreements required | P1 | Medium |
| **ATM Transfer Auto-Reconcile** | Bank transfer detection via webhook | Bank webhooks for real-time confirmation | P1 | High |
| **Cash Deposit Points** | 7-Eleven, WinMart deposit points | Integration with convenience store payment networks | P2 | Medium |
| **ZaloPay Integration** | ZaloPay e-wallet for younger demographics | ZaloPay API integration for Gen Z users | P2 | Medium |
| **Installment Calculator** | EMI calculator for big-ticket items | Widget showing monthly payments for 3/6/9/12 months | P2 | Medium |

### 6.2 Shipping Innovations

Vietnam's geography and logistics infrastructure require specialized shipping features:

| Feature | Description | Implementation Notes | Priority | Impact |
|---------|-------------|---------------------|----------|--------|
| **GHTK Live Tracking** | Real-time GPS tracking visualization | GHTK webhook integration for status updates | P1 | High |
| **GHN COD Management** | Cash collection with reconciliation | COD fee calculation, fund settlement | P0 | High |
| **Locker Pickup** | J&T, GHN locker network integration | Locker selection in checkout, PIN code delivery | P2 | Medium |
| **Same-Day Delivery** | Premium tier for major cities (HN, HCM) | Delivery slot selection, express fulfillment | P2 | High |
| **Scheduled Delivery** | Buyer selects delivery time slot | 2-hour window selection, driver routing | P2 | Medium |
| **Proof of Delivery** | Photo capture + digital signature | Mobile app integration for delivery confirmation | P1 | Medium |
| **Vietnam Address Standardization** | Tỉnh/Thành phố → Quận/Huyện → Phường/Xã | Address autocomplete with Vietnam administrative divisions | P0 | High |

### 6.3 Vietnam-Specific Commerce Features

These features align VNShop with local market expectations:

| Feature | Description | Implementation Notes | Priority | Impact |
|---------|-------------|---------------------|----------|--------|
| **Flash Sale Engine** | Timed deals with countdown, limited stock | Countdown timer, urgency UI, stock depletion indicators | P0 | High |
| **Coin/Cashback System** | VNShop Coins for repeat purchases | Points earned per order, redemption at checkout | P1 | High |
| **Bundle Deals** | "Mua 3 tặng 1" (Buy 3 Get 1) engine | Bundle rule engine, quantity-based discounts | P1 | Medium |
| **Price Hunt** | Price drop alerts for watched products | Price watch API, notification on drop | P2 | Medium |
| **Social Sharing Rewards** | Facebook/Zalo share for discounts | Social share buttons, reward attribution | P2 | Medium |
| **Seller Badges** | "Yêu thích" (Favorite), "Mall", "Chính hãng" (Genuine) | Badge system with verification workflows | P0 | High |
| **Genuine Product Badge** | Certified authentic product verification | Document verification, brand partnership | P1 | High |
| **Consumer Protection** | Return window, refund timeline prominently displayed | Trust badges, policy highlights | P0 | Critical |

### 6.4 Regulatory Compliance Features

Vietnam has specific e-commerce regulations that must be addressed:

| Feature | Description | Implementation Notes | Priority | Impact |
|---------|-------------|---------------------|----------|--------|
| **E-Invoice (Hóa đơn điện tử)** | Vietnam mandated B2C invoices | XML format per Vietnam e-invoice regulations | P0 | Critical |
| **Tax Calculation** | Per-transaction VAT computation | 10% VAT calculation for applicable products | P1 | High |
| **MST (Tax Code) Verification** | Seller tax ID validation | Tax code format validation, API verification | P0 | High |
| **GPKD Verification** | Business license number validation | GPKD number format validation | P1 | High |
| **Price Display Compliance** | "Giá đã bao gồm VAT" badges | Tax-inclusive pricing display rules | P1 | Medium |
| **Age Verification** | For restricted product categories | Date of birth verification for certain items | P2 | Medium |

---

## 7. Sub-Functions Needed for Completeness

### 7.1 Product Variants System (F23)

Product variants are essential for selling clothing, electronics, and other products with multiple options.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       PRODUCT VARIANTS ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. ATTRIBUTE DEFINITIONS                                                    │
│  ├── Attribute Entity                                                        │
│  │   ├── id: UUID                                                            │
│  │   ├── name: String (e.g., "Size", "Color")                               │
│  │   ├── type: Enum (DROPDOWN, SWATCH, TEXT)                                │
│  │   ├── required: Boolean                                                  │
│  │   ├── displayOrder: Integer                                              │
│  │   └── validationRules: JSON                                              │
│  │                                                                           │
│  ├── Attribute Options                                                       │
│  │   ├── id: UUID                                                            │
│  │   ├── attributeId: FK                                                     │
│  │   ├── value: String (e.g., "XL", "Red")                                  │
│  │   ├── displayOrder: Integer                                               │
│  │   ├── swatchColor: String (for color swatches)                           │
│  │   └── swatchImage: URL (for visual options)                              │
│  │                                                                           │
│  └── Attribute Categories                                                   │
│      ├── CategoryAttribute                                                   │
│      └── Defines which attributes apply to which categories                  │
│                                                                              │
│  2. VARIANT MATRIX                                                           │
│  ├── ProductVariant Entity                                                  │
│  │   ├── id: UUID                                                            │
│  │   ├── productId: FK                                                      │
│  │   ├── sku: String (unique, auto-generated or manual)                     │
│  │   ├── price: Decimal                                                      │
│  │   ├── compareAtPrice: Decimal (for sales)                                │
│  │   ├── costPrice: Decimal (for margin calculation)                        │
│  │   ├── weight: Decimal                                                     │
│  │   ├── images: String[] (variant-specific images)                          │
│  │   ├── attributes: JSON ({size: "XL", color: "Red"})                     │
│  │   └── metadata: JSON (additional variant data)                           │
│  │                                                                           │
│  ├── SKU Generation Strategy                                                 │
│  │   ├── Pattern: {PRODUCT_SKU}-{ATTR1_CODE}-{ATTR2_CODE}                   │
│  │   ├── Example: TSHIRT-RED-XL                                             │
│  │   └── Custom SKU override allowed                                        │
│  │                                                                           │
│  └── Inventory Per Variant                                                   │
│      ├── inventory-service tracks stock per variantId                        │
│      ├── Lua script for atomic stock operations                             │
│      └── Reserved stock per variant                                          │
│                                                                              │
│  3. VARIANT SELECTION UI                                                     │
│  ├── Swatch Selector (Color)                                                │
│  │   ├── Circular color buttons with border on selected                     │
│  │   ├── Disabled state for out-of-stock colors                             │
│  │   ├── Tooltip with color name on hover                                   │
│  │   └── Click selects and updates product display                          │
│  │                                                                           │
│  ├── Dropdown Selector (Size)                                                │
│  │   ├── Native <select> or custom dropdown                                 │
│  │   ├── Disabled options for out-of-stock sizes                            │
│  │   └── Size guide link                                                    │
│  │                                                                           │
│  ├── Price/Stock Update                                                     │
│  │   ├── On variant selection, update price display                          │
│  │   ├── Show "X left" if low stock                                         │
│  │   ├── Show "Out of stock" badge if unavailable                           │
│  │   └── Update add-to-cart button state                                     │
│  │                                                                           │
│  └── Variant Image Gallery                                                   │
│      ├── Show variant-specific image when selected                           │
│      ├── Fall back to attribute-specific images                             │
│      └── Zoom on image hover/tap                                             │
│                                                                              │
│  4. CART INTEGRATION                                                         │
│  ├── Add to Cart Payload                                                    │
│  │   ├── productId: UUID                                                    │
│  │   ├── variantId: UUID (required for variant products)                    │
│  │   ├── quantity: Integer                                                   │
│  │   └── snapshot: {price, name, image} (for cart display)                 │
│  │                                                                           │
│  ├── Cart Display                                                            │
│  │   ├── Show variant attributes in cart item                               │
│  │   ├── "Size: XL, Color: Red"                                             │
│  │   └── Variant image thumbnail                                            │
│  │                                                                           │
│  └── Order Line Items                                                        │
│      ├── Store variantId in order_items                                     │
│      ├── For reporting: aggregate by variant                                │
│      └── For fulfillment: reference variant-specific data                     │
│                                                                              │
│  5. ADMIN INTERFACE                                                          │
│  ├── Variant Matrix Editor                                                   │
│  │   ├── Grid view of all combinations                                      │
│  │   ├── Bulk edit prices, stock, SKUs                                      │
│  │   ├── Import via CSV                                                    │
│  │   └── Generate missing variants                                          │
│  │                                                                           │
│  └── Attribute Management                                                    │
│      ├── Create/edit attributes                                             │
│      ├── Assign to categories                                                │
│      └── Set display order and type                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Guest Cart System (F35)

Guest cart enables anonymous users to add items before logging in, with seamless merge on signup.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          GUEST CART ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. ANONYMOUS SESSION                                                        │
│  ├── Session ID Generation                                                   │
│  │   ├── UUID v4 generated on first cart action                             │
│  │   ├── Stored in localStorage + cookie (httpOnly, secure)                  │
│  │   └── 30-day TTL                                                          │
│  │                                                                           │
│  ├── Session Storage (Redis)                                                 │
│  │   ├── Key: cart:guest:{sessionId}                                        │
│  │   ├── TTL: 30 days                                                        │
│  │   └── Data: { items[], createdAt, updatedAt }                            │
│  │                                                                           │
│  └── Session Identification                                                  │
│      ├── Cookie: vnshop_guest_session                                        │
│      ├── Fallback: localStorage vnshop_guest_session                        │
│      └── Cross-device: Not supported (use for cart transfer link instead)   │
│                                                                              │
│  2. GUEST CART API                                                           │
│  ├── Add Item                                                                │
│  │   POST /api/v1/cart/guest/{sessionId}/items                              │
│  │   Body: { productId, variantId?, quantity }                              │
│  │   Response: { cart, item }                                                │
│  │                                                                           │
│  ├── Get Cart                                                                │
│  │   GET /api/v1/cart/guest/{sessionId}                                     │
│  │   Response: { items[], subtotal, itemCount }                             │
│  │                                                                           │
│  ├── Update Item                                                             │
│  │   PATCH /api/v1/cart/guest/{sessionId}/items/{itemId}                   │
│  │   Body: { quantity }                                                      │
│  │                                                                           │
│  ├── Remove Item                                                             │
│  │   DELETE /api/v1/cart/guest/{sessionId}/items/{itemId}                  │
│  │                                                                           │
│  └── Clear Cart                                                              │
│      DELETE /api/v1/cart/guest/{sessionId}                                   │
│                                                                              │
│  3. CART MERGING ON LOGIN                                                    │
│  ├── Detection Trigger                                                        │
│  │   └── When user logs in with existing guest session                      │
│  │                                                                           │
│  ├── Merge Strategy                                                          │
│  │   ├── Same product: sum quantities (cap at max available)                │
│  │   ├── Price reconciliation: use current prices                           │
│  │   ├── Expired promotions: recalculate                                    │
│  │   └── Stock validation: check availability before merge                   │
│  │                                                                           │
│  ├── User Preference                                                         │
│  │   ├── Default: Merge carts                                               │
│  │   ├── Option: "Keep separate"                                            │
│  │   └── Remembered preference                                              │
│  │                                                                           │
│  └── Merge Endpoint                                                          │
│      POST /api/v1/cart/merge                                                 │
│      Body: { guestSessionId }                                                │
│      Response: { mergedCart, conflicts[] }                                   │
│                                                                              │
│  4. UX INDICATORS                                                            │
│  ├── Guest Cart Banner                                                       │
│  │   ├── "Sign in to save your cart"                                        │
│  │   ├── Show savings if user had signed in                                  │
│  │   └── Prominent CTA to sign in/register                                  │
│  │                                                                           │
│  ├── Persistent Cart Notice                                                  │
│  │   ├── "Your cart is saved locally"                                       │
│  │   └── "Create an account to access on any device"                        │
│  │                                                                           │
│  └── Header Cart Icon                                                        │
│      ├── Show guest cart count                                               │
│      ├── "Guest" label until login                                           │
│      └── Badge animation on add                                              │
│                                                                              │
│  5. CONVERSION TRACKING                                                      │
│  ├── Anonymous Checkout                                                       │
│  │   ├── Guest checkout allowed                                              │
│  │   ├── Guest account created with order                                    │
│  │   └── Option to set password later                                        │
│  │                                                                           │
│  └── Analytics Events                                                        │
│      ├── guest_cart_add (product, price, quantity)                          │
│      ├── guest_cart_merge (items merged)                                     │
│      └── guest_checkout_start (conversion funnel)                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Return/Refund Flow (F100)

Vietnam consumer law mandates a 7-day return window. Complete flow implementation:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       RETURN/REFUND FLOW DETAIL                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. RETURN ELIGIBILITY                                                       │
│  ├── Return Window                                                            │
│  │   ├── 7 days from delivery confirmation                                   │
│  │   ├── Configurable by seller tier                                         │
│  │   └── Digital products: Not eligible                                     │
│  │                                                                           │
│  ├── Eligible Order States                                                   │
│  │   ├── DELIVERED (only)                                                    │
│  │   └── Not: CANCELLED, RETURNED, REFUNDED                                 │
│  │                                                                           │
│  └── Excluded Categories                                                     │
│      ├── Personal care items                                                 │
│      ├── Customized products                                                 │
│      └── Perishable goods                                                     │
│                                                                              │
│  2. RETURN REQUEST                                                           │
│  ├── Return Reasons (Buyer Selects)                                          │
│  │   ├── DEFECTIVE - Product has manufacturing defects                       │
│  │   ├── WRONG_ITEM - Received different product                             │
│  │   ├── NOT_AS_DESCRIBED - Doesn't match listing                            │
│  │   ├── CHANGED_MIND - Buyer's personal preference                           │
│  │   └── LATE_DELIVERY - Arrived after promised date                          │
│  │                                                                           │
│  ├── Evidence Upload                                                         │
│  │   ├── Required: 1-5 photos                                                │
│  │   ├── Format: JPG, PNG (max 5MB each)                                     │
│  │   ├── Content: Product photos, packaging, defect close-ups                 │
│  │   └── Processing: Image compression, watermark                           │
│  │                                                                           │
│  ├── Return Method                                                           │
│  │   ├── HOME_PICKUP - Carrier picks up from buyer (fee may apply)           │
│  │   ├── DROP_OFF_LOCKER - J&T/GHN locker (free)                            │
│  │   └── DROP_OFF_POST - Postal service (free)                               │
│  │                                                                           │
│  └── Return Request Entity                                                   │
│      ├── id: UUID                                                            │
│      ├── orderId: FK                                                         │
│      ├── subOrderId: FK                                                      │
│      ├── reason: Enum                                                        │
│      ├── reasonDetail: String (buyer description)                            │
│      ├── evidenceUrls: String[]                                              │
│      ├── returnMethod: Enum                                                  │
│      ├── status: Enum (PENDING, APPROVED, REJECTED, RECEIVED, COMPLETED)     │
│      ├── requestedAt: Timestamp                                              │
│      └── expiresAt: Timestamp (7 days from delivery)                        │
│                                                                              │
│  3. SELLER REVIEW                                                            │
│  ├── SLA Timer                                                               │
│  │   ├── 48 hours to respond                                                 │
│  │   ├── Auto-approve after timeout (configurable)                           │
│  │   └── Notification at 24h and 47h                                         │
│  │                                                                           │
│  ├── Auto-Approval Rules                                                     │
│  │   ├── Seller tier: MALL (automatic approval)                              │
│  │   ├── Seller rating: >4.8 (automatic approval)                           │
│  │   └── Return reason: DEFECTIVE (review required)                         │
│  │                                                                           │
│  ├── Approval Actions                                                        │
│  │   ├── APPROVE - Accept return, generate label                            │
│  │   ├── REJECT - Provide reason, escalate option                           │
│  │   └── REQUEST_INFO - Ask buyer for more details                           │
│  │                                                                           │
│  └── Rejection Reasons                                                       │
│      ├── Product used/damaged by buyer                                       │
│      ├── Missing original packaging                                          │
│      ├── Outside return window                                               │
│      └── Item not purchased from this seller                                  │
│                                                                              │
│  4. RETURN LOGISTICS                                                         │
│  ├── Label Generation                                                        │
│  │   ├── QR Code for drop-off                                                │
│  │   ├── Prepaid shipping label (for pickup)                                 │
│  │   └── Return address (seller warehouse or VNShop warehouse)              │
│  │                                                                           │
│  ├── Buyer Instructions                                                       │
│  │   ├── Step-by-step return guide                                           │
│  │   ├── Pack product securely                                               │
│  │   ├── Include return form                                                 │
│  │   └── Drop off or schedule pickup                                        │
│  │                                                                           │
│  └── Tracking Return Shipment                                                │
│      ├── Carrier tracking integration                                        │
│      ├── Status updates to buyer/seller                                      │
│      └── Estimated arrival                                                    │
│                                                                              │
│  5. INSPECTION PHASE                                                         │
│  ├── Item Received                                                            │
│  │   ├── Warehouse/scanner confirms arrival                                   │
│  │   ├── Notification to seller                                              │
│  │   └── Inspection window: 3 business days                                 │
│  │                                                                           │
│  ├── Inspection Checklist                                                     │
│  │   ├── Product matches listing                                             │
│  │   ├── Condition: New/used/damaged                                        │
│  │   ├── Original packaging present                                          │
│  │   ├── All accessories included                                           │
│  │   └── Serial numbers match (if applicable)                               │
│  │                                                                           │
│  └── Inspection Outcome                                                      │
│      ├── PASS - Refund approved                                              │
│      ├── PARTIAL - Partial refund (deduct for damage)                        │
│      └── FAIL - Return to buyer, no refund                                  │
│                                                                              │
│  6. REFUND PROCESSING                                                        │
│  ├── Refund Calculation                                                       │
│  │   ├── Full refund: Item price + original shipping                         │
│  │   ├── Partial refund: Item price - deduction                             │
│  │   └── Deductions: Shipping (if buyer fault), restocking fee               │
│  │                                                                           │
│  ├── Refund Methods                                                          │
│  │   ├── Original payment method (default)                                   │
│  │   ├── VNShop Wallet (instant)                                             │
│  │   └── Bank transfer (1-5 business days)                                   │
│  │                                                                           │
│  ├── Saga Compensation                                                       │
│  │   ├── Trigger: inspection PASS                                           │
│  │   ├── Action: Release held funds to seller                               │
│  │   ├── Inventory: Return stock to available                                │
│  │   └── Accounting: Create refund transaction                              │
│  │                                                                           │
│  └── Refund Timeline                                                         │
│      ├── Wallet: Instant                                                      │
│      ├── Credit card: 5-10 business days                                    │
│      ├── Bank transfer: 1-5 business days                                   │
│      └── Notification: Email + Push + In-app                                │
│                                                                              │
│  7. DISPUTE RESOLUTION                                                        │
│  ├── Escalation Trigger                                                       │
│  │   ├── Seller rejects valid return                                         │
│  │   ├── Buyer disputes inspection decision                                  │
│  │   └── Partial refund disagreement                                         │
│  │                                                                           │
│  ├── Admin Mediation                                                          │
│  │   ├── Queue for admin review                                              │
│  │   ├── Both parties submit additional evidence                             │
│  │   ├── 72h SLA for admin decision                                         │
│  │   └── Decision: Final and binding                                        │
│  │                                                                           │
│  └── Appeal Process                                                          │
│      ├── One level of appeal                                                  │
│      ├── 48h window to appeal                                                 │
│      └── Senior admin review                                                  │
│                                                                              │
│  8. NOTIFICATIONS                                                             │
│  ├── To Buyer                                                                 │
│  │   ├── Return request submitted                                             │
│  │   ├── Seller responded (approved/rejected)                                │
│  │   ├── Return label ready                                                  │
│  │   ├── Item received                                                       │
│  │   ├── Inspection complete                                                  │
│  │   └── Refund processed                                                    │
│  │                                                                           │
│  └── To Seller                                                                │
│      ├── Return request received                                              │
│      ├── SLA reminder                                                         │
│      ├── Item received at warehouse                                           │
│      └── Refund deducted from wallet                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.4 Admin Dashboard (F113)

A comprehensive admin dashboard for operational visibility:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ADMIN DASHBOARD ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. OVERVIEW METRICS                                                        │
│  ├── KPI Cards                                                                │
│  │   ├── Today's Revenue (vs yesterday, %)                                  │
│  │   ├── Today's GMV (Gross Merchandise Value)                             │
│  │   ├── Orders Today (vs yesterday, %)                                     │
│  │   ├── Active Buyers (30-day rolling)                                     │
│  │   └── Active Sellers (30-day rolling)                                    │
│  │                                                                           │
│  ├── Growth Metrics                                                           │
│  │   ├── Week-over-week growth                                              │
│  │   ├── Month-over-month growth                                             │
│  │   └── Year-over-year comparison                                          │
│  │                                                                           │
│  └── Real-time Feed                                                          │
│      ├── Latest orders (live)                                                │
│      ├── Recent signups                                                       │
│      └── System alerts                                                        │
│                                                                              │
│  2. CHARTS & VISUALIZATIONS                                                  │
│  ├── Revenue Trend Chart                                                     │
│  │   ├── Line chart with daily/weekly/monthly granularity                   │
│  │   ├── Comparison line (previous period)                                  │
│  │   ├── Hover tooltip with exact values                                    │
│  │   └── Export as PNG/CSV                                                  │
│  │                                                                           │
│  ├── Top Products Chart                                                      │
│  │   ├── Horizontal bar chart (top 10)                                      │
│  │   ├── By revenue or units sold                                           │
│  │   └── Click to view product details                                      │
│  │                                                                           │
│  ├── Sales by Category                                                       │
│  │   ├── Donut/pie chart                                                    │
│  │   ├── Legend with percentages                                            │
│  │   └── Click to drill down                                                │
│  │                                                                           │
│  ├── Geography Heat Map                                                      │
│  │   ├── Vietnam map colored by sales volume                               │
│  │   ├── Province-level drill down                                           │
│  │   └── Top cities breakdown                                                │
│  │                                                                           │
│  └── Conversion Funnel                                                      │
│      ├── Visits → Add to Cart → Checkout → Purchase                        │
│      └── Funnel visualization with drop-off rates                            │
│                                                                              │
│  3. ORDER MANAGEMENT                                                         │
│  ├── Order List                                                               │
│  │   ├── Sortable columns: ID, Customer, Amount, Status, Date              │
│  │   ├── Filters: Status, Date range, Seller, Amount range                  │
│  │   ├── Search: Order ID, Customer name/email                              │
│  │   └── Pagination with page size selector                                 │
│  │                                                                           │
│  ├── Order Detail                                                             │
│  │   ├── Customer info and shipping address                                  │
│  │   ├── Order items with thumbnails                                        │
│  │   ├── Payment status and method                                          │
│  │   ├── Fulfillment status and tracking                                     │
│  │   └── Action buttons: Update status, Issue refund, Contact customer      │
│  │                                                                           │
│  ├── Bulk Operations                                                          │
│  │   ├── Select multiple orders                                              │
│  │   ├── Bulk status update                                                  │
│  │   ├── Bulk export to CSV                                                  │
│  │   └── Bulk label generation                                              │
│  │                                                                           │
│  └── Export Functionality                                                     │
│      ├── Export filtered orders to CSV/Excel                                 │
│      ├── Scheduled export (daily/weekly)                                     │
│      └── Custom date range                                                   │
│                                                                              │
│  4. USER MANAGEMENT                                                          │
│  ├── User List                                                                │
│  │   ├── Columns: ID, Name, Email, Type, Joined, Orders, Spent             │
│  │   ├── Filters: Type (buyer/seller), Date joined, Order count           │
│  │   └── Search: Name, Email, Phone                                        │
│  │                                                                           │
│  ├── User Detail                                                              │
│  │   ├── Profile information                                                 │
│  │   ├── Address book                                                        │
│  │   ├── Order history (linked)                                             │
│  │   ├── Account status (active/suspended)                                   │
│  │   └── Activity log                                                        │
│  │                                                                           │
│  ├── Account Actions                                                          │
│  │   ├── Suspend account (temporary)                                         │
│  │   ├── Ban account (permanent)                                             │
│  │   ├── Verify identity                                                     │
│  │   └── Send message to user                                                │
│  │                                                                           │
│  └── Segmentation                                                             │
│      ├── New users (last 7 days)                                             │
│      ├── At-risk users (no order 30+ days)                                  │
│      ├── VIP users (lifetime value > threshold)                             │
│      └── Bulk tag management                                                  │
│                                                                              │
│  5. SELLER MANAGEMENT                                                         │
│  ├── Seller List                                                              │
│  │   ├── Columns: ID, Shop Name, Tier, Products, Orders, Revenue, Rating   │
│  │   ├── Filters: Tier, Verification status, Category                       │
│  │   └── Search: Shop name, Seller email                                    │
│  │                                                                           │
│  ├── Seller Approval Queue                                                    │
│  │   ├── Pending verification applications                                   │
│  │   ├── Required documents checklist                                        │
│  │   ├── Approve/Reject with notes                                          │
│  │   └── Bulk approve option                                                 │
│  │                                                                           │
│  ├── Performance Metrics                                                      │
│  │   ├── Order fulfillment rate                                              │
│  │   ├── Cancellation rate                                                   │
│  │   ├── Return rate                                                         │
│  │   ├── Response time                                                       │
│  │   └── Rating trend                                                         │
│  │                                                                           │
│  └── Tier Management                                                          │
│      ├── Upgrade/Downgrade sellers                                            │
│      ├── Tier benefits configuration                                         │
│      └── Tier change notifications                                           │
│                                                                              │
│  6. SYSTEM HEALTH                                                             │
│  ├── Service Status                                                           │
│  │   ├── All 19 services with status indicators                              │
│  │   ├── Uptime percentage                                                    │
│  │   └── Response time trend                                                 │
│  │                                                                           │
│  ├── Error Monitoring                                                         │
│  │   ├── Error rate by service                                               │
│  │   ├── Recent errors with stack traces                                    │
│  │   └── Alert thresholds configuration                                      │
│  │                                                                           │
│  ├── API Latency                                                              │
│  │   ├── p50, p95, p99 by endpoint                                          │
│  │   ├── Slow query detection                                                │
│  │   └── Performance alerts                                                   │
│  │                                                                           │
│  └── Active Users                                                             │
│      ├── Real-time user count                                                │
│      ├── Concurrent sessions                                                  │
│      └── Peak usage times                                                     │
│                                                                              │
│  7. REPORTING & EXPORTS                                                       │
│  ├── Report Builder                                                           │
│  │   ├── Select metrics and dimensions                                      │
│  │   ├── Apply filters                                                        │
│  │   ├── Schedule reports (daily/weekly/monthly)                            │
│  │   └── Email delivery                                                       │
│  │                                                                           │
│  ├── Financial Reports                                                        │
│  │   ├── Daily settlement reports                                             │
│  │   ├── Commission earned                                                    │
│  │   ├── Refund totals                                                       │
│  │   └── Platform fees                                                       │
│  │                                                                           │
│  └── Custom Date Ranges                                                       │
│      ├── Preset: Today, Yesterday, Last 7/30/90 days                        │
│      ├── Custom: Calendar picker                                             │
│      └── Compare: vs previous period                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Integration Gaps

### 8.1 Third-Party Service Status

| Service | Status | Details | Priority | Effort |
|---------|--------|---------|----------|--------|
| **Keycloak** | ✅ Complete | Auth working | - | - |
| **Kafka** | ✅ Complete | SASL + ACLs configured | - | - |
| **Elasticsearch** | ✅ Complete | Full-text + faceting | - | - |
| **Redis** | ✅ Complete | Cart, sessions, caching | - | - |
| **PostgreSQL** | ✅ Complete | Per-service databases | - | - |
| **OneSignal** | ✅ Complete | Push notifications working | - | - |
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
| **E-Invoice Integration** | ⚠️ Partial | JAXB+XSD generation built; GDT API submission endpoint unverified | Compliance | High |
| **Data Retention Policy** | ⚠️ Partial | Configurable per data type | Compliance | Medium |
| **Backup Strategy** | ⚠️ Basic | Point-in-time recovery | DR | High |
| **GDPR Deletion** | ⚠️ Missing | Full data purge flow | Compliance | Medium |

---

## 9. Sprint Planning

### 9.1 Recommended Sprint Sequence

#### Sprint 1: Core Shopping Experience (2 weeks)
**Focus:** Complete variant integration, guest cart, return flow (all backend implemented — add missing frontend and admin views)

| Task | Description | Effort | Owner |
|------|-------------|--------|-------|
| T1.1 | Product Variants - Frontend Variant Selector UI | 2 days | Frontend |
| T1.2 | Guest Cart - Frontend Session Banner + Merge UI | 1 day | Frontend |
| T1.3 | Return Flow - Frontend Request UI + Status Tracking | 2 days | Frontend |
| T1.4 | Cart Stock Validation - Real-time Check | 1 day | Backend |
| T1.5 | Return Flow - GDT Submission Endpoint | 2 days | Backend |
| T1.6 | E-Invoice - GDT API Submission Integration | 2 days | Backend |

**Definition of Done:**
- [x] ✅ Users can select size/color variants (backend ready)
- [x] ✅ Stock is tracked per variant (backend ready)
- [x] ✅ Anonymous users can add to cart (backend ready)
- [x] ✅ Cart merges on login (backend ready)
- [x] ✅ Buyers can request returns with evidence (backend ready)
- [x] ✅ Sellers can approve/reject returns (backend ready)
- [x] ✅ Refunds process correctly (backend ready)
- [ ] E-invoices submitted to GDT API
- [ ] Frontend variant selector, guest cart UI, return request UI

#### Sprint 3: Admin & Operations (2 weeks)
**Focus:** Operational visibility and control

| Task | Description | Effort | Owner |
|------|-------------|--------|-------|
| T3.1 | Admin Dashboard - Overview & Metrics | 2 days | Frontend |
| T3.2 | Admin Dashboard - Order Management | 2 days | Backend + Frontend |
| T3.3 | Admin Dashboard - User Management | 2 days | Backend + Frontend |
| T3.4 | Admin Dashboard - Seller Management | 2 days | Backend + Frontend |
| T3.5 | Sales Reports - Revenue & GMV | 2 days | Backend + Frontend |
| T3.6 | System Health Dashboard | 1 day | Backend + Frontend |

**Definition of Done:**
- [ ] Dashboard shows all KPIs
- [ ] CRUD operations for orders/users/sellers
- [ ] Charts render correctly
- [ ] Export functionality works

#### Sprint 4: Payment & Shipping Live (2 weeks)
**Focus:** Production payment and shipping integration

| Task | Description | Effort | Owner |
|------|-------------|--------|-------|
| T4.1 | VietQR - Production API Integration | 2 days | Backend |
| T4.2 | MoMo - Production API Integration | 2 days | Backend |
| T4.3 | GHTK - Production API + Tracking | 2 days | Backend |
| T4.4 | GHN - Production API + Tracking | 2 days | Backend |
| T4.5 | Real-time Tracking - Webhook Handlers | 2 days | Backend |
| T4.6 | Delivery Proof - Photo + Signature | 2 days | Backend + Frontend |

**Definition of Done:**
- [ ] VietQR payments process in production
- [ ] MoMo payments process in production
- [ ] Live tracking updates visible
- [ ] Delivery proof captured

#### Sprint 5: Growth Features (2 weeks)
**Focus:** Competitive features and user engagement

| Task | Description | Effort | Owner |
|------|-------------|--------|-------|
| T5.1 | Flash Sale Engine - Backend | 2 days | Backend |
| T5.2 | Flash Sale Engine - UI with Countdown | 1 day | Frontend |
| T5.3 | Multi-Language - Backend i18n | 2 days | Backend |
| T5.4 | Multi-Language - Frontend i18n | 2 days | Frontend |
| T5.5 | Coin/Cashback System - Core | 2 days | Backend |
| T5.6 | Recently Viewed Products | 1 day | Backend + Frontend |

**Definition of Done:**
- [ ] Flash sales create urgency
- [ ] Users can switch languages
- [ ] Coins earned on purchase
- [ ] Recently viewed shown

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
│  │  Sprint 1-2     │    │    Sprint 3    │      │  Sprint 4-5      │        │
│  │                 │    │                │      │                 │        │
│  │ • Variants      │    │ • Admin Dash   │      │ • Payments Live │        │
│  │ • Guest Cart    │    │ • Reports      │      │ • Shipping Live │        │
│  │ • Returns       │    │ • User Mgmt    │      │ • Flash Sales   │        │
│  │ • E-Invoice     │    │                │      │ • i18n          │        │
│  │                 │    │                │      │                 │        │
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
| F11 | Account Deletion | ⚠️ | Partial - needs GDPR |
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
| F23 | Product Variants | ✅ | `ProductVariant` record with validation, equals/hashCode |
| F24 | Image Gallery | ❌ | Multiple images needed |
| F25 | Product Comparison | ❌ | Nice to have |
| F26 | Recently Viewed | ❌ | Not started |
| F27 | Related Products | ⚠️ | Backend ready, not surfaced |

**Category Coverage: 10/14 (71%)** — F23 variants now ✅, F24 image gallery still ❌

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
| F35 | Guest Cart | ✅ | Implemented merge on login |
| F36 | Cart Persistence | ✅ | Redis |
| F37 | Cart Count Badge | ✅ | |
| F38 | Cart Abandonment | ❌ | Recovery emails needed |

**Category Coverage: 10/11 (91%)** — F35 guest cart now ✅

### 10.4 Checkout & Ordering (9 Features)

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| F39 | Checkout Flow | ✅ | Multi-step |
| F40 | Shipping Address | ✅ | Selection/entry |
| F41 | Shipping Method | ✅ | GHTK/GHN |
| F42 | Order Review | ✅ | |
| F43 | Place Order | ✅ | Saga orchestration |
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
| F53 | Order Tracking | ⚠️ | Stub - needs live API |
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

### 10.10 Post-Purchase (6 Features)

| ID | Feature | Status | Notes |
|----|---------|--------|-------|
| F99 | Order Details | ✅ | Full history |
| F100 | Return/Refund | ✅ | 4 use cases + 4 test classes + state machine |
| F101 | Dispute | ⚠️ | Basic - needs flow |
| F102 | Digital Invoice | ⚠️ | Basic - needs Vietnam format |
| F103 | Reorder | ❌ | One-click reorder |
| F104 | Write Review | ✅ | From order |

**Category Coverage: 5/6 (83%)** — F100 return/refund now ✅; F102 e-invoice JAXB+XSD built, GDT submission pending

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
| F113 | Admin Dashboard | ❌ | Needs full build |
| F114 | Sales Reports | ❌ | Needs reports |
| F115 | Performance Metrics | ✅ | Basic |
| F116 | Customer Mgmt | ❌ | Admin user seg |
| F117 | Content CMS | ❌ | Banners/pages |
| F118 | SEO Management | ❌ | Meta tags |
| F119 | System Settings | ✅ | Config service |
| F120 | Audit Logs | ⚠️ | Partial |

**Category Coverage: 10/16 (63%)**

---

## Appendix A: API Endpoints Summary

### Core Services

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

| Component | Version | Notes |
|-----------|---------|-------|
| Java | 21 LTS | |
| Spring Boot | 4.1.0 | ⚠️ Verify in pom.xml |
| NestJS | 11.x | |
| Node.js | 24.x LTS | Previous 20 LTS now outdated |
| React | 18.x | |
| Vite | 6.x | |
| Flutter | 3.x | Dart 3.12 |
| Keycloak | 25.x | ⚠️ 26.7.0 available — verify installed version |
| PostgreSQL | 16.x | |
| Redis | 7.x | |
| Elasticsearch | 8.x | |
| Kafka | 3.x | KRaft mode |
| Keycloak | 25.x | |

---

**Document Version:** 1.0  
**Last Updated:** July 10, 2026  
**Next Review:** August 10, 2026  
**Author:** Claude Code (Anthropic)
