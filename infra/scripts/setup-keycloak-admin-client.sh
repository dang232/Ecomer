#!/usr/bin/env bash
# Configure the vnshop-admin-api Keycloak client so the user-service can call
# the Admin API on POST /auth/register.
#
# This script is idempotent and safe to re-run. It performs the steps the
# realm-import JSON cannot easily express in Keycloak 26:
#   1. Set fullScopeAllowed=true on the client (so its service-account token
#      includes the roles it has been granted).
#   2. Add a "client roles" protocol mapper to the realm-default "roles" scope
#      so resource_access.<client>.roles lands in the access token.
#   3. Grant the service account the realm-management.{manage-users,view-users,
#      query-users,view-realm} roles. view-realm is required when the service
#      account looks up SELLER/BUYER realm roles before mapping them to users.
#
# Run this whenever the keycloak-postgres volume gets wiped, or after a fresh
# `docker compose up`. If the realm import handled all three steps natively the
# script could go away.
#
# Required env (defaults work against the local stack):
#   KC_CONTAINER       Keycloak container name (default: vnshop-keycloak)
#   KC_INTERNAL_URL    URL inside the container (default: http://localhost:8080)
#   KC_REALM           realm name (default: vnshop)
#   KC_ADMIN_USER      master-realm admin user (default: admin)
#   KC_ADMIN_PASS      master-realm admin password (default: admin)
#   KC_CLIENT_ID       service-account client to configure (default: vnshop-admin-api)
#   KEYCLOAK_LOCAL_SEED_MFA_REQUIRED
#                      set true only when local seeded seller/admin QA users
#                      must enroll TOTP; default false repairs them for QA

set -euo pipefail

KC_CONTAINER="${KC_CONTAINER:-vnshop-keycloak}"
KC_INTERNAL_URL="${KC_INTERNAL_URL:-http://localhost:8080}"
KC_REALM="${KC_REALM:-vnshop}"
KC_ADMIN_USER="${KC_ADMIN_USER:-admin}"
KC_ADMIN_PASS="${KC_ADMIN_PASS:-admin}"
KC_CLIENT_ID="${KC_CLIENT_ID:-vnshop-admin-api}"
KEYCLOAK_LOCAL_SEED_MFA_REQUIRED="${KEYCLOAK_LOCAL_SEED_MFA_REQUIRED:-false}"

case "${KEYCLOAK_LOCAL_SEED_MFA_REQUIRED}" in
  true)
    REQUIRED_ACTIONS='["CONFIGURE_TOTP"]'
    ;;
  false)
    REQUIRED_ACTIONS='[]'
    ;;
  *)
    echo "KEYCLOAK_LOCAL_SEED_MFA_REQUIRED must be true or false" >&2
    exit 2
    ;;
esac

# MSYS_NO_PATHCONV stops Git Bash from rewriting the in-container paths into
# Windows paths (which makes docker exec choke).
export MSYS_NO_PATHCONV=1

kcadm() {
  docker exec "${KC_CONTAINER}" /opt/keycloak/bin/kcadm.sh "$@"
}

echo "==> logging in to ${KC_INTERNAL_URL}"
kcadm config credentials \
  --server "${KC_INTERNAL_URL}" \
  --realm master \
  --user "${KC_ADMIN_USER}" \
  --password "${KC_ADMIN_PASS}" >/dev/null

repair_local_seed_users() {
  echo "==> reconciling local seeded QA users (MFA required=${KEYCLOAK_LOCAL_SEED_MFA_REQUIRED})"
  for username in seller1 admin1; do
    local user_id
    user_id=$(kcadm get users -r "${KC_REALM}" --query "username=${username}" --fields id 2>/dev/null \
      | grep -oE '"id" : "[^"]+"' | head -1 | sed 's/"id" : "//;s/"//')
    if [ -z "${user_id}" ]; then
      echo "  - ${username}: not present; leaving realm unchanged"
      continue
    fi

    kcadm update "users/${user_id}" -r "${KC_REALM}" \
      -s "requiredActions=${REQUIRED_ACTIONS}" >/dev/null
    echo "  + ${username}: requiredActions=${REQUIRED_ACTIONS}"
  done
}

repair_local_seed_users

echo "==> looking up client uuid for ${KC_CLIENT_ID}"
CLIENT_UUID=$(kcadm get clients -r "${KC_REALM}" --query "clientId=${KC_CLIENT_ID}" --fields id 2>/dev/null \
  | grep -oE '"id" : "[^"]+"' | head -1 | sed 's/"id" : "//;s/"//')
if [ -z "${CLIENT_UUID}" ]; then
  echo "client ${KC_CLIENT_ID} not found in realm ${KC_REALM}" >&2
  exit 1
fi

