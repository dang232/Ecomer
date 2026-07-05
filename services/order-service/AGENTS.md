# Order Service (services/order-service/)

**Stack:** Spring Boot, Java 25, Kafka, PostgreSQL, Redis, gRPC

## OVERVIEW
Core order management service handling orders, sub-orders, and seller fulfillment. Communicates with inventory, payment, and shipping via gRPC.

## KEY PATTERNS
- **gRPC clients**: Connects to inventory (9093), payment (9094), shipping (9095) services
- **Kafka**: Async event-driven architecture for order state changes
- **Redis**: Caching and session management
- **Object Storage**: Invoice storage via S3-compatible backend

## TESTING
```bash
cd services/order-service && ./mvnw test
make test-order  # From root
```
- 90% instruction coverage via JaCoCo
- CI excludes: *ApplicationTests, ArchitectureRulesTest, Grpc*ServerTest
