/**
 * auth.js — Keycloak PKCE authentication module
 * Exposes a global `Auth` object with: init, getToken, logout
 */
const Auth = (() => {
  // ── Constants ──────────────────────────────────────────────────────────────
  const KEYCLOAK_URL = window.location.origin;
  const REALM       = 'vnshop';
  const CLIENT_ID   = 'monitoring-dashboard';
  const REDIRECT_URI = window.location.origin + '/';

  const AUTH_ENDPOINT  = `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/auth`;
  const TOKEN_ENDPOINT = `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/token`;
  const LOGOUT_ENDPOINT = `${KEYCLOAK_URL}/realms/${REALM}/protocol/openid-connect/logout`;

  const SK_ACCESS_TOKEN  = 'kc_access_token';
  const SK_REFRESH_TOKEN = 'kc_refresh_token';
  const SK_CODE_VERIFIER = 'kc_code_verifier';

  // ── Token storage ──────────────────────────────────────────────────────────
  function getToken() {
    return sessionStorage.getItem(SK_ACCESS_TOKEN);
  }

  function setTokens(accessToken, refreshToken) {
    sessionStorage.setItem(SK_ACCESS_TOKEN, accessToken);
    if (refreshToken) {
      sessionStorage.setItem(SK_REFRESH_TOKEN, refreshToken);
    }
  }

  function clearTokens() {
    sessionStorage.removeItem(SK_ACCESS_TOKEN);
    sessionStorage.removeItem(SK_REFRESH_TOKEN);
    sessionStorage.removeItem(SK_CODE_VERIFIER);
  }

  // ── JWT helpers ────────────────────────────────────────────────────────────
  function parseJwt(token) {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  }

  function isExpired(token) {
    const payload = parseJwt(token);
    if (!payload || !payload.exp) return true;
    // Add 10-second buffer to avoid edge-case expiry during a request
    return payload.exp * 1000 < Date.now() + 10_000;
  }

  function hasAdminRole(token) {
    const payload = parseJwt(token);
    if (!payload) return false;
    const roles = payload.realm_access && payload.realm_access.roles;
    return Array.isArray(roles) && roles.includes('admin');
  }

  // ── PKCE helpers ───────────────────────────────────────────────────────────
  function generateCodeVerifier() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  async function generateCodeChallenge(verifier) {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  // ── Auth flow ──────────────────────────────────────────────────────────────
  async function login() {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    sessionStorage.setItem(SK_CODE_VERIFIER, verifier);

    const params = new URLSearchParams({
      response_type:         'code',
      client_id:             CLIENT_ID,
      redirect_uri:          REDIRECT_URI,
      scope:                 'openid profile email',
      code_challenge:        challenge,
      code_challenge_method: 'S256',
    });

    window.location.href = `${AUTH_ENDPOINT}?${params.toString()}`;
  }

  async function handleCallback(code) {
    const verifier = sessionStorage.getItem(SK_CODE_VERIFIER);
    if (!verifier) throw new Error('Missing PKCE code verifier');

    const body = new URLSearchParams({
      grant_type:    'authorization_code',
      client_id:     CLIENT_ID,
      redirect_uri:  REDIRECT_URI,
      code,
      code_verifier: verifier,
    });

    const response = await fetch(TOKEN_ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    body.toString(),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Token exchange failed: ${err}`);
    }

    const data = await response.json();
    setTokens(data.access_token, data.refresh_token);
    sessionStorage.removeItem(SK_CODE_VERIFIER);

    // Clean the URL so the code param is not visible or reused
    window.history.replaceState({}, document.title, '/');

    return data.access_token;
  }

  async function refreshToken() {
    const refresh = sessionStorage.getItem(SK_REFRESH_TOKEN);
    if (!refresh) throw new Error('No refresh token available');

    const body = new URLSearchParams({
      grant_type:    'refresh_token',
      client_id:     CLIENT_ID,
      refresh_token: refresh,
    });

    const response = await fetch(TOKEN_ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    body.toString(),
    });

    if (!response.ok) {
      clearTokens();
      throw new Error('Token refresh failed');
    }

    const data = await response.json();
    setTokens(data.access_token, data.refresh_token);
    return data.access_token;
  }

  function logout() {
    const token = getToken();
    clearTokens();

    const params = new URLSearchParams({
      client_id:    CLIENT_ID,
      redirect_uri: REDIRECT_URI,
    });

    if (token) {
      params.set('id_token_hint', token);
    }

    window.location.href = `${LOGOUT_ENDPOINT}?${params.toString()}`;
  }

  // ── Refresh scheduler ──────────────────────────────────────────────────────
  function scheduleRefresh(token) {
    const payload = parseJwt(token);
    if (!payload || !payload.exp) return;

    // Refresh 60 seconds before expiry
    const msUntilRefresh = payload.exp * 1000 - Date.now() - 60_000;
    if (msUntilRefresh <= 0) return;

    setTimeout(async () => {
      try {
        const newToken = await refreshToken();
        scheduleRefresh(newToken);
      } catch {
        // Refresh failed — user will need to log in again on next action
      }
    }, msUntilRefresh);
  }

  // ── init ───────────────────────────────────────────────────────────────────
  /**
   * Initialise auth state.
   * Returns true if the user is authenticated with the admin role.
   * Returns false if the user needs to be redirected to login.
   */
  async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    // ── Callback from Keycloak ──
    if (code) {
      try {
        const token = await handleCallback(code);
        if (!hasAdminRole(token)) {
          clearTokens();
          return false;
        }
        scheduleRefresh(token);
        return true;
      } catch {
        clearTokens();
        return false;
      }
    }

    // ── Existing session ──
    let token = getToken();

    if (token && !isExpired(token)) {
      if (!hasAdminRole(token)) {
        clearTokens();
        return false;
      }
      scheduleRefresh(token);
      return true;
    }

    // ── Try refresh ──
    if (sessionStorage.getItem(SK_REFRESH_TOKEN)) {
      try {
        token = await refreshToken();
        if (!hasAdminRole(token)) {
          clearTokens();
          return false;
        }
        scheduleRefresh(token);
        return true;
      } catch {
        // Fall through to login redirect
      }
    }

    // ── No valid session — redirect to Keycloak ──
    await login();
    return false; // unreachable; login() redirects
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  return { init, getToken, logout };
})();
