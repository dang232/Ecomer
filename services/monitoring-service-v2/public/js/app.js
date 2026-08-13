/**
 * app.js — Main entry point
 * Bootstraps auth, tab navigation, Socket.io, and sub-modules.
 */
(async () => {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const loginScreen = document.getElementById('login-screen');
  const appShell    = document.getElementById('app');

  loginScreen.classList.remove('hidden');
  appShell.classList.add('hidden');

  let authenticated = false;
  try {
    authenticated = await Auth.init();
  } catch {
    authenticated = false;
  }

  if (!authenticated) {
    // Auth.init() will have already redirected to Keycloak.
    // If we somehow land here without a redirect, keep the login screen visible.
    return;
  }

  loginScreen.classList.add('hidden');
  appShell.classList.remove('hidden');

  // ── Tab navigation ─────────────────────────────────────────────────────────
  const tabs  = document.querySelectorAll('.tab');
  const views = document.querySelectorAll('.view');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.view;

      tabs.forEach(t => t.classList.remove('active'));
      views.forEach(v => v.classList.remove('active'));

      tab.classList.add('active');
      const targetView = document.getElementById(`view-${target}`);
      if (targetView) targetView.classList.add('active');
    });
  });

  // ── Logout ─────────────────────────────────────────────────────────────────
  document.getElementById('logout-btn').addEventListener('click', () => {
    Auth.logout();
  });

  // ── Alert banner ───────────────────────────────────────────────────────────
  const alertBanner = document.getElementById('alert-banner');
  let alertTimeout  = null;

  /**
   * Show an alert banner.
   * @param {string} message
   * @param {'info'|'warning'|'danger'} type
   * @param {number} [duration=8000] ms before auto-hide (0 = sticky)
   */
  function showAlert(message, type = 'danger', duration = 8000) {
    alertBanner.textContent = message;
    alertBanner.classList.remove('hidden');

    // Reset inline style overrides from previous calls
    alertBanner.style.backgroundColor = '';

    if (type === 'warning') {
      alertBanner.style.backgroundColor = 'var(--warning)';
      alertBanner.style.color = '#000';
    } else if (type === 'info') {
      alertBanner.style.backgroundColor = 'var(--accent)';
      alertBanner.style.color = '#000';
    } else {
      alertBanner.style.color = '#fff';
    }

    if (alertTimeout) clearTimeout(alertTimeout);
    if (duration > 0) {
      alertTimeout = setTimeout(() => {
        alertBanner.classList.add('hidden');
      }, duration);
    }
  }

  // Expose globally so sub-modules can call it
  window.showAlert = showAlert;

  // ── Socket.io ──────────────────────────────────────────────────────────────
  const token = Auth.getToken();

  const socket = io('/ws/monitoring', {
    path:              '/monitoring/socket.io',
    auth:              { token },
    transports:        ['websocket'],
    reconnectionDelay: 2000,
    reconnectionDelayMax: 10000,
  });

  socket.on('connect', () => {
    console.info('[socket] connected:', socket.id);
  });

  socket.on('disconnect', reason => {
    console.warn('[socket] disconnected:', reason);
  });

  socket.on('connect_error', err => {
    console.error('[socket] connection error:', err.message);
  });

  // ── Real-time events ───────────────────────────────────────────────────────
  socket.on('service:status', data => {
    if (typeof Health !== 'undefined' && Health.updateService) {
      Health.updateService(data);
    }
  });

  socket.on('service:alert', data => {
    const msg  = data.message || `Alert from ${data.service || 'unknown service'}`;
    const type = data.severity === 'warning' ? 'warning' : 'danger';
    showAlert(msg, type);
  });

  // ── Sub-module init ────────────────────────────────────────────────────────
  if (typeof Health !== 'undefined' && Health.init) {
    Health.init(socket);
  }

  if (typeof Playground !== 'undefined' && Playground.init) {
    Playground.init();
  }
})();
