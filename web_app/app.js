/**
 * SRCC Free Classroom Finder & Faculty Locator - Core Application Logic
 * Integrates 96 Classrooms and 210 Faculty Members from Shri Ram College of Commerce
 */

// ==========================================================================
// 🔗 SRCC WHATSAPP COMMUNITY / GROUP LINK CONFIGURATION
// 👉 UPDATE YOUR ACTIVE WHATSAPP GROUP INVITE LINK HERE:
// ==========================================================================
const SRCC_WHATSAPP_LINK = 'https://chat.whatsapp.com/H6qxq6fGSDVJNPCEtzQgjf';

document.addEventListener('DOMContentLoaded', () => {
  let appData = window.SRCC_DATA;
  let teachersData = window.SRCC_TEACHERS_DATA;
  let leavesData = window.SRCC_FACULTY_LEAVES;

  const loadingStateEl = document.getElementById('loadingState');
  const errorStateEl = document.getElementById('errorState');
  const errorMessageTextEl = document.getElementById('errorMessageText');
  const btnRetryLoadEl = document.getElementById('btnRetryLoad');

  if (btnRetryLoadEl) {
    btnRetryLoadEl.addEventListener('click', () => {
      window.location.reload();
    });
  }

  // Display animated loading skeleton while initial data is fetching
  if (!appData && loadingStateEl) {
    loadingStateEl.style.display = 'block';
  }

  const loadPromises = [];
  if (!appData) {
    loadPromises.push(
      fetch('srcc_data.json')
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then(d => { appData = d; })
        .catch(err => console.error('Failed to fetch srcc_data.json:', err))
    );
  }
  
  let directoryData = window.SRCC_DIRECTORY_DATA;
  if (!directoryData) {
    loadPromises.push(
      fetch('directory_data.json')
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then(d => { directoryData = d; window.SRCC_DIRECTORY_DATA = d; })
        .catch(err => console.warn('Failed to fetch directory_data.json:', err))
    );
  }
  if (!teachersData) {
    loadPromises.push(
      fetch('teachers_data.json')
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then(d => { teachersData = d; })
        .catch(err => {
          console.warn('Failed to fetch teachers_data.json:', err);
          teachersData = { teachers: [] };
        })
    );
  }
  // 🏖️ Smart Leaves Fetch:
  // If running locally (file:// or localhost) -> prioritize local faculty_leaves.js / faculty_leaves.json
  // If running on production (Netlify) -> fetch live from GitHub Raw CDN (0 Netlify build credits)
  const isLocalEnv = window.location.protocol === 'file:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const GITHUB_LIVE_LEAVES_URL = 'https://raw.githubusercontent.com/anand-srcc/srcc-free-classrooms/main/web_app/faculty_leaves.json';
  
  if (!isLocalEnv) {
    const leavesFetchPromise = fetch(`${GITHUB_LIVE_LEAVES_URL}?t=${Date.now()}`, { cache: 'no-cache' })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => {
        if (d && Array.isArray(d.leaves)) {
          leavesData = d;
          window.SRCC_FACULTY_LEAVES = d;
          try {
            localStorage.setItem('srcc_faculty_leaves_v2', JSON.stringify(d.leaves));
          } catch (e) {}
          // Re-render faculty leaves view if active
          if (typeof renderFacultyLeavesView === 'function' && document.getElementById('facultyLeavesView')?.style.display !== 'none') {
            try { renderFacultyLeavesView(); } catch (e) {}
          }
        }

      })
      .catch(() => {
        if (!leavesData) {
          return fetch('faculty_leaves.json')
            .then(r => r.ok ? r.json() : null)
            .then(d => {
              if (d) {
                leavesData = d;
                window.SRCC_FACULTY_LEAVES = d;
              }
            })
            .catch(e => console.warn('Leaves local fallback note:', e));
        }
      });
    loadPromises.push(leavesFetchPromise);
  } else {
    // In local development / testing: use local faculty_leaves.js or faculty_leaves.json
    if (!leavesData) {
      loadPromises.push(
        fetch('faculty_leaves.json?t=' + Date.now())
          .then(r => r.ok ? r.json() : null)
          .then(d => {
            if (d) {
              leavesData = d;
              window.SRCC_FACULTY_LEAVES = d;
            }
          })
          .catch(() => {})
      );
    }
  }

  // ☁️ Optional Cloud Database Fetch (if custom cloud_config.js URL or admin configured URL is provided)
  const rawCloudUrl = (window.SRCC_CLOUD_CONFIG && window.SRCC_CLOUD_CONFIG.db_url && window.SRCC_CLOUD_CONFIG.db_url.trim())
    ? window.SRCC_CLOUD_CONFIG.db_url.trim()
    : (localStorage.getItem('srcc_cloud_db_url') || localStorage.getItem('srcc_cloud_db_url_custom') || '');
  const customCloudUrl = rawCloudUrl ? rawCloudUrl.trim() : '';

  if (customCloudUrl) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    loadPromises.push(
      fetch(customCloudUrl, { signal: controller.signal, cache: 'no-cache' })
        .then(r => {
          clearTimeout(timeoutId);
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then(d => {
          if (d) {
            if (Array.isArray(d.leaves)) {
              leavesData = d;
              window.SRCC_FACULTY_LEAVES = d;
              try { localStorage.setItem('srcc_faculty_leaves_v2', JSON.stringify(d.leaves)); } catch (e) {}
            } else if (Array.isArray(d)) {
              leavesData = { leaves: d, last_updated: 'Live Cloud' };
              window.SRCC_FACULTY_LEAVES = leavesData;
              try { localStorage.setItem('srcc_faculty_leaves_v2', JSON.stringify(d)); } catch (e) {}
            }
          }
        })
        .catch(err => {
          clearTimeout(timeoutId);
          console.warn('Custom Cloud Sync note:', err);
        })
    );
  }

  // 🔒 Fetch Active Room Locks & Extra Classes
  let roomLocksList = [];
  const ROOM_LOCKS_STORAGE_KEY = 'srcc_room_locks_v1';
  try {
    const cachedLocks = localStorage.getItem(ROOM_LOCKS_STORAGE_KEY);
    if (cachedLocks) roomLocksList = JSON.parse(cachedLocks) || [];
  } catch (e) {}

  const FIREBASE_BASE_URL = 'https://srcc-leaves-default-rtdb.firebaseio.com';
  loadPromises.push(
    fetch(`${FIREBASE_BASE_URL}/room_locks.json?t=${Date.now()}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (Array.isArray(d)) {
          roomLocksList = d;
          window.SRCC_ROOM_LOCKS = d;
          try { localStorage.setItem(ROOM_LOCKS_STORAGE_KEY, JSON.stringify(d)); } catch (e) {}
        } else if (d && typeof d === 'object') {
          roomLocksList = Object.values(d);
          window.SRCC_ROOM_LOCKS = roomLocksList;
          try { localStorage.setItem(ROOM_LOCKS_STORAGE_KEY, JSON.stringify(roomLocksList)); } catch (e) {}
        }
      })
      .catch(() => {})
  );

  // 📢 Fetch Active Campus Notices & Banners
  let campusNoticesList = [];
  const CAMPUS_NOTICES_STORAGE_KEY = 'srcc_campus_notices_v1';
  try {
    const cachedNotices = localStorage.getItem(CAMPUS_NOTICES_STORAGE_KEY);
    if (cachedNotices) campusNoticesList = JSON.parse(cachedNotices) || [];
  } catch (e) {}

  loadPromises.push(
    fetch(`${FIREBASE_BASE_URL}/campus_notices.json?t=${Date.now()}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (Array.isArray(d)) {
          campusNoticesList = d;
          window.SRCC_CAMPUS_NOTICES = d;
          try { localStorage.setItem(CAMPUS_NOTICES_STORAGE_KEY, JSON.stringify(d)); } catch (e) {}
        } else if (d && typeof d === 'object') {
          campusNoticesList = Object.values(d);
          window.SRCC_CAMPUS_NOTICES = campusNoticesList;
          try { localStorage.setItem(CAMPUS_NOTICES_STORAGE_KEY, JSON.stringify(campusNoticesList)); } catch (e) {}
        }
      })
      .catch(() => {})
  );

  // 🏛️ Fetch Active Room Management Overrides
  let roomOverridesMap = {};
  const ROOM_OVERRIDES_STORAGE_KEY = 'srcc_room_overrides_v1';
  try {
    const cachedOverrides = localStorage.getItem(ROOM_OVERRIDES_STORAGE_KEY);
    if (cachedOverrides) roomOverridesMap = JSON.parse(cachedOverrides) || {};
  } catch (e) {}
  window.SRCC_ROOM_OVERRIDES = roomOverridesMap;

  loadPromises.push(
    fetch(`${FIREBASE_BASE_URL}/room_overrides.json?t=${Date.now()}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && typeof d === 'object') {
          roomOverridesMap = d;
          window.SRCC_ROOM_OVERRIDES = d;
          try { localStorage.setItem(ROOM_OVERRIDES_STORAGE_KEY, JSON.stringify(d)); } catch (e) {}
        }
      })
      .catch(() => {})
  );

  // 📶 Fetch Campus WiFi Directory (Custom / Updated Networks)
  let campusWifiList = [];
  const CAMPUS_WIFI_STORAGE_KEY = 'srcc_campus_wifi_v1';
  try {
    const cachedWifi = localStorage.getItem(CAMPUS_WIFI_STORAGE_KEY);
    if (cachedWifi) campusWifiList = JSON.parse(cachedWifi) || [];
  } catch (e) {}
  if (!campusWifiList.length && window.SRCC_WIFI_DATA && Array.isArray(window.SRCC_WIFI_DATA.networks)) {
    campusWifiList = [...window.SRCC_WIFI_DATA.networks];
  }
  window.SRCC_CAMPUS_WIFI = campusWifiList;

  loadPromises.push(
    fetch(`${FIREBASE_BASE_URL}/campus_wifi.json?t=${Date.now()}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (Array.isArray(d) && d.length > 0) {
          campusWifiList = d;
          window.SRCC_CAMPUS_WIFI = d;
          try { localStorage.setItem(CAMPUS_WIFI_STORAGE_KEY, JSON.stringify(d)); } catch (e) {}
        } else if (d && typeof d === 'object') {
          const arr = Object.values(d);
          if (arr.length > 0) {
            campusWifiList = arr;
            window.SRCC_CAMPUS_WIFI = arr;
            try { localStorage.setItem(CAMPUS_WIFI_STORAGE_KEY, JSON.stringify(arr)); } catch (e) {}
          }
        }
      })
      .catch(() => {})
  );

  if (loadPromises.length > 0) {
    Promise.all(loadPromises)
      .then(() => initApp())
      .catch(err => {
        console.error('Initialization error:', err);
        initApp();
      });
  } else {
    initApp();
  }

  // ========================================================================
  // 🕒 ASIA/KOLKATA (IST) TIMEZONE ENFORCEMENT HELPER
  // ========================================================================
  function getIstDate() {
    try {
      const now = new Date();
      const istString = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' });
      return new Date(istString);
    } catch (e) {
      // Fallback if Intl timeZone is unsupported
      const now = new Date();
      const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
      return new Date(utc + (3600000 * 5.5)); // UTC+5:30
    }
  }

  function initApp() {
    if (loadingStateEl) loadingStateEl.style.display = 'none';

    if (!appData || !appData.rooms) {
      console.error('Timetable data is empty or failed to load.');
      if (errorStateEl) {
        errorStateEl.style.display = 'block';
        if (errorMessageTextEl) {
          errorMessageTextEl.textContent = 'Could not load the college timetable data. Please check your internet connection and tap Retry.';
        }
      }
      return;
    }
    if (errorStateEl) errorStateEl.style.display = 'none';

    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const istNow = getIstDate();
    const todayIndex = istNow.getDay();
    const todayName = daysOfWeek[todayIndex];
    const initialDay = (todayName === 'Sunday') ? 'Monday' : todayName;

    // Standard local date string YYYY-MM-DD in Asia/Kolkata
    function getTodayIsoDate() {
      const d = getIstDate();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // Format ISO date (YYYY-MM-DD) to DD/MM/YYYY
    function formatIsoToDdMmYyyy(isoStr) {
      if (!isoStr) return '';
      const p = String(isoStr).trim().split('-');
      if (p.length === 3) {
        const day = p[2].padStart(2, '0');
        const mon = p[1].padStart(2, '0');
        const yr = p[0];
        return `${day}/${mon}/${yr}`;
      }
      return isoStr;
    }

    function formatLeaveDateRangeDdMmYyyy(s, e) {
      if (!s && !e) return 'Today';
      const sFmt = formatIsoToDdMmYyyy(s);
      const eFmt = formatIsoToDdMmYyyy(e);
      if (sFmt && eFmt) {
        return (sFmt === eFmt) ? sFmt : `${sFmt} – ${eFmt}`;
      }
      return sFmt || eFmt || 'Today';
    }

    // Room display & jump helpers for Library First Floor and other facilities
    function getDisplayRoomName(room) {
      if (!room || room === 'TBD') return 'No Room';
      const trimmed = String(room).trim();
      if (/^library(\s*ff)?$/i.test(trimmed)) {
        return 'LIB (FF)';
      }
      return trimmed;
    }

    function getTargetRoomJumpCode(room) {
      if (!room || room === 'TBD') return '';
      const trimmed = String(room).trim();
      if (/^library(\s*ff)?$/i.test(trimmed)) {
        return 'Library FF';
      }
      return trimmed;
    }

    // Ultra-reliable room lookup: matches room by code, number, prefix, or name
    function findRoomByCodeOrName(input) {
      if (!input || !appData || !Array.isArray(appData.rooms)) return null;
      const raw = String(input).trim();
      if (!raw || raw.toUpperCase() === 'TBD') return null;
      const q = raw.toLowerCase();

      // 1. Exact match on code (case-insensitive)
      let found = appData.rooms.find(r => r.code && r.code.toLowerCase() === q);
      if (found) return found;

      // 2. Exact match on name or label
      found = appData.rooms.find(r => (r.name && r.name.toLowerCase() === q) || (r.label && r.label.toLowerCase() === q));
      if (found) return found;

      // 3. Normalized room numbers: e.g. "14", "Room 14", "R 14", "R-14" -> match "R14" or "14"
      const numMatch = q.match(/^(?:room\s*|r\s*|lecture\s*(?:classroom\s*)?)?(\d+)$/i);
      if (numMatch) {
        const num = numMatch[1];
        found = appData.rooms.find(r => r.code.toLowerCase() === `r${num}` || r.code.toLowerCase() === num);
        if (found) return found;
      }

      // 4. Tutorial rooms: "T1", "T-1", "Tutorial 1", "Tutorial Room 1"
      const tutMatch = q.match(/^(?:tut(?:orial)?(?:\s*room)?\s*|t\s*-?\s*)(\d+)$/i);
      if (tutMatch) {
        const num = tutMatch[1];
        found = appData.rooms.find(r => r.code.toLowerCase() === `t${num}`);
        if (found) return found;
      }

      // 5. PB wing: "PB1", "PB-1", "Principal Bungalow 1"
      const pbMatch = q.match(/^(?:pb\s*-?\s*|principal\s*bungalow\s*)(\d+)$/i);
      if (pbMatch) {
        const num = pbMatch[1];
        found = appData.rooms.find(r => r.code.toLowerCase() === `pb${num}`);
        if (found) return found;
      }

      // 6. Computer lab: "CL1", "CL-1", "Computer Lab 1", "Lab 1"
      const clMatch = q.match(/^(?:cl\s*-?\s*|comp(?:uter)?\s*lab\s*|lab\s*)(\d+)$/i);
      if (clMatch) {
        const num = clMatch[1];
        found = appData.rooms.find(r => r.code.toLowerCase() === `cl${num}` || (r.name && r.name.toLowerCase().includes(`computer lab ${num}`)));
        if (found) return found;
      }

      // 7. Sports Complex: "SCR1", "SCR-1"
      const scrMatch = q.match(/^(?:scr\s*-?\s*|sports\s*complex\s*)(\d+)$/i);
      if (scrMatch) {
        const num = scrMatch[1];
        found = appData.rooms.find(r => r.code.toLowerCase() === `scr${num}`);
        if (found) return found;
      }

      // 8. Partial / substring match
      found = appData.rooms.find(r => (r.code && r.code.toLowerCase().includes(q)) || (r.name && r.name.toLowerCase().includes(q)));
      if (found) return found;

      return null;
    }

    // ========================================================================
    // 🏖️ FACULTY LEAVE MANAGEMENT STORAGE & HELPERS
    // ========================================================================
    const LEAVES_STORAGE_KEY = 'srcc_faculty_leaves_v2';

    function getLeavesList() {
      const mergedMap = new Map();

      // 1. Load authoritative leaves from scraper/server (window.SRCC_FACULTY_LEAVES or leavesData)
      const activeSource = (window.SRCC_FACULTY_LEAVES && Array.isArray(window.SRCC_FACULTY_LEAVES.leaves))
        ? window.SRCC_FACULTY_LEAVES
        : leavesData;
      if (activeSource && Array.isArray(activeSource.leaves)) {
        activeSource.leaves.forEach(l => {
          const key = String(l.teacher_id || l.teacher_name || '').toLowerCase().trim();
          if (key) mergedMap.set(key, l);
        });
      }

      // 2. Merge local admin manual leaves marked in admin.html
      try {
        const stored = localStorage.getItem(LEAVES_STORAGE_KEY) || localStorage.getItem('srcc_faculty_leaves_custom_v1');
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            parsed.forEach(l => {
              const key = String(l.teacher_id || l.teacher_name || '').toLowerCase().trim();
              if (key) mergedMap.set(key, l);
            });
          }
        }
      } catch (e) {
        console.error('Error reading leaves from localStorage:', e);
      }

      return Array.from(mergedMap.values());
    }



    function saveLeavesList(list) {
      try {
        localStorage.setItem(LEAVES_STORAGE_KEY, JSON.stringify(list));
        if (window.SRCC_FACULTY_LEAVES) {
          window.SRCC_FACULTY_LEAVES.leaves = list;
        } else {
          window.SRCC_FACULTY_LEAVES = { leaves: list };
        }
      } catch (e) {
        console.error('Error saving leaves to localStorage:', e);
      }
    }

    // ========================================================================
    // 🔒 ROOM LOCKS & EXTRA CLASSES HELPERS (Includes Recurring Locks & Weekend Batches)
    // ========================================================================
    function getRoomActiveLocks(roomCode, checkDateStr) {
      const targetDate = checkDateStr || getTodayIsoDate();
      const targetRoom = (roomCode || '').trim().toUpperCase();
      const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      let targetDayName = 'Monday';
      try {
        const d = new Date(targetDate + 'T00:00:00');
        targetDayName = daysOfWeek[d.getDay()];
      } catch (e) {}

      return (roomLocksList || []).filter(lock => {
        const lockRoom = (lock.room || '').trim().toUpperCase();
        if (lockRoom !== targetRoom && lockRoom.replace(/\s+/g, '') !== targetRoom.replace(/\s+/g, '')) {
          return false;
        }

        const recurrence = lock.recurrence || 'once';
        let isActive = false;
        if (recurrence === 'once') {
          isActive = (lock.date === targetDate);
        } else if (recurrence === 'weekend') {
          isActive = (targetDayName === 'Saturday' || targetDayName === 'Sunday');
        } else if (recurrence === 'daily') {
          isActive = (targetDayName !== 'Sunday');
        } else if (recurrence === 'weekly') {
          isActive = Array.isArray(lock.recurring_days) && lock.recurring_days.includes(targetDayName);
        } else {
          isActive = (lock.date === targetDate);
        }

        // If an effective date is given, don't trigger prior to that starting date
        if (isActive && lock.date && targetDate < lock.date) {
          return false;
        }

        return isActive;
      });
    }

    // ========================================================================
    // 📢 CAMPUS NOTICE BANNER & ATTACHMENT MODAL (Freshers / Elections / Circulars)
    // Only visible when an active notice is pushed by Admin; otherwise completely hidden!
    // ========================================================================
    function renderCampusNoticeBanner() {
      const container = document.getElementById('campusNoticeBannerContainer');
      if (!container) return;

      const notices = window.SRCC_CAMPUS_NOTICES || campusNoticesList || [];
      if (!Array.isArray(notices) || notices.length === 0) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
      }

      const todayIso = getTodayIsoDate();
      const activeNotices = notices.filter(n => {
        if (!n || !n.title) return false;
        if (n.expiry_date && todayIso > n.expiry_date) return false;
        return true;
      });

      if (activeNotices.length === 0) {
        container.style.display = 'none';
        container.innerHTML = '';
        return;
      }

      const notice = activeNotices[0];
      const dismissedNoticeId = sessionStorage.getItem('srcc_dismissed_notice_id');
      if (dismissedNoticeId === notice.id) {
        container.style.display = 'none';
        return;
      }

      const categoryBadges = {
        timetable_change: '<span class="campus-notice-badge" style="background: #ea580c; color: #fff;">⚠️ Timetable Change Notice</span>',
        freshers: '<span class="campus-notice-badge badge-notice-freshers">🎉 Freshers 2026</span>',
        elections: '<span class="campus-notice-badge badge-notice-elections">🗳️ Student Elections</span>',
        circular: '<span class="campus-notice-badge badge-notice-circular">📢 Official Circular</span>',
        societies: '<span class="campus-notice-badge badge-notice-societies">🏆 Societies & Auditions</span>',
        urgent: '<span class="campus-notice-badge badge-notice-urgent">📌 Urgent Alert</span>'
      };

      const catBadge = categoryBadges[notice.category] || categoryBadges.circular;
      const hasAttachment = notice.attachment && notice.attachment.dataUrl;

      container.innerHTML = `
        <div class="campus-notice-card">
          <button type="button" class="btn-notice-dismiss" id="btnDismissCampusNotice" title="Dismiss notice for this session (Admin notices remain active)">✕</button>
          <div class="campus-notice-header">
            ${catBadge}
            ${notice.event_date ? `<span class="campus-notice-event-date">🗓️ Event Date: ${escapeHtml(notice.event_date)}</span>` : ''}
            ${notice.expiry_date ? `<span style="font-size: 0.72rem; color: #64748b; font-weight: 600;">Valid till: ${formatIsoToDdMmYyyy(notice.expiry_date)}</span>` : ''}
          </div>
          <h3 class="campus-notice-title">${escapeHtml(notice.title)}</h3>
          ${notice.body ? `<p class="campus-notice-body">${escapeHtml(notice.body)}</p>` : ''}
          <div class="campus-notice-actions">
            ${hasAttachment ? `
              <button type="button" class="btn-notice-attachment" id="btnViewNoticeAttachment">
                📎 View ${notice.attachment.type === 'pdf' ? 'Official Circular (PDF)' : 'Event Poster (Image)'} (${escapeHtml(notice.attachment.name || 'Attachment')})
              </button>
            ` : ''}
          </div>
        </div>
      `;
      container.style.display = 'block';

      const btnDismiss = document.getElementById('btnDismissCampusNotice');
      if (btnDismiss) {
        btnDismiss.addEventListener('click', () => {
          sessionStorage.setItem('srcc_dismissed_notice_id', notice.id);
          container.style.display = 'none';
        });
      }

      const btnAttachment = document.getElementById('btnViewNoticeAttachment');
      if (btnAttachment && hasAttachment) {
        btnAttachment.addEventListener('click', () => {
          openStudentAttachmentViewer(notice.title, notice.attachment);
        });
      }
    }

    function openStudentAttachmentViewer(title, attachment) {
      const modal = document.getElementById('studentAttachmentModal');
      const titleEl = document.getElementById('studentAttachmentModalTitle');
      const bodyEl = document.getElementById('studentAttachmentModalBody');

      if (!modal || !bodyEl) return;
      if (titleEl) titleEl.textContent = title || 'Campus Notice Attachment';

      function getSafeAttachmentUrl(url) {
        if (!url || typeof url !== 'string') return '';
        const trimmed = url.trim();
        if (/^data:(application\/pdf|image\/(png|jpe?g|webp|gif));base64,[A-Za-z0-9+/=\s]+$/i.test(trimmed)) {
          return trimmed;
        }
        if (/^https:\/\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=]+$/i.test(trimmed)) {
          return trimmed;
        }
        return '';
      }

      const safeUrl = getSafeAttachmentUrl(attachment.dataUrl);
      if (!safeUrl) {
        showToast('⚠️ Unable to display attachment (invalid or untrusted file URL).');
        return;
      }

      bodyEl.innerHTML = '';
      if (attachment.type === 'pdf') {
        const iframe = document.createElement('iframe');
        iframe.src = safeUrl;
        iframe.style.cssText = 'width: 100%; height: 70vh; border: none; border-radius: 6px;';

        const dlWrap = document.createElement('div');
        dlWrap.style.cssText = 'margin-top: 10px; display: flex; justify-content: flex-end;';
        const dlLink = document.createElement('a');
        dlLink.href = safeUrl;
        dlLink.download = attachment.name || 'SRCC_Notice.pdf';
        dlLink.className = 'btn-primary';
        dlLink.style.cssText = 'text-decoration: none; font-size: 0.8rem; padding: 6px 14px; background: #1e293b; color: #fff; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;';
        dlLink.textContent = '⬇️ Download PDF';
        dlWrap.appendChild(dlLink);

        bodyEl.appendChild(iframe);
        bodyEl.appendChild(dlWrap);
      } else {
        const imgWrap = document.createElement('div');
        imgWrap.style.textAlign = 'center';

        const img = document.createElement('img');
        img.src = safeUrl;
        img.alt = 'Notice Poster';
        img.style.cssText = 'max-width: 100%; max-height: 70vh; object-fit: contain; border-radius: 6px; box-shadow: 0 4px 14px rgba(0,0,0,0.1);';

        const dlWrap = document.createElement('div');
        dlWrap.style.cssText = 'margin-top: 10px; display: flex; justify-content: flex-end;';
        const dlLink = document.createElement('a');
        dlLink.href = safeUrl;
        dlLink.download = attachment.name || 'SRCC_Poster.png';
        dlLink.className = 'btn-primary';
        dlLink.style.cssText = 'text-decoration: none; font-size: 0.8rem; padding: 6px 14px; background: #1e293b; color: #fff; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;';
        dlLink.textContent = '⬇️ Download Image';
        dlWrap.appendChild(dlLink);

        imgWrap.appendChild(img);
        imgWrap.appendChild(dlWrap);
        bodyEl.appendChild(imgWrap);
      }

      modal.style.display = 'flex';
    }

    const btnCloseStudentModal = document.getElementById('btnCloseStudentAttachmentModal');
    const studentModal = document.getElementById('studentAttachmentModal');
    if (btnCloseStudentModal && studentModal) {
      btnCloseStudentModal.addEventListener('click', () => { studentModal.style.display = 'none'; });
      studentModal.addEventListener('click', (e) => {
        if (e.target === studentModal) studentModal.style.display = 'none';
      });
    }

    function isRoomLocked(roomCode, slot, checkDateStr) {
      const locks = getRoomActiveLocks(roomCode, checkDateStr);
      if (!locks || locks.length === 0) return false;
      if (locks.some(l => l.slot === 'ALL_DAY')) return true;
      if (slot && locks.some(l => l.slot === slot)) return true;
      return false;
    }

    function isTeacherOnLeave(teacher, checkDateStr) {
      if (!teacher) return null;
      const targetDate = checkDateStr || getTodayIsoDate();
      const allLeaves = getLeavesList();

      return allLeaves.find(leave => {
        const matchId = String(leave.teacher_id) === String(teacher.id);
        const matchCode = (leave.teacher_code && teacher.short_code && leave.teacher_code.toLowerCase() === teacher.short_code.toLowerCase());
        const matchName = (leave.teacher_name && teacher.clean_name && leave.teacher_name.toLowerCase().trim() === teacher.clean_name.toLowerCase().trim());

        if (matchId || matchCode || matchName) {
          if (!leave.start_date && !leave.end_date) return true;
          const s = leave.start_date || '2000-01-01';
          const e = leave.end_date || '2099-12-31';
          return (targetDate >= s && targetDate <= e);
        }
        return false;
      }) || null;
    }

    // Single unified, deduplicated active leaves helper for today or selected date
    function getActiveTodayLeaves(checkDateStr) {
      const targetDate = checkDateStr || getTodayIsoDate();
      const allLeaves = getLeavesList();
      const active = allLeaves.filter(leave => {
        if (!leave.start_date && !leave.end_date) return true;
        const s = leave.start_date || '2000-01-01';
        const e = leave.end_date || '2099-12-31';
        return (targetDate >= s && targetDate <= e);
      });

      // Deduplicate by teacher ID or clean name so each professor is represented exactly once
      const dedupMap = new Map();
      active.forEach(l => {
        const key = (l.teacher_id ? String(l.teacher_id) : '') || (l.teacher_name ? l.teacher_name.toLowerCase().trim() : '');
        if (key && !dedupMap.has(key)) {
          dedupMap.set(key, l);
        }
      });
      return Array.from(dedupMap.values());
    }

    // Reverse lookup map: given a room and a time slot on active day, find teacher and if on leave
    function getRoomScheduledTeacherLeave(roomCode, day, slot) {
      if (!teachersData || !teachersData.teachers) return null;
      const todayDate = getTodayIsoDate();

      for (const t of teachersData.teachers) {
        const daySched = t.schedule ? t.schedule[day] : null;
        if (!daySched || !Array.isArray(daySched)) continue;

        const matchingClass = daySched.find(c => {
          if (c.slot !== slot) return false;
          // Room match: e.g. "R35", "T38", etc.
          const r = (c.room || '').trim().toUpperCase();
          const target = (roomCode || '').trim().toUpperCase();
          return r === target || (r.replace(/\s+/g, '') === target.replace(/\s+/g, ''));
        });

        if (matchingClass) {
          const leave = isTeacherOnLeave(t, todayDate);
          if (leave) {
            return {
              teacher: t,
              leave: leave,
              classInfo: matchingClass
            };
          }
        }
      }
      return null;
    }

    // ========================================================================
    // ⚙️ REACTIVE STATE
    // ========================================================================
    const state = {
      activeMode: 'rooms', // 'rooms' | 'faculty'
      activeDay: initialDay,
      activeCategory: 'ALL',
      activeSlot: 'ALL',
      searchQuery: '',
      freeNowActive: false,
      sortBy: 'ROOM_ASC',
      viewMode: 'grid', // 'grid' | 'compact'
      currentLiveSlot: null
    };

    const facultyState = {
      activeDay: initialDay,
      activeDept: 'ALL',
      alphabetFilter: 'ALL', // 'ALL' | 'A' | 'B' | ... | 'Z'
      searchQuery: '',
      statusFilter: 'ALL', // 'ALL' | 'TEACHING_NOW' | 'FREE_NOW' | 'ON_LEAVE'
      sortBy: 'NAME_ASC', // 'NAME_ASC' | 'NAME_DESC' | 'CLASSES_DESC' | 'DEPT_ASC'
      viewMode: 'grid', // 'grid' | 'compact'
      modalActiveTeacher: null,
      modalActiveDay: initialDay
    };

    // ========================================================================
    // 🎯 DOM ELEMENTS - NAVIGATION & MODE SWITCHER
    // ========================================================================
    const tabModeRooms = document.getElementById('tabModeRooms');
    const tabModeFaculty = document.getElementById('tabModeFaculty');
    const tabModeTimetable = document.getElementById('tabModeTimetable');
    const viewRoomsSection = document.getElementById('viewRoomsSection');
    const viewFacultySection = document.getElementById('viewFacultySection');
    const viewTimetableSection = document.getElementById('viewTimetableSection');
    const tabModeDirectory = document.getElementById('tabModeDirectory');
    const viewDirectorySection = document.getElementById('viewDirectorySection');
    const directoryGrid = document.getElementById('directoryGrid');
    const searchDirectoryInput = document.getElementById('searchDirectoryInput');
    const bnavTimetable = document.getElementById('bnavTimetable');

    const modeFacultyCount = document.getElementById('modeFacultyCount');

    const dayButtons = document.querySelectorAll('#dayPicker .day-btn');
    const catPills = document.querySelectorAll('.cat-pill');
    const searchInput = document.getElementById('searchInput');
    const btnClearSearch = document.getElementById('btnClearSearch');
    const slotSelect = document.getElementById('slotSelect');
    const sortSelect = document.getElementById('sortSelect');
    const btnResetFilters = document.getElementById('btnResetFilters');
    const roomsGrid = document.getElementById('roomsGrid');
    const emptyState = document.getElementById('emptyState');
    const liveClockText = document.getElementById('liveClockText');

    // Header ON / OFF Toggle Switch
    const btnFreeNow = document.getElementById('btnFreeNow');
    const toggleFreeNowWrapper = document.getElementById('toggleFreeNowWrapper');
    const toggleStatusText = document.getElementById('toggleStatusText');

    // View Mode Toggle
    const btnViewGrid = document.getElementById('btnViewGrid');
    const btnViewCompact = document.getElementById('btnViewCompact');

    // Live Metrics (Rooms)
    const metricVacantNowCount = document.getElementById('metricVacantNowCount');
    const metricTotalFreeCount = document.getElementById('metricTotalFreeCount');
    const metricDayLabel = document.getElementById('metricDayLabel');
    const metricBestCat = document.getElementById('metricBestCat');

    // Stats Ribbon (Rooms)
    const statRoomCount = document.getElementById('statRoomCount');
    const statActiveDay = document.getElementById('statActiveDay');
    const statFilterDesc = document.getElementById('statFilterDesc');
    const statTotalFreeHours = document.getElementById('statTotalFreeHours');

    // Schedule Modal Elements (Room)
    const scheduleModal = document.getElementById('scheduleModal');
    const btnModalClose = document.getElementById('btnModalClose');
    const modalRoomTitle = document.getElementById('modalRoomTitle');
    const modalRoomMeta = document.getElementById('modalRoomMeta');
    const modalBody = document.getElementById('modalBody');

    // Share Room Modal Elements
    const shareModal = document.getElementById('shareModal');
    const btnShareModalClose = document.getElementById('btnShareModalClose');
    const shareModalTitle = document.getElementById('shareModalTitle');
    const sharePreviewText = document.getElementById('sharePreviewText');
    const shareBtnWhatsapp = document.getElementById('shareBtnWhatsapp');
    const shareBtnGmail = document.getElementById('shareBtnGmail');
    const shareBtnLinkedin = document.getElementById('shareBtnLinkedin');
    const shareBtnFacebook = document.getElementById('shareBtnFacebook');
    const shareBtnInstagram = document.getElementById('shareBtnInstagram');
    const shareBtnTelegram = document.getElementById('shareBtnTelegram');
    const shareBtnX = document.getElementById('shareBtnX');
    const btnCopyShareText = document.getElementById('btnCopyShareText');
    const btnPrimaryShare = document.getElementById('btnPrimaryShare');
    let currentShareMessage = '';

    // Mobile Bottom Nav Elements
    const mobileBottomNav = document.getElementById('mobileBottomNav');
    const bnavDay = document.getElementById('bnavDay');
    const bnavDayLabel = document.getElementById('bnavDayLabel');
    const bnavRooms = document.getElementById('bnavRooms');
    const bnavFaculty = document.getElementById('bnavFaculty');
    const bnavFreeNow = document.getElementById('bnavFreeNow');
    const bnavWifi = document.getElementById('bnavWifi');
    const bnavSearch = document.getElementById('bnavSearch');
    const bnavCommunity = document.getElementById('bnavCommunity');

    // Mobile Bottom Sheets
    const daySheetOverlay = document.getElementById('daySheetOverlay');
    const btnCloseDaySheet = document.getElementById('btnCloseDaySheet');
    const sheetDayButtons = document.querySelectorAll('.sheet-day-btn');

    const wingsSheetOverlay = document.getElementById('wingsSheetOverlay');
    const btnCloseWingsSheet = document.getElementById('btnCloseWingsSheet');
    const sheetWingItems = document.querySelectorAll('.sheet-wing-item');

    // Toast Container
    const toastContainer = document.getElementById('toastContainer');

    // ========================================================================
    // 👨‍🏫 DOM ELEMENTS - FACULTY LOCATOR
    // ========================================================================
    const facultyDayButtons = document.querySelectorAll('#facultyDayPicker .day-btn');
    const facultyDeptPills = document.querySelectorAll('#facultyDeptPills .dept-pill');
    const facultyDeptSelect = document.getElementById('facultyDeptSelect');
    const facultySearchInput = document.getElementById('facultySearchInput');
    const btnClearFacultySearch = document.getElementById('btnClearFacultySearch');
    const facultyStatusSelect = document.getElementById('facultyStatusSelect');
    const facultySortSelect = document.getElementById('facultySortSelect');
    const btnResetFacultyFilters = document.getElementById('btnResetFacultyFilters');
    const facultyGrid = document.getElementById('facultyGrid');
    const facultyEmptyState = document.getElementById('facultyEmptyState');

    // Faculty Metrics & Stats
    const metricTotalFacultyCount = document.getElementById('metricTotalFacultyCount');
    const metricFacultyTeachingNow = document.getElementById('metricFacultyTeachingNow');
    const metricFacultyFreeNow = document.getElementById('metricFacultyFreeNow');
    const metricFacultyOnLeave = document.getElementById('metricFacultyOnLeave');
    const statFacultyCount = document.getElementById('statFacultyCount');
    const statFacultyDay = document.getElementById('statFacultyDay');
    const statFacultyFilterDesc = document.getElementById('statFacultyFilterDesc');
    const statFacultyLastSynced = document.getElementById('statFacultyLastSynced');

    // Teacher Schedule Modal Elements
    const teacherModal = document.getElementById('teacherModal');
    const btnTeacherModalClose = document.getElementById('btnTeacherModalClose');
    const modalTeacherAvatar = document.getElementById('modalTeacherAvatar');
    const modalTeacherName = document.getElementById('modalTeacherName');
    const modalTeacherMeta = document.getElementById('modalTeacherMeta');
    const modalTeacherDayTabs = document.querySelectorAll('#modalTeacherDayTabs .day-btn, #modalTeacherDayTabs .modal-day-tab-btn');
    const modalTeacherBody = document.getElementById('modalTeacherBody');

    // Faculty Leave Manager Modal Elements
    const btnOpenLeaveManager = document.getElementById('btnOpenLeaveManager');
    const leaveManagerModal = document.getElementById('leaveManagerModal');
    const btnLeaveModalClose = document.getElementById('btnLeaveModalClose');
    const headerLeavePill = document.getElementById('headerLeavePill');
    const leaveTeacherSelect = document.getElementById('leaveTeacherSelect');
    const leaveReasonInput = document.getElementById('leaveReasonInput');
    const leaveStartDate = document.getElementById('leaveStartDate');
    const leaveEndDate = document.getElementById('leaveEndDate');
    const btnAddLeave = document.getElementById('btnAddLeave');
    const btnResetLeaves = document.getElementById('btnResetLeaves');
    const activeLeavesCount = document.getElementById('activeLeavesCount');
    const leavesListContainer = document.getElementById('leavesListContainer');

    // Faculty View Mode Toggle
    const btnFacultyViewGrid = document.getElementById('btnFacultyViewGrid');
    const btnFacultyViewCompact = document.getElementById('btnFacultyViewCompact');

    // Active Leaves Callout Banners
    const activeLeavesRoomBanner = document.getElementById('activeLeavesRoomBanner');
    const activeLeavesFacultyBanner = document.getElementById('activeLeavesFacultyBanner');

    // Leave Sync & Export Buttons
    const btnDownloadLeavesJs = document.getElementById('btnDownloadLeavesJs');
    const btnCopyLeavesJs = document.getElementById('btnCopyLeavesJs');

    // Academic Period intervals map for live detection & visual period bars
    const periodIntervals = [
      { num: 1, start: 8 * 60 + 30, end: 9 * 60 + 30, slot: '8:30 AM to 9:30 AM', label: 'P1', full: 'Period 1 (8:30–9:30 AM)' },
      { num: 2, start: 9 * 60 + 30, end: 10 * 60 + 30, slot: '9:30 AM to 10:30 AM', label: 'P2', full: 'Period 2 (9:30–10:30 AM)' },
      { num: 3, start: 10 * 60 + 30, end: 11 * 60 + 30, slot: '10:30 AM to 11:30 AM', label: 'P3', full: 'Period 3 (10:30–11:30 AM)' },
      { num: 4, start: 11 * 60 + 30, end: 12 * 60 + 30, slot: '11:30 AM to 12:30 PM', label: 'P4', full: 'Period 4 (11:30 AM–12:30 PM)' },
      { num: 5, start: 12 * 60 + 30, end: 13 * 60 + 30, slot: '12:30 PM to 1:30 PM', label: 'P5', full: 'Period 5 (12:30–1:30 PM)' },
      { num: 6, start: 14 * 60 + 0, end: 15 * 60 + 0, slot: '2:00 PM to 3:00 PM', label: 'P6', full: 'Period 6 (2:00–3:00 PM)' },
      { num: 7, start: 15 * 60 + 0, end: 16 * 60 + 0, slot: '3:00 PM to 4:00 PM', label: 'P7', full: 'Period 7 (3:00–4:00 PM)' },
      { num: 8, start: 16 * 60 + 0, end: 17 * 60 + 0, slot: '4:00 PM to 5:00 PM', label: 'P8', full: 'Period 8 (4:00–5:00 PM)' },
      { num: 9, start: 17 * 60 + 0, end: 18 * 60 + 0, slot: '5:00 PM to 6:00 PM', label: 'P9', full: 'Period 9 (5:00–6:00 PM)' }
    ];

    // ========================================================================
    // ⚡ CONSECUTIVE FREE WINDOWS ALGORITHM
    // ========================================================================
    function getConsecutiveFreeWindows(freeSlots, bonusSlots = []) {
      if (!freeSlots && !bonusSlots) return [];
      const bonusSlotNames = (bonusSlots || []).map(b => (typeof b === 'string' ? b : b.slot));
      const allFreeSlots = new Set([...(freeSlots || []), ...bonusSlotNames]);
      const freePeriodNums = periodIntervals.filter(p => allFreeSlots.has(p.slot)).map(p => p.num);
      if (freePeriodNums.length === 0) return [];

      if (freePeriodNums.length === 9) {
        return [{
          start: '8:30 AM',
          end: '6:00 PM',
          durationHours: 9.5,
          periodsCount: 9,
          text: '8:30 AM – 6:00 PM (Full Day Continuous)',
          slots: periodIntervals.map(p => p.slot)
        }];
      }

      const windows = [];
      let currentGroup = [freePeriodNums[0]];

      for (let i = 1; i < freePeriodNums.length; i++) {
        const prev = freePeriodNums[i - 1];
        const curr = freePeriodNums[i];

        // Consecutive periods (1-2, 2-3, 3-4, 4-5, 5-6 [crossing lunch], 6-7, 7-8, 8-9)
        if (curr === prev + 1) {
          currentGroup.push(curr);
        } else {
          windows.push([...currentGroup]);
          currentGroup = [curr];
        }
      }
      if (currentGroup.length > 0) {
        windows.push(currentGroup);
      }

      return windows.map(group => {
        const startP = periodIntervals.find(p => p.num === group[0]);
        const endP = periodIntervals.find(p => p.num === group[group.length - 1]);
        const duration = (endP.end - startP.start) / 60;
        const durationStr = (duration % 1 === 0) ? `${duration} hrs` : `${duration} hrs`;
        const startStr = startP.slot.split(' to ')[0];
        const endStr = endP.slot.split(' to ')[1];
        const coveredSlots = periodIntervals.filter(p => group.includes(p.num)).map(p => p.slot);

        return {
          start: startStr,
          end: endStr,
          durationHours: duration,
          periodsCount: group.length,
          text: `${startStr} – ${endStr} (${durationStr} continuous)`,
          slots: coveredSlots
        };
      });
    }

    // ========================================================================
    // ⏱️ "FREE UNTIL" COUNTDOWN CALCULATOR
    // Answers student question: "Har free room kab tak khali hai (Free until 12:30)?"
    // ========================================================================
    function getRoomFreeUntilStatus(room, targetDay) {
      if (!room || !room.schedule) return null;
      const sched = room.schedule[targetDay] || { free_slots: [], occupied_slots: [] };
      const todayIso = getTodayIsoDate();
      const activeRoomLocks = getRoomActiveLocks(room.code, todayIso);
      const isFullDayLocked = activeRoomLocks.some(l => l.slot === 'ALL_DAY');
      if (isFullDayLocked) {
        return {
          isFreeNow: false,
          badgeText: '🔒 Room Locked All Day',
          calloutText: '🔒 Room is fully locked today (Maintenance / Reserved).'
        };
      }

      const lockedSlotsSet = new Set(activeRoomLocks.filter(l => l.slot !== 'ALL_DAY').map(l => l.slot));

      // Calculate bonus free slots (classes where faculty is on leave)
      const bonusSlots = [];
      sched.occupied_slots.forEach(o => {
        const leave = getRoomScheduledTeacherLeave(room.code, targetDay, o.slot);
        if (leave) bonusSlots.push(o.slot);
      });

      const effectiveFreeSlots = new Set([
        ...(sched.free_slots || []).filter(s => !lockedSlotsSet.has(s)),
        ...bonusSlots.filter(s => !lockedSlotsSet.has(s))
      ]);

      const istNow = getIstDate();
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const todayName = days[istNow.getDay()];
      const isToday = (targetDay === todayName);
      const currentMinutes = istNow.getHours() * 60 + istNow.getMinutes();

      if (isToday) {
        const isLunchRecess = currentMinutes >= 13 * 60 + 30 && currentMinutes < 14 * 60 + 0;

        let isFreeNow = false;
        if (isLunchRecess) {
          isFreeNow = true;
        } else {
          const livePeriod = periodIntervals.find(p => currentMinutes >= p.start && currentMinutes < p.end);
          if (livePeriod && effectiveFreeSlots.has(livePeriod.slot)) {
            isFreeNow = true;
          } else if (currentMinutes < 8 * 60 + 30) {
            isFreeNow = effectiveFreeSlots.has(periodIntervals[0].slot);
          }
        }

        if (currentMinutes >= 18 * 60) {
          return {
            isFreeNow: false,
            badgeText: '🌙 College Closed',
            calloutText: 'Classes completed for today (Closed at 6:00 PM).'
          };
        }

        if (isFreeNow) {
          // Find next occupied lecture starting after currentMinutes
          const futureOccupied = sched.occupied_slots.filter(o => {
            const leave = getRoomScheduledTeacherLeave(room.code, targetDay, o.slot);
            if (leave) return false;
            const p = periodIntervals.find(pi => pi.slot === o.slot);
            return p && p.start >= currentMinutes;
          }).sort((a, b) => {
            const pa = periodIntervals.find(p => p.slot === a.slot);
            const pb = periodIntervals.find(p => p.slot === b.slot);
            return (pa ? pa.start : 0) - (pb ? pb.start : 0);
          });

          // Also check future locks
          const futureLocks = activeRoomLocks.filter(l => {
            const p = periodIntervals.find(pi => pi.slot === l.slot);
            return p && p.start >= currentMinutes;
          }).sort((a, b) => {
            const pa = periodIntervals.find(p => p.slot === a.slot);
            const pb = periodIntervals.find(p => p.slot === b.slot);
            return (pa ? pa.start : 0) - (pb ? pb.start : 0);
          });

          const nextStart = futureOccupied[0]
            ? periodIntervals.find(p => p.slot === futureOccupied[0].slot)?.start
            : (futureLocks[0] ? periodIntervals.find(p => p.slot === futureLocks[0].slot)?.start : null);

          if (nextStart) {
            const h = Math.floor(nextStart / 60);
            const m = nextStart % 60;
            const ampm = h >= 12 ? 'PM' : 'AM';
            const displayH = h > 12 ? h - 12 : (h === 0 ? 12 : h);
            const timeStr = `${displayH}:${String(m).padStart(2, '0')} ${ampm}`;
            const diffM = Math.max(0, nextStart - currentMinutes);
            const countdownStr = diffM >= 60 ? `${Math.floor(diffM / 60)}h ${diffM % 60}m left` : `${diffM}m left`;

            return {
              isFreeNow: true,
              badgeText: `Free until ${timeStr}`,
              calloutText: `🟢 Free until ${timeStr} (${countdownStr})`
            };
          } else {
            return {
              isFreeNow: true,
              badgeText: 'Free until 6:00 PM',
              calloutText: '🟢 Free until 6:00 PM (No more classes today)'
            };
          }
        } else {
          // Room is currently occupied
          const nextFreePeriod = periodIntervals.find(p => p.start >= currentMinutes && effectiveFreeSlots.has(p.slot));
          if (nextFreePeriod) {
            const h = Math.floor(nextFreePeriod.start / 60);
            const m = nextFreePeriod.start % 60;
            const ampm = h >= 12 ? 'PM' : 'AM';
            const displayH = h > 12 ? h - 12 : (h === 0 ? 12 : h);
            const timeStr = `${displayH}:${String(m).padStart(2, '0')} ${ampm}`;
            return {
              isFreeNow: false,
              badgeText: `Free at ${timeStr}`,
              calloutText: `🔴 Class in session · Free at ${timeStr}`
            };
          } else {
            return {
              isFreeNow: false,
              badgeText: 'Occupied today',
              calloutText: '🔴 Class in session · Booked for remaining periods'
            };
          }
        }
      } else {
        // Browsing another day
        if (state.activeSlot !== 'ALL') {
          const isSlotFree = effectiveFreeSlots.has(state.activeSlot);
          if (isSlotFree) {
            const curP = periodIntervals.find(p => p.slot === state.activeSlot);
            const futureOcc = sched.occupied_slots.filter(o => {
              const leave = getRoomScheduledTeacherLeave(room.code, targetDay, o.slot);
              if (leave) return false;
              const p = periodIntervals.find(pi => pi.slot === o.slot);
              return p && curP && p.start >= curP.end;
            });
            if (futureOcc[0]) {
              const p = periodIntervals.find(pi => pi.slot === futureOcc[0].slot);
              const timeStr = p ? (p.start >= 12 * 60 ? `${p.start > 12 * 60 ? Math.floor(p.start / 60) - 12 : 12}:${String(p.start % 60).padStart(2, '0')} PM` : `${Math.floor(p.start / 60)}:${String(p.start % 60).padStart(2, '0')} AM`) : 'Later';
              return {
                isFreeNow: true,
                badgeText: `Free until ${timeStr}`,
                calloutText: `🟢 Free in selected slot (until ${timeStr})`
              };
            } else {
              return {
                isFreeNow: true,
                badgeText: 'Free until 6:00 PM',
                calloutText: `🟢 Free in this slot and remainder of day`
              };
            }
          } else {
            return {
              isFreeNow: false,
              badgeText: 'Occupied in this slot',
              calloutText: `🔴 Class scheduled in ${state.activeSlot}`
            };
          }
        }

        if (effectiveFreeSlots.size === 9) {
          return {
            isFreeNow: true,
            badgeText: 'Free all day',
            calloutText: `🟢 Entire day free on ${targetDay} (8:30 AM – 6:00 PM)`
          };
        } else if (effectiveFreeSlots.size > 0) {
          return {
            isFreeNow: true,
            badgeText: `${effectiveFreeSlots.size}/9 Hours Free`,
            calloutText: `🟢 ${effectiveFreeSlots.size} academic hours available on ${targetDay}`
          };
        } else {
          return {
            isFreeNow: false,
            badgeText: 'Fully Booked',
            calloutText: `🔴 Fully booked on ${targetDay}`
          };
        }
      }
    }

    // ========================================================================
    // 🔔 TOAST HELPER
    // ========================================================================
    function showToast(message, isCopied = false, duration = 3600) {
      if (!toastContainer) return;
      const toast = document.createElement('div');
      toast.className = `toast-item ${isCopied ? 'copied' : ''}`;
      toast.innerHTML = message;
      toastContainer.appendChild(toast);
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        toast.style.transition = 'all 0.25s ease';
        setTimeout(() => toast.remove(), 250);
      }, duration);
    }

    // ========================================================================
    // 🕒 LIVE CLOCK UPDATE (STANDARDIZED ON ASIA/KOLKATA IST)
    // ========================================================================
    function updateLiveClock() {
      const now = getIstDate();
      const options = { weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true };
      const timeStr = now.toLocaleTimeString('en-US', options) + ' IST';
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      // Check lunch recess specifically (1:30 PM - 2:00 PM)
      const isLunchRecess = currentMinutes >= 13 * 60 + 30 && currentMinutes < 14 * 60 + 0;
      const recessBanner = document.getElementById('recessBanner');
      if (recessBanner) {
        recessBanner.style.display = isLunchRecess ? 'flex' : 'none';
      }

      if (isLunchRecess) {
        state.currentLiveSlot = '1:30 PM to 2:00 PM';
        if (liveClockText) liveClockText.textContent = `${timeStr} · Lunch Recess (All 96 Rooms Free)`;
      } else {
        const matched = periodIntervals.find(p => currentMinutes >= p.start && currentMinutes < p.end);
        if (matched) {
          state.currentLiveSlot = matched.slot;
          if (liveClockText) liveClockText.textContent = `${timeStr} · ${matched.full}`;
        } else {
          state.currentLiveSlot = null;
          if (liveClockText) liveClockText.textContent = `${timeStr} · College Off-Hours`;
        }

        if (typeof window.renderMyBatchDailyWidget === 'function') {
          window.renderMyBatchDailyWidget();
        }
      }
    }

    updateLiveClock();
    setInterval(updateLiveClock, 30000);

    // ========================================================================
    // 📅 DAILY VERIFIED TIMETABLE METADATA & LIVE CREDIBILITY
    // ========================================================================
    const todayDateFormatted = istNow.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    const elHeaderSync = document.getElementById('lastUpdatedHeader');
    const elRibbonSync = document.getElementById('statLastSynced');
    const elFooterSync = document.getElementById('footerLastSynced');

    if (elHeaderSync) elHeaderSync.textContent = `Today, ${todayDateFormatted}`;
    if (elRibbonSync) elRibbonSync.textContent = `Today, ${todayDateFormatted} • Daily Verified`;
    if (elFooterSync) elFooterSync.textContent = `Today, ${todayDateFormatted} • Official SRCC Timetable Verified`;
    if (statFacultyLastSynced) statFacultyLastSynced.textContent = `Today, ${todayDateFormatted}`;

    if (modeFacultyCount && teachersData && teachersData.teachers) {
      modeFacultyCount.textContent = `${teachersData.teachers.length} Teachers`;
    }

    // ========================================================================
    // 🏖️ OPEN FACULTY LEAVES VIEW (Native integration inside Faculty Locator)
    // ========================================================================
    function openFacultyLeavesView() {
      setAppMode('faculty', true);
      facultyState.activeDept = 'ALL';
      facultyState.statusFilter = 'ON_LEAVE';
      facultyState.alphabetFilter = 'ALL';
      document.querySelectorAll('#facultyAzFilter .az-btn').forEach(b => b.classList.toggle('active', b.dataset.letter === 'ALL'));
      facultyDeptPills.forEach(p => p.classList.toggle('active', p.dataset.dept === 'ALL'));
      if (facultyDeptSelect) facultyDeptSelect.value = 'ALL';
      if (facultyStatusSelect) facultyStatusSelect.value = 'ON_LEAVE';
      facultyState.searchQuery = '';
      if (facultySearchInput) facultySearchInput.value = '';
      if (btnClearFacultySearch) btnClearFacultySearch.style.display = 'none';
      if (statFacultyFilterDesc) statFacultyFilterDesc.innerHTML = '';
      renderFaculty();
      setTimeout(() => {
        if (facultyGrid) {
          facultyGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);

      const todayDate = getTodayIsoDate();
      const activeToday = getActiveTodayLeaves(todayDate);
      const onLeaveCount = activeToday.length;
      showToast(`🏖️ Showing <strong>${onLeaveCount} ${onLeaveCount === 1 ? 'professor' : 'professors'}</strong> currently on leave today.`);
    }

    // ========================================================================
    // 🔀 MULTI-MODE SWITCHING (ROOMS ⇄ FACULTY ⇄ TIMETABLE)
    // ========================================================================
    function setAppMode(mode, preserveFilters = false) {
      if (mode === 'leaves') {
        openFacultyLeavesView();
        return;
      }
      state.activeMode = mode;
      const isRooms = (mode === 'rooms');
      const isFaculty = (mode === 'faculty');
      const isTimetable = (mode === 'timetable');
      const isDirectory = (mode === 'directory');
      const isWifi = (mode === 'wifi');

      const tabModeWifi = document.getElementById('tabModeWifi');
      const viewWifiSection = document.getElementById('viewWifiSection');

      if (tabModeRooms) {
        tabModeRooms.classList.toggle('active', isRooms);
        tabModeRooms.setAttribute('aria-selected', isRooms ? 'true' : 'false');
      }
      if (tabModeFaculty) {
        tabModeFaculty.classList.toggle('active', isFaculty);
        tabModeFaculty.setAttribute('aria-selected', isFaculty ? 'true' : 'false');
      }
      if (tabModeTimetable) {
        tabModeTimetable.classList.toggle('active', isTimetable);
        tabModeTimetable.setAttribute('aria-selected', isTimetable ? 'true' : 'false');
      }
      if (tabModeDirectory) {
        tabModeDirectory.classList.toggle('active', isDirectory);
        tabModeDirectory.setAttribute('aria-selected', isDirectory ? 'true' : 'false');
      }
      if (tabModeWifi) {
        tabModeWifi.classList.toggle('active', isWifi);
        tabModeWifi.setAttribute('aria-selected', isWifi ? 'true' : 'false');
      }

      if (viewRoomsSection) viewRoomsSection.style.display = isRooms ? 'block' : 'none';
      if (viewFacultySection) viewFacultySection.style.display = isFaculty ? 'block' : 'none';
      if (viewTimetableSection) {
        viewTimetableSection.style.display = isTimetable ? 'block' : 'none';
        if (isTimetable) {
          if (typeof window._setTimetableToToday === 'function') {
            window._setTimetableToToday();
          } else if (typeof window._renderMainTimetable === 'function') {
            window._renderMainTimetable();
          }
        }
      }
      if (viewDirectorySection) {
        viewDirectorySection.style.display = isDirectory ? 'block' : 'none';
        if (isDirectory && !window._directoryRendered) {
          renderDirectory();
          window._directoryRendered = true;
        }
      }
      if (viewWifiSection) {
        viewWifiSection.style.display = isWifi ? 'block' : 'none';
        if (isWifi && typeof window._renderWifiDirectory === 'function') {
          window._renderWifiDirectory('wifiViewGrid');
        }
      }

      // Update mobile bottom nav
      if (bnavRooms) bnavRooms.classList.toggle('active', isRooms);
      if (bnavFaculty) bnavFaculty.classList.toggle('active', isFaculty);
      if (bnavTimetable) bnavTimetable.classList.toggle('active', isTimetable);
      if (bnavWifi) bnavWifi.classList.toggle('active', isWifi);

      // Clean filter reset when switching tabs so users never get stuck with leftover filters
      if (!preserveFilters) {
        // 1. Reset Room Finder filters
        state.activeCategory = 'ALL';
        state.activeSlot = 'ALL';
        state.searchQuery = '';
        state.freeNowActive = false;
        if (btnFreeNow) {
          btnFreeNow.classList.remove('active');
          btnFreeNow.setAttribute('aria-checked', 'false');
        }
        if (toggleFreeNowWrapper) {
          toggleFreeNowWrapper.classList.remove('is-on');
        }
        if (toggleStatusText) {
          toggleStatusText.textContent = 'OFF';
          toggleStatusText.style.color = '';
        }
        if (bnavFreeNow) {
          bnavFreeNow.classList.remove('active');
        }
        catPills.forEach(p => p.classList.toggle('active', p.dataset.cat === 'ALL'));
        sheetWingItems.forEach(w => w.classList.toggle('active', w.dataset.cat === 'ALL'));
        if (searchInput) searchInput.value = '';
        if (btnClearSearch) btnClearSearch.style.display = 'none';
        if (slotSelect) slotSelect.value = 'ALL';
        if (sortSelect) sortSelect.value = 'ROOM_ASC';

        // 2. Reset Faculty Locator filters completely
        facultyState.activeDept = 'ALL';
        facultyState.statusFilter = 'ALL';
        facultyState.searchQuery = '';
        facultyState.sortBy = 'NAME_ASC';
        facultyDeptPills.forEach(p => p.classList.toggle('active', p.dataset.dept === 'ALL'));
        if (facultyDeptSelect) facultyDeptSelect.value = 'ALL';
        if (facultySearchInput) facultySearchInput.value = '';
        if (btnClearFacultySearch) btnClearFacultySearch.style.display = 'none';
        if (facultyStatusSelect) facultyStatusSelect.value = 'ALL';
        if (facultySortSelect) facultySortSelect.value = 'NAME_ASC';
        if (statFacultyFilterDesc) statFacultyFilterDesc.innerHTML = '';
      }

      if (isRooms) {
        render();
      } else if (isFaculty) {
        renderFaculty();
      } else if (isTimetable && typeof window._renderMainTimetable === 'function') {
        window._renderMainTimetable();
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (tabModeRooms) tabModeRooms.addEventListener('click', () => setAppMode('rooms'));
    if (tabModeFaculty) tabModeFaculty.addEventListener('click', () => setAppMode('faculty'));
    if (tabModeTimetable) tabModeTimetable.addEventListener('click', () => setAppMode('timetable'));
    const tabModeWifiBtn = document.getElementById('tabModeWifi');
    if (tabModeWifiBtn) tabModeWifiBtn.addEventListener('click', () => setAppMode('wifi'));
    if (bnavRooms) bnavRooms.addEventListener('click', () => setAppMode('rooms'));
    if (bnavFaculty) bnavFaculty.addEventListener('click', () => setAppMode('faculty'));
    if (bnavTimetable) bnavTimetable.addEventListener('click', () => setAppMode('timetable'));
    if (bnavWifi) {
      bnavWifi.addEventListener('click', () => {
        const btnOpenHeader = document.getElementById('btnOpenWifiModal');
        if (btnOpenHeader) {
          btnOpenHeader.click();
        } else {
          const wifiModal = document.getElementById('wifiModal');
          if (wifiModal) {
            wifiModal.style.display = 'flex';
            if (typeof window._renderWifiDirectory === 'function') window._renderWifiDirectory('wifiModalGrid');
          }
        }
      });
    }
    const btnHeaderTimetable = document.getElementById('btnHeaderTimetable');
    if (btnHeaderTimetable) btnHeaderTimetable.addEventListener('click', () => setAppMode('timetable'));

    // ========================================================================
    // 🏛️ ROOM FINDER HELPERS & LISTENERS
    // ========================================================================
    function setActiveDay(day) {
      state.activeDay = day;
      facultyState.activeDay = day;

      dayButtons.forEach(b => b.classList.toggle('active', b.dataset.day === day));
      facultyDayButtons.forEach(b => b.classList.toggle('active', b.dataset.day === day));
      sheetDayButtons.forEach(b => b.classList.toggle('active', b.dataset.day === day));

      if (bnavDayLabel) bnavDayLabel.textContent = day.slice(0, 3);
      if (state.activeMode === 'rooms') render();
      else if (state.activeMode === 'faculty') renderFaculty();
      else if (state.activeMode === 'timetable' && typeof window._renderMainTimetable === 'function') window._renderMainTimetable();
    }

    function setActiveCategory(cat) {
      state.activeCategory = cat;
      catPills.forEach(p => p.classList.toggle('active', p.dataset.cat === cat));
      sheetWingItems.forEach(w => w.classList.toggle('active', w.dataset.cat === cat));
      if (state.searchQuery) {
        state.searchQuery = '';
        if (searchInput) searchInput.value = '';
        if (btnClearSearch) btnClearSearch.style.display = 'none';
      }
      render();
    }

    dayButtons.forEach(btn => {
      if (btn.dataset.day === state.activeDay) btn.classList.add('active');
      btn.addEventListener('click', () => setActiveDay(btn.dataset.day));
    });

    facultyDayButtons.forEach(btn => {
      if (btn.dataset.day === facultyState.activeDay) btn.classList.add('active');
      btn.addEventListener('click', () => setActiveDay(btn.dataset.day));
    });

    // Community Link Handlers

    document.querySelectorAll('.btn-community-header, .whatsapp-card').forEach(card => {
      card.href = SRCC_WHATSAPP_LINK;
      card.addEventListener('click', (e) => {
        e.preventDefault();
        window.open(SRCC_WHATSAPP_LINK, '_blank', 'noopener,noreferrer');
      });
    });

    document.querySelectorAll('.btn-dev-header, .linkedin-card').forEach(card => {
      card.addEventListener('click', (e) => {
        e.preventDefault();
        window.open('https://www.linkedin.com/in/anandkumar563/', '_blank', 'noopener,noreferrer');
      });
    });

    catPills.forEach(pill => {
      pill.addEventListener('click', () => setActiveCategory(pill.dataset.cat));
    });

    // Search Input UI
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        state.searchQuery = e.target.value.trim();
        btnClearSearch.style.display = state.searchQuery ? 'block' : 'none';
        render();
      });
    }

    if (btnClearSearch && searchInput) {
      btnClearSearch.addEventListener('click', () => {
        searchInput.value = '';
        state.searchQuery = '';
        btnClearSearch.style.display = 'none';
        searchInput.focus();
        render();
      });
    }

    if (slotSelect) {
      slotSelect.addEventListener('change', (e) => {
        state.activeSlot = e.target.value;
        if (state.freeNowActive && state.activeSlot !== state.currentLiveSlot) {
          setFreeNowState(false);
        }
        render();
      });
    }

    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        state.sortBy = e.target.value;
        render();
      });
    }

    function setFreeNowState(isActive) {
      state.freeNowActive = isActive;
      if (btnFreeNow) {
        btnFreeNow.classList.toggle('active', isActive);
        btnFreeNow.setAttribute('aria-checked', isActive ? 'true' : 'false');
      }
      if (toggleFreeNowWrapper) {
        toggleFreeNowWrapper.classList.toggle('is-on', isActive);
      }
      if (toggleStatusText) toggleStatusText.textContent = isActive ? 'ON' : 'OFF';
      if (bnavFreeNow) bnavFreeNow.classList.toggle('active', isActive);

      if (isActive) {
        // Automatically switch day to Today (Monday to Saturday)
        const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const todayName = daysOfWeek[getIstDate().getDay()];
        if (todayName !== 'Sunday' && state.activeDay !== todayName) {
          setActiveDay(todayName);
        }

        if (state.currentLiveSlot === '1:30 PM to 2:00 PM') {
          state.activeSlot = '1:30 PM to 2:00 PM';
          showToast('🥪 <strong>Lunch Recess Active (1:30–2:00 PM)!</strong> All 96 classrooms are 100% vacant and free right now.');
        } else if (state.currentLiveSlot) {
          state.activeSlot = state.currentLiveSlot;
          if (slotSelect) slotSelect.value = state.currentLiveSlot;
          showToast(`⚡ Showing classrooms vacant right now (${escapeHtml(state.currentLiveSlot)})!`);
        } else {
          state.activeSlot = '8:30 AM to 9:30 AM';
          if (slotSelect) slotSelect.value = '8:30 AM to 9:30 AM';
          showToast('🌙 <strong>College Off-Hours right now.</strong> Showing classrooms free for Period 1 (8:30–9:30 AM).');
        }
        setTimeout(() => {
          if (roomsGrid) {
            const rect = roomsGrid.getBoundingClientRect();
            window.scrollBy({ top: rect.top - 80, behavior: 'smooth' });
          }
        }, 120);
      } else {
        state.activeSlot = 'ALL';
        if (slotSelect) slotSelect.value = 'ALL';
      }
      render();
    }

    function toggleFreeNow() {
      if (state.activeMode !== 'rooms') {
        setAppMode('rooms', true);
        setFreeNowState(true);
        return;
      }
      setFreeNowState(!state.freeNowActive);
    }

    if (toggleFreeNowWrapper) {
      toggleFreeNowWrapper.addEventListener('click', () => {
        toggleFreeNow();
      });
    }
    if (btnFreeNow) {
      btnFreeNow.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFreeNow();
      });
    }
    if (bnavFreeNow) {
      bnavFreeNow.addEventListener('click', () => {
        if (state.activeMode !== 'rooms') {
          setAppMode('rooms', true);
          setFreeNowState(true);
        } else {
          toggleFreeNow();
        }
      });
    }

    // Support clicking the "Free Now" faculty metric tile to jump to free classrooms
    const metricFacultyFreeTile = document.getElementById('metricFacultyFreeNow')?.closest('.metric-tile');
    if (metricFacultyFreeTile) {
      metricFacultyFreeTile.style.cursor = 'pointer';
      metricFacultyFreeTile.title = 'Click to view classrooms free right now';
      metricFacultyFreeTile.addEventListener('click', () => {
        setAppMode('rooms', true);
        setFreeNowState(true);
      });
    }



    // View Mode Toggle (Rooms - Grid vs Compact)
    if (btnViewGrid && btnViewCompact) {
      btnViewGrid.addEventListener('click', () => {
        state.viewMode = 'grid';
        btnViewGrid.classList.add('active');
        btnViewCompact.classList.remove('active');
        roomsGrid.classList.remove('view-mode-compact');
        roomsGrid.classList.add('view-mode-grid');
      });

      btnViewCompact.addEventListener('click', () => {
        state.viewMode = 'compact';
        btnViewCompact.classList.add('active');
        btnViewGrid.classList.remove('active');
        roomsGrid.classList.remove('view-mode-grid');
        roomsGrid.classList.add('view-mode-compact');
      });
    }

    // Faculty View Mode Toggle (Grid vs Compact)
    if (btnFacultyViewGrid && btnFacultyViewCompact) {
      btnFacultyViewGrid.addEventListener('click', () => {
        facultyState.viewMode = 'grid';
        btnFacultyViewGrid.classList.add('active');
        btnFacultyViewCompact.classList.remove('active');
        if (facultyGrid) {
          facultyGrid.classList.remove('view-mode-compact');
          facultyGrid.classList.add('view-mode-grid');
        }
        renderFaculty();
      });

      btnFacultyViewCompact.addEventListener('click', () => {
        facultyState.viewMode = 'compact';
        btnFacultyViewCompact.classList.add('active');
        btnFacultyViewGrid.classList.remove('active');
        if (facultyGrid) {
          facultyGrid.classList.remove('view-mode-grid');
          facultyGrid.classList.add('view-mode-compact');
        }
        renderFaculty();
      });
    }

    // Reset Filters (Rooms)
    if (btnResetFilters) {
      btnResetFilters.addEventListener('click', () => {
        state.activeCategory = 'ALL';
        state.activeSlot = 'ALL';
        state.searchQuery = '';
        setFreeNowState(false);
        state.sortBy = 'ROOM_ASC';

        catPills.forEach(p => p.classList.toggle('active', p.dataset.cat === 'ALL'));
        sheetWingItems.forEach(w => w.classList.toggle('active', w.dataset.cat === 'ALL'));
        if (searchInput) searchInput.value = '';
        if (btnClearSearch) btnClearSearch.style.display = 'none';
        if (slotSelect) slotSelect.value = 'ALL';
        if (sortSelect) sortSelect.value = 'ROOM_ASC';

        render();
      });
    }

    // Modal Helpers with Mobile Scroll Lock (body.modal-open)
    function openAppModal(modalEl) {
      if (!modalEl) return;
      modalEl.style.display = 'flex';
      document.body.classList.add('modal-open');
    }

    function closeAppModal(modalEl) {
      if (!modalEl) return;
      modalEl.style.display = 'none';
      const anyOpen = [scheduleModal, shareModal, teacherModal, leaveManagerModal, reportIssueModal].some(m => m && m.style.display === 'flex');
      if (!anyOpen) {
        document.body.classList.remove('modal-open');
      }
    }

    // Modal Close Handlers
    if (btnModalClose) btnModalClose.addEventListener('click', () => { closeAppModal(scheduleModal); });
    if (scheduleModal) {
      scheduleModal.addEventListener('click', (e) => {
        if (e.target === scheduleModal) closeAppModal(scheduleModal);
      });
    }

    if (btnShareModalClose) btnShareModalClose.addEventListener('click', () => { closeAppModal(shareModal); });
    if (shareModal) {
      shareModal.addEventListener('click', (e) => {
        if (e.target === shareModal) closeAppModal(shareModal);
      });
    }

    if (btnTeacherModalClose) btnTeacherModalClose.addEventListener('click', () => { closeAppModal(teacherModal); });
    if (teacherModal) {
      teacherModal.addEventListener('click', (e) => {
        if (e.target === teacherModal) closeAppModal(teacherModal);
      });
    }

    if (btnLeaveModalClose) btnLeaveModalClose.addEventListener('click', () => { closeAppModal(leaveManagerModal); });
    if (leaveManagerModal) {
      leaveManagerModal.addEventListener('click', (e) => {
        if (e.target === leaveManagerModal) closeAppModal(leaveManagerModal);
      });
    }

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (scheduleModal && scheduleModal.style.display !== 'none') closeAppModal(scheduleModal);
        else if (shareModal && shareModal.style.display !== 'none') closeAppModal(shareModal);
        else if (teacherModal && teacherModal.style.display !== 'none') closeAppModal(teacherModal);
        else if (leaveManagerModal && leaveManagerModal.style.display !== 'none') closeAppModal(leaveManagerModal);
        else if (reportIssueModal && reportIssueModal.style.display !== 'none') closeAppModal(reportIssueModal);
        else if (installModal && installModal.style.display !== 'none') closeModal();
        else if (daySheetOverlay && daySheetOverlay.style.display !== 'none') daySheetOverlay.style.display = 'none';
        else if (wingsSheetOverlay && wingsSheetOverlay.style.display !== 'none') wingsSheetOverlay.style.display = 'none';
        else if (document.activeElement === searchInput) searchInput.blur();
        else if (document.activeElement === facultySearchInput) facultySearchInput.blur();
      } else if (e.key === '/' && document.activeElement !== searchInput && document.activeElement !== facultySearchInput) {
        e.preventDefault();
        if (state.activeMode === 'rooms' && searchInput) {
          searchInput.focus();
          window.scrollTo({ top: searchInput.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
        } else if (facultySearchInput) {
          facultySearchInput.focus();
          window.scrollTo({ top: facultySearchInput.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
        }
      }
    });

    // Helper: Map category code
    function matchesCategory(room, catCode) {
      if (catCode === 'ALL') return true;
      if (catCode === 'PB') return room.code.startsWith('PB');
      if (catCode === 'T') return room.code.startsWith('T') && !room.code.startsWith('PB');
      if (catCode === 'SCR') return room.code.startsWith('SCR');
      if (catCode === 'R') return /^R\d+$/i.test(room.code);
      if (catCode === 'CL') return room.code.startsWith('CL');
      if (catCode === 'OTHER') {
        return !room.code.startsWith('PB') && !room.code.startsWith('T') &&
               !room.code.startsWith('SCR') && !/^R\d+$/i.test(room.code) &&
               !room.code.startsWith('CL');
      }
      return true;
    }

    function getCategoryThemeClass(room) {
      if (room.code.startsWith('PB')) return 'card-theme-pb';
      if (room.code.startsWith('T') && !room.code.startsWith('PB')) return 'card-theme-t';
      if (room.code.startsWith('SCR')) return 'card-theme-scr';
      if (/^R\d+$/i.test(room.code)) return 'card-theme-r';
      if (room.code.startsWith('CL')) return 'card-theme-cl';
      return 'card-theme-other';
    }

    function getCategoryBadgeClass(category) {
      if (category.includes('PB') || category.includes('Principal Bungalow')) return 'badge-cat-pb';
      if (category.includes('Tutorial')) return 'badge-cat-tut';
      if (category.includes('Sports Complex')) return 'badge-cat-scr';
      if (category.includes('Classroom')) return 'badge-cat-r';
      if (category.includes('Computer Lab')) return 'badge-cat-cl';
      return 'badge-cat-other';
    }

    function getRoomSortOrder(code) {
      const numMatch = code.match(/\d+/);
      const num = numMatch ? parseInt(numMatch[0]) : 0;
      if (/^R\d+$/i.test(code)) return 10000 + num;
      if (/^PB\d*$/i.test(code)) return 20000 + num;
      if (/^T\d+$/i.test(code)) return 30000 + num;
      if (/^SCR\d*$/i.test(code)) return 40000 + num;
      if (/^CL/i.test(code)) return 50000 + (num || 99);
      if (code === 'Library FF') return 60001;
      if (code.includes('Seminar')) return 60002;
      if (code.includes('Principal')) return 60003;
      if (code.includes('PLAYGROUND')) return 60004;
      return 70000;
    }

    function matchesSearch(room, rawQuery) {
      if (!rawQuery) return true;
      const q = rawQuery.trim().toLowerCase();
      if (!q) return true;
      const qNoSpace = q.replace(/[\s\-_]/g, '');
      const code = room.code.toLowerCase();
      const codeNoSpace = code.replace(/[\s\-_]/g, '');
      const name = room.name.toLowerCase();
      const cat = room.category.toLowerCase();

      // 1. Exact match by code
      if (qNoSpace === codeNoSpace) return true;

      // 2. Specific room code patterns:
      // R (Classrooms): 'r3', 'room3', 'room 3', 'r 3'
      const mR = qNoSpace.match(/^(?:r|room)(\d+)$/);
      if (mR) return codeNoSpace === `r${mR[1]}`;

      // T (Tutorials): 't3', 'tut3', 'tutorial3', 't 3'
      const mT = qNoSpace.match(/^(?:t|tut|tutorial)(\d+)$/);
      if (mT) return codeNoSpace === `t${mT[1]}`;

      // PB (Principal Bungalow): 'pb3', 'pb 3'
      const mPB = qNoSpace.match(/^(?:pb|bungalow)(\d+)$/);
      if (mPB) return codeNoSpace === `pb${mPB[1]}`;

      // SCR (Sports Complex): 'scr3', 'scr 3'
      const mSCR = qNoSpace.match(/^(?:scr|sport|sports)(\d+)$/);
      if (mSCR) return codeNoSpace === `scr${mSCR[1]}`;

      // CL (Computer Labs): 'cl1', 'cl 1', 'lab1'
      const mCL = qNoSpace.match(/^(?:cl|lab)(\d+)$/);
      if (mCL) return codeNoSpace === `cl${mCL[1]}`;

      // Pure number, e.g. '3' -> match rooms whose number is exactly 3 (R3, T3, PB3, SCR3, CL3)
      if (/^\d+$/.test(qNoSpace)) {
        return codeNoSpace === `r${qNoSpace}` ||
               codeNoSpace === `t${qNoSpace}` ||
               codeNoSpace === `pb${qNoSpace}` ||
               codeNoSpace === `scr${qNoSpace}` ||
               codeNoSpace === `cl${qNoSpace}`;
      }

      // Category keywords:
      if (['r', 'room', 'rooms', 'classroom', 'classrooms', 'lecture'].includes(q)) {
        return /^r\d+$/i.test(room.code);
      }
      if (['t', 'tut', 'tutorial', 'tutorials'].includes(q)) {
        return /^t\d+$/i.test(room.code) && !room.code.startsWith('PB');
      }
      if (['pb', 'bungalow', 'principal bungalow'].includes(q)) {
        return room.code.startsWith('PB');
      }
      if (['scr', 'sport', 'sports', 'sports complex'].includes(q)) {
        return room.code.startsWith('SCR');
      }
      if (['cl', 'lab', 'labs', 'computer lab', 'computer labs'].includes(q)) {
        return room.code.startsWith('CL') || room.code === 'CLIB';
      }
      if (q.includes('library')) {
        return code.includes('library') || code === 'clib';
      }
      if (q.includes('seminar')) return code.includes('seminar');
      if (q.includes('playground')) return code.includes('playground');
      if (q.includes('office')) return code.includes('office');

      // Fallback: whole word match in name or code (avoiding substring leakage)
      const words = (name + ' ' + code).toLowerCase().split(/[^a-z0-9]+/);
      return words.includes(qNoSpace);
    }

    function copyToClipboard(text) {
      if (navigator.clipboard && window.isSecureContext) {
        return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
      }
      return fallbackCopy(text);
    }

    function fallbackCopy(text) {
      return new Promise((resolve, reject) => {
        try {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.left = '-9999px';
          ta.style.top = '0';
          document.body.appendChild(ta);
          ta.focus();
          ta.select();
          const ok = document.execCommand('copy');
          document.body.removeChild(ta);
          if (ok) resolve();
          else reject();
        } catch (e) {
          reject(e);
        }
      });
    }

    // Calculate calendar date for any day of the current academic week (IST-aligned)
    function getDateForDay(targetDayName) {
      const daysMap = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };
      const now = getIstDate();
      const currentDayIndex = now.getDay();
      const targetIndex = daysMap[targetDayName] !== undefined ? daysMap[targetDayName] : currentDayIndex;

      let dayDiff = targetIndex - currentDayIndex;
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() + dayDiff);

      return targetDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    function openShareModal(roomCode) {
      const room = appData.rooms.find(r => r.code === roomCode);
      if (!room) return;

      const sched = room.schedule[state.activeDay] || { free_slots: [] };
      const freeSlotsList = sched.free_slots.length > 0
        ? sched.free_slots.map(s => `  • ${s.replace(' to ', ' – ')}`).join('\n')
        : '  • Only Lunch Recess (1:30 PM – 2:00 PM)';

      const siteUrl = window.location.origin + window.location.pathname.replace(/\/index\.html$/i, '');
      const directRoomUrl = `${siteUrl}${siteUrl.endsWith('/') ? '' : '/'}?room=${encodeURIComponent(room.code)}`;
      const activeDateStr = getDateForDay(state.activeDay);
      const dayAndDateDisplay = `${state.activeDay}, ${activeDateStr}`;

      const freeUntilStatus = getRoomFreeUntilStatus(room, state.activeDay);
      const freeUntilNote = freeUntilStatus.text ? `\n⏳ Status: ${freeUntilStatus.text}` : '';

      const cleanMessage = `🎓 SRCC Classroom Vacancy Alert

📍 Room: ${room.code} (${room.name})
🏛️ Wing: ${room.category.split(' (')[0]}
🗓️ Day & Date: ${dayAndDateDisplay}${freeUntilNote}
👥 Capacity: ${room.capacity} seats
☕ Lunch Recess: 1:30 PM – 2:00 PM (Vacant)

🕒 Free Academic Slots:
${freeSlotsList}`;

      const whatsappMessage = `🎓 *SRCC Classroom Vacancy Alert*

📍 *Room:* ${room.code} (${room.name})
🏛️ *Wing:* ${room.category.split(' (')[0]}
🗓️ *Day & Date:* ${dayAndDateDisplay}${freeUntilNote}
👥 *Capacity:* ${room.capacity} seats
☕ *Lunch Recess:* 1:30 PM – 2:00 PM (Vacant)

🕒 *Free Academic Slots:*
${freeSlotsList}`;

      const tweetText = `🎓 SRCC Vacancy: Room ${room.code} is FREE on ${dayAndDateDisplay}! Check room schedule:`;
      const emailSubject = `SRCC Room Vacancy: ${room.code} (${dayAndDateDisplay})`;

      currentShareMessage = cleanMessage;

      copyToClipboard(cleanMessage)
        .then(() => showToast(`📋 Room details for <strong>${escapeHtml(room.code)}</strong> copied!`, true, 3500))
        .catch(() => showToast(`📤 Share Room <strong>${escapeHtml(room.code)}</strong>`, false, 2500));

      if (shareModalTitle) shareModalTitle.textContent = `📤 Share ${room.code} (${room.name})`;
      if (sharePreviewText) sharePreviewText.textContent = cleanMessage;

      const encodedCleanMsg = encodeURIComponent(cleanMessage);
      const encodedWaMsg = encodeURIComponent(whatsappMessage);
      const encodedUrl = encodeURIComponent(directRoomUrl);

      if (shareBtnWhatsapp) {
        shareBtnWhatsapp.href = `https://api.whatsapp.com/send?text=${encodedWaMsg}`;
      }
      if (shareBtnGmail) {
        shareBtnGmail.href = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(emailSubject)}&body=${encodedCleanMsg}`;
      }
      if (shareBtnX) {
        shareBtnX.href = `https://x.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
      }
      if (shareBtnTelegram) {
        shareBtnTelegram.href = `https://t.me/share/url?text=${encodedCleanMsg}`;
      }

      if (shareBtnLinkedin) {
        shareBtnLinkedin.onclick = (e) => {
          e.preventDefault();
          if (navigator.share) {
            navigator.share({ title: `SRCC Room ${room.code} Vacancy`, text: cleanMessage }).catch(() => {});
          } else {
            copyToClipboard(cleanMessage);
            window.open(`https://www.linkedin.com/feed/`, '_blank', 'noopener,noreferrer');
          }
        };
      }

      if (shareBtnInstagram) {
        shareBtnInstagram.onclick = (e) => {
          e.preventDefault();
          if (navigator.share) {
            navigator.share({ title: `SRCC Room ${room.code} Vacancy`, text: cleanMessage }).catch(() => {});
          } else {
            copyToClipboard(cleanMessage).then(() => showToast('📸 Copied! Opening Instagram...', true));
            window.open('https://www.instagram.com/direct/inbox/', '_blank', 'noopener,noreferrer');
          }
        };
      }

      if (shareBtnFacebook) {
        shareBtnFacebook.onclick = (e) => {
          e.preventDefault();
          if (navigator.share) {
            navigator.share({ title: `SRCC Room ${room.code} Vacancy`, text: cleanMessage }).catch(() => {});
          } else {
            copyToClipboard(cleanMessage);
            window.open(`https://www.facebook.com/`, '_blank', 'noopener,noreferrer');
          }
        };
      }

      if (navigator.share && btnPrimaryShare) {
        btnPrimaryShare.style.display = 'flex';
        btnPrimaryShare.onclick = () => {
          navigator.share({ title: `SRCC Room ${room.code} Vacancy`, text: cleanMessage }).catch(() => {});
        };
      } else if (btnPrimaryShare) {
        btnPrimaryShare.style.display = 'none';
      }

      // 📷 Customized Room QR Code Generator
      const btnShareRoomQr = document.getElementById('btnShareRoomQr');
      const roomQrContainer = document.getElementById('roomQrContainer');
      const roomCustomQrCanvas = document.getElementById('roomCustomQrCanvas');
      const btnDownloadRoomQr = document.getElementById('btnDownloadRoomQr');
      const btnCopyCleanRoomLink = document.getElementById('btnCopyCleanRoomLink');
      const btnShareWaQr = document.getElementById('btnShareWaQr');

      function drawCustomQrCard() {
        if (!roomCustomQrCanvas) return;
        const ctx = roomCustomQrCanvas.getContext('2d');
        const W = roomCustomQrCanvas.width;
        const H = roomCustomQrCanvas.height;

        // Reset
        ctx.clearRect(0, 0, W, H);

        // Helper rounded rect
        function drawRRect(x, y, w, h, r) {
          ctx.beginPath();
          ctx.moveTo(x + r, y);
          ctx.lineTo(x + w - r, y);
          ctx.quadraticCurveTo(x + w, y, x + w, y + r);
          ctx.lineTo(x + w, y + h - r);
          ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
          ctx.lineTo(x + r, y + h);
          ctx.quadraticCurveTo(x, y + h, x, y + h - r);
          ctx.lineTo(x, y + r);
          ctx.quadraticCurveTo(x, y, x + r, y);
          ctx.closePath();
        }

        // White Card Background
        ctx.fillStyle = '#ffffff';
        drawRRect(0, 0, W, H, 20);
        ctx.fill();

        // Card Border
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 2;
        drawRRect(1, 1, W - 2, H - 2, 19);
        ctx.stroke();

        // Top Header Banner (Deep SRCC Navy Gradient)
        const headerH = 75;
        const grad = ctx.createLinearGradient(0, 0, W, 0);
        grad.addColorStop(0, '#000066');
        grad.addColorStop(1, '#1e3a8a');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(0, 20);
        ctx.quadraticCurveTo(0, 0, 20, 0);
        ctx.lineTo(W - 20, 0);
        ctx.quadraticCurveTo(W, 0, W, 20);
        ctx.lineTo(W, headerH);
        ctx.lineTo(0, headerH);
        ctx.closePath();
        ctx.fill();

        // Gold bottom accent line on header
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(0, headerH - 3, W, 3);

        // Header text
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('SHRI RAM COLLEGE OF COMMERCE', W / 2, 33);

        ctx.fillStyle = '#bfdbfe';
        ctx.font = '500 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('Official Classroom Schedule & Direct QR', W / 2, 53);

        // Loading QR Placeholder
        ctx.fillStyle = '#f8fafc';
        drawRRect(60, 95, 260, 240, 12);
        ctx.fill();
        ctx.fillStyle = '#94a3b8';
        ctx.font = '500 12px sans-serif';
        ctx.fillText('Generating customized QR...', W / 2, 215);

        // Load QR Code
        const qrImg = new Image();
        qrImg.crossOrigin = 'anonymous';
        qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(directRoomUrl)}`;

        qrImg.onload = () => {
          ctx.drawImage(qrImg, 70, 95, 240, 240);

          // Center College Logo Badge
          const logoX = W / 2;
          const logoY = 95 + 120;
          const logoR = 26;

          // White Circular Shield with Shadow
          ctx.save();
          ctx.beginPath();
          ctx.arc(logoX, logoY, logoR + 4, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.shadowColor = 'rgba(0,0,0,0.25)';
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.restore();

          // Border around center badge
          ctx.beginPath();
          ctx.arc(logoX, logoY, logoR + 3, 0, Math.PI * 2);
          ctx.strokeStyle = '#000066';
          ctx.lineWidth = 2;
          ctx.stroke();

          // Draw Crest in center
          const crestImg = new Image();
          crestImg.crossOrigin = 'anonymous';
          crestImg.src = 'srcc_crest.png';
          crestImg.onload = () => {
            ctx.save();
            ctx.beginPath();
            ctx.arc(logoX, logoY, logoR, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(crestImg, logoX - logoR, logoY - logoR, logoR * 2, logoR * 2);
            ctx.restore();
          };
          crestImg.onerror = () => {
            ctx.fillStyle = '#000066';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('SRCC', logoX, logoY);
          };
        };

        // Room Name and Details Below QR
        ctx.textBaseline = 'alphabetic';
        const cleanRoomTitle = room.code.startsWith('R') ? `Room ${room.code.slice(1)}` : room.code;
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(cleanRoomTitle, W / 2, 375);

        ctx.fillStyle = '#64748b';
        ctx.font = '500 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        const wingText = `${room.category.split(' (')[0]} · Capacity: ${room.capacity} seats`;
        ctx.fillText(wingText, W / 2, 396);

        // Vacancy Status Tag
        const freeCount = sched.free_slots ? sched.free_slots.length : 0;
        const pillText = freeCount > 0 ? `⚡ ${freeCount} Academic Slots Free Today` : `☕ Recess Free · Classes Scheduled`;
        ctx.fillStyle = freeCount > 0 ? '#ecfdf5' : '#eff6ff';
        drawRRect(50, 412, 280, 28, 14);
        ctx.fill();

        ctx.fillStyle = freeCount > 0 ? '#059669' : '#2563eb';
        ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(pillText, W / 2, 430);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '500 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText('Scan with phone camera or WhatsApp to open schedule', W / 2, 465);
      }

      if (btnShareRoomQr && roomQrContainer) {
        roomQrContainer.style.display = 'none';
        btnShareRoomQr.innerHTML = '<span>📷 Share Room QR</span>';
        btnShareRoomQr.onclick = () => {
          const isHidden = (roomQrContainer.style.display === 'none');
          if (isHidden) {
            roomQrContainer.style.display = 'block';
            btnShareRoomQr.innerHTML = '<span>✕ Close Room QR</span>';
            drawCustomQrCard();
          } else {
            roomQrContainer.style.display = 'none';
            btnShareRoomQr.innerHTML = '<span>📷 Share Room QR</span>';
          }
        };
      }

      if (btnDownloadRoomQr && roomCustomQrCanvas) {
        btnDownloadRoomQr.onclick = () => {
          try {
            const dataUrl = roomCustomQrCanvas.toDataURL('image/png');
            const a = document.createElement('a');
            a.href = dataUrl;
            a.download = `SRCC_Room_${room.code}_Schedule_QR.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            showToast(`📥 <strong>Room ${room.code} QR Card</strong> downloaded!`, true);
          } catch (e) {
            showToast(`Unable to export image directly. Point phone to scan.`, false);
          }
        };
      }

      if (btnCopyCleanRoomLink) {
        btnCopyCleanRoomLink.onclick = () => {
          copyToClipboard(directRoomUrl).then(() => {
            btnCopyCleanRoomLink.textContent = '✅ Link Copied!';
            showToast(`🔗 Clean room link copied: <strong>${escapeHtml(room.code)}</strong>`, true, 3000);
            setTimeout(() => {
              btnCopyCleanRoomLink.textContent = '📋 Copy Link';
            }, 2500);
          });
        };
      }

      if (btnShareWaQr) {
        btnShareWaQr.onclick = () => {
          const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappMessage + '\n\n🔗 ' + directRoomUrl)}`;
          window.open(waUrl, '_blank', 'noopener,noreferrer');
        };
      }

      if (shareModal) openAppModal(shareModal);
    }

    // Expose openShareModal globally
    window.openShareModal = openShareModal;

    if (btnCopyShareText) {
      btnCopyShareText.addEventListener('click', () => {
        copyToClipboard(currentShareMessage)
          .then(() => {
            btnCopyShareText.innerHTML = '✅ Copied to Clipboard! (Press Ctrl+V anywhere)';
            showToast(`📋 <strong>Room schedule copied!</strong> Ready to paste anywhere.`, true, 3500);
            setTimeout(() => {
              btnCopyShareText.innerHTML = '📋 Copy Formatted Text to Clipboard';
            }, 2500);
          });
      });
    }

    // ========================================================================
    // 🎨 RENDER CLASSROOM FINDER VIEW
    // ========================================================================
    function getRoomOverride(code) {
      if (!code) return null;
      const c = code.trim().toUpperCase();
      const overrides = window.SRCC_ROOM_OVERRIDES || roomOverridesMap || {};
      return overrides[c] || overrides[c.replace(/\s+/g, '')] || null;
    }

    function render() {
      renderActiveLeavesBanners();
      if (statActiveDay) statActiveDay.textContent = state.activeDay;
      if (metricDayLabel) metricDayLabel.textContent = state.activeDay;

      // Filter Rooms
      let filtered = appData.rooms.filter(room => {
        const roomOv = getRoomOverride(room.code);
        if (roomOv && roomOv.status === 'DELETED') return false;
        if (!matchesCategory(room, state.activeCategory)) return false;
        if (state.searchQuery && !matchesSearch(room, state.searchQuery)) return false;

        // If filtering by slot or Free Now, unavailable rooms are NOT free
        if (state.activeSlot !== 'ALL' || state.freeNowActive) {
          if (roomOv && roomOv.status === 'UNAVAILABLE') return false;
        }

        if (state.activeSlot !== 'ALL') {
          // If room is locked or booked for an extra class in this slot, it is NOT free!
          if (isRoomLocked(room.code, state.activeSlot, getTodayIsoDate())) {
            return false;
          }

          // 🥪 Lunch Recess (1:30 PM - 2:00 PM): All 96 classrooms are 100% free!
          if (state.activeSlot === '1:30 PM to 2:00 PM') {
            return true;
          }
          const daySched = room.schedule[state.activeDay];
          if (!daySched) return false;
          let isFree = daySched.free_slots.includes(state.activeSlot);

          // Check if scheduled teacher is on leave
          if (!isFree) {
            const leaveInfo = getRoomScheduledTeacherLeave(room.code, state.activeDay, state.activeSlot);
            if (leaveInfo) isFree = true; // Bonus free!
          }
          if (!isFree) return false;
        }
        return true;
      });

      // Sorting
      filtered.sort((a, b) => {
        const schedA = a.schedule[state.activeDay] || { free_hours: 0 };
        const schedB = b.schedule[state.activeDay] || { free_hours: 0 };

        if (state.sortBy === 'ROOM_ASC') {
          const orderA = getRoomSortOrder(a.code);
          const orderB = getRoomSortOrder(b.code);
          if (orderA !== orderB) return orderA - orderB;
          return a.code.localeCompare(b.code, undefined, { numeric: true });
        } else if (state.sortBy === 'FREE_DESC') {
          if (schedB.free_hours !== schedA.free_hours) {
            return schedB.free_hours - schedA.free_hours;
          }
          return getRoomSortOrder(a.code) - getRoomSortOrder(b.code);
        } else if (state.sortBy === 'CAP_DESC') {
          const capA = parseInt(a.capacity.split('/')[0]) || 0;
          const capB = parseInt(b.capacity.split('/')[0]) || 0;
          return capB - capA;
        }
        return 0;
      });

      // Stats Calculation
      let totalFreeHoursCount = 0;
      filtered.forEach(r => {
        const s = r.schedule[state.activeDay];
        if (s) totalFreeHoursCount += s.free_hours;
      });

      if (statRoomCount) statRoomCount.textContent = filtered.length;
      if (statTotalFreeHours) statTotalFreeHours.textContent = totalFreeHoursCount;
      if (metricTotalFreeCount) metricTotalFreeCount.textContent = totalFreeHoursCount;

      if (metricVacantNowCount) {
        if (state.currentLiveSlot === '1:30 PM to 2:00 PM') {
          metricVacantNowCount.textContent = '96 (Lunch)';
        } else if (state.currentLiveSlot) {
          const vacantNow = appData.rooms.filter(r => {
            const s = r.schedule[state.activeDay];
            if (!s) return false;
            if (s.free_slots.includes(state.currentLiveSlot)) return true;
            return !!getRoomScheduledTeacherLeave(r.code, state.activeDay, state.currentLiveSlot);
          }).length;
          metricVacantNowCount.textContent = `${vacantNow} Rooms`;
        } else {
          metricVacantNowCount.textContent = 'Off-Hours';
        }
      }

      if (metricBestCat) {
        const catStats = { 'Tutorials': 0, 'Classrooms': 0, 'PB Wing': 0, 'Sports Complex': 0 };
        appData.rooms.forEach(r => {
          const s = r.schedule[state.activeDay];
          const free = s ? s.free_hours : 0;
          if (r.code.startsWith('T') && !r.code.startsWith('PB')) catStats['Tutorials'] += free;
          else if (/^R\d+$/.test(r.code)) catStats['Classrooms'] += free;
          else if (r.code.startsWith('PB')) catStats['PB Wing'] += free;
          else if (r.code.startsWith('SCR')) catStats['Sports Complex'] += free;
        });
        const best = Object.keys(catStats).reduce((a, b) => catStats[a] > catStats[b] ? a : b);
        metricBestCat.textContent = best;
      }

      // Filter description tag
      let filterDesc = [];
      if (state.activeCategory !== 'ALL') {
        const pill = Array.from(catPills).find(p => p.dataset.cat === state.activeCategory);
        if (pill) filterDesc.push(pill.textContent.split(' (')[0]);
      }
      if (state.activeSlot !== 'ALL') filterDesc.push(`Slot: ${state.activeSlot.replace(' to ', '–')}`);
      if (state.searchQuery) filterDesc.push(`Search: "${state.searchQuery}"`);
      if (statFilterDesc) statFilterDesc.textContent = filterDesc.length ? `• ${filterDesc.join(', ')}` : '';

      if (filtered.length === 0) {
        roomsGrid.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        return;
      }
      if (emptyState) emptyState.style.display = 'none';

      roomsGrid.innerHTML = filtered.map(room => {
        const sched = room.schedule[state.activeDay] || {
          free_slots: [],
          free_hours: 0,
          lunch_recess_free: true,
          occupied_slots: []
        };

        // Check if any occupied slot in this room has teacher on leave
        let bonusFreeSlots = [];
        sched.occupied_slots.forEach(o => {
          const leaveInfo = getRoomScheduledTeacherLeave(room.code, state.activeDay, o.slot);
          if (leaveInfo) {
            bonusFreeSlots.push({ slot: o.slot, teacher: leaveInfo.teacher, leave: leaveInfo.leave });
          }
        });

        // Check if this room has active locks / extra classes pushed by admin
        const todayIso = getTodayIsoDate();
        const activeRoomLocks = getRoomActiveLocks(room.code, todayIso);
        const isFullDayLocked = activeRoomLocks.some(l => l.slot === 'ALL_DAY');
        const lockedSlotsSet = new Set(activeRoomLocks.filter(l => l.slot !== 'ALL_DAY').map(l => l.slot));

        const roomOv = getRoomOverride(room.code);
        const isUnavailable = (roomOv && roomOv.status === 'UNAVAILABLE');

        let effectiveFreeSlots = (sched.free_slots || []).filter(s => !lockedSlotsSet.has(s));
        let effectiveBonusSlots = bonusFreeSlots.filter(b => !lockedSlotsSet.has(b.slot));
        if (isFullDayLocked || isUnavailable) {
          effectiveFreeSlots = [];
          effectiveBonusSlots = [];
        }

        const effectiveFreeHours = (isFullDayLocked || isUnavailable) ? 0 : (effectiveFreeSlots.length + effectiveBonusSlots.length);
        let cardStyleClass = 'is-booked';
        if (isUnavailable) cardStyleClass = 'is-booked is-unavailable';
        else if (effectiveFreeHours >= 5) cardStyleClass = 'has-many-free';
        else if (effectiveFreeHours > 0) cardStyleClass = 'has-some-free';

        const themeClass = getCategoryThemeClass(room);

        // Calculate consecutive free windows (continuous periods)
        const consecutiveWindows = isFullDayLocked ? [] : getConsecutiveFreeWindows(effectiveFreeSlots, effectiveBonusSlots);
        const multiPeriodWindows = (effectiveFreeHours === 9)
          ? consecutiveWindows
          : consecutiveWindows.filter(w => w.periodsCount >= 2);

        let consecutiveChipsHtml = '';
        const coveredContinuousSlots = new Set();

        if (effectiveFreeHours === 9) {
          consecutiveChipsHtml = `<div class="consecutive-window-chip" title="Full Day Uninterrupted Free Window">⚡ ★ 8:30 AM – 6:00 PM (Full Day Continuous)</div>`;
          periodIntervals.forEach(p => coveredContinuousSlots.add(p.slot));
        } else if (multiPeriodWindows.length > 0) {
          consecutiveChipsHtml = multiPeriodWindows.map(w =>
            `<div class="consecutive-window-chip" title="Continuous uninterrupted free window">⚡ ${escapeHtml(w.text)}</div>`
          ).join('');
          multiPeriodWindows.forEach(w => {
            (w.slots || []).forEach(s => coveredContinuousSlots.add(s));
          });
        }

        // Filter out slots that are ALREADY covered by continuous windows above to prevent repetition!
        const standaloneRegularSlots = effectiveFreeSlots.filter(s => !coveredContinuousSlots.has(s));
        const standaloneBonusSlots = effectiveBonusSlots.filter(b => !coveredContinuousSlots.has(b.slot));

        // Format standalone/remaining free slot chips
        let chipsHtml = '';
        if (standaloneRegularSlots.length > 0 || standaloneBonusSlots.length > 0) {
          const regularChips = standaloneRegularSlots.map(slot => {
            const isHighlight = (state.activeSlot !== 'ALL' && state.activeSlot === slot);
            const chipClass = isHighlight ? 'slot-chip slot-highlight' : 'slot-chip slot-free';
            return `<div class="${chipClass}">${escapeHtml(slot.replace(' to ', ' – '))}</div>`;
          }).join('');

          const bonusChips = standaloneBonusSlots.map(b => {
            return `<div class="slot-chip" style="background: rgba(168, 85, 247, 0.22); color: #6d28d9; border: 1px solid rgba(168, 85, 247, 0.45);" title="Class cancelled: Prof. ${escapeHtml(b.teacher.clean_name)} on leave">✨ ${escapeHtml(b.slot.replace(' to ', '–'))} (Faculty Leave)</div>`;
          }).join('');

          chipsHtml = regularChips + bonusChips;
        }

        // Timeline strip
        const p1_5 = periodIntervals.slice(0, 5).map(p => {
          const lock = activeRoomLocks.find(l => l.slot === 'ALL_DAY' || l.slot === p.slot);
          if (lock) {
            const isExtra = lock.type === 'extra_class';
            const icon = isExtra ? '📚' : '🔒';
            const badgeTitle = `${p.full}: ${icon} ${isExtra ? 'EXTRA CLASS' : 'ROOM LOCKED'} - ${escapeHtml(lock.title || '')}`;
            const lockStyle = isExtra ? 'background: #2563eb; color: #FFF;' : 'background: #dc2626; color: #FFF;';
            return `<div class="p-block busy" style="${lockStyle}" data-room="${room.code}" data-slot="${p.slot}" title="${badgeTitle}">${icon}</div>`;
          }

          let isFree = effectiveFreeSlots.includes(p.slot);
          const hasBonus = effectiveBonusSlots.find(b => b.slot === p.slot);
          if (hasBonus) isFree = true;

          const cls = isFree ? (hasBonus ? 'p-block' : 'p-block free') : 'p-block busy';
          const bonusStyle = hasBonus ? 'background: linear-gradient(135deg, #9333EA, #7C3AED); color: #FFF;' : '';
          const title = hasBonus
            ? `${p.full}: ✨ BONUS FREE (Prof. ${hasBonus.teacher.clean_name} on Leave)`
            : `${p.full}: ${isFree ? 'Vacant for GD' : 'Class in Session'}`;
          return `<div class="${cls}" style="${bonusStyle}" data-room="${room.code}" data-slot="${p.slot}" title="${title}">${p.label}</div>`;
        }).join('');

        const recessMarker = `<div class="p-recess-divider" title="1:30–2:00 PM Lunch Recess (All 96 rooms vacant)">☕</div>`;

        const p6_9 = periodIntervals.slice(5).map(p => {
          const lock = activeRoomLocks.find(l => l.slot === 'ALL_DAY' || l.slot === p.slot);
          if (lock) {
            const isExtra = lock.type === 'extra_class';
            const icon = isExtra ? '📚' : '🔒';
            const badgeTitle = `${p.full}: ${icon} ${isExtra ? 'EXTRA CLASS' : 'ROOM LOCKED'} - ${escapeHtml(lock.title || '')}`;
            const lockStyle = isExtra ? 'background: #2563eb; color: #FFF;' : 'background: #dc2626; color: #FFF;';
            return `<div class="p-block busy" style="${lockStyle}" data-room="${room.code}" data-slot="${p.slot}" title="${badgeTitle}">${icon}</div>`;
          }

          let isFree = effectiveFreeSlots.includes(p.slot);
          const hasBonus = effectiveBonusSlots.find(b => b.slot === p.slot);
          if (hasBonus) isFree = true;

          const cls = isFree ? (hasBonus ? 'p-block' : 'p-block free') : 'p-block busy';
          const bonusStyle = hasBonus ? 'background: linear-gradient(135deg, #9333EA, #7C3AED); color: #FFF;' : '';
          const title = hasBonus
            ? `${p.full}: ✨ BONUS FREE (Prof. ${hasBonus.teacher.clean_name} on Leave)`
            : `${p.full}: ${isFree ? 'Vacant for GD' : 'Class in Session'}`;
          return `<div class="${cls}" style="${bonusStyle}" data-room="${room.code}" data-slot="${p.slot}" title="${title}">${p.label}</div>`;
        }).join('');

        const roomLockBannersHtml = activeRoomLocks.length > 0
          ? activeRoomLocks.map(l => {
              const isExtra = l.type === 'extra_class';
              const icon = isExtra ? '📚' : '🔒';
              const isFullDay = l.slot === 'ALL_DAY';
              const label = isExtra ? 'EXTRA CLASS SCHEDULED' : (isFullDay ? 'ROOM FULL DAY LOCKED' : 'ROOM PERIOD LOCKED');
              const slotText = isFullDay ? 'Full Day (8:30 AM – 6:00 PM)' : l.slot.replace(' to ', ' – ');
              const bannerClass = isExtra ? 'extra-class-banner' : 'locked-room-banner';
              const titleNote = l.title ? ` – "${escapeHtml(l.title)}"` : '';
              return `<div class="${bannerClass}">
                <span style="font-size: 0.95rem;">${icon}</span>
                <span><strong>${label}:</strong> ${escapeHtml(slotText)}${titleNote}</span>
              </div>`;
            }).join('')
          : '';

        const bonusBannerHtml = effectiveBonusSlots.length > 0
          ? `<div class="bonus-free-banner">
               <span>✨</span>
               <span><strong>BONUS FREE ROOM:</strong> ${effectiveBonusSlots.length} lecture(s) cancelled (Faculty on Leave)</span>
             </div>`
          : '';

        const catBadgeClass = getCategoryBadgeClass(room.category);
        const freeUntilStatus = getRoomFreeUntilStatus(room, state.activeDay);
        const freeUntilBadgeHtml = freeUntilStatus
          ? `<span class="badge-free-until ${freeUntilStatus.isFreeNow ? 'is-free-now' : 'is-busy-now'}" title="${escapeHtml(freeUntilStatus.calloutText)}"><span class="live-dot"></span>${escapeHtml(freeUntilStatus.badgeText)}</span>`
          : '';
        const freeUntilCalloutHtml = freeUntilStatus
          ? `<div class="free-until-callout">⏱️ <strong>${escapeHtml(freeUntilStatus.calloutText)}</strong></div>`
          : '';

        const unavailableBadgeHtml = isUnavailable
          ? `<span class="badge-room-unavailable">🛠️ Unavailable</span>`
          : '';

        const unavailableCalloutHtml = isUnavailable
          ? `<div class="unavailable-callout">
               <span>🛠️</span>
               <span><strong>Under Maintenance:</strong> ${escapeHtml(roomOv.reason || 'Temporarily Unavailable')}${roomOv.duration ? ` (${escapeHtml(roomOv.duration)})` : ''}</span>
             </div>`
          : '';

        return `
          <article class="room-card ${cardStyleClass} ${themeClass}" data-room-code="${escapeHtml(room.code)}">
            <div class="card-header room-card-header">
              <div class="card-title-group">
                <div class="card-room-code">${escapeHtml(room.code)}</div>
                <div class="card-room-name">${escapeHtml(room.name)}</div>
              </div>
              <div class="card-meta-badges">
                <span class="badge-category ${catBadgeClass}">${escapeHtml(room.category.split(' (')[0])}</span>
                <span class="badge-capacity">${escapeHtml(room.capacity)} Seats</span>
                ${unavailableBadgeHtml}
                ${freeUntilBadgeHtml}
              </div>
            </div>

            ${unavailableCalloutHtml}
            ${roomLockBannersHtml}
            ${bonusBannerHtml}

            <div class="card-timeline-wrapper">
              <div class="timeline-header-row">
                <span>Day Period Breakdown</span>
                <span>${effectiveFreeHours}/9 Free</span>
              </div>
              <div class="timeline-periods-strip">
                ${p1_5}
                ${recessMarker}
                ${p6_9}
              </div>
            </div>

            <div class="card-body">
              <div class="free-summary-bar ${effectiveFreeHours === 0 ? 'zero-free' : ''}">
                <span>${effectiveFreeHours > 0 ? `🟢 ${effectiveFreeHours} Academic Hours Free` : `🔴 Fully Booked Day`}</span>
                <span>${sched.occupied_slots.length} Classes Scheduled</span>
              </div>
              ${freeUntilCalloutHtml}

              ${consecutiveChipsHtml ? `
                <div class="consecutive-windows-section" style="margin: 8px 0 6px 0;">
                  <div style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.5px;">Vacant Windows for GD:</div>
                  <div style="display: flex; flex-direction: column; gap: 4px;">
                    ${consecutiveChipsHtml}
                  </div>
                </div>
              ` : ''}

              ${chipsHtml ? `
                <div class="slots-chips-title" style="margin-top: 6px;">${consecutiveChipsHtml ? 'Other Free Timings for GD:' : 'Free Timings for GD:'}</div>
                <div class="slots-chips-container room-free-list">
                  ${chipsHtml}
                </div>
              ` : (effectiveFreeHours === 0 ? `
                <div class="slots-chips-container room-free-list">
                  <div class="slot-chip slot-none">No free periods on this day</div>
                </div>
              ` : '')}
            </div>

            <div class="card-actions room-card-actions">
              <button class="btn-share-room" data-room="${escapeHtml(room.code)}" title="Share room vacancy on WhatsApp, LinkedIn, Facebook, Instagram">
                📤 Share Room
              </button>
              <button class="btn-view-schedule" data-room="${escapeHtml(room.code)}">
                Schedule ↗
              </button>
            </div>
          </article>
        `;
      }).join('');

      // Attach Modal Listeners
      document.querySelectorAll('.btn-view-schedule').forEach(btn => {
        btn.addEventListener('click', () => openScheduleModal(btn.dataset.room));
      });

      document.querySelectorAll('.btn-share-room').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          openShareModal(btn.dataset.room);
        });
      });

      document.querySelectorAll('.p-block').forEach(block => {
        block.addEventListener('click', (e) => {
          e.stopPropagation();
          openScheduleModal(block.dataset.room);
        });
      });
    }

    function escapeHtml(str) {
      if (str === null || str === undefined) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function formatClassDetails(raw) {
      if (!raw || typeof raw !== 'string') return '<span class="class-batch-line">Scheduled Class</span>';
      let cleaned = raw.replace(/<[-=]+>/g, '').trim();

      // Check if this is a multi-part concatenated string of the SAME class (e.g. LAB-1...LAB-2...NP1...NP2...NP3)
      const subParts = cleaned.split(/(?=(?:LAB|L|T)-(?:\d+\.\s*)?(?:BCH|BAH|M\.COM|MA-ECO|JOINT)-)/).map(p => p.trim()).filter(Boolean);
      if (subParts.length > 1) {
        const batches = [];
        subParts.forEach(p => {
          const bm = p.match(/-(NP\d+|VAC\d+|SEC\d+|[A-Z]P\d+|[A-Z]\d+)$/i);
          if (bm && !batches.includes(bm[1])) batches.push(bm[1]);
        });
        const subjMatch = subParts[0].match(/-([A-Za-z0-9\.\(\)\/\s\+&]{2,15})-(?:R\d+|T\d+|PB\d+|SCR\d+|CL\d+|CLIB|Library FF|SEC\d+|VAC\d+|-)/i);
        if (subjMatch && batches.length > 1) {
          const firstPartClean = subParts[0]
            .replace(/-(NP\d+|VAC\d+|SEC\d+|[A-Z]P\d+|[A-Z]\d+)$/i, '')
            .replace(/^(?:LAB|L|T)-\d+\.\s*/i, '');
          let text = firstPartClean;
          if (/SEM(?:ESTER)?\s*(VIII|VII|VI|IV|V|III|II|I|\d+)(?=[A-Za-z])/i.test(text)) {
            text = text.replace(/[- ]*SEM(?:ESTER)?\s*(VIII|VII|VI|IV|V|III|II|I|\d+)(?=[A-Za-z])/gi, ' • Sem $1 • ');
          } else {
            text = text.replace(/[- ]*SEM(?:ESTER)?\s*(VIII|VII|VI|IV|V|III|II|I|\d+)\b/gi, ' • Sem $1');
          }
          text = text.replace(/(?:\s*•\s*)+/g, ' • ').trim();
          if (text.startsWith('• ')) text = text.slice(2).trim();
          return `<div class="class-batch-line">${escapeHtml(text)} • <strong>Batches: ${escapeHtml(batches.join(', '))}</strong></div>`;
        }
      }

      cleaned = cleaned.replace(/([A-Za-z0-9\.\)])(?=LAB[- ]\d+|TUTE[- ]\d+|BATCH[- ]\d+)/gi, '$1\n');

      const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean);
      const formattedLines = lines.map(line => {
        let text = line;
        if (/SEM(?:ESTER)?\s*(VIII|VII|VI|IV|V|III|II|I|\d+)(?=[A-Za-z])/i.test(text)) {
          text = text.replace(/[- ]*SEM(?:ESTER)?\s*(VIII|VII|VI|IV|V|III|II|I|\d+)(?=[A-Za-z])/gi, ' • Sem $1 • ');
        } else {
          text = text.replace(/[- ]*SEM(?:ESTER)?\s*(VIII|VII|VI|IV|V|III|II|I|\d+)\b/gi, ' • Sem $1');
        }
        text = text.replace(/(?:\s*•\s*)+/g, ' • ').trim();
        if (text.startsWith('• ')) text = text.slice(2).trim();
        return `<div class="class-batch-line">${escapeHtml(text)}</div>`;
      });

      return formattedLines.length > 1
        ? `<div class="class-batch-list">${formattedLines.join('')}</div>`
        : (formattedLines[0] || '<span class="class-batch-line">Scheduled Class</span>');
    }

    let currentModalRoomCode = null;

    function openScheduleModal(roomCode, targetDay = null) {
      const room = findRoomByCodeOrName(roomCode);
      if (!room) {
        showToast(`⚠️ Schedule not found for Room: ${escapeHtml(roomCode)}`);
        return;
      }
      currentModalRoomCode = room.code;

      const dayToUse = targetDay || (currentAppMode === 'timetable' ? ttState.day : (facultyState.modalActiveDay || facultyState.activeDay || state.activeDay));
      state.activeDay = dayToUse;

      const sched = room.schedule[dayToUse] || { free_slots: [], occupied_slots: [], lunch_recess_free: true };
      const freeUntil = getRoomFreeUntilStatus(room, dayToUse);

      if (modalRoomTitle) {
        modalRoomTitle.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
            <span>${escapeHtml(room.code)} - ${escapeHtml(room.name)}</span>
            <button type="button" class="btn-share-modal-shortcut" onclick="openShareModal('${escapeHtml(room.code)}')" style="font-size: 0.82rem; padding: 6px 12px; border-radius: 8px; background: rgba(37,99,235,0.12); color: var(--primary-accent, #2563eb); border: 1px solid rgba(37,99,235,0.25); cursor: pointer; display: inline-flex; align-items: center; gap: 5px; font-weight: 600;">
              📤 Share Room & QR
            </button>
          </div>
        `;
      }
      if (modalRoomMeta) modalRoomMeta.textContent = `${room.category} · Capacity: ${room.capacity} · Selected Day: ${dayToUse}`;

      // Synchronize modal day tabs
      const modalRoomDayTabs = document.getElementById('modalRoomDayTabs');
      if (modalRoomDayTabs) {
        modalRoomDayTabs.querySelectorAll('.modal-day-tab-btn').forEach(btn => {
          const isActive = (btn.dataset.day === dayToUse);
          btn.classList.toggle('active', isActive);
          btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
      }

      const allSlots = [
        '8:30 AM to 9:30 AM',
        '9:30 AM to 10:30 AM',
        '10:30 AM to 11:30 AM',
        '11:30 AM to 12:30 PM',
        '12:30 PM to 1:30 PM',
        '1:30 PM to 2:00 PM',
        '2:00 PM to 3:00 PM',
        '3:00 PM to 4:00 PM',
        '4:00 PM to 5:00 PM',
        '5:00 PM to 6:00 PM'
      ];

      const todayIso = getTodayIsoDate();
      const activeRoomLocks = getRoomActiveLocks(room.code, todayIso);
      const roomOv = getRoomOverride(room.code);
      const isUnavailable = (roomOv && roomOv.status === 'UNAVAILABLE');
      const modalUnavailableBanner = isUnavailable
        ? `
          <div class="modal-lock-alert" style="background: rgba(220, 38, 38, 0.12); color: #b91c1c; border-color: rgba(220, 38, 38, 0.4); margin-bottom: 12px;">
            <span style="font-size: 1.3rem;">🛠️</span>
            <div style="flex: 1;">
              <strong>TEMPORARILY UNAVAILABLE / UNDER MAINTENANCE</strong>
              <div style="font-size: 0.82rem; margin-top: 3px;">
                ${escapeHtml(roomOv.reason || 'Under Maintenance')}${roomOv.duration ? ` · Expected duration: ${escapeHtml(roomOv.duration)}` : ''}
              </div>
            </div>
          </div>
        `
        : '';

      const modalLocksBanner = activeRoomLocks.length > 0
        ? activeRoomLocks.map(l => {
            const isExtra = l.type === 'extra_class';
            const icon = isExtra ? '📚' : '🔒';
            const isFullDay = l.slot === 'ALL_DAY';
            const label = isExtra ? 'EXTRA CLASS SCHEDULED' : (isFullDay ? 'ROOM FULL DAY LOCKED' : 'ROOM PERIOD LOCKED');
            const slotText = isFullDay ? 'Full Day (8:30 AM – 6:00 PM)' : l.slot.replace(' to ', ' – ');
            return `
              <div class="modal-lock-alert" style="${isExtra ? 'background: rgba(37, 99, 235, 0.1); color: #1d4ed8; border-color: rgba(37, 99, 235, 0.4);' : ''}">
                <span style="font-size: 1.15rem;">${icon}</span>
                <div style="flex: 1;">
                  <strong>${label}:</strong> ${escapeHtml(slotText)}${l.title ? ` – "${escapeHtml(l.title)}"` : ''}
                  <div style="font-size: 0.74rem; opacity: 0.85; margin-top: 2px;">Reserved by Administration${l.added_by ? ` (By ${escapeHtml(l.added_by)})` : ''}</div>
                </div>
              </div>
            `;
          }).join('')
        : '';

      // 1. Desktop Table Rows (> 640px)
      const tableRows = allSlots.map((timeSlot) => {
        const slotFormatted = timeSlot.replace(' to ', ' – ');
        if (timeSlot === '1:30 PM to 2:00 PM') {
          return `
            <tr>
              <td style="white-space: nowrap;"><strong>1:30 PM – 2:00 PM</strong></td>
              <td style="white-space: nowrap;"><span class="badge-slot-recess">☕ LUNCH RECESS</span></td>
              <td>College-wide recess. Room is vacant & open for peer discussions.</td>
            </tr>
          `;
        }

        const lock = activeRoomLocks.find(l => l.slot === 'ALL_DAY' || l.slot === timeSlot);
        if (lock) {
          const isExtra = lock.type === 'extra_class';
          const lockIcon = isExtra ? '📚' : '🔒';
          const lockBadge = isExtra ? 'EXTRA CLASS' : 'ROOM LOCKED';
          const badgeBg = isExtra ? 'background: #2563eb; color: #fff;' : 'background: #dc2626; color: #fff; border: 1px solid #b91c1c;';
          return `
            <tr style="background: ${isExtra ? 'rgba(37, 99, 235, 0.08)' : 'rgba(239, 68, 68, 0.08)'};">
              <td style="white-space: nowrap;"><strong>${slotFormatted}</strong></td>
              <td style="white-space: nowrap;"><span class="badge-slot-occupied" style="${badgeBg}">${lockIcon} ${lockBadge}</span></td>
              <td>
                <strong style="${isExtra ? 'color: #1d4ed8;' : 'color: #dc2626;'}">${isExtra ? 'Extra Class Scheduled' : 'Classroom Reserved / Locked'}:</strong> ${escapeHtml(lock.title || 'Administrative arrangement')}
                <div style="font-size: 0.74rem; color: var(--text-muted); margin-top: 2px;">Classroom is reserved and not available for self-study during this period.</div>
              </td>
            </tr>
          `;
        }

        const isFree = sched.free_slots.includes(timeSlot);
        const occupiedObj = sched.occupied_slots.find(o => o.slot === timeSlot);
        const leaveInfo = getRoomScheduledTeacherLeave(room.code, state.activeDay, timeSlot);
        const matchedTeachers = getRoomScheduledClassDetails(room.code, state.activeDay, timeSlot);

        if (leaveInfo) {
          const teach = leaveInfo.teacher;
          return `
            <tr style="background: rgba(168, 85, 247, 0.08);">
              <td style="white-space: nowrap;"><strong>${slotFormatted}</strong></td>
              <td style="white-space: nowrap;"><span class="badge-slot-leave">✨ BONUS FREE (LEAVE)</span></td>
              <td>
                <div class="room-sched-details-wrap">
                  <div>
                    <strong style="color: #6d28d9;">Class Cancelled:</strong> Prof. <strong>${escapeHtml(teach.clean_name)}</strong> (${escapeHtml(teach.short_code || '')}) is on leave. Classroom is vacant for self-study!
                  </div>
                  <div class="room-sched-teacher-row">
                    <div class="rs-teacher-chip">
                      <span class="rs-teacher-avatar">${escapeHtml(teach.initials || teach.clean_name.slice(0, 2).toUpperCase())}</span>
                      <span class="rs-teacher-name">Prof. <strong>${escapeHtml(teach.clean_name)}</strong></span>
                      <span class="rs-dept-badge">${escapeHtml(teach.department || 'Faculty')}</span>
                    </div>
                    <button type="button" class="btn-room-view-teacher-tt" data-teacher-id="${escapeHtml(teach.id)}">
                      🗓️ View Teacher Timetable ↗
                    </button>
                  </div>
                </div>
              </td>
            </tr>
          `;
        } else if (isFree) {
          return `
            <tr>
              <td style="white-space: nowrap;"><strong>${slotFormatted}</strong></td>
              <td style="white-space: nowrap;"><span class="badge-slot-free">FREE FOR GD</span></td>
              <td style="color: #15803d; font-weight: 600;">Vacant Classroom (Available for Study/GD)</td>
            </tr>
          `;
        } else {
          // Class in Session
          const classDesc = occupiedObj ? occupiedObj.class : 'Scheduled Class';
          let detailsHtml = '';

          if (matchedTeachers.length > 0) {
            detailsHtml = matchedTeachers.map(m => {
              const teach = m.teacher;
              const cls = m.classInfo;
              const courseStr = cls.course ? `${cls.course}` : 'B.Com (Hons)';
              const semStr = cls.semester ? `(${cls.semester})` : '';
              const secBatchStr = [cls.section, cls.batch ? `Batch ${cls.batch}` : ''].filter(Boolean).join(' · ');

              return `
                <div class="room-sched-details-wrap" style="margin-bottom: 6px;">
                  <div class="room-sched-meta-line">
                    <span class="subject-pill" style="cursor: default;">
                      <strong class="subj-code-badge">${escapeHtml(m.subjectCode)}</strong>
                      <span class="subj-name-text">${escapeHtml(m.subjectFullName)}</span>
                    </span>
                    <span class="class-sem-badge">${escapeHtml(courseStr)} ${escapeHtml(semStr)}</span>
                    ${secBatchStr ? `<span class="class-sec-badge">${escapeHtml(secBatchStr)}</span>` : ''}
                  </div>
                  <div class="room-sched-teacher-row">
                    <div class="rs-teacher-chip">
                      <span class="rs-teacher-avatar">${escapeHtml(teach.initials || teach.clean_name.slice(0, 2).toUpperCase())}</span>
                      <span class="rs-teacher-name">Prof. <strong>${escapeHtml(teach.clean_name)}</strong> ${teach.short_code ? `(${escapeHtml(teach.short_code)})` : ''}</span>
                      <span class="rs-dept-badge">${escapeHtml(teach.department || 'Faculty')}</span>
                    </div>
                    <button type="button" class="btn-room-view-teacher-tt" data-teacher-id="${escapeHtml(teach.id)}">
                      🗓️ View Teacher Timetable ↗
                    </button>
                  </div>
                </div>
              `;
            }).join('');
          } else {
            detailsHtml = formatClassDetails(classDesc);
          }

          return `
            <tr>
              <td style="white-space: nowrap;"><strong>${slotFormatted}</strong></td>
              <td style="white-space: nowrap;"><span class="badge-slot-occupied">CLASS IN SESSION</span></td>
              <td>${detailsHtml}</td>
            </tr>
          `;
        }
      }).join('');

      // 2. Mobile Cards (<= 640px)
      const mobileCards = allSlots.map((timeSlot) => {
        const slotFormatted = timeSlot.replace(' to ', ' – ');
        if (timeSlot === '1:30 PM to 2:00 PM') {
          return `
            <div class="room-sched-mobile-card is-recess">
              <div class="rsm-header">
                <div class="rsm-time">🕒 ${slotFormatted}</div>
                <span class="badge-slot-recess">☕ LUNCH RECESS</span>
              </div>
              <div class="rsm-body-text">College-wide recess. Room is vacant & open for peer discussions.</div>
            </div>
          `;
        }

        const lock = activeRoomLocks.find(l => l.slot === 'ALL_DAY' || l.slot === timeSlot);
        if (lock) {
          const isExtra = lock.type === 'extra_class';
          const lockIcon = isExtra ? '📚' : '🔒';
          const lockBadge = isExtra ? 'EXTRA CLASS' : 'ROOM LOCKED';
          const badgeBg = isExtra ? 'background: #2563eb; color: #fff;' : 'background: #dc2626; color: #fff; border: 1px solid #b91c1c;';
          return `
            <div class="room-sched-mobile-card is-locked" style="${isExtra ? 'border-left-color: #2563eb;' : ''}">
              <div class="rsm-header">
                <div class="rsm-time">🕒 ${slotFormatted}</div>
                <span class="badge-slot-occupied" style="${badgeBg}">${lockIcon} ${lockBadge}</span>
              </div>
              <div class="rsm-body-text">
                <strong style="${isExtra ? 'color: #1d4ed8;' : 'color: #dc2626;'}">${isExtra ? 'Extra Class Scheduled' : 'Classroom Reserved / Locked'}:</strong> ${escapeHtml(lock.title || 'Administrative arrangement')}
                <div style="font-size: 0.74rem; color: var(--text-muted); margin-top: 3px;">Classroom is reserved and not available for self-study during this period.</div>
              </div>
            </div>
          `;
        }

        const isFree = sched.free_slots.includes(timeSlot);
        const occupiedObj = sched.occupied_slots.find(o => o.slot === timeSlot);
        const leaveInfo = getRoomScheduledTeacherLeave(room.code, state.activeDay, timeSlot);
        const matchedTeachers = getRoomScheduledClassDetails(room.code, state.activeDay, timeSlot);

        if (leaveInfo) {
          const teach = leaveInfo.teacher;
          return `
            <div class="room-sched-mobile-card is-leave">
              <div class="rsm-header">
                <div class="rsm-time">🕒 ${slotFormatted}</div>
                <span class="badge-slot-leave">✨ BONUS FREE (LEAVE)</span>
              </div>
              <div class="rsm-body-text">
                <div style="margin-bottom: 6px;"><strong style="color: #6d28d9;">Class Cancelled:</strong> Prof. <strong>${escapeHtml(teach.clean_name)}</strong> is on leave. Room is open for self-study!</div>
                <div class="room-sched-teacher-row">
                  <div class="rs-teacher-chip">
                    <span class="rs-teacher-avatar">${escapeHtml(teach.initials || teach.clean_name.slice(0, 2).toUpperCase())}</span>
                    <span class="rs-teacher-name">Prof. <strong>${escapeHtml(teach.clean_name)}</strong></span>
                    <span class="rs-dept-badge">${escapeHtml(teach.department || 'Faculty')}</span>
                  </div>
                  <button type="button" class="btn-room-view-teacher-tt" data-teacher-id="${escapeHtml(teach.id)}">
                    🗓️ View Teacher Timetable ↗
                  </button>
                </div>
              </div>
            </div>
          `;
        } else if (isFree) {
          return `
            <div class="room-sched-mobile-card is-free">
              <div class="rsm-header">
                <div class="rsm-time">🕒 ${slotFormatted}</div>
                <span class="badge-slot-free">FREE FOR GD</span>
              </div>
              <div class="rsm-free-badge-wrap">
                <span style="font-size: 1.1rem;">✨</span>
                <div>
                  <strong style="color: #047857; font-size: 0.88rem;">Vacant Classroom</strong>
                  <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 1px;">Available for Group Discussions (GD), self-study & peer work.</div>
                </div>
              </div>
            </div>
          `;
        } else {
          // Class in Session
          const classDesc = occupiedObj ? occupiedObj.class : 'Scheduled Class';
          let innerContent = '';

          if (matchedTeachers.length > 0) {
            innerContent = matchedTeachers.map(m => {
              const teach = m.teacher;
              const cls = m.classInfo;
              const courseStr = cls.course ? `${cls.course}` : 'B.Com (Hons)';
              const semStr = cls.semester ? `(${cls.semester})` : '';
              const secBatchStr = [cls.section, cls.batch ? `Batch ${cls.batch}` : ''].filter(Boolean).join(' · ');

              return `
                <div class="room-sched-details-wrap" style="margin-bottom: 6px;">
                  <div class="room-sched-meta-line">
                    <span class="subject-pill" style="cursor: default;">
                      <strong class="subj-code-badge">${escapeHtml(m.subjectCode)}</strong>
                      <span class="subj-name-text">${escapeHtml(m.subjectFullName)}</span>
                    </span>
                    <span class="class-sem-badge">${escapeHtml(courseStr)} ${escapeHtml(semStr)}</span>
                    ${secBatchStr ? `<span class="class-sec-badge">${escapeHtml(secBatchStr)}</span>` : ''}
                  </div>
                  <div class="room-sched-teacher-row">
                    <div class="rs-teacher-chip">
                      <span class="rs-teacher-avatar">${escapeHtml(teach.initials || teach.clean_name.slice(0, 2).toUpperCase())}</span>
                      <span class="rs-teacher-name">Prof. <strong>${escapeHtml(teach.clean_name)}</strong> ${teach.short_code ? `(${escapeHtml(teach.short_code)})` : ''}</span>
                      <span class="rs-dept-badge">${escapeHtml(teach.department || 'Faculty')}</span>
                    </div>
                    <button type="button" class="btn-room-view-teacher-tt" data-teacher-id="${escapeHtml(teach.id)}">
                      🗓️ View Teacher Timetable ↗
                    </button>
                  </div>
                </div>
              `;
            }).join('');
          } else {
            innerContent = formatClassDetails(classDesc);
          }

          return `
            <div class="room-sched-mobile-card is-occupied">
              <div class="rsm-header">
                <div class="rsm-time">🕒 ${slotFormatted}</div>
                <span class="badge-slot-occupied">CLASS IN SESSION</span>
              </div>
              <div class="rsm-body-content">
                ${innerContent}
              </div>
            </div>
          `;
        }
      }).join('');

      if (modalBody) {
        modalBody.innerHTML = `
          ${freeUntil.calloutHtml}
          ${modalUnavailableBanner}
          ${modalLocksBanner}
          <!-- Desktop Table (visible > 640px) -->
          <table class="schedule-table room-schedule-desktop-table">
            <thead>
              <tr>
                <th style="width: 22%;">Period / Time</th>
                <th style="width: 22%;">Status</th>
                <th style="width: 56%;">Class Details / Availability</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          <!-- Mobile Cards (visible <= 640px) -->
          <div class="room-schedule-mobile-cards">
            ${mobileCards}
          </div>

          <p class="modal-disclaimer-note">ℹ️ <strong>Timetable Vacancy Notice:</strong> Based on official SRCC published schedule. Physical vacancy may vary for student societies, seminars, or exam arrangements.</p>
        `;

        // Attach listeners for jumping directly to teacher timetables
        modalBody.querySelectorAll('.btn-room-view-teacher-tt').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            openTeacherModal(btn.dataset.teacherId, state.activeDay);
          });
        });
      }

      if (scheduleModal) openAppModal(scheduleModal);
    }

    // Expose globally for quick modal inspection across views
    window.openScheduleModal = openScheduleModal;

    // Day selector tabs inside Room Schedule Modal
    const modalRoomDayTabs = document.getElementById('modalRoomDayTabs');
    if (modalRoomDayTabs) {
      modalRoomDayTabs.querySelectorAll('.modal-day-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          if (currentModalRoomCode) {
            openScheduleModal(currentModalRoomCode, btn.dataset.day);
          }
        });
      });
    }

    // ========================================================================
    // 👨‍🏫 FACULTY LOCATOR - CORE IMPLEMENTATION
    // ========================================================================
    function getDeptAvatarClass(dept) {
      if (!dept) return 'avatar-default';
      const d = dept.toLowerCase();
      if (d.includes('commerce')) return 'avatar-commerce';
      if (d.includes('economics')) return 'avatar-economics';
      if (d.includes('math')) return 'avatar-maths';
      if (d.includes('english')) return 'avatar-english';
      if (d.includes('political') || d.includes('pol')) return 'avatar-polsc';
      if (d.includes('physical') || d.includes('sport')) return 'avatar-phyed';
      if (d.includes('evs') || d.includes('environmental')) return 'avatar-evs';
      if (d.includes('hindi')) return 'avatar-hindi';
      return 'avatar-default';
    }

    function getDeptTagClass(dept) {
      if (!dept) return '';
      const d = dept.toLowerCase();
      if (d.includes('commerce')) return 'dept-tag-commerce';
      if (d.includes('economics')) return 'dept-tag-economics';
      if (d.includes('math')) return 'dept-tag-maths';
      if (d.includes('english')) return 'dept-tag-english';
      if (d.includes('political') || d.includes('pol')) return 'dept-tag-polsc';
      if (d.includes('physical') || d.includes('sport')) return 'dept-tag-phyed';
      if (d.includes('evs') || d.includes('environmental')) return 'dept-tag-evs';
      if (d.includes('hindi')) return 'dept-tag-hindi';
      return '';
    }

    // Department Filter: Mobile Quick Select Dropdown Sync
    if (facultyDeptSelect) {
      facultyDeptSelect.addEventListener('change', (e) => {
        facultyState.activeDept = e.target.value;
        facultyDeptPills.forEach(p => p.classList.toggle('active', p.dataset.dept === facultyState.activeDept));

        // Smooth scroll matching pill into view in horizontal container
        const activePill = Array.from(facultyDeptPills).find(p => p.dataset.dept === facultyState.activeDept);
        if (activePill && typeof activePill.scrollIntoView === 'function') {
          activePill.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }

        // Clear leftover status filter (like ON_LEAVE or TEACHING_NOW) and search query
        facultyState.statusFilter = 'ALL';
        if (facultyStatusSelect) facultyStatusSelect.value = 'ALL';
        facultyState.searchQuery = '';
        if (facultySearchInput) facultySearchInput.value = '';
        if (btnClearFacultySearch) btnClearFacultySearch.style.display = 'none';
        if (statFacultyFilterDesc) statFacultyFilterDesc.innerHTML = '';

        renderFaculty();
      });
    }

    // Department Filter Pills (Resets statusFilter & search query so all teachers of selected dept are shown!)
    facultyDeptPills.forEach(pill => {
      pill.addEventListener('click', () => {
        facultyState.activeDept = pill.dataset.dept;
        facultyDeptPills.forEach(p => p.classList.toggle('active', p.dataset.dept === facultyState.activeDept));
        if (facultyDeptSelect) facultyDeptSelect.value = facultyState.activeDept;

        // Clear leftover status filter (like ON_LEAVE or TEACHING_NOW) and search query
        facultyState.statusFilter = 'ALL';
        if (facultyStatusSelect) facultyStatusSelect.value = 'ALL';
        facultyState.searchQuery = '';
        if (facultySearchInput) facultySearchInput.value = '';
        if (btnClearFacultySearch) btnClearFacultySearch.style.display = 'none';
        if (statFacultyFilterDesc) statFacultyFilterDesc.innerHTML = '';

        renderFaculty();
      });
    });

    // Faculty Search
    if (facultySearchInput) {
      facultySearchInput.addEventListener('input', (e) => {
        facultyState.searchQuery = e.target.value.trim();
        if (btnClearFacultySearch) {
          btnClearFacultySearch.style.display = facultyState.searchQuery ? 'block' : 'none';
        }
        renderFaculty();
      });
    }

    if (btnClearFacultySearch && facultySearchInput) {
      btnClearFacultySearch.addEventListener('click', () => {
        facultySearchInput.value = '';
        facultyState.searchQuery = '';
        btnClearFacultySearch.style.display = 'none';
        facultySearchInput.focus();
        renderFaculty();
      });
    }

    if (facultyStatusSelect) {
      facultyStatusSelect.addEventListener('change', (e) => {
        facultyState.statusFilter = e.target.value;
        renderFaculty();
      });
    }

    if (facultySortSelect) {
      facultySortSelect.addEventListener('change', (e) => {
        facultyState.sortBy = e.target.value;
        renderFaculty();
      });
    }

    if (btnResetFacultyFilters) {
      btnResetFacultyFilters.addEventListener('click', () => {
        facultyState.activeDept = 'ALL';
        facultyState.searchQuery = '';
        facultyState.statusFilter = 'ALL';
        facultyState.sortBy = 'NAME_ASC';

        facultyDeptPills.forEach(p => p.classList.toggle('active', p.dataset.dept === 'ALL'));
        if (facultyDeptSelect) facultyDeptSelect.value = 'ALL';
        if (facultySearchInput) facultySearchInput.value = '';
        if (btnClearFacultySearch) btnClearFacultySearch.style.display = 'none';
        if (facultyStatusSelect) facultyStatusSelect.value = 'ALL';
        if (facultySortSelect) facultySortSelect.value = 'NAME_ASC';

        facultyState.alphabetFilter = 'ALL';
        document.querySelectorAll('#facultyAzFilter .az-btn').forEach(b => b.classList.toggle('active', b.dataset.letter === 'ALL'));

        renderFaculty();
      });
    }

    // Faculty A-Z Alphabet Quick Jump Buttons
    const facultyAzButtons = document.querySelectorAll('#facultyAzFilter .az-btn');
    if (facultyAzButtons.length > 0) {
      facultyAzButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          facultyState.alphabetFilter = btn.dataset.letter || 'ALL';
          facultyAzButtons.forEach(b => b.classList.toggle('active', b === btn));
          renderFaculty();
        });
      });
    }

    // Calculate Teacher Live Status on Current Day
    function getTeacherLiveStatus(teacher) {
      const todayDate = getTodayIsoDate();
      const leave = isTeacherOnLeave(teacher, todayDate);

      if (leave) {
        const dateDisplay = formatLeaveDateRangeDdMmYyyy(leave.start_date, leave.end_date);
        return {
          type: 'LEAVE',
          badgeClass: 'status-leave',
          dotClass: 'dot-leave',
          text: `🏖️ On Leave: ${leave.reason || 'Class Cancelled'} (${dateDisplay})`,
          isTeachingNow: false,
          isOnLeave: true,
          isFreeNow: false,
          currentClass: null
        };
      }

      // Check live slot status if active day matches current day
      const daySched = (teacher.schedule && teacher.schedule[facultyState.activeDay]) || [];
      const isToday = (todayName === facultyState.activeDay);

      if (!isToday) {
        return {
          type: 'SCHEDULE_VIEW',
          badgeClass: 'status-offhours',
          dotClass: 'dot-off',
          text: `🗓️ ${daySched.length} Lecture(s) Scheduled on ${facultyState.activeDay}`,
          isTeachingNow: false,
          isOnLeave: false,
          isFreeNow: false,
          currentClass: null
        };
      }

      if (state.currentLiveSlot === '1:30 PM to 2:00 PM') {
        return {
          type: 'RECESS',
          badgeClass: 'status-recess',
          dotClass: 'dot-free',
          text: `☕ College Lunch Recess (1:30 PM – 2:00 PM)`,
          isTeachingNow: false,
          isOnLeave: false,
          isFreeNow: true,
          currentClass: null
        };
      }

      if (state.currentLiveSlot) {
        const liveClass = daySched.find(c => c.slot === state.currentLiveSlot);
        if (liveClass) {
          return {
            type: 'TEACHING_NOW',
            badgeClass: 'status-teaching',
            dotClass: 'dot-teaching',
            text: `⚡ Teaching in Room ${liveClass.room || 'Classroom'} (${liveClass.subject || liveClass.course || 'Lecture'})`,
            isTeachingNow: true,
            isOnLeave: false,
            isFreeNow: false,
            currentClass: liveClass
          };
        } else {
          return {
            type: 'FREE_NOW',
            badgeClass: 'status-free',
            dotClass: 'dot-free',
            text: `☕ Currently Free / Doubt Hour (No class this period)`,
            isTeachingNow: false,
            isOnLeave: false,
            isFreeNow: true,
            currentClass: null
          };
        }
      }

      return {
        type: 'OFFHOURS',
        badgeClass: 'status-offhours',
        dotClass: 'dot-off',
        text: `🕒 Off-Hours (${daySched.length} Lecture(s) Today)`,
        isTeachingNow: false,
        isOnLeave: false,
        isFreeNow: false,
        currentClass: null
      };
    }

    // Helper to safely get official display short code (hiding internal cg16, eg22, mg1, etc.)
    function getDisplayShortCode(teacher) {
      if (!teacher) return '';
      const code = (teacher.short_code || '').trim();
      if (!code) return '';
      // Hide internal placeholder codes like cg16, eg22, mg1, hg4, etc.
      if (/^(cg|eg|mg|hg|hgc)\d*$/i.test(code)) return '';
      return code;
    }

    // Active Leaves Callout Banner Renderer (Syncs across Rooms and Faculty Locator)
    function renderActiveLeavesBanners() {
      const todayDate = getTodayIsoDate();
      const activeToday = getActiveTodayLeaves(todayDate);
      const count = activeToday.length;

      const buildBannerHtml = (context) => {
        if (count === 0) return '';
        const profWord = count === 1 ? 'Professor is' : 'Professors are';
        return `
          <div class="active-leaves-strip" role="button" tabindex="0" title="Click to view absent faculty & suspended classes">
            <span class="leaves-strip-badge">🏖️ FACULTY ON LEAVE</span>
            <span class="leaves-strip-text">
              <strong>${count} ${profWord} on leave today</strong> • <span class="leaves-strip-cta">Click here to view &rarr;</span>
            </span>
          </div>
        `;
      };

      if (activeLeavesRoomBanner) {
        if (count > 0) {
          activeLeavesRoomBanner.innerHTML = buildBannerHtml('rooms');
          activeLeavesRoomBanner.style.display = 'flex';
          activeLeavesRoomBanner.onclick = openFacultyLeavesView;
        } else {
          activeLeavesRoomBanner.style.display = 'none';
        }
      }

      if (activeLeavesFacultyBanner) {
        if (count > 0) {
          activeLeavesFacultyBanner.innerHTML = buildBannerHtml('faculty');
          activeLeavesFacultyBanner.style.display = 'flex';
          activeLeavesFacultyBanner.onclick = openFacultyLeavesView;
        } else {
          activeLeavesFacultyBanner.style.display = 'none';
        }
      }

      if (headerLeavePill) {
        if (count > 0) {
          headerLeavePill.textContent = `${count} on leave • View`;
          headerLeavePill.style.display = 'inline-block';
          headerLeavePill.onclick = openFacultyLeavesView;
        } else {
          headerLeavePill.style.display = 'none';
        }
      }

      // Quick Access Button on Rooms page
      const btnRoomsFacultyLeavesQuick = document.getElementById('btnRoomsFacultyLeavesQuick');
      const roomsQuickLeaveCount = document.getElementById('roomsQuickLeaveCount');
      if (btnRoomsFacultyLeavesQuick) {
        btnRoomsFacultyLeavesQuick.onclick = openFacultyLeavesView;
      }
      if (roomsQuickLeaveCount) {
        roomsQuickLeaveCount.textContent = count > 0
          ? `${count} on leave`
          : '0 on leave';
        roomsQuickLeaveCount.style.background = count > 0 ? '#E11D48' : 'rgba(255, 255, 255, 0.15)';
      }

      // Metric Tile in Faculty Locator ("On Leave Today")
      const metricFacultyOnLeaveTile = document.getElementById('metricFacultyOnLeaveTile');
      if (metricFacultyOnLeaveTile) {
        metricFacultyOnLeaveTile.onclick = openFacultyLeavesView;
      }
    }

    // Helper: Strip leading titles (Dr., Dr, Prof., Prof, Mr., Ms., Mrs., CA, CMA) for alphabetical sorting & filtering
    function getTeacherBaseName(teacher) {
      const raw = (teacher.clean_name || teacher.label || '').trim();
      return raw.replace(/^(?:(?:dr|prof|mr|ms|mrs|ca|cma)\.?\s+)/i, '').trim();
    }

    // Helper: Normalize name and query for phonetic search (e.g. sefali <-> shefali)
    function normalizeFacultySearchText(str) {
      return (str || '').toLowerCase()
        .replace(/^(?:(?:dr|prof|mr|ms|mrs|ca|cma)\.?\s+)/i, '')
        .replace(/sh/g, 's')
        .replace(/[\.\s\-_]/g, '')
        .trim();
    }

    function matchesFacultySearch(teacher, rawQuery) {
      if (!rawQuery) return true;
      const q = rawQuery.trim().toLowerCase();
      if (!q) return true;

      const name = (teacher.clean_name || '').toLowerCase();
      const label = (teacher.label || '').toLowerCase();
      const code = (teacher.short_code || '').toLowerCase();
      const refCode = (teacher.ref_code || '').toLowerCase();
      const dept = (teacher.department || '').toLowerCase();

      // Direct case-insensitive match on name, label, short code, ref code, department
      if (name.includes(q) || label.includes(q) || code.includes(q) || refCode.includes(q) || dept.includes(q)) return true;

      // Phonetic / spelling variant matching (e.g. "sefali" matches "Dr. Shefali Kapoor")
      const normQ = normalizeFacultySearchText(q);
      if (normQ.length > 0) {
        const normName = normalizeFacultySearchText(teacher.clean_name);
        const normLabel = normalizeFacultySearchText(teacher.label);
        if (normName.includes(normQ) || normLabel.includes(normQ)) return true;
      }

      // Check subjects array (e.g. FMI, CLAW, BLAW, IF, etc.)
      if (Array.isArray(teacher.subjects)) {
        for (const sub of teacher.subjects) {
          if (sub.toLowerCase().includes(q)) return true;
        }
      }

      // Check inside schedule for room or subject match
      const sched = teacher.schedule ? teacher.schedule[facultyState.activeDay] : [];
      if (Array.isArray(sched)) {
        for (const cls of sched) {
          if ((cls.room || '').toLowerCase().includes(q)) return true;
          if ((cls.subject || '').toLowerCase().includes(q)) return true;
          if ((cls.course || '').toLowerCase().includes(q)) return true;
          if ((cls.section || '').toLowerCase().includes(q)) return true;
          if ((cls.batch || '').toLowerCase().includes(q)) return true;
          if ((cls.raw || '').toLowerCase().includes(q)) return true;
        }
      }
      return false;
    }

    // ========================================================================
    // 🎨 RENDER FACULTY LOCATOR VIEW
    // ========================================================================
    function renderFaculty() {
      renderActiveLeavesBanners();

      if (!teachersData || !teachersData.teachers) {
        if (facultyGrid) facultyGrid.innerHTML = '<div class="empty-state"><h3>Loading Faculty Data...</h3></div>';
        return;
      }

      if (statFacultyDay) statFacultyDay.textContent = facultyState.activeDay;

      // View toggle buttons active state
      if (btnFacultyViewGrid) btnFacultyViewGrid.classList.toggle('active', facultyState.viewMode === 'grid');
      if (btnFacultyViewCompact) btnFacultyViewCompact.classList.toggle('active', facultyState.viewMode === 'compact');
      if (facultyGrid) {
        facultyGrid.className = facultyState.viewMode === 'compact' ? 'faculty-grid view-mode-compact' : 'faculty-grid';
      }

      let list = teachersData.teachers.filter(teacher => {
        // Department filter
        if (facultyState.activeDept !== 'ALL') {
          if ((teacher.department || '').toLowerCase() !== facultyState.activeDept.toLowerCase()) {
            return false;
          }
        }

        // Alphabet Filter (Skips 'Dr.' / 'Prof.' titles)
        if (facultyState.alphabetFilter && facultyState.alphabetFilter !== 'ALL') {
          const baseName = getTeacherBaseName(teacher);
          if (!baseName.toUpperCase().startsWith(facultyState.alphabetFilter.toUpperCase())) {
            return false;
          }
        }

        // Search Query
        if (facultyState.searchQuery && !matchesFacultySearch(teacher, facultyState.searchQuery)) {
          return false;
        }

        // Live Status Filter
        const status = getTeacherLiveStatus(teacher);
        if (facultyState.statusFilter === 'TEACHING_NOW' && !status.isTeachingNow) return false;
        if (facultyState.statusFilter === 'FREE_NOW' && !status.isFreeNow) return false;
        if (facultyState.statusFilter === 'ON_LEAVE' && !status.isOnLeave) return false;

        return true;
      });

      // Sorting (Considers base name without Dr./Prof. titles)
      list.sort((a, b) => {
        const daySchedA = (a.schedule && a.schedule[facultyState.activeDay]) ? a.schedule[facultyState.activeDay].length : 0;
        const daySchedB = (b.schedule && b.schedule[facultyState.activeDay]) ? b.schedule[facultyState.activeDay].length : 0;
        const baseA = getTeacherBaseName(a);
        const baseB = getTeacherBaseName(b);

        if (facultyState.sortBy === 'NAME_ASC') {
          // If search query is active, rank prefix matches first
          if (facultyState.searchQuery && facultyState.searchQuery.trim().length > 0) {
            const normQ = normalizeFacultySearchText(facultyState.searchQuery.trim());
            const normBaseA = normalizeFacultySearchText(baseA);
            const normBaseB = normalizeFacultySearchText(baseB);
            const aStarts = normBaseA.startsWith(normQ);
            const bStarts = normBaseB.startsWith(normQ);
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;
          }
          return baseA.localeCompare(baseB);
        } else if (facultyState.sortBy === 'NAME_DESC') {
          return baseB.localeCompare(baseA);
        } else if (facultyState.sortBy === 'CLASSES_DESC') {
          if (daySchedB !== daySchedA) return daySchedB - daySchedA;
          return baseA.localeCompare(baseB);
        } else if (facultyState.sortBy === 'DEPT_ASC') {
          const deptComp = (a.department || '').localeCompare(b.department || '');
          if (deptComp !== 0) return deptComp;
          return baseA.localeCompare(baseB);
        }
        return 0;
      });

      // Update Counts
      const allTeachers = teachersData.teachers;
      let teachingCount = 0;
      let freeCount = 0;
      let leaveCount = 0;

      allTeachers.forEach(t => {
        const st = getTeacherLiveStatus(t);
        if (st.isTeachingNow) teachingCount++;
        if (st.isFreeNow) freeCount++;
        if (st.isOnLeave) leaveCount++;
      });

      if (metricTotalFacultyCount) metricTotalFacultyCount.textContent = allTeachers.length;
      if (metricFacultyTeachingNow) metricFacultyTeachingNow.textContent = state.currentLiveSlot ? `${teachingCount} Faculty` : 'Off-Hours';
      if (metricFacultyFreeNow) metricFacultyFreeNow.textContent = state.currentLiveSlot ? `${freeCount} Faculty` : 'Off-Hours';
      if (metricFacultyOnLeave) metricFacultyOnLeave.textContent = leaveCount;

      if (headerLeavePill) {
        if (leaveCount > 0) {
          headerLeavePill.textContent = `${leaveCount} on leave • View`;
          headerLeavePill.style.display = 'inline-block';
          headerLeavePill.onclick = openFacultyLeavesView;
        } else {
          headerLeavePill.style.display = 'none';
        }
      }

      if (statFacultyCount) statFacultyCount.textContent = list.length;

      // Filter Desc & Active Chips
      const descParts = [];
      if (facultyState.activeDept !== 'ALL') descParts.push(`Dept: ${facultyState.activeDept}`);
      if (facultyState.statusFilter !== 'ALL') {
        const opt = facultyStatusSelect ? facultyStatusSelect.options[facultyStatusSelect.selectedIndex].text : '';
        descParts.push(opt);
      }

      if (statFacultyFilterDesc) {
        if (facultyState.searchQuery) {
          statFacultyFilterDesc.innerHTML = `
            <span class="active-filter-chip" id="btnQuickClearSubjectChip" title="Click to clear filter & show all faculty">
              <span>Filter: <strong>${escapeHtml(facultyState.searchQuery)}</strong></span>
              <span class="chip-clear-x">✕ Clear</span>
            </span>
          `;
          const quickChip = document.getElementById('btnQuickClearSubjectChip');
          if (quickChip) {
            quickChip.onclick = (e) => {
              e.stopPropagation();
              facultyState.searchQuery = '';
              if (facultySearchInput) facultySearchInput.value = '';
              if (btnClearFacultySearch) btnClearFacultySearch.style.display = 'none';
              renderFaculty();
              showToast('🔄 Filter cleared: showing all faculty');
            };
          }
        } else if (descParts.length) {
          statFacultyFilterDesc.innerHTML = `• ${escapeHtml(descParts.join(', '))}`;
        } else {
          statFacultyFilterDesc.innerHTML = '';
        }
      }

      if (list.length === 0) {
        if (facultyGrid) facultyGrid.innerHTML = '';
        if (facultyEmptyState) {
          facultyEmptyState.style.display = 'block';
          const h3 = facultyEmptyState.querySelector('h3');
          const p = facultyEmptyState.querySelector('p');
          if (facultyState.statusFilter === 'ON_LEAVE') {
            if (h3) h3.textContent = `No professors currently marked on leave${facultyState.searchQuery ? ` matching "${facultyState.searchQuery}"` : ''}`;
            if (p) p.textContent = `No leaves recorded for ${facultyState.activeDay}. Click "Faculty Leave Manager" above to record a professor's absence!`;
          } else {
            if (h3) h3.textContent = `No matching faculty found${facultyState.searchQuery ? ` for "${facultyState.searchQuery}"` : ''}`;
            if (p) p.textContent = 'Try clearing search query, changing department filter, or resetting live status.';
          }
          let emptyResetBtn = facultyEmptyState.querySelector('#btnEmptyFacultyReset');
          if (!emptyResetBtn) {
            emptyResetBtn = document.createElement('button');
            emptyResetBtn.id = 'btnEmptyFacultyReset';
            emptyResetBtn.className = 'btn-reset-filters';
            emptyResetBtn.style.marginTop = '14px';
            emptyResetBtn.textContent = '🔄 Clear Filters & Show All Faculty';
            facultyEmptyState.appendChild(emptyResetBtn);
          }
          emptyResetBtn.onclick = () => {
            facultyState.activeDept = 'ALL';
            facultyState.searchQuery = '';
            facultyState.statusFilter = 'ALL';
            facultyDeptPills.forEach(p => p.classList.toggle('active', p.dataset.dept === 'ALL'));
            if (facultyDeptSelect) facultyDeptSelect.value = 'ALL';
            if (facultySearchInput) facultySearchInput.value = '';
            if (btnClearFacultySearch) btnClearFacultySearch.style.display = 'none';
            if (facultyStatusSelect) facultyStatusSelect.value = 'ALL';
            renderFaculty();
            showToast('🔄 All faculty filters reset');
          };
        }
        return;
      }
      if (facultyEmptyState) facultyEmptyState.style.display = 'none';

      // Render Cards
      facultyGrid.innerHTML = list.map(teacher => {
        const deptAvatarCls = getDeptAvatarClass(teacher.department);
        const deptTagCls = getDeptTagClass(teacher.department);
        const initials = teacher.initials || teacher.clean_name.slice(0, 2).toUpperCase();
        const status = getTeacherLiveStatus(teacher);
        const displayCode = getDisplayShortCode(teacher);

        const daySched = (teacher.schedule && teacher.schedule[facultyState.activeDay]) || [];

        // Subject Badges with Clean Separation, Code Badges, and Active Highlight
        const cleanSubjects = getTeacherCleanSubjects(teacher);
        const subjectsHtml = cleanSubjects.length > 0
          ? `<div class="faculty-subjects-row">
              <span class="subjects-label">📚 Subjects:</span>
              <div class="faculty-subjects-list">
                ${cleanSubjects.map(s => {
                  const isCodeActive = Boolean(facultyState.searchQuery && s.code && facultyState.searchQuery.toLowerCase() === s.code.toLowerCase());
                  const isNameActive = Boolean(facultyState.searchQuery && s.fullName && facultyState.searchQuery.toLowerCase() === s.fullName.toLowerCase());
                  const isActive = isCodeActive || isNameActive;
                  const filterVal = s.code || s.fullName;
                  return `
                    <span class="subject-pill ${isActive ? 'active-filter' : ''}" data-subject="${escapeHtml(filterVal)}" title="${isActive ? 'Click to clear filter' : 'Filter by ' + escapeHtml(s.fullName)}">
                      ${s.code ? `<strong class="subj-code-badge">${escapeHtml(s.code)}</strong>` : ''}
                      <span class="subj-name-text">${escapeHtml(s.fullName)}</span>
                      ${isActive ? '<span class="subj-clear-icon">✕</span>' : ''}
                    </span>
                  `;
                }).join('')}
              </div>
            </div>`
          : '';

        const cardExtraCls = status.isOnLeave ? 'is-on-leave' : (status.isTeachingNow ? 'is-teaching-now' : '');

        // COMPACT VIEW
        if (facultyState.viewMode === 'compact') {
          return `
            <article class="faculty-compact-card ${cardExtraCls}" data-teacher-id="${teacher.id}">
              <div class="faculty-compact-avatar-wrap">
                <div class="faculty-compact-avatar ${deptAvatarCls}">
                  ${initials}
                </div>
                <span class="avatar-status-dot ${status.dotClass}" title="${status.text}"></span>
              </div>

              <div class="faculty-compact-info">
                <div class="faculty-compact-title-row">
                  <span class="faculty-compact-name">${escapeHtml(teacher.clean_name)}</span>
                  ${displayCode ? `<span class="faculty-code-tag">${displayCode}</span>` : ''}
                  <span class="dept-badge ${deptTagCls}">${teacher.department || 'Faculty'}</span>
                </div>
                <div class="faculty-compact-meta">
                  <span>${daySched.length} classes on ${facultyState.activeDay} (${teacher.total_teaching_periods || 0} periods/wk)</span>
                  ${subjectsHtml}
                </div>
              </div>

              <div class="faculty-compact-status">
                <div class="faculty-live-status-strip ${status.badgeClass}" style="margin: 0; padding: 4px 8px; font-size: 0.74rem;">
                  <span>${status.text}</span>
                </div>
              </div>

              <div class="faculty-compact-actions">
                <button class="btn-teacher-timetable" data-teacher-id="${teacher.id}" title="Full Weekly Schedule">
                  🗓️ Timetable
                </button>
              </div>
            </article>
          `;
        }

        // GRID VIEW
        let classesListHtml = '';
        if (daySched.length === 0) {
          classesListHtml = `<div class="faculty-class-item" style="color: var(--text-muted); justify-content: center; font-style: italic;">No scheduled lectures on ${facultyState.activeDay}</div>`;
        } else {
          classesListHtml = daySched.map(cls => {
            const isLiveNow = (cls.slot === state.currentLiveSlot && todayName === facultyState.activeDay);
            const liveClassAttr = isLiveNow ? 'is-current-class' : '';
            const roomCode = cls.room ? cls.room.trim() : 'TBD';
            const subjCode = cls.subject || '';
            const sem = cls.semester || '';
            const sec = cls.section || '';
            const batch = cls.batch || '';

            return `
              <div class="faculty-class-item ${liveClassAttr}">
                <div class="faculty-class-left">
                  <span class="faculty-class-time">${cls.slot.replace(' to ', ' – ')}</span>
                  <span class="faculty-class-details">
                    ${subjCode ? `<strong>${escapeHtml(subjCode)}</strong> · ` : ''}${escapeHtml(cls.course || 'B.Com (Hons)')} ${sem ? `(${escapeHtml(sem)})` : ''}
                    ${(sec || batch) ? `<span style="opacity: 0.8; font-size: 0.7rem; margin-left: 4px;">[${sec ? escapeHtml(sec) : ''}${batch ? ` · ${escapeHtml(batch)}` : ''}]</span>` : ''}
                  </span>
                </div>
                ${roomCode !== 'TBD' ? `
                  <button class="room-badge-link" data-room="${escapeHtml(getTargetRoomJumpCode(roomCode))}" title="Jump to Room ${escapeHtml(getTargetRoomJumpCode(roomCode))} in Free Classroom Finder">
                    🏛️ ${escapeHtml(getDisplayRoomName(roomCode))} ↗
                  </button>
                ` : `<span style="font-size: 0.72rem; color: var(--text-muted);">No Room</span>`}
              </div>
            `;
          }).join('');
        }

        return `
          <article class="faculty-card ${cardExtraCls}" data-teacher-id="${teacher.id}">
            <div>
              <div class="faculty-header-top">
                <div class="faculty-avatar-container">
                  <div class="faculty-initials-avatar ${deptAvatarCls}">
                    ${initials}
                  </div>
                  <span class="avatar-status-dot ${status.dotClass}" title="${status.text}"></span>
                </div>

                <div class="faculty-info-group">
                  <div class="faculty-name-row">
                    <h3 class="faculty-clean-name">${escapeHtml(teacher.clean_name)}</h3>
                    ${displayCode ? `<span class="faculty-code-tag">${displayCode}</span>` : ''}
                  </div>
                  <div class="faculty-meta-row">
                    <span class="dept-badge ${deptTagCls}">${teacher.department || 'Faculty'}</span>
                    <span class="periods-count-badge">${teacher.total_teaching_periods || 0} periods/wk</span>
                  </div>
                </div>
              </div>

              <!-- Subjects Taught Row -->
              ${subjectsHtml}

              <!-- Live Status Strip -->
              <div class="faculty-live-status-strip ${status.badgeClass}">
                <span>${status.text}</span>
              </div>

              <!-- Day Schedule Breakdown -->
              <div class="faculty-day-schedule-wrap">
                <div class="faculty-day-schedule-header">
                  <span>${facultyState.activeDay} Classes (${daySched.length})</span>
                  <span>SRCC Timetable</span>
                </div>
                <div class="faculty-day-classes-list">
                  ${classesListHtml}
                </div>
              </div>
            </div>

            <div class="faculty-card-actions">
              <button class="btn-teacher-timetable" data-teacher-id="${teacher.id}">
                🗓️ Full Weekly Timetable
              </button>
            </div>
          </article>
        `;
      }).join('');

      // Attach Click Handlers
      document.querySelectorAll('.btn-teacher-timetable').forEach(btn => {
        btn.addEventListener('click', () => openTeacherModal(btn.dataset.teacherId));
      });

      // Clicking subject pill filters teacher search (with 1-tap toggle to clear)
      document.querySelectorAll('.subject-pill').forEach(pill => {
        pill.addEventListener('click', (e) => {
          e.stopPropagation();
          const subj = pill.dataset.subject;
          if (!subj) return;

          // If already active, toggle OFF!
          if (facultyState.searchQuery && facultyState.searchQuery.toLowerCase() === subj.toLowerCase()) {
            facultyState.searchQuery = '';
            if (facultySearchInput) facultySearchInput.value = '';
            if (btnClearFacultySearch) btnClearFacultySearch.style.display = 'none';
            renderFaculty();
            showToast('🔄 Filter cleared: showing all faculty');
            return;
          }

          if (facultySearchInput) {
            facultySearchInput.value = subj;
            facultyState.searchQuery = subj;
            if (btnClearFacultySearch) btnClearFacultySearch.style.display = 'block';
            renderFaculty();
            showToast(`📚 Filtered by subject: <strong>${escapeHtml(subj)}</strong> (Tap again or click [✕ Clear] to reset)`);
          }
        });
      });

      // Clicking "Free" status strips on faculty cards jumps straight to free classrooms
      document.querySelectorAll('.faculty-live-status-strip.status-free, .faculty-live-status-strip.status-recess').forEach(strip => {
        strip.style.cursor = 'pointer';
        strip.title = 'Click to view classrooms free right now';
        strip.addEventListener('click', (e) => {
          e.stopPropagation();
          setAppMode('rooms');
          setFreeNowState(true);
        });
      });

      // Clicking room badges on faculty cards directly opens Room Schedule Modal
      document.querySelectorAll('.faculty-card .room-badge-link').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const targetRoom = btn.dataset.room;
          if (targetRoom) {
            openScheduleModal(targetRoom, facultyState.activeDay);
          }
        });
      });
    }

    // ========================================================================
    // 📚 COMPREHENSIVE SRCC & DU SUBJECT ABBREVIATIONS TO FULL NAMES MAP
    // ========================================================================
    const SRCC_SUBJECT_MAP = {
      'BLAW': 'Business Law',
      'FA': 'Financial Accounting',
      'MPA': 'Management Principles & Applications',
      'BECON': 'Business Economics',
      'POM': 'Principles of Marketing',
      'AUD': 'Auditing & Corporate Governance',
      'FMI': 'Financial Markets & Institutions',
      'EOE': 'Principles of Microeconomics',
      'EoE': 'Principles of Microeconomics',
      'EoE1': 'Principles of Microeconomics I',
      'BMATH': 'Business Mathematics',
      'ITLP': 'Income Tax Law & Practice',
      'MA': 'Management Accounting',
      'ED': 'Entrepreneurship Development',
      'MB': 'Money & Banking',
      'FM': 'Financial Management',
      'EVS': 'Environmental Studies',
      'EVS-I': 'Environmental Studies I (Theory into Practice)',
      'EVS-II': 'Environmental Studies II (Theory into Practice)',
      'PME-I': 'Principles of Microeconomics I',
      'PME': 'Principles of Microeconomics',
      'PMEE': 'Principles of Microeconomics',

      'Intro MME': 'Introductory Mathematical Methods for Economics',
      'Adv MME': 'Advanced Mathematical Methods for Economics',
      'IMA I': 'Intermediate Macroeconomics I',
      'IMIC1': 'Intermediate Microeconomics I',
      'ISME': 'Introductory Statistics for Economics',
      'DE': 'Development Economics',
      'EHI': 'Economic History of India',
      'IDE': 'Issues in Development Economics',
      'GT': 'Game Theory',
      'PE': 'Political Economy',
      'PM': 'Project Management',
      'RM': 'Research Methodology',
      'GBS': 'Global Business Strategy',
      'OEM': 'Open Elective Management',
      'AdTrix': 'Advertising & Media Management',
      'IIPT': 'Indian Political Thought',
      'NL': 'Nationalism in India',
      'NII': 'Nationalism & Indian Identity',
      'UIR': 'Understanding International Relations',
      'GIC': 'Global Institutions & Commerce',
      'IGT': 'Interactive Game Theory',
      'IMC': 'Integrated Marketing Communication',
      'IST': 'Information Systems & Technology',
      'RIDL': 'Readings in Indian Democratic Literature',

      'AS': 'Applied Statistics',
      'BIT': 'Business Information Technologies',
      'ITSA I': 'Introduction to Statistics & Analysis I',
      'ITSA II': 'Introduction to Statistics & Analysis II',
      'BIDV': 'Business Intelligence & Data Visualization',
      'BADS': 'Business Analytics & Data Science',
      'BDE': 'Business Data Ecosystem',
      'DEC': 'Digital Economy & E-Commerce',
      'EC': 'E-Commerce',
      'ECom': 'E-Commerce',
      'DA': 'Data Analysis',
      'DM': 'Digital Marketing',
      'DMS': 'Database Management Systems',
      'CAS': 'Cost Accounting System',
      'CFD': 'Corporate Financial Decisions',
      'CFCR': 'Corporate Finance & Restructuring',
      'CIEL': 'Corporate Insolvency & Environmental Law',
      'CPL': 'Corporate Planning & Law',
      'CVFD': 'Corporate Valuation & Financial Decisions',
      'DnD': 'Negotiation & Deal Making',
      'EI': 'Economics of Industry',
      'EP': 'Economic Policy',
      'FC': 'Finance for Everyone',
      'FOC': 'Fundamentals of Computing',
      'FP': 'Financial Planning',
      'PFP': 'Personal Financial Planning',
      'GF': 'Global Finance',
      'IF': 'International Finance',
      'IE': 'International Economics',
      'IBS': 'International Business Strategy',
      'IM': 'International Marketing',
      'ISM': 'Information Systems Management',
      'ITL': 'Income Tax Law',
      'ITPD': 'IT for Professional Development',
      'ME': 'Managerial Economics',
      'MFB': 'Management of Financial Banks',
      'MFD': 'Macro Financial Dynamics',
      'NM': 'Numerical Methods',
      'OB': 'Organizational Behavior',
      'ODI': 'Organizational Dynamics & Intervention',
      'OE': 'Open Elective',
      'OOPUP': 'Programming Using Python',
      'OPUP': 'Programming Using Python',
      'PUP': 'Programming Using Python',
      'OS': 'Operating Systems',
      'PAB': 'Public Administration & Business',
      'PSEL': 'Professional Skills in English Language',
      'PSELL': 'Professional Skills in English Language',
      'RIFE': 'Risk & Insurance in Financial Engineering',
      'SET': 'Statistical Economics & Techniques',
      'SHRM': 'Strategic Human Resource Management',
      'SM': 'Strategic Management',
      'SMM': 'Social Media Marketing',
      'SRG': 'Social Responsibility & Governance',
      'SWR': 'Social Work & Relations',
      'TA': 'Taxation & Accounting',
      'TGNLC': 'The Good, Nature & Local Community',
      'TPF': 'Theory of Public Finance',
      'TR': 'Tax Research',
      'VAC SEL': 'Value Addition Course Elective',
      'VM I': 'Vedic Mathematics I',
      'VM II': 'Vedic Mathematics II',
      'VM III': 'Vedic Mathematics III',
      'WM': 'Wealth Management',
      'BF': 'Banking & Finance',
      'BFIM': 'Banking & Financial Institutions Management',
      'BM': 'Business Management',
      'BRM': 'Business Research Methods',
      'BSC': 'Business Communication',
      'CW': 'Creative Writing',
      'DTHRS': 'Design Thinking & HR Systems',
      'HFPE': 'Health, Fitness & Physical Education',
      'HA': 'Hindi Cinema aur Uska Adhyayan (Hindi A)',
      'HB': 'Hindi Gadhya (Hindi B)',
      'HC': 'Hindi Bhasha aur Sahitya (Hindi C)',
      'HD': 'Hindi Gadhy: Udbhav aur Vikas (Hindi D)',
      'HE': 'Hindi Sahitya (Hindi E)',
      'H B': 'Hindi B',
      'ABH': 'Anuvad: Vyavahar aur Siddhant',
      'ACPA': 'Accounting & Auditing',
      'ACR': 'Academic & Creative Research',
      'AFE': 'Accounting for Financial Entities'
    };

    function getSubjectDetails(code, givenFullName) {
      const cleanCode = (code || '').trim();
      let fullName = (givenFullName || '').trim();
      if (!fullName || fullName.toLowerCase() === cleanCode.toLowerCase()) {
        fullName = SRCC_SUBJECT_MAP[cleanCode] || SRCC_SUBJECT_MAP[cleanCode.toUpperCase()] || cleanCode;
      }
      return {
        code: cleanCode,
        fullName: fullName || cleanCode || 'Subject',
        hasFull: Boolean(fullName && fullName.toLowerCase() !== cleanCode.toLowerCase())
      };
    }

    // Look up teacher(s) and full class details scheduled in a room on a given day & slot
    function getRoomScheduledClassDetails(roomCode, day, slot) {
      if (!teachersData || !teachersData.teachers) return [];
      const targetRoom = (roomCode || '').trim().toUpperCase();
      const targetClean = targetRoom.replace(/\s+/g, '');
      const matches = [];

      for (const t of teachersData.teachers) {
        const daySched = t.schedule ? t.schedule[day] : null;
        if (!daySched || !Array.isArray(daySched)) continue;

        const classItem = daySched.find(c => {
          if (c.slot !== slot) return false;
          const r = (c.room || '').trim().toUpperCase();
          return r === targetRoom || (r.replace(/\s+/g, '') === targetClean);
        });

        if (classItem) {
          const leave = isTeacherOnLeave(t);
          const subjInfo = getSubjectDetails(classItem.subject, classItem.subject_name);
          matches.push({
            teacher: t,
            classInfo: classItem,
            subjectCode: subjInfo.code,
            subjectFullName: subjInfo.fullName,
            isOnLeave: Boolean(leave),
            leaveInfo: leave
          });
        }
      }
      return matches;
    }

    // Extract unique, clean, well-spaced subjects for a faculty member
    function getTeacherCleanSubjects(teacher) {
      if (!teacher) return [];
      const list = [];
      const seenCodes = new Set();
      const seenNames = new Set();

      // 1. Extract from schedule across all days (highest fidelity)
      Object.values(teacher.schedule || {}).flat().forEach(c => {
        let code = (c.subject || '').trim();
        let name = (c.subject_name || '').trim();
        if (!name && code) {
          name = SRCC_SUBJECT_MAP[code] || SRCC_SUBJECT_MAP[code.toUpperCase()] || code;
        }
        if (!code && name) {
          code = name.length <= 8 ? name : '';
        }
        const normCode = code.toUpperCase();
        const normName = name.toLowerCase();

        if ((code && seenCodes.has(normCode)) || (name && seenNames.has(normName))) {
          return;
        }
        if (code) seenCodes.add(normCode);
        if (name) seenNames.add(normName);
        list.push({ code, fullName: name });
      });

      // 2. Supplement from teacher.subjects if any missed
      (teacher.subjects || []).forEach(s => {
        const str = (s || '').trim();
        if (!str) return;
        const norm = str.toLowerCase();
        const normCode = str.toUpperCase();
        if (seenCodes.has(normCode) || seenNames.has(norm)) return;

        if (str.length <= 8 && (SRCC_SUBJECT_MAP[str] || SRCC_SUBJECT_MAP[normCode])) {
          const full = SRCC_SUBJECT_MAP[str] || SRCC_SUBJECT_MAP[normCode];
          seenCodes.add(normCode);
          seenNames.add(full.toLowerCase());
          list.push({ code: str, fullName: full });
        } else {
          seenNames.add(norm);
          list.push({ code: str.length <= 8 ? str : '', fullName: str });
        }
      });

      return list;
    }

    // ========================================================================
    // 📅 TEACHER WEEKLY TIMETABLE MODAL (RESPONSIVE DESKTOP TABLE & MOBILE CARDS)
    // ========================================================================
    function openTeacherModal(teacherIdOrName, targetDay = null) {
      if (!teachersData || !teachersData.teachers) return;
      const query = String(teacherIdOrName || '').trim().toLowerCase();
      if (!query) return;

      const teacher = teachersData.teachers.find(t => 
        String(t.id).toLowerCase() === query ||
        (t.clean_name && t.clean_name.toLowerCase() === query) ||
        (t.name && t.name.toLowerCase() === query) ||
        (t.clean_name && t.clean_name.toLowerCase().includes(query)) ||
        (t.name && t.name.toLowerCase().includes(query))
      );
      if (!teacher) {
        showToast(`Faculty schedule for "${escapeHtml(teacherIdOrName)}" not found.`);
        return;
      }

      facultyState.modalActiveTeacher = teacher;
      facultyState.modalActiveDay = targetDay || facultyState.activeDay || initialDay;

      const initials = teacher.initials || teacher.clean_name.slice(0, 2).toUpperCase();
      const deptAvatarCls = getDeptAvatarClass(teacher.department);
      const displayCode = getDisplayShortCode(teacher);

      if (modalTeacherAvatar) {
        modalTeacherAvatar.className = `faculty-initials-avatar ${deptAvatarCls}`;
        modalTeacherAvatar.textContent = initials;
      }
      if (modalTeacherName) modalTeacherName.textContent = teacher.clean_name;
      if (modalTeacherMeta) {
        const periods = teacher.total_teaching_periods || 0;
        modalTeacherMeta.innerHTML = `
          <div class="teacher-header-chips">
            <span class="th-chip th-dept">🏛️ ${escapeHtml(teacher.department || 'Faculty')}</span>
            ${displayCode ? `<span class="th-chip th-code">🏷️ Code: <strong>${escapeHtml(displayCode)}</strong></span>` : ''}
            <span class="th-chip th-load">📅 <strong>${periods}</strong> Weekly Classes</span>
          </div>
        `;
      }

      renderTeacherModalDaySchedule();
      if (teacherModal) openAppModal(teacherModal);
    }

    // Expose globally for 1-click teacher timetable inspection across all tabs
    window.openTeacherModal = openTeacherModal;

    function renderTeacherModalDaySchedule() {
      const teacher = facultyState.modalActiveTeacher;
      if (!teacher) return;

      modalTeacherDayTabs.forEach(tab => {
        const isActive = tab.dataset.day === facultyState.modalActiveDay;
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      });

      // Auto-scroll the active day tab into view so it is never trapped or off-screen
      setTimeout(() => {
        const activeTab = document.querySelector('#modalTeacherDayTabs .day-btn.active, #modalTeacherDayTabs .modal-day-tab-btn.active');
        if (activeTab && typeof activeTab.scrollIntoView === 'function') {
          activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }, 50);

      const daySched = (teacher.schedule && teacher.schedule[facultyState.modalActiveDay]) || [];
      const roomsToday = [...new Set(daySched.map(c => (c.room ? c.room.trim() : '')).filter(Boolean))];
      const isToday = (facultyState.modalActiveDay === ((typeof getLiveDayName === 'function') ? getLiveDayName() : initialDay));

      const leaveInfo = (leavesData?.leaves || []).find(l => {
        const nameMatch = l.teacher_name && (teacher.clean_name.toLowerCase().includes(l.teacher_name.toLowerCase()) || l.teacher_name.toLowerCase().includes(teacher.clean_name.toLowerCase()));
        const dayMatch = l.day === facultyState.modalActiveDay || !l.day;
        return nameMatch && dayMatch;
      });

      const overviewStripHtml = `
        <div class="teacher-overview-banner">
          <div class="tob-left">
            <span class="tob-day-tag">📅 Schedule for ${escapeHtml(facultyState.modalActiveDay)}${isToday ? ' (Today)' : ''}:</span>
            <span class="tob-count-badge">${daySched.length > 0 ? `<strong>${daySched.length}</strong> scheduled ${daySched.length === 1 ? 'class' : 'classes'}` : 'No scheduled classes'}</span>
          </div>
          <div class="tob-right">
            ${roomsToday.length > 0 ? `<span class="tob-rooms-tag">🏛️ Rooms: <strong>${roomsToday.join(', ')}</strong></span>` : ''}
            ${leaveInfo ? `<span class="badge-leave" style="font-size: 0.76rem; background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; padding: 3px 10px; border-radius: 9999px; font-weight: 700;">🏖️ On Leave Today</span>` : ''}
          </div>
        </div>
      `;

      if (teacher.total_teaching_periods === 0) {
        modalTeacherBody.innerHTML = `
          <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; display: flex; align-items: flex-start; gap: 10px;">
            <span style="font-size: 1.3rem; line-height: 1;">ℹ️</span>
            <div>
              <strong style="color: #b45309; font-size: 0.9rem;">Official SRCC Portal Allocation:</strong>
              <p style="font-size: 0.84rem; color: var(--text-primary); margin: 3px 0 0 0; line-height: 1.4;">
                No teaching lectures are allocated for <strong>${escapeHtml(teacher.clean_name)}</strong> on the official SRCC college timetable portal for this semester (Faculty on study leave, research sabbatical, or administrative assignment).
              </p>
            </div>
          </div>
          <div style="text-align: center; padding: 30px 20px; color: var(--text-muted);">
            <div style="font-size: 2.2rem; margin-bottom: 8px;">☕</div>
            <h4 style="color: var(--text-primary); margin-bottom: 4px; font-size: 1.15rem;">No Classes Scheduled</h4>
            <p style="font-size: 0.88rem;">All weekly periods are free / unallocated on the central timetable system.</p>
          </div>
          <p class="modal-disclaimer-note">ℹ️ <strong>Timetable Notice:</strong> Verified directly against official SRCC timetable portal (<a href="https://srcccollegetimetable.in/" target="_blank" style="color: #2563eb; text-decoration: underline;">srcccollegetimetable.in</a>).</p>
        `;
        return;
      }

      if (daySched.length === 0) {
        modalTeacherBody.innerHTML = `
          ${overviewStripHtml}
          <div style="text-align: center; padding: 35px 20px; color: var(--text-muted);">
            <div style="font-size: 2.2rem; margin-bottom: 8px;">☕</div>
            <h4 style="color: var(--text-primary); margin-bottom: 4px; font-size: 1.15rem;">No Classes on ${escapeHtml(facultyState.modalActiveDay)}</h4>
            <p style="font-size: 0.88rem;">Prof. ${escapeHtml(teacher.clean_name)} has no scheduled lectures or tutorials on this day.</p>
          </div>
          <p class="modal-disclaimer-note">ℹ️ <strong>Timetable Notice:</strong> Schedule reflects official SRCC allocations. Classroom assignments may be adjusted locally by department.</p>
        `;
        return;
      }

      // Merge consecutive classes for cleaner display (e.g. 2:00 PM to 6:00 PM practical blocks)
      const mergedDaySched = [];
      const periodOrder = {
        '8:30 AM to 9:30 AM': 1, '9:30 AM to 10:30 AM': 2, '10:30 AM to 11:30 AM': 3,
        '11:30 AM to 12:30 PM': 4, '1:00 PM to 2:00 PM': 5, '2:00 PM to 3:00 PM': 6,
        '3:00 PM to 4:00 PM': 7, '4:00 PM to 5:00 PM': 8, '5:00 PM to 6:00 PM': 9
      };
      const slotTimes = {
        1: { start: '8:30 AM', end: '9:30 AM' }, 2: { start: '9:30 AM', end: '10:30 AM' },
        3: { start: '10:30 AM', end: '11:30 AM' }, 4: { start: '11:30 AM', end: '12:30 PM' },
        5: { start: '1:00 PM', end: '2:00 PM' }, 6: { start: '2:00 PM', end: '3:00 PM' },
        7: { start: '3:00 PM', end: '4:00 PM' }, 8: { start: '4:00 PM', end: '5:00 PM' },
        9: { start: '5:00 PM', end: '6:00 PM' }
      };

      const sortedSched = [...daySched].sort((a, b) => (periodOrder[a.slot] || 0) - (periodOrder[b.slot] || 0));
      sortedSched.forEach(cls => {
        const pNum = periodOrder[cls.slot] || 0;
        if (mergedDaySched.length > 0) {
          const last = mergedDaySched[mergedDaySched.length - 1];
          const isSameClass = last.subject === cls.subject &&
                              last.batch === cls.batch &&
                              last.room === cls.room &&
                              last.course === cls.course &&
                              last.section === cls.section;
          if (isSameClass && pNum > 0 && last.endPeriodNum + 1 === pNum) {
            last.endPeriodNum = pNum;
            last.periodsCount = (last.periodsCount || 1) + 1;
            last.endSlot = cls.slot;
            return;
          }
        }
        mergedDaySched.push({
          ...cls,
          startPeriodNum: pNum,
          endPeriodNum: pNum,
          periodsCount: 1,
          startSlot: cls.slot,
          endSlot: cls.slot
        });
      });

      // 1. Desktop Table Rows (> 640px)
      const tableRows = mergedDaySched.map(cls => {
        const roomCode = cls.room ? cls.room.trim() : 'TBD';
        const subjInfo = getSubjectDetails(cls.subject, cls.subject_name);
        const subjCode = subjInfo.code;
        const subjFullName = subjInfo.fullName;
        const courseName = cls.course || 'B.Com (Hons)';
        const sem = cls.semester || '';
        const sec = cls.section || '';
        const batch = cls.batch || '';
        const rawBatch = cls.raw_batch || '';

        let slotDisplay = cls.slot ? cls.slot.replace(' to ', ' – ') : 'Period';
        if (cls.periodsCount > 1 && slotTimes[cls.startPeriodNum] && slotTimes[cls.endPeriodNum]) {
          slotDisplay = `Period ${cls.startPeriodNum}–${cls.endPeriodNum} (${slotTimes[cls.startPeriodNum].start} – ${slotTimes[cls.endPeriodNum].end})`;
        }
        let typeDisplay = cls.type || 'Lecture';
        if (cls.periodsCount > 1) {
          typeDisplay = `${cls.type || 'Lecture'} (${cls.periodsCount} Periods)`;
        }

        return `
          <tr>
            <td style="white-space: nowrap;"><strong>${escapeHtml(slotDisplay)}</strong></td>
            <td><span class="badge-slot-occupied">${escapeHtml(typeDisplay)}</span></td>
            <td>
              <div style="margin-bottom: 4px;">
                <strong style="color: var(--text-primary); font-size: 0.88rem; line-height: 1.35; display: block;">${escapeHtml(subjFullName && subjFullName !== subjCode ? subjFullName : courseName)}</strong>
              </div>
              <div style="display: flex; align-items: center; gap: 5px; flex-wrap: nowrap; overflow-x: auto; white-space: nowrap;">
                ${subjCode ? `<span class="subject-pill" title="${escapeHtml(subjFullName)}" style="font-size: 0.72rem; padding: 1.5px 6px; font-weight: 700; flex-shrink: 0;">${escapeHtml(subjCode)}</span>` : ''}
                ${sem ? `<span class="class-batch-badge" style="color: #0284c7; background: rgba(2, 132, 199, 0.08); border-color: rgba(2, 132, 199, 0.25); font-size: 0.72rem; padding: 1.5px 6px; flex-shrink: 0;">${escapeHtml(sem)}</span>` : ''}
                ${sec ? `<span class="class-batch-badge" style="font-size: 0.72rem; padding: 1.5px 6px; flex-shrink: 0;">${escapeHtml(sec)}</span>` : ''}
                ${batch ? `<span class="class-batch-badge" style="color: var(--srcc-gold); border-color: rgba(252, 235, 10, 0.3); font-size: 0.72rem; padding: 1.5px 6px; flex-shrink: 0;">Batch ${escapeHtml(batch)}${rawBatch && rawBatch !== batch ? ` (${escapeHtml(rawBatch)})` : ''}</span>` : ''}
              </div>
            </td>
            <td>
              ${roomCode !== 'TBD' ? `
                <button class="room-badge-link modal-room-jump" data-room="${escapeHtml(getTargetRoomJumpCode(roomCode))}" title="View room vacancy in Free Classroom Finder">
                  🏛️ ${escapeHtml(getDisplayRoomName(roomCode))} ↗
                </button>
              ` : `<span style="color: var(--text-muted); font-size: 0.78rem;">TBD</span>`}
            </td>
          </tr>
        `;
      }).join('');

      // 2. Mobile Schedule Cards (<= 640px)
      const mobileCards = mergedDaySched.map(cls => {
        const roomCode = cls.room ? cls.room.trim() : 'TBD';
        const subjInfo = getSubjectDetails(cls.subject, cls.subject_name);
        const subjCode = subjInfo.code;
        const subjFullName = subjInfo.fullName;
        const courseName = cls.course || 'B.Com (Hons)';
        const sem = cls.semester || '';
        const sec = cls.section || '';
        const batch = cls.batch || '';
        const rawBatch = cls.raw_batch || '';
        const typeCls = (cls.type && cls.type.toLowerCase().includes('tut')) ? 'is-tut' : (cls.type && cls.type.toLowerCase().includes('prac')) ? 'is-prac' : 'is-lec';

        let slotDisplay = cls.slot ? cls.slot.replace(' to ', ' – ') : 'Period';
        if (cls.periodsCount > 1 && slotTimes[cls.startPeriodNum] && slotTimes[cls.endPeriodNum]) {
          slotDisplay = `Period ${cls.startPeriodNum}–${cls.endPeriodNum} (${slotTimes[cls.startPeriodNum].start} – ${slotTimes[cls.endPeriodNum].end})`;
        }
        let typeDisplay = cls.type || 'Lecture';
        if (cls.periodsCount > 1) {
          typeDisplay = `${cls.type || 'Lecture'} (${cls.periodsCount} Periods)`;
        }

        return `
          <div class="modal-timetable-card ${typeCls}">
            <div class="m-tt-header">
              <div class="m-tt-slot">
                <span>🕒</span>
                <span>${escapeHtml(slotDisplay)}</span>
              </div>
              <span class="m-tt-type">${escapeHtml(typeDisplay)}</span>
            </div>
            <div class="m-tt-course-row" style="display: flex; flex-direction: column; align-items: flex-start; gap: 4px; margin-bottom: 6px;">
              <span class="m-tt-coursename" style="font-size: 0.88rem; font-weight: 700; color: var(--text-primary);">${escapeHtml(subjFullName && subjFullName !== subjCode ? subjFullName : courseName)}</span>
              <div style="display: flex; align-items: center; gap: 5px; flex-wrap: nowrap; overflow-x: auto; white-space: nowrap; max-width: 100%;">
                ${subjCode ? `<span class="subject-pill" style="font-size: 0.72rem; padding: 1.5px 6px; font-weight: 700; flex-shrink: 0;" title="${escapeHtml(subjFullName)}">${escapeHtml(subjCode)}</span>` : ''}
                ${sem ? `<span class="class-sem-badge" style="font-size: 0.72rem; padding: 1.5px 6px; flex-shrink: 0;">${escapeHtml(sem)}</span>` : ''}
                ${sec ? `<span class="sec-chip" style="font-size: 0.72rem; padding: 1.5px 6px; flex-shrink: 0;">Sec: <strong>${escapeHtml(sec)}</strong></span>` : ''}
                ${batch ? `<span class="batch-chip" style="font-size: 0.72rem; padding: 1.5px 6px; flex-shrink: 0;">Batch ${escapeHtml(batch)}</span>` : ''}
              </div>
            </div>
            <div class="m-tt-meta-row" style="display: flex; justify-content: flex-end; align-items: center;">
              <div>
                ${roomCode !== 'TBD' ? `
                  <button class="m-tt-room-btn modal-room-jump" data-room="${escapeHtml(getTargetRoomJumpCode(roomCode))}" title="View room in Free Classroom Finder">
                    🏛️ Room ${escapeHtml(getDisplayRoomName(roomCode))} ↗
                  </button>
                ` : `<span style="color: var(--text-muted); font-size: 0.78rem;">Room TBD</span>`}
              </div>
            </div>
          </div>
        `;
      }).join('');

      modalTeacherBody.innerHTML = `
        ${overviewStripHtml}
        <table class="schedule-table modal-timetable-desktop-table">
          <thead>
            <tr>
              <th style="width: 25%;">Time Slot</th>
              <th style="width: 15%;">Type</th>
              <th style="width: 45%;">Subject & Course</th>
              <th style="width: 15%;">Room</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        <div class="modal-timetable-card-list modal-timetable-mobile-cards">
          ${mobileCards}
        </div>
        <p class="modal-disclaimer-note">ℹ️ <strong>Timetable Notice:</strong> Schedule reflects official SRCC allocations. Classroom assignments may be adjusted locally by department.</p>
      `;

      modalTeacherBody.querySelectorAll('.modal-room-jump').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const rCode = btn.dataset.room;
          if (rCode) {
            if (teacherModal) closeAppModal(teacherModal);
            openScheduleModal(rCode, facultyState.modalActiveDay || facultyState.activeDay);
          }
        });
      });
    }

    modalTeacherDayTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        facultyState.modalActiveDay = tab.dataset.day;
        renderTeacherModalDaySchedule();
      });
    });

    // ========================================================================
    // 🏖️ FACULTY LEAVE MANAGER MODAL
    // ========================================================================
    function populateLeaveTeacherSelect() {
      if (!leaveTeacherSelect || !teachersData || !teachersData.teachers) return;
      const sortedTeachers = [...teachersData.teachers].sort((a, b) => a.clean_name.localeCompare(b.clean_name));

      leaveTeacherSelect.innerHTML = `
        <option value="">-- Choose Professor (${sortedTeachers.length}) --</option>
        ${sortedTeachers.map(t => {
          const code = getDisplayShortCode(t);
          return `<option value="${t.id}">${escapeHtml(t.clean_name)}${code ? ' (' + code + ')' : ''} — ${t.department}</option>`;
        }).join('')}
      `;
    }

    function formatLeaveDates(s, e) {
      return formatLeaveDateRangeDdMmYyyy(s, e);
    }

    function getAppPublicUrl() {
      if (typeof window !== 'undefined' && window.location) {
        if (window.location.origin && window.location.origin.includes('github.io')) {
          return 'https://anand-srcc.github.io/srcc-free-classrooms/';
        }
        if (window.location.protocol && window.location.protocol.startsWith('http')) {
          const path = window.location.pathname.replace(/\/(index|admin)\.html$/, '');
          return window.location.origin + path + (path.endsWith('/') ? '' : '/');
        }
      }
      return 'https://anand-srcc.github.io/srcc-free-classrooms/';
    }

    function buildLeavesWhatsAppMessage(leavesList) {
      const today = getTodayIsoDate();
      const activeList = getActiveTodayLeaves(today);

      if (!activeList || activeList.length === 0) {
        return `*SRCC Faculty Leave Update*\nNo professors are currently marked on leave today.\n\n_Check free classrooms:_ ${getAppPublicUrl()}`;
      }
      const lines = activeList.map((l, idx) => {
        const code = l.teacher_code && !/^(cg|eg|mg|hg|hgc)\d*$/i.test(l.teacher_code) ? ` [${l.teacher_code}]` : '';
        const dates = formatLeaveDates(l.start_date, l.end_date);
        return `${idx + 1}. ${l.teacher_name}${code} (${dates})`;
      });

      return `*SRCC Faculty Leave Update (${activeList.length})* 🏖️\n\n${lines.join('\n')}\n\n_Check free classrooms:_ ${getAppPublicUrl()}`;
    }

    function renderActiveLeavesList() {
      if (!leavesListContainer) return;
      const today = getTodayIsoDate();
      const leaves = getActiveTodayLeaves(today);

      if (activeLeavesCount) activeLeavesCount.textContent = leaves.length;
      const roomsQuickLeaveCount = document.getElementById('roomsQuickLeaveCount');
      if (roomsQuickLeaveCount) roomsQuickLeaveCount.textContent = `${leaves.length} on leave`;
      if (headerLeavePill) {
        headerLeavePill.textContent = `${leaves.length} on leave • View`;
        headerLeavePill.style.display = leaves.length > 0 ? 'inline-flex' : 'none';
      }

      if (leaves.length === 0) {
        leavesListContainer.innerHTML = `
          <div class="leaves-empty-msg" style="text-align: center; padding: 24px 16px; color: var(--text-muted); font-size: 0.88rem;">
            No professors are currently marked on leave. All 210 faculty members are on scheduled college duty.
          </div>
        `;
        return;
      }

      const shareSiteUrl = getAppPublicUrl();

      leavesListContainer.innerHTML = leaves.map((leave, idx) => {
        const s = leave.start_date || today;
        const e = leave.end_date || today;
        const isActiveToday = (today >= s && today <= e);
        const code = leave.teacher_code && !/^(cg|eg|mg|hg|hgc)\d*$/i.test(leave.teacher_code) ? ` [${leave.teacher_code}]` : '';
        const dateRangeDisplay = formatLeaveDates(s, e);
        const halfDayBadge = leave.isHalfDay ? `<span style="background: #FEF3C7; color: #92400E; border: 1px solid #FCD34D; font-size: 0.68rem; font-weight: 800; padding: 2px 7px; border-radius: 9999px;">½ DAY</span>` : '';

        const singleLeaveMsg = `*SRCC Faculty Leave Update* 🏖️\n\n1. ${leave.teacher_name}${code} (${dateRangeDisplay})\n\n_Check free classrooms:_ ${shareSiteUrl}`;

        return `
          <div class="leave-item-row" data-leave-id="${leave.id}">
            <span class="leave-item-num">${idx + 1}</span>
            <div class="leave-item-details">
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span class="leave-item-teacher">${escapeHtml(leave.teacher_name)}${code}</span>
                <span class="leave-item-dates">📅 ${dateRangeDisplay}</span>
                ${halfDayBadge}
                ${isActiveToday ? '<span style="background: #FEE2E2; color: #991B1B; border: 1px solid #FCA5A5; font-size: 0.68rem; font-weight: 800; padding: 2px 8px; border-radius: 9999px;">ACTIVE TODAY</span>' : ''}
              </div>
              ${leave.reason ? `<span class="leave-item-reason">"${escapeHtml(leave.reason)}"</span>` : ''}
            </div>
            <div style="display: flex; align-items: center; gap: 6px; margin-left: auto;">
              <a href="https://wa.me/?text=${encodeURIComponent(singleLeaveMsg)}" target="_blank" class="btn-share-wa" title="Share this leave on WhatsApp">
                💬 Share
              </a>
            </div>
          </div>
        `;
      }).join('');
    }

    function openLeaveManagerModal(preselectedTeacherId) {
      populateLeaveTeacherSelect();
      const today = getTodayIsoDate();
      if (leaveStartDate) leaveStartDate.value = today;
      if (leaveEndDate) leaveEndDate.value = today;
      if (leaveReasonInput) leaveReasonInput.value = '';

      if (preselectedTeacherId && leaveTeacherSelect) {
        leaveTeacherSelect.value = preselectedTeacherId;
      }

      renderActiveLeavesList();
      if (leaveManagerModal) leaveManagerModal.style.display = 'flex';
    }

    if (btnOpenLeaveManager) {
      btnOpenLeaveManager.addEventListener('click', () => openLeaveManagerModal());
    }

    if (btnAddLeave) {
      btnAddLeave.addEventListener('click', () => {
        const teacherId = leaveTeacherSelect ? leaveTeacherSelect.value : '';
        if (!teacherId) {
          showToast('⚠️ Please select a professor first');
          return;
        }

        const teacher = teachersData.teachers.find(t => String(t.id) === String(teacherId));
        if (!teacher) return;

        const sDate = leaveStartDate ? leaveStartDate.value : getTodayIsoDate();
        const eDate = leaveEndDate ? leaveEndDate.value : sDate;
        const reason = (leaveReasonInput && leaveReasonInput.value.trim()) || 'Faculty Leave';

        if (eDate < sDate) {
          showToast('⚠️ End date cannot be before start date');
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

        renderActiveLeavesList();
        renderFaculty();
        render();

        showToast(`🏖️ Marked <strong>${escapeHtml(teacher.clean_name)}</strong> on leave! Scheduled rooms are now unlocked.`);
        if (leaveReasonInput) leaveReasonInput.value = '';
      });
    }

    if (btnResetLeaves) {
      btnResetLeaves.addEventListener('click', () => {
        if (confirm('Clear all custom faculty leaves and reset to college default?')) {
          localStorage.removeItem(LEAVES_STORAGE_KEY);
          renderActiveLeavesList();
          renderFaculty();
          render();
          showToast('🔄 Custom faculty leaves cleared.');
        }
      });
    }

    // Leave Sync & Export Handlers
    if (btnDownloadLeavesJs) {
      btnDownloadLeavesJs.addEventListener('click', () => {
        const leaves = getLeavesList();
        const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const content = `// SRCC Official Faculty Leaves Data
// Generated: ${todayStr}
window.SRCC_FACULTY_LEAVES = {
  "last_updated": "${todayStr}",
  "leaves": ${JSON.stringify(leaves, null, 2)}
};
`;
        const blob = new Blob([content], { type: 'application/javascript;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'faculty_leaves.js';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('💾 <strong>faculty_leaves.js downloaded!</strong> Replace this file in your project or Netlify upload to sync for all students.', true, 4000);
      });
    }

    if (btnCopyLeavesJs) {
      btnCopyLeavesJs.addEventListener('click', () => {
        const leaves = getLeavesList();
        const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const content = `window.SRCC_FACULTY_LEAVES = {
  "last_updated": "${todayStr}",
  "leaves": ${JSON.stringify(leaves, null, 2)}
};
`;
        copyToClipboard(content).then(() => {
          btnCopyLeavesJs.textContent = '✅ Copied!';
          showToast('📋 <strong>Leaves code copied to clipboard!</strong> Ready to paste into faculty_leaves.js.', true, 3500);
          setTimeout(() => { btnCopyLeavesJs.textContent = '📋 Copy Code'; }, 2500);
        });
      });
    }

    // Wire Quick Access Faculty Leaves button on Classrooms view
    const btnRoomsFacultyLeavesQuick = document.getElementById('btnRoomsFacultyLeavesQuick');
    if (btnRoomsFacultyLeavesQuick) {
      btnRoomsFacultyLeavesQuick.addEventListener('click', () => {
        openLeaveManagerModal();
      });
    }

    if (headerLeavePill) {
      headerLeavePill.addEventListener('click', () => {
        openLeaveManagerModal();
      });
    }

    const btnShareAllLeavesWhatsApp = document.getElementById('btnShareAllLeavesWhatsApp');
    if (btnShareAllLeavesWhatsApp) {
      btnShareAllLeavesWhatsApp.addEventListener('click', () => {
        const leaves = getLeavesList();
        const msg = buildLeavesWhatsAppMessage(leaves);
        window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
      });
    }

    const btnCloseLeavesModalFooter = document.getElementById('btnCloseLeavesModalFooter');
    if (btnCloseLeavesModalFooter && leaveManagerModal) {
      btnCloseLeavesModalFooter.addEventListener('click', () => closeAppModal(leaveManagerModal));
    }

    // ========================================================================
    // ⚠️ REPORT ISSUE FEATURE
    // ========================================================================
    const btnReportIssue = document.getElementById('btnReportIssue');
    const reportIssueModal = document.getElementById('reportIssueModal');
    const btnCloseReportModal = document.getElementById('btnCloseReportModal');
    const btnCancelReport = document.getElementById('btnCancelReport');
    const btnSubmitReport = document.getElementById('btnSubmitReport');
    
    if (btnReportIssue && reportIssueModal) {
      const openReportModal = () => { openAppModal(reportIssueModal); };
      const closeReportModal = () => { closeAppModal(reportIssueModal); };
      
      btnReportIssue.addEventListener('click', openReportModal);
      if (btnCloseReportModal) btnCloseReportModal.addEventListener('click', closeReportModal);
      if (btnCancelReport) btnCancelReport.addEventListener('click', closeReportModal);
      reportIssueModal.addEventListener('click', (e) => {
        if (e.target === reportIssueModal) closeReportModal();
      });
      
      if (btnSubmitReport) {
        btnSubmitReport.addEventListener('click', async () => {
          const type = document.getElementById('reportIssueType').value;
          const details = document.getElementById('reportIssueDetails').value;
          
          // Close modal immediately so UI doesn't freeze
          closeReportModal();
          document.getElementById('reportIssueDetails').value = '';
          
          showToast('⏳ Submitting your issue...', false, 2000);
          
          const cloudUrl = (window.SRCC_CLOUD_CONFIG && window.SRCC_CLOUD_CONFIG.db_url) || localStorage.getItem('srcc_cloud_db_url') || 'https://srcc-leaves-default-rtdb.firebaseio.com/leaves.json';
          if (cloudUrl) {
            let baseUrl = cloudUrl;
            let authParam = '';
            if (baseUrl.includes('?')) {
              const parts = baseUrl.split('?');
              baseUrl = parts[0];
              authParam = '?' + parts[1];
            }
            if (baseUrl.endsWith('/leaves.json')) baseUrl = baseUrl.substring(0, baseUrl.length - 12);
            
            try {
              // Add a timeout signal to prevent hanging fetch
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 seconds timeout
              
              await fetch(baseUrl + '/issues.json' + authParam, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type,
                  details,
                  timestamp: new Date().toISOString(),
                  userAgent: navigator.userAgent
                }),
                signal: controller.signal
              });
              clearTimeout(timeoutId);
              showToast('✅ Issue reported! Admins will check it shortly.', true, 4000);
            } catch (e) {
              console.error('Issue report error:', e);
              showToast('⚠️ Failed to submit issue. Please try again later.', false, 4000);
            }
          } else {
            // Local fallback
            showToast('✅ Issue reported locally! (Cloud DB not configured)', true, 4000);
          }
        });
      }
    }

    // ========================================================================
    // 🏖️ FACULTY ON LEAVE DIRECTORY VIEW LOGIC
    // ========================================================================
    // ========================================================================
    // 📅 STUDENT TIMETABLE FEATURE - NATIVE APP INTEGRATION
    // ========================================================================
    function initTimetableFeature() {
      const academicPeriods = [
        { slot: "8:30 AM to 9:30 AM", time: "8:30 AM", num: 1 },
        { slot: "9:30 AM to 10:30 AM", time: "9:30 AM", num: 2 },
        { slot: "10:30 AM to 11:30 AM", time: "10:30 AM", num: 3 },
        { slot: "11:30 AM to 12:30 PM", time: "11:30 AM", num: 4 },
        { slot: "12:30 PM to 1:30 PM", time: "12:30 PM", num: 5 },
        { slot: "2:00 PM to 3:00 PM", time: "2:00 PM", num: 6 },
        { slot: "3:00 PM to 4:00 PM", time: "3:00 PM", num: 7 },
        { slot: "4:00 PM to 5:00 PM", time: "4:00 PM", num: 8 },
        { slot: "5:00 PM to 6:00 PM", time: "5:00 PM", num: 9 }
      ];

      // Helpers to detect SEC (Skill Enhancement) and VAC (Value Addition) slots
      function isSecSlot(s) {
        if (!s) return false;
        const batch = (s.batch || '').toUpperCase().trim();
        const raw_batch = (s.raw_batch || '').toUpperCase().trim();
        const subj = (s.subject || '').toUpperCase().trim();
        const subj_name = (s.subject_name || '').toUpperCase().trim();
        const raw = (s.raw || '').toUpperCase().trim();
        const course = (s.course || '').trim();
        const sec = (s.section || '').trim();

        // If explicitly VAC or Value Addition, NEVER classify as SEC
        if (batch.startsWith('VAC') || raw_batch.startsWith('VAC') || /\bVAC\d*|\bVAC-|_VAC|-VAC/.test(raw) || subj_name.includes('VALUE ADDITION')) {
          return false;
        }
        // If AEC (Ability Enhancement - e.g. Hindi), not SEC
        if (/\bAEC\b|-AEC-|\bAEC-/.test(raw) || subj_name.includes('ABILITY ENHANCEMENT')) {
          return false;
        }

        if (batch.startsWith('SEC') || raw_batch.startsWith('SEC')) return true;
        if (/\bSEC\d*|\bSEC-|_SEC|-SEC/.test(raw)) return true;
        if (subj_name.includes('SKILL ENHANCEMENT') || course.toUpperCase() === 'SEC') return true;

        // If explicitly assigned to a regular degree and regular section without SEC in raw/batch, do NOT classify as SEC
        if ((course === 'B.A. (Hons) Economics' || course === 'B.Com (Hons)' || course === 'M.Com') && sec && !(/\bSEC\d*|\bSEC-|_SEC|-SEC/.test(raw))) {
          return false;
        }

        // SMM in M.Com or without SEC tag is not SEC
        if (subj === 'SMM' && (course === 'M.Com' || sec || !(/\bSEC\d*|\bSEC-|_SEC|-SEC/.test(raw)))) {
          return false;
        }

        const secCodes = ['ITSA I', 'ITSA II', 'AS', 'BIDV', 'SRG', 'EP', 'DM', 'IE', 'BIT', 'PFP', 'PSELL', 'PSEL', 'CW', 'CPL', 'SWR', 'SET', 'NL', 'PUP', 'CIEL'];
        return secCodes.includes(subj);
      }

      function isVacSlot(s) {
        if (!s) return false;
        const batch = (s.batch || '').toUpperCase().trim();
        const raw_batch = (s.raw_batch || '').toUpperCase().trim();
        const subj = (s.subject || '').toUpperCase().trim();
        const subj_name = (s.subject_name || '').toUpperCase().trim();
        const raw = (s.raw || '').toUpperCase().trim();
        const course = (s.course || '').trim();
        const sec = (s.section || '').trim();

        // If explicitly SEC or Skill Enhancement, NEVER classify as VAC
        if (batch.startsWith('SEC') || raw_batch.startsWith('SEC') || /\bSEC\d*|\bSEC-|_SEC|-SEC/.test(raw) || subj_name.includes('SKILL ENHANCEMENT')) {
          return false;
        }
        // If AEC (Ability Enhancement - e.g. Hindi), not VAC
        if (/\bAEC\b|-AEC-|\bAEC-/.test(raw) || subj_name.includes('ABILITY ENHANCEMENT')) {
          return false;
        }

        if (batch.startsWith('VAC') || raw_batch.startsWith('VAC')) return true;
        if (/\bVAC\d*|\bVAC-|_VAC|-VAC/.test(raw)) return true;
        if (subj_name.includes('VALUE ADDITION') || course.toUpperCase() === 'VAC') return true;

        // If explicitly assigned to a regular degree and regular section without VAC in raw/batch, do NOT classify as VAC
        if ((course === 'B.A. (Hons) Economics' || course === 'B.Com (Hons)' || course === 'M.Com') && sec && !(/\bVAC\d*|\bVAC-|_VAC|-VAC/.test(raw))) {
          return false;
        }

        // NOTE: DE is Development Economics in BA(H) Economics, NOT VAC!
        const vacCodes = ['EC', 'EI', 'TGNLC', 'VAC SEL', 'CVFD', 'ABH', 'VM I', 'VM II', 'VM III', 'RIFE'];
        return vacCodes.includes(subj);
      }

      function isSecVacSlot(s) {
        if (!s) return false;
        return isSecSlot(s) || isVacSlot(s);
      }

      // Extract Course -> Sem -> Sec -> Batches hierarchy from teachersData
      const courseMap = {};
      const secVacBatchesBySem = {}; // sem -> Set of batches
      const secBatchesBySem = {}; // sem -> Set of batches
      const vacBatchesBySem = {}; // sem -> Set of batches
      const secBatchMeta = {}; // sem -> batch -> { code, name }
      const vacBatchMeta = {}; // sem -> batch -> { code, name }
      const getTeachers = () => (teachersData && teachersData.teachers) ? teachersData.teachers : (window.SRCC_TEACHERS_DATA?.teachers || []);

      // Helper to cleanly extract and pair batches for a section (e.g., J1 / JP1, J2 / JP2, J3 / JP3)
      function getCleanBatchesForSection(rawBatchesSet, secName = '') {
        if (!rawBatchesSet || rawBatchesSet.size === 0) return [];
        const letter = (secName || '').replace(/^Sec\s*/i, '').trim().toUpperCase();

        const atomicTokens = new Set();
        rawBatchesSet.forEach(raw => {
          if (!raw) return;
          String(raw).split(/[\s,]+/).forEach(tok => {
            const t = tok.trim().toUpperCase();
            if (t) atomicTokens.add(t);
          });
        });

        const numSet = new Set();
        const nonNumTokens = [];
        atomicTokens.forEach(tok => {
          const numMatch = tok.match(/\d+/);
          if (numMatch) {
            numSet.add(parseInt(numMatch[0], 10));
          } else {
            nonNumTokens.push(tok);
          }
        });

        const sortedNums = Array.from(numSet).sort((a, b) => a - b);
        const result = [];
        if (sortedNums.length > 0 && letter && letter.length === 1) {
          sortedNums.forEach(num => {
            result.push(`${letter}${num} / ${letter}P${num}`);
          });
        } else if (sortedNums.length > 0) {
          sortedNums.forEach(num => {
            result.push(`Batch ${num}`);
          });
        } else {
          nonNumTokens.sort().forEach(t => result.push(t));
        }
        return result;
      }

      function buildHierarchy() {
        const teachers = getTeachers();
        teachers.forEach(t => {
          if (!t.schedule) return;
          Object.keys(t.schedule).forEach(day => {
            (t.schedule[day] || []).forEach(s => {
              const sem = (s.semester || 'Sem I').trim();
              const batch = (s.batch || s.raw_batch || '').trim();

              const isSec = isSecSlot(s);
              const isVac = isVacSlot(s);
              const isEither = isSec || isVac || isSecVacSlot(s);

              if (isEither) {
                const isRealSec = /^SEC\d+$/i.test(batch);
                const isRealVac = /^VAC\d+$/i.test(batch);

                if (isSec && isRealSec) {
                  if (!secBatchesBySem[sem]) secBatchesBySem[sem] = new Set();
                  secBatchesBySem[sem].add(batch);
                  if (!secBatchMeta[sem]) secBatchMeta[sem] = {};
                  if (!secBatchMeta[sem][batch]) {
                    const details = getSubjectDetails(s.subject, s.subject_name);
                    secBatchMeta[sem][batch] = { code: details.code || s.subject || '', name: details.fullName || s.subject_name || '' };
                  }
                }
                if (isVac && isRealVac) {
                  if (!vacBatchesBySem[sem]) vacBatchesBySem[sem] = new Set();
                  vacBatchesBySem[sem].add(batch);
                  if (!vacBatchMeta[sem]) vacBatchMeta[sem] = {};
                  if (!vacBatchMeta[sem][batch]) {
                    const details = getSubjectDetails(s.subject, s.subject_name);
                    vacBatchMeta[sem][batch] = { code: details.code || s.subject || '', name: details.fullName || s.subject_name || '' };
                  }
                }
                if (isRealSec || isRealVac) {
                  if (!secVacBatchesBySem[sem]) secVacBatchesBySem[sem] = new Set();
                  secVacBatchesBySem[sem].add(batch);
                }
                return;
              }

              let c = (s.course || '').trim();
              const sec = (s.section || '').trim();
              const rawUpper = (s.raw || '').toUpperCase();
              if (!c && (rawUpper.includes('MCOM') || rawUpper.includes('M.COM'))) {
                c = 'M.Com';
              }
              if (!c && (rawUpper.includes('GBO') || (s.subject && s.subject.toUpperCase().includes('GBO')) || (s.subject_name && s.subject_name.toUpperCase().includes('GBO')))) {
                c = 'GBO';
              }

              if (c && sem && sec) {
                if (!courseMap[c]) courseMap[c] = {};
                if (!courseMap[c][sem]) courseMap[c][sem] = {};
                if (!courseMap[c][sem][sec]) courseMap[c][sem][sec] = new Set();
                if (batch) courseMap[c][sem][sec].add(batch);
              }
            });
          });
        });

        // Ensure GBO semesters and default sections exist in courseMap
        if (!courseMap['GBO']) courseMap['GBO'] = {};
        ['Sem I', 'Sem II', 'Sem III', 'Sem IV'].forEach(sem => {
          if (!courseMap['GBO'][sem]) courseMap['GBO'][sem] = {};
          if (!courseMap['GBO'][sem]['Whole Batch']) courseMap['GBO'][sem]['Whole Batch'] = new Set(['ALL']);
          if (!courseMap['GBO'][sem]['Sec A']) courseMap['GBO'][sem]['Sec A'] = new Set(['ALL', 'Batch 1', 'Batch 2']);
        });
      }

      buildHierarchy();

      const validCourses = ['B.A. (Hons) Economics', 'B.Com (Hons)', 'M.Com', 'GBO', 'SEC', 'VAC'];
      let savedCourse = localStorage.getItem('srcc_my_tt_course');
      if (savedCourse === 'SEC_VAC' || savedCourse === 'SEC / VAC') {
        savedCourse = 'SEC';
      }
      let savedSem = localStorage.getItem('srcc_my_tt_sem');
      let savedSec = localStorage.getItem('srcc_my_tt_sec');
      let savedBatch = localStorage.getItem('srcc_my_tt_batch') || 'ALL';

      if (!savedCourse || !validCourses.includes(savedCourse)) {
        savedCourse = 'B.A. (Hons) Economics';
      }
      if (!savedSem) {
        savedSem = 'Sem I';
      }
      if (!savedSec) {
        savedSec = 'Sec A';
      }

      // Live day-wise auto-capture helper based on IST timezone
      function getLiveDayName() {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const istNow = getIstDate();
        const todayName = days[istNow.getDay()];
        return (todayName === 'Sunday') ? 'Monday' : todayName;
      }

      const initialDay = getLiveDayName();

      // Timetable state
      const ttState = {
        day: initialDay,
        course: savedCourse,
        sem: savedSem,
        sec: savedSec,
        batch: savedBatch,
        slot: 'ALL',
        searchQuery: ''
      };

      // --- Main View Elements (#viewTimetableSection) ---
      const ttMainDayButtons = document.querySelectorAll('#ttMainDayPicker .day-btn');
      const ttMainCoursePills = document.querySelectorAll('#ttMainCoursePills .cat-pill');
      const ttMainSemPills = document.querySelectorAll('#ttMainSemPills .cat-pill');
      const ttMainSecSelect = document.getElementById('ttMainSecSelect');
      const ttMainBatchSelect = document.getElementById('ttMainBatchSelect');
      const ttMainSlotSelect = document.getElementById('ttMainSlotSelect');
      const ttMainSearchInput = document.getElementById('ttMainSearchInput');
      const btnClearTtMainSearch = document.getElementById('btnClearTtMainSearch');
      const ttMainScheduleGrid = document.getElementById('ttMainScheduleGrid');
      const ttMainEmptyState = document.getElementById('ttMainEmptyState');
      const btnResetTtFilters = document.getElementById('btnResetTtFilters');

      const ttSavedProfileBar = document.getElementById('ttSavedProfileBar');
      const ttSavedProfileText = document.getElementById('ttSavedProfileText');
      const btnTtQuickReset = document.getElementById('btnTtQuickReset');

      const ttCountClasses = document.getElementById('ttCountClasses');
      const ttCountFreePeriods = document.getElementById('ttCountFreePeriods');
      const ttSelectedSummary = document.getElementById('ttSelectedSummary');
      const ttSelectedBatchSummary = document.getElementById('ttSelectedBatchSummary');
      const ttRibbonCourseSec = document.getElementById('ttRibbonCourseSec');
      const ttRibbonDay = document.getElementById('ttRibbonDay');

      // Silently persist last selected class filters so returning users immediately see their timetable
      function savePreferences() {
        try {
          localStorage.setItem('srcc_my_tt_course', ttState.course);
          localStorage.setItem('srcc_my_tt_sem', ttState.sem);
          localStorage.setItem('srcc_my_tt_sec', ttState.sec);
          localStorage.setItem('srcc_my_tt_batch', ttState.batch);
        } catch (e) {}
      }

      function updateSectionsAndBatches(triggerSave = true) {
        const isSec = (ttState.course === 'SEC');
        const isVac = (ttState.course === 'VAC');
        const isSecVacCourse = isSec || isVac || (ttState.course === 'SEC_VAC') || (ttState.course === 'SEC / VAC');

        // Dynamic label and search placeholder
        const batchSelectLabelEl = document.querySelector('label[for="ttMainBatchSelect"]');
        if (batchSelectLabelEl) {
          batchSelectLabelEl.textContent = isSec ? 'SEC Paper:' : (isVac ? 'VAC Paper:' : 'Batch:');
        }
        if (ttMainSearchInput) {
          if (isSec) {
            ttMainSearchInput.placeholder = 'Search SEC paper (e.g. SEC12, 12, ITSA), faculty, or room...';
          } else if (isVac) {
            ttMainSearchInput.placeholder = 'Search VAC paper (e.g. VAC5, 5, EC), faculty, or room...';
          } else if (ttState.course === 'M.Com') {
            ttMainSearchInput.placeholder = 'Search M.Com paper (e.g. BRM, BADS), professor, batch, or room...';
          } else if (ttState.course === 'GBO') {
            ttMainSearchInput.placeholder = 'Search GBO paper, professor, batch, or room...';
          } else {
            ttMainSearchInput.placeholder = 'Search subject (e.g. MME), teacher, batch, or room...';
          }
        }

        // Semesters adjustments for SEC / VAC or M.Com or GBO
        if (isSecVacCourse) {
          if (ttState.sem === 'Sem VII') {
            ttState.sem = 'Sem I';
          }
        } else if (ttState.course === 'M.Com' || ttState.course === 'GBO') {
          if (ttState.sem === 'Sem V' || ttState.sem === 'Sem VII') {
            ttState.sem = 'Sem I';
          }
        }

        // Section dropdown:
        if (ttMainSecSelect) {
          ttMainSecSelect.innerHTML = '';
          if (isSecVacCourse) {
            const opt = document.createElement('option');
            opt.value = 'Joint';
            opt.textContent = isSec ? 'All SEC Sections (Joint)' : (isVac ? 'All VAC Sections (Joint)' : 'All Sections (Joint)');
            opt.selected = true;
            ttMainSecSelect.appendChild(opt);
            ttState.sec = 'Joint';
          } else {
            // Normal course: B.Com or Economics
            const secs = Object.keys(courseMap[ttState.course]?.[ttState.sem] || {}).sort();
            secs.forEach(s => {
              const opt = document.createElement('option');
              opt.value = s;
              opt.textContent = s;
              if (s === ttState.sec) opt.selected = true;
              ttMainSecSelect.appendChild(opt);
            });
            if (!secs.includes(ttState.sec) && secs.length > 0) {
              ttState.sec = secs[0];
              ttMainSecSelect.value = secs[0];
            }
          }
        }

        // Natural numeric sorting helper
        const sortBatchesNaturally = (arr) => {
          return arr.sort((a, b) => {
            const numA = parseInt(a.replace(/\D+/g, ''), 10) || 0;
            const numB = parseInt(b.replace(/\D+/g, ''), 10) || 0;
            if (numA !== numB) return numA - numB;
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
          });
        };

        // Batch dropdown:
        let batchOptionsHtml = '<option value="ALL">All batches</option>';
        let batches = [];

        if (isSec) {
          const batchSet = secBatchesBySem[ttState.sem] || new Set();
          batches = sortBatchesNaturally(Array.from(batchSet));
          batchOptionsHtml = '<option value="ALL">All SEC Papers / Batches</option>' +
            batches.map(b => {
              const meta = secBatchMeta[ttState.sem]?.[b];
              const desc = meta ? ` — ${meta.code}${meta.name && meta.name !== meta.code ? ` (${meta.name})` : ''}` : '';
              return `<option value="${escapeHtml(b)}">${escapeHtml(b)}${escapeHtml(desc)}</option>`;
            }).join('');
        } else if (isVac) {
          const batchSet = vacBatchesBySem[ttState.sem] || new Set();
          batches = sortBatchesNaturally(Array.from(batchSet));
          batchOptionsHtml = '<option value="ALL">All VAC Papers / Batches</option>' +
            batches.map(b => {
              const meta = vacBatchMeta[ttState.sem]?.[b];
              const desc = meta ? ` — ${meta.code}${meta.name && meta.name !== meta.code ? ` (${meta.name})` : ''}` : '';
              return `<option value="${escapeHtml(b)}">${escapeHtml(b)}${escapeHtml(desc)}</option>`;
            }).join('');
        } else if (isSecVacCourse) {
          const batchSet = secVacBatchesBySem[ttState.sem] || new Set();
          batches = sortBatchesNaturally(Array.from(batchSet));
          batchOptionsHtml = '<option value="ALL">All SEC & VAC batches</option>' +
            batches.map(b => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join('');
        } else {
          const batchSet = courseMap[ttState.course]?.[ttState.sem]?.[ttState.sec] || new Set();
          batches = getCleanBatchesForSection(batchSet, ttState.sec);
          batchOptionsHtml += batches.map(b => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join('');
        }

        if (ttMainBatchSelect) {
          ttMainBatchSelect.innerHTML = batchOptionsHtml;
          if (ttState.batch !== 'ALL') {
            const matchingOpt = batches.find(b => b === ttState.batch || b.startsWith(ttState.batch) || b.split(/[\s,\/]+/).includes(ttState.batch));
            if (matchingOpt) {
              ttMainBatchSelect.value = matchingOpt;
              ttState.batch = matchingOpt;
            } else {
              ttMainBatchSelect.value = 'ALL';
              ttState.batch = 'ALL';
            }
          } else {
            ttMainBatchSelect.value = 'ALL';
            ttState.batch = 'ALL';
          }
        }

        if (triggerSave) {
          savePreferences();
        }
      }

      function syncControlPills() {
        const isSecVacCourse = (ttState.course === 'SEC' || ttState.course === 'VAC' || ttState.course === 'SEC_VAC' || ttState.course === 'SEC / VAC');
        ttMainDayButtons.forEach(btn => {
          btn.classList.toggle('active', btn.dataset.day === ttState.day);
        });
        ttMainCoursePills.forEach(pill => {
          const courseVal = pill.dataset.course;
          const isActive = (courseVal === ttState.course);
          pill.classList.toggle('active', isActive);
        });
        ttMainSemPills.forEach(pill => {
          const sem = pill.dataset.sem;
          pill.classList.toggle('active', sem === ttState.sem);
          if (isSecVacCourse) {
            pill.style.display = (sem === 'Sem VII') ? 'none' : '';
          } else if (ttState.course === 'M.Com' || ttState.course === 'GBO') {
            pill.style.display = (sem === 'Sem V' || sem === 'Sem VII') ? 'none' : '';
          } else {
            pill.style.display = '';
          }
        });
        if (ttMainSecSelect) ttMainSecSelect.value = ttState.sec;
        if (ttMainBatchSelect) ttMainBatchSelect.value = ttState.batch;
        if (ttMainSlotSelect) ttMainSlotSelect.value = ttState.slot;
      }

      const academicPeriodsMap = {
        '8:30 AM to 9:30 AM': { num: 1, start: '8:30 AM', end: '9:30 AM' },
        '9:30 AM to 10:30 AM': { num: 2, start: '9:30 AM', end: '10:30 AM' },
        '10:30 AM to 11:30 AM': { num: 3, start: '10:30 AM', end: '11:30 AM' },
        '11:30 AM to 12:30 PM': { num: 4, start: '11:30 AM', end: '12:30 PM' },
        '1:00 PM to 2:00 PM': { num: 5, start: '1:00 PM', end: '2:00 PM' },
        '2:00 PM to 3:00 PM': { num: 6, start: '2:00 PM', end: '3:00 PM' },
        '3:00 PM to 4:00 PM': { num: 7, start: '3:00 PM', end: '4:00 PM' },
        '4:00 PM to 5:00 PM': { num: 8, start: '4:00 PM', end: '5:00 PM' },
        '5:00 PM to 6:00 PM': { num: 9, start: '5:00 PM', end: '6:00 PM' }
      };

      function mergeConsecutiveSessions(rawList) {
        if (!rawList || rawList.length === 0) return [];

        const groups = {};
        rawList.forEach(item => {
          const key = `${item.teacherId || item.teacher}__${item.subject}__${item.batch}__${item.room}`;
          if (!groups[key]) groups[key] = [];
          groups[key].push(item);
        });

        const merged = [];

        Object.values(groups).forEach(items => {
          const byPeriod = {};
          items.forEach(it => {
            if (!byPeriod[it.periodNum]) {
              byPeriod[it.periodNum] = it;
            } else if (it.rawBatch && it.rawBatch !== byPeriod[it.periodNum].rawBatch) {
              byPeriod[it.periodNum].rawBatch = 'Whole Section';
            }
          });

          const uniquePeriods = Object.keys(byPeriod).map(n => parseInt(n, 10)).sort((a, b) => a - b);

          let currentBlock = [];
          uniquePeriods.forEach(pNum => {
            if (currentBlock.length === 0) {
              currentBlock.push(pNum);
            } else {
              const lastP = currentBlock[currentBlock.length - 1];
              if (pNum === lastP + 1) {
                currentBlock.push(pNum);
              } else {
                merged.push(createSessionBlock(currentBlock, byPeriod));
                currentBlock = [pNum];
              }
            }
          });
          if (currentBlock.length > 0) {
            merged.push(createSessionBlock(currentBlock, byPeriod));
          }
        });

        merged.sort((a, b) => a.startPeriod - b.startPeriod || a.subject.localeCompare(b.subject));
        return merged;
      }

      function createSessionBlock(periodNums, periodMap) {
        const startP = periodNums[0];
        const endP = periodNums[periodNums.length - 1];
        const base = periodMap[startP];
        const pCount = periodNums.length;

        const startInfo = academicPeriodsMap[academicPeriods[startP - 1]?.slot] || { start: '8:30 AM' };
        const endInfo = academicPeriodsMap[academicPeriods[endP - 1]?.slot] || { end: '9:30 AM' };
        const slotsCovered = periodNums.map(n => academicPeriods[n - 1]?.slot).filter(Boolean);

        return {
          ...base,
          startPeriod: startP,
          endPeriod: endP,
          periodsCount: pCount,
          startTime: startInfo.start,
          endTime: endInfo.end,
          slotsCovered: slotsCovered,
          isContinuous: pCount > 1
        };
      }

      function getClassesForParameters(targetDay, targetSem, targetCourse, targetBatch, targetSec) {
        const teachers = getTeachers();
        const activeLeaves = (leavesData && Array.isArray(leavesData.leaves)) 
          ? leavesData.leaves 
          : (window.SRCC_FACULTY_LEAVES?.leaves || []);

        const isSecCourse = (targetCourse === 'SEC');
        const isVacCourse = (targetCourse === 'VAC');

        const rawList = [];

        teachers.forEach(t => {
          const tName = t.clean_name || t.label || 'Faculty';
          const daySched = t.schedule?.[targetDay] || [];
          daySched.forEach(s => {
            const isSec = isSecSlot(s);
            const isVac = isVacSlot(s);
            let matchesFilter = false;

            if (isSecCourse) {
              if (isSec && !isVac) {
                const semMatches = !s.semester || s.semester === targetSem || 
                                   (Array.isArray(s.semesters_list) && s.semesters_list.includes(targetSem));
                if (semMatches) matchesFilter = true;
              }
            } else if (isVacCourse) {
              if (isVac && !isSec) {
                const semMatches = !s.semester || s.semester === targetSem || 
                                   (Array.isArray(s.semesters_list) && s.semesters_list.includes(targetSem));
                if (semMatches) matchesFilter = true;
              }
            } else if (targetCourse === 'SEC_VAC' || targetCourse === 'SEC / VAC') {
              if (isSec || isVac) {
                const semMatches = !s.semester || s.semester === targetSem || 
                                   (Array.isArray(s.semesters_list) && s.semesters_list.includes(targetSem));
                if (semMatches) matchesFilter = true;
              }
            } else {
              if (!isSec && !isVac) {
                const sCourse = (s.course || '').trim();
                const rawUpper = (s.raw || '').toUpperCase();
                const isMcom = (targetCourse === 'M.Com') && (sCourse === 'M.Com' || rawUpper.includes('MCOM') || rawUpper.includes('M.COM'));
                const isGbo = (targetCourse === 'GBO') && (sCourse === 'GBO' || rawUpper.includes('GBO') || (s.subject && s.subject.toUpperCase().includes('GBO')) || (s.subject_name && s.subject_name.toUpperCase().includes('GBO')));

                const courseMatches = isMcom || isGbo ||
                                      s.course === targetCourse || 
                                      (Array.isArray(s.courses_list) && s.courses_list.includes(targetCourse)) ||
                                      (s.course && s.course.includes(targetCourse));
                const semMatches = s.semester === targetSem || 
                                   (Array.isArray(s.semesters_list) && s.semesters_list.includes(targetSem));
                const secMatches = (!targetSec || targetSec === 'ALL') ||
                                   s.section === targetSec || 
                                   (Array.isArray(s.sections_list) && s.sections_list.includes(targetSec)) ||
                                   (s.section && s.section.includes(targetSec));

                if (courseMatches && semMatches && secMatches) matchesFilter = true;
              }
            }

            if (matchesFilter) {
              const selBatch = (targetBatch || 'ALL').trim().toUpperCase();
              if (selBatch !== 'ALL') {
                const targetSubBatches = selBatch.split(/[\s,\/]+/).map(x => x.trim().toUpperCase()).filter(Boolean);
                const allBatches = [
                  s.batch,
                  s.raw_batch,
                  ...(s.batches_list || []),
                  ...(s.raw_batches_list || [])
                ].filter(Boolean).map(b => b.toUpperCase().trim());

                if (allBatches.length > 0) {
                  const matches = allBatches.some(b => {
                    const subBatches = b.split(/[\s,\/]+/).map(x => x.trim().toUpperCase()).filter(Boolean);
                    return subBatches.some(tok => {
                      return targetSubBatches.includes(tok) || 
                             targetSubBatches.some(tb => tb.replace(/P(\d+)$/, '$1') === tok.replace(/P(\d+)$/, '$1'));
                    });
                  });
                  if (!matches) return;
                }
              }

              const slotInfo = academicPeriodsMap[s.slot];
              if (!slotInfo) return;

              const subjInfo = getSubjectDetails(s.subject, s.subject_name);
              const leaveRecord = (typeof isTeacherOnLeave === 'function' ? isTeacherOnLeave(t) : null) || activeLeaves.find(l => {
                const nameMatch = l.teacher_name && (tName.toLowerCase().includes(l.teacher_name.toLowerCase()) || l.teacher_name.toLowerCase().includes(tName.toLowerCase()));
                const dayMatch = l.day === targetDay || !l.day;
                return nameMatch && dayMatch;
              });

              rawList.push({
                slot: s.slot,
                periodNum: slotInfo.num,
                subject: subjInfo.code,
                subjectName: subjInfo.fullName,
                type: s.type || 'Lecture',
                batch: s.batch || '',
                rawBatch: s.raw_batch || '',
                teacher: tName,
                teacherId: t.id,
                room: s.room || '',
                isOnLeave: Boolean(leaveRecord),
                isSec: isSec,
                isVac: isVac,
                sem: s.semester || targetSem,
                day: targetDay
              });
            }
          });
        });

        // If GBO is selected, also ingest any GBO occupied slots found in room data
        if (targetCourse === 'GBO' && appData && appData.rooms) {
          appData.rooms.forEach(r => {
            const occSlots = r.schedule?.[targetDay]?.occupied_slots || [];
            occSlots.forEach(occ => {
              const cls = (occ.class || '').toUpperCase();
              if (cls.includes('GBO')) {
                const slotStr = occ.slot || '';
                const pInfo = academicPeriodsMap[slotStr];
                if (pInfo) {
                  const alreadyPresent = rawList.some(item => item.slot === slotStr && item.room === r.code);
                  if (!alreadyPresent) {
                    rawList.push({
                      slot: slotStr,
                      periodNum: pInfo.num,
                      subject: 'GBO Session',
                      subjectName: occ.class || 'Global Business Operations',
                      type: 'Lecture',
                      batch: 'ALL',
                      rawBatch: 'Whole Section',
                      teacher: 'GBO Faculty',
                      teacherId: 'gbo_faculty',
                      room: r.code,
                      isOnLeave: false,
                      isSec: false,
                      isVac: false,
                      sem: targetSem,
                      day: targetDay
                    });
                  }
                }
              }
            });
          });
        }

        return mergeConsecutiveSessions(rawList);
      }

      function matchesSessionSearch(session, rawQuery) {
        if (!rawQuery) return true;
        const q = rawQuery.trim().toLowerCase();
        if (!q) return true;

        const qNorm = q.replace(/[\s\-_]+/g, '');
        const subjCode = (session.subject || '').toLowerCase();
        const subjName = (session.subjectName || '').toLowerCase();
        const type = (session.type || '').toLowerCase();
        const batch = (session.batch || '').toLowerCase();
        const rawBatch = (session.rawBatch || '').toLowerCase();
        const teacher = (session.teacher || '').toLowerCase();
        const room = (session.room || '').toLowerCase();
        const sem = (session.sem || '').toLowerCase();
        const course = (session.course || '').toLowerCase();
        const mcomKeywords = (course.includes('m.com') || (session.raw && session.raw.toUpperCase().includes('MCOM'))) ? 'mcom m.com commerce' : '';
        const combined = `${subjCode} ${subjName} ${type} ${batch} ${rawBatch} ${teacher} ${room} ${sem} ${day} ${course} ${mcomKeywords} ${session.isSec ? 'sec skill enhancement' : ''} ${session.isVac ? 'vac value addition' : ''}`.toLowerCase();
        const combinedNorm = combined.replace(/[\s\-_]+/g, '');

        if (combined.includes(q) || combinedNorm.includes(qNorm)) return true;

        // If query is pure digits (e.g., "12"), check if batch number ends with or equals 12
        if (/^\d+$/.test(q)) {
          const batchDigits = batch.replace(/\D+/g, '');
          if (batchDigits === q) return true;
        }

        // Multi-word matching: all words in query must match
        const words = q.split(/\s+/).filter(Boolean);
        if (words.length > 1 && words.every(w => combined.includes(w) || combinedNorm.includes(w.replace(/[\s\-_]+/g, '')))) {
          return true;
        }

        return false;
      }

      function renderSessionCard(session, isCrossDay = false) {
        const displayBatch = session.rawBatch || session.batch;
        let batchBadge = '';
        if (displayBatch) {
          const bTrimmed = String(displayBatch).trim();
          if (bTrimmed.includes(',') || bTrimmed.toLowerCase() === 'whole section') {
            batchBadge = ' · Whole Section';
          } else if (/^(sec|vac|batch)/i.test(bTrimmed)) {
            batchBadge = ` · ${escapeHtml(bTrimmed)}`;
          } else {
            batchBadge = ` · Batch ${escapeHtml(bTrimmed)}`;
          }
        }

        const secVacBadge = session.isSec 
          ? `<span class="tt-secvac-badge">SEC</span>` 
          : (session.isVac ? `<span class="tt-secvac-badge" style="background: rgba(16, 185, 129, 0.12); color: #059669; border-color: rgba(16, 185, 129, 0.28);">VAC</span>` : '');

        const initials = session.teacher.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'FC';
        const leaveHtml = session.isOnLeave 
          ? `<div class="tt-leave-badge">🏖️ Faculty on Leave Today · Class Suspended</div>` 
          : '';

        const targetRoom = getTargetRoomJumpCode(session.room);
        const displayRoom = getDisplayRoomName(session.room);
        const roomButtonHtml = session.room 
          ? `<button type="button" class="room-badge-link tt-room-btn btn-jump-room" data-room="${escapeHtml(targetRoom)}" title="Click to view room in campus room finder">🏛️ ${escapeHtml(displayRoom)} <span class="tt-room-arrow">↗</span></button>` 
          : `<span style="font-size: 0.8rem; color: var(--text-muted);">Room TBD</span>`;

        const leaveCardCls = session.isOnLeave ? ' is-faculty-leave' : '';
        const displaySubject = session.subjectName || session.subject || 'Subject';
        const showCodeBadge = Boolean(session.subject && session.subject.toLowerCase() !== displaySubject.toLowerCase());

        let courseMetaText = ttState.course;
        let secMetaText = ttState.sec;
        if (session.isSec || session.isVac) {
          courseMetaText = session.isSec ? 'SEC' : 'VAC';
          secMetaText = 'Joint';
        }

        const periodBadgeText = (session.periodsCount > 1)
          ? `🕒 Period ${session.startPeriod}–${session.endPeriod} · ${session.startTime} – ${session.endTime}`
          : `🕒 Period ${session.startPeriod} · ${session.startTime}`;

        const durationPill = (session.periodsCount > 1)
          ? `<span class="tt-block-duration-pill">${session.periodsCount} Periods (${session.periodsCount} Hrs)</span>`
          : '';

        const dayTagHtml = isCrossDay ? `<span class="tt-day-tag">📅 ${escapeHtml(session.day)}</span>` : '';

        return `
          <article class="tt-card${leaveCardCls}" data-slot="${escapeHtml(session.slot || '')}">
            <div class="tt-card-header">
              <span class="tt-period-badge">${dayTagHtml}${periodBadgeText}</span>
              <div class="tt-card-badges">
                ${secVacBadge}
                ${durationPill}
                <span class="tt-type-pill">${escapeHtml(session.type)}${batchBadge}</span>
              </div>
            </div>
            <div class="tt-card-subject">
              <span>${escapeHtml(displaySubject)}</span>
              ${showCodeBadge ? `<span class="tt-subj-code-pill">${escapeHtml(session.subject)}</span>` : ''}
            </div>
            <div class="tt-card-meta">
              <span>${escapeHtml(courseMetaText)}</span> •
              <span>${escapeHtml(session.sem || ttState.sem)}</span> •
              <span>${escapeHtml(secMetaText)}</span>
            </div>
            <div class="tt-card-faculty">
              <div class="tt-faculty-info btn-view-teacher-today" data-teacher-id="${escapeHtml(session.teacherId || '')}" data-teacher-name="${escapeHtml(session.teacher)}" role="button" tabindex="0" title="Click to view full timetable for ${escapeHtml(session.teacher)}">
                <div class="tt-faculty-avatar">${initials}</div>
                <div class="tt-faculty-name-wrap">
                  <span class="tt-faculty-name">${escapeHtml(session.teacher)}</span>
                  <span class="tt-faculty-link-badge" title="Click to view faculty schedule">📅</span>
                </div>
              </div>
              ${roomButtonHtml}
            </div>
            ${leaveHtml}
          </article>
        `;
      }

      // 📢 Render Timetable Specific Notices & Rescheduling Banners
      function renderTimetableNotices() {
        const container = document.getElementById('timetableNoticesContainer');
        if (!container) return;

        const notices = window.SRCC_CAMPUS_NOTICES || campusNoticesList || [];
        const todayIso = getTodayIsoDate();
        const ttNotices = notices.filter(n => {
          if (!n || !n.title) return false;
          if (n.category !== 'timetable_change' && !n.title.toLowerCase().includes('timetable') && !n.title.toLowerCase().includes('rescheduled')) return false;
          if (n.expiry_date && todayIso > n.expiry_date) return false;
          return true;
        });

        if (ttNotices.length === 0) {
          container.style.display = 'none';
          container.innerHTML = '';
          return;
        }

        container.innerHTML = ttNotices.map(n => `
          <div class="timetable-notice-alert-banner">
            <div class="tt-notice-header">
              <span class="tt-notice-badge">⚠️ Timetable Notice</span>
              ${n.event_date ? `<span style="font-size: 0.78rem; font-weight:700; color:#b45309;">🗓️ ${escapeHtml(n.event_date)}</span>` : ''}
              ${n.expiry_date ? `<span style="font-size: 0.72rem; color:#92400e;">Valid till: ${formatIsoToDdMmYyyy(n.expiry_date)}</span>` : ''}
            </div>
            <h4 class="tt-notice-title">${escapeHtml(n.title)}</h4>
            ${n.body ? `<p class="tt-notice-body">${escapeHtml(n.body)}</p>` : ''}
          </div>
        `).join('');
        container.style.display = 'block';
      }

      // --- Render Native Full View Section (#viewTimetableSection) ---
      function renderMainTimetableView() {
        if (!viewTimetableSection) return;

        renderTimetableNotices();
        syncControlPills();
        const mergedToday = getClassesForParameters(ttState.day, ttState.sem, ttState.course, ttState.batch, ttState.sec);
        const filterQuery = (ttState.searchQuery || '').trim().toLowerCase();
        const isSecCourse = (ttState.course === 'SEC');
        const isVacCourse = (ttState.course === 'VAC');
        const isSecVacMode = isSecCourse || isVacCourse || (ttState.course === 'SEC_VAC') || (ttState.course === 'SEC / VAC');

        if (btnClearTtMainSearch) {
          btnClearTtMainSearch.style.display = filterQuery ? 'block' : 'none';
        }

        let visibleSessions = mergedToday;

        // Slot filter (ALL or specific period)
        if (ttState.slot !== 'ALL') {
          visibleSessions = visibleSessions.filter(s => s.slotsCovered && s.slotsCovered.includes(ttState.slot));
        }

        // Search query filtering
        let matchedTodaySessions = visibleSessions;
        if (filterQuery) {
          matchedTodaySessions = visibleSessions.filter(s => matchesSessionSearch(s, filterQuery));
        }

        let cardsHtml = '';
        let matchCount = matchedTodaySessions.length;
        let isCrossDaySearch = false;
        let otherDayMatches = [];
        let matchedOtherDayName = '';

        if (matchCount > 0) {
          // Render today's matches
          cardsHtml = matchedTodaySessions.map(s => renderSessionCard(s, false)).join('');
        } else if (filterQuery) {
          // If no matches found on current day, perform cross-day search across all other days
          const allDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          for (const d of allDays) {
            if (d === ttState.day) continue;
            const sessionsOnDay = getClassesForParameters(d, ttState.sem, ttState.course, ttState.batch, ttState.sec);
            const matchesOnDay = sessionsOnDay.filter(s => matchesSessionSearch(s, filterQuery));
            if (matchesOnDay.length > 0) {
              otherDayMatches.push(...matchesOnDay);
              if (!matchedOtherDayName) matchedOtherDayName = d;
            }
          }

          if (otherDayMatches.length > 0) {
            isCrossDaySearch = true;
            matchCount = otherDayMatches.length;
            cardsHtml = `
              <div class="tt-search-other-days-banner" style="grid-column: 1 / -1;">
                <div class="tt-srb-left">
                  <span style="font-size: 1.3rem;">📅</span>
                  <div class="tt-srb-text">
                    Found <strong>${otherDayMatches.length}</strong> matching ${isSecVacMode ? (isSecCourse ? 'SEC' : 'VAC') : ''} classes on <strong>${escapeHtml(matchedOtherDayName)}</strong> for "<strong>${escapeHtml(filterQuery)}</strong>"
                  </div>
                </div>
                <button class="btn-jump-day-pill btn-switch-day-quick" data-day="${escapeHtml(matchedOtherDayName)}">Switch to ${escapeHtml(matchedOtherDayName)}</button>
              </div>
            ` + otherDayMatches.map(s => renderSessionCard(s, true)).join('');
          }
        }

        // Update Stat tiles
        if (ttCountClasses) ttCountClasses.textContent = mergedToday.length;
        if (ttSelectedSummary) {
          if (ttState.course === 'SEC') {
            ttSelectedSummary.textContent = `SEC · ${ttState.sem}`;
          } else if (ttState.course === 'VAC') {
            ttSelectedSummary.textContent = `VAC · ${ttState.sem}`;
          } else if (isSecVacMode) {
            ttSelectedSummary.textContent = `SEC / VAC · ${ttState.sem}`;
          } else {
            const shortCourse = ttState.course === 'M.Com' ? 'M.Com' : (ttState.course.includes('Economics') ? 'Economics' : 'B.Com (Hons)');
            ttSelectedSummary.textContent = `${shortCourse} · ${ttState.sem}`;
          }
        }
        if (ttSelectedBatchSummary) {
          const batchLabel = ttState.batch === 'ALL' ? 'All batches' : `Batch ${ttState.batch}`;
          if (isSecVacMode) {
            ttSelectedBatchSummary.textContent = `Joint · ${batchLabel}`;
          } else {
            ttSelectedBatchSummary.textContent = `${ttState.sec} · ${batchLabel}`;
          }
        }
        if (ttRibbonCourseSec) {
          const batchText = ttState.batch === 'ALL' ? 'All batches' : 'Batch ' + ttState.batch;
          if (ttState.course === 'SEC') {
            ttRibbonCourseSec.textContent = `SEC (Skill Enhancement Course), ${ttState.sem} (${batchText})`;
          } else if (ttState.course === 'VAC') {
            ttRibbonCourseSec.textContent = `VAC (Value Addition Course), ${ttState.sem} (${batchText})`;
          } else if (ttState.course === 'M.Com') {
            ttRibbonCourseSec.textContent = `M.Com (Master of Commerce), ${ttState.sem}, ${ttState.sec} (${batchText})`;
          } else if (isSecVacMode) {
            ttRibbonCourseSec.textContent = `SEC & VAC (Joint Courses), ${ttState.sem} (${batchText})`;
          } else {
            ttRibbonCourseSec.textContent = `${ttState.course}, ${ttState.sem}, ${ttState.sec} (${batchText})`;
          }
        }
        if (ttRibbonDay) {
          ttRibbonDay.textContent = ttState.day;
        }

        // Render schedule grid & empty state
        if (ttMainScheduleGrid) {
          ttMainScheduleGrid.innerHTML = cardsHtml;
        }

        if (ttMainEmptyState) {
          if (matchCount === 0) {
            ttMainEmptyState.style.display = 'block';
            if (isSecVacMode) {
              const courseLabel = ttState.course === 'SEC' ? 'SEC' : (ttState.course === 'VAC' ? 'VAC' : 'SEC / VAC');
              if (ttState.sem === 'Sem VII') {
                ttMainEmptyState.innerHTML = `
                  <div class="empty-icon">ℹ️</div>
                  <h3 style="margin-bottom: 6px;">No ${courseLabel} in Semester VII</h3>
                  <p style="color: var(--text-muted); max-width: 480px; margin: 0 auto 16px;">Under the NEP curriculum, ${courseLabel} courses are offered in Semesters I, III, and V.</p>
                  <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
                    <button class="btn-reset-filters btn-switch-sem-quick" data-sem="Sem I">Switch to Sem I</button>
                    <button class="btn-reset-filters btn-switch-sem-quick" data-sem="Sem III">Switch to Sem III</button>
                    <button class="btn-reset-filters btn-switch-sem-quick" data-sem="Sem V">Switch to Sem V</button>
                  </div>
                `;
              } else {
                ttMainEmptyState.innerHTML = `
                  <div class="empty-icon">📅</div>
                  <h3 style="margin-bottom: 6px;">No ${courseLabel} classes for ${escapeHtml(ttState.sem)} on ${escapeHtml(ttState.day)}</h3>
                  <p style="color: var(--text-muted); max-width: 500px; margin: 0 auto 14px;">Classes for this semester run on other days, or check today's other active semesters below:</p>
                  <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
                    <button class="btn-reset-filters btn-switch-day-quick" data-day="Monday">View Monday</button>
                    <button class="btn-reset-filters btn-switch-day-quick" data-day="Tuesday">View Tuesday</button>
                    <button class="btn-reset-filters btn-switch-day-quick" data-day="Wednesday">View Wednesday</button>
                    <button class="btn-reset-filters btn-switch-day-quick" data-day="Thursday">View Thursday</button>
                    <button class="btn-reset-filters btn-switch-day-quick" data-day="Friday">View Friday</button>
                    <button class="btn-reset-filters btn-switch-sem-quick" data-sem="Sem III">Sem III</button>
                    <button class="btn-reset-filters btn-switch-sem-quick" data-sem="Sem V">Sem V</button>
                    <button class="btn-reset-filters" id="btnResetTtFiltersDynamic">Reset Filters</button>
                  </div>
                `;
              }

              // Bind dynamic quick switcher buttons
              ttMainEmptyState.querySelectorAll('.btn-switch-sem-quick').forEach(b => {
                b.addEventListener('click', () => {
                  ttState.sem = b.dataset.sem;
                  updateSectionsAndBatches(true);
                  renderMainTimetableView();
                });
              });
              ttMainEmptyState.querySelectorAll('.btn-switch-day-quick').forEach(b => {
                b.addEventListener('click', () => {
                  ttState.day = b.dataset.day;
                  renderMainTimetableView();
                });
              });
              const dynReset = ttMainEmptyState.querySelector('#btnResetTtFiltersDynamic');
              if (dynReset) {
                dynReset.addEventListener('click', () => {
                  ttState.slot = 'ALL';
                  ttState.batch = 'ALL';
                  ttState.searchQuery = '';
                  if (ttMainSearchInput) ttMainSearchInput.value = '';
                  if (ttMainSlotSelect) ttMainSlotSelect.value = 'ALL';
                  if (ttMainBatchSelect) ttMainBatchSelect.value = 'ALL';
                  renderMainTimetableView();
                });
              }
            } else {
              ttMainEmptyState.innerHTML = `
                <div class="empty-icon">🔎</div>
                <h3>No matching classes found</h3>
                <p>Try clearing your search query or switching Section / Day.</p>
                <button class="btn-reset-filters" id="btnResetTtFilters">Reset Filters</button>
              `;
              const resetBtn = ttMainEmptyState.querySelector('#btnResetTtFilters');
              if (resetBtn) {
                resetBtn.addEventListener('click', () => {
                  ttState.slot = 'ALL';
                  ttState.searchQuery = '';
                  if (ttMainSearchInput) ttMainSearchInput.value = '';
                  if (ttMainSlotSelect) ttMainSlotSelect.value = 'ALL';
                  renderMainTimetableView();
                });
              }
            }
          } else {
            ttMainEmptyState.style.display = 'none';
          }
        }

        // Attach listeners to any dynamic switch day buttons created in banners
        document.querySelectorAll('.btn-switch-day-quick').forEach(b => {
          b.addEventListener('click', () => {
            ttState.day = b.dataset.day;
            renderMainTimetableView();
          });
        });

        // Attach click listeners for 1-click teacher timetable inspection
        if (ttMainScheduleGrid) {
          ttMainScheduleGrid.querySelectorAll('.btn-view-teacher-today').forEach(btn => {
            const handleTeacherClick = (e) => {
              e.stopPropagation();
              const tId = btn.dataset.teacherId;
              const tName = btn.dataset.teacherName;
              openTeacherModal(tId || tName, ttState.day);
            };
            btn.addEventListener('click', handleTeacherClick);
            btn.addEventListener('keydown', (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleTeacherClick(e);
              }
            });
          });

          // Clicking room buttons in Timetable directly opens Room Schedule Modal
          ttMainScheduleGrid.querySelectorAll('.btn-jump-room, .room-badge-link').forEach(btn => {
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              const targetRoom = btn.dataset.room;
              if (targetRoom) {
                openScheduleModal(targetRoom, ttState.day);
              }
            });
          });

        }
      }

      // --- Setup Event Listeners for Main View Section ---
      ttMainDayButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          ttState.day = btn.dataset.day;
          renderMainTimetableView();
        });
      });

      ttMainCoursePills.forEach(pill => {
        pill.addEventListener('click', () => {
          ttState.course = pill.dataset.course;
          if (ttState.course === 'M.Com' && (ttState.sem === 'Sem V' || ttState.sem === 'Sem VII')) {
            ttState.sem = 'Sem I';
          }
          updateSectionsAndBatches(true);
          renderMainTimetableView();
        });
      });

      ttMainSemPills.forEach(pill => {
        pill.addEventListener('click', () => {
          ttState.sem = pill.dataset.sem;
          updateSectionsAndBatches(true);
          renderMainTimetableView();
        });
      });

      if (ttMainSecSelect) {
        ttMainSecSelect.addEventListener('change', () => {
          ttState.sec = ttMainSecSelect.value;
          updateSectionsAndBatches(true);
          renderMainTimetableView();
        });
      }

      if (ttMainBatchSelect) {
        ttMainBatchSelect.addEventListener('change', () => {
          ttState.batch = ttMainBatchSelect.value;
          savePreferences();
          renderMainTimetableView();
        });
      }

      if (ttMainSlotSelect) {
        ttMainSlotSelect.addEventListener('change', () => {
          ttState.slot = ttMainSlotSelect.value;
          renderMainTimetableView();
        });
      }

      if (ttMainSearchInput) {
        ttMainSearchInput.addEventListener('input', () => {
          ttState.searchQuery = ttMainSearchInput.value;
          renderMainTimetableView();
        });
      }

      if (btnClearTtMainSearch) {
        btnClearTtMainSearch.addEventListener('click', () => {
          ttMainSearchInput.value = '';
          ttState.searchQuery = '';
          ttMainSearchInput.focus();
          renderMainTimetableView();
        });
      }

      if (btnResetTtFilters) {
        btnResetTtFilters.addEventListener('click', () => {
          ttState.slot = 'ALL';
          ttState.searchQuery = '';
          if (ttMainSearchInput) ttMainSearchInput.value = '';
          if (ttMainSlotSelect) ttMainSlotSelect.value = 'ALL';
          renderMainTimetableView();
        });
      }

      // Live day-wise auto capture on timetable switch
      window._setTimetableToToday = function() {
        ttState.day = getLiveDayName();
        syncControlPills();
        renderMainTimetableView();
      };

      // Expose globally so mode switcher & tab switcher can trigger it
      window._renderMainTimetable = renderMainTimetableView;
      window._openTimetableModal = function() {
        setAppMode('timetable');
      };

      // ========================================================================
      // 📌 "MERE BATCH KA AAJ KA SCHEDULE" (DAILY PINNED BATCH WIDGET)
      // ========================================================================
      const WIDGET_STORAGE_KEY = 'srcc_my_batch_widget_pref_v1';
      const myBatchContainer = document.getElementById('myBatchScheduleWidget');

      function getMyBatchPref() {
        try {
          const raw = localStorage.getItem(WIDGET_STORAGE_KEY);
          return raw ? JSON.parse(raw) : null;
        } catch (e) {
          return null;
        }
      }

      function saveMyBatchPref(pref) {
        try {
          localStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(pref));
        } catch (e) {}
      }

      function renderMyBatchSetupForm() {
        if (!myBatchContainer) return;
        const currentPref = getMyBatchPref() || {
          course: 'B.Com (Hons)',
          sem: 'Sem IV',
          sec: 'Section A',
          batch: 'ALL'
        };

        const courses = Object.keys(courseMap).filter(c => c && c !== 'SEC' && c !== 'VAC' && c !== 'SEC_VAC' && c !== 'SEC / VAC');
        if (!courses.includes('B.Com (Hons)')) courses.unshift('B.Com (Hons)');
        if (!courses.includes('B.A. (Hons) Economics')) courses.push('B.A. (Hons) Economics');
        if (!courses.includes('M.Com')) courses.push('M.Com');
        courses.push('SEC Papers', 'VAC Papers');

        myBatchContainer.innerHTML = `
          <div class="my-batch-widget my-batch-setup-card">
            <div class="my-batch-setup-header">
              <div class="my-batch-title-row">
                <span class="my-batch-icon">📌</span>
                <div>
                  <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700; color: var(--text-heading);">Mere Batch Ka Aaj Ka Schedule (Daily Widget)</h3>
                  <p style="margin: 4px 0 0; font-size: 0.85rem; color: var(--text-muted);">Apna course, semester aur section select karo — har roz home screen par aaj ka schedule, next class reminder aur live teacher leave alert apne aap update hoga!</p>
                </div>
              </div>
            </div>
            <div class="my-batch-form-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-top: 14px;">
              <div class="my-batch-field">
                <label style="display: block; font-size: 0.78rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); margin-bottom: 4px;">Course</label>
                <select id="mbCourseSelect" class="my-batch-select" style="width: 100%; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color, #e2e8f0); background: var(--bg-card); color: var(--text-heading);">
                  <option value="B.Com (Hons)" ${currentPref.course === 'B.Com (Hons)' ? 'selected' : ''}>B.Com (Hons)</option>
                  <option value="B.A. (Hons) Economics" ${currentPref.course === 'B.A. (Hons) Economics' ? 'selected' : ''}>B.A. (Hons) Economics</option>
                  <option value="M.Com" ${currentPref.course === 'M.Com' ? 'selected' : ''}>M.Com</option>
                  <option value="SEC" ${currentPref.course === 'SEC' ? 'selected' : ''}>Skill Enhancement (SEC)</option>
                  <option value="VAC" ${currentPref.course === 'VAC' ? 'selected' : ''}>Value Addition (VAC)</option>
                </select>
              </div>
              <div class="my-batch-field">
                <label style="display: block; font-size: 0.78rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); margin-bottom: 4px;">Semester</label>
                <select id="mbSemSelect" class="my-batch-select" style="width: 100%; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color, #e2e8f0); background: var(--bg-card); color: var(--text-heading);"></select>
              </div>
              <div class="my-batch-field" id="mbSecField">
                <label style="display: block; font-size: 0.78rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); margin-bottom: 4px;">Section</label>
                <select id="mbSecSelect" class="my-batch-select" style="width: 100%; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color, #e2e8f0); background: var(--bg-card); color: var(--text-heading);"></select>
              </div>
              <div class="my-batch-field">
                <label style="display: block; font-size: 0.78rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); margin-bottom: 4px;">Batch / Group</label>
                <select id="mbBatchSelect" class="my-batch-select" style="width: 100%; padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-color, #e2e8f0); background: var(--bg-card); color: var(--text-heading);"></select>
              </div>
            </div>
            <div class="my-batch-actions" style="margin-top: 16px; display: flex; gap: 10px; align-items: center; justify-content: flex-end;">
              ${getMyBatchPref() ? `<button type="button" id="mbBtnCancelEdit" style="padding: 8px 16px; border-radius: 8px; border: 1px solid var(--border-color); background: transparent; color: var(--text-muted); cursor: pointer; font-size: 0.88rem;">Cancel</button>` : ''}
              <button type="button" id="mbBtnSaveWidget" style="padding: 9px 20px; border-radius: 8px; border: none; background: #2563eb; color: #fff; font-weight: 600; cursor: pointer; font-size: 0.92rem; box-shadow: 0 2px 8px rgba(37,99,235,0.3);">
                📌 Pin Mere Batch Ka Schedule
              </button>
            </div>
          </div>
        `;

        const elCourse = document.getElementById('mbCourseSelect');
        const elSem = document.getElementById('mbSemSelect');
        const elSec = document.getElementById('mbSecSelect');
        const elBatch = document.getElementById('mbBatchSelect');
        const elSecField = document.getElementById('mbSecField');
        const btnSave = document.getElementById('mbBtnSaveWidget');
        const btnCancel = document.getElementById('mbBtnCancelEdit');

        function updateFormOptions() {
          const selectedCourse = elCourse.value;
          const isSecOrVac = (selectedCourse === 'SEC' || selectedCourse === 'VAC');

          // Sems
          const sems = (selectedCourse === 'M.Com')
            ? ['Sem II', 'Sem IV']
            : (isSecOrVac ? ['Sem I', 'Sem II', 'Sem III', 'Sem IV', 'Sem V', 'Sem VI'] : ['Sem II', 'Sem IV', 'Sem VI', 'Sem VII']);

          const curSem = sems.includes(elSem.value) ? elSem.value : (sems.includes(currentPref.sem) ? currentPref.sem : sems[0]);
          elSem.innerHTML = sems.map(s => `<option value="${s}" ${s === curSem ? 'selected' : ''}>${s}</option>`).join('');

          // Secs
          if (isSecOrVac) {
            elSecField.style.display = 'none';
          } else {
            elSecField.style.display = 'block';
            const secs = Object.keys(courseMap[selectedCourse]?.[curSem] || {}).sort();
            const curSec = secs.includes(elSec.value) ? elSec.value : (secs.includes(currentPref.sec) ? currentPref.sec : (secs[0] || ''));
            elSec.innerHTML = secs.map(s => `<option value="${s}" ${s === curSec ? 'selected' : ''}>${s}</option>`).join('');
          }

          // Batches
          let batchOptions = '<option value="ALL">All Batches (Whole Section)</option>';
          if (selectedCourse === 'SEC') {
            const bList = Array.from(secBatchesBySem[curSem] || []);
            batchOptions = '<option value="ALL">All SEC Batches</option>' + bList.map(b => `<option value="${b}">${b}</option>`).join('');
          } else if (selectedCourse === 'VAC') {
            const bList = Array.from(vacBatchesBySem[curSem] || []);
            batchOptions = '<option value="ALL">All VAC Batches</option>' + bList.map(b => `<option value="${b}">${b}</option>`).join('');
          } else {
            const rawSet = courseMap[selectedCourse]?.[curSem]?.[elSec.value] || new Set();
            const bList = getCleanBatchesForSection(rawSet, elSec.value);
            batchOptions += bList.map(b => `<option value="${b}">${b}</option>`).join('');
          }
          elBatch.innerHTML = batchOptions;
        }

        if (elCourse) elCourse.addEventListener('change', updateFormOptions);
        if (elSem) elSem.addEventListener('change', updateFormOptions);
        if (elSec) elSec.addEventListener('change', updateFormOptions);

        updateFormOptions();

        if (btnCancel) {
          btnCancel.addEventListener('click', () => {
            renderMyBatchDailyWidget();
          });
        }

        if (btnSave) {
          btnSave.addEventListener('click', () => {
            const newPref = {
              course: elCourse.value,
              sem: elSem.value,
              sec: (elCourse.value === 'SEC' || elCourse.value === 'VAC') ? '' : elSec.value,
              batch: elBatch.value || 'ALL'
            };
            saveMyBatchPref(newPref);
            showToast('✅ <strong>Mere Batch Ka Schedule</strong> successfully pinned to home screen!', true, 3500);
            renderMyBatchDailyWidget();
          });
        }
      }

      function parseTimeToMinutes(timeStr) {
        if (!timeStr) return -1;
        const m = timeStr.trim().match(/(\d+):(\d+)\s*(AM|PM)/i);
        if (!m) return -1;
        let h = parseInt(m[1], 10);
        const min = parseInt(m[2], 10);
        const ampm = m[3].toUpperCase();
        if (ampm === 'PM' && h < 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        return h * 60 + min;
      }

      function renderMyBatchDailyWidget() {
        if (!myBatchContainer) return;
        const pref = getMyBatchPref();
        if (!pref) {
          renderMyBatchSetupForm();
          return;
        }

        // Live day name for today
        const todayDay = getLiveDayName();
        const istNow = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const nowMins = istNow.getHours() * 60 + istNow.getMinutes();
        const dateFormatted = istNow.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

        const isSunday = (todayDay === 'Sunday');
        const classesDay = isSunday ? 'Monday' : todayDay;

        // Fetch classes
        const rawClasses = getClassesForParameters(classesDay, pref.sem, pref.course, pref.batch, pref.sec);
        const mergedClasses = mergeConsecutiveSessions(rawClasses);

        // Teacher leaves active today
        const todayLeaves = getActiveTodayLeaves();
        const leaveProfMap = {};
        todayLeaves.forEach(l => {
          if (l.teacher_id) leaveProfMap[l.teacher_id] = l;
          if (l.teacher_name) leaveProfMap[l.teacher_name.trim().toLowerCase()] = l;
        });

        function checkClassTeacherLeave(cls) {
          if (cls.teacherId && leaveProfMap[cls.teacherId]) return leaveProfMap[cls.teacherId];
          if (cls.teacher && leaveProfMap[cls.teacher.trim().toLowerCase()]) return leaveProfMap[cls.teacher.trim().toLowerCase()];
          return null;
        }

        // Identify Current and Next Class
        let currentClass = null;
        let nextClass = null;
        let minsToNext = 999999;

        if (!isSunday) {
          mergedClasses.forEach(cls => {
            const startMins = parseTimeToMinutes(cls.startTime);
            const endMins = parseTimeToMinutes(cls.endTime);

            if (startMins !== -1 && endMins !== -1) {
              if (nowMins >= startMins && nowMins < endMins) {
                currentClass = cls;
              } else if (nowMins < startMins) {
                const diff = startMins - nowMins;
                if (diff < minsToNext) {
                  minsToNext = diff;
                  nextClass = cls;
                }
              }
            }
          });
        }

        // Build Next Class Reminder UI
        let reminderHtml = '';
        if (isSunday) {
          reminderHtml = `
            <div class="my-batch-next-class-card status-free" style="background: rgba(16, 185, 129, 0.08); border-left: 4px solid #10b981; padding: 12px 16px; border-radius: 10px; margin-top: 12px;">
              <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; color: #059669; font-size: 0.95rem;">
                <span>🏖️ Sunday · College Closed Today</span>
              </div>
              <p style="margin: 4px 0 0; font-size: 0.85rem; color: var(--text-muted);">No academic lectures today. Showing Monday's upcoming schedule below for planning!</p>
            </div>
          `;
        } else if (currentClass) {
          const leave = checkClassTeacherLeave(currentClass);
          const endMins = parseTimeToMinutes(currentClass.endTime);
          const remainingMins = endMins - nowMins;
          reminderHtml = `
            <div class="my-batch-next-class-card status-current" style="background: rgba(239, 68, 68, 0.08); border-left: 4px solid #ef4444; padding: 12px 16px; border-radius: 10px; margin-top: 12px;">
              <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; color: #dc2626; font-size: 0.95rem;">
                  <span class="pulsing-live-dot" style="display:inline-block; width:10px; height:10px; border-radius:50%; background:#ef4444; animation: livePulse 1.5s infinite;"></span>
                  <span>CLASS IN PROGRESS NOW</span>
                  <span style="font-size: 0.82rem; font-weight: normal; color: var(--text-muted);">(Ends at ${currentClass.endTime}, in ${remainingMins} min${remainingMins === 1 ? '' : 's'})</span>
                </div>
                <button type="button" class="btn-batch-room-jump" onclick="openScheduleModal('${escapeHtml(currentClass.room)}')" style="padding: 4px 10px; border-radius: 6px; font-size: 0.78rem; font-weight: 600; background: #ef4444; color: #fff; border: none; cursor: pointer;">
                  📍 Room ${escapeHtml(currentClass.room)} Schedule ↗
                </button>
              </div>
              <div style="margin-top: 8px; font-size: 1.05rem; font-weight: 700; color: var(--text-heading);">
                ${escapeHtml(currentClass.subject)} ${currentClass.subject_name ? `<span style="font-size: 0.88rem; font-weight: 500; opacity: 0.85;">(${escapeHtml(currentClass.subject_name)})</span>` : ''}
              </div>
              <div style="font-size: 0.88rem; color: var(--text-muted); margin-top: 4px;">
                Prof. <strong>${escapeHtml(currentClass.teacher)}</strong> · ${currentClass.periodsCount > 1 ? `${currentClass.periodsCount} Continuous Periods` : '1 Period'}
              </div>
              ${leave ? `
                <div class="batch-teacher-leave-alert" style="margin-top: 8px; padding: 6px 10px; border-radius: 6px; background: rgba(217, 119, 6, 0.12); border: 1px solid rgba(217, 119, 6, 0.3); color: #b45309; font-size: 0.82rem; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                  <span>🏖️</span>
                  <span><strong>FACULTY LEAVE ALERT:</strong> Prof. ${escapeHtml(currentClass.teacher)} is on leave today. This class may not be held!</span>
                </div>
              ` : ''}
            </div>
          `;
        } else if (nextClass) {
          const leave = checkClassTeacherLeave(nextClass);
          const timeText = minsToNext > 60
            ? `${Math.floor(minsToNext / 60)}h ${minsToNext % 60}m`
            : `${minsToNext} min${minsToNext === 1 ? '' : 's'}`;
          reminderHtml = `
            <div class="my-batch-next-class-card status-upcoming" style="background: rgba(37, 99, 235, 0.08); border-left: 4px solid #2563eb; padding: 12px 16px; border-radius: 10px; margin-top: 12px;">
              <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; color: #2563eb; font-size: 0.95rem;">
                  <span>⏳ NEXT CLASS IN ${timeText.toUpperCase()} (Starts at ${nextClass.startTime})</span>
                </div>
                <button type="button" class="btn-batch-room-jump" onclick="openScheduleModal('${escapeHtml(nextClass.room)}')" style="padding: 4px 10px; border-radius: 6px; font-size: 0.78rem; font-weight: 600; background: #2563eb; color: #fff; border: none; cursor: pointer;">
                  📍 Room ${escapeHtml(nextClass.room)} Schedule ↗
                </button>
              </div>
              <div style="margin-top: 8px; font-size: 1.05rem; font-weight: 700; color: var(--text-heading);">
                ${escapeHtml(nextClass.subject)} ${nextClass.subject_name ? `<span style="font-size: 0.88rem; font-weight: 500; opacity: 0.85;">(${escapeHtml(nextClass.subject_name)})</span>` : ''}
              </div>
              <div style="font-size: 0.88rem; color: var(--text-muted); margin-top: 4px;">
                Prof. <strong>${escapeHtml(nextClass.teacher)}</strong> in Room <strong>${escapeHtml(nextClass.room)}</strong>
              </div>
              ${leave ? `
                <div class="batch-teacher-leave-alert" style="margin-top: 8px; padding: 6px 10px; border-radius: 6px; background: rgba(217, 119, 6, 0.12); border: 1px solid rgba(217, 119, 6, 0.3); color: #b45309; font-size: 0.82rem; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                  <span>🏖️</span>
                  <span><strong>FACULTY LEAVE ALERT:</strong> Prof. ${escapeHtml(nextClass.teacher)} is on leave today! This lecture might be cancelled or substituted.</span>
                </div>
              ` : ''}
            </div>
          `;
        } else if (mergedClasses.length > 0 && nowMins >= 1080) { // After 6 PM
          reminderHtml = `
            <div class="my-batch-next-class-card status-free" style="background: rgba(16, 185, 129, 0.08); border-left: 4px solid #10b981; padding: 12px 16px; border-radius: 10px; margin-top: 12px;">
              <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; color: #059669; font-size: 0.95rem;">
                <span>🎉 All Classes For Today Are Over!</span>
              </div>
              <p style="margin: 4px 0 0; font-size: 0.85rem; color: var(--text-muted);">All lectures have concluded. Enjoy your evening & review notes!</p>
            </div>
          `;
        } else if (mergedClasses.length === 0) {
          reminderHtml = `
            <div class="my-batch-next-class-card status-free" style="background: rgba(16, 185, 129, 0.08); border-left: 4px solid #10b981; padding: 12px 16px; border-radius: 10px; margin-top: 12px;">
              <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; color: #059669; font-size: 0.95rem;">
                <span>🎉 No Scheduled Classes Today</span>
              </div>
              <p style="margin: 4px 0 0; font-size: 0.85rem; color: var(--text-muted);">No academic lectures scheduled for your batch on ${todayDay}.</p>
            </div>
          `;
        }

        // Today's classes timeline strip
        const classesTimelineHtml = mergedClasses.length === 0
          ? `<div style="text-align: center; padding: 16px; color: var(--text-muted); font-size: 0.88rem;">No classes found for this day.</div>`
          : mergedClasses.map(cls => {
              const leave = checkClassTeacherLeave(cls);
              const isContinuous = cls.isContinuous;
              const periodBadge = isContinuous
                ? `<span style="font-size: 0.72rem; padding: 2px 7px; border-radius: 4px; background: #dbeafe; color: #1e40af; font-weight: 700;">${cls.periodsCount} Periods (${cls.startTime} – ${cls.endTime})</span>`
                : `<span style="font-size: 0.72rem; padding: 2px 7px; border-radius: 4px; background: var(--bg-hover); color: var(--text-muted); font-weight: 600;">${cls.startTime} – ${cls.endTime}</span>`;

              return `
                <div class="my-batch-class-item ${leave ? 'has-leave' : ''}" style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; padding: 10px 14px; border-radius: 8px; background: var(--bg-hover, #f8fafc); border: 1px solid var(--border-color, #e2e8f0); margin-bottom: 8px;">
                  <div style="display: flex; flex-direction: column; gap: 2px;">
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <span style="font-weight: 700; font-size: 0.94rem; color: var(--text-heading);">${escapeHtml(cls.subject)}</span>
                      ${periodBadge}
                      ${cls.rawBatch && cls.rawBatch !== 'Whole Section' ? `<span style="font-size: 0.72rem; padding: 1px 6px; border-radius: 4px; background: #fef3c7; color: #92400e;">${escapeHtml(cls.rawBatch)}</span>` : ''}
                    </div>
                    <div style="font-size: 0.82rem; color: var(--text-muted);">
                      Prof. <strong>${escapeHtml(cls.teacher)}</strong>
                      ${leave ? `<span style="margin-left: 6px; color: #dc2626; font-weight: 700; background: rgba(220, 38, 38, 0.1); padding: 1px 6px; border-radius: 4px;">🏖️ On Leave</span>` : ''}
                    </div>
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <button type="button" onclick="openScheduleModal('${escapeHtml(cls.room)}')" style="padding: 4px 10px; border-radius: 6px; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-heading); font-size: 0.82rem; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                      📍 <strong>${escapeHtml(cls.room)}</strong>
                    </button>
                    ${cls.teacherId ? `
                      <button type="button" onclick="openTeacherModal('${escapeHtml(cls.teacherId)}', '${classesDay}')" title="View Teacher Timetable" style="padding: 4px 8px; border-radius: 6px; background: var(--bg-card); border: 1px solid var(--border-color); color: var(--text-muted); font-size: 0.8rem; cursor: pointer;">
                        🗓️
                      </button>
                    ` : ''}
                  </div>
                </div>
              `;
            }).join('');

        const batchDesc = pref.sec ? `${pref.course} · ${pref.sem} · ${pref.sec}${pref.batch !== 'ALL' ? ` (${pref.batch})` : ''}` : `${pref.course} · ${pref.sem}`;

        myBatchContainer.innerHTML = `
          <div class="my-batch-widget my-batch-active-card" style="background: var(--bg-card, #ffffff); border: 1px solid var(--border-color, #e2e8f0); border-radius: 14px; padding: 16px; margin-bottom: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; border-bottom: 1px solid var(--border-color, #e2e8f0); padding-bottom: 12px;">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.35rem;">📌</span>
                <div>
                  <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <h3 style="margin: 0; font-size: 1.05rem; font-weight: 700; color: var(--text-heading);">Mere Batch Ka Aaj Ka Schedule</h3>
                    <span style="font-size: 0.78rem; font-weight: 600; padding: 2px 8px; border-radius: 6px; background: rgba(37,99,235,0.1); color: #2563eb;">${escapeHtml(batchDesc)}</span>
                  </div>
                  <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">
                    📅 ${todayDay}, ${dateFormatted} · Daily Auto-Updated Widget
                  </div>
                </div>
              </div>
              <button type="button" id="btnEditMyBatchWidget" style="padding: 5px 12px; border-radius: 8px; border: 1px solid var(--border-color); background: transparent; color: var(--text-heading); font-size: 0.82rem; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                ⚙️ Change Batch
              </button>
            </div>

            <!-- Next Class Live Alert -->
            ${reminderHtml}

            <!-- Today's Classes List Header -->
            <div style="margin: 16px 0 8px; display: flex; align-items: center; justify-content: space-between;">
              <span style="font-size: 0.84rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted);">Today's Lectures (${mergedClasses.length})</span>
              <span style="font-size: 0.78rem; color: var(--text-muted);">Tap room to view vacancy</span>
            </div>

            <div class="my-batch-timeline-list">
              ${classesTimelineHtml}
            </div>
          </div>
        `;

        const btnEdit = document.getElementById('btnEditMyBatchWidget');
        if (btnEdit) {
          btnEdit.addEventListener('click', () => {
            renderMyBatchSetupForm();
          });
        }
      }

      // Expose globally so updateLiveClock can trigger seamless updates
      window.renderMyBatchDailyWidget = renderMyBatchDailyWidget;

      // Populate initial values
      updateSectionsAndBatches(false);
      syncControlPills();
      renderMyBatchDailyWidget();
      initWidgetSetupModal();
    }

    function initWidgetSetupModal() {
      const modal = document.getElementById('widgetSetupModal');
      const btnOpen = document.getElementById('btnOpenWidgetSetupModal');
      const btnClose = document.getElementById('btnCloseWidgetSetupModal');
      const wCourse = document.getElementById('wSetupCourse');
      const wSem = document.getElementById('wSetupSem');
      const wSec = document.getElementById('wSetupSec');
      const wBatch = document.getElementById('wSetupBatch');
      const wSecField = document.getElementById('wSetupSecField');
      const canvas = document.getElementById('wSetupQrCanvas');
      const summary = document.getElementById('wSetupProfileSummary');
      const btnShareLink = document.getElementById('btnCopyWidgetShareLink');
      const btnCopyJson = document.getElementById('btnCopyWidgetJson');
      const linkPwa = document.getElementById('btnLaunchWidgetPwaLink');

      if (!modal || !btnOpen) return;

      function updateModalSections() {
        const selectedCourse = wCourse.value;
        const isSecOrVac = (selectedCourse === 'SEC' || selectedCourse === 'VAC');
        if (isSecOrVac) {
          if (wSecField) wSecField.style.display = 'none';
        } else {
          if (wSecField) wSecField.style.display = 'block';
          const curSem = wSem.value;
          const secs = Object.keys(courseMap[selectedCourse]?.[curSem] || {}).sort();
          if (wSec) {
            const curVal = secs.includes(wSec.value) ? wSec.value : (secs[0] || 'Sec A');
            wSec.innerHTML = secs.map(s => `<option value="${s}" ${s === curVal ? 'selected' : ''}>${s}</option>`).join('');
          }
        }
        updateProfileAndQr();
      }

      function getSelectedProfile() {
        const selectedCourse = wCourse ? wCourse.value : (ttState.course || 'B.Com (Hons)');
        const selectedSem = wSem ? wSem.value : (ttState.sem || 'Sem I');
        const selectedSec = (selectedCourse === 'SEC' || selectedCourse === 'VAC') ? '' : (wSec ? wSec.value : (ttState.sec || 'Sec A'));
        const selectedBatch = (wBatch ? wBatch.value : (ttState.batch || 'ALL')) || 'ALL';

        return {
          course: selectedCourse,
          sem: selectedSem,
          sec: selectedSec,
          batch: selectedBatch,
          college: 'SRCC',
          v: 1,
          ts: Date.now()
        };
      }

      function updateProfileAndQr() {
        const prof = getSelectedProfile();
        const jsonStr = JSON.stringify(prof);
        const b64 = btoa(unescape(encodeURIComponent(jsonStr)));
        const origin = window.location.origin || '';
        const path = window.location.pathname ? window.location.pathname.replace(/index\.html$/, '') : '/';
        const shareUrl = `${origin}${path}widget.html?profile=${encodeURIComponent(b64)}`;

        if (summary) {
          summary.textContent = `${prof.course} · ${prof.sem}${prof.sec ? ' · ' + prof.sec : ''}${prof.batch !== 'ALL' ? ' (' + prof.batch + ')' : ''}`;
        }
        if (linkPwa) {
          linkPwa.href = `widget.html?profile=${encodeURIComponent(b64)}`;
        }

        if (canvas) {
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.font = '12px sans-serif';
          ctx.fillStyle = '#000066';
          ctx.textAlign = 'center';
          ctx.fillText('Generating QR...', canvas.width / 2, canvas.height / 2);

          const qrImg = new Image();
          qrImg.crossOrigin = 'Anonymous';
          qrImg.onload = function() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(qrImg, 0, 0, canvas.width, canvas.height);
          };
          qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(shareUrl)}`;
        }
      }

      btnOpen.addEventListener('click', () => {
        if (wCourse && ttState.course) wCourse.value = ttState.course;
        if (wSem && ttState.sem) wSem.value = ttState.sem;
        updateModalSections();
        if (wSec && ttState.sec) wSec.value = ttState.sec;
        if (wBatch && ttState.batch) wBatch.value = ttState.batch;
        updateProfileAndQr();
        modal.style.display = 'flex';
      });

      if (btnClose) {
        btnClose.addEventListener('click', () => {
          modal.style.display = 'none';
        });
      }

      modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.style.display = 'none';
      });

      if (wCourse) wCourse.addEventListener('change', updateModalSections);
      if (wSem) wSem.addEventListener('change', updateModalSections);
      if (wSec) wSec.addEventListener('change', updateProfileAndQr);
      if (wBatch) wBatch.addEventListener('change', updateProfileAndQr);

      if (btnShareLink) {
        btnShareLink.addEventListener('click', () => {
          const prof = getSelectedProfile();
          const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(prof))));
          const origin = window.location.origin || '';
          const path = window.location.pathname ? window.location.pathname.replace(/index\.html$/, '') : '/';
          const shareUrl = `${origin}${path}widget.html?profile=${encodeURIComponent(b64)}`;
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(shareUrl).then(() => {
              showToast('📋 Widget profile link copied to clipboard!');
            }).catch(() => {
              prompt('Copy widget link:', shareUrl);
            });
          } else {
            prompt('Copy widget link:', shareUrl);
          }
        });
      }

      if (btnCopyJson) {
        btnCopyJson.addEventListener('click', () => {
          const prof = getSelectedProfile();
          const jsonStr = JSON.stringify(prof, null, 2);
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(jsonStr).then(() => {
              showToast('📄 Widget profile JSON copied to clipboard!');
            }).catch(() => {
              prompt('Copy profile JSON:', jsonStr);
            });
          } else {
            prompt('Copy profile JSON:', jsonStr);
          }
        });
      }
    }

    // ========================================================================
    // 👥 UNIQUE STUDENT VISITOR TRACKING (Firebase Realtime DB)
    // ========================================================================
    function trackStudentVisitor() {
      try {
        let visitorUuid = localStorage.getItem('srcc_student_uuid');
        if (!visitorUuid) {
          visitorUuid = 'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
          localStorage.setItem('srcc_student_uuid', visitorUuid);
          localStorage.setItem('srcc_student_first_seen', new Date().toISOString());
        }

        const sessionLogged = sessionStorage.getItem('srcc_student_session_logged');
        if (sessionLogged) return; // Only log once per session to conserve bandwidth
        sessionStorage.setItem('srcc_student_session_logged', '1');

        let cloudUrl = (window.SRCC_CLOUD_CONFIG && window.SRCC_CLOUD_CONFIG.db_url) || localStorage.getItem('srcc_cloud_db_url') || 'https://srcc-leaves-default-rtdb.firebaseio.com/leaves.json';
        if (!cloudUrl) return;
        let baseUrl = cloudUrl;
        if (baseUrl.endsWith('/leaves.json')) {
          baseUrl = baseUrl.substring(0, baseUrl.length - 12);
        }

        const payload = {
          lastSeen: new Date().toISOString(),
          firstSeen: localStorage.getItem('srcc_student_first_seen') || new Date().toISOString(),
          platform: (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || 'web',
          isPwa: window.matchMedia('(display-mode: standalone)').matches
        };

        fetch(`${baseUrl}/visitors/${visitorUuid}.json`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        }).catch(() => {});
      } catch (e) {
        console.warn('Visitor tracking note:', e);
      }
    }

    // ========================================================================
    // 🔔 BULLETPROOF CROSS-PLATFORM DEVICE NOTIFICATION DISPATCHER
    // (Fully compatible with Android Mobile, Windows/Mac Laptop Chrome, iOS PWA)
    // ========================================================================
    async function triggerDeviceNotification(title, options = {}) {
      if (!('Notification' in window)) return false;
      if (Notification.permission !== 'granted') return false;

      const baseHref = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
      const iconUrl = options.icon ? new URL(options.icon, baseHref).href : new URL('srcc_crest.png', baseHref).href;
      const badgeUrl = options.badge ? new URL(options.badge, baseHref).href : new URL('favicon.png', baseHref).href;

      const resolvedOptions = {
        body: options.body || '',
        icon: iconUrl,
        badge: badgeUrl,
        tag: options.tag || 'srcc-leave-alert',
        renotify: true,
        vibrate: options.vibrate || [200, 100, 200, 100, 200],
        requireInteraction: false,
        data: options.data || { url: baseHref + 'index.html?view=leaves' }
      };

      // 1. Primary Method: Service Worker showNotification (MANDATORY for Android Mobile Chrome to avoid Illegal Constructor, works excellently on Laptop Chrome)
      if ('serviceWorker' in navigator) {
        try {
          const reg = await (navigator.serviceWorker.ready || navigator.serviceWorker.getRegistration());
          if (reg && typeof reg.showNotification === 'function') {
            await reg.showNotification(title, resolvedOptions);
            return true;
          }
        } catch (swErr) {
          console.warn('[SW Notification Note]', swErr);
        }
      }

      // 2. Desktop Fallback: new Notification() (Only on Desktop browsers supporting window constructor)
      try {
        new Notification(title, resolvedOptions);
        return true;
      } catch (e) {
        console.warn('[Desktop Notification Note]', e);
      }
      return false;
    }

    // ========================================================================
    // 🏛️ LIVE FREE ROOMS COUNT HELPER
    // ========================================================================
    function getCurrentlyFreeRoomsCount() {
      if (!appData || !appData.rooms) return 0;
      const now = getIstDate();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
      if (dayName === 'Sunday') return 0;

      // 🥪 Lunch recess (1:30 PM - 2:00 PM): All 96 classrooms are 100% free!
      if (currentMinutes >= 13 * 60 + 30 && currentMinutes < 14 * 60) {
        return appData.rooms.length;
      }

      const matched = periodIntervals.find(p => currentMinutes >= p.start && currentMinutes < p.end);
      if (!matched) return 0;

      const liveSlot = matched.slot;
      return appData.rooms.filter(r => {
        const s = r.schedule && r.schedule[dayName];
        if (!s) return false;
        if (s.free_slots && s.free_slots.includes(liveSlot)) return true;
        return !!getRoomScheduledTeacherLeave(r.code, dayName, liveSlot);
      }).length;
    }

    // ========================================================================
    // 🔔 HOURLY CAMPUS & FACULTY LEAVE NOTIFICATIONS SYSTEM (Every 1 Hour)
    // Combines Today's Absent Faculty + Number of Rooms Free Right Now!
    // ========================================================================
    function notifyFacultyLeaves(activeLeaves, isLiveUpdate = false, isTest = false) {
      const freeRoomsCount = getCurrentlyFreeRoomsCount();
      let freeRoomsText = '';
      if (state.currentLiveSlot === '1:30 PM to 2:00 PM') {
        freeRoomsText = '🥪 Lunch Recess: All 96 Classrooms Free Right Now!';
      } else if (freeRoomsCount > 0) {
        freeRoomsText = `⚡ ${freeRoomsCount} Classrooms Free Right Now for GD & Study!`;
      } else if (state.currentLiveSlot) {
        freeRoomsText = '🔴 All classrooms currently in session this period.';
      } else {
        freeRoomsText = '🕒 College Off-Hours.';
      }

      if (isTest) {
        triggerDeviceNotification('SRCC Live Campus Update 🔔 (Test)', {
          body: `✅ Live Alerts Active!\n${freeRoomsText}`,
          tag: 'srcc-test-alert'
        });
        showToast(`🔔 <strong>Test Alert Sent!</strong> (${freeRoomsText})`, true, 4500);
        return;
      }

      const count = (activeLeaves && activeLeaves.length) || 0;
      let bodyText = '';
      if (count === 1) {
        bodyText = `Prof. ${activeLeaves[0].teacher_name} is marked on leave today.\n${freeRoomsText}`;
      } else if (count > 1) {
        const topNames = activeLeaves.slice(0, 3).map(l => l.teacher_name).join(', ');
        bodyText = `${count} professors on leave today (${topNames}${count > 3 ? '...' : ''}).\n${freeRoomsText}`;
      } else {
        bodyText = `All professors present today.\n${freeRoomsText}`;
      }

      const ONE_HOUR_MS = 60 * 60 * 1000;
      const lastHourlyTime = parseInt(localStorage.getItem('srcc_last_hourly_notif_time') || '0', 10);
      const now = Date.now();

      // Enforce 1-hour interval between notifications unless live update changed leaves
      if (now - lastHourlyTime < ONE_HOUR_MS && !isLiveUpdate && !isTest) {
        return; // Already notified within the last 1 hour
      }

      localStorage.setItem('srcc_last_hourly_notif_time', String(now));

      // 1. Browser Native Device Notification (Laptop + Mobile Lock Screen)
      if ('Notification' in window && Notification.permission === 'granted') {
        triggerDeviceNotification('SRCC Live Campus Update 🔔', {
          body: bodyText,
          tag: 'srcc-campus-hourly-update'
        });
      }

      // 2. In-app Toast Banner for live changes
      if (isLiveUpdate) {
        showToast(`🔔 <strong>Campus Update:</strong> ${escapeHtml(bodyText.replace('\n', ' • '))} <button onclick="openFacultyLeavesView()" style="margin-left:8px; padding:3px 8px; border-radius:4px; border:none; background:#070D18; color:#fff; cursor:pointer; font-size:0.75rem;">View</button>`, true, 7000);
      }
    }

    // ========================================================================
    // ☁️ LIVE CLOUD LEAVES SYNC (Runs on load, every 45s, and on device wakeup)
    // ========================================================================
    async function syncLeavesFromCloud(isWakeupTrigger = false) {
      let cloudUrl = (window.SRCC_CLOUD_CONFIG && window.SRCC_CLOUD_CONFIG.db_url) || localStorage.getItem('srcc_cloud_db_url') || 'https://srcc-leaves-default-rtdb.firebaseio.com/leaves.json';
      if (!cloudUrl) return;

      try {
        const res = await fetch(cloudUrl, { cache: 'no-cache' });
        if (!res.ok) return;
        const data = await res.json();
        let newLeaves = [];
        if (data && Array.isArray(data.leaves)) {
          newLeaves = data.leaves;
        } else if (Array.isArray(data)) {
          newLeaves = data;
        } else {
          return;
        }

        const currentStored = localStorage.getItem(LEAVES_STORAGE_KEY) || '[]';
        const newJson = JSON.stringify(newLeaves);

        if (newJson !== currentStored) {
          // New leaves update from cloud!
          localStorage.setItem(LEAVES_STORAGE_KEY, newJson);
          if (window.SRCC_FACULTY_LEAVES) {
            window.SRCC_FACULTY_LEAVES.leaves = newLeaves;
          } else {
            window.SRCC_FACULTY_LEAVES = { leaves: newLeaves };
          }
          leavesData = window.SRCC_FACULTY_LEAVES;

          // Re-render UI
          renderActiveLeavesBanners();
          render();
          if (state.activeMode === 'faculty') renderFaculty();
          if (typeof renderFacultyLeavesView === 'function' && document.getElementById('facultyLeavesView')?.style.display !== 'none') {
            renderFacultyLeavesView();
          }

          // Trigger notification
          const todayActive = getActiveTodayLeaves();
          notifyFacultyLeaves(todayActive, true);
        } else if (isWakeupTrigger) {
          // Device unlocked or Chrome opened: check if 1 hour has passed
          const lastHourly = parseInt(localStorage.getItem('srcc_last_hourly_notif_time') || '0', 10);
          if (Date.now() - lastHourly >= 60 * 60 * 1000) {
            const todayActive = getActiveTodayLeaves();
            notifyFacultyLeaves(todayActive, false);
          }
        }
      } catch (e) {
        if (isWakeupTrigger) {
          const lastHourly = parseInt(localStorage.getItem('srcc_last_hourly_notif_time') || '0', 10);
          if (Date.now() - lastHourly >= 60 * 60 * 1000) {
            const todayActive = getActiveTodayLeaves();
            notifyFacultyLeaves(todayActive, false);
          }
        }
      }
    }

    // ========================================================================
    // 📱 DEVICE WAKEUP & APP FOCUS LISTENERS
    // Automatically triggers when Laptop Chrome is opened or Phone is unlocked!
    // ========================================================================
    function initDeviceWakeupListeners() {
      let lastWakeupTime = 0;
      const onWakeup = () => {
        const now = Date.now();
        if (now - lastWakeupTime < 1500) return; // Debounce 1.5s
        lastWakeupTime = now;
        syncLeavesFromCloud(true);

        const lastHourly = parseInt(localStorage.getItem('srcc_last_hourly_notif_time') || '0', 10);
        if (now - lastHourly >= 60 * 60 * 1000) {
          const todayActive = getActiveTodayLeaves();
          notifyFacultyLeaves(todayActive, false);
        }
      };

      // 1. Mobile screen unlock & Tab foregrounded
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          onWakeup();
        }
      });

      // 2. Laptop Chrome Window Focus
      window.addEventListener('focus', onWakeup);

      // 3. Page restore from mobile memory / sleep cache
      window.addEventListener('pageshow', onWakeup);

      // 4. Device reconnected to Wi-Fi/Mobile Data after sleep
      window.addEventListener('online', onWakeup);
    }

    // ========================================================================
    // ⚙️ INITIALIZE LEAVE NOTIFICATION SYSTEM (Public Client One-Time Banner)
    // ========================================================================
    // Standard RFC-compliant Web Push VAPID Public Key for Chrome/Android PushManager
    const VAPID_PUBLIC_KEY = 'BJfmbvYuaQnKot04ZeKfaQrZBHgQVMubvYF02BZwLbT2TWqVEbRIJ8_A_vFsuGMNMMDQWYoObRw1gNfhA4_P-3w';

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

    async function registerDeviceWebPushSubscription() {
      try {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
        const reg = await navigator.serviceWorker.ready;
        if (!reg || !reg.pushManager) return;

        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
          });
        }

        if (sub) {
          const cloudUrl = (window.SRCC_CLOUD_CONFIG && window.SRCC_CLOUD_CONFIG.db_url) || 'https://srcc-leaves-default-rtdb.firebaseio.com/leaves.json';
          const baseUrl = cloudUrl.substring(0, cloudUrl.lastIndexOf('/'));
          const subJson = sub.toJSON();
          const subId = btoa(sub.endpoint).replace(/[^a-zA-Z0-9]/g, '').slice(-32);

          await fetch(`${baseUrl}/push_subscriptions/${subId}.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              endpoint: sub.endpoint,
              keys: subJson.keys,
              updatedAt: new Date().toISOString(),
              platform: navigator.platform || 'unknown'
            })
          }).catch(() => {});
        }
      } catch (err) {
        console.warn('[Web Push Registration Note]', err);
      }
    }

    function initLeaveNotificationSystem() {
      const banner = document.getElementById('leaveNotificationPromptBanner');
      const btnAllow = document.getElementById('btnAllowLeaveNotif');
      const btnDismiss = document.getElementById('btnDismissLeaveNotif');

      // Request permission helper (Registers closed-browser Push Alerts like Zomato/Blinkit)
      async function requestLeavePermission() {
        if (!('Notification' in window)) {
          showToast('⚠️ Notifications are not supported in this browser. Try Chrome or Edge.', false, 4000);
          return;
        }

        try {
          const perm = await Notification.requestPermission();
          if (perm === 'granted') {
            localStorage.setItem('srcc_leave_notif_enabled', 'true');
            showToast('🔔 <strong>Hourly Alerts Enabled!</strong> You will receive automatic campus updates even when Chrome is closed.', true, 5000);

            // 1. Register closed-browser Web Push subscription (Wakes up device even when Chrome is shut)
            registerDeviceWebPushSubscription();

            // 2. Register periodic background sync
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.ready.then(reg => {
                if ('periodicSync' in reg) {
                  reg.periodicSync.register('srcc-check-leaves', { minInterval: 60 * 60 * 1000 }).catch(() => {});
                }
              });
            }

            // Immediately check and notify
            const todayActive = getActiveTodayLeaves();
            notifyFacultyLeaves(todayActive, false);
          } else {
            showToast('ℹ️ Notification permission was not granted. You can enable anytime via browser URL icon.', false, 4000);
          }
        } catch (e) {
          console.warn('Permission request error:', e);
        }
      }

      // 1. One-Time Banner Prompt for new users (Silent if already granted or closed)
      if ('Notification' in window && Notification.permission === 'granted') {
        if (banner) banner.style.display = 'none';
        window._isNotifBannerActive = false;
        registerDeviceWebPushSubscription();
        const todayActive = getActiveTodayLeaves();
        notifyFacultyLeaves(todayActive, false);
      } else {
        const sessionDismissed = sessionStorage.getItem('srcc_notif_session_dismissed');
        if (!sessionDismissed && 'Notification' in window && Notification.permission !== 'granted') {
          setTimeout(() => {
            if (banner && (!installModal || installModal.style.display !== 'flex')) {
              banner.style.display = 'block';
              window._isNotifBannerActive = true;
            }
          }, 1500);
        }
      }

      if (btnAllow) {
        btnAllow.addEventListener('click', async () => {
          if (banner) banner.style.display = 'none';
          window._isNotifBannerActive = false;
          await requestLeavePermission();
          if (typeof window._triggerDeferredPwaPrompt === 'function') {
            window._triggerDeferredPwaPrompt(6000);
          }
        });
      }

      if (btnDismiss) {
        btnDismiss.addEventListener('click', () => {
          if (banner) banner.style.display = 'none';
          window._isNotifBannerActive = false;
          sessionStorage.setItem('srcc_notif_session_dismissed', '1');
          showToast('ℹ️ Notification banner dismissed.', false, 2500);
          if (typeof window._triggerDeferredPwaPrompt === 'function') {
            window._triggerDeferredPwaPrompt(6000);
          }
        });
      }

      // 📡 Listen to Instant Admin Broadcasts from Cloud Database
      let lastBroadcastTimestamp = parseInt(localStorage.getItem('srcc_last_broadcast_ts') || '0', 10);
      async function checkLiveBroadcastTrigger() {
        const cloudUrl = (window.SRCC_CLOUD_CONFIG && window.SRCC_CLOUD_CONFIG.db_url) || 'https://srcc-leaves-default-rtdb.firebaseio.com/leaves.json';
        const baseUrl = cloudUrl.substring(0, cloudUrl.lastIndexOf('/'));
        try {
          const res = await fetch(`${baseUrl}/broadcast_triggers/latest.json?t=${Date.now()}`);
          if (!res.ok) return;
          const trig = await res.json();
          if (trig && trig.timestamp && trig.timestamp > lastBroadcastTimestamp) {
            lastBroadcastTimestamp = trig.timestamp;
            localStorage.setItem('srcc_last_broadcast_ts', String(trig.timestamp));
            if ('Notification' in window && Notification.permission === 'granted') {
              const notifTitle = trig.title || 'SRCC Live Campus Update 🔔';
              const notifBody = trig.body || 'Live campus announcement from college administration.';
              if ('serviceWorker' in navigator) {
                const reg = await (navigator.serviceWorker.ready || navigator.serviceWorker.getRegistration());
                if (reg && reg.showNotification) {
                  reg.showNotification(notifTitle, {
                    body: notifBody,
                    icon: 'assets/srcc_crest.png',
                    badge: 'favicon.png',
                    tag: 'srcc-live-alert-' + trig.timestamp,
                    renotify: true,
                    vibrate: [200, 100, 200]
                  });
                }
              }
            }
          }
        } catch (e) {}
      }
      setInterval(checkLiveBroadcastTrigger, 20000);
      checkLiveBroadcastTrigger();
    }

    // ========================================================================
    // ⚡ OFFLINE MODE DETECTION & NOTIFICATION
    // ========================================================================
    function initOfflineDetection() {
      const banner = document.getElementById('offlineIndicatorBanner');
      if (!banner) return;
      function updateOnlineStatus() {
        if (!navigator.onLine) {
          banner.classList.add('is-visible');
        } else {
          banner.classList.remove('is-visible');
        }
      }
      window.addEventListener('online', updateOnlineStatus);
      window.addEventListener('offline', updateOnlineStatus);
      updateOnlineStatus();
    }

    // ========================================================================
    // 🔗 DIRECT ROOM LINK PARAMETER (?room=R36)
    // ========================================================================
    function handleInitialRoomFromUrl() {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const roomParam = urlParams.get('room');
        if (roomParam) {
          const rawCode = roomParam.trim().toUpperCase();
          const found = appData.rooms.find(r => {
            const c = r.code.toUpperCase();
            return c === rawCode || c === `R${rawCode}` || rawCode === `R${c}`;
          });
          if (found) {
            setAppMode('rooms', true);
            state.activeCategory = 'ALL';
            state.searchQuery = found.code;
            if (searchInput) searchInput.value = found.code;
            if (btnClearSearch) btnClearSearch.style.display = 'block';
            render();
            setTimeout(() => {
              openScheduleModal(found.code);
            }, 300);
          }
        }
      } catch (e) {}
    }

    // ========================================================================
    // 📶 CAMPUS WIFI DIRECTORY & QR CODE AUTO-CONNECT
    // ========================================================================
    function initWifiDirectory() {
      const btnOpenHeader = document.getElementById('btnOpenWifiModal');
      const wifiModal = document.getElementById('wifiModal');
      const btnCloseModal = document.getElementById('btnWifiModalClose');

      let currentViewBand = 'ALL';
      let currentModalBand = 'ALL';

      window._renderWifiDirectory = function(gridId = 'wifiViewGrid', searchVal = '', bandFilter = 'ALL') {
        const grid = document.getElementById(gridId);
        if (!grid) return;

        const networks = window.SRCC_CAMPUS_WIFI || campusWifiList || (window.SRCC_WIFI_DATA && window.SRCC_WIFI_DATA.networks) || [];
        const q = (searchVal || '').toLowerCase().trim();

        const filtered = networks.filter(w => {
          if (bandFilter !== 'ALL') {
            if (bandFilter === '5G' && w.band !== '5G') return false;
            if (bandFilter === '4G' && w.band !== '4G') return false;
            if (bandFilter === 'PB' && !w.ssid.includes('PB') && !w.wing?.includes('Principal')) return false;
            if (bandFilter === 'Main' && !w.wing?.includes('Main')) return false;
          }
          if (q) {
            const matchSsid = (w.ssid || '').toLowerCase().includes(q);
            const matchPwd = (w.password || '').toLowerCase().includes(q);
            const matchLoc = (w.location || '').toLowerCase().includes(q);
            const matchWing = (w.wing || '').toLowerCase().includes(q);
            if (!matchSsid && !matchPwd && !matchLoc && !matchWing) return false;
          }
          return true;
        });

        if (filtered.length === 0) {
          grid.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 36px 16px; color: var(--text-secondary);">
              <div style="font-size: 2.2rem; margin-bottom: 8px;">📶</div>
              <h3 style="margin: 0 0 6px; font-size: 1.1rem; color: var(--text-primary);">No WiFi Networks Found</h3>
              <p style="margin: 0; font-size: 0.85rem;">Try clearing your search query or switching filters.</p>
            </div>
          `;
          return;
        }

        grid.innerHTML = filtered.map(w => {
          const band = w.band || 'Dual';
          const bandClass = band === '5G' ? 'wifi-band-5g' : (band === '4G' ? 'wifi-band-4g' : 'wifi-band-dual');
          const wifiString = `WIFI:S:${w.ssid};T:WPA;P:${w.password};;`;
          const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(wifiString)}`;

          return `
            <div class="wifi-card" id="card-${escapeHtml(w.id || w.ssid)}">
              <div class="wifi-card-header">
                <span class="wifi-ssid-title">📶 ${escapeHtml(w.ssid)}</span>
                <span class="wifi-band-badge ${bandClass}">${escapeHtml(band)}</span>
              </div>
              <div class="wifi-location-text">
                📍 <span>${escapeHtml(w.location || w.wing || 'Campus')}</span>
              </div>
              <div class="wifi-pwd-box">
                <span style="user-select: all;">${escapeHtml(w.password)}</span>
                <span style="font-size: 0.72rem; color: var(--text-secondary); font-family: sans-serif; font-weight: 600;">WPA2</span>
              </div>
              ${w.notes ? `<div style="font-size: 0.75rem; color: var(--text-muted); line-height: 1.3;">ℹ️ ${escapeHtml(w.notes)}</div>` : ''}
              <div class="wifi-card-actions">
                <button type="button" class="btn-copy-wifi-pwd" data-pwd="${escapeHtml(w.password)}">
                  📋 Copy Password
                </button>
                <button type="button" class="btn-qr-wifi" data-target="qr-${escapeHtml(w.id || w.ssid)}">
                  📷 Scan QR
                </button>
              </div>
              <div class="wifi-qr-popup" id="qr-${escapeHtml(w.id || w.ssid)}" style="display: none;">
                <img src="${qrUrl}" alt="WiFi QR for ${escapeHtml(w.ssid)}" loading="lazy" />
                <p style="font-size: 0.75rem; color: #475569; margin: 6px 0 0; font-weight: 600;">Point phone camera or scanner to connect directly</p>
              </div>
            </div>
          `;
        }).join('');

        // Wire copy and QR buttons
        grid.querySelectorAll('.btn-copy-wifi-pwd').forEach(btn => {
          btn.addEventListener('click', () => {
            const pwd = btn.dataset.pwd;
            navigator.clipboard.writeText(pwd).then(() => {
              showToast(`📋 Copied WiFi password: <code>${pwd}</code>`);
            }).catch(() => {
              showToast(`Password: ${pwd}`);
            });
          });
        });

        grid.querySelectorAll('.btn-qr-wifi').forEach(btn => {
          btn.addEventListener('click', () => {
            const qrEl = document.getElementById(btn.dataset.target);
            if (qrEl) {
              const isOpen = qrEl.style.display === 'block';
              qrEl.style.display = isOpen ? 'none' : 'block';
              btn.textContent = isOpen ? '📷 Scan QR' : '✕ Hide QR';
            }
          });
        });
      };

      // Header button
      if (btnOpenHeader && wifiModal) {
        btnOpenHeader.addEventListener('click', () => {
          wifiModal.style.display = 'flex';
          window._renderWifiDirectory('wifiModalGrid', '', currentModalBand);
        });
      }

      if (btnCloseModal && wifiModal) {
        btnCloseModal.addEventListener('click', () => {
          wifiModal.style.display = 'none';
        });
      }

      if (wifiModal) {
        wifiModal.addEventListener('click', (e) => {
          if (e.target === wifiModal) wifiModal.style.display = 'none';
        });
      }

      // Modal filters & search
      const modalSearch = document.getElementById('wifiModalSearchInput');
      if (modalSearch) {
        modalSearch.addEventListener('input', (e) => {
          window._renderWifiDirectory('wifiModalGrid', e.target.value, currentModalBand);
        });
      }

      const modalPills = document.querySelectorAll('#wifiModalPills .wifi-pill-btn');
      modalPills.forEach(pill => {
        pill.addEventListener('click', () => {
          modalPills.forEach(p => p.classList.toggle('active', p === pill));
          currentModalBand = pill.dataset.band;
          window._renderWifiDirectory('wifiModalGrid', modalSearch?.value || '', currentModalBand);
        });
      });

      // View section filters & search
      const viewSearch = document.getElementById('wifiViewSearchInput');
      if (viewSearch) {
        viewSearch.addEventListener('input', (e) => {
          window._renderWifiDirectory('wifiViewGrid', e.target.value, currentViewBand);
        });
      }

      const viewPills = document.querySelectorAll('#wifiViewPills .wifi-pill-btn');
      viewPills.forEach(pill => {
        pill.addEventListener('click', () => {
          viewPills.forEach(p => p.classList.toggle('active', p === pill));
          currentViewBand = pill.dataset.band;
          window._renderWifiDirectory('wifiViewGrid', viewSearch?.value || '', currentViewBand);
        });
      });
    }

    // ========================================================================
    // 🚀 INITIAL BOOTSTRAP
    // ========================================================================
    populateLeaveTeacherSelect();
    renderCampusNoticeBanner();
    render();
    renderFaculty();
    initTimetableFeature();
    initWifiDirectory();
    trackStudentVisitor();
    initLeaveNotificationSystem();
    initDeviceWakeupListeners();
    initOfflineDetection();
    handleInitialRoomFromUrl();
    syncLeavesFromCloud(false);
    setInterval(() => syncLeavesFromCloud(false), 45000);
    // Periodically refresh active notices
    setInterval(() => renderCampusNoticeBanner(), 60000);
    // ⏰ Auto-Hourly Campus Notification Dispatcher (Every 1 Hour)
    setInterval(() => {
      const todayActive = getActiveTodayLeaves();
      notifyFacultyLeaves(todayActive, false);
    }, 60 * 60 * 1000);
  }
});

// --- PWA Installation Logic (Coordinated to NEVER clash with Notification Prompt) ---
let deferredPrompt;
const installModal = document.getElementById('pwaInstallModal');
const btnInstallApp = document.getElementById('btnInstallApp');
const btnCloseInstall = document.getElementById('btnCloseInstall');
const btnNotNowInstall = document.getElementById('btnNotNowInstall');

window._triggerDeferredPwaPrompt = function(delayMs = 3000) {
  setTimeout(() => {
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocal || sessionStorage.getItem('pwa_dismissed')) return;

    // Check if notification banner is currently active
    const notifBanner = document.getElementById('leaveNotificationPromptBanner');
    const isNotifActive = window._isNotifBannerActive || (notifBanner && notifBanner.style.display === 'block');

    if (deferredPrompt && installModal && !isNotifActive) {
      installModal.style.display = 'flex';
    }
  }, delayMs);
};

// Register Service Worker with robust relative path and periodic sync
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const swUrl = './sw.js?v=36';
    navigator.serviceWorker.register(swUrl, { scope: './' }).then(async (registration) => {
      console.log('[SW] Registered successfully with scope:', registration.scope);

      // Register Periodic Background Sync if supported (Chromium Desktop & Android)
      if ('periodicSync' in registration) {
        try {
          await registration.periodicSync.register('srcc-check-leaves', {
            minInterval: 60 * 60 * 1000 // 1 hour background check
          });
          console.log('[SW] Periodic hourly sync active for SRCC leave alerts');
        } catch (e) {
          console.log('[SW] Periodic sync note:', e);
        }
      }
    }).catch(registrationError => {
      console.warn('[SW] Registration note, attempting fallback:', registrationError);
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  });
}

// Catch the install prompt event
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocal || sessionStorage.getItem('pwa_dismissed')) {
    return;
  }

  // If user hasn't granted notifications yet, notification banner will pop up first.
  // Defer PWA modal by 12 seconds so they NEVER appear together!
  const needsNotif = ('Notification' in window && Notification.permission !== 'granted' && !sessionStorage.getItem('srcc_notif_session_dismissed'));
  const delay = needsNotif ? 12000 : 3500;
  window._triggerDeferredPwaPrompt(delay);
});

// Close modal handlers
const closeModal = () => {
  if (installModal) installModal.style.display = 'none';
  sessionStorage.setItem('pwa_dismissed', '1');
};

if (btnCloseInstall) btnCloseInstall.addEventListener('click', closeModal);
if (btnNotNowInstall) btnNotNowInstall.addEventListener('click', closeModal);
if (installModal) {
  installModal.addEventListener('click', (e) => {
    if (e.target === installModal) closeModal();
  });
}

// Install App click handler
if (btnInstallApp) {
  btnInstallApp.addEventListener('click', async () => {
    if (deferredPrompt) {
      if (installModal) installModal.style.display = 'none';
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to install prompt: ${outcome}`);
      deferredPrompt = null;
    }
  });
}

// Hide modal if successfully installed
window.addEventListener('appinstalled', () => {
  installModal.style.display = 'none';
  deferredPrompt = null;
  console.log('PWA was installed');
});