echo "==> setting fullScopeAllowed=true"
kcadm update "clients/${CLIENT_UUID}" -r "${KC_REALM}" -s fullScopeAllowed=true >/dev/null

echo "==> ensuring realm-management roles mapped to service account"
kcadm add-roles -r "${KC_REALM}" \
  --uusername "service-account-${KC_CLIENT_ID}" \
  --cclientid realm-management \
  --rolename manage-users --rolename view-users --rolename query-users \
  --rolename view-realm 2>/dev/null || true

echo "==> ensuring vnshop-api client has webOrigins for the SPA + dev server"
# Without webOrigins set, Keycloak rejects CORS on /token from the FE origin
# (manifests as `net::ERR_FAILED` on the FE auto-login after register).
VNSHOP_API_UUID=$(kcadm get clients -r "${KC_REALM}" --query "clientId=vnshop-api" --fields id 2>/dev/null \
  | grep -oE '"id" : "[^"]+"' | head -1 | sed 's/"id" : "//;s/"//')
if [ -n "${VNSHOP_API_UUID}" ]; then
  kcadm update "clients/${VNSHOP_API_UUID}" -r "${KC_REALM}" \
    -s 'webOrigins=["+","http://localhost:3000","http://localhost:5173"]' >/dev/null 2>&1 || true
fi

echo "==> ensuring 'client roles' mapper exists on the 'roles' client scope"
SCOPE_ID=$(kcadm get client-scopes -r "${KC_REALM}" --fields id,name 2>/dev/null \
  | grep -B1 '"name" : "roles"' | grep -oE '"id" : "[^"]+"' | head -1 | sed 's/"id" : "//;s/"//')
if [ -z "${SCOPE_ID}" ]; then
  echo "couldn't find the 'roles' client scope" >&2
  exit 1
fi

EXISTING=$(kcadm get "client-scopes/${SCOPE_ID}/protocol-mappers/models" -r "${KC_REALM}" --fields name 2>/dev/null \
  | grep -c '"name" : "client roles"' || true)
if [ "${EXISTING}" = "0" ]; then
  kcadm create "client-scopes/${SCOPE_ID}/protocol-mappers/models" -r "${KC_REALM}" \
    -s name="client roles" \
    -s protocol=openid-connect \
    -s protocolMapper=oidc-usermodel-client-role-mapper \
    -s 'config."multivalued"=true' \
    -s 'config."userinfo.token.claim"=true' \
    -s 'config."id.token.claim"=true' \
    -s 'config."access.token.claim"=true' \
    -s 'config."claim.name"=resource_access.${client_id}.roles' \
    -s 'config."jsonType.label"=String' >/dev/null
  echo "  + created client-roles mapper"
else
  echo "  = client-roles mapper already present"
fi

configure_identity_provider() {
  local alias="$1"
  local provider_id="$2"
  local enabled="$3"
  local client_id="$4"
  local client_secret="$5"
  local effective_enabled=false

  if [ "${enabled}" = "true" ] && [ -n "${client_id}" ] && [ -n "${client_secret}" ]; then
    effective_enabled=true
  fi

  echo "==> configuring ${alias} identity provider (enabled=${effective_enabled})"
  if kcadm get "identity-provider/instances/${alias}" -r "${KC_REALM}" >/dev/null 2>&1; then
    kcadm update "identity-provider/instances/${alias}" -r "${KC_REALM}" \
      -s "enabled=${effective_enabled}" \
      -s "config.clientId=${client_id}" \
      -s "config.clientSecret=${client_secret}" >/dev/null
  else
    kcadm create identity-provider/instances -r "${KC_REALM}" \
      -s "alias=${alias}" \
      -s "providerId=${provider_id}" \
      -s "displayName=${alias}" \
      -s "enabled=${effective_enabled}" \
      -s "config.clientId=${client_id}" \
      -s "config.clientSecret=${client_secret}" >/dev/null
  fi
}

configure_identity_provider google google \
  "${GOOGLE_OAUTH_ENABLED:-false}" \
  "${GOOGLE_OAUTH_CLIENT_ID:-}" \
  "${GOOGLE_OAUTH_CLIENT_SECRET:-}"
configure_identity_provider facebook facebook \
  "${FACEBOOK_OAUTH_ENABLED:-false}" \
  "${FACEBOOK_OAUTH_CLIENT_ID:-}" \
  "${FACEBOOK_OAUTH_CLIENT_SECRET:-}"

echo "==> restarting user-service so it picks up a fresh admin token"
docker compose restart user-service >/dev/null
echo "==> done. Verify with:"
echo "  curl -sS -X POST http://localhost:8080/auth/register -H 'Content-Type: application/json' \\"
echo "    -d '{\"email\":\"smoke@vnshop.local\",\"password\":\"Test1234!\",\"firstName\":\"Smoke\",\"lastName\":\"Test\"}'"
