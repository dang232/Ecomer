# VNShop Architect Docs

Reference documentation for the VNShop full-stack e-commerce platform. This directory is the authoritative source for architecture, history, security posture, and operational patterns.

## What this project is

VNShop is a Vietnamese e-commerce platform built on a microservices backbone. The backend spans 16 services (Spring Boot for transactional services, NestJS for real-time services) coordinated through a Spring Cloud Gateway. The frontend is a React 18 SPA. All services communicate synchronously via REST through the gateway or asynchronously via Kafka events.

## Files in this directory

| File | What it covers |
|------|----------------|
| [SYSTEM-ARCHITECTURE.md](SYSTEM-ARCHITECTURE.md) | Full service map, ports, infrastructure, communication patterns, DDD hexagonal layout, deployment topology |
| [UI-ARCHITECTURE-OVERHAUL.md](UI-ARCHITECTURE-OVERHAUL.md) | React and Flutter UI architecture, state ownership, design-system rules, migrated slices, and remaining work |
| [WHAT-WE-DID.md](WHAT-WE-DID.md) | Chronological work log pt27 through pt48 — what changed, when, and why |
| [SECURITY-AUDIT.md](SECURITY-AUDIT.md) | OWASP Top 10 audit findings (50 total), Phase 1 + 2 fixes, and remaining open items |
| [TRADE-OFFS.md](TRADE-OFFS.md) | Documented architectural decisions with rationale and known downsides |
| [BUGS-AND-GOTCHAS.md](BUGS-AND-GOTCHAS.md) | Hard-learned lessons, runtime surprises, and known bugs from all sessions |
| [TIPS-AND-TRICKS.md](TIPS-AND-TRICKS.md) | Patterns and practices for Spring Boot, Kafka, MongoDB, Redis, WebSocket, React, testing, security, Docker |

## Quick orientation

- **Entry point for new work:** Read `SYSTEM-ARCHITECTURE.md` first to understand service boundaries, then `WHAT-WE-DID.md` to understand current state.
- **Before any security-adjacent change:** Read `SECURITY-AUDIT.md` to avoid re-introducing known findings.
- **When you hit a weird bug:** Check `BUGS-AND-GOTCHAS.md` — gotchas #119–131 cover the last two sessions alone.
- **Before making a trade-off decision:** Read `TRADE-OFFS.md` to see what's already been decided and why.

## Related docs

- `docs/GAP-ANALYSIS.md` — Known functional gaps (F-01 through F-06), status, and remediation guidance
- `docs/PROJECT-SWEEP-2026-05-29.md` — Snapshot of what's done, what's wrong, and what's left as of 2026-05-29
- `docs/SESSION-HANDOVER-2026-05-30-pt47.md` — Most recent session handover (notification platform)
- `docs/R2-SWAP-CHECKLIST.md` — Cloudflare R2 avatar storage migration checklist
- `docs/PAYPAL-CAPTURE-PLAN.md` — PayPal capture round-trip implementation plan
