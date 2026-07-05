# Payment Service (services/payment-service/)

**Stack:** Spring Boot, Java 25, Kafka, PostgreSQL, Redis

## OVERVIEW
Handles payment processing with multiple providers: COD, VietQR, VNPay, MoMo, Stripe, PayPal.

## KEY PATTERNS
- **Provider toggles**: Enabled via environment variables (COD_ENABLED, VIETQR_ENABLED, etc.)
- **SePay polling**: Optional automatic VietQR confirmation
- **FX conversion**: Stripe/PayPal USD conversion with fallback rate

## ENVIRONMENT VARS
| Variable | Default | Purpose |
|----------|---------|---------|
| COD_ENABLED | true | Cash on delivery |
| VIETQR_ENABLED | true | VietQR bank transfers |
| VNPAY_ENABLED | false | VNPay gateway |
| MOMO_ENABLED | false | MoMo e-wallet |
| STRIPE_ENABLED | false | Stripe cards |
| PAYPAL_ENABLED | false | PayPal |
| FX_FALLBACK_RATE | 25500 | USD to VND rate |
