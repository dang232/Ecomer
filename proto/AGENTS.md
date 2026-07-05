# Protocol Buffers (proto/)

**Purpose:** Shared gRPC contract definitions between Java services

## STRUCTURE
```
proto/
├── common/          # Shared message types
├── inventory/       # Inventory service proto
├── payment/         # Payment service proto
└── shipping/        # Shipping service proto
```

## USAGE
- Proto files define gRPC services for inter-service communication
- **order-service** calls **inventory**, **payment**, **shipping** via gRPC
- Buf CLI for linting and breaking change detection in CI

## CI INTEGRATION
```bash
cd proto && buf lint
cd proto && buf breaking --against "../.git#ref=..."
```

## KEY SERVICES
- `inventory.proto` - Stock reservation, release
- `payment.proto` - Payment processing
- `shipping.proto` - Shipping rate calculation, label generation
