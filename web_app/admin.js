/**
 * SRCC Timetable Admin Portal Logic - Faculty Leaves & Timetable Sync
 * Designed for Anand Kumar (25BC070) - Shri Ram College of Commerce
 */

document.addEventListener('DOMContentLoaded', () => {
  // Precomputed SHA-256 hashes for authorized administrator passcodes
  const AUTH_HASHES = [
    '06f1339f683c69374e5805994b4956bc856e0204827364a6062894a88d792fae'
  ];
  const LEAVES_STORAGE_KEY = 'srcc_faculty_leaves_v2';
  const AUTH_STORAGE_KEY = 'srcc_admin_session_auth';
  const USERS_STORAGE_KEY = 'srcc_admin_users_list_v1';
  const ACTIVE_USER_SESSION_KEY = 'srcc_admin_active_user_session';

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
          + (w[i] = (i < 16) ? w[i] : (
              w[i - 16]
              + (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3))
              + w[i - 7]
              + (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
            ) | 0
          );
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
        result += ((b < 16) ? '0' : '') + b.toString(16);
      }
    }
    return result;
  }

  // Brute-force protection & Login Lockout
  const LOCKOUT_KEY = 'srcc_admin_login_lockout';
  const MAX_LOGIN_ATTEMPTS = 5;
  const LOCKOUT_DURATION_MS = 60 * 1000; // 60s lockdown after 5 consecutive failures

  function getLoginLockoutStatus() {
    try {
      const data = JSON.parse(sessionStorage.getItem(LOCKOUT_KEY) || localStorage.getItem(LOCKOUT_KEY) || '{}');
      if (data && data.lockedUntil && Date.now() < data.lockedUntil) {
        return Math.ceil((data.lockedUntil - Date.now()) / 1000);
      }
    } catch (e) {}
    return 0;
  }

  function recordFailedLogin() {
    try {
      const cur = JSON.parse(sessionStorage.getItem(LOCKOUT_KEY) || localStorage.getItem(LOCKOUT_KEY) || '{"attempts":0}');
      const attempts = (cur.attempts || 0) + 1;
      let lockedUntil = 0;
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
      }
      const updated = { attempts: attempts >= MAX_LOGIN_ATTEMPTS ? 0 : attempts, lockedUntil };
      sessionStorage.setItem(LOCKOUT_KEY, JSON.stringify(updated));
      localStorage.setItem(LOCKOUT_KEY, JSON.stringify(updated));
      return lockedUntil > 0;
    } catch (e) {
      return false;
    }
  }

  function resetLoginLockout() {
    try {
      sessionStorage.removeItem(LOCKOUT_KEY);
      localStorage.removeItem(LOCKOUT_KEY);
    } catch (e) {}
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
      console.warn('Crypto subtle unavailable, using pureJsSha256 fallback', e);
    }
    return pureJsSha256(str);
  }

  // DOM Elements - Auth & Nav
  const adminAuthView = document.getElementById('adminAuthView');
  const adminDashboardView = document.getElementById('adminDashboardView');
  const adminNavActions = document.getElementById('adminNavActions');
  const adminLoginForm = document.getElementById('adminLoginForm');
  const adminUsername = document.getElementById('adminUsername');
  const adminPasscode = document.getElementById('adminPasscode');
  const btnAdminLogout = document.getElementById('btnAdminLogout');
  const toastContainer = document.getElementById('toastContainer');

  // DOM Elements - User Management & Password Reset
  const adminActiveUserDisplay = document.getElementById('adminActiveUserDisplay');
  const formChangePassword = document.getElementById('formChangePassword');
  const editNewUsername = document.getElementById('editNewUsername');
  const pwdCurrent = document.getElementById('pwdCurrent');
  const pwdNew = document.getElementById('pwdNew');
  const pwdConfirm = document.getElementById('pwdConfirm');
  const formCreateAdminUser = document.getElementById('formCreateAdminUser');
  const newUserUsername = document.getElementById('newUserUsername');
  const newUserFullName = document.getElementById('newUserFullName');
  const newUserPassword = document.getElementById('newUserPassword');
  const newUserRole = document.getElementById('newUserRole');
  const adminUsersCount = document.getElementById('adminUsersCount');
  const adminUsersListContainer = document.getElementById('adminUsersListContainer');

  // DOM Elements - KPIs
  const kpiTotalFaculty = document.getElementById('kpiTotalFaculty');
  const kpiActiveLeaves = document.getElementById('kpiActiveLeaves');
  const kpiUnlockedRooms = document.getElementById('kpiUnlockedRooms');

  // DOM Elements - Form
  const adminTeacherSearch = document.getElementById('adminTeacherSearch');
  const adminTeacherSelect = document.getElementById('adminTeacherSelect');
  const adminLeaveReason = document.getElementById('adminLeaveReason');
  const adminStartDate = document.getElementById('adminStartDate');
  const adminEndDate = document.getElementById('adminEndDate');
  const btnAdminAddLeave = document.getElementById('btnAdminAddLeave');

  // Quick Dates
  const btnQuickToday = document.getElementById('btnQuickToday');
  const btnQuickTomorrow = document.getElementById('btnQuickTomorrow');
  const btnQuickThisWeek = document.getElementById('btnQuickThisWeek');

  // DOM Elements - List & Export
  const adminActiveLeavesCount = document.getElementById('adminActiveLeavesCount');
  const adminLeavesListContainer = document.getElementById('adminLeavesListContainer');
  const btnAdminClearAllLeaves = document.getElementById('btnAdminClearAllLeaves');
  const btnAdminDownloadLeavesJs = document.getElementById('btnAdminDownloadLeavesJs');
  const btnAdminCopyLeavesJs = document.getElementById('btnAdminCopyLeavesJs');
  const adminCodePreview = document.getElementById('adminCodePreview');

  // DOM Elements - Cloud Sync
  const cloudDbUrlInput = document.getElementById('cloudDbUrlInput');
  const cloudDbSecretInput = document.getElementById('cloudDbSecretInput');
  const btnSaveCloudDbUrl = document.getElementById('btnSaveCloudDbUrl');
  const btnPushToCloudNow = document.getElementById('btnPushToCloudNow');
  const cloudSyncStatusBadge = document.getElementById('cloudSyncStatusBadge');

  // Data references
  let appData = window.SRCC_DATA;
  let teachersData = window.SRCC_TEACHERS_DATA;
  let defaultLeaves = window.SRCC_FACULTY_LEAVES;

  // ==========================================================================
  // 🔔 TOAST HELPER
  // ==========================================================================
  function showToast(message, isSuccess = true, duration = 3500) {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast-item ${isSuccess ? 'copied' : ''}`;
    toast.innerHTML = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }

  function getTodayIsoDate() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function getTodayDayName() {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
  }

  // ==========================================================================
  // 🔐 USER MANAGEMENT & AUTHENTICATION
  // ==========================================================================
  function getStoredUsers() {
    try {
      const stored = localStorage.getItem(USERS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Error reading admin users', e);
    }
    // Default initial super admin (Anand)
    const defaultUsers = [
      {
        username: 'admin',
        fullName: 'Master Administrator (Anand)',
        role: 'Super Admin',
        passwordHash: '06f1339f683c69374e5805994b4956bc856e0204827364a6062894a88d792fae',
        createdAt: 'Default Master Account',
        isSuper: true
      }
    ];
    saveStoredUsers(defaultUsers);
    return defaultUsers;
  }

  let lastUserActionTimestamp = 0;

  async function saveStoredUsers(users) {
    lastUserActionTimestamp = Date.now();
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
      const ok = await syncUsersToCloud(users);
      return ok;
    } catch (e) {
      console.error('Error saving admin users', e);
      return false;
    }
  }

  function getActiveSessionUser() {
    try {
      const u = sessionStorage.getItem(ACTIVE_USER_SESSION_KEY);
      if (u) return JSON.parse(u);
    } catch (e) {}
    return { username: 'admin', fullName: 'Master Administrator (Anand)', role: 'Super Admin', isSuper: true };
  }

  const AUTH_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes active session limit

  function checkAuth(isManualLogin = false) {
    // Strictly session-based to guarantee password prompt when opening admin
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(ACTIVE_USER_SESSION_KEY);
    } catch (e) {}

    const sessionVal = sessionStorage.getItem(AUTH_STORAGE_KEY);
    const loginTime = parseInt(sessionStorage.getItem('srcc_login_time') || '0', 10);
    const isSessionActive = loginTime > 0 && (Date.now() - loginTime < AUTH_TIMEOUT_MS);
    const isAuth = isManualLogin || (sessionVal && sessionVal.startsWith('srcc_auth_') && isSessionActive);

    if (isAuth) {
      if (adminAuthView) adminAuthView.style.display = 'none';
      if (adminDashboardView) adminDashboardView.style.display = 'block';
      if (adminNavActions) adminNavActions.style.display = 'flex';
      initDashboard();
    } else {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
      sessionStorage.removeItem(ACTIVE_USER_SESSION_KEY);
      sessionStorage.removeItem('srcc_login_time');
      if (adminAuthView) adminAuthView.style.display = 'flex';
      if (adminDashboardView) adminDashboardView.style.display = 'none';
      if (adminNavActions) adminNavActions.style.display = 'none';
    }
  }

  if (adminLoginForm) {
    adminLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Check brute-force lockout
      const remainingLockout = getLoginLockoutStatus();
      if (remainingLockout > 0) {
        showToast(`⛔ <strong>Access Locked:</strong> Too many failed attempts. Please wait ${remainingLockout}s before trying again.`, false);
        return;
      }

      let uInput = (adminUsername ? adminUsername.value : '').trim().toLowerCase();
      const val = (adminPasscode ? adminPasscode.value : '').trim();
      if (!val) {
        showToast('⚠️ Please enter your password.', false);
        if (adminPasscode) adminPasscode.focus();
        return;
      }

      if (!uInput) {
        uInput = 'admin';
      }

      const hashed = await hashPasscode(val);
      let users = getStoredUsers();

      let matchedUser = users.find(u => u && u.username && u.username.toLowerCase() === uInput);

      if (matchedUser) {
        const isMatch = (matchedUser.passwordHash === hashed) || 
                        (matchedUser.isSuper && !matchedUser.hasChangedPassword && AUTH_HASHES.includes(hashed));
        if (!isMatch) matchedUser = null;
      }

      // If local matching failed, check Firebase Cloud DB for newly created accounts or updated passwords
      if (!matchedUser) {
        try {
          const cloudUsers = await fetchUsersFromCloud();
          if (cloudUsers && Array.isArray(cloudUsers) && cloudUsers.length > 0) {
            const cloudMatch = cloudUsers.find(u => u && u.username && u.username.toLowerCase() === uInput);
            if (cloudMatch) {
              const isMatch = (cloudMatch.passwordHash === hashed) || 
                              (cloudMatch.isSuper && !cloudMatch.hasChangedPassword && AUTH_HASHES.includes(hashed));
              if (isMatch) {
                matchedUser = cloudMatch;
                // Merge cloud users into local cache
                localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(cloudUsers));
              }
            }
          }
        } catch (e) {
          console.warn('Cloud user login fallback check error:', e);
        }
      }

      if (matchedUser) {
        resetLoginLockout();
        // Store auth token in sessionStorage only so new sessions require password
        const tokenStr = 'srcc_auth_' + btoa(Date.now().toString());
        sessionStorage.setItem(AUTH_STORAGE_KEY, tokenStr);
        sessionStorage.setItem('srcc_login_time', Date.now().toString());
        const sessionPayload = JSON.stringify({
          username: matchedUser.username,
          fullName: matchedUser.fullName,
          role: matchedUser.role,
          isSuper: !!matchedUser.isSuper
        });
        sessionStorage.setItem(ACTIVE_USER_SESSION_KEY, sessionPayload);
        try {
          localStorage.removeItem(AUTH_STORAGE_KEY);
          localStorage.removeItem(ACTIVE_USER_SESSION_KEY);
        } catch (e) {}
        showToast(`🔓 <strong>Welcome, ${escapeHtml(matchedUser.fullName)}!</strong> Logged in successfully.`);
        checkAuth(true);
      } else {
        const isNowLocked = recordFailedLogin();
        if (isNowLocked) {
          showToast('⛔ <strong>Security Lockdown!</strong> 5 consecutive failed attempts. System locked for 60 seconds.', false);
        } else {
          showToast('⚠️ <strong>Access Denied:</strong> Invalid username or password.', false);
        }
        if (adminPasscode) {
          adminPasscode.value = '';
          adminPasscode.focus();
        }
      }
    });
  }

  // Password visibility toggle
  const btnTogglePassword = document.getElementById('btnTogglePassword');
  if (btnTogglePassword && adminPasscode) {
    btnTogglePassword.addEventListener('click', () => {
      const isPwd = adminPasscode.type === 'password';
      adminPasscode.type = isPwd ? 'text' : 'password';
      btnTogglePassword.textContent = isPwd ? '🙈' : '👁️';
    });
  }

  if (btnAdminLogout) {
    btnAdminLogout.addEventListener('click', () => {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
      sessionStorage.removeItem(ACTIVE_USER_SESSION_KEY);
      sessionStorage.removeItem('srcc_login_time');
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(ACTIVE_USER_SESSION_KEY);
      showToast('🔒 Logged out of Admin Portal.');
      checkAuth();
    });
  }

  // ==========================================================================
  // 💾 LEAVES LOCAL STORAGE SYNC
  // ==========================================================================
  function getLeavesList() {
    let raw = [];
    try {
      const stored = localStorage.getItem(LEAVES_STORAGE_KEY) || localStorage.getItem('srcc_faculty_leaves_custom_v1');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          raw = parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse stored leaves:', e);
    }

    if (raw.length === 0) {
      if (window.SRCC_FACULTY_LEAVES && Array.isArray(window.SRCC_FACULTY_LEAVES.leaves)) {
        raw = [...window.SRCC_FACULTY_LEAVES.leaves];
      } else if (defaultLeaves && Array.isArray(defaultLeaves.leaves)) {
        raw = [...defaultLeaves.leaves];
      }
    }

    // Deduplicate by teacher ID or clean name (preserves latest entry)
    const dedupMap = new Map();
    raw.forEach(l => {
      const key = (l.teacher_id ? String(l.teacher_id) : '') || (l.teacher_name ? l.teacher_name.toLowerCase().trim() : '');
      if (key && !dedupMap.has(key)) {
        dedupMap.set(key, l);
      }
    });

    const deduped = Array.from(dedupMap.values());
    if (raw.length !== deduped.length) {
      try {
        localStorage.setItem(LEAVES_STORAGE_KEY, JSON.stringify(deduped));
      } catch (e) {}
    }
    return deduped;
  }

  function saveLeavesList(leaves) {
    try {
      localStorage.setItem(LEAVES_STORAGE_KEY, JSON.stringify(leaves));
      if (window.SRCC_FACULTY_LEAVES) {
        window.SRCC_FACULTY_LEAVES.leaves = leaves;
      } else {
        window.SRCC_FACULTY_LEAVES = { leaves: leaves };
      }
    } catch (e) {
      console.error('Failed to save leaves:', e);
    }
  }

  function getDisplayShortCode(teacher) {
    if (!teacher) return '';
    const code = (teacher.short_code || '').trim();
    if (!code) return '';
    if (/^(cg|eg|mg|hg|hgc)\d*$/i.test(code)) return '';
    return code;
  }

  // ==========================================================================
  // ☁️ CLOUD SYNC HELPERS (100% FREE FIREBASE REALTIME DB)
  // ==========================================================================
  const CLOUD_DB_STORAGE_KEY = 'srcc_cloud_db_url';
  const CLOUD_DB_SECRET_KEY = 'srcc_cloud_db_secret';

  function getCloudDbUrl() {
    const fromInput = (cloudDbUrlInput && cloudDbUrlInput.value && cloudDbUrlInput.value.trim()) || '';
    const fromConfig = (window.SRCC_CLOUD_CONFIG && window.SRCC_CLOUD_CONFIG.db_url && window.SRCC_CLOUD_CONFIG.db_url.trim()) || '';
    const fromStorage = localStorage.getItem(CLOUD_DB_STORAGE_KEY) || localStorage.getItem('srcc_cloud_db_url_custom') || '';

    const custom = fromStorage || fromInput || fromConfig;
    if (custom && custom.trim()) {
      return custom.trim();
    }
    return '';
  }

  function getBaseCloudDbUrl() {
    let url = getCloudDbUrl();
    if (!url) return '';
    if (url.endsWith('/leaves.json')) {
      url = url.substring(0, url.length - 12);
    }
    return url;
  }

  function getCloudDbSecret() {
    return localStorage.getItem(CLOUD_DB_SECRET_KEY) || '';
  }

  function setCloudDbUrl(url, secret) {
    if (url) {
      localStorage.setItem(CLOUD_DB_STORAGE_KEY, url);
      if (secret !== undefined) localStorage.setItem(CLOUD_DB_SECRET_KEY, secret);
      if (window.SRCC_CLOUD_CONFIG) window.SRCC_CLOUD_CONFIG.db_url = url;
    } else {
      localStorage.removeItem(CLOUD_DB_STORAGE_KEY);
      localStorage.removeItem(CLOUD_DB_SECRET_KEY);
      if (window.SRCC_CLOUD_CONFIG) window.SRCC_CLOUD_CONFIG.db_url = '';
    }
  }

  function updateCloudStatusBadge() {
    if (!cloudSyncStatusBadge) return;
    const url = getCloudDbUrl();
    if (url) {
      cloudSyncStatusBadge.textContent = '🟢 Cloud Live Sync Active';
      cloudSyncStatusBadge.style.background = 'rgba(16, 185, 129, 0.18)';
      cloudSyncStatusBadge.style.color = '#34D399';
      cloudSyncStatusBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
    } else {
      cloudSyncStatusBadge.textContent = '🟡 Local Only (Not Synced)';
      cloudSyncStatusBadge.style.background = 'rgba(245, 158, 11, 0.18)';
      cloudSyncStatusBadge.style.color = 'var(--srcc-gold)';
      cloudSyncStatusBadge.style.borderColor = 'rgba(245, 158, 11, 0.35)';
    }
  }

  async function syncUsersToCloud(usersList) {
    let baseUrl = getBaseCloudDbUrl();
    if (!baseUrl) return false;
    let url = baseUrl + '/users.json';
    
    const secret = getCloudDbSecret();
    if (secret) {
      url += (url.includes('?') ? '&' : '?') + 'auth=' + encodeURIComponent(secret);
    }

    try {
      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(usersList)
      });
      return res.ok;
    } catch (err) {
      console.error('Cloud sync users error:', err);
      return false;
    }
  }

  async function fetchUsersFromCloud() {
    let baseUrl = getBaseCloudDbUrl();
    if (!baseUrl) return null;
    let url = baseUrl + '/users.json';
    
    const secret = getCloudDbSecret();
    if (secret) {
      url += (url.includes('?') ? '&' : '?') + 'auth=' + encodeURIComponent(secret);
    }

    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return data;
        }
      }
    } catch (err) {
      console.error('Error fetching users from cloud:', err);
    }
    return null;
  }

  async function fetchLeavesFromCloud() {
    let baseUrl = getBaseCloudDbUrl();
    if (!baseUrl) return null;
    let url = baseUrl + '/leaves.json';
    
    const secret = getCloudDbSecret();
    if (secret) {
      url += (url.includes('?') ? '&' : '?') + 'auth=' + encodeURIComponent(secret);
    }

    try {
      const res = await fetch(url, { cache: 'no-cache' });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.leaves)) {
          return data.leaves;
        } else if (Array.isArray(data)) {
          return data;
        }
      }
    } catch (err) {
      console.warn('Error fetching leaves from cloud:', err);
    }
    return null;
  }

  async function syncLeavesToCloud(leavesList, showSuccessToast = false) {
    let baseUrl = getBaseCloudDbUrl();
    if (!baseUrl) return false;
    let url = baseUrl + '/leaves.json';
    
    const secret = getCloudDbSecret();
    if (secret) {
      url += (url.includes('?') ? '&' : '?') + 'auth=' + encodeURIComponent(secret);
    }

    try {
      const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const payload = {
        last_updated: todayStr,
        leaves: leavesList
      };

      const res = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        updateCloudStatusBadge();
        if (showSuccessToast) {
          showToast('☁️ <strong>Live Cloud Synced!</strong> All SRCC students will see this update instantly.', true, 4500);
        }
        return true;
      } else {
        console.warn('Cloud sync HTTP error:', res.status);
        showToast(`⚠️ Cloud Sync failed (HTTP ${res.status}). Check Firebase test rules.`, false);
        return false;
      }
    } catch (err) {
      console.error('Cloud sync network error:', err);
      showToast('⚠️ Could not connect to Cloud Database. Saved locally.', false);
      return false;
    }
  }

  // ==========================================================================
  // 🔒 ROOM LOCKS & EXTRA CLASSES MANAGEMENT
  // ==========================================================================
  const ROOM_LOCKS_STORAGE_KEY = 'srcc_room_locks_v1';

  function getRoomLocksList() {
    try {
      const stored = localStorage.getItem(ROOM_LOCKS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Error reading room locks:', e);
    }
    return [];
  }

  function saveRoomLocksList(list) {
    try {
      localStorage.setItem(ROOM_LOCKS_STORAGE_KEY, JSON.stringify(list));
      window.SRCC_ROOM_LOCKS = list;
    } catch (e) {
      console.error('Error saving room locks:', e);
    }
  }

  async function syncRoomLocksToCloud(locksList, showSuccessToast = false) {
    const baseUrl = getBaseCloudDbUrl();
    if (!baseUrl) return false;
    const secret = getCloudDbSecret();
    let url = baseUrl + '/room_locks.json';
    if (secret) url += '?auth=' + encodeURIComponent(secret);

    try {
      const resp = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(locksList)
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      if (showSuccessToast) showToast('☁️ Room locks synced with Cloud DB.');
      return true;
    } catch (e) {
      console.warn('Room locks cloud sync note:', e);
      return false;
    }
  }

  async function fetchCloudRoomLocks() {
    const baseUrl = getBaseCloudDbUrl();
    if (!baseUrl) return;
    try {
      const res = await fetch(baseUrl + '/room_locks.json');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          saveRoomLocksList(data);
          renderLocksTable();
          updateKpis();
        } else if (data && typeof data === 'object') {
          const list = Object.values(data);
          saveRoomLocksList(list);
          renderLocksTable();
          updateKpis();
        }
      }
    } catch (e) {
      console.warn('Could not fetch cloud room locks:', e);
    }
  }

  function populateRoomLockDropdown() {
    const select = document.getElementById('adminLockRoomSelect');
    if (!select) return;

    let rooms = [];
    if (appData && Array.isArray(appData.rooms) && appData.rooms.length > 0) {
      rooms = appData.rooms.map(r => ({ code: r.code, name: r.name, category: r.category }));
    } else {
      const rRooms = Array.from({ length: 35 }, (_, i) => ({ code: `R${i + 1}`, name: `Room ${i + 1}`, category: 'Classrooms' }));
      const tRooms = Array.from({ length: 48 }, (_, i) => ({ code: `T${i + 1}`, name: `Tutorial ${i + 1}`, category: 'Tutorials' }));
      const pbRooms = Array.from({ length: 12 }, (_, i) => ({ code: `PB-${i + 1}`, name: `PB Room ${i + 1}`, category: 'PB Wing' }));
      rooms = [...rRooms, ...tRooms, ...pbRooms, { code: 'SCR', name: 'Sports Complex', category: 'Sports' }, { code: 'Library FF', name: 'Library First Floor', category: 'Facility' }];
    }

    rooms.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

    select.innerHTML = rooms.map(r => {
      return `<option value="${escapeHtml(r.code)}">${escapeHtml(r.code)} · ${escapeHtml(r.name || r.code)} (${escapeHtml(r.category || 'Room')})</option>`;
    }).join('');
  }

  function renderLocksTable() {
    const container = document.getElementById('adminLocksListContainer');
    const countEl = document.getElementById('adminLocksCount');
    const kpiLocks = document.getElementById('kpiActiveLocks');
    const tabLocksBadge = document.getElementById('tabLocksBadge');

    const locks = getRoomLocksList();
    if (countEl) countEl.textContent = locks.length;
    if (kpiLocks) kpiLocks.textContent = locks.length;
    if (tabLocksBadge) {
      tabLocksBadge.textContent = locks.length;
      tabLocksBadge.style.display = locks.length > 0 ? 'inline-block' : 'none';
    }

    if (!container) return;

    if (locks.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 22px 14px; color: var(--text-muted); font-size: 0.86rem; background: #f8fafc; border: 1px dashed var(--border-color); border-radius: 8px;">
          🔒 No locked classrooms or extra classes active. All rooms follow the regular timetable.
        </div>
      `;
      return;
    }

    container.innerHTML = locks.map(lock => {
      const isExtra = lock.type === 'extra_class';
      const badgeClass = isExtra ? 'badge-extra' : 'badge-lock';
      const badgeIcon = isExtra ? '📚' : '🔒';
      const typeLabel = isExtra ? 'Extra Class' : 'Room Locked';
      const slotLabel = lock.slot === 'ALL_DAY' ? 'Full Day (8:30 AM – 6:00 PM)' : lock.slot;

      let recurrenceLabel = `📅 ${escapeHtml(lock.date || 'Today')}`;
      if (lock.recurrence === 'weekend') {
        recurrenceLabel = '🔁 Every Weekend (Sat & Sun)';
      } else if (lock.recurrence === 'daily') {
        recurrenceLabel = '🔁 Everyday (Mon–Sat)';
      } else if (lock.recurrence === 'weekly' && Array.isArray(lock.recurring_days) && lock.recurring_days.length > 0) {
        recurrenceLabel = `🔁 Every ${lock.recurring_days.join(', ')}`;
      }

      return `
        <div class="leave-item-row" style="border-left: 4px solid ${isExtra ? '#3b82f6' : '#ef4444'};">
          <div class="leave-item-details">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 3px;">
              <span style="font-weight: 800; font-size: 0.95rem; color: var(--text-primary);">${escapeHtml(lock.room)}</span>
              <span class="room-lock-badge ${badgeClass}">${badgeIcon} ${typeLabel}</span>
              <span style="font-size: 0.74rem; color: var(--text-secondary); background: #f1f5f9; padding: 2px 7px; border-radius: 4px; font-weight: 600;">🕒 ${escapeHtml(slotLabel)}</span>
            </div>
            <div style="font-size: 0.82rem; color: var(--text-secondary); display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span style="color: #2563eb; font-weight: 700;">${recurrenceLabel}</span>
              ${lock.title ? `<span>·</span><span style="font-weight: 600; color: var(--text-primary);">"${escapeHtml(lock.title)}"</span>` : ''}
              ${lock.added_by ? `<span style="font-size: 0.72rem; color: var(--text-muted);">(By ${escapeHtml(lock.added_by)})</span>` : ''}
            </div>
          </div>
          <div style="display: flex; gap: 6px; align-items: center;">
            <button type="button" class="btn-edit-leave" onclick="editRoomLock('${escapeHtml(lock.id)}')" title="Edit lock parameters">
              ✏️ Edit
            </button>
            <button type="button" class="btn-delete-leave" onclick="deleteRoomLock('${escapeHtml(lock.id)}')" title="Unlock classroom">
              🔓 Unlock
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  let editingLockId = null;

  window.editRoomLock = function(lockId) {
    const locks = getRoomLocksList();
    const lock = locks.find(l => l.id === lockId);
    if (!lock) return;

    editingLockId = lock.id;
    const roomSelect = document.getElementById('adminLockRoomSelect');
    const lockType = document.getElementById('adminLockType');
    const lockSlot = document.getElementById('adminLockSlot');
    const recurrenceSelect = document.getElementById('adminLockRecurrence');
    const lockDate = document.getElementById('adminLockDate');
    const lockTitle = document.getElementById('adminLockTitle');
    const btnAddLock = document.getElementById('btnAdminAddLock');
    const btnCancel = document.getElementById('btnAdminCancelLockEdit');
    const daysGroup = document.getElementById('adminLockDaysGroup');

    if (roomSelect) roomSelect.value = lock.room;
    if (lockType) lockType.value = lock.type || 'lock';
    if (lockSlot) lockSlot.value = lock.slot || 'ALL_DAY';
    if (recurrenceSelect) {
      recurrenceSelect.value = lock.recurrence || 'once';
      if (daysGroup) daysGroup.style.display = (lock.recurrence === 'weekly') ? 'block' : 'none';
    }
    if (lockDate) lockDate.value = lock.date || getTodayIsoDate();
    if (lockTitle) lockTitle.value = lock.title || '';

    // If weekly recurrence, check matching checkboxes
    if (Array.isArray(lock.recurring_days)) {
      document.querySelectorAll('.lock-day-check').forEach(cb => {
        cb.checked = lock.recurring_days.includes(cb.value);
      });
    }

    if (btnAddLock) {
      btnAddLock.innerHTML = '💾 Update Room Lock / Extra Class';
      btnAddLock.style.background = 'linear-gradient(135deg, #2563eb, #1d4ed8)';
    }
    if (btnCancel) btnCancel.style.display = 'inline-block';

    const lockCard = document.getElementById('adminLockRoomSelect');
    if (lockCard) lockCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showToast(`✏️ Editing lock for <strong>${escapeHtml(lock.room)}</strong>. Adjust fields and click Update.`);
  };

  function resetRoomLockForm() {
    editingLockId = null;
    const lockTitle = document.getElementById('adminLockTitle');
    const btnAddLock = document.getElementById('btnAdminAddLock');
    const btnCancel = document.getElementById('btnAdminCancelLockEdit');
    if (lockTitle) lockTitle.value = '';
    if (btnAddLock) {
      btnAddLock.innerHTML = '🔒 Push Room Lock / Extra Class';
      btnAddLock.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
    }
    if (btnCancel) btnCancel.style.display = 'none';
    document.querySelectorAll('.lock-day-check').forEach(cb => { cb.checked = false; });
  }

  window.deleteRoomLock = async function(lockId) {
    const user = getActiveSessionUser();
    if (!user || !user.username) {
      showToast('⚠️ Admin authentication required to unlock rooms.', false);
      return;
    }
    let locks = getRoomLocksList();
    const target = locks.find(l => l.id === lockId);
    locks = locks.filter(l => l.id !== lockId);
    saveRoomLocksList(locks);
    renderLocksTable();
    updateKpis();
    syncRoomLocksToCloud(locks, false);
    if (editingLockId === lockId) resetRoomLockForm();
    showToast(`🔓 Classroom <strong>${target ? target.room : ''}</strong> unlocked successfully.`);
  };

  function initRoomLocksListeners() {
    const btnAddLock = document.getElementById('btnAdminAddLock');
    const btnCancelLock = document.getElementById('btnAdminCancelLockEdit');
    const recurrenceSelect = document.getElementById('adminLockRecurrence');
    const daysGroup = document.getElementById('adminLockDaysGroup');
    const dateFieldGroup = document.getElementById('adminLockDateFieldGroup');

    if (btnCancelLock) {
      btnCancelLock.addEventListener('click', () => {
        resetRoomLockForm();
        showToast('Cancelled room lock edit.');
      });
    }

    if (recurrenceSelect) {
      recurrenceSelect.addEventListener('change', () => {
        const val = recurrenceSelect.value;
        if (daysGroup) {
          daysGroup.style.display = (val === 'weekly') ? 'block' : 'none';
        }
      });
    }

    if (btnAddLock) {
      btnAddLock.addEventListener('click', () => {
        const roomSelect = document.getElementById('adminLockRoomSelect');
        const lockType = document.getElementById('adminLockType');
        const lockSlot = document.getElementById('adminLockSlot');
        const lockDate = document.getElementById('adminLockDate');
        const lockTitle = document.getElementById('adminLockTitle');

        const room = (roomSelect ? roomSelect.value : '').trim();
        const type = (lockType ? lockType.value : 'lock').trim();
        const slot = (lockSlot ? lockSlot.value : 'ALL_DAY').trim();
        const recurrence = (recurrenceSelect ? recurrenceSelect.value : 'once').trim();
        const date = (lockDate ? lockDate.value : getTodayIsoDate()).trim();
        const title = (lockTitle ? lockTitle.value : '').trim();

        if (!room) {
          showToast('⚠️ Please select a classroom to lock.', false);
          return;
        }

        let recurringDays = [];
        if (recurrence === 'weekly') {
          const checked = Array.from(document.querySelectorAll('.lock-day-check:checked')).map(c => c.value);
          if (checked.length === 0) {
            showToast('⚠️ Please select at least one day of the week for weekly recurrence.', false);
            return;
          }
          recurringDays = checked;
        } else if (recurrence === 'weekend') {
          recurringDays = ['Saturday', 'Sunday'];
        } else if (recurrence === 'daily') {
          recurringDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        }

        const activeUser = getActiveSessionUser();
        let locks = getRoomLocksList();

        if (editingLockId) {
          const idx = locks.findIndex(l => l.id === editingLockId);
          if (idx !== -1) {
            locks[idx] = {
              ...locks[idx],
              room: room,
              type: type,
              slot: slot,
              recurrence: recurrence,
              recurring_days: recurringDays,
              date: date || getTodayIsoDate(),
              title: title || (type === 'extra_class' ? 'Special Lecture Scheduled' : 'Room Reserved / Locked'),
              updated_by: activeUser.fullName || 'Admin',
              updated_at: new Date().toISOString()
            };
            saveRoomLocksList(locks);
            renderLocksTable();
            updateKpis();
            syncRoomLocksToCloud(locks, true);
            resetRoomLockForm();
            showToast(`💾 <strong>Room ${room}</strong> lock updated successfully!`);
            return;
          }
        }

        const newLock = {
          id: 'lock_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          room: room,
          type: type,
          slot: slot,
          recurrence: recurrence,
          recurring_days: recurringDays,
          date: date || getTodayIsoDate(),
          title: title || (type === 'extra_class' ? 'Special Lecture Scheduled' : 'Room Reserved / Locked'),
          added_by: activeUser.fullName || 'Admin',
          created_at: new Date().toISOString()
        };

        locks.unshift(newLock);
        saveRoomLocksList(locks);
        renderLocksTable();
        updateKpis();
        syncRoomLocksToCloud(locks, true);
        resetRoomLockForm();

        showToast(`🔒 <strong>Room ${room}</strong> locked successfully (${recurrence === 'once' ? 'One-time' : recurrence})! Live for all students.`);
      });
    }

    const btnClearLocks = document.getElementById('btnAdminClearAllLocks');
    if (btnClearLocks) {
      btnClearLocks.addEventListener('click', () => {
        if (confirm('Unlock all classrooms and remove all active extra class notices?')) {
          saveRoomLocksList([]);
          renderLocksTable();
          updateKpis();
          syncRoomLocksToCloud([], false);
          resetRoomLockForm();
          showToast('🔓 All classrooms unlocked and notices cleared.');
        }
      });
    }

    const lockDateInput = document.getElementById('adminLockDate');
    if (lockDateInput && !lockDateInput.value) {
      lockDateInput.value = getTodayIsoDate();
    }
  }

  // ==========================================================================
  // 📢 CAMPUS NOTICES & BANNERS (Freshers, Elections, Official Circulars)
  // ==========================================================================
  const CAMPUS_NOTICES_STORAGE_KEY = 'srcc_campus_notices_v1';
  let pendingNoticeAttachment = null;

  function getCampusNoticesList() {
    try {
      const stored = localStorage.getItem(CAMPUS_NOTICES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error('Error reading campus notices:', e);
    }
    return [];
  }

  function saveCampusNoticesList(list) {
    try {
      localStorage.setItem(CAMPUS_NOTICES_STORAGE_KEY, JSON.stringify(list));
      window.SRCC_CAMPUS_NOTICES = list;
    } catch (e) {
      console.error('Error saving campus notices:', e);
    }
  }

  async function syncCampusNoticesToCloud(noticesList, showSuccessToast = false) {
    const baseUrl = getBaseCloudDbUrl();
    if (!baseUrl) return false;
    const secret = getCloudDbSecret();
    let url = baseUrl + '/campus_notices.json';
    if (secret) url += '?auth=' + encodeURIComponent(secret);

    try {
      const resp = await fetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(noticesList)
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      if (showSuccessToast) showToast('☁️ Campus notices synced with Cloud DB.');
      return true;
    } catch (e) {
      console.warn('Campus notices cloud sync note:', e);
      return false;
    }
  }

  async function fetchCloudCampusNotices() {
    const baseUrl = getBaseCloudDbUrl();
    if (!baseUrl) return;
    try {
      const res = await fetch(baseUrl + '/campus_notices.json');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          saveCampusNoticesList(data);
          renderCampusNoticesTable();
        } else if (data && typeof data === 'object') {
          const list = Object.values(data);
          saveCampusNoticesList(list);
          renderCampusNoticesTable();
        }
      }
    } catch (e) {
      console.warn('Could not fetch cloud campus notices:', e);
    }
  }

  function renderCampusNoticesTable() {
    const container = document.getElementById('adminNoticesListContainer');
    const countEl = document.getElementById('adminNoticesCount');
    const kpiNotices = document.getElementById('kpiActiveNotices');
    const tabNoticesBadge = document.getElementById('tabNoticesBadge');

    const notices = getCampusNoticesList();
    if (countEl) countEl.textContent = notices.length;
    if (kpiNotices) kpiNotices.textContent = notices.length;
    if (tabNoticesBadge) {
      tabNoticesBadge.textContent = notices.length;
      tabNoticesBadge.style.display = notices.length > 0 ? 'inline-block' : 'none';
    }

    if (!container) return;

    if (notices.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 22px 14px; color: var(--text-muted); font-size: 0.86rem; background: #f8fafc; border: 1px dashed var(--border-color); border-radius: 8px;">
          📢 No active campus notices or banners published. Students will see no banners on their main screen.
        </div>
      `;
      return;
    }

    const categoryBadges = {
      freshers: '<span class="campus-notice-badge badge-notice-freshers">🎉 Freshers 2026</span>',
      elections: '<span class="campus-notice-badge badge-notice-elections">🗳️ Student Elections</span>',
      circular: '<span class="campus-notice-badge badge-notice-circular">📢 Circular</span>',
      societies: '<span class="campus-notice-badge badge-notice-societies">🏆 Societies</span>',
      urgent: '<span class="campus-notice-badge badge-notice-urgent">📌 Urgent Alert</span>'
    };

    container.innerHTML = notices.map(n => {
      const catBadge = categoryBadges[n.category] || categoryBadges.circular;
      const eventBadge = n.event_date ? `<span class="campus-notice-event-date">🗓️ Event: ${escapeHtml(n.event_date)}</span>` : '';
      const expiryText = n.expiry_date ? `📅 Expires: ${escapeHtml(n.expiry_date)}` : '📅 No Expiry';
      const hasAttachment = n.attachment && n.attachment.dataUrl;

      return `
        <div class="leave-item-row" style="border-left: 4px solid #d97706;">
          <div class="leave-item-details" style="width: 100%;">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px;">
              ${catBadge}
              ${eventBadge}
              <span style="font-weight: 800; font-size: 0.95rem; color: var(--text-primary);">${escapeHtml(n.title)}</span>
              <span style="font-size: 0.72rem; color: var(--text-muted);">${expiryText}</span>
            </div>
            ${n.body ? `<div style="font-size: 0.82rem; color: #475569; margin-bottom: 6px; white-space: pre-line;">${escapeHtml(n.body)}</div>` : ''}
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 4px;">
              ${hasAttachment ? `
                <button type="button" class="btn-notice-attachment" onclick="openAdminAttachment('${escapeHtml(n.id)}')" style="font-size: 0.74rem; padding: 4px 10px;">
                  📎 View ${n.attachment.type === 'pdf' ? 'PDF Circular' : 'Poster Image'} (${escapeHtml(n.attachment.name || 'File')})
                </button>
              ` : '<span style="font-size: 0.72rem; color: var(--text-muted);">No file attached</span>'}
              ${n.published_by ? `<span style="font-size: 0.72rem; color: var(--text-muted); margin-left: auto;">By ${escapeHtml(n.published_by)}</span>` : ''}
            </div>
          </div>
          <div style="display: flex; gap: 6px; align-items: center;">
            <button type="button" class="btn-edit-leave" onclick="editCampusNotice('${escapeHtml(n.id)}')" title="Edit notice">
              ✏️ Edit
            </button>
            <button type="button" class="btn-delete-leave" onclick="deleteCampusNotice('${escapeHtml(n.id)}')" title="Delete notice banner">
              ✕ Delete
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  let editingNoticeId = null;

  window.editCampusNotice = function(noticeId) {
    const notices = getCampusNoticesList();
    const notice = notices.find(n => n.id === noticeId);
    if (!notice) return;

    editingNoticeId = notice.id;
    const catSelect = document.getElementById('adminNoticeCategory');
    const eventDateInput = document.getElementById('adminNoticeEventDate');
    const expiryInput = document.getElementById('adminNoticeExpiry');
    const titleInput = document.getElementById('adminNoticeTitle');
    const bodyInput = document.getElementById('adminNoticeBody');
    const btnPublish = document.getElementById('btnAdminPublishNotice');
    const btnCancel = document.getElementById('btnAdminCancelNoticeEdit');
    const previewText = document.getElementById('noticeFilePreviewText');
    const btnClearFile = document.getElementById('btnClearNoticeFile');

    if (catSelect) catSelect.value = notice.category || 'circular';
    if (eventDateInput) eventDateInput.value = notice.event_date || '';
    if (expiryInput) expiryInput.value = notice.expiry_date || '';
    if (titleInput) titleInput.value = notice.title || '';
    if (bodyInput) bodyInput.value = notice.body || '';

    if (notice.attachment) {
      pendingNoticeAttachment = notice.attachment;
      if (previewText) {
        previewText.textContent = `📎 Current attachment: ${notice.attachment.name || 'File'} (${notice.attachment.type === 'pdf' ? 'PDF' : 'Image'})`;
        previewText.style.display = 'block';
      }
      if (btnClearFile) btnClearFile.style.display = 'inline-block';
    } else {
      pendingNoticeAttachment = null;
      if (previewText) previewText.style.display = 'none';
      if (btnClearFile) btnClearFile.style.display = 'none';
    }

    if (btnPublish) {
      btnPublish.innerHTML = '💾 Update Campus Notice';
      btnPublish.style.background = 'linear-gradient(135deg, #2563eb, #1d4ed8)';
      btnPublish.style.color = '#ffffff';
    }
    if (btnCancel) btnCancel.style.display = 'inline-block';

    const formEl = document.getElementById('adminNoticeTitle');
    if (formEl) formEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    showToast(`✏️ Editing notice <strong>"${escapeHtml(notice.title)}"</strong>. Modify fields and click Update.`);
  };

  function resetCampusNoticeForm() {
    editingNoticeId = null;
    const eventDateInput = document.getElementById('adminNoticeEventDate');
    const expiryInput = document.getElementById('adminNoticeExpiry');
    const titleInput = document.getElementById('adminNoticeTitle');
    const bodyInput = document.getElementById('adminNoticeBody');
    const fileInput = document.getElementById('adminNoticeFileInput');
    const previewText = document.getElementById('noticeFilePreviewText');
    const btnClearFile = document.getElementById('btnClearNoticeFile');
    const btnPublish = document.getElementById('btnAdminPublishNotice');
    const btnCancel = document.getElementById('btnAdminCancelNoticeEdit');

    if (eventDateInput) eventDateInput.value = '';
    if (expiryInput) expiryInput.value = '';
    if (titleInput) titleInput.value = '';
    if (bodyInput) bodyInput.value = '';
    if (fileInput) fileInput.value = '';
    if (previewText) previewText.style.display = 'none';
    if (btnClearFile) btnClearFile.style.display = 'none';
    pendingNoticeAttachment = null;

    if (btnPublish) {
      btnPublish.innerHTML = '📢 Publish Campus Notice Banner (Live for Students)';
      btnPublish.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
      btnPublish.style.color = '#070d18';
    }
    if (btnCancel) btnCancel.style.display = 'none';
  }

  window.deleteCampusNotice = async function(noticeId) {
    const user = getActiveSessionUser();
    if (!user || !user.username) {
      showToast('⚠️ Admin authentication required to delete campus notices.', false);
      return;
    }
    let notices = getCampusNoticesList();
    const target = notices.find(n => n.id === noticeId);
    notices = notices.filter(n => n.id !== noticeId);
    saveCampusNoticesList(notices);
    renderCampusNoticesTable();
    syncCampusNoticesToCloud(notices, false);
    if (editingNoticeId === noticeId) resetCampusNoticeForm();
    showToast(`🗑️ Notice <strong>"${target ? target.title : ''}"</strong> removed.`);
  };

  window.openAdminAttachment = function(noticeId) {
    const notices = getCampusNoticesList();
    const notice = notices.find(n => n.id === noticeId);
    if (!notice || !notice.attachment) return;
    openAttachmentViewer(notice.title, notice.attachment);
  };

  function openAttachmentViewer(title, attachment) {
    const overlay = document.getElementById('attachmentModalOverlay');
    const titleEl = document.getElementById('attachmentModalTitle');
    const bodyEl = document.getElementById('attachmentModalBody');

    if (!overlay || !bodyEl) return;
    if (titleEl) titleEl.textContent = title || 'Notice Attachment';

    if (attachment.type === 'pdf') {
      bodyEl.innerHTML = `
        <iframe src="${attachment.dataUrl}" style="width: 100%; height: 70vh; border: none; border-radius: 6px;"></iframe>
        <div style="margin-top: 10px; display: flex; justify-content: flex-end;">
          <a href="${attachment.dataUrl}" download="${escapeHtml(attachment.name || 'SRCC_Notice.pdf')}" class="btn-primary" style="text-decoration: none; font-size: 0.8rem; padding: 6px 14px;">
            ⬇️ Download PDF
          </a>
        </div>
      `;
    } else {
      bodyEl.innerHTML = `
        <div style="text-align: center;">
          <img src="${attachment.dataUrl}" alt="Notice Attachment" style="max-width: 100%; max-height: 70vh; object-fit: contain; border-radius: 6px;" />
          <div style="margin-top: 10px; display: flex; justify-content: flex-end;">
            <a href="${attachment.dataUrl}" download="${escapeHtml(attachment.name || 'SRCC_Poster.png')}" class="btn-primary" style="text-decoration: none; font-size: 0.8rem; padding: 6px 14px;">
              ⬇️ Download Image
            </a>
          </div>
        </div>
      `;
    }

    overlay.style.display = 'flex';
  }

  function initAttachmentModal() {
    const overlay = document.getElementById('attachmentModalOverlay');
    const btnClose = document.getElementById('btnCloseAttachmentModal');
    if (btnClose && overlay) {
      btnClose.addEventListener('click', () => { overlay.style.display = 'none'; });
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.style.display = 'none';
      });
    }
  }

  function initCampusNoticesListeners() {
    const fileInput = document.getElementById('adminNoticeFileInput');
    const btnClearFile = document.getElementById('btnClearNoticeFile');
    const previewText = document.getElementById('noticeFilePreviewText');
    const btnPublish = document.getElementById('btnAdminPublishNotice');
    const btnCancel = document.getElementById('btnAdminCancelNoticeEdit');
    const btnClearAll = document.getElementById('btnAdminClearAllNotices');

    if (btnCancel) {
      btnCancel.addEventListener('click', () => {
        resetCampusNoticeForm();
        showToast('Cancelled notice edit.');
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) {
          pendingNoticeAttachment = null;
          if (previewText) previewText.style.display = 'none';
          if (btnClearFile) btnClearFile.style.display = 'none';
          return;
        }

        if (file.size > 3.8 * 1024 * 1024) {
          showToast('⚠️ File is larger than 3.5MB. Please choose a smaller compressed image or PDF.', false);
          fileInput.value = '';
          return;
        }

        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        const reader = new FileReader();
        reader.onload = function(evt) {
          pendingNoticeAttachment = {
            name: file.name,
            type: isPdf ? 'pdf' : 'image',
            size: file.size,
            dataUrl: evt.target.result
          };
          if (previewText) {
            const kb = Math.round(file.size / 1024);
            previewText.textContent = `📎 Ready to attach: ${file.name} (${kb} KB, ${isPdf ? 'PDF' : 'Image'})`;
            previewText.style.display = 'block';
          }
          if (btnClearFile) btnClearFile.style.display = 'inline-block';
        };
        reader.readAsDataURL(file);
      });
    }

    if (btnClearFile) {
      btnClearFile.addEventListener('click', () => {
        pendingNoticeAttachment = null;
        if (fileInput) fileInput.value = '';
        if (previewText) previewText.style.display = 'none';
        btnClearFile.style.display = 'none';
      });
    }

    if (btnPublish) {
      btnPublish.addEventListener('click', () => {
        const catSelect = document.getElementById('adminNoticeCategory');
        const eventDateInput = document.getElementById('adminNoticeEventDate');
        const expiryInput = document.getElementById('adminNoticeExpiry');
        const titleInput = document.getElementById('adminNoticeTitle');
        const bodyInput = document.getElementById('adminNoticeBody');

        const category = (catSelect ? catSelect.value : 'circular').trim();
        const eventDate = (eventDateInput ? eventDateInput.value : '').trim();
        const expiry = (expiryInput ? expiryInput.value : '').trim();
        const title = (titleInput ? titleInput.value : '').trim();
        const body = (bodyInput ? bodyInput.value : '').trim();

        if (!title) {
          showToast('⚠️ Please enter a notice title or headline.', false);
          if (titleInput) titleInput.focus();
          return;
        }

        const activeUser = getActiveSessionUser();
        let notices = getCampusNoticesList();

        if (editingNoticeId) {
          const idx = notices.findIndex(n => n.id === editingNoticeId);
          if (idx !== -1) {
            notices[idx] = {
              ...notices[idx],
              category: category,
              event_date: eventDate,
              expiry_date: expiry,
              title: title,
              body: body,
              attachment: pendingNoticeAttachment || notices[idx].attachment || null,
              updated_by: activeUser.fullName || 'Admin',
              updated_at: new Date().toISOString()
            };
            saveCampusNoticesList(notices);
            renderCampusNoticesTable();
            syncCampusNoticesToCloud(notices, true);
            resetCampusNoticeForm();
            showToast(`📢 <strong>Notice updated!</strong> "${title}" is live.`);

            if (document.getElementById('adminNoticePushBroadcast')?.checked) {
              dispatchNoticeBroadcast(title, body, category);
            }
            return;
          }
        }

        const newNotice = {
          id: 'notice_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          category: category,
          event_date: eventDate,
          title: title,
          body: body,
          expiry_date: expiry,
          attachment: pendingNoticeAttachment || null,
          published_by: activeUser.fullName || 'Admin',
          created_at: new Date().toISOString()
        };

        notices.unshift(newNotice);
        saveCampusNoticesList(notices);
        renderCampusNoticesTable();
        syncCampusNoticesToCloud(notices, true);
        resetCampusNoticeForm();

        showToast(`📢 <strong>Notice published!</strong> "${title}" is now live on student screens.`);

        if (document.getElementById('adminNoticePushBroadcast')?.checked) {
          dispatchNoticeBroadcast(title, body, category);
        }
      });
    }

    if (btnClearAll) {
      btnClearAll.addEventListener('click', () => {
        if (confirm('Clear all active campus notices and banners? Student screens will display no banners.')) {
          saveCampusNoticesList([]);
          renderCampusNoticesTable();
          syncCampusNoticesToCloud([], false);
          resetCampusNoticeForm();
          showToast('🗑️ All campus notices cleared.');
        }
      });
    }
  }

  function dispatchNoticeBroadcast(title, body, category) {
    const isTimetable = (category === 'timetable_change');
    const notifTitle = isTimetable ? `⚠️ Timetable Notice: ${title}` : `📢 Campus Notice: ${title}`;
    const notifBody = body ? (body.length > 120 ? body.substring(0, 117) + '...' : body) : 'New announcement published by College Admin.';

    // 1. Dispatch to Firebase Cloud Realtime DB trigger for instant student sync
    const baseUrl = getBaseCloudDbUrl();
    if (baseUrl) {
      const secret = getCloudDbSecret();
      let trigUrl = `${baseUrl}/broadcast_triggers/latest.json`;
      if (secret) trigUrl += `?auth=${encodeURIComponent(secret)}`;
      fetch(trigUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: notifTitle,
          body: notifBody,
          timestamp: Date.now(),
          category: category,
          sentBy: getActiveSessionUser().fullName || 'Admin'
        })
      }).catch(() => {});
    }

    // 2. Dispatch to Netlify Serverless Web Push
    fetch('/.netlify/functions/push_dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: notifTitle,
        body: notifBody,
        url: isTimetable ? './?mode=timetable' : './'
      })
    }).then(res => res.json()).then(resData => {
      if (resData && resData.count !== undefined) {
        showToast(`🔔 <strong>Instant Push Dispatched!</strong> Reached ${resData.count} device(s).`);
      }
    }).catch(() => {});
  }

  // ==========================================================================
  // 📑 TAB NAVIGATION & LIVE DATE DISPLAY
  // ==========================================================================
  function setupAdminTabs() {
    const adminTabBtns = document.querySelectorAll('.admin-tab-btn');
    const tabPanes = {
      leaves: document.getElementById('tabContentLeaves'),
      locks: document.getElementById('tabContentLocks'),
      notices: document.getElementById('tabContentNotices'),
      rooms: document.getElementById('tabContentRooms'),
      wifi: document.getElementById('tabContentWifi'),
      broadcast: document.getElementById('tabContentBroadcast'),
      reports: document.getElementById('tabContentReports'),
      settings: document.getElementById('tabContentSettings'),
      print: document.getElementById('tabContentPrint')
    };

    adminTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.tab;
        adminTabBtns.forEach(b => b.classList.toggle('active', b === btn));
        Object.entries(tabPanes).forEach(([tabName, el]) => {
          if (el) el.classList.toggle('active', tabName === target);
        });
        if (target === 'print') {
          renderPrintSheets();
        }
      });
    });

    const dateDisplay = document.getElementById('adminLiveDateDisplay');
    if (dateDisplay) {
      const now = new Date();
      dateDisplay.textContent = now.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' });
    }
  }

  // ==========================================================================
  // 📊 DASHBOARD INITIALIZATION
  // ==========================================================================
  function initDashboard() {
    populateTeacherSelect();
    populateRoomLockDropdown();
    setDefaultDates();
    renderLeavesTable();
    renderLocksTable();
    renderCampusNoticesTable();
    renderRoomsTable();
    renderWifiTable();
    updateKpis();
    updateCodePreview();
    setupAdminTabs();
    initRoomLocksListeners();
    initCampusNoticesListeners();
    initRoomsListeners();
    initWifiListeners();
    initPrintSheets();
    initAttachmentModal();
    fetchCloudRoomLocks();
    fetchCloudCampusNotices();
    fetchCloudRoomOverrides();
    fetchCloudCampusWifi();

    // Populate Cloud DB URL & Status
    if (cloudDbUrlInput) {
      cloudDbUrlInput.value = getCloudDbUrl();
    }
    if (cloudDbSecretInput) {
      cloudDbSecretInput.value = getCloudDbSecret();
    }
    updateCloudStatusBadge();

    // User Management & Password Reset
    updateActiveUserDisplay();
    renderAdminUsersList();
  }

  function setDefaultDates() {
    const today = getTodayIsoDate();
    if (adminStartDate && !adminStartDate.value) adminStartDate.value = today;
    if (adminEndDate && !adminEndDate.value) adminEndDate.value = today;
  }

  // Quick date handlers
  if (btnQuickToday) {
    btnQuickToday.addEventListener('click', () => {
      const today = getTodayIsoDate();
      if (adminStartDate) adminStartDate.value = today;
      if (adminEndDate) adminEndDate.value = today;
    });
  }

  if (btnQuickTomorrow) {
    btnQuickTomorrow.addEventListener('click', () => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      const iso = d.toISOString().split('T')[0];
      if (adminStartDate) adminStartDate.value = iso;
      if (adminEndDate) adminEndDate.value = iso;
    });
  }

  if (btnQuickThisWeek) {
    btnQuickThisWeek.addEventListener('click', () => {
      const start = new Date();
      const end = new Date();
      end.setDate(end.getDate() + 3);
      if (adminStartDate) adminStartDate.value = start.toISOString().split('T')[0];
      if (adminEndDate) adminEndDate.value = end.toISOString().split('T')[0];
    });
  }

  let selectedTeacherIds = new Set();

  function updateSelectedTeacherCount() {
    const countEl = document.getElementById('adminSelectedTeacherCount');
    const clearBtn = document.getElementById('btnClearSelectedTeachers');
    const count = selectedTeacherIds.size;
    if (countEl) {
      if (count === 0) {
        countEl.textContent = '0 professors selected (click to select)';
        countEl.style.color = 'var(--text-muted)';
      } else {
        countEl.textContent = `✅ ${count} professor${count > 1 ? 's' : ''} selected`;
        countEl.style.color = '#16a34a';
      }
    }
    if (clearBtn) {
      clearBtn.style.display = count > 0 ? 'inline-block' : 'none';
    }
  }

  // Teacher Search & Select
  function populateTeacherSelect(filterQuery = '') {
    if (!adminTeacherSelect || !teachersData || !teachersData.teachers) return;
    const q = filterQuery.trim().toLowerCase();

    let filtered = [...teachersData.teachers];
    if (q) {
      filtered = filtered.filter(t => {
        const name = (t.clean_name || '').toLowerCase();
        const code = (t.short_code || '').toLowerCase();
        const dept = (t.department || '').toLowerCase();
        return name.includes(q) || code.includes(q) || dept.includes(q);
      });
    }

    filtered.sort((a, b) => a.clean_name.localeCompare(b.clean_name));

    adminTeacherSelect.innerHTML = filtered.map(t => {
      const code = getDisplayShortCode(t);
      const codeStr = code ? ` [${escapeHtml(code)}]` : '';
      const isChecked = selectedTeacherIds.has(String(t.id));
      const bgStyle = isChecked ? 'background: #EFF6FF; border-left: 3px solid #2563EB;' : 'background: #ffffff; border-left: 3px solid transparent;';
      return `
        <label class="teacher-checkbox-item" data-teacher-id="${escapeHtml(t.id)}" style="display:flex; align-items:center; gap:10px; padding:6px 8px; cursor:pointer; border-bottom:1px solid var(--border-subtle); transition: background 0.15s ease; ${bgStyle}">
          <input type="checkbox" value="${escapeHtml(t.id)}" class="teacher-checkbox-input" ${isChecked ? 'checked' : ''} style="width:16px; height:16px; cursor:pointer;" />
          <span style="font-size: 0.85rem; color: var(--text-primary); pointer-events: none;">
            ${escapeHtml(t.clean_name)}${codeStr} — <span style="color:var(--text-secondary);">${escapeHtml(t.department)} (${t.total_teaching_periods || 0} classes/wk)</span>
          </span>
        </label>
      `;
    }).join('');

    updateSelectedTeacherCount();

    // Attach listeners to update state
    adminTeacherSelect.querySelectorAll('.teacher-checkbox-input').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const row = e.target.closest('.teacher-checkbox-item');
        if (e.target.checked) {
          selectedTeacherIds.add(e.target.value);
          if (row) {
            row.style.background = '#EFF6FF';
            row.style.borderLeft = '3px solid #2563EB';
          }
        } else {
          selectedTeacherIds.delete(e.target.value);
          if (row) {
            row.style.background = '#ffffff';
            row.style.borderLeft = '3px solid transparent';
          }
        }
        updateSelectedTeacherCount();
      });
    });
  }

  if (adminTeacherSearch) {
    adminTeacherSearch.addEventListener('input', (e) => {
      populateTeacherSelect(e.target.value);
    });
    adminTeacherSearch.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const firstCb = adminTeacherSelect ? adminTeacherSelect.querySelector('.teacher-checkbox-input') : null;
        if (firstCb) {
          firstCb.checked = !firstCb.checked;
          firstCb.dispatchEvent(new Event('change'));
        }
      }
    });
  }

  const btnClearSelectedTeachers = document.getElementById('btnClearSelectedTeachers');
  if (btnClearSelectedTeachers) {
    btnClearSelectedTeachers.addEventListener('click', () => {
      selectedTeacherIds.clear();
      populateTeacherSelect(adminTeacherSearch ? adminTeacherSearch.value : '');
    });
  }

  // Undo state
  let lastAddedLeaveIds = [];

  window.undoLastLeaves = function() {
    if (lastAddedLeaveIds.length === 0) return;
    let current = getLeavesList();
    current = current.filter(l => !lastAddedLeaveIds.includes(l.id));
    saveLeavesList(current);
    renderLeavesTable();
    updateKpis();
    updateCodePreview();
    syncLeavesToCloud(current, false);
    lastAddedLeaveIds = [];
    showToast('↩️ <strong>Undone!</strong> The leaves have been removed.');
  };

  // Add Leave Handler
  if (btnAdminAddLeave) {
    btnAdminAddLeave.addEventListener('click', () => {
      const selectedOptions = Array.from(selectedTeacherIds);
      if (selectedOptions.length === 0) {
        showToast('⚠️ Please select at least one professor from the list first', false);
        return;
      }

      const sDate = adminStartDate ? adminStartDate.value : getTodayIsoDate();
      const eDate = adminEndDate ? adminEndDate.value : sDate;
      const reason = (adminLeaveReason && adminLeaveReason.value.trim()) || 'Faculty Leave';
      const isHalfDay = document.getElementById('adminHalfDayLeave') && document.getElementById('adminHalfDayLeave').checked;
      const activeUser = getActiveSessionUser();
      const addedBy = activeUser ? activeUser.fullName : 'Admin';

      if (eDate < sDate) {
        showToast('⚠️ End date cannot be before start date', false);
        return;
      }

      const current = getLeavesList();
      lastAddedLeaveIds = [];
      let names = [];

      selectedOptions.forEach(optVal => {
        const teacher = teachersData.teachers.find(t => String(t.id) === String(optVal));
        if (!teacher) return;
        
        // Upsert: Remove existing leave for this teacher so the latest update takes precedence without duplication
        const existingIdx = current.findIndex(l => 
          (l.teacher_id && String(l.teacher_id) === String(teacher.id)) ||
          (l.teacher_name && l.teacher_name.toLowerCase().trim() === teacher.clean_name.toLowerCase().trim())
        );
        if (existingIdx !== -1) {
          current.splice(existingIdx, 1);
        }

        const newLeave = {
          id: 'leave_' + Date.now() + '_' + Math.floor(Math.random()*1000),
          teacher_id: teacher.id,
          teacher_name: teacher.clean_name,
          teacher_code: getDisplayShortCode(teacher) || teacher.short_code,
          department: teacher.department,
          start_date: sDate,
          end_date: eDate,
          reason: reason,
          added_at: new Date().toISOString(),
          isHalfDay: isHalfDay,
          addedBy: addedBy
        };
        
        lastAddedLeaveIds.push(newLeave.id);
        names.push(teacher.clean_name);
        current.unshift(newLeave);
      });

      if (names.length === 0) return;

      saveLeavesList(current);

      renderLeavesTable();
      updateKpis();
      updateCodePreview();

      const namesStr = names.length > 2 ? `${names.length} professors` : names.join(' & ');
      showToast(`🏖️ Marked <strong>${escapeHtml(namesStr)}</strong> on leave! <button onclick="undoLastLeaves()" style="margin-left:8px; padding:2px 8px; border-radius:4px; border:none; background:#070D18; color:#fff; cursor:pointer; font-size:0.75rem;">Undo</button>`, true, 6000);
      
      if (adminLeaveReason) adminLeaveReason.value = '';
      if (document.getElementById('adminHalfDayLeave')) document.getElementById('adminHalfDayLeave').checked = false;
      
      // Reset selected checkboxes
      selectedTeacherIds.clear();
      populateTeacherSelect(adminTeacherSearch ? adminTeacherSearch.value : '');

      // Auto-sync to Cloud DB if configured
      syncLeavesToCloud(current, false);
    });
  }

  function formatLeaveDates(s, e) {
    if (!s && !e) return 'Today';
    const fmt = (dStr) => {
      if (!dStr) return '';
      const p = String(dStr).trim().split('-');
      if (p.length === 3) {
        const day = p[2].padStart(2, '0');
        const mon = p[1].padStart(2, '0');
        const yr = p[0];
        return `${day}/${mon}/${yr}`;
      }
      return dStr;
    };
    const sFmt = fmt(s);
    const eFmt = fmt(e);
    if (sFmt && eFmt) {
      return (sFmt === eFmt) ? sFmt : `${sFmt} – ${eFmt}`;
    }
    return sFmt || eFmt || 'Today';
  }

  function buildLeavesWhatsAppMessage(leavesList) {
    if (!leavesList || leavesList.length === 0) {
      return '*SRCC Faculty Leave Update*\nNo professors are currently marked on leave.';
    }
    const lines = leavesList.map((l, idx) => {
      const code = l.teacher_code && !/^(cg|eg|mg|hg|hgc)\d*$/i.test(l.teacher_code) ? ` [${l.teacher_code}]` : '';
      const dates = formatLeaveDates(l.start_date, l.end_date);
      return `${idx + 1}. ${l.teacher_name}${code} (${dates})`;
    });

    return `*SRCC Faculty Leave Update (${leavesList.length})* 🏖️\n\n${lines.join('\n')}\n\n_Check free classrooms:_ https://anand-srcc.github.io/srcc-free-classrooms/`;
  }

  function renderLeavesTable() {
    if (!adminLeavesListContainer) return;
    let leaves = getLeavesList();
    const today = getTodayIsoDate();

    if (adminActiveLeavesCount) adminActiveLeavesCount.textContent = leaves.length;

    // Search filter
    const searchInput = document.getElementById('adminLeavesSearch');
    if (searchInput && searchInput.value.trim()) {
      const q = searchInput.value.trim().toLowerCase();
      leaves = leaves.filter(l => 
        (l.teacher_name && l.teacher_name.toLowerCase().includes(q)) ||
        (l.teacher_code && l.teacher_code.toLowerCase().includes(q)) ||
        (l.addedBy && l.addedBy.toLowerCase().includes(q)) ||
        (l.reason && l.reason.toLowerCase().includes(q))
      );
    }

    if (leaves.length === 0) {
      adminLeavesListContainer.innerHTML = `
        <div class="leaves-empty-msg">
          No faculty leaves are currently recorded. All 210 professors are on regular college duty.
        </div>
      `;
      return;
    }

    adminLeavesListContainer.innerHTML = leaves.map((leave, idx) => {
      const s = leave.start_date || today;
      const e = leave.end_date || today;
      const isActiveToday = (today >= s && today <= e);
      const code = leave.teacher_code && !/^(cg|eg|mg|hg|hgc)\d*$/i.test(leave.teacher_code) ? ` [${leave.teacher_code}]` : '';
      const dateRangeDisplay = formatLeaveDates(s, e);
      const halfDayBadge = leave.isHalfDay ? `<span style="background: #FEF3C7; color: #92400E; border: 1px solid #FCD34D; font-size: 0.68rem; font-weight: 800; padding: 2px 7px; border-radius: 9999px;">½ DAY</span>` : '';
      const addedByBadge = leave.addedBy ? `<span style="font-size: 0.72rem; color: #64748B; margin-left: 6px;">(By: ${escapeHtml(leave.addedBy)})</span>` : '';

      const singleLeaveMsg = `*SRCC Faculty Leave Update* 🏖️\n\n1. ${leave.teacher_name}${code} (${dateRangeDisplay})\n\n_Check free classrooms:_ https://anand-srcc.github.io/srcc-free-classrooms/`;

      return `
        <div class="leave-item-row" data-leave-id="${leave.id}">
          <div style="display: flex; align-items: flex-start; gap: 10px; width: 100%;">
            <span class="leave-item-num">${idx + 1}</span>
            <div class="leave-item-details">
              <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <span class="leave-item-teacher">${escapeHtml(leave.teacher_name)}${code}</span>
                <span class="leave-item-dates">📅 ${dateRangeDisplay}</span>
                ${halfDayBadge}
                ${isActiveToday ? '<span style="background: #FEE2E2; color: #991B1B; border: 1px solid #FCA5A5; font-size: 0.68rem; font-weight: 800; padding: 2px 8px; border-radius: 9999px;">ACTIVE TODAY</span>' : ''}
                ${addedByBadge}
              </div>
              ${leave.reason ? `<span class="leave-item-reason">"${escapeHtml(leave.reason)}"</span>` : ''}
            </div>
          </div>
          <div class="leave-item-actions">
            <a href="https://wa.me/?text=${encodeURIComponent(singleLeaveMsg)}" target="_blank" class="btn-share-wa" title="Share on WhatsApp">
              💬 Share
            </a>
            <button class="btn-edit-leave" data-leave-id="${leave.id}" data-teacher-id="${leave.teacher_id || ''}" data-teacher-name="${escapeHtml(leave.teacher_name || '')}" data-start="${s}" data-end="${e}" data-reason="${escapeHtml(leave.reason || '')}" data-halfday="${leave.isHalfDay ? '1' : '0'}" style="background: #e0f2fe; border: 1px solid #7dd3fc; color: #0369a1; padding: 6px 12px; border-radius: 6px; font-size: 0.76rem; font-weight: 700; cursor: pointer; transition: all 0.15s ease;" title="Edit leave dates or reason">
              ✏️ Edit
            </button>
            <button class="btn-delete-leave" data-leave-id="${leave.id}" title="Remove leave and restore scheduled classes">
              ✕ Delete
            </button>
          </div>
        </div>
      `;
    }).join('');

    adminLeavesListContainer.querySelectorAll('.btn-edit-leave').forEach(btn => {
      btn.addEventListener('click', () => {
        const tId = btn.dataset.teacherId;
        const tName = btn.dataset.teacherName;
        const s = btn.dataset.start;
        const e = btn.dataset.end;
        const reason = btn.dataset.reason;
        const isHalfDay = btn.dataset.halfday === '1';

        if (adminStartDate) adminStartDate.value = s;
        if (adminEndDate) adminEndDate.value = e;
        if (adminLeaveReason) adminLeaveReason.value = reason;
        if (document.getElementById('adminHalfDayLeave')) document.getElementById('adminHalfDayLeave').checked = isHalfDay;

        if (tId) {
          selectedTeacherIds.clear();
          selectedTeacherIds.add(String(tId));
          if (adminTeacherSearch) adminTeacherSearch.value = tName;
          populateTeacherSelect(tName);
        }

        const formCard = document.querySelector('.admin-section-card');
        if (formCard) formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        showToast(`✏️ Loaded <strong>${escapeHtml(tName)}</strong> into editor. Update dates/reason and click "Save & Apply".`, true, 5000);
      });
    });

    adminLeavesListContainer.querySelectorAll('.btn-delete-leave').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.leaveId;
        const current = getLeavesList();
        const updated = current.filter(l => l.id !== id);
        saveLeavesList(updated);

        renderLeavesTable();
        updateKpis();
        updateCodePreview();
        showToast('🗑️ Faculty leave removed. Scheduled rooms restored to timetable.');

        // Auto-sync to Cloud DB if configured
        syncLeavesToCloud(updated, false);
      });
    });
  }

  // Clear all custom leaves
  if (btnAdminClearAllLeaves) {
    btnAdminClearAllLeaves.addEventListener('click', () => {
      if (confirm('Are you sure you want to reset all custom faculty leaves to college default?')) {
        localStorage.removeItem(LEAVES_STORAGE_KEY);
        renderLeavesTable();
        updateKpis();
        updateCodePreview();
        showToast('🔄 Custom faculty leaves cleared and reset to default.');

        // Auto-sync empty leaves to Cloud DB
        syncLeavesToCloud([], false);
      }
    });
  }

  // Export to CSV
  const btnAdminExportCSV = document.getElementById('btnAdminExportCSV');
  if (btnAdminExportCSV) {
    btnAdminExportCSV.addEventListener('click', () => {
      const leaves = getLeavesList();
      if (leaves.length === 0) {
        showToast('⚠️ No leaves to export.', false);
        return;
      }
      
      let csv = 'Teacher Name,Teacher Code,Department,Start Date,End Date,Reason,Added By,Half Day\n';
      leaves.forEach(l => {
        const name = `"${(l.teacher_name || '').replace(/"/g, '""')}"`;
        const code = `"${(l.teacher_code || '').replace(/"/g, '""')}"`;
        const dept = `"${(l.department || '').replace(/"/g, '""')}"`;
        const reason = `"${(l.reason || '').replace(/"/g, '""')}"`;
        const addedBy = `"${(l.addedBy || '').replace(/"/g, '""')}"`;
        const isHalfDay = l.isHalfDay ? 'Yes' : 'No';
        csv += `${name},${code},${dept},${l.start_date},${l.end_date},${reason},${addedBy},${isHalfDay}\n`;
      });
      
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.setAttribute('hidden', '');
      a.setAttribute('href', url);
      a.setAttribute('download', `srcc_leaves_export_${getTodayIsoDate()}.csv`);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast('⬇️ CSV Exported Successfully!');
    });
  }

  // Share All Faculty Leaves List on WhatsApp
  const btnAdminShareAllWhatsApp = document.getElementById('btnAdminShareAllWhatsApp');
  if (btnAdminShareAllWhatsApp) {
    btnAdminShareAllWhatsApp.addEventListener('click', () => {
      const leaves = getLeavesList();
      const msg = buildLeavesWhatsAppMessage(leaves);
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
    });
  }

  // Clean Expired Leaves
  const btnAdminCleanOld = document.getElementById('btnAdminCleanOld');
  if (btnAdminCleanOld) {
    btnAdminCleanOld.addEventListener('click', () => {
      const leaves = getLeavesList();
      const today = getTodayIsoDate();
      
      const newLeaves = leaves.filter(l => {
        const e = l.end_date || l.start_date || today;
        return e >= today; // Keep only leaves that end today or in the future
      });
      
      const removedCount = leaves.length - newLeaves.length;
      if (removedCount > 0) {
        saveLeavesList(newLeaves);
        renderLeavesTable();
        updateKpis();
        updateCodePreview();
        syncLeavesToCloud(newLeaves, false);
        showToast(`🧹 Cleaned ${removedCount} expired leave record(s).`);
      } else {
        showToast('✅ No expired leaves found. Database is clean.');
      }
    });
  }

  // Update KPIs
  function updateKpis() {
    if (teachersData && teachersData.teachers && kpiTotalFaculty) {
      kpiTotalFaculty.textContent = teachersData.teachers.length;
    }

    const leaves = getLeavesList();
    const today = getTodayIsoDate();
    const todayName = getTodayDayName();

    const activeToday = leaves.filter(l => {
      const s = l.start_date || today;
      const e = l.end_date || today;
      return (today >= s && today <= e);
    });

    if (kpiActiveLeaves) kpiActiveLeaves.textContent = activeToday.length;

    // Calculate how many classrooms are unlocked today
    let unlockedRooms = 0;
    if (teachersData && teachersData.teachers) {
      activeToday.forEach(l => {
        const t = teachersData.teachers.find(tch => String(tch.id) === String(l.teacher_id));
        if (t && t.schedule && t.schedule[todayName]) {
          unlockedRooms += t.schedule[todayName].length;
        }
      });
    }

    if (kpiUnlockedRooms) {
      kpiUnlockedRooms.textContent = unlockedRooms > 0 ? `${unlockedRooms} Slots` : '0';
    }

    const kpiActiveLocks = document.getElementById('kpiActiveLocks');
    const tabLocksBadge = document.getElementById('tabLocksBadge');
    const tabLeavesBadge = document.getElementById('tabLeavesBadge');
    if (tabLeavesBadge) tabLeavesBadge.textContent = leaves.length;

    const locks = getRoomLocksList();
    if (kpiActiveLocks) kpiActiveLocks.textContent = locks.length;
    if (tabLocksBadge) {
      tabLocksBadge.textContent = locks.length;
      tabLocksBadge.style.display = locks.length > 0 ? 'inline-block' : 'none';
    }

    renderAnalytics(leaves, today, activeToday);
  }

  function renderAnalytics(leaves, today, activeToday) {
    const weeklyLeavesEl = document.getElementById('analyticsWeeklyLeaves');
    const busiestDeptEl = document.getElementById('analyticsBusiestDept');
    if (!weeklyLeavesEl || !busiestDeptEl) return;

    // 1. Calculate leaves active this week (simplistic: active today or start date is within next 7 days)
    const todayDate = new Date(today);
    const nextWeekDate = new Date(todayDate);
    nextWeekDate.setDate(nextWeekDate.getDate() + 7);
    const nextWeekIso = nextWeekDate.toISOString().split('T')[0];
    
    const weeklyCount = leaves.filter(l => {
      const s = l.start_date || today;
      const e = l.end_date || today;
      return (e >= today && s <= nextWeekIso);
    }).length;
    
    weeklyLeavesEl.textContent = weeklyCount;

    // 2. Calculate Busiest Dept Today
    if (activeToday.length === 0) {
      busiestDeptEl.textContent = 'None';
    } else {
      const deptCounts = {};
      activeToday.forEach(l => {
        const d = l.department || 'General';
        deptCounts[d] = (deptCounts[d] || 0) + 1;
      });
      let maxDept = 'None';
      let maxCount = 0;
      for (const [dept, count] of Object.entries(deptCounts)) {
        if (count > maxCount) {
          maxCount = count;
          maxDept = dept;
        }
      }
      busiestDeptEl.textContent = maxDept + (maxCount > 1 ? ` (${maxCount})` : '');
    }
  }

  // Update Code Preview Block
  function updateCodePreview() {
    if (!adminCodePreview) return;
    const leaves = getLeavesList();
    const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const content = `// SRCC Official Faculty Leaves Data\n// Generated: ${todayStr}\nwindow.SRCC_FACULTY_LEAVES = {\n  "last_updated": "${todayStr}",\n  "leaves": ${JSON.stringify(leaves, null, 2)}\n};\n`;
    adminCodePreview.textContent = content;
  }

  // Download & Copy Handlers
  if (btnAdminDownloadLeavesJs) {
    btnAdminDownloadLeavesJs.addEventListener('click', () => {
      const leaves = getLeavesList();
      const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const content = `// SRCC Official Faculty Leaves Data\n// Generated: ${todayStr}\nwindow.SRCC_FACULTY_LEAVES = {\n  "last_updated": "${todayStr}",\n  "leaves": ${JSON.stringify(leaves, null, 2)}\n};\n`;
      const blob = new Blob([content], { type: 'application/javascript;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'faculty_leaves.js';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('💾 <strong>faculty_leaves.js downloaded!</strong> Replace this file in your project or Netlify upload to sync for all students.', true, 5000);
    });
  }

  if (btnAdminCopyLeavesJs) {
    btnAdminCopyLeavesJs.addEventListener('click', () => {
      const leaves = getLeavesList();
      const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const content = `// SRCC Official Faculty Leaves Data\n// Generated: ${todayStr}\nwindow.SRCC_FACULTY_LEAVES = {\n  "last_updated": "${todayStr}",\n  "leaves": ${JSON.stringify(leaves, null, 2)}\n};\n`;
      navigator.clipboard.writeText(content).then(() => {
        btnAdminCopyLeavesJs.textContent = '✅ Copied!';
        showToast('📋 <strong>Leaves code copied to clipboard!</strong> Ready to paste into faculty_leaves.js.', true, 3500);
        setTimeout(() => { btnAdminCopyLeavesJs.textContent = '📋 Copy Code'; }, 2500);
      });
    });
  }

  if (btnSaveCloudDbUrl) {
    btnSaveCloudDbUrl.addEventListener('click', async () => {
      const rawUrl = (cloudDbUrlInput ? cloudDbUrlInput.value : '').trim();
      const secret = (cloudDbSecretInput ? cloudDbSecretInput.value : '').trim();
      if (!rawUrl) {
        setCloudDbUrl('', '');
        updateCloudStatusBadge();
        showToast('ℹ️ Cloud Sync disabled. Leaves will save only on this local device.', false, 3500);
        return;
      }

      let formattedUrl = rawUrl;
      if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
        formattedUrl = 'https://' + formattedUrl;
      }
      if (formattedUrl.includes('firebaseio.com') && !formattedUrl.endsWith('.json')) {
        formattedUrl = formattedUrl.replace(/\/?$/, '') + '/leaves.json';
      }

      if (cloudDbUrlInput) cloudDbUrlInput.value = formattedUrl;
      setCloudDbUrl(formattedUrl, secret);

      showToast('⏳ Testing connection to Cloud Database...', true, 2000);
      const currentLeaves = getLeavesList();
      const success = await syncLeavesToCloud(currentLeaves, true);
      if (success) {
        showToast('✅ <strong>Connected successfully!</strong> Cloud Realtime DB is now live for all SRCC students.', true, 5000);
      }
    });
  }

  if (btnPushToCloudNow) {
    btnPushToCloudNow.addEventListener('click', async () => {
      const url = getCloudDbUrl();
      if (!url) {
        showToast('⚠️ Please enter and save your Cloud Database URL above first.', false);
        if (cloudDbUrlInput) cloudDbUrlInput.focus();
        return;
      }
      showToast('☁️ Pushing current leaves to Cloud Database...', true, 2000);
      const currentLeaves = getLeavesList();
      await syncLeavesToCloud(currentLeaves, true);
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ==========================================================================
  // 👥 USER MANAGEMENT & PASSWORD RESET HANDLERS
  // ==========================================================================
  function updateActiveUserDisplay() {
    const active = getActiveSessionUser();
    if (adminActiveUserDisplay) {
      adminActiveUserDisplay.textContent = `Active: ${active.fullName} (${active.role})`;
    }
    if (editNewUsername) {
      editNewUsername.value = active.username || '';
    }
  }

  function renderAdminUsersList() {
    if (!adminUsersListContainer) return;
    const users = getStoredUsers();
    const activeUser = getActiveSessionUser();
    if (adminUsersCount) adminUsersCount.textContent = users.length;

    adminUsersListContainer.innerHTML = `
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.84rem; text-align: left;">
          <thead>
            <tr style="border-bottom: 2px solid #cbd5e1; background: #f1f5f9; color: #334155;">
              <th style="padding: 10px 12px; font-weight: 700; border-radius: 6px 0 0 0;">Username</th>
              <th style="padding: 10px 12px; font-weight: 700;">Full Name</th>
              <th style="padding: 10px 12px; font-weight: 700;">Role</th>
              <th style="padding: 10px 12px; font-weight: 700;">Created</th>
              <th style="padding: 10px 12px; text-align: right; font-weight: 700; border-radius: 0 6px 0 0;">Action</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(u => {
              const uname = (u.username || '').toLowerCase();
              const isSelf = uname === activeUser.username.toLowerCase();
              const isRootAdmin = uname === 'admin';
              const canDelete = (activeUser.isSuper || activeUser.role === 'Admin' || activeUser.role === 'Super Admin') && !isSelf && !isRootAdmin;
              
              let roleBadge = '';
              if (u.isSuper || uname === 'admin') {
                roleBadge = '<span style="background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; font-size: 0.74rem; font-weight: 700; padding: 3px 10px; border-radius: 9999px; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">👑 Super Admin</span>';
              } else if (u.role === 'Admin') {
                roleBadge = '<span style="background: #e0e7ff; color: #4338ca; border: 1px solid #c7d2fe; font-size: 0.74rem; font-weight: 700; padding: 3px 10px; border-radius: 9999px; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">⚡ Full Admin</span>';
              } else {
                roleBadge = '<span style="background: #e0f2fe; color: #0369a1; border: 1px solid #7dd3fc; font-size: 0.74rem; font-weight: 700; padding: 3px 10px; border-radius: 9999px; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">🛡️ Leave Coordinator</span>';
              }

              return `
                <tr style="border-bottom: 1px solid #e2e8f0; transition: background 0.15s ease;">
                  <td style="padding: 10px 12px;">
                    <div style="display: inline-flex; align-items: center; gap: 6px;">
                      <code style="background: #f1f5f9; border: 1px solid #cbd5e1; color: #0f172a; padding: 3px 8px; border-radius: 6px; font-family: monospace; font-size: 0.85rem; font-weight: 800;">${escapeHtml(u.username)}</code>
                      ${isSelf ? '<span style="font-size: 0.72rem; font-weight: 700; color: #059669; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 2px 6px; border-radius: 9999px;">(You)</span>' : ''}
                    </div>
                  </td>
                  <td style="padding: 10px 12px; color: #1e293b; font-weight: 600;">${escapeHtml(u.fullName)}</td>
                  <td style="padding: 10px 12px;">
                    ${roleBadge}
                  </td>
                  <td style="padding: 10px 12px; color: #64748b; font-size: 0.8rem; font-weight: 500;">${escapeHtml(u.createdAt || 'N/A')}</td>
                  <td style="padding: 10px 12px; text-align: right;">
                    ${canDelete ? `
                      <button type="button" class="btn-delete-admin-user" data-username="${escapeHtml(u.username)}" style="background: #fee2e2; border: 1px solid #fca5a5; color: #991b1b; padding: 5px 12px; border-radius: 6px; font-size: 0.75rem; cursor: pointer; font-weight: 700; transition: all 0.15s ease;">
                        🗑️ Remove Access
                      </button>
                    ` : (isRootAdmin ? `<span style="color: #64748b; font-size: 0.75rem; font-weight: 600; font-style: italic;">Primary Master</span>` : `<span style="color: #059669; font-size: 0.75rem; font-weight: 600;">Current User</span>`)}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    document.querySelectorAll('.btn-delete-admin-user').forEach(btn => {
      btn.addEventListener('click', async () => {
        const curActive = getActiveSessionUser();
        const canManage = curActive.isSuper || curActive.role === 'Admin' || curActive.role === 'Super Admin';
        if (!canManage) {
          showToast('⚠️ Only Administrators can remove accounts.', false);
          return;
        }
        const uname = btn.dataset.username;
        if (confirm(`Remove administrator account "${uname}"? They will no longer be able to log in.`)) {
          let users = getStoredUsers();
          users = users.filter(u => u.username.toLowerCase() !== uname.toLowerCase());
          await saveStoredUsers(users);
          renderAdminUsersList();
          showToast(`🗑️ Account <strong>${escapeHtml(uname)}</strong> removed successfully and synced to Cloud.`);
        }
      });
    });
  }

  // Change Username & Password Form Submission
  if (formChangePassword) {
    formChangePassword.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newUname = (editNewUsername ? editNewUsername.value : '').trim();
      const cur = (pwdCurrent ? pwdCurrent.value : '').trim();
      const n1 = (pwdNew ? pwdNew.value : '').trim();
      const n2 = (pwdConfirm ? pwdConfirm.value : '').trim();

      if (!cur) {
        showToast('⚠️ Please enter your current password to verify your identity.', false);
        if (pwdCurrent) pwdCurrent.focus();
        return;
      }

      const activeUser = getActiveSessionUser();
      const users = getStoredUsers();
      const userIdx = users.findIndex(u => u && u.username && u.username.toLowerCase() === activeUser.username.toLowerCase());

      if (userIdx === -1) {
        showToast('⚠️ User session invalid. Please log in again.', false);
        return;
      }

      const targetUser = users[userIdx];
      const curHash = await hashPasscode(cur);
      const isCurValid = (targetUser.passwordHash === curHash) ||
                         (targetUser.isSuper && !targetUser.hasChangedPassword && (AUTH_HASHES.includes(curHash)));

      if (!isCurValid) {
        showToast('⚠️ Current password incorrect. Access denied.', false);
        if (pwdCurrent) { pwdCurrent.value = ''; pwdCurrent.focus(); }
        return;
      }

      const isUsernameChanging = Boolean(newUname && newUname.toLowerCase() !== targetUser.username.toLowerCase());
      const isPasswordChanging = Boolean(n1);

      if (!isUsernameChanging && !isPasswordChanging) {
        showToast('ℹ️ No changes detected. Enter a new username or new password to update.');
        return;
      }

      if (isUsernameChanging) {
        if (newUname.length < 3) {
          showToast('⚠️ New username must be at least 3 characters long.', false);
          if (editNewUsername) editNewUsername.focus();
          return;
        }
        if (!/^[a-zA-Z0-9_.-]+$/.test(newUname)) {
          showToast('⚠️ Username may only contain letters, numbers, underscores, dashes, and periods.', false);
          if (editNewUsername) editNewUsername.focus();
          return;
        }
        const isTaken = users.some((u, idx) => idx !== userIdx && u && u.username && u.username.toLowerCase() === newUname.toLowerCase());
        if (isTaken) {
          showToast(`⚠️ Username "<strong>${escapeHtml(newUname)}</strong>" is already taken. Please choose another.`, false);
          if (editNewUsername) editNewUsername.focus();
          return;
        }
      }

      if (isPasswordChanging) {
        if (n1 !== n2) {
          showToast('⚠️ New passwords do not match.', false);
          if (pwdConfirm) pwdConfirm.focus();
          return;
        }
        if (n1.length < 4) {
          showToast('⚠️ New password must be at least 4 characters long.', false);
          if (pwdNew) pwdNew.focus();
          return;
        }
      }

      const changesDone = [];
      if (isUsernameChanging) {
        targetUser.username = newUname;
        changesDone.push(`Username updated to <code>${escapeHtml(newUname)}</code>`);
      }

      if (isPasswordChanging) {
        const newHash = await hashPasscode(n1);
        targetUser.passwordHash = newHash;
        targetUser.hasChangedPassword = true;
        changesDone.push('Password updated');
      }

      targetUser.updatedAt = Date.now();
      users[userIdx] = targetUser;
      await saveStoredUsers(users);

      // Keep active session updated
      const updatedSession = {
        username: targetUser.username,
        fullName: targetUser.fullName,
        role: targetUser.role,
        isSuper: !!targetUser.isSuper
      };
      sessionStorage.setItem(ACTIVE_USER_SESSION_KEY, JSON.stringify(updatedSession));
      localStorage.setItem(ACTIVE_USER_SESSION_KEY, JSON.stringify(updatedSession));

      updateActiveUserDisplay();
      renderAdminUsersList();

      showToast(`✅ <strong>Security Credentials Updated!</strong> ${changesDone.join(' & ')}.`);
      if (pwdCurrent) pwdCurrent.value = '';
      if (pwdNew) pwdNew.value = '';
      if (pwdConfirm) pwdConfirm.value = '';
    });
  }

  // Create New Admin User Form Submission
  if (formCreateAdminUser) {
    formCreateAdminUser.addEventListener('submit', async (e) => {
      e.preventDefault();
      const activeUser = getActiveSessionUser();
      const canManage = activeUser.isSuper || activeUser.role === 'Admin' || activeUser.role === 'Super Admin';
      if (!canManage) {
        showToast('⚠️ Only Administrators can create new accounts.', false);
        return;
      }

      const uname = (newUserUsername ? newUserUsername.value : '').trim().toLowerCase();
      const name = (newUserFullName ? newUserFullName.value : '').trim();
      const pwd = (newUserPassword ? newUserPassword.value : '').trim();
      const role = (newUserRole ? newUserRole.value : 'Leave Coordinator');

      if (!uname || !name || !pwd) {
        showToast('⚠️ Please fill in all fields.', false);
        return;
      }
      if (!/^[a-z0-9_\-\.]+$/i.test(uname)) {
        showToast('⚠️ Username must contain only letters, numbers, and dashes.', false);
        return;
      }
      if (pwd.length < 4) {
        showToast('⚠️ Password must be at least 4 characters long.', false);
        return;
      }

      const users = getStoredUsers();
      if (users.some(u => u.username.toLowerCase() === uname)) {
        showToast(`⚠️ Username "${escapeHtml(uname)}" already exists. Choose a different username.`, false);
        if (newUserUsername) newUserUsername.focus();
        return;
      }

      const pwdHash = await hashPasscode(pwd);
      const isSuperRole = (uname === 'admin');
      users.push({
        username: uname,
        fullName: name,
        role: role,
        passwordHash: pwdHash,
        createdAt: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        isSuper: isSuperRole,
        hasChangedPassword: true,
        updatedAt: Date.now()
      });

      await saveStoredUsers(users);
      renderAdminUsersList();
      showToast(`🎉 <strong>Account created!</strong> User <code>${escapeHtml(uname)}</code> can now log in and is synced to Cloud Database.`);
      if (newUserUsername) newUserUsername.value = '';
      if (newUserFullName) newUserFullName.value = '';
      if (newUserPassword) newUserPassword.value = '';
    });
  }

  // Search functionality
  const adminLeavesSearch = document.getElementById('adminLeavesSearch');
  if (adminLeavesSearch) {
    adminLeavesSearch.addEventListener('input', () => {
      renderLeavesTable();
    });
  }

  // Fetch Visitor Count (Students)
  async function fetchVisitorCount() {
    let baseUrl = getBaseCloudDbUrl();
    if (!baseUrl) return;
    try {
      const url = baseUrl + '/visitors.json?shallow=true';
      const secret = getCloudDbSecret();
      let finalUrl = url;
      if (secret) {
        finalUrl += '&auth=' + encodeURIComponent(secret);
      }
      
      const res = await fetch(finalUrl);
      if (res.ok) {
        const data = await res.json();
        const count = data ? Object.keys(data).length : 0;
        const el = document.getElementById('kpiTotalVisitors');
        if (el) el.textContent = count;
      }
    } catch (e) {
      console.warn('Could not fetch visitor count:', e);
    }
  }

  // Check authentication on startup
  async function boot() {
    checkAuth();
    
    // Fetch users (admins) from Cloud Database
    fetchUsersFromCloud().then(cloudUsers => {
      if (Date.now() - lastUserActionTimestamp < 4000) return;
      if (cloudUsers && Array.isArray(cloudUsers) && cloudUsers.length > 0) {
        const hasRootAdmin = cloudUsers.some(u => u && u.username && u.username.toLowerCase() === 'admin');
        let finalUsers = [...cloudUsers];
        if (!hasRootAdmin) {
          finalUsers.unshift({
            username: 'admin',
            fullName: 'Master Administrator (Anand)',
            role: 'Super Admin',
            passwordHash: '06f1339f683c69374e5805994b4956bc856e0204827364a6062894a88d792fae',
            createdAt: 'Default Master Account',
            isSuper: true
          });
        }
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(finalUsers));
        if (adminDashboardView && adminDashboardView.style.display === 'block') {
           renderAdminUsersList();
        }
      }
    });

    // Fetch latest leaves from Cloud DB to ensure 100% parity with client app
    fetchLeavesFromCloud().then(cloudLeaves => {
      if (cloudLeaves && Array.isArray(cloudLeaves) && cloudLeaves.length > 0) {
        const dedupMap = new Map();
        cloudLeaves.forEach(l => {
          const key = (l.teacher_id ? String(l.teacher_id) : '') || (l.teacher_name ? l.teacher_name.toLowerCase().trim() : '');
          if (key && !dedupMap.has(key)) {
            dedupMap.set(key, l);
          }
        });
        const deduped = Array.from(dedupMap.values());
        localStorage.setItem(LEAVES_STORAGE_KEY, JSON.stringify(deduped));
        if (window.SRCC_FACULTY_LEAVES) {
          window.SRCC_FACULTY_LEAVES.leaves = deduped;
        }
        renderLeavesTable();
        updateKpis();
        updateCodePreview();
      }
    });

    // Fetch visitor count in background
    fetchVisitorCount();
    
    // Fetch student issues
    fetchStudentIssues();

    // Initialize Live Notification & Hourly Broadcast Center
    initAdminBroadcastCenter();
  }
  
  // Fetch Student Issues
  async function fetchStudentIssues() {
    const section = document.getElementById('adminStudentReportsSection');
    const container = document.getElementById('adminReportsListContainer');
    const countEl = document.getElementById('adminReportsCount');
    let baseUrl = getBaseCloudDbUrl();
    if (!baseUrl) {
      if (countEl) countEl.textContent = '0';
      if (container) {
        container.innerHTML = `
          <div style="text-align: center; padding: 18px 14px; color: #64748b; font-size: 0.85rem; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px;">
            ℹ️ Connect your Cloud Database below to receive student issue reports live.
          </div>
        `;
      }
      return;
    }
    try {
      const secret = getCloudDbSecret();
      let url = baseUrl + '/issues.json';
      if (secret) url += '?auth=' + encodeURIComponent(secret);
      
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        
        if (!data || Object.keys(data).length === 0) {
          if (countEl) countEl.textContent = '0';
          if (container) {
            container.innerHTML = `
              <div style="text-align: center; padding: 18px 14px; color: #64748b; font-size: 0.85rem; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px;">
                ✅ <strong>No open student reports.</strong>
              </div>
            `;
          }
          return;
        }
        
        if (section) section.style.display = 'block';
        const issues = Object.entries(data).map(([id, val]) => ({ id, ...val })).reverse();
        if (countEl) countEl.textContent = issues.length;
        
        if (container) {
          container.innerHTML = issues.map(issue => `
            <div class="leave-item-row" style="border-left: 4px solid #ef4444;">
              <div class="leave-item-details">
                <span class="leave-item-teacher" style="color: #b91c1c;">⚠️ ${escapeHtml(issue.type || 'Issue')}</span>
                <span class="leave-item-dates" style="font-size: 0.75rem;">🕒 ${new Date(issue.timestamp).toLocaleString()}</span>
                ${issue.details ? `<span class="leave-item-reason" style="margin-top:4px;">"${escapeHtml(issue.details)}"</span>` : ''}
              </div>
              <button class="btn-delete-leave" onclick="dismissIssue('${issue.id}')" title="Dismiss this report">
                ✓ Dismiss
              </button>
            </div>
          `).join('');
        }
      }
    } catch (e) {
      console.warn('Could not fetch student issues:', e);
    }
  }

  window.dismissIssue = async function(issueId) {
    let baseUrl = getBaseCloudDbUrl();
    if (!baseUrl) return;
    const secret = getCloudDbSecret();
    let url = baseUrl + `/issues/${issueId}.json`;
    if (secret) url += '?auth=' + encodeURIComponent(secret);
    
    try {
      await fetch(url, { method: 'DELETE' });
      fetchStudentIssues();
      showToast('✅ Issue report dismissed.');
    } catch (e) {
      showToast('⚠️ Failed to dismiss issue.', false);
    }
  };

  // ========================================================================
  // 🔔 ADMIN LIVE BROADCAST & HOURLY CAMPUS ALERTS CENTER
  // ========================================================================
  function initAdminBroadcastCenter() {
    const btnBroadcastNow = document.getElementById('btnAdminBroadcastNow');
    const btnTestAlert = document.getElementById('btnAdminTestAlert');
    const btnRefreshPreview = document.getElementById('btnAdminRefreshPreview');
    const previewSlotEl = document.getElementById('adminLivePeriodSlot');
    const previewTitleEl = document.getElementById('adminBroadcastPreviewTitle');
    const previewBodyEl = document.getElementById('adminBroadcastPreviewBody');

    const periodIntervals = [
      { num: 1, start: 8 * 60 + 30, end: 9 * 60 + 30, slot: '8:30 AM to 9:30 AM', full: 'Period 1 (8:30–9:30 AM)' },
      { num: 2, start: 9 * 60 + 30, end: 10 * 60 + 30, slot: '9:30 AM to 10:30 AM', full: 'Period 2 (9:30–10:30 AM)' },
      { num: 3, start: 10 * 60 + 30, end: 11 * 60 + 30, slot: '10:30 AM to 11:30 AM', full: 'Period 3 (10:30–11:30 AM)' },
      { num: 4, start: 11 * 60 + 30, end: 12 * 60 + 30, slot: '11:30 AM to 12:30 PM', full: 'Period 4 (11:30 AM–12:30 PM)' },
      { num: 5, start: 12 * 60 + 30, end: 13 * 60 + 30, slot: '12:30 PM to 1:30 PM', full: 'Period 5 (12:30–1:30 PM)' },
      { num: 6, start: 14 * 60 + 0, end: 15 * 60 + 0, slot: '2:00 PM to 3:00 PM', full: 'Period 6 (2:00–3:00 PM)' },
      { num: 7, start: 15 * 60 + 0, end: 16 * 60 + 0, slot: '3:00 PM to 4:00 PM', full: 'Period 7 (3:00–4:00 PM)' },
      { num: 8, start: 16 * 60 + 0, end: 17 * 60 + 0, slot: '4:00 PM to 5:00 PM', full: 'Period 8 (4:00–5:00 PM)' },
      { num: 9, start: 17 * 60 + 0, end: 18 * 60 + 0, slot: '5:00 PM to 6:00 PM', full: 'Period 9 (5:00–6:00 PM)' }
    ];

    function getIstNow() {
      const now = new Date();
      const istOffset = 5.5 * 60 * 60 * 1000;
      return new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + istOffset);
    }

    function calculateLivePayload() {
      const istDate = getIstNow();
      const currentMinutes = istDate.getHours() * 60 + istDate.getMinutes();
      const dayName = istDate.toLocaleDateString('en-US', { weekday: 'long' });
      const todayIso = `${istDate.getFullYear()}-${String(istDate.getMonth() + 1).padStart(2, '0')}-${String(istDate.getDate()).padStart(2, '0')}`;

      // 1. Calculate Active Leaves for Today
      const allLeaves = getLeavesList();
      const activeTodayLeaves = allLeaves.filter(leave => {
        if (!leave.start_date && !leave.end_date) return true;
        const s = leave.start_date || '2000-01-01';
        const e = leave.end_date || '2099-12-31';
        return (todayIso >= s && todayIso <= e);
      });

      // 2. Calculate Free Rooms Right Now
      let freeRoomsCount = 0;
      let slotText = 'Off-Hours';
      let freeRoomsLine = '';

      if (dayName === 'Sunday') {
        slotText = 'Sunday (Closed)';
        freeRoomsLine = '🕒 College closed today (Sunday).';
      } else if (currentMinutes >= 13 * 60 + 30 && currentMinutes < 14 * 60) {
        slotText = '1:30 PM to 2:00 PM (Lunch)';
        freeRoomsCount = (appData && appData.rooms) ? appData.rooms.length : 96;
        freeRoomsLine = '🥪 Lunch Recess: All 96 Classrooms Free Right Now!';
      } else {
        const matched = periodIntervals.find(p => currentMinutes >= p.start && currentMinutes < p.end);
        if (matched) {
          slotText = matched.full;
          if (appData && appData.rooms) {
            freeRoomsCount = appData.rooms.filter(r => {
              const s = r.schedule && r.schedule[dayName];
              if (!s) return false;
              if (s.free_slots && s.free_slots.includes(matched.slot)) return true;
              return false;
            }).length;
          }
          freeRoomsLine = `⚡ ${freeRoomsCount} Classrooms Free Right Now for GD & Study!`;
        } else {
          slotText = 'Off-Hours';
          freeRoomsLine = '🕒 College Off-Hours.';
        }
      }

      // 3. Build Body Text
      let leaveLine = '';
      const lCount = activeTodayLeaves.length;
      if (lCount === 1) {
        leaveLine = `Prof. ${activeTodayLeaves[0].teacher_name} is marked on leave today.`;
      } else if (lCount > 1) {
        const topNames = activeTodayLeaves.slice(0, 3).map(l => l.teacher_name).join(', ');
        leaveLine = `${lCount} professors on leave today (${topNames}${lCount > 3 ? '...' : ''}).`;
      } else {
        leaveLine = `All professors present today.`;
      }

      const fullBody = `🏖️ ${leaveLine}\n${freeRoomsLine}`;
      return {
        title: 'SRCC Live Campus Update 🔔',
        body: fullBody,
        slot: slotText,
        leaveCount: lCount,
        freeRooms: freeRoomsCount
      };
    }

    function updateBroadcastPreview() {
      const payload = calculateLivePayload();
      if (previewSlotEl) previewSlotEl.textContent = payload.slot;
      if (previewTitleEl) previewTitleEl.textContent = payload.title;
      if (previewBodyEl) previewBodyEl.innerHTML = payload.body.replace(/\n/g, '<br/>');
    }

    updateBroadcastPreview();
    setInterval(updateBroadcastPreview, 30000);

    if (btnRefreshPreview) {
      btnRefreshPreview.addEventListener('click', () => {
        updateBroadcastPreview();
        showToast('🔄 Live broadcast preview updated.');
      });
    }

    const VAPID_PUBLIC_KEY = 'BJfmbvYuaQnKot04ZeKfaQrZBHgQVMubvYF02BZwLbT2TWqVEbRIJ8_A_vFsuGMNMMDQWYoObRw1gNfhA4_P-3w';
    const subscribersCountEl = document.getElementById('adminSubscribersCount');
    const btnRegisterDevicePush = document.getElementById('btnAdminRegisterDevicePush');

    function urlBase64ToUint8Array(base64String) {
      const padding = '='.repeat((4 - base64String.length % 4) % 4);
      const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    }

    async function updateSubscriberCount() {
      if (!subscribersCountEl) return;
      let baseUrl = getBaseCloudDbUrl();
      if (!baseUrl) {
        subscribersCountEl.textContent = 'Cloud DB not connected';
        return;
      }
      try {
        const secret = getCloudDbSecret();
        let url = `${baseUrl}/push_subscriptions.json?shallow=true`;
        if (secret) url += `?auth=${encodeURIComponent(secret)}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          const count = data ? Object.keys(data).length : 0;
          subscribersCountEl.textContent = `${count} Device(s) Registered`;
        } else {
          subscribersCountEl.textContent = 'Active (Ready)';
        }
      } catch (e) {
        subscribersCountEl.textContent = 'Active (Ready)';
      }
    }

    updateSubscriberCount();

    if (btnRegisterDevicePush) {
      btnRegisterDevicePush.addEventListener('click', async () => {
        try {
          if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
            showToast('⚠️ Web Push notifications not supported on this browser.', false);
            return;
          }
          const perm = await Notification.requestPermission();
          if (perm !== 'granted') {
            showToast('⚠️ Notification permission was blocked or denied.', false);
            return;
          }
          showToast('⏳ Registering device for closed-Chrome push alerts...', true, 2000);
          const reg = await (navigator.serviceWorker.ready || navigator.serviceWorker.getRegistration());
          let sub = await reg.pushManager.getSubscription();
          if (!sub) {
            sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
            });
          }
          if (sub) {
            let baseUrl = getBaseCloudDbUrl();
            if (baseUrl) {
              const subJson = sub.toJSON();
              const subId = btoa(sub.endpoint).replace(/[^a-zA-Z0-9]/g, '').slice(-32);
              const secret = getCloudDbSecret();
              let putUrl = `${baseUrl}/push_subscriptions/${subId}.json`;
              if (secret) putUrl += `?auth=${encodeURIComponent(secret)}`;
              await fetch(putUrl, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  endpoint: sub.endpoint,
                  keys: subJson.keys,
                  updatedAt: new Date().toISOString(),
                  platform: (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || 'Admin Device'
                })
              });
              updateSubscriberCount();
              showToast('🎉 <strong>Admin Device Registered!</strong> You will now receive hourly & instant push alerts even when Chrome is shut.');
            }
          }
        } catch (err) {
          console.warn('Device push registration error:', err);
          showToast('⚠️ Could not complete device push registration: ' + err.message, false);
        }
      });
    }

    async function triggerBroadcast(isTestOnly = false) {
      const payload = calculateLivePayload();

      // Check permission
      if ('Notification' in window && Notification.permission !== 'granted') {
        try {
          const perm = await Notification.requestPermission();
          if (perm !== 'granted') {
            showToast('⚠️ Notification permission not granted in browser.', false);
            return;
          }
        } catch (e) {}
      }

      // 1. Trigger local notification for immediate feedback
      const baseHref = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
      const notifOptions = {
        body: isTestOnly ? `[Test Alert] ${payload.body}` : payload.body,
        icon: new URL('assets/srcc_crest.png', baseHref).href,
        badge: new URL('favicon.png', baseHref).href,
        tag: 'srcc-admin-broadcast-' + Date.now(),
        renotify: true,
        vibrate: [200, 100, 200, 100, 200]
      };

      if ('serviceWorker' in navigator) {
        try {
          const reg = await (navigator.serviceWorker.ready || navigator.serviceWorker.getRegistration());
          if (reg && reg.showNotification) {
            await reg.showNotification(payload.title, notifOptions);
          } else if ('Notification' in window) {
            new Notification(payload.title, notifOptions);
          }
        } catch (e) {
          if ('Notification' in window) {
            try { new Notification(payload.title, notifOptions); } catch (err) {}
          }
        }
      } else if ('Notification' in window && Notification.permission === 'granted') {
        try { new Notification(payload.title, notifOptions); } catch (e) {}
      }

      // 2. If it's a real broadcast, dispatch to all devices across campus!
      if (!isTestOnly) {
        let baseUrl = getBaseCloudDbUrl();
        // Record broadcast trigger in Cloud Realtime DB
        if (baseUrl) {
          const secret = getCloudDbSecret();
          let trigUrl = `${baseUrl}/broadcast_triggers/latest.json`;
          if (secret) trigUrl += `?auth=${encodeURIComponent(secret)}`;
          fetch(trigUrl, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: payload.title,
              body: payload.body,
              timestamp: Date.now(),
              sentBy: getActiveSessionUser().fullName || 'Admin'
            })
          }).catch(() => {});
        }

        // Call Netlify Web Push Serverless Function to push to all phones/laptops
        fetch('/.netlify/functions/push_dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: payload.title,
            body: payload.body,
            url: './'
          })
        }).then(res => res.json()).then(resData => {
          if (resData && resData.count !== undefined) {
            showToast(`📢 <strong>Broadcast Sent!</strong> Reached ${resData.count} registered device(s) via Web Push.`);
          }
        }).catch(() => {});

        showToast(`📢 <strong>Broadcast Pushed to All Users!</strong> Leaves: ${payload.leaveCount}, Free Rooms: ${payload.freeRooms}`);
      } else {
        showToast(`🧪 <strong>Test alert displayed on your screen.</strong>`);
      }
    }

    if (btnBroadcastNow) {
      btnBroadcastNow.addEventListener('click', () => triggerBroadcast(false));
    }

    if (btnTestAlert) {
      btnTestAlert.addEventListener('click', () => triggerBroadcast(true));
    }
  }

  // ==========================================================================
  // 🏛️ ROOM MANAGEMENT (ADD / EDIT / TEMPORARILY UNAVAILABLE / DELETE)
  // ==========================================================================
  const ROOM_OVERRIDES_KEY = 'srcc_room_overrides_v1';
  let editingRoomId = null;

  function getRoomOverridesMap() {
    try {
      const data = localStorage.getItem(ROOM_OVERRIDES_KEY);
      return data ? JSON.parse(data) : {};
    } catch (e) {
      return {};
    }
  }

  function saveRoomOverridesMap(map) {
    try {
      localStorage.setItem(ROOM_OVERRIDES_KEY, JSON.stringify(map));
    } catch (e) {}
  }

  function syncRoomOverridesToCloud(map, showToastOnSuccess = true) {
    const baseUrl = getBaseCloudDbUrl();
    if (!baseUrl) return;
    const secret = getCloudDbSecret();
    let url = `${baseUrl}/room_overrides.json`;
    if (secret) url += `?auth=${encodeURIComponent(secret)}`;

    fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(map)
    })
      .then(r => {
        if (r.ok && showToastOnSuccess) {
          showToast('☁️ Room management synced with live cloud.');
        }
      })
      .catch(err => {
        console.warn('Cloud room sync note:', err);
      });
  }

  function fetchCloudRoomOverrides() {
    const baseUrl = getBaseCloudDbUrl();
    if (!baseUrl) return;
    fetch(`${baseUrl}/room_overrides.json?t=${Date.now()}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && typeof d === 'object') {
          saveRoomOverridesMap(d);
          renderRoomsTable();
        }
      })
      .catch(() => {});
  }

  function getAllManagedRooms() {
    const builtInRooms = [];
    if (window.SRCC_DATA && Array.isArray(window.SRCC_DATA.rooms)) {
      window.SRCC_DATA.rooms.forEach(r => {
        builtInRooms.push({
          code: r.code,
          name: r.name || `Classroom ${r.code}`,
          wing: r.category || 'Main Building',
          capacity: r.capacity || '60',
          is_custom: false
        });
      });
    }

    const overrides = getRoomOverridesMap();
    const roomsMap = new Map();
    builtInRooms.forEach(r => roomsMap.set(r.code, { ...r }));

    Object.entries(overrides).forEach(([code, ov]) => {
      if (roomsMap.has(code)) {
        roomsMap.set(code, { ...roomsMap.get(code), ...ov });
      } else {
        roomsMap.set(code, {
          code: code,
          name: ov.name || `Classroom ${code}`,
          wing: ov.wing || 'Main Building',
          capacity: ov.capacity || '60',
          is_custom: true,
          ...ov
        });
      }
    });

    return Array.from(roomsMap.values());
  }

  function renderRoomsTable() {
    const container = document.getElementById('adminRoomsListContainer');
    const countBadge = document.getElementById('adminRoomsCount');
    const tabBadge = document.getElementById('tabRoomsBadge');
    if (!container) return;

    const rooms = getAllManagedRooms();
    const searchVal = (document.getElementById('adminRoomSearchInput')?.value || '').toLowerCase().trim();
    const filterStatus = document.getElementById('adminRoomFilterStatus')?.value || 'ALL';

    const unavailableCount = rooms.filter(r => r.status === 'UNAVAILABLE').length;
    if (tabBadge) {
      tabBadge.textContent = unavailableCount;
      tabBadge.style.display = unavailableCount > 0 ? 'inline-block' : 'none';
      if (unavailableCount > 0) tabBadge.classList.add('badge-danger');
      else tabBadge.classList.remove('badge-danger');
    }

    const filtered = rooms.filter(r => {
      if (r.status === 'DELETED' && filterStatus !== 'ALL') return false;
      if (filterStatus === 'UNAVAILABLE' && r.status !== 'UNAVAILABLE') return false;
      if (filterStatus === 'AVAILABLE' && (r.status === 'UNAVAILABLE' || r.status === 'DELETED')) return false;
      if (filterStatus === 'CUSTOM' && !r.is_custom) return false;

      if (searchVal) {
        const q = searchVal;
        const matchCode = (r.code || '').toLowerCase().includes(q);
        const matchName = (r.name || '').toLowerCase().includes(q);
        const matchWing = (r.wing || '').toLowerCase().includes(q);
        const matchReason = (r.reason || '').toLowerCase().includes(q);
        if (!matchCode && !matchName && !matchWing && !matchReason) return false;
      }
      return true;
    });

    if (countBadge) countBadge.textContent = `${filtered.length} of ${rooms.length}`;

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 28px 16px; color: var(--text-secondary);">
          <div style="font-size: 2rem; margin-bottom: 6px;">🏛️</div>
          <p style="margin: 0; font-weight: 600;">No classrooms match the selected filter.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="overflow-x: auto;">
        <table class="admin-data-table" style="width: 100%; border-collapse: collapse; font-size: 0.84rem;">
          <thead>
            <tr style="background: #f8fafc; border-bottom: 2px solid var(--border-color); text-align: left;">
              <th style="padding: 10px 12px;">Room Code</th>
              <th style="padding: 10px 12px;">Wing / Category</th>
              <th style="padding: 10px 12px;">Capacity</th>
              <th style="padding: 10px 12px;">Availability Status</th>
              <th style="padding: 10px 12px;">Maintenance Reason</th>
              <th style="padding: 10px 12px; text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(r => {
              const isUnavailable = (r.status === 'UNAVAILABLE');
              const isDeleted = (r.status === 'DELETED');
              let statusBadge = '<span style="background: #dcfce7; color: #15803d; padding: 3px 8px; border-radius: 9999px; font-weight: 700; font-size: 0.72rem;">✅ Available</span>';
              if (isUnavailable) {
                statusBadge = '<span style="background: #fee2e2; color: #dc2626; padding: 3px 8px; border-radius: 9999px; font-weight: 800; font-size: 0.72rem;">🛠️ Unavailable</span>';
              } else if (isDeleted) {
                statusBadge = '<span style="background: #f1f5f9; color: #64748b; padding: 3px 8px; border-radius: 9999px; font-weight: 700; font-size: 0.72rem;">🗑️ Deleted</span>';
              }

              return `
                <tr style="border-bottom: 1px solid var(--border-subtle); ${isUnavailable ? 'background: #fff5f5;' : ''}">
                  <td style="padding: 10px 12px; font-weight: 800; font-family: var(--font-display);">
                    ${escapeHtml(r.code)}
                    ${r.is_custom ? '<span style="font-size: 0.65rem; background: #e0f2fe; color: #0284c7; padding: 1px 5px; border-radius: 4px; margin-left: 4px;">Custom</span>' : ''}
                    <div style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 400;">${escapeHtml(r.name || '')}</div>
                  </td>
                  <td style="padding: 10px 12px; color: var(--text-secondary); font-weight: 500;">
                    ${escapeHtml(r.wing || 'Main Building')}
                  </td>
                  <td style="padding: 10px 12px; color: var(--text-secondary);">
                    ${escapeHtml(r.capacity || '60')}
                  </td>
                  <td style="padding: 10px 12px;">
                    ${statusBadge}
                  </td>
                  <td style="padding: 10px 12px; font-size: 0.8rem; color: #991b1b;">
                    ${isUnavailable ? escapeHtml((r.reason || 'Maintenance') + (r.duration ? ` (${r.duration})` : '')) : '<span style="color: #94a3b8;">—</span>'}
                  </td>
                  <td style="padding: 10px 12px; text-align: right; white-space: nowrap;">
                    <button type="button" class="btn-room-toggle-unavail" data-code="${escapeHtml(r.code)}" style="padding: 4px 8px; font-size: 0.74rem; font-weight: 700; border-radius: 6px; border: 1px solid ${isUnavailable ? '#16a34a' : '#dc2626'}; background: ${isUnavailable ? '#dcfce7' : '#fee2e2'}; color: ${isUnavailable ? '#15803d' : '#dc2626'}; cursor: pointer; margin-right: 4px;">
                      ${isUnavailable ? '✅ Mark Available' : '🛠️ Mark Unavailable'}
                    </button>
                    <button type="button" class="btn-room-edit" data-code="${escapeHtml(r.code)}" style="padding: 4px 8px; font-size: 0.74rem; font-weight: 700; border-radius: 6px; border: 1px solid var(--border-color); background: #f8fafc; color: var(--text-primary); cursor: pointer; margin-right: 4px;">
                      ✏️ Edit
                    </button>
                    <button type="button" class="btn-room-delete" data-code="${escapeHtml(r.code)}" style="padding: 4px 8px; font-size: 0.74rem; font-weight: 700; border-radius: 6px; border: 1px solid #fecaca; background: #fff1f2; color: #e11d48; cursor: pointer;">
                      🗑️
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    container.querySelectorAll('.btn-room-toggle-unavail').forEach(btn => {
      btn.addEventListener('click', () => {
        toggleRoomAvailability(btn.dataset.code);
      });
    });

    container.querySelectorAll('.btn-room-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        startEditingRoom(btn.dataset.code);
      });
    });

    container.querySelectorAll('.btn-room-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        deleteRoom(btn.dataset.code);
      });
    });
  }

  function toggleRoomAvailability(code) {
    const overrides = getRoomOverridesMap();
    const current = overrides[code] || {};
    const isCurrentlyUnavailable = (current.status === 'UNAVAILABLE');

    if (isCurrentlyUnavailable) {
      delete current.status;
      delete current.reason;
      delete current.duration;
      overrides[code] = current;
      saveRoomOverridesMap(overrides);
      renderRoomsTable();
      syncRoomOverridesToCloud(overrides);
      showToast(`✅ Room <strong>${code}</strong> is now marked Available!`);
    } else {
      const reason = prompt(`Enter reason why Room ${code} is unavailable (e.g., AC Maintenance, Ceiling repair, Exam):`, 'Under Maintenance');
      if (reason === null) return;
      overrides[code] = {
        ...current,
        code: code,
        status: 'UNAVAILABLE',
        reason: reason.trim() || 'Temporarily Unavailable',
        duration: 'All Day',
        updated_at: new Date().toISOString(),
        updated_by: getActiveSessionUser().fullName || 'Admin'
      };
      saveRoomOverridesMap(overrides);
      renderRoomsTable();
      syncRoomOverridesToCloud(overrides);
      showToast(`🛠️ Room <strong>${code}</strong> marked Temporarily Unavailable.`);
    }
  }

  function startEditingRoom(code) {
    const rooms = getAllManagedRooms();
    const room = rooms.find(r => r.code === code);
    if (!room) return;

    editingRoomId = code;
    document.getElementById('adminEditingRoomId').value = code;
    document.getElementById('adminRoomCode').value = room.code;
    document.getElementById('adminRoomCode').readOnly = !room.is_custom;
    document.getElementById('adminRoomName').value = room.name || '';
    document.getElementById('adminRoomWing').value = room.wing || 'Main Building';
    document.getElementById('adminRoomCapacity').value = room.capacity || '60';

    const unavailToggle = document.getElementById('adminRoomUnavailableToggle');
    const unavailFields = document.getElementById('adminRoomUnavailableFields');
    const isUnavail = (room.status === 'UNAVAILABLE');
    if (unavailToggle) unavailToggle.checked = isUnavail;
    if (unavailFields) unavailFields.style.display = isUnavail ? 'grid' : 'none';

    document.getElementById('adminRoomUnavailableReason').value = room.reason || '';
    document.getElementById('adminRoomUnavailableDuration').value = room.duration || '';

    document.getElementById('roomFormTitle').textContent = `Edit Room: ${room.code}`;
    document.getElementById('btnAdminCancelRoomEdit').style.display = 'inline-block';
    document.getElementById('btnAdminSaveRoom').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function resetRoomForm() {
    editingRoomId = null;
    document.getElementById('adminEditingRoomId').value = '';
    const codeInput = document.getElementById('adminRoomCode');
    codeInput.value = '';
    codeInput.readOnly = false;
    document.getElementById('adminRoomName').value = '';
    document.getElementById('adminRoomWing').value = 'Main Building';
    document.getElementById('adminRoomCapacity').value = '';
    const unavailToggle = document.getElementById('adminRoomUnavailableToggle');
    if (unavailToggle) unavailToggle.checked = false;
    const unavailFields = document.getElementById('adminRoomUnavailableFields');
    if (unavailFields) unavailFields.style.display = 'none';
    document.getElementById('adminRoomUnavailableReason').value = '';
    document.getElementById('adminRoomUnavailableDuration').value = '';
    document.getElementById('roomFormTitle').textContent = 'Add / Edit Classroom & Availability';
    document.getElementById('btnAdminCancelRoomEdit').style.display = 'none';
  }

  function deleteRoom(code) {
    if (!confirm(`Are you sure you want to delete or de-activate Room "${code}"? Students will not see this room in the app.`)) return;
    const overrides = getRoomOverridesMap();
    overrides[code] = {
      ...(overrides[code] || {}),
      code: code,
      status: 'DELETED',
      updated_at: new Date().toISOString(),
      updated_by: getActiveSessionUser().fullName || 'Admin'
    };
    saveRoomOverridesMap(overrides);
    renderRoomsTable();
    syncRoomOverridesToCloud(overrides);
    showToast(`🗑️ Room <strong>${code}</strong> has been deactivated.`);
  }

  function initRoomsListeners() {
    const unavailToggle = document.getElementById('adminRoomUnavailableToggle');
    const unavailFields = document.getElementById('adminRoomUnavailableFields');
    if (unavailToggle && unavailFields) {
      unavailToggle.addEventListener('change', () => {
        unavailFields.style.display = unavailToggle.checked ? 'grid' : 'none';
      });
    }

    const btnSave = document.getElementById('btnAdminSaveRoom');
    if (btnSave) {
      btnSave.addEventListener('click', () => {
        const codeInput = document.getElementById('adminRoomCode');
        const code = (codeInput?.value || '').trim().toUpperCase();
        if (!code) {
          showToast('⚠️ Please enter a room code (e.g. R37, C28).', false);
          codeInput?.focus();
          return;
        }

        const name = (document.getElementById('adminRoomName')?.value || '').trim();
        const wing = document.getElementById('adminRoomWing')?.value || 'Main Building';
        const capacity = (document.getElementById('adminRoomCapacity')?.value || '').trim() || '60';
        const isUnavailable = document.getElementById('adminRoomUnavailableToggle')?.checked;
        const reason = (document.getElementById('adminRoomUnavailableReason')?.value || '').trim();
        const duration = (document.getElementById('adminRoomUnavailableDuration')?.value || '').trim();

        const overrides = getRoomOverridesMap();
        const existing = overrides[code] || {};

        overrides[code] = {
          ...existing,
          code: code,
          name: name || `Classroom ${code}`,
          wing: wing,
          capacity: capacity,
          status: isUnavailable ? 'UNAVAILABLE' : 'AVAILABLE',
          reason: isUnavailable ? (reason || 'Under Maintenance') : '',
          duration: isUnavailable ? duration : '',
          is_custom: existing.is_custom || !window.SRCC_DATA?.rooms?.some(r => r.code === code),
          updated_at: new Date().toISOString(),
          updated_by: getActiveSessionUser().fullName || 'Admin'
        };

        saveRoomOverridesMap(overrides);
        renderRoomsTable();
        syncRoomOverridesToCloud(overrides);
        resetRoomForm();
        showToast(`💾 Room <strong>${code}</strong> details saved successfully!`);
      });
    }

    const btnCancel = document.getElementById('btnAdminCancelRoomEdit');
    if (btnCancel) {
      btnCancel.addEventListener('click', resetRoomForm);
    }

    const searchInput = document.getElementById('adminRoomSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', renderRoomsTable);
    }

    const filterStatus = document.getElementById('adminRoomFilterStatus');
    if (filterStatus) {
      filterStatus.addEventListener('change', renderRoomsTable);
    }
  }

  // ==========================================================================
  // 📶 CAMPUS WIFI DIRECTORY MANAGEMENT
  // ==========================================================================
  const WIFI_STORAGE_KEY = 'srcc_campus_wifi_v1';
  let editingWifiId = null;

  function getWifiNetworksList() {
    try {
      const data = localStorage.getItem(WIFI_STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}

    if (window.SRCC_WIFI_DATA && Array.isArray(window.SRCC_WIFI_DATA.networks)) {
      return [...window.SRCC_WIFI_DATA.networks];
    }
    return [];
  }

  function saveWifiNetworksList(list) {
    try {
      localStorage.setItem(WIFI_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {}
  }

  function syncWifiNetworksToCloud(list, showToastOnSuccess = true) {
    const baseUrl = getBaseCloudDbUrl();
    if (!baseUrl) return;
    const secret = getCloudDbSecret();
    let url = `${baseUrl}/campus_wifi.json`;
    if (secret) url += `?auth=${encodeURIComponent(secret)}`;

    fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(list)
    })
      .then(r => {
        if (r.ok && showToastOnSuccess) {
          showToast('☁️ Campus WiFi directory synced to live cloud.');
        }
      })
      .catch(err => {
        console.warn('Cloud WiFi sync note:', err);
      });
  }

  function fetchCloudCampusWifi() {
    const baseUrl = getBaseCloudDbUrl();
    if (!baseUrl) return;
    fetch(`${baseUrl}/campus_wifi.json?t=${Date.now()}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (Array.isArray(d) && d.length > 0) {
          saveWifiNetworksList(d);
          renderWifiTable();
        } else if (d && typeof d === 'object') {
          const arr = Object.values(d);
          if (arr.length > 0) {
            saveWifiNetworksList(arr);
            renderWifiTable();
          }
        }
      })
      .catch(() => {});
  }

  function renderWifiTable() {
    const container = document.getElementById('adminWifiListContainer');
    const countBadge = document.getElementById('adminWifiCount');
    const tabBadge = document.getElementById('tabWifiBadge');
    if (!container) return;

    const list = getWifiNetworksList();
    const searchVal = (document.getElementById('adminWifiSearchInput')?.value || '').toLowerCase().trim();

    if (countBadge) countBadge.textContent = list.length;
    if (tabBadge) tabBadge.textContent = list.length;

    const filtered = list.filter(w => {
      if (!searchVal) return true;
      const q = searchVal;
      return (
        (w.ssid || '').toLowerCase().includes(q) ||
        (w.password || '').toLowerCase().includes(q) ||
        (w.location || '').toLowerCase().includes(q) ||
        (w.wing || '').toLowerCase().includes(q)
      );
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 28px 16px; color: var(--text-secondary);">
          <div style="font-size: 2rem; margin-bottom: 6px;">📶</div>
          <p style="margin: 0; font-weight: 600;">No WiFi networks match your search.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div style="overflow-x: auto;">
        <table class="admin-data-table" style="width: 100%; border-collapse: collapse; font-size: 0.84rem;">
          <thead>
            <tr style="background: #f8fafc; border-bottom: 2px solid var(--border-color); text-align: left;">
              <th style="padding: 10px 12px;">SSID (Network)</th>
              <th style="padding: 10px 12px;">Band</th>
              <th style="padding: 10px 12px;">Password</th>
              <th style="padding: 10px 12px;">Coverage / Location</th>
              <th style="padding: 10px 12px; text-align: right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map(w => {
              const bandClass = w.band === '5G' ? 'wifi-band-5g' : (w.band === '4G' ? 'wifi-band-4g' : 'wifi-band-dual');
              return `
                <tr style="border-bottom: 1px solid var(--border-subtle);">
                  <td style="padding: 10px 12px; font-weight: 800; font-family: var(--font-display); color: #0891b2;">
                    📶 ${escapeHtml(w.ssid)}
                  </td>
                  <td style="padding: 10px 12px;">
                    <span class="wifi-band-badge ${bandClass}">${escapeHtml(w.band || 'Dual')}</span>
                  </td>
                  <td style="padding: 10px 12px;">
                    <code style="background: #f1f5f9; padding: 3px 6px; border-radius: 4px; font-weight: 700;">${escapeHtml(w.password)}</code>
                  </td>
                  <td style="padding: 10px 12px; color: var(--text-secondary);">
                    ${escapeHtml(w.location || '')}
                    <div style="font-size: 0.72rem; color: #94a3b8;">${escapeHtml(w.wing || '')}</div>
                  </td>
                  <td style="padding: 10px 12px; text-align: right; white-space: nowrap;">
                    <button type="button" class="btn-copy-admin-wifi" data-pwd="${escapeHtml(w.password)}" style="padding: 4px 8px; font-size: 0.74rem; font-weight: 700; border-radius: 6px; border: 1px solid #0891b2; background: rgba(8, 145, 178, 0.1); color: #0891b2; cursor: pointer; margin-right: 4px;">
                      📋 Copy
                    </button>
                    <button type="button" class="btn-edit-admin-wifi" data-id="${escapeHtml(w.id || w.ssid)}" style="padding: 4px 8px; font-size: 0.74rem; font-weight: 700; border-radius: 6px; border: 1px solid var(--border-color); background: #f8fafc; color: var(--text-primary); cursor: pointer; margin-right: 4px;">
                      ✏️ Edit
                    </button>
                    <button type="button" class="btn-delete-admin-wifi" data-id="${escapeHtml(w.id || w.ssid)}" style="padding: 4px 8px; font-size: 0.74rem; font-weight: 700; border-radius: 6px; border: 1px solid #fecaca; background: #fff1f2; color: #e11d48; cursor: pointer;">
                      🗑️
                    </button>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    container.querySelectorAll('.btn-copy-admin-wifi').forEach(btn => {
      btn.addEventListener('click', () => {
        navigator.clipboard.writeText(btn.dataset.pwd).then(() => {
          showToast('📋 WiFi Password copied to clipboard!');
        });
      });
    });

    container.querySelectorAll('.btn-edit-admin-wifi').forEach(btn => {
      btn.addEventListener('click', () => {
        startEditingWifi(btn.dataset.id);
      });
    });

    container.querySelectorAll('.btn-delete-admin-wifi').forEach(btn => {
      btn.addEventListener('click', () => {
        deleteWifi(btn.dataset.id);
      });
    });
  }

  function startEditingWifi(id) {
    const list = getWifiNetworksList();
    const item = list.find(w => (w.id || w.ssid) === id);
    if (!item) return;

    editingWifiId = id;
    document.getElementById('adminEditingWifiId').value = id;
    document.getElementById('adminWifiSsid').value = item.ssid;
    document.getElementById('adminWifiPassword').value = item.password;
    document.getElementById('adminWifiBand').value = item.band || '5G';
    document.getElementById('adminWifiWing').value = item.wing || 'Main Building';
    document.getElementById('adminWifiLocation').value = item.location || '';
    document.getElementById('adminWifiNotes').value = item.notes || '';

    document.getElementById('wifiFormTitle').textContent = `Edit WiFi Network: ${item.ssid}`;
    document.getElementById('btnAdminCancelWifiEdit').style.display = 'inline-block';
    document.getElementById('btnAdminSaveWifi').scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function resetWifiForm() {
    editingWifiId = null;
    document.getElementById('adminEditingWifiId').value = '';
    document.getElementById('adminWifiSsid').value = '';
    document.getElementById('adminWifiPassword').value = '';
    document.getElementById('adminWifiBand').value = '5G';
    document.getElementById('adminWifiWing').value = 'Main Building';
    document.getElementById('adminWifiLocation').value = '';
    document.getElementById('adminWifiNotes').value = '';
    document.getElementById('wifiFormTitle').textContent = 'Add / Edit Campus WiFi Network';
    document.getElementById('btnAdminCancelWifiEdit').style.display = 'none';
  }

  function deleteWifi(id) {
    let list = getWifiNetworksList();
    const item = list.find(w => (w.id || w.ssid) === id);
    if (!item) return;

    if (!confirm(`Delete WiFi network "${item.ssid}"?`)) return;
    list = list.filter(w => (w.id || w.ssid) !== id);
    saveWifiNetworksList(list);
    renderWifiTable();
    syncWifiNetworksToCloud(list);
    showToast(`🗑️ WiFi network <strong>${item.ssid}</strong> deleted.`);
  }

  function initWifiListeners() {
    const btnSave = document.getElementById('btnAdminSaveWifi');
    if (btnSave) {
      btnSave.addEventListener('click', () => {
        const ssid = (document.getElementById('adminWifiSsid')?.value || '').trim();
        const pwd = (document.getElementById('adminWifiPassword')?.value || '').trim();
        if (!ssid || !pwd) {
          showToast('⚠️ Please enter both WiFi Network SSID and Password.', false);
          return;
        }

        const band = document.getElementById('adminWifiBand')?.value || '5G';
        const wing = document.getElementById('adminWifiWing')?.value || 'Main Building';
        const location = (document.getElementById('adminWifiLocation')?.value || '').trim();
        const notes = (document.getElementById('adminWifiNotes')?.value || '').trim();

        let list = getWifiNetworksList();

        if (editingWifiId) {
          const idx = list.findIndex(w => (w.id || w.ssid) === editingWifiId);
          if (idx !== -1) {
            list[idx] = {
              ...list[idx],
              ssid: ssid,
              password: pwd,
              band: band,
              wing: wing,
              location: location,
              notes: notes
            };
          }
        } else {
          list.unshift({
            id: 'wifi_' + Date.now(),
            ssid: ssid,
            password: pwd,
            band: band,
            wing: wing,
            location: location,
            notes: notes
          });
        }

        saveWifiNetworksList(list);
        renderWifiTable();
        syncWifiNetworksToCloud(list);
        resetWifiForm();
        showToast(`💾 WiFi network <strong>${ssid}</strong> saved!`);
      });
    }

    const btnCancel = document.getElementById('btnAdminCancelWifiEdit');
    if (btnCancel) {
      btnCancel.addEventListener('click', resetWifiForm);
    }

    const btnReset = document.getElementById('btnResetOfficialWifi');
    if (btnReset) {
      btnReset.addEventListener('click', () => {
        if (confirm('Reset to the 24 official campus networks extracted from the SRCC WiFi directory PDF?')) {
          const defaults = (window.SRCC_WIFI_DATA && window.SRCC_WIFI_DATA.networks) ? [...window.SRCC_WIFI_DATA.networks] : [];
          saveWifiNetworksList(defaults);
          renderWifiTable();
          syncWifiNetworksToCloud(defaults);
          showToast('🔄 WiFi directory restored to official 24 campus networks.');
        }
      });
    }

    const searchInput = document.getElementById('adminWifiSearchInput');
    if (searchInput) {
      searchInput.addEventListener('input', renderWifiTable);
    }
  }

  // ==========================================================================
  // 🖨️ PRINT NOTICE SHEETS (SRCC PHYSICAL NOTICE BOARD SHEETS)
  // ==========================================================================
  function naturalSortRooms(arr) {
    return [...arr].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
  }

  function formatPrintDate(isoDateStr) {
    if (!isoDateStr) return '';
    try {
      const parts = isoDateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        const day = d.getDate();
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        return `${day} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
      }
    } catch (e) {}
    return isoDateStr;
  }

  function formatShortDate(isoDateStr) {
    if (!isoDateStr) return '';
    try {
      const parts = isoDateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        const day = String(d.getDate()).padStart(2, '0');
        const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${day} ${shortMonths[d.getMonth()]} ${d.getFullYear()}`;
      }
    } catch (e) {}
    return isoDateStr;
  }

  function getDayOfWeekFromIso(isoDateStr) {
    if (!isoDateStr) return getTodayDayName();
    const parts = isoDateStr.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return days[d.getDay()];
    }
    return getTodayDayName();
  }

  function initPrintSheets() {
    const dateInput = document.getElementById('adminPrintDateSelect');
    if (dateInput && !dateInput.value) {
      dateInput.value = getTodayIsoDate();
    }

    const triggerBtn = document.getElementById('btnAdminTriggerPrint');
    if (triggerBtn) {
      triggerBtn.addEventListener('click', () => {
        window.print();
      });
    }

    const refreshBtn = document.getElementById('btnAdminRefreshPrintSheets');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', renderPrintSheets);
    }

    const sheetsSelect = document.getElementById('adminPrintSheetsSelect');
    if (sheetsSelect) {
      sheetsSelect.addEventListener('change', () => {
        const sheetMatrix = document.getElementById('printSheetMatrix');
        const sheetLeaves = document.getElementById('printSheetLeaves');
        const val = sheetsSelect.value;
        if (sheetMatrix) sheetMatrix.style.display = (val === 'both' || val === 'matrix') ? 'flex' : 'none';
        if (sheetLeaves) sheetLeaves.style.display = (val === 'both' || val === 'leaves') ? 'flex' : 'none';
      });
    }

    const slotRangeSelect = document.getElementById('adminPrintSlotRange');
    if (slotRangeSelect) {
      slotRangeSelect.addEventListener('change', renderPrintSheets);
    }

    const venueFilterSelect = document.getElementById('adminPrintVenueFilter');
    if (venueFilterSelect) {
      venueFilterSelect.addEventListener('change', renderPrintSheets);
    }

    if (dateInput) {
      dateInput.addEventListener('change', renderPrintSheets);
    }
  }

  function renderPrintSheets() {
    const dateInput = document.getElementById('adminPrintDateSelect');
    const selectedDate = (dateInput && dateInput.value) ? dateInput.value : getTodayIsoDate();
    const dayName = getDayOfWeekFromIso(selectedDate);
    const formattedDate = formatPrintDate(selectedDate);

    const sheetsSelect = document.getElementById('adminPrintSheetsSelect');
    const sheetMode = sheetsSelect ? sheetsSelect.value : 'both';
    const sheetMatrix = document.getElementById('printSheetMatrix');
    const sheetLeaves = document.getElementById('printSheetLeaves');

    if (sheetMatrix) sheetMatrix.style.display = (sheetMode === 'both' || sheetMode === 'matrix') ? 'flex' : 'none';
    if (sheetLeaves) sheetLeaves.style.display = (sheetMode === 'both' || sheetMode === 'leaves') ? 'flex' : 'none';

    const slotRangeSelect = document.getElementById('adminPrintSlotRange');
    const slotRange = slotRangeSelect ? slotRangeSelect.value : 'all';

    const venueFilterSelect = document.getElementById('adminPrintVenueFilter');
    const venueFilter = venueFilterSelect ? venueFilterSelect.value : 'all';

    const now = new Date();
    const generatedTimeStr = `Printed on: ${formatShortDate(getTodayIsoDate())}, ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })} IST`;

    // 1. SHEET 1: EMPTY ROOMS MATRIX
    const matrixTitle = document.getElementById('printMatrixTitle');
    const matrixMeta = document.getElementById('printMatrixMeta');
    const matrixThead = document.getElementById('printMatrixThead');
    const matrixTbody = document.getElementById('printMatrixTbody');
    const matrixGenTime = document.getElementById('printMatrixGeneratedTime');

    let slotTitleText = '8:30 AM - 6:00 PM';
    if (slotRange === 'morning') slotTitleText = '8:30 AM - 1:30 PM';
    else if (slotRange === 'afternoon') slotTitleText = '2:00 PM - 6:00 PM';

    if (matrixTitle) matrixTitle.textContent = `EMPTY ROOMS MATRIX (${slotTitleText})`;
    if (matrixMeta) matrixMeta.textContent = `Date: ${formattedDate} | Day: ${dayName}`;
    if (matrixGenTime) matrixGenTime.textContent = generatedTimeStr;

    // Dynamically adjust table headers based on Venue Filter choice
    const numCols = venueFilter === 'rooms_only' ? 2 : (venueFilter === 'rooms_labs' ? 3 : 4);
    if (matrixThead) {
      if (venueFilter === 'rooms_labs') {
        matrixThead.innerHTML = `
          <tr>
            <th style="width: 20%;">TIME</th>
            <th style="width: 50%;">ROOM</th>
            <th style="width: 30%;">COMP LAB (CL, CLIB)</th>
          </tr>
        `;
      } else if (venueFilter === 'rooms_only') {
        matrixThead.innerHTML = `
          <tr>
            <th style="width: 25%;">TIME</th>
            <th style="width: 75%;">ROOM</th>
          </tr>
        `;
      } else {
        matrixThead.innerHTML = `
          <tr>
            <th style="width: 15%;">TIME</th>
            <th style="width: 32%;">ROOM</th>
            <th style="width: 18%;">COMP LAB (CL, CLIB)</th>
            <th style="width: 35%;">OTHER (TUT, PB, SCR)</th>
          </tr>
        `;
      }
    }

    const allSlots = [
      '8:30 AM to 9:30 AM',
      '9:30 AM to 10:30 AM',
      '10:30 AM to 11:30 AM',
      '11:30 AM to 12:30 PM',
      '12:30 PM to 1:30 PM',
      '2:00 PM to 3:00 PM',
      '3:00 PM to 4:00 PM',
      '4:00 PM to 5:00 PM',
      '5:00 PM to 6:00 PM'
    ];

    let targetSlots = allSlots;
    if (slotRange === 'morning') {
      targetSlots = allSlots.slice(0, 5);
    } else if (slotRange === 'afternoon') {
      targetSlots = allSlots.slice(5);
    }

    if (matrixTbody) {
      if (dayName === 'Sunday') {
        matrixTbody.innerHTML = `<tr><td colspan="${numCols}" style="text-align:center; padding: 24px; font-weight:700;">College is closed on Sunday. All classrooms are non-academic.</td></tr>`;
      } else {
        const roomsMap = (window.SRCC_DATA && window.SRCC_DATA.rooms) ? window.SRCC_DATA.rooms : {};
        const roomKeys = Object.keys(roomsMap);

        // Get active locks for this date & day
        const currentLocks = getRoomLocksList();

        let rowsHtml = '';
        targetSlots.forEach((slot) => {
          // If in 'all' mode and we reach 2:00 PM, insert Lunch Recess divider
          if (slotRange === 'all' && slot === '2:00 PM to 3:00 PM') {
            rowsHtml += `
              <tr style="background: #f8fafc; font-weight: 700;">
                <td class="cell-time" style="background:#f1f5f9;">1:30 PM to 2:00 PM</td>
                <td colspan="${numCols - 1}" style="text-align: center; letter-spacing: 2px; font-size: 8pt; color: #475569;">
                  — LUNCH RECESS —
                </td>
              </tr>
            `;
          }

          const freeRooms = [];
          const freePcs = [];
          const freeOther = [];

          roomKeys.forEach(rKey => {
            const roomObj = roomsMap[rKey];
            if (!roomObj) return;
            const rCode = roomObj.code || '';
            const scheduleForDay = roomObj.schedule ? roomObj.schedule[dayName] : null;

            let isFree = false;
            if (scheduleForDay) {
              if (Array.isArray(scheduleForDay.free_slots) && scheduleForDay.free_slots.includes(slot)) {
                isFree = true;
              } else if (Array.isArray(scheduleForDay.occupied_slots)) {
                const isOccupied = scheduleForDay.occupied_slots.some(occ => occ.slot === slot);
                if (!isOccupied) isFree = true;
              }
            } else {
              isFree = true;
            }

            // Check if locked in admin locks
            if (isFree) {
              const isLocked = currentLocks.some(lock => {
                if (String(lock.room_code || lock.roomCode || '').toUpperCase() !== rCode.toUpperCase()) return false;
                if (lock.recurrence === 'daily') return true;
                if (lock.recurrence === 'once' && lock.date === selectedDate) {
                  return (lock.slot === 'ALL_DAY' || lock.slot === slot);
                }
                if (lock.recurrence === 'weekly' && Array.isArray(lock.days) && lock.days.includes(dayName)) {
                  return (lock.slot === 'ALL_DAY' || lock.slot === slot);
                }
                if (lock.recurrence === 'weekend' && (dayName === 'Saturday' || dayName === 'Sunday')) {
                  return (lock.slot === 'ALL_DAY' || lock.slot === slot);
                }
                return false;
              });

              if (isLocked) {
                isFree = false;
              }
            }

            if (isFree) {
              const codeUp = rCode.toUpperCase();
              if (/^R\d+$/.test(codeUp)) {
                // Pure lecture classrooms e.g. R1, R2, R4, R14, R36
                freeRooms.push(rCode);
              } else if (codeUp.startsWith('CL') || codeUp.includes('LAB') || codeUp.includes('COMP') || codeUp.includes('PC')) {
                // Computer labs e.g. CL1, CL2, CL3, CLIB
                freePcs.push(rCode);
              } else {
                // Other: TUT (T1..), PB (PB1..), SCR (SCR1..), Seminar Room, Library, Principal Office, Playground
                freeOther.push(rCode);
              }
            }
          });

          const sortedRooms = naturalSortRooms(freeRooms);
          const sortedPcs = naturalSortRooms(freePcs);
          const sortedOther = naturalSortRooms(freeOther);

          if (venueFilter === 'rooms_labs') {
            rowsHtml += `
              <tr>
                <td class="cell-time">${slot}</td>
                <td>${sortedRooms.join(', ') || '—'}</td>
                <td>${sortedPcs.join(', ') || '—'}</td>
              </tr>
            `;
          } else if (venueFilter === 'rooms_only') {
            rowsHtml += `
              <tr>
                <td class="cell-time">${slot}</td>
                <td>${sortedRooms.join(', ') || '—'}</td>
              </tr>
            `;
          } else {
            rowsHtml += `
              <tr>
                <td class="cell-time">${slot}</td>
                <td>${sortedRooms.join(', ') || '—'}</td>
                <td>${sortedPcs.join(', ') || '—'}</td>
                <td>${sortedOther.join(', ') || '—'}</td>
              </tr>
            `;
          }
        });

        matrixTbody.innerHTML = rowsHtml;
      }
    }

    // 2. SHEET 2: FACULTY ON LEAVE
    const leavesMeta = document.getElementById('printLeavesMeta');
    const leavesTbody = document.getElementById('printLeavesTbody');
    const leavesGenTime = document.getElementById('printLeavesGeneratedTime');

    if (leavesMeta) leavesMeta.textContent = `Date: ${formattedDate} | Day: ${dayName}`;
    if (leavesGenTime) leavesGenTime.textContent = generatedTimeStr;

    if (leavesTbody) {
      let allLeaves = [];
      try {
        allLeaves = getLeavesList();
      } catch (e) {
        if (window.SRCC_FACULTY_LEAVES && window.SRCC_FACULTY_LEAVES.leaves) {
          allLeaves = window.SRCC_FACULTY_LEAVES.leaves;
        }
      }

      // Filter leaves covering selectedDate, fallback to all recorded leaves
      let activeLeaves = allLeaves.filter(l => {
        const s = l.start_date || l.startDate;
        const e = l.end_date || l.endDate || s;
        if (!s) return false;
        return (selectedDate >= s && selectedDate <= e);
      });

      if (activeLeaves.length === 0) {
        activeLeaves = allLeaves;
      }

      let leavesHtml = '';
      if (activeLeaves.length === 0) {
        leavesHtml += `<tr><td colspan="5" style="text-align: center; padding: 20px; font-weight: 700;">No faculty reported on leave for this date.</td></tr>`;
      } else {
        activeLeaves.forEach((leave, idx) => {
          let name = (leave.teacher_name || leave.teacherName || 'Faculty Member').toUpperCase().trim();
          if (!name.startsWith('DR.') && !name.startsWith('PROF.') && !name.startsWith('MR.') && !name.startsWith('MS.')) {
            name = 'DR. ' + name;
          }
          const dept = leave.department ? ` (${leave.department})` : '';
          const fromDate = formatShortDate(leave.start_date || leave.startDate);
          const toDate = formatShortDate(leave.end_date || leave.endDate || leave.start_date || leave.startDate);

          // Calculate actual number of leave calendar days
          let daysVal = '1';
          if (leave.half_day) {
            daysVal = '½';
          } else if (leave.days_count || leave.days) {
            daysVal = String(leave.days_count || leave.days);
          } else {
            const sStr = leave.start_date || leave.startDate;
            const eStr = leave.end_date || leave.endDate || sStr;
            if (sStr && eStr) {
              const sDate = new Date(sStr + 'T00:00:00');
              const eDate = new Date(eStr + 'T00:00:00');
              const diffMs = eDate.getTime() - sDate.getTime();
              const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1;
              daysVal = diffDays > 0 ? String(diffDays) : '1';
            }
          }

          leavesHtml += `
            <tr>
              <td class="cell-sno">${idx + 1}</td>
              <td class="cell-faculty-name">${name}${dept}</td>
              <td class="cell-date">${fromDate}</td>
              <td class="cell-date">${toDate}</td>
              <td class="cell-days">${daysVal}</td>
            </tr>
          `;
        });
      }

      const targetRowCount = Math.max(10, activeLeaves.length + 3);
      const remainingRows = targetRowCount - (activeLeaves.length || 1);
      for (let r = 0; r < remainingRows; r++) {
        leavesHtml += `
          <tr class="blank-ruled-row">
            <td class="cell-sno">&nbsp;</td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
            <td>&nbsp;</td>
          </tr>
        `;
      }

      leavesTbody.innerHTML = leavesHtml;
    }
  }

  boot();
});
