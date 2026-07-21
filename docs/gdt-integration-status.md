# GDT Integration Status

## T1.6: E-Invoice GDT API Submission Verification

This document tracks the integration status of the GDT (General Department of Taxation) e-invoice submission API.

---

## 1. Submission Endpoint Found

| Property | Value |
|----------|-------|
| **Endpoint Path** | `/invoices/submit` |
| **HTTP Method** | POST |
| **Base URL (configurable)** | `https://hoadondientu-sandbox.gdt.gov.vn/api/v1` |
| **Source File** | `services/invoice-service/src/main/java/com/vnshop/invoiceservice/application/gdt/GdtApiClient.java` |

**Code Reference:**
```java
private static final String SUBMIT_PATH = "/invoices/submit";

// Constructor injection (line 39-40):
@Value("${gdt.api.url:https://hoadondientu-sandbox.gdt.gov.vn/api/v1}") String baseUrl,
@Value("${gdt.api.token:}") String apiToken
```

---

## 2. GDT Credentials Check

### Checked Locations

| Location | GDT Credentials Found |
|----------|----------------------|
| `.env` | No |
| `.env.example` | No |
| `docker-compose.yml` | No |
| `services/invoice-service/src/main/resources/application.yml` | No (only circuit breaker config) |

### Required Credentials

The application expects these configuration properties:

| Property | Env Variable | Description |
|----------|-------------|-------------|
| `gdt.api.url` | `GDT_API_URL` | Base URL for GDT API (defaults to sandbox) |
| `gdt.api.token` | `GDT_API_TOKEN` | Bearer token for authentication |

**Current State:** Both properties are missing. The `gdt.api.token` defaults to empty string, meaning no authentication would be sent.

---

## 3. Test Submission Result

**Status:** Cannot test - no credentials configured

```
HTTP request would be:
POST https://hoadondientu-sandbox.gdt.gov.vn/api/v1/invoices/submit
Content-Type: application/xml
Authorization: Bearer <MISSING_GDT_API_TOKEN>

Result: Cannot proceed without GDT_API_TOKEN
```

---

## 4. Gap Documentation

### Exact Gap

**Missing Credential:** GDT API Token

| Detail | Value |
|--------|-------|
| **Missing Env Variable** | `GDT_API_TOKEN` |
| **Config Property** | `gdt.api.token` |
| **Spring Property** | `${gdt.api.token}` |

### What is Needed

1. **GDT API Token**: Bearer token for authentication with GDT sandbox/production
2. **Optional**: GDT API URL override via `GDT_API_URL` if using non-default endpoint

### How to Obtain GDT Credentials

The GDT e-invoice system requires registration with the General Department of Taxation (Vietnam). To obtain credentials:

1. Register at: https://hoadondientu.gdt.gov.vn/ (production) or the sandbox portal
2. Obtain API credentials (token/certificate)
3. Contact: VNShop finance team or IT admin responsible for tax compliance

### Configuration Steps (Once Credentials Available)

Add to `.env` or environment:
```bash
# GDT E-Invoice API
GDT_API_TOKEN=your_gdt_token_here
# Optional: override default sandbox URL
# GDT_API_URL=https://hoadondientu.gdt.gov.vn/api/v1
```

---

## Audit References

- **Audit Section §8.3**: GDT API submission endpoint marked as "unverified"
- **Audit Section §4.2**: E-Invoice integration gaps

---

## Status Summary

- [x] Submission endpoint implemented (`GdtApiClient.java`)
- [x] Circuit breaker configured (`application.yml`)
- [x] XML generation in place (`InvoiceXmlGenerator.java`)
- [ ] **GDT credentials not configured** - BLOCKED
- [ ] Test submission not performed - BLOCKED

**Conclusion:** T1.6 is **blocked on GDT credentials**. The code infrastructure is complete but cannot be verified without API access.
