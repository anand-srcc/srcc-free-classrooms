/**
 * SRCC Timetable Admin Portal Logic - Faculty Leaves & Timetable Sync
 * Designed for Anand Kumar (25BC070) - Shri Ram College of Commerce
 */

document.addEventListener('DOMContentLoaded', () => {
  // Precomputed SHA-256 hashes for authorized administrator passcodes
  const AUTH_HASHES = [
    '0a9e7f8d689fb2da3fbe987c2b322a36b32524be309a807ec1dfdcf2ea3feeb7', // srcc2026
    'fb88c1c4a1796d194ec73161c5f87b8d0a3d463d12239d67fe3079b764cb15b9', // srccadmin
    'f21b777a06653b65593cffeb38976feefd0ee29c13b3846665790a6ea10c4333'  // anand
  ];
  const LEAVES_STORAGE_KEY = 'srcc_faculty_leaves_custom_v1';
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
        passwordHash: '0a9e7f8d689fb2da3fbe987c2b322a36b32524be309a807ec1dfdcf2ea3feeb7', // srcc2026
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
    const isAuth = sessionStorage.getItem(AUTH_STORAGE_KEY) === 'true';
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
      const uInput = (adminUsername ? adminUsername.value : '').trim();
      const val = (adminPasscode ? adminPasscode.value : '').trim();
      if (!val) return;

      const hashed = await hashPasscode(val);
      const users = getStoredUsers();

      let matchedUser = null;
      if (uInput) {
        matchedUser = users.find(u => u.username.toLowerCase() === uInput.toLowerCase());
        if (matchedUser) {
          const isMatch = (matchedUser.passwordHash === hashed) || 
                          (matchedUser.isSuper && (AUTH_HASHES.includes(hashed) || val === 'srcc2026'));
          if (!isMatch) matchedUser = null;
        }
      } else {
        // If username not entered, check if password matches any user or default super admin
        matchedUser = users.find(u => u.passwordHash === hashed || (u.isSuper && (AUTH_HASHES.includes(hashed) || val === 'srcc2026')));
        if (!matchedUser && (AUTH_HASHES.includes(hashed) || val === 'srcc2026')) {
          matchedUser = users[0];
        }
      }

      if (matchedUser) {
        sessionStorage.setItem(AUTH_STORAGE_KEY, 'true');
        sessionStorage.setItem(ACTIVE_USER_SESSION_KEY, JSON.stringify({
          username: matchedUser.username,
          fullName: matchedUser.fullName,
          role: matchedUser.role,
          isSuper: matchedUser.isSuper
        }));
        showToast(`🔓 <strong>Welcome, ${escapeHtml(matchedUser.fullName)}!</strong> Logged in successfully.`);
        checkAuth();
      } else {
        showToast('⚠️ Incorrect username or administrator passcode.', false);
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
      const stored = localStorage.getItem(LEAVES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn('Failed to parse stored leaves:', e);
    }
    if (defaultLeaves && Array.isArray(defaultLeaves.leaves)) {
      return [...defaultLeaves.leaves];
    }
    return [];
  }

  function saveLeavesList(leaves) {
    try {
      localStorage.setItem(LEAVES_STORAGE_KEY, JSON.stringify(leaves));
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

  function getCloudDbUrl() {
    return (window.SRCC_CLOUD_CONFIG && window.SRCC_CLOUD_CONFIG.db_url) || localStorage.getItem(CLOUD_DB_STORAGE_KEY) || '';
  }

  function setCloudDbUrl(url) {
    if (url) {
      localStorage.setItem(CLOUD_DB_STORAGE_KEY, url);
      if (window.SRCC_CLOUD_CONFIG) window.SRCC_CLOUD_CONFIG.db_url = url;
    } else {
      localStorage.removeItem(CLOUD_DB_STORAGE_KEY);
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

  async function syncLeavesToCloud(leavesList, showSuccessToast = false) {
    const url = getCloudDbUrl();
    if (!url) return false;

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
      const codeStr = code ? ` [${code}]` : '';
      return `<option value="${t.id}">${t.clean_name}${codeStr} — ${t.department} (${t.total_teaching_periods || 0} classes/wk)</option>`;
    }).join('');

    if (filtered.length > 0 && !adminTeacherSelect.value) {
      adminTeacherSelect.selectedIndex = 0;
    }
  }

  if (adminTeacherSearch) {
    adminTeacherSearch.addEventListener('input', (e) => {
      populateTeacherSelect(e.target.value);
    });
  }

  // Add Leave Handler
  if (btnAdminAddLeave) {
    btnAdminAddLeave.addEventListener('click', () => {
      const teacherId = adminTeacherSelect ? adminTeacherSelect.value : '';
      if (!teacherId) {
        showToast('⚠️ Please select a professor from the list first', false);
        return;
      }

      const teacher = teachersData.teachers.find(t => String(t.id) === String(teacherId));
      if (!teacher) return;

      const sDate = adminStartDate ? adminStartDate.value : getTodayIsoDate();
      const eDate = adminEndDate ? adminEndDate.value : sDate;
      const reason = (adminLeaveReason && adminLeaveReason.value.trim()) || 'Faculty Leave';

      if (eDate < sDate) {
        showToast('⚠️ End date cannot be before start date', false);
        return;
      }

      const newLeave = {
        id: 'leave_' + Date.now(),
        teacher_id: teacher.id,
        teacher_name: teacher.clean_name,
        teacher_code: getDisplayShortCode(teacher) || teacher.short_code,
        department: teacher.department,
        start_date: sDate,
        end_date: eDate,
        reason: reason,
        added_at: new Date().toISOString()
      };

      const current = getLeavesList();
      current.unshift(newLeave);
      saveLeavesList(current);

      renderLeavesTable();
      updateKpis();
      updateCodePreview();

      showToast(`🏖️ Successfully marked <strong>${teacher.clean_name}</strong> on leave! Scheduled classrooms are now unlocked for study.`, true, 4000);
      if (adminLeaveReason) adminLeaveReason.value = '';

      // Auto-sync to Cloud DB if configured
      syncLeavesToCloud(current, false);
    });
  }

  // Render Leaves List / Table
  function renderLeavesTable() {
    if (!adminLeavesListContainer) return;
    const leaves = getLeavesList();
    const today = getTodayIsoDate();

    if (adminActiveLeavesCount) adminActiveLeavesCount.textContent = leaves.length;

    if (leaves.length === 0) {
      adminLeavesListContainer.innerHTML = `
        <div class="leaves-empty-msg">
          No faculty leaves are currently recorded. All 210 professors are on regular college duty.
        </div>
      `;
      return;
    }

    adminLeavesListContainer.innerHTML = leaves.map(leave => {
      const s = leave.start_date || today;
      const e = leave.end_date || today;
      const isActiveToday = (today >= s && today <= e);
      const code = leave.teacher_code && !/^(cg|eg|mg|hg|hgc)\d*$/i.test(leave.teacher_code) ? ` [${leave.teacher_code}]` : '';

      return `
        <div class="leave-item-row" data-leave-id="${leave.id}">
          <div class="leave-item-details">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span class="leave-item-teacher">👨‍🏫 ${escapeHtml(leave.teacher_name)}${code}</span>
              <span style="font-size: 0.72rem; color: var(--text-secondary);">(${leave.department || 'Faculty'})</span>
              ${isActiveToday ? '<span style="background: rgba(244, 63, 94, 0.25); color: #FDA4AF; border: 1px solid rgba(244, 63, 94, 0.4); font-size: 0.68rem; font-weight: 800; padding: 1px 6px; border-radius: 9999px;">ACTIVE TODAY</span>' : ''}
            </div>
            <span class="leave-item-dates">📅 Dates: ${s} to ${e}</span>
            ${leave.reason ? `<span class="leave-item-reason">"${escapeHtml(leave.reason)}"</span>` : ''}
          </div>
          <button class="btn-delete-leave" data-leave-id="${leave.id}" title="Remove leave and restore scheduled classes">
            ✕ Delete Leave
          </button>
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

  // Cloud Database Save & Push Handlers
  if (btnSaveCloudDbUrl) {
    btnSaveCloudDbUrl.addEventListener('click', async () => {
      const rawUrl = (cloudDbUrlInput ? cloudDbUrlInput.value : '').trim();
      if (!rawUrl) {
        setCloudDbUrl('');
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
      setCloudDbUrl(formattedUrl);

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
      <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem; text-align: left;">
        <thead>
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); color: var(--text-secondary);">
            <th style="padding: 8px;">Username</th>
            <th style="padding: 8px;">Full Name</th>
            <th style="padding: 8px;">Role</th>
            <th style="padding: 8px;">Created</th>
            <th style="padding: 8px; text-align: right;">Action</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(u => {
            const isSelf = u.username.toLowerCase() === activeUser.username.toLowerCase();
            const canDelete = !u.isSuper && !isSelf;
            const roleBadgeStyle = u.isSuper 
              ? 'background: rgba(252, 235, 10, 0.15); color: var(--srcc-gold); border: 1px solid rgba(252, 235, 10, 0.3);'
              : 'background: rgba(56, 189, 248, 0.15); color: #38BDF8; border: 1px solid rgba(56, 189, 248, 0.3);';
            return `
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="padding: 8px; font-weight: 700; color: #FFF;">
                  <code>${escapeHtml(u.username)}</code>
                  ${isSelf ? '<span style="font-size: 0.68rem; color: #34D399; margin-left: 4px;">(You)</span>' : ''}
                </td>
                <td style="padding: 8px; color: var(--text-primary);">${escapeHtml(u.fullName)}</td>
                <td style="padding: 8px;">
                  <span style="padding: 2px 8px; border-radius: var(--radius-full); font-size: 0.72rem; font-weight: 600; ${roleBadgeStyle}">${escapeHtml(u.role)}</span>
                </td>
                <td style="padding: 8px; color: var(--text-muted);">${escapeHtml(u.createdAt || 'N/A')}</td>
                <td style="padding: 8px; text-align: right;">
                  ${canDelete ? `
                    <button type="button" class="btn-delete-admin-user" data-username="${escapeHtml(u.username)}" style="background: rgba(244,63,94,0.15); border: 1px solid rgba(244,63,94,0.3); color: #FECDD3; padding: 4px 9px; border-radius: var(--radius-sm); font-size: 0.72rem; cursor: pointer; font-weight: 600;">
                      ✕ Remove
                    </button>
                  ` : `<span style="color: var(--text-muted); font-size: 0.72rem; font-style: italic;">Protected</span>`}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    document.querySelectorAll('.btn-delete-admin-user').forEach(btn => {
      btn.addEventListener('click', () => {
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
                         (targetUser.isSuper && (AUTH_HASHES.includes(curHash) || cur === 'srcc2026'));

      if (!isCurValid) {
        showToast('⚠️ Current password incorrect.', false);
        if (pwdCurrent) { pwdCurrent.value = ''; pwdCurrent.focus(); }
        return;
      }

      const newHash = await hashPasscode(n1);
      users[userIdx].passwordHash = newHash;
      saveStoredUsers(users);

      showToast('✅ <strong>Password updated successfully!</strong> Keep your new password secure.');
      if (pwdCurrent) pwdCurrent.value = '';
      if (pwdNew) pwdNew.value = '';
      if (pwdConfirm) pwdConfirm.value = '';
    });
  }

  // Create New Admin User Form Submission
  if (formCreateAdminUser) {
    formCreateAdminUser.addEventListener('submit', async (e) => {
      e.preventDefault();
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
        isSuper: false
      });

      saveStoredUsers(users);
      renderAdminUsersList();
      showToast(`🎉 <strong>Account created!</strong> User <code>${escapeHtml(uname)}</code> can now log in.`);
      if (newUserUsername) newUserUsername.value = '';
      if (newUserFullName) newUserFullName.value = '';
      if (newUserPassword) newUserPassword.value = '';
    });
  }

  // Check authentication on startup
  checkAuth();
});
