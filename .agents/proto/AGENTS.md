<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-07-10 | Updated: 2026-07-10 -->

# gRPC Protocol Buffers (proto/)

## Purpose
Shared gRPC IDL definitions for inter-service communication between order, payment, shipping, and inventory services. Managed by Buf for linting and breaking-change detection in CI.

## Key Files
| File | Description |
|------|-------------|
| `buf.yaml` | Buf configuration (lint rules, breaking change detection) |
| `buf.gen.yaml` | Code generation config (generates Java stubs) |
| `common/common.proto` | Shared message types (money, IDs, enums) |
| `inventory/inventory.proto` | Inventory service gRPC contract |
| `payment/payment.proto` | Payment service gRPC contract |
| `shipping/shipping.proto` | Shipping service gRPC contract |

## For AI Agents

### Working In This Directory
- **NEVER** make breaking changes to proto definitions without coordinating with all consumer services
- Run `buf lint` to check for lint violations before committing
- Run `buf breaking` against the main branch to detect breaking changes
- Generated Java stubs are checked in alongside `.proto` files (no runtime code generation)

### Code Generation
```bash
# Generate from proto files
buf generate

# Lint proto definitions
buf lint

# Check breaking changes against main
buf breaking --against '.git#branch=main'
```

### Adding a New Service
1. Create `proto/<service>/<service>.proto`
2. Add message types to `proto/common/` for shared definitions
3. Run `buf lint` and `buf generate`
4. Update `buf.gen.yaml` if generating for a new language
5. Add consumers to CI breaking-change check

### Common Patterns
- Use `package vnshop.<service>` naming convention
- Use `google.protobuf.Timestamp` for time fields
- Use `google.protobuf.Empty` for no-request responses
- Version messages: `v1`, `v2` suffix on message names for backwards compatibility

## Dependencies

### Internal
- `services/order-service/` — consumes inventory, payment, shipping stubs
- `services/payment-service/` — provides payment stub
- `services/shipping-service/` — provides shipping stub
- `services/inventory-service/` — provides inventory stub

### External
- Buf CLI — protobuf linter and code generator
- grpc-java — generated Java stubs
- google.protobuf — standard protobuf types

<!-- MANUAL: -->
