# --- build stage ---
FROM node:22-alpine AS build
WORKDIR /app

# Install pnpm globally (the project uses pnpm-lock.yaml, not package-lock.json)
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# Copy lock + manifest first for layer caching
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .

# Vite inlines VITE_* env vars at build time. Compose passes these via build args.
ARG VITE_API_URL=http://localhost:8080
ARG VITE_KEYCLOAK_URL=http://localhost:8085
ARG VITE_KEYCLOAK_REALM=vnshop
ARG VITE_KEYCLOAK_CLIENT_ID=vnshop-api
ARG VITE_STRIPE_ENABLED=false
ARG VITE_STRIPE_PUBLISHABLE_KEY=
ARG VITE_PAYPAL_ENABLED=false
ARG VITE_PAYPAL_CLIENT_ID=
ENV VITE_API_URL=$VITE_API_URL \
    VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL \
    VITE_KEYCLOAK_REALM=$VITE_KEYCLOAK_REALM \
    VITE_KEYCLOAK_CLIENT_ID=$VITE_KEYCLOAK_CLIENT_ID \
    VITE_STRIPE_ENABLED=$VITE_STRIPE_ENABLED \
    VITE_STRIPE_PUBLISHABLE_KEY=$VITE_STRIPE_PUBLISHABLE_KEY \
    VITE_PAYPAL_ENABLED=$VITE_PAYPAL_ENABLED \
    VITE_PAYPAL_CLIENT_ID=$VITE_PAYPAL_CLIENT_ID

RUN npx vite build

# --- runtime stage ---
FROM nginxinc/nginx-unprivileged:1.29.8-alpine@sha256:0c79d56aee561a1d81c63f00eee5fb5fe29279560cdc55e91425133104c7fbe6 AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
# busybox wget on alpine resolves "localhost" to ::1 first; nginx only listens
# on IPv4 in our config, so use 127.0.0.1 explicitly. Without this every
# 30s probe spuriously fails and the container shows "unhealthy" forever.
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/healthz >/dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
