#!/bin/bash
# validate-provider-config.sh
# Validates external provider configuration at startup.
# Reports providers as disabled when their credential pair is absent.
# Does NOT log credential values.

set -euo pipefail

echo "=== VNShop Provider Configuration Validation ==="
echo ""

# Track if any issues found
issues=0

# Helper function to check if a provider is enabled
# A provider is enabled only if BOTH client_id and client_secret are non-empty
check_provider() {
    local provider_name="$1"
    local client_id_var="$2"
    local client_secret_var="$3"

    local client_id="${!client_id_var:-}"
    local client_secret="${!client_secret_var:-}"

    if [[ -n "$client_id" && -n "$client_secret" ]]; then
        echo "[ENABLED] $provider_name"
    else
        echo "[DISABLED] $provider_name (missing credentials)"
    fi
}

echo "--- Social OAuth Providers ---"
check_provider "Google" "GOOGLE_OAUTH_CLIENT_ID" "GOOGLE_OAUTH_CLIENT_SECRET"
check_provider "Facebook" "FACEBOOK_OAUTH_CLIENT_ID" "FACEBOOK_OAUTH_CLIENT_SECRET"

echo ""
echo "--- Payment Providers ---"
# PayPal
if [[ -n "${PAYPAL_CLIENT_ID:-}" && -n "${PAYPAL_CLIENT_SECRET:-}" ]]; then
    echo "[ENABLED] PayPal"
else
    echo "[DISABLED] PayPal (missing credentials)"
fi

echo ""
echo "--- Carrier Providers ---"
# GHN
if [[ -n "${GHN_TOKEN:-}" && -n "${GHN_SHOP_ID:-}" ]]; then
    echo "[ENABLED] GHN (live mode)"
else
    echo "[DISABLED] GHN (using stub mode)"
fi

# GHTK
if [[ -n "${GHTK_TOKEN:-}" && -n "${GHTK_PARTNER_CODE:-}" ]]; then
    echo "[ENABLED] GHTK (live mode)"
else
    echo "[DISABLED] GHTK (using stub mode)"
fi

echo ""
echo "--- GeoIP ---"
if [[ -n "${GEOIP_DATABASE_PATH:-}" ]]; then
    echo "[ENABLED] GeoIP (database configured)"
else
    echo "[DISABLED] GeoIP (database path not set)"
fi

echo ""
echo "=== Validation Complete ==="
echo "Password login remains available when all providers are disabled."
