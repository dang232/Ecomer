# VNShop Dokploy Deployment Guide

## Credentials
- **Dokploy URL**: http://192.168.100.148:3000
- **Email**: dangqwe321@gmail.com
- **Password**: Dang25102005@

## Already Created
- `.env.dokploy` - Environment variables file (all 12 Kafka passwords + DB credentials)

## Step-by-Step Deployment

### 1. Navigate to VNShop Project
1. Go to http://192.168.100.148:3000
2. Login with credentials above
3. Click **Projects** in sidebar
4. Click on **VNShop** project

### 2. Configure Each Compose Service

You have 3 compose services. For EACH one, do:

#### Click on the service (e.g., "VNShop VNShop e-commerce docker-compose")

#### Go to **General** tab

#### Scroll down to **Provider** section

#### For **PVE Host** service (VNShop e-commerce docker-compose):
1. Click on **GitHub** tab (already selected)
2. **Repository**: Enter your GitHub repo URL (e.g., `https://github.com/YOUR_USERNAME/Ecomer`)
3. **Branch**: Change from `dev-deploy` to `main`
4. **Compose Path**: Enter `docker-compose.yml`

#### For the other 2 services:
- Follow the same pattern, setting the correct repository and branch

### 3. Environment Variables (IMPORTANT!)

After configuring Git source for each service:

1. Click on **Environment** tab
2. Add these variables (copy from `.env.dokploy`):

```
# PostgreSQL
POSTGRES_USER=vnshop
POSTGRES_PASSWORD=vnshop

# Redis
REDIS_PASSWORD=redis123

# MongoDB
MONGO_ROOT_USERNAME=vnshop
MONGO_ROOT_PASSWORD=vnshop

# Monitoring (TimescaleDB)
MONITORING_DB_PASSWORD=monitoring

# MinIO
MINIO_ROOT_USER=vnshop
MINIO_ROOT_PASSWORD=vnshop

# Keycloak
KC_BOOTSTRAP_ADMIN_USERNAME=admin
KC_BOOTSTRAP_ADMIN_PASSWORD=admin
KEYCLOAK_GATEWAY_CLIENT_SECRET=vnshop-gateway-secret
KEYCLOAK_ADMIN_API_CLIENT_SECRET=vnshop-admin-api-secret

# Elasticsearch
ELASTIC_PASSWORD=elastic123

# Kafka (ALL REQUIRED - no defaults)
KAFKA_ADMIN_PASSWORD=kafka-admin
KAFKA_ORDER_PASSWORD=kafka-order
KAFKA_PAYMENT_PASSWORD=kafka-payment
KAFKA_INVENTORY_PASSWORD=kafka-inventory
KAFKA_PRODUCT_PASSWORD=kafka-product
KAFKA_SHIPPING_PASSWORD=kafka-shipping
KAFKA_FINANCE_PASSWORD=kafka-finance
KAFKA_SEARCH_PASSWORD=kafka-search
KAFKA_RECOMMENDATIONS_PASSWORD=kafka-recommendations
KAFKA_INVOICE_PASSWORD=kafka-invoice
KAFKA_VIDEO_TRANSCODER_PASSWORD=kafka-transcoder
KAFKA_VIDEO_MODERATOR_PASSWORD=kafka-moderator
```

### 4. Deploy

1. Go back to **General** tab
2. Click the **Deploy** button
3. Wait for deployment to complete
4. Check **Logs** tab for any errors

### 5. Verify

1. Go to **Containers** tab to see running containers
2. Check **Logs** tab for startup errors
3. Common issues:
   - Missing env vars → add them in Environment tab
   - Wrong branch → change to `main`
   - Wrong compose path → set to `docker-compose.yml`

## Service Ports Reference

| Service | Internal Port | External Port |
|---------|--------------|---------------|
| Keycloak | 8080 | 8085 |
| Kafka | 9092 | 9092 |
| PostgreSQL (legacy) | 5432 | 5432 |
| MinIO API | 9000 | 9000 |
| MinIO Console | 9001 | 9001 |

## Troubleshooting

### "Invalid SSH private key"
- The SSH key in Dokploy doesn't match the PVE server's authorized_keys
- Go to Settings → SSH Keys → Update the private key

### "No compose found"
- Compose Path is empty or wrong
- Set to `docker-compose.yml`

### Containers exit immediately
- Missing required environment variable
- Check Logs tab for the specific missing variable

### SPA can't reach API
- Vite env vars have `localhost`
- Use public URL instead
