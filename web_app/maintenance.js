/**
 * SRCC Portal - Maintenance Mode & Administrator Gatekeeper
 * 
 * Enforces website maintenance lock. Prevents visitors from seeing or using
 * features until maintenance mode is turned off, while allowing authorized
 * administrators to unlock the full site via password.
 */

(function () {
  'use strict';

  // Authorized Admin Passcode Hashes (SHA-256)
  const MASTER_AUTH_HASHES = [
    '06f1339f683c69374e5805994b4956bc856e0204827364a6062894a88d792fae', // srcc2026
    '10908fb4fb59e0ac6fbe1c53af7a531fdb45345c5be65928fe896866c88d4fd1', // Srcc2026
    'ef1e8cfc2b5fa29b5a105e68c1e46a366b7de8d8292c37a809858e075a9472f0'  // SRCC2026
  ];

  const BYPASS_SESSION_KEY = 'srcc_maintenance_admin_bypass';
  const OVERRIDE_STORAGE_KEY = 'srcc_maintenance_mode_enabled';
  const ADMIN_USERS_KEY = 'srcc_admin_users_list_v1';
  const AUTH_STORAGE_KEY = 'srcc_admin_session_auth';
  const AUTH_TIMEOUT_MS = 12 * 60 * 60 * 1000;

  // Pure JS SHA-256 fallback (guarantees 100% reliable hashing across HTTP, mobile browsers & webviews)
  function pureJsSha256(ascii) {
    function rightRotate(value, amount) { return (value >>> amount) | (value << (32 - amount)); }
    var mathPow = Math.pow;
    var maxWord = mathPow(2, 32);
    var lengthProperty = 'length';
    var i, j;
    var result = '';
    var words = [];
    var asciiBitLength = ascii[lengthProperty] * 8;
    var hash = pureJsSha256.h = pureJsSha256.h || [];
    var k = pureJsSha256.k = pureJsSha256.k || [];
    var primeCounter = k[lengthProperty];
    var isComposite = {};
    for (var candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (i = 0; i < 313; i += candidate) {
          isComposite[i] = candidate;
        }
        hash[primeCounter] = (mathPow(candidate, .5) * maxWord) | 0;
        k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      }
    }
    ascii += '\x80';
    while (ascii[lengthProperty] % 64 - 56) ascii += '\x00';
    for (i = 0; i < ascii[lengthProperty]; i++) {
      j = ascii.charCodeAt(i);
      if (j >> 8) return '';
      words[i >> 2] |= j << ((3 - i % 4) * 8);
    }
    words[words[lengthProperty]] = ((asciiBitLength / maxWord) | 0);
    words[words[lengthProperty]] = (asciiBitLength);
    for (j = 0; j < words[lengthProperty];) {
      var w = words.slice(j, j += 16);
      var oldHash = hash;
      hash = hash.slice(0, 8);
      for (i = 0; i < 64; i++) {
        var w15 = w[i - 15], w2 = w[i - 2];
        var a = hash[0], e = hash[4];
        var temp1 = hash[7]
          + (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25))
          + ((e & hash[5]) ^ ((~e) & hash[6]))
          + k[i]
          + w[i];
        var temp2 = (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22))
          + ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));
        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }
      for (i = 0; i < 8; i++) {
        hash[i] = (hash[i] + oldHash[i]) | 0;
      }
    }
    for (i = 0; i < 8; i++) {
      for (j = 3; j >= 0; j--) {
        var b = (hash[i] >> (8 * j)) & 255;
        result += ((b < 16) ? 0 : '') + b.toString(16);
      }
    }
    return result;
  }

  async function hashPasscode(str) {
    try {
      if (window.crypto && window.crypto.subtle) {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      }
    } catch (e) {
      console.warn('SubtleCrypto not available, using pureJsSha256 fallback', e);
    }
    return pureJsSha256(str);
  }

  // Check if maintenance mode is enabled
  function isMaintenanceModeEnabled() {
    // 1. Check local admin toggle override
    try {
      const localOverride = localStorage.getItem(OVERRIDE_STORAGE_KEY);
      if (localOverride !== null) {
        return localOverride === 'true';
      }
    } catch (e) {}

    // 2. Check window.SRCC_MAINTENANCE_CONFIG
    if (window.SRCC_MAINTENANCE_CONFIG && typeof window.SRCC_MAINTENANCE_CONFIG.enabled === 'boolean') {
      return window.SRCC_MAINTENANCE_CONFIG.enabled;
    }
    return true; // Default to true as requested
  }

  // Check if current user has verified administrator access
  function isAdminAuthorized() {
    try {
      // Check maintenance bypass in session or local storage
      if (sessionStorage.getItem(BYPASS_SESSION_KEY) === 'true') return true;
      if (localStorage.getItem(BYPASS_SESSION_KEY) === 'true') return true;

      // Check active admin portal login session
      const sessionVal = sessionStorage.getItem(AUTH_STORAGE_KEY);
      const loginTime = parseInt(sessionStorage.getItem('srcc_login_time') || '0', 10);
      if (sessionVal && sessionVal.startsWith('srcc_auth_') && (Date.now() - loginTime < AUTH_TIMEOUT_MS)) {
        return true;
      }
    } catch (e) {}

    return false;
  }

  // Prevent flash of content immediately during initial HTML parsing
  if (isMaintenanceModeEnabled() && !isAdminAuthorized()) {
    try {
      document.documentElement.classList.add('srcc-maintenance-locked');
    } catch (e) {}
  }

  // Verify given password against authorized master hashes and custom admin accounts
  async function verifyAdminPassword(inputPass) {
    if (!inputPass) return false;
    const cleanPass = inputPass.trim();
    const hashed = await hashPasscode(cleanPass);
    const hashedLower = await hashPasscode(cleanPass.toLowerCase());

    // 1. Check Master Hashes (srcc2026, Srcc2026, SRCC2026)
    if (MASTER_AUTH_HASHES.includes(hashed) || MASTER_AUTH_HASHES.includes(hashedLower)) {
      return true;
    }

    // 2. Check stored admin users in localStorage
    try {
      const rawUsers = localStorage.getItem(ADMIN_USERS_KEY);
      if (rawUsers) {
        const users = JSON.parse(rawUsers);
        if (Array.isArray(users)) {
          const match = users.find(u => u && (u.passwordHash === hashed || (u.isSuper && MASTER_AUTH_HASHES.includes(hashed))));
          if (match) return true;
        }
      }
    } catch (e) {
      console.warn('Error reading stored admin users:', e);
    }

    return false;
  }

  // Inject CSS styles for maintenance overlay and admin preview banner
  function injectMaintenanceStyles() {
    if (document.getElementById('srcc-maintenance-styles')) return;

    const style = document.createElement('style');
    style.id = 'srcc-maintenance-styles';
    style.textContent = `
      /* Maintenance Overlay Root */
      html.srcc-maintenance-locked,
      body.srcc-maintenance-locked {
        overflow: hidden !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #070b19 !important;
      }

      /* Hide all standard site containers when in maintenance mode */
      html.srcc-maintenance-locked body > *:not(#srccMaintenanceOverlay):not(#srccAdminBypassModal) {
        display: none !important;
      }

      #srccMaintenanceOverlay {
        position: fixed;
        inset: 0;
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
        width: 100vw;
        padding: 1.5rem;
        background: radial-gradient(circle at 50% 20%, #1e1b4b 0%, #070b19 75%);
        font-family: 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        color: #ffffff;
        box-sizing: border-box;
        overflow-y: auto;
      }

      /* Ambient decorative glow orbs */
      .srcc-m-glow-orb {
        position: absolute;
        border-radius: 50%;
        filter: blur(110px);
        pointer-events: none;
        z-index: 0;
      }
      .srcc-m-glow-1 {
        width: 380px;
        height: 380px;
        background: rgba(245, 158, 11, 0.16);
        top: 8%;
        left: 10%;
        animation: srccFloatSlow 9s ease-in-out infinite alternate;
      }
      .srcc-m-glow-2 {
        width: 440px;
        height: 440px;
        background: rgba(59, 130, 246, 0.22);
        bottom: 8%;
        right: 10%;
        animation: srccFloatSlow 11s ease-in-out infinite alternate-reverse;
      }

      @keyframes srccFloatSlow {
        0% { transform: translateY(0px) scale(1); }
        100% { transform: translateY(26px) scale(1.08); }
      }

      /* Maintenance Card Container */
      .srcc-m-card {
        position: relative;
        z-index: 10;
        width: 100%;
        max-width: 600px;
        background: rgba(15, 23, 42, 0.85);
        backdrop-filter: blur(24px);
        -webkit-backdrop-filter: blur(24px);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 28px;
        padding: 3rem 2.25rem 2.5rem;
        text-align: center;
        box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.8),
                    0 0 50px rgba(59, 130, 246, 0.15);
        animation: srccCardIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      }

      @keyframes srccCardIn {
        from { opacity: 0; transform: translateY(24px) scale(0.96); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      /* Logo Row */
      .srcc-m-logos {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 16px;
        margin-bottom: 1.75rem;
      }
      .srcc-m-logos img {
        height: 58px;
        width: auto;
        object-fit: contain;
        filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.5));
      }
      .srcc-m-logo-divider {
        width: 1px;
        height: 40px;
        background: rgba(255, 255, 255, 0.2);
      }

      /* Pulse Status Pill */
      .srcc-m-badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 6px 14px;
        border-radius: 9999px;
        background: rgba(245, 158, 11, 0.15);
        border: 1px solid rgba(245, 158, 11, 0.35);
        color: #fbbf24;
        font-size: 0.82rem;
        font-weight: 700;
        letter-spacing: 0.4px;
        text-transform: uppercase;
        margin-bottom: 1.25rem;
      }
      .srcc-m-pulse-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #fbbf24;
        box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.7);
        animation: srccPulse 1.8s infinite;
      }
      @keyframes srccPulse {
        0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(251, 191, 36, 0.7); }
        70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(251, 191, 36, 0); }
        100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(251, 191, 36, 0); }
      }

      .srcc-m-card h1 {
        font-size: 1.95rem;
        font-weight: 800;
        color: #ffffff;
        margin-bottom: 0.65rem;
        letter-spacing: -0.02em;
        line-height: 1.25;
      }
      .srcc-m-subtitle {
        font-size: 0.95rem;
        font-weight: 600;
        color: #93c5fd;
        margin-bottom: 1.25rem;
      }
      .srcc-m-card p {
        font-size: 0.92rem;
        color: #cbd5e1;
        line-height: 1.6;
        margin-bottom: 1.75rem;
      }

      /* Info Box */
      .srcc-m-infobox {
        background: rgba(30, 41, 59, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 16px;
        padding: 1.15rem 1.25rem;
        margin-bottom: 1.75rem;
        text-align: left;
        display: flex;
        flex-direction: column;
        gap: 9px;
        font-size: 0.84rem;
      }
      .srcc-m-info-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        color: #94a3b8;
      }
      .srcc-m-info-val {
        font-weight: 700;
        color: #f1f5f9;
        text-align: right;
      }

      /* Action Row */
      .srcc-m-actions {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        flex-wrap: wrap;
      }
      .btn-srcc-admin-unlock {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 12px 22px;
        border-radius: 12px;
        background: linear-gradient(135deg, #2563eb, #1d4ed8);
        color: #ffffff;
        font-size: 0.92rem;
        font-weight: 700;
        border: 1px solid rgba(255, 255, 255, 0.15);
        cursor: pointer;
        transition: all 0.2s ease;
        box-shadow: 0 4px 16px rgba(37, 99, 235, 0.35);
      }
      .btn-srcc-admin-unlock:hover {
        background: linear-gradient(135deg, #1d4ed8, #1e40af);
        transform: translateY(-2px);
        box-shadow: 0 6px 22px rgba(37, 99, 235, 0.5);
      }
      .btn-srcc-admin-unlock:active {
        transform: translateY(0);
      }

      .btn-srcc-portal-link {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 12px 18px;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.08);
        color: #e2e8f0;
        font-size: 0.88rem;
        font-weight: 600;
        text-decoration: none;
        border: 1px solid rgba(255, 255, 255, 0.12);
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .btn-srcc-portal-link:hover {
        background: rgba(255, 255, 255, 0.14);
        color: #ffffff;
      }

      .srcc-m-footer {
        margin-top: 2rem;
        padding-top: 1.25rem;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        font-size: 0.78rem;
        color: #64748b;
      }

      /* Modal for Admin Password Entry */
      #srccAdminBypassModal {
        position: fixed;
        inset: 0;
        z-index: 1000000;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        background: rgba(0, 0, 0, 0.82);
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
      }
      #srccAdminBypassModal.show {
        display: flex;
        animation: srccFadeIn 0.2s ease;
      }
      @keyframes srccFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      .srcc-modal-card {
        background: #0f172a;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 20px;
        padding: 2rem;
        width: 100%;
        max-width: 420px;
        color: #ffffff;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.85);
        position: relative;
        text-align: left;
      }
      .srcc-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1.25rem;
      }
      .srcc-modal-title {
        font-size: 1.15rem;
        font-weight: 800;
        color: #ffffff;
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
      }
      .srcc-modal-close {
        background: transparent;
        border: none;
        color: #94a3b8;
        font-size: 1.3rem;
        cursor: pointer;
        padding: 4px;
        line-height: 1;
        transition: color 0.15s ease;
      }
      .srcc-modal-close:hover {
        color: #ffffff;
      }
      .srcc-input-group {
        margin-bottom: 1.25rem;
      }
      .srcc-input-group label {
        display: block;
        font-size: 0.82rem;
        font-weight: 700;
        color: #94a3b8;
        margin-bottom: 6px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .srcc-input-wrap {
        position: relative;
        display: flex;
        align-items: center;
      }
      .srcc-input-wrap input {
        width: 100%;
        padding: 12px 42px 12px 14px;
        background: #1e293b;
        border: 1.5px solid #334155;
        border-radius: 10px;
        color: #ffffff;
        font-size: 0.95rem;
        outline: none;
        transition: border-color 0.2s ease, box-shadow 0.2s ease;
        box-sizing: border-box;
      }
      .srcc-input-wrap input:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.25);
      }
      .srcc-toggle-pwd-btn {
        position: absolute;
        right: 10px;
        background: transparent;
        border: none;
        color: #94a3b8;
        cursor: pointer;
        font-size: 1.1rem;
        padding: 4px;
        line-height: 1;
      }
      .srcc-modal-msg {
        font-size: 0.82rem;
        margin-top: 6px;
        min-height: 18px;
      }
      .srcc-modal-msg.error {
        color: #f87171;
      }
      .srcc-modal-msg.success {
        color: #4ade80;
      }
      .srcc-modal-btn-submit {
        width: 100%;
        padding: 12px;
        background: linear-gradient(135deg, #2563eb, #1d4ed8);
        color: #ffffff;
        font-size: 0.92rem;
        font-weight: 700;
        border: none;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }
      .srcc-modal-btn-submit:hover {
        background: linear-gradient(135deg, #1d4ed8, #1e40af);
      }

      /* Admin Active Preview Bar */
      #srccAdminActiveBar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        z-index: 99999;
        background: linear-gradient(90deg, #7c2d12, #9a3412, #7c2d12);
        color: #fed7aa;
        padding: 8px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 0.82rem;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.35);
        border-bottom: 1px solid rgba(251, 146, 60, 0.4);
      }
      .srcc-admin-bar-left {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }
      .srcc-admin-bar-badge {
        background: rgba(255, 255, 255, 0.2);
        color: #ffffff;
        padding: 2px 8px;
        border-radius: 4px;
        font-weight: 800;
        font-size: 0.72rem;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        flex-shrink: 0;
      }
      .srcc-admin-bar-text {
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .srcc-admin-bar-right {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
      }
      .srcc-admin-bar-btn {
        background: rgba(255, 255, 255, 0.15);
        color: #ffffff;
        border: 1px solid rgba(255, 255, 255, 0.25);
        padding: 4px 10px;
        border-radius: 6px;
        font-size: 0.76rem;
        font-weight: 700;
        cursor: pointer;
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        transition: background 0.15s ease;
      }
      .srcc-admin-bar-btn:hover {
        background: rgba(255, 255, 255, 0.28);
      }
      .srcc-admin-bar-btn.btn-relock {
        background: rgba(239, 68, 68, 0.35);
        border-color: rgba(239, 68, 68, 0.6);
        color: #fecaca;
      }
      .srcc-admin-bar-btn.btn-relock:hover {
        background: rgba(239, 68, 68, 0.6);
        color: #ffffff;
      }

      /* Adjust top header if admin bar is present */
      body.srcc-has-admin-bar .app-header {
        top: 36px !important;
      }
      body.srcc-has-admin-bar {
        padding-top: 36px !important;
      }
    `;
    document.head.appendChild(style);
  }

  // Render the Under Maintenance screen HTML
  function renderMaintenanceScreen() {
    if (document.getElementById('srccMaintenanceOverlay')) return;

    injectMaintenanceStyles();
    document.documentElement.classList.add('srcc-maintenance-locked');
    document.body.classList.add('srcc-maintenance-locked');

    const cfg = window.SRCC_MAINTENANCE_CONFIG || {};
    const title = localStorage.getItem('srcc_maintenance_title') || cfg.title || "Website Under Maintenance";
    const badge = cfg.badge || "🛠️ Scheduled System Maintenance";
    const subtitle = cfg.subtitle || "Shri Ram College of Commerce · Digital Timetable Portal";
    const message = localStorage.getItem('srcc_maintenance_msg') || cfg.message || "We are currently conducting scheduled system upgrades, database optimization, and timetable maintenance. Access to student features is temporarily paused. Please check back shortly.";
    const estimated = cfg.estimatedTime || "Updates in progress · Rolling out soon";
    const contact = cfg.contactEmail || "srcc@srcc.du.ac.in";

    const overlay = document.createElement('div');
    overlay.id = 'srccMaintenanceOverlay';
    overlay.innerHTML = `
      <div class="srcc-m-glow-orb srcc-m-glow-1"></div>
      <div class="srcc-m-glow-orb srcc-m-glow-2"></div>

      <div class="srcc-m-card">
        <!-- Institution Branding Logos -->
        <div class="srcc-m-logos">
          <img src="assets/srcc_crest.png" onerror="this.onerror=null; this.src='srcc_crest.png';" alt="SRCC Crest" />
          <div class="srcc-m-logo-divider"></div>
          <img src="assets/srcc_100years.png" onerror="this.onerror=null; this.src='srcc_100years.png';" alt="SRCC 100 Years" />
        </div>

        <!-- Status Pulse Badge -->
        <div class="srcc-m-badge">
          <span class="srcc-m-pulse-dot"></span>
          <span>${badge}</span>
        </div>

        <h1>${title}</h1>
        <div class="srcc-m-subtitle">${subtitle}</div>
        <p>${message}</p>

        <!-- Status Overview Table -->
        <div class="srcc-m-infobox">
          <div class="srcc-m-info-row">
            <span>⚡ Service Status:</span>
            <span class="srcc-m-info-val" style="color: #fbbf24;">Upgrades & Syncing</span>
          </div>
          <div class="srcc-m-info-row">
            <span>⏱️ Estimated Return:</span>
            <span class="srcc-m-info-val">${estimated}</span>
          </div>
          <div class="srcc-m-info-row">
            <span>🏛️ College:</span>
            <span class="srcc-m-info-val">Shri Ram College of Commerce</span>
          </div>
          <div class="srcc-m-info-row">
            <span>🔒 Feature Availability:</span>
            <span class="srcc-m-info-val" style="color: #93c5fd;">Paused during maintenance</span>
          </div>
        </div>

        <!-- Action / Unlock Buttons -->
        <div class="srcc-m-actions">
          <button type="button" class="btn-srcc-admin-unlock" id="btnOpenAdminBypass">
            <span>🔒</span>
            <span>Administrator Access</span>
          </button>
          <a href="admin.html" class="btn-srcc-portal-link" title="Open Administrator Control Center">
            <span>⚙️</span>
            <span>Admin Portal</span>
          </a>
        </div>

        <div class="srcc-m-footer">
          Official Digital Portal • Shri Ram College of Commerce (SRCC), University of Delhi<br/>
          For inquiries or assistance: <strong style="color: #cbd5e1;">${contact}</strong>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Build the Admin Password Bypass Modal
    renderBypassModal();

    // Hook up button
    const btnOpen = document.getElementById('btnOpenAdminBypass');
    if (btnOpen) {
      btnOpen.addEventListener('click', () => {
        openBypassModal();
      });
    }
  }

  // Render password bypass modal
  function renderBypassModal() {
    if (document.getElementById('srccAdminBypassModal')) return;

    const modal = document.createElement('div');
    modal.id = 'srccAdminBypassModal';
    modal.innerHTML = `
      <div class="srcc-modal-card">
        <div class="srcc-modal-header">
          <h3 class="srcc-modal-title">
            <span>🔒</span>
            <span>Administrator Verification</span>
          </h3>
          <button type="button" class="srcc-modal-close" id="btnCloseBypassModal" aria-label="Close">✕</button>
        </div>

        <p style="font-size: 0.84rem; color: #94a3b8; margin: 0 0 16px 0; line-height: 1.45;">
          Enter your administrator password to unlock and access the full website while in maintenance mode.
        </p>

        <form id="srccBypassForm" onsubmit="return false;">
          <div class="srcc-input-group">
            <label for="srccBypassPassword">Admin Password</label>
            <div class="srcc-input-wrap">
              <input type="password" id="srccBypassPassword" placeholder="Enter admin password..." autocomplete="current-password" autofocus />
              <button type="button" class="srcc-toggle-pwd-btn" id="btnToggleBypassPwd" title="Show/Hide Password">👁️</button>
            </div>
            <div class="srcc-modal-msg" id="srccBypassMsg"></div>
          </div>

          <button type="submit" class="srcc-modal-btn-submit" id="btnSubmitBypass">
            <span>🔓</span>
            <span>Unlock Website</span>
          </button>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const closeBtn = document.getElementById('btnCloseBypassModal');
    const toggleBtn = document.getElementById('btnToggleBypassPwd');
    const pwdInput = document.getElementById('srccBypassPassword');
    const form = document.getElementById('srccBypassForm');

    if (closeBtn) {
      closeBtn.addEventListener('click', closeBypassModal);
    }
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeBypassModal();
      });
    }
    if (toggleBtn && pwdInput) {
      toggleBtn.addEventListener('click', () => {
        const isPwd = pwdInput.type === 'password';
        pwdInput.type = isPwd ? 'text' : 'password';
        toggleBtn.textContent = isPwd ? '🙈' : '👁️';
      });
    }

    if (form) {
      form.addEventListener('submit', handleBypassSubmit);
    }
  }

  function openBypassModal() {
    const modal = document.getElementById('srccAdminBypassModal');
    const pwdInput = document.getElementById('srccBypassPassword');
    const msg = document.getElementById('srccBypassMsg');
    if (modal) {
      modal.classList.add('show');
      if (msg) {
        msg.textContent = '';
        msg.className = 'srcc-modal-msg';
      }
      if (pwdInput) {
        pwdInput.value = '';
        setTimeout(() => pwdInput.focus(), 100);
      }
    }
  }

  function closeBypassModal() {
    const modal = document.getElementById('srccAdminBypassModal');
    if (modal) {
      modal.classList.remove('show');
    }
  }

  async function handleBypassSubmit(e) {
    if (e && e.preventDefault) e.preventDefault();
    const pwdInput = document.getElementById('srccBypassPassword');
    const msg = document.getElementById('srccBypassMsg');
    const btn = document.getElementById('btnSubmitBypass');
    if (!pwdInput) return;

    const val = pwdInput.value;
    if (!val || !val.trim()) {
      if (msg) {
        msg.textContent = '⚠️ Please enter your administrator password.';
        msg.className = 'srcc-modal-msg error';
      }
      pwdInput.focus();
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>⏳</span> <span>Verifying...</span>';
    }

    const isValid = await verifyAdminPassword(val);

    if (isValid) {
      if (msg) {
        msg.textContent = '✅ Password verified! Unlocking website...';
        msg.className = 'srcc-modal-msg success';
      }

      // Grant bypass in sessionStorage and localStorage
      sessionStorage.setItem(BYPASS_SESSION_KEY, 'true');
      localStorage.setItem(BYPASS_SESSION_KEY, 'true');

      setTimeout(() => {
        closeBypassModal();
        removeMaintenanceScreen();
        renderAdminActiveBar();
      }, 500);
    } else {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>🔓</span> <span>Unlock Website</span>';
      }
      if (msg) {
        msg.textContent = '❌ Incorrect administrator password. Access denied.';
        msg.className = 'srcc-modal-msg error';
      }
      pwdInput.select();
      pwdInput.focus();
    }
  }

  // Remove the maintenance screen and re-enable the normal website
  function removeMaintenanceScreen() {
    document.documentElement.classList.remove('srcc-maintenance-locked');
    document.body.classList.remove('srcc-maintenance-locked');
    const overlay = document.getElementById('srccMaintenanceOverlay');
    if (overlay) {
      overlay.style.opacity = '0';
      overlay.style.transition = 'opacity 0.25s ease';
      setTimeout(() => overlay.remove(), 250);
    }
  }

  // Render top admin floating preview bar when an admin is previewing the locked site
  function renderAdminActiveBar() {
    if (!isMaintenanceModeEnabled()) {
      const existing = document.getElementById('srccAdminActiveBar');
      if (existing) existing.remove();
      document.body.classList.remove('srcc-has-admin-bar');
      return;
    }

    if (document.getElementById('srccAdminActiveBar')) return;

    injectMaintenanceStyles();
    document.body.classList.add('srcc-has-admin-bar');

    const bar = document.createElement('div');
    bar.id = 'srccAdminActiveBar';
    bar.innerHTML = `
      <div class="srcc-admin-bar-left">
        <span class="srcc-admin-bar-badge">Admin Preview</span>
        <span class="srcc-admin-bar-text">🛠️ Website is currently in <strong>Maintenance Mode</strong> for visitors.</span>
      </div>
      <div class="srcc-admin-bar-right">
        <a href="admin.html" class="srcc-admin-bar-btn" title="Open Admin Control Center">
          <span>⚙️</span>
          <span>Admin Portal</span>
        </a>
        <button type="button" class="srcc-admin-bar-btn btn-relock" id="btnRelockSite" title="Clear bypass and preview the maintenance screen">
          <span>🔒</span>
          <span>Re-lock Site</span>
        </button>
      </div>
    `;

    document.body.prepend(bar);

    const btnRelock = document.getElementById('btnRelockSite');
    if (btnRelock) {
      btnRelock.addEventListener('click', () => {
        sessionStorage.removeItem(BYPASS_SESSION_KEY);
        localStorage.removeItem(BYPASS_SESSION_KEY);
        window.location.reload();
      });
    }
  }

  // Main evaluation logic
  function evaluateMaintenanceGate() {
    const maintenanceActive = isMaintenanceModeEnabled();

    if (!maintenanceActive) {
      // Site is live for everyone
      removeMaintenanceScreen();
      const bar = document.getElementById('srccAdminActiveBar');
      if (bar) bar.remove();
      document.body.classList.remove('srcc-has-admin-bar');
      return;
    }

    // Maintenance is active! Check admin authorization
    const authorized = isAdminAuthorized();

    if (authorized) {
      // Admin is authorized: unlock website and show admin banner
      removeMaintenanceScreen();
      renderAdminActiveBar();
    } else {
      // Visitor is NOT authorized: display full maintenance screen and block features
      renderMaintenanceScreen();
    }
  }

  // Expose Global Helper API for Admin Portal controls
  window.SRCC_MAINTENANCE = {
    isEnabled: isMaintenanceModeEnabled,
    isAdminAuthorized: isAdminAuthorized,
    enable: function () {
      localStorage.setItem(OVERRIDE_STORAGE_KEY, 'true');
      evaluateMaintenanceGate();
    },
    disable: function () {
      localStorage.setItem(OVERRIDE_STORAGE_KEY, 'false');
      evaluateMaintenanceGate();
    },
    relock: function () {
      sessionStorage.removeItem(BYPASS_SESSION_KEY);
      localStorage.removeItem(BYPASS_SESSION_KEY);
      evaluateMaintenanceGate();
    },
    evaluate: evaluateMaintenanceGate
  };

  // Run as early as possible
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', evaluateMaintenanceGate);
  } else {
    evaluateMaintenanceGate();
  }

})();
