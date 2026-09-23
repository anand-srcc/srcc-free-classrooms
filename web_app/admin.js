/**
 * SRCC Timetable Admin Portal Logic - Faculty Leaves & Timetable Sync
 * Designed for Anand Kumar (25BC070) - Shri Ram College of Commerce
 */

document.addEventListener('DOMContentLoaded', () => {
  // Precomputed SHA-256 hashes for authorized administrator passcodes
  const AUTH_HASHES = [
    '06f1339f683c69374e5805994b4956bc856e0204827364a6062894a88d792fae', // srcc2026
    '68c7ac5777aac392b5e34d5c9e20421cd970534ae1529defd1ceb7a064be56cc', // srccadmin
    '5f4df959a11580fc14aa6b139adb2ab40a2cfde5399c1cb6f7c9968eae5a825f'  // anand
  ];
  const LEAVES_STORAGE_KEY = 'srcc_faculty_leaves_v2';
  const AUTH_STORAGE_KEY = 'srcc_admin_session_auth';
  const USERS_STORAGE_KEY = 'srcc_admin_users_list_v1';
  const ACTIVE_USER_SESSION_KEY = 'srcc_admin_active_user_session';

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
      console.warn('Crypto subtle unavailable, using fallback', e);
    }
    return str;
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
        passwordHash: '06f1339f683c69374e5805994b4956bc856e0204827364a6062894a88d792fae', // srcc2026
        createdAt: 'Default Master Account',
        isSuper: true
      }
    ];
    saveStoredUsers(defaultUsers);
    return defaultUsers;
  }

  function saveStoredUsers(users) {
    try {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
      syncUsersToCloud(users);
    } catch (e) {
      console.error('Error saving admin users', e);
    }
  }

  function getActiveSessionUser() {
    try {
      const u = sessionStorage.getItem(ACTIVE_USER_SESSION_KEY);
      if (u) return JSON.parse(u);
    } catch (e) {}
    return { username: 'admin', fullName: 'Master Administrator (Anand)', role: 'Super Admin', isSuper: true };
  }

  function checkAuth() {
    const sessionVal = sessionStorage.getItem(AUTH_STORAGE_KEY);
    const isAuth = sessionVal && sessionVal.startsWith('srcc_auth_');
    if (isAuth) {
      if (adminAuthView) adminAuthView.style.display = 'none';
      if (adminDashboardView) adminDashboardView.style.display = 'block';
      if (adminNavActions) adminNavActions.style.display = 'flex';
      initDashboard();
    } else {
      if (adminAuthView) adminAuthView.style.display = 'flex';
      if (adminDashboardView) adminDashboardView.style.display = 'none';
      if (adminNavActions) adminNavActions.style.display = 'none';
    }
  }

  if (adminLoginForm) {
    adminLoginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      let uInput = (adminUsername ? adminUsername.value : '').trim().toLowerCase();
      const val = (adminPasscode ? adminPasscode.value : '').trim();
      if (!val) {
        showToast('⚠️ Please enter your password or passcode.', false);
        if (adminPasscode) adminPasscode.focus();
        return;
      }

      // If username input is blank, default to 'admin' (matching "Optional for default Admin")
      if (!uInput) {
        uInput = 'admin';
      }

      // Emergency Reset Feature
      if (val === 'reset2026') {
        localStorage.removeItem(USERS_STORAGE_KEY);
        alert('Password has been successfully reset to default! The page will now reload.');
        window.location.reload();
        return;
      }

      const hashed = await hashPasscode(val);
      const users = getStoredUsers();

      let matchedUser = users.find(u => u.username.toLowerCase() === uInput);
      if (matchedUser) {
        const isMatch = (matchedUser.passwordHash === hashed) || 
                        (matchedUser.isSuper && !matchedUser.hasChangedPassword && (AUTH_HASHES.includes(hashed)));
        if (!isMatch) matchedUser = null;
      }

      if (matchedUser) {
        // Obfuscate the token slightly to deter casual localStorage modification
        const tokenStr = 'srcc_auth_' + btoa(Date.now().toString());
        sessionStorage.setItem(AUTH_STORAGE_KEY, tokenStr);
        sessionStorage.setItem(ACTIVE_USER_SESSION_KEY, JSON.stringify({
          username: matchedUser.username,
          fullName: matchedUser.fullName,
          role: matchedUser.role,
          isSuper: !!matchedUser.isSuper
        }));
        showToast(`🔓 <strong>Welcome, ${escapeHtml(matchedUser.fullName)}!</strong> Logged in successfully.`);
        checkAuth();
      } else {
        showToast('⚠️ Incorrect username or password. Please try again.', false);
        if (adminPasscode) {
          adminPasscode.value = '';
          adminPasscode.focus();
        }
      }
    });
  }

  if (btnAdminLogout) {
    btnAdminLogout.addEventListener('click', () => {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
      sessionStorage.removeItem(ACTIVE_USER_SESSION_KEY);
      showToast('🔒 Logged out of Admin Portal.');
      checkAuth();
    });
  }

  // ==========================================================================
  // 💾 LEAVES LOCAL STORAGE SYNC
  // ==========================================================================
  function getLeavesList() {
    try {
      const stored = localStorage.getItem(LEAVES_STORAGE_KEY) || localStorage.getItem('srcc_faculty_leaves_custom_v1');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          if (!localStorage.getItem(LEAVES_STORAGE_KEY)) {
            localStorage.setItem(LEAVES_STORAGE_KEY, stored);
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse stored leaves:', e);
    }
    if (window.SRCC_FACULTY_LEAVES && Array.isArray(window.SRCC_FACULTY_LEAVES.leaves)) {
      return [...window.SRCC_FACULTY_LEAVES.leaves];
    }
    if (defaultLeaves && Array.isArray(defaultLeaves.leaves)) {
      return [...defaultLeaves.leaves];
    }
    return [];
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
  // 📊 DASHBOARD INITIALIZATION
  // ==========================================================================
  function initDashboard() {
    populateTeacherSelect();
    setDefaultDates();
    renderLeavesTable();
    updateKpis();
    updateCodePreview();

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
      const p = dStr.split('-');
      if (p.length === 3) {
        const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][parseInt(p[1], 10) - 1] || '';
        return `${parseInt(p[2], 10)} ${m}`;
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

    return `*SRCC Faculty Leave Update (${leavesList.length})* 🏖️\n\n${lines.join('\n')}\n\n_Check free classrooms:_ https://srcc-free-classrooms.netlify.app/`;
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

      const singleLeaveMsg = `*SRCC Faculty Leave Update* 🏖️\n\n1. ${leave.teacher_name}${code} (${dateRangeDisplay})\n\n_Check free classrooms:_ https://srcc-free-classrooms.netlify.app/`;

      return `
        <div class="leave-item-row" data-leave-id="${leave.id}">
          <span class="leave-item-num">${idx + 1}</span>
          <div class="leave-item-details">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span class="leave-item-teacher">${escapeHtml(leave.teacher_name)}${code}</span>
              <span class="leave-item-dates">📅 ${dateRangeDisplay}</span>
              ${halfDayBadge}
              ${isActiveToday ? '<span style="background: #FEE2E2; color: #991B1B; border: 1px solid #FCA5A5; font-size: 0.68rem; font-weight: 800; padding: 2px 8px; border-radius: 9999px;">ACTIVE TODAY</span>' : ''}
              ${addedByBadge}
            </div>
            ${leave.reason ? `<span class="leave-item-reason">"${escapeHtml(leave.reason)}"</span>` : ''}
          </div>
          <div style="display: flex; align-items: center; gap: 6px; margin-left: auto;">
            <a href="https://wa.me/?text=${encodeURIComponent(singleLeaveMsg)}" target="_blank" class="btn-share-wa" title="Share on WhatsApp">
              💬 Share
            </a>
            <button class="btn-delete-leave" data-leave-id="${leave.id}" title="Remove leave and restore scheduled classes">
              ✕ Delete
            </button>
          </div>
        </div>
      `;
    }).join('');

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
              const isSelf = u.username.toLowerCase() === activeUser.username.toLowerCase();
              const canDelete = activeUser.isSuper && !u.isSuper && !isSelf;
              const roleBadge = u.isSuper 
                ? '<span style="background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; font-size: 0.74rem; font-weight: 700; padding: 3px 10px; border-radius: 9999px; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">👑 Super Admin</span>'
                : '<span style="background: #e0f2fe; color: #0369a1; border: 1px solid #7dd3fc; font-size: 0.74rem; font-weight: 700; padding: 3px 10px; border-radius: 9999px; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">🛡️ Leave Coordinator</span>';
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
                        ✕ Remove
                      </button>
                    ` : `<span style="color: #94a3b8; font-size: 0.75rem; font-weight: 600; font-style: italic;">Protected</span>`}
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;

    document.querySelectorAll('.btn-delete-admin-user').forEach(btn => {
      btn.addEventListener('click', () => {
        const curActive = getActiveSessionUser();
        if (!curActive.isSuper) {
          showToast('⚠️ Only Super Administrators can remove accounts.', false);
          return;
        }
        const uname = btn.dataset.username;
        if (confirm(`Remove administrator account "${uname}"? They will no longer be able to log in.`)) {
          let users = getStoredUsers();
          users = users.filter(u => u.username.toLowerCase() !== uname.toLowerCase());
          saveStoredUsers(users);
          renderAdminUsersList();
          showToast(`🗑️ Account <strong>${escapeHtml(uname)}</strong> removed successfully.`);
        }
      });
    });
  }

  // Change Password Form Submission
  if (formChangePassword) {
    formChangePassword.addEventListener('submit', async (e) => {
      e.preventDefault();
      const cur = (pwdCurrent ? pwdCurrent.value : '').trim();
      const n1 = (pwdNew ? pwdNew.value : '').trim();
      const n2 = (pwdConfirm ? pwdConfirm.value : '').trim();

      if (!cur) {
        showToast('⚠️ Please enter your current password.', false);
        if (pwdCurrent) pwdCurrent.focus();
        return;
      }
      if (n1 !== n2) {
        showToast('⚠️ New passwords do not match.', false);
        return;
      }
      if (n1.length < 4) {
        showToast('⚠️ New password must be at least 4 characters long.', false);
        return;
      }

      const curHash = await hashPasscode(cur);
      const activeUser = getActiveSessionUser();
      const users = getStoredUsers();
      const userIdx = users.findIndex(u => u.username.toLowerCase() === activeUser.username.toLowerCase());

      if (userIdx === -1) {
        showToast('⚠️ User session invalid. Please log in again.', false);
        return;
      }

      const targetUser = users[userIdx];
      const isCurValid = (targetUser.passwordHash === curHash) ||
                         (targetUser.isSuper && !targetUser.hasChangedPassword && (AUTH_HASHES.includes(curHash)));

      if (!isCurValid) {
        showToast('⚠️ Current password incorrect. Please verify your existing password.', false);
        if (pwdCurrent) { pwdCurrent.value = ''; pwdCurrent.focus(); }
        return;
      }

      const newHash = await hashPasscode(n1);
      users[userIdx].passwordHash = newHash;
      users[userIdx].hasChangedPassword = true;
      saveStoredUsers(users);

      // Keep active session updated
      sessionStorage.setItem(ACTIVE_USER_SESSION_KEY, JSON.stringify({
        username: users[userIdx].username,
        fullName: users[userIdx].fullName,
        role: users[userIdx].role,
        isSuper: !!users[userIdx].isSuper
      }));

      showToast('✅ <strong>Password updated successfully!</strong> Old password is now deactivated.');
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
      if (!activeUser.isSuper) {
        showToast('⚠️ Only Super Administrators can create new accounts.', false);
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
      users.push({
        username: uname,
        fullName: name,
        role: role,
        passwordHash: pwdHash,
        createdAt: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        isSuper: false,
        hasChangedPassword: true
      });

      saveStoredUsers(users);
      renderAdminUsersList();
      showToast(`🎉 <strong>Account created!</strong> User <code>${escapeHtml(uname)}</code> can now log in.`);
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
    
    // Fetch users (admins) in background with smart reconciliation (never wipes local users)
    fetchUsersFromCloud().then(cloudUsers => {
      if (cloudUsers && Array.isArray(cloudUsers) && cloudUsers.length > 0) {
        const localUsers = getStoredUsers();
        const mergedMap = new Map();

        // 1. Add all local users first (authoritative for recent local creations and password changes)
        localUsers.forEach(u => {
          if (u && u.username) mergedMap.set(u.username.toLowerCase(), u);
        });

        // 2. Add or merge cloud users
        cloudUsers.forEach(cu => {
          if (!cu || !cu.username) return;
          const key = cu.username.toLowerCase();
          if (!mergedMap.has(key)) {
            // New user from cloud that does not exist locally
            mergedMap.set(key, cu);
          } else {
            const local = mergedMap.get(key);
            // If local hasn't changed password but cloud has, take cloud update
            if (!local.hasChangedPassword && cu.hasChangedPassword) {
              mergedMap.set(key, cu);
            }
          }
        });

        const merged = Array.from(mergedMap.values());
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(merged));
        if (adminDashboardView && adminDashboardView.style.display === 'block') {
           renderAdminUsersList();
        }
      }
    });

    // Fetch visitor count in background
    fetchVisitorCount();
    
    // Fetch student issues
    fetchStudentIssues();
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
                ✅ <strong>No open student reports.</strong> When students submit a wrong room or teacher attendance discrepancy, it will appear here immediately with 1-click dismiss.
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
  
  boot();
});
