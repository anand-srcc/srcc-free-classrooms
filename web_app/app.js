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
  // Ensure no stale maintenance lock or overlay remains on client side
  try {
    document.documentElement.classList.remove('srcc-maintenance-locked');
    if (document.body) document.body.classList.remove('srcc-maintenance-locked');
    localStorage.removeItem('srcc_maintenance_mode_enabled');
    const staleOverlay = document.getElementById('srccMaintenanceOverlay');
    if (staleOverlay) staleOverlay.remove();
  } catch (e) {}

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
            const todayIso = new Date().toISOString().split('T')[0];
            const localStored = localStorage.getItem('srcc_faculty_leaves_v2');
            let merged = [...d.leaves];
            if (localStored) {
              const parsed = JSON.parse(localStored);
              if (Array.isArray(parsed)) {
                parsed.forEach(localLeaf => {
                  const endD = localLeaf.end_date || localLeaf.start_date || '';
                  if (!endD || endD >= todayIso) {
                    const exists = merged.some(m => 
                      (m.teacher_id && localLeaf.teacher_id && String(m.teacher_id) === String(localLeaf.teacher_id)) ||
                      (m.teacher_name && localLeaf.teacher_name && m.teacher_name.toLowerCase().trim() === localLeaf.teacher_name.toLowerCase().trim())
                    );
                    if (!exists) {
                      merged.push(localLeaf);
                    }
                  }
                });
              }
            }
            window.SRCC_FACULTY_LEAVES.leaves = merged;
            localStorage.setItem('srcc_faculty_leaves_v2', JSON.stringify(merged));
          } catch (e) {}
          // Re-render faculty leaves view if active
          if (typeof renderFacultyLeavesView === 'function' && document.getElementById('facultyLeavesView')?.style.display !== 'none') {
            try { renderFacultyLeavesView(); } catch (e) {}
          }
          if (typeof renderFaculty === 'function') {
            try { renderFaculty(); } catch (e) {}
          }
          if (typeof renderRooms === 'function') {
            try { renderRooms(); } catch (e) {}
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

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  window.escapeHtml = escapeHtml;

  const academicPeriodsMap = {
    '8:30 AM to 9:30 AM': { num: 1, start: '8:30 AM', end: '9:30 AM' },
    '8:30 AM – 9:30 AM': { num: 1, start: '8:30 AM', end: '9:30 AM' },
    '8:30 AM - 9:30 AM': { num: 1, start: '8:30 AM', end: '9:30 AM' },
    '9:30 AM to 10:30 AM': { num: 2, start: '9:30 AM', end: '10:30 AM' },
    '9:30 AM – 10:30 AM': { num: 2, start: '9:30 AM', end: '10:30 AM' },
    '9:30 AM - 10:30 AM': { num: 2, start: '9:30 AM', end: '10:30 AM' },
    '10:30 AM to 11:30 AM': { num: 3, start: '10:30 AM', end: '11:30 AM' },
    '10:30 AM – 11:30 AM': { num: 3, start: '10:30 AM', end: '11:30 AM' },
    '10:30 AM - 11:30 AM': { num: 3, start: '10:30 AM', end: '11:30 AM' },
    '11:30 AM to 12:30 PM': { num: 4, start: '11:30 AM', end: '12:30 PM' },
    '11:30 AM – 12:30 PM': { num: 4, start: '11:30 AM', end: '12:30 PM' },
    '11:30 AM - 12:30 PM': { num: 4, start: '11:30 AM', end: '12:30 PM' },
    '12:30 PM to 1:30 PM': { num: 5, start: '12:30 PM', end: '1:30 PM' },
    '12:30 PM – 1:30 PM': { num: 5, start: '12:30 PM', end: '1:30 PM' },
    '12:30 PM - 1:30 PM': { num: 5, start: '12:30 PM', end: '1:30 PM' },
    '1:00 PM to 2:00 PM': { num: 5, start: '12:30 PM', end: '1:30 PM' },
    '2:00 PM to 3:00 PM': { num: 6, start: '2:00 PM', end: '3:00 PM' },
    '2:00 PM – 3:00 PM': { num: 6, start: '2:00 PM', end: '3:00 PM' },
    '2:00 PM - 3:00 PM': { num: 6, start: '2:00 PM', end: '3:00 PM' },
    '3:00 PM to 4:00 PM': { num: 7, start: '3:00 PM', end: '4:00 PM' },
    '3:00 PM – 4:00 PM': { num: 7, start: '3:00 PM', end: '4:00 PM' },
    '3:00 PM - 4:00 PM': { num: 7, start: '3:00 PM', end: '4:00 PM' },
    '4:00 PM to 5:00 PM': { num: 8, start: '4:00 PM', end: '5:00 PM' },
    '4:00 PM – 5:00 PM': { num: 8, start: '4:00 PM', end: '5:00 PM' },
    '4:00 PM - 5:00 PM': { num: 8, start: '4:00 PM', end: '5:00 PM' },
    '5:00 PM to 6:00 PM': { num: 9, start: '5:00 PM', end: '6:00 PM' },
    '5:00 PM – 6:00 PM': { num: 9, start: '5:00 PM', end: '6:00 PM' },
    '5:00 PM - 6:00 PM': { num: 9, start: '5:00 PM', end: '6:00 PM' }
  };

  function getPeriodInfo(slotStr) {
    if (!slotStr) return null;
    const trimmed = String(slotStr).trim();
    if (academicPeriodsMap[trimmed]) return academicPeriodsMap[trimmed];
    const norm = trimmed.replace(/\s+/g, ' ');
    if (academicPeriodsMap[norm]) return academicPeriodsMap[norm];
    const m = norm.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (m) {
      let hr = parseInt(m[1], 10);
      const ampm = (m[3] || '').toUpperCase();
      if (ampm === 'PM' && hr < 12) hr += 12;
      if (ampm === 'AM' && hr === 12) hr = 0;
      if (hr === 8) return academicPeriodsMap['8:30 AM to 9:30 AM'];
      if (hr === 9) return academicPeriodsMap['9:30 AM to 10:30 AM'];
      if (hr === 10) return academicPeriodsMap['10:30 AM to 11:30 AM'];
      if (hr === 11) return academicPeriodsMap['11:30 AM to 12:30 PM'];
      if (hr === 12 || hr === 13) return academicPeriodsMap['12:30 PM to 1:30 PM'];
      if (hr === 14) return academicPeriodsMap['2:00 PM to 3:00 PM'];
      if (hr === 15) return academicPeriodsMap['3:00 PM to 4:00 PM'];
      if (hr === 16) return academicPeriodsMap['4:00 PM to 5:00 PM'];
      if (hr === 17) return academicPeriodsMap['5:00 PM to 6:00 PM'];
    }
    const parts = trimmed.split(/\s*(?:to|–|-)\s*/i);
    return { num: 99, start: parts[0] || trimmed, end: parts[1] || '' };
  }
  window.getPeriodInfo = getPeriodInfo;

  function initApp() {
    if (!appData && window.SRCC_DATA) {
      appData = window.SRCC_DATA;
    }
    if (!teachersData && window.SRCC_TEACHERS_DATA) {
      teachersData = window.SRCC_TEACHERS_DATA;
    }
    if (!leavesData && window.SRCC_FACULTY_LEAVES) {
      leavesData = window.SRCC_FACULTY_LEAVES;
    }

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

      // Check cancelled leaves from admin
      let cancelledList = [];
      try {
        const cStored = localStorage.getItem('srcc_cancelled_faculty_leaves_v1');
        if (cStored) cancelledList = JSON.parse(cStored);
      } catch (e) {}

      function isCancelled(tId, tName) {
        const idKey = tId ? String(tId) : '';
        const nameKey = tName ? tName.toLowerCase().trim() : '';
        return cancelledList.some(c => (idKey && c.id === idKey) || (nameKey && c.name === nameKey));
      }

      // 1. Load authoritative leaves from scraper/server (window.SRCC_FACULTY_LEAVES or leavesData)
      const activeSource = (window.SRCC_FACULTY_LEAVES && Array.isArray(window.SRCC_FACULTY_LEAVES.leaves))
        ? window.SRCC_FACULTY_LEAVES
        : leavesData;
      if (activeSource && Array.isArray(activeSource.leaves)) {
        activeSource.leaves.forEach(l => {
          if (isCancelled(l.teacher_id, l.teacher_name)) return;
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
              if (isCancelled(l.teacher_id, l.teacher_name)) return;
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
    function getDateForDayName(targetDayName) {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const now = new Date();
      const currentDayIdx = now.getDay();
      const targetIdx = days.indexOf(targetDayName);
      if (targetIdx === -1) return getTodayIsoDate();
      const diff = targetIdx - currentDayIdx;
      const targetDate = new Date(now);
      targetDate.setDate(now.getDate() + diff);
      const y = targetDate.getFullYear();
      const m = String(targetDate.getMonth() + 1).padStart(2, '0');
      const d = String(targetDate.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    function getRoomActiveLocks(roomCode, checkDateStr, checkDayName) {
      const targetDayName = checkDayName || (state && state.activeDay) || (typeof getTodayDayName === 'function' ? getTodayDayName() : 'Monday');
      const targetDate = checkDateStr || getDateForDayName(targetDayName);
      const targetRoom = (roomCode || '').trim().toUpperCase();

      return (roomLocksList || []).filter(lock => {
        const lockRoom = (lock.room || '').trim().toUpperCase();
        if (lockRoom !== targetRoom && lockRoom.replace(/\s+/g, '') !== targetRoom.replace(/\s+/g, '')) {
          return false;
        }

        const recurrence = lock.recurrence || 'once';
        let isActive = false;
        if (recurrence === 'once') {
          if (lock.date === targetDate) {
            isActive = true;
          } else if (lock.date) {
            try {
              const lockDateObj = new Date(lock.date + 'T00:00:00');
              const lockDay = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][lockDateObj.getDay()];
              if (lockDay === targetDayName && (!checkDateStr || lock.date === targetDate)) {
                isActive = true;
              }
            } catch (e) {}
          }
        } else if (recurrence === 'weekend') {
          isActive = (targetDayName === 'Saturday' || targetDayName === 'Sunday');
        } else if (recurrence === 'daily') {
          isActive = (targetDayName !== 'Sunday');
        } else if (recurrence === 'weekly') {
          isActive = Array.isArray(lock.recurring_days) && lock.recurring_days.includes(targetDayName);
        } else {
          isActive = (lock.date === targetDate);
        }

        if (isActive && lock.date && recurrence !== 'once' && targetDate < lock.date) {
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

      const issueDateStr = notice.created_at ? notice.created_at.slice(0, 10) : todayIso;
      const formattedIssueDate = (typeof formatIsoToDdMmYyyy === 'function') ? formatIsoToDdMmYyyy(issueDateStr) : issueDateStr;
      const formattedExpiryDate = notice.expiry_date ? ((typeof formatIsoToDdMmYyyy === 'function') ? formatIsoToDdMmYyyy(notice.expiry_date) : notice.expiry_date) : '';
      const catBadge = categoryBadges[notice.category] || categoryBadges.circular;
      const hasAttachment = !!(notice.attachment && notice.attachment.dataUrl);

      container.innerHTML = `
        <div class="campus-notice-card ${notice.pinned ? 'is-pinned-notice' : ''}">
          <div class="campus-notice-header" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            ${catBadge}
            <span class="campus-notice-issue-date" style="font-size: 0.74rem; color: #475569; font-weight: 700; background: rgba(0,0,0,0.04); padding: 2px 7px; border-radius: 6px;">
              📅 Issued: ${formattedIssueDate}
            </span>
            ${notice.event_date ? `<span class="campus-notice-event-date" style="font-size: 0.74rem; font-weight: 600; color: #0369a1;">🗓️ Event: ${escapeHtml(notice.event_date)}</span>` : ''}
            ${formattedExpiryDate ? `<span class="campus-notice-expiry-date" style="font-size: 0.72rem; color: #64748b; font-weight: 600; margin-left: auto;">⏳ Valid till: ${formattedExpiryDate}</span>` : ''}
          </div>
          <h3 class="campus-notice-title" style="margin-top: 8px;">${escapeHtml(notice.title)}</h3>
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

      if (typeof openAppModal === 'function') {
        openAppModal(modal);
      } else {
        modal.style.display = 'flex';
      }
    }

    const btnCloseStudentModal = document.getElementById('btnCloseStudentAttachmentModal');
    const studentModal = document.getElementById('studentAttachmentModal');
    if (btnCloseStudentModal && studentModal) {
      btnCloseStudentModal.addEventListener('click', () => {
        if (typeof closeAppModal === 'function') closeAppModal(studentModal);
        else studentModal.style.display = 'none';
      });
      studentModal.addEventListener('click', (e) => {
        if (e.target === studentModal) {
          if (typeof closeAppModal === 'function') closeAppModal(studentModal);
          else studentModal.style.display = 'none';
        }
      });
    }



    function isRoomLocked(roomCode, slot, checkDateStr) {
      const locks = getRoomActiveLocks(roomCode, checkDateStr);
      if (!locks || locks.length === 0) return false;
      if (locks.some(l => l.slot === 'ALL_DAY')) return true;
      if (slot && locks.some(l => l.slot === slot)) return true;
      return false;
    }

    function isTeacherOnLeave(teacher, checkDateStr, checkSlotStr) {
      if (!teacher) return null;
      const targetDate = checkDateStr || getTodayIsoDate();
      const allLeaves = getLeavesList();

      const tCode = (teacher.short_code || '').toLowerCase().trim();
      const tClean = (teacher.clean_name || teacher.name || '').replace(/^(?:(?:dr|prof|mr|ms|mrs|ca|cma)\.?\s+)/i, '').toLowerCase().trim();
      const tId = String(teacher.id || '').trim();

      return allLeaves.find(leave => {
        const lId = String(leave.teacher_id || '').trim();
        const lCode = String(leave.teacher_code || '').toLowerCase().trim();
        const lClean = String(leave.clean_name || leave.teacher_name || '').replace(/^(?:(?:dr|prof|mr|ms|mrs|ca|cma)\.?\s+)/i, '').toLowerCase().trim();

        // If both have explicit IDs and they differ, they CANNOT be the same teacher
        if (lId && tId && lId !== tId) {
          return false;
        }

        // 1. Direct ID match
        const matchId = Boolean(lId && tId && lId === tId);

        // 2. Short code match (only if codes match and IDs don't conflict)
        const matchCode = Boolean(tCode && lCode && (
          lCode === tCode ||
          (lCode && lCode.split(/\s*[\/,]\s*/).includes(tCode))
        ));

        // 3. Strict Normalized Name match (avoid loose substrings like "Anju" matching "Anju Verma")
        const matchName = Boolean(lClean && tClean && lClean === tClean);

        if (matchId || matchCode || matchName) {
          if (!leave.start_date && !leave.end_date) return true;
          const s = leave.start_date || '2000-01-01';
          const e = leave.end_date || '2099-12-31';
          const inRange = (targetDate >= s && targetDate <= e);
          if (!inRange) return false;

          // Check half-day restrictions if slot is provided
          if (checkSlotStr && (leave.half_day || leave.isHalfDay)) {
            const pInfo = typeof getPeriodInfo === 'function' ? getPeriodInfo(checkSlotStr) : null;
            const periodNum = pInfo ? pInfo.num : 1;
            const halfSlot = String(leave.half_day_slot || 'morning').toLowerCase();
            if (halfSlot === 'morning' && periodNum > 4) return false;
            if (halfSlot === 'afternoon' && periodNum <= 4) return false;
          }

          return true;
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
      const todayDate = getDateForDayName(day);

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
          const leave = isTeacherOnLeave(t, todayDate, slot);
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
      showEmails: false,
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
    const btnShareTeacherProfile = document.getElementById('btnShareTeacherProfile');
    const btnPrintTeacherTimetable = document.getElementById('btnPrintTeacherTimetable');

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
    // ⏰ ACADEMIC PERIODS MAP & LOOKUP HELPER (GLOBAL)
    // ========================================================================
    const academicPeriodsMap = {
      '8:30 AM to 9:30 AM': { num: 1, start: '8:30 AM', end: '9:30 AM' },
      '8:30 AM – 9:30 AM': { num: 1, start: '8:30 AM', end: '9:30 AM' },
      '8:30 AM - 9:30 AM': { num: 1, start: '8:30 AM', end: '9:30 AM' },
      '9:30 AM to 10:30 AM': { num: 2, start: '9:30 AM', end: '10:30 AM' },
      '9:30 AM – 10:30 AM': { num: 2, start: '9:30 AM', end: '10:30 AM' },
      '9:30 AM - 10:30 AM': { num: 2, start: '9:30 AM', end: '10:30 AM' },
      '10:30 AM to 11:30 AM': { num: 3, start: '10:30 AM', end: '11:30 AM' },
      '10:30 AM – 11:30 AM': { num: 3, start: '10:30 AM', end: '11:30 AM' },
      '10:30 AM - 11:30 AM': { num: 3, start: '10:30 AM', end: '11:30 AM' },
      '11:30 AM to 12:30 PM': { num: 4, start: '11:30 AM', end: '12:30 PM' },
      '11:30 AM – 12:30 PM': { num: 4, start: '11:30 AM', end: '12:30 PM' },
      '11:30 AM - 12:30 PM': { num: 4, start: '11:30 AM', end: '12:30 PM' },
      '12:30 PM to 1:30 PM': { num: 5, start: '12:30 PM', end: '1:30 PM' },
      '12:30 PM – 1:30 PM': { num: 5, start: '12:30 PM', end: '1:30 PM' },
      '12:30 PM - 1:30 PM': { num: 5, start: '12:30 PM', end: '1:30 PM' },
      '1:00 PM to 2:00 PM': { num: 5, start: '12:30 PM', end: '1:30 PM' },
      '2:00 PM to 3:00 PM': { num: 6, start: '2:00 PM', end: '3:00 PM' },
      '2:00 PM – 3:00 PM': { num: 6, start: '2:00 PM', end: '3:00 PM' },
      '2:00 PM - 3:00 PM': { num: 6, start: '2:00 PM', end: '3:00 PM' },
      '3:00 PM to 4:00 PM': { num: 7, start: '3:00 PM', end: '4:00 PM' },
      '3:00 PM – 4:00 PM': { num: 7, start: '3:00 PM', end: '4:00 PM' },
      '3:00 PM - 4:00 PM': { num: 7, start: '3:00 PM', end: '4:00 PM' },
      '4:00 PM to 5:00 PM': { num: 8, start: '4:00 PM', end: '5:00 PM' },
      '4:00 PM – 5:00 PM': { num: 8, start: '4:00 PM', end: '5:00 PM' },
      '4:00 PM - 5:00 PM': { num: 8, start: '4:00 PM', end: '5:00 PM' },
      '5:00 PM to 6:00 PM': { num: 9, start: '5:00 PM', end: '6:00 PM' },
      '5:00 PM – 6:00 PM': { num: 9, start: '5:00 PM', end: '6:00 PM' },
      '5:00 PM - 6:00 PM': { num: 9, start: '5:00 PM', end: '6:00 PM' }
    };

    function getPeriodInfo(slotStr) {
      if (!slotStr) return null;
      const trimmed = String(slotStr).trim();
      if (academicPeriodsMap[trimmed]) return academicPeriodsMap[trimmed];
      const norm = trimmed.replace(/\s+/g, ' ');
      if (academicPeriodsMap[norm]) return academicPeriodsMap[norm];
      const m = norm.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
      if (m) {
        let hr = parseInt(m[1], 10);
        const ampm = (m[3] || '').toUpperCase();
        if (ampm === 'PM' && hr < 12) hr += 12;
        if (ampm === 'AM' && hr === 12) hr = 0;
        if (hr === 8) return academicPeriodsMap['8:30 AM to 9:30 AM'];
        if (hr === 9) return academicPeriodsMap['9:30 AM to 10:30 AM'];
        if (hr === 10) return academicPeriodsMap['10:30 AM to 11:30 AM'];
        if (hr === 11) return academicPeriodsMap['11:30 AM to 12:30 PM'];
        if (hr === 12 || hr === 13) return academicPeriodsMap['12:30 PM to 1:30 PM'];
        if (hr === 14) return academicPeriodsMap['2:00 PM to 3:00 PM'];
        if (hr === 15) return academicPeriodsMap['3:00 PM to 4:00 PM'];
        if (hr === 16) return academicPeriodsMap['4:00 PM to 5:00 PM'];
        if (hr === 17) return academicPeriodsMap['5:00 PM to 6:00 PM'];
      }
      const parts = trimmed.split(/\s*(?:to|–|-)\s*/i);
      return { num: 99, start: parts[0] || trimmed, end: parts[1] || '' };
    }
    window.getPeriodInfo = getPeriodInfo;

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
      return null;
    }

    // ========================================================================
    // 🔔 TOAST HELPER
    // ========================================================================
    function showToast(message, isCopied = false, duration = 3000) {
      if (!toastContainer) return;
      toastContainer.innerHTML = ''; // Never stack multiple toasts
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
    const headerDateFormatted = istNow.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

    const elHeaderSync = document.getElementById('lastUpdatedHeader');
    const elRibbonSync = document.getElementById('statLastSynced');
    const elFooterSync = document.getElementById('footerLastSynced');

    if (elHeaderSync) {
      elHeaderSync.textContent = `Today, ${todayDateFormatted}`;
      elHeaderSync.title = `Official SRCC Timetable Synced: Today, ${todayDateFormatted}`;
    }
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
    // 📱 MOBILE NAVIGATION & MODAL MANAGEMENT HELPERS
    // ========================================================================
    function updateBottomNavActiveState() {
      const isRoomsStandard = (state.activeMode === 'rooms') && !state.freeNowActive;
      if (bnavRooms) bnavRooms.classList.toggle('active', isRoomsStandard);
      if (bnavFaculty) bnavFaculty.classList.toggle('active', state.activeMode === 'faculty');
      if (bnavTimetable) bnavTimetable.classList.toggle('active', state.activeMode === 'timetable');
      if (bnavFreeNow) bnavFreeNow.classList.toggle('active', state.activeMode === 'rooms' && state.freeNowActive);
      const bnavMenu = document.getElementById('bnavMenu');
      if (bnavMenu) bnavMenu.classList.remove('active');
      if (bnavWifi) bnavWifi.classList.remove('active');
    }
    window._updateBottomNavActiveState = updateBottomNavActiveState;

    let _modalHistoryDepth = 0;
    let _lastPopStateTime = 0;

    function getCurrentlyOpenModal() {
      const popups = [
        document.getElementById('scheduleModal'),
        document.getElementById('teacherModal'),
        document.getElementById('wifiModal'),
        document.getElementById('leaveManagerModal'),
        document.getElementById('reportIssueModal'),
        document.getElementById('widgetModal'),
        document.getElementById('facultyEmailModal'),
        document.getElementById('shareModal'),
        document.getElementById('calendarReminderModal'),
        document.getElementById('studentAttachmentModal'),
        document.getElementById('classNotifModal'),
        document.getElementById('pwaInstallModal')
      ];
      return popups.find(m => m && (m.style.display === 'flex' || m.style.display === 'block'));
    }

    function closeAllPopups(options = {}) {
      const popups = [
        document.getElementById('wifiModal'),
        document.getElementById('facultyEmailModal'),
        document.getElementById('scheduleModal'),
        document.getElementById('teacherModal'),
        document.getElementById('shareModal'),
        document.getElementById('calendarReminderModal'),
        document.getElementById('studentAttachmentModal'),
        document.getElementById('leaveManagerModal'),
        document.getElementById('reportIssueModal'),
        document.getElementById('widgetModal'),
        document.getElementById('ugcfGuidanceModal'),
        document.getElementById('classNotifModal'),
        document.getElementById('pwaInstallModal')
      ];
      popups.forEach(m => {
        if (m) m.style.display = 'none';
      });

      const campusDrawerOverlay = document.getElementById('campusDrawerOverlay');
      if (campusDrawerOverlay) {
        campusDrawerOverlay.classList.remove('open');
        campusDrawerOverlay.style.display = 'none';
      }

      document.body.classList.remove('modal-open');
      document.body.classList.remove('print-room-modal-active');
      document.body.classList.remove('print-teacher-modal-active');
      updateBottomNavActiveState();
      if (!options.fromPopState) {
        _modalHistoryDepth = 0;
      }
    }
    window._closeAllPopups = closeAllPopups;

    // ========================================================================
    // 🔀 MULTI-MODE SWITCHING (ROOMS ⇄ FACULTY ⇄ TIMETABLE)
    // ========================================================================
    function setAppMode(mode, preserveFilters = false, options = {}) {
      const isBackNav = Boolean(options && options.isBackNav);
      const isInitial = Boolean(options && options.isInitial);
      const replace = Boolean(options && options.replace);

      // If already in this mode and not a back nav, scroll to top and return
      if (state.activeMode === mode && !isBackNav && !options.force) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      // Dismiss any open popups/modals whenever navigating or switching tabs
      closeAllPopups({ fromPopState: isBackNav });
      if (mode === 'leaves') {
        openFacultyLeavesView();
        return;
      }
      // WiFi option temporarily hidden pending administrative permission
      if (mode === 'wifi') {
        mode = 'rooms';
      }
      state.activeMode = mode;
      const isRooms = (mode === 'rooms');
      const isFaculty = (mode === 'faculty');
      const isTimetable = (mode === 'timetable');
      const isDirectory = (mode === 'directory');
      const isNotices = (mode === 'notices');
      const isExamCodes = (mode === 'exam_codes');
      const isWifi = (mode === 'wifi');

      // Update browser history & URL hash for smooth mobile back navigation
      const targetHash = '#' + mode;
      const stateObj = { type: 'tab', mode: mode };

      if (replace || isInitial) {
        try {
          window.history.replaceState(stateObj, '', targetHash);
        } catch (e) {}
      } else if (!isBackNav) {
        if (window.location.hash !== targetHash) {
          try {
            window.history.pushState(stateObj, '', targetHash);
          } catch (e) {}
        }
      }

      // Strip any lingering tour spotlight highlight classes
      document.querySelectorAll('.tour-target-highlight').forEach(el => el.classList.remove('tour-target-highlight'));

      // Cleanly update top mode switcher tabs
      document.querySelectorAll('.app-mode-switcher .mode-tab').forEach(tab => {
        const m = tab.dataset.mode;
        const isActive = (m === mode);
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        if (!isActive) {
          try { tab.blur(); } catch (e) {}
        }
      });

      const tabModeDirectory = document.getElementById('tabModeDirectory');
      if (tabModeDirectory) {
        tabModeDirectory.classList.toggle('active', isDirectory);
        tabModeDirectory.setAttribute('aria-selected', isDirectory ? 'true' : 'false');
      }
      const tabModeNotices = document.getElementById('tabModeNotices');
      if (tabModeNotices) {
        tabModeNotices.classList.toggle('active', isNotices);
        tabModeNotices.setAttribute('aria-selected', isNotices ? 'true' : 'false');
      }
      const tabModeExamCodes = document.getElementById('tabModeExamCodes');
      if (tabModeExamCodes) {
        tabModeExamCodes.classList.toggle('active', isExamCodes);
        tabModeExamCodes.setAttribute('aria-selected', isExamCodes ? 'true' : 'false');
      }
      const tabModeWifi = document.getElementById('tabModeWifi');
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
      const viewNoticesSection = document.getElementById('viewNoticesSection');
      if (viewNoticesSection) {
        viewNoticesSection.style.display = isNotices ? 'block' : 'none';
        if (isNotices && typeof window._renderCollegeNotices === 'function') {
          window._renderCollegeNotices();
        }
      }
      const viewExamCodesSection = document.getElementById('viewExamCodesSection');
      if (viewExamCodesSection) {
        viewExamCodesSection.style.display = isExamCodes ? 'block' : 'none';
        if (isExamCodes && typeof window._renderExamCodesDirectory === 'function') {
          window._renderExamCodesDirectory();
        }
      }

      // Update mobile bottom nav
      const isRoomsStandard = isRooms && !state.freeNowActive;
      if (bnavRooms) bnavRooms.classList.toggle('active', isRoomsStandard);
      if (bnavFaculty) bnavFaculty.classList.toggle('active', isFaculty);
      if (bnavTimetable) bnavTimetable.classList.toggle('active', isTimetable);
      const bnavMenu = document.getElementById('bnavMenu');
      if (bnavMenu) bnavMenu.classList.remove('active');
      const bnavNotices = document.getElementById('bnavNotices');
      if (bnavNotices) bnavNotices.classList.toggle('active', isNotices);
      const bnavExamCodes = document.getElementById('bnavExamCodes');
      if (bnavExamCodes) bnavExamCodes.classList.toggle('active', isExamCodes);
      if (bnavWifi) bnavWifi.classList.toggle('active', isWifi);
      if (bnavFreeNow) bnavFreeNow.classList.toggle('active', isRooms && state.freeNowActive);

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
    window.setAppMode = setAppMode;

    if (tabModeRooms) tabModeRooms.addEventListener('click', () => setAppMode('rooms'));
    if (tabModeFaculty) tabModeFaculty.addEventListener('click', () => setAppMode('faculty'));
    if (tabModeTimetable) tabModeTimetable.addEventListener('click', () => setAppMode('timetable'));
    const tabModeExamCodes = document.getElementById('tabModeExamCodes');
    if (tabModeExamCodes) tabModeExamCodes.addEventListener('click', () => setAppMode('exam_codes'));
    const tabModeWifiBtn = document.getElementById('tabModeWifi');
    if (tabModeWifiBtn) tabModeWifiBtn.addEventListener('click', () => setAppMode('wifi'));
    if (bnavRooms) {
      bnavRooms.addEventListener('click', () => {
        closeAllPopups();
        if (state.freeNowActive) {
          setFreeNowState(false);
        }
        setAppMode('rooms');
      });
    }
    if (bnavFaculty) {
      bnavFaculty.addEventListener('click', () => {
        closeAllPopups();
        setAppMode('faculty');
      });
    }
    if (bnavTimetable) {
      bnavTimetable.addEventListener('click', () => {
        closeAllPopups();
        setAppMode('timetable');
      });
    }
    if (bnavWifi) {
      bnavWifi.addEventListener('click', (e) => {
        e.preventDefault();
        const wifiModal = document.getElementById('wifiModal');
        if (wifiModal && wifiModal.style.display === 'flex') {
          if (typeof window._closeWifiModal === 'function') {
            window._closeWifiModal();
          } else {
            wifiModal.style.display = 'none';
            document.body.classList.remove('modal-open');
            updateBottomNavActiveState();
          }
        } else {
          if (typeof window._openWifiModal === 'function') {
            window._openWifiModal();
          } else {
            const btnOpenHeader = document.getElementById('btnOpenWifiModal');
            if (btnOpenHeader) btnOpenHeader.click();
            else if (wifiModal) wifiModal.style.display = 'flex';
          }
        }
      });
    }
    const btnHeaderTimetable = document.getElementById('btnHeaderTimetable');
    if (btnHeaderTimetable) btnHeaderTimetable.addEventListener('click', () => setAppMode('timetable'));
    const tabModeNoticesBtn = document.getElementById('tabModeNotices');
    if (tabModeNoticesBtn) tabModeNoticesBtn.addEventListener('click', () => setAppMode('notices'));
    const bnavNoticesBtn = document.getElementById('bnavNotices');
    if (bnavNoticesBtn) {
      bnavNoticesBtn.addEventListener('click', () => {
        closeAllPopups();
        setAppMode('notices');
      });
    }
    const bnavExamCodesBtn = document.getElementById('bnavExamCodes');
    if (bnavExamCodesBtn) {
      bnavExamCodesBtn.addEventListener('click', () => {
        closeAllPopups();
        setAppMode('exam_codes');
      });
    }
    const btnHeaderNotices = document.getElementById('btnHeaderNotices');
    if (btnHeaderNotices) btnHeaderNotices.addEventListener('click', () => setAppMode('notices'));
    const btnNoticesBack = document.getElementById('btnNoticesBack');
    if (btnNoticesBack) {
      btnNoticesBack.addEventListener('click', (e) => {
        e.preventDefault();
        setAppMode('rooms');
      });
    }

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
      if (bnavRooms) bnavRooms.classList.toggle('active', state.activeMode === 'rooms' && !isActive);

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
        closeAllPopups();
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

    // Modal Helpers with Mobile Scroll Lock (body.modal-open) & Print Context Tracker
    function openAppModal(modalEl, options = {}) {
      if (!modalEl) return;
      modalEl.style.display = 'flex';
      document.body.classList.add('modal-open');
      if (modalEl === scheduleModal) {
        document.body.classList.add('print-room-modal-active');
        document.body.classList.remove('print-teacher-modal-active');
      } else if (modalEl === teacherModal) {
        document.body.classList.add('print-teacher-modal-active');
        document.body.classList.remove('print-room-modal-active');
      }

      // History Management: Push modal state so mobile back button closes the modal cleanly!
      if (!options.fromPopState && !options.noHistory) {
        let modalHash = '#' + (modalEl.id || 'modal');
        if (modalEl === scheduleModal && currentModalRoomCode) {
          modalHash = '#room-' + encodeURIComponent(currentModalRoomCode);
        } else if (modalEl === teacherModal && facultyState.modalActiveTeacher) {
          modalHash = '#faculty-' + encodeURIComponent(facultyState.modalActiveTeacher.id || facultyState.modalActiveTeacher.clean_name);
        } else if (modalEl.id === 'wifiModal') {
          modalHash = '#wifi';
        }

        const stateObj = {
          type: 'modal',
          modalId: modalEl.id,
          roomCode: currentModalRoomCode || null,
          teacherId: facultyState?.modalActiveTeacher?.id || null,
          mode: state.activeMode
        };

        if (window.location.hash !== modalHash) {
          try {
            window.history.pushState(stateObj, '', modalHash);
            _modalHistoryDepth++;
          } catch (e) {}
        }
      }
    }
    window.openAppModal = openAppModal;

    function closeAppModal(modalEl, options = {}) {
      if (!modalEl) return;
      modalEl.style.display = 'none';
      if (modalEl === scheduleModal) {
        document.body.classList.remove('print-room-modal-active');
      } else if (modalEl === teacherModal) {
        document.body.classList.remove('print-teacher-modal-active');
      }
      const anyOpen = [
        scheduleModal, shareModal, teacherModal, leaveManagerModal,
        reportIssueModal, document.getElementById('facultyEmailModal'),
        document.getElementById('wifiModal'), widgetModal, installModal,
        document.getElementById('calendarReminderModal'),
        document.getElementById('studentAttachmentModal'),
        document.getElementById('classNotifModal')
      ].some(m => m && (m.style.display === 'flex' || m.style.display === 'block'));

      if (!anyOpen) {
        document.body.classList.remove('modal-open');
        document.body.classList.remove('print-room-modal-active');
        document.body.classList.remove('print-teacher-modal-active');
      }

      // If user closed modal via UI ('X' button or backdrop) and we pushed history for it, pop via history.back()
      if (!options.fromPopState && _modalHistoryDepth > 0) {
        _modalHistoryDepth--;
        try {
          window.history.back();
        } catch (e) {}
      } else if (!options.fromPopState && _modalHistoryDepth === 0) {
        // Direct link or initial load: restore clean tab hash without exiting site
        const tabHash = '#' + (state.activeMode || 'rooms');
        if (window.location.hash !== tabHash) {
          try {
            window.history.replaceState({ type: 'tab', mode: state.activeMode || 'rooms' }, '', tabHash);
          } catch (e) {}
        }
      }
    }
    window.closeAppModal = closeAppModal;

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

    // Widget Feature Modal Handlers
    const widgetModal = document.getElementById('widgetModal');
    const btnOpenWidgetModal = document.getElementById('btnOpenWidgetModal');
    const btnOpenWidgetFromTt = document.getElementById('btnOpenWidgetFromTt');
    const btnWidgetModalClose = document.getElementById('btnWidgetModalClose');
    const btnCopyWidgetUrl = document.getElementById('btnCopyWidgetUrl');

    function openWidgetModal() {
      if (widgetModal) openAppModal(widgetModal);
    }
    if (btnOpenWidgetModal) btnOpenWidgetModal.addEventListener('click', openWidgetModal);
    if (btnOpenWidgetFromTt) btnOpenWidgetFromTt.addEventListener('click', openWidgetModal);
    if (btnWidgetModalClose) btnWidgetModalClose.addEventListener('click', () => { closeAppModal(widgetModal); });
    if (widgetModal) {
      widgetModal.addEventListener('click', (e) => {
        if (e.target === widgetModal) closeAppModal(widgetModal);
      });
    }
    if (btnCopyWidgetUrl) {
      btnCopyWidgetUrl.addEventListener('click', () => {
        const base = (window.location.origin + window.location.pathname).replace(/\/+$/, '');
        const widgetUrl = `${base}/widget.html`;
        copyToClipboard(widgetUrl).then(() => {
          showToast('📋 Copied Standalone Widget Link!');
        });
      });
    }

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (scheduleModal && scheduleModal.style.display !== 'none') closeAppModal(scheduleModal);
        else if (widgetModal && widgetModal.style.display !== 'none') closeAppModal(widgetModal);
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
      if (words.includes(qNoSpace)) return true;

      // Also match by teacher or subject currently scheduled in this room
      const sched = room.schedule ? room.schedule[state.activeDay] : null;
      if (sched && Array.isArray(sched.occupied_slots)) {
        for (const occ of sched.occupied_slots) {
          const clsText = (occ.class || '').toLowerCase();
          if (clsText.includes(q) || clsText.replace(/[\s\-_]/g, '').includes(qNoSpace)) return true;
        }
      }
      return false;
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

    function formatContinuousFreeSlots(freeSlots) {
      if (!freeSlots || freeSlots.length === 0) return ['Only Lunch Recess (1:30 PM – 2:00 PM)'];
      const parsed = freeSlots.map(s => {
        const parts = s.split(/\s*(?:to|–|-)\s*/i);
        return { start: parts[0]?.trim(), end: parts[1]?.trim() };
      });
      const merged = [];
      for (let i = 0; i < parsed.length; i++) {
        const curr = parsed[i];
        if (merged.length > 0 && merged[merged.length - 1].end === curr.start) {
          merged[merged.length - 1].end = curr.end;
        } else {
          merged.push({ start: curr.start, end: curr.end });
        }
      }
      return merged.map(m => `${m.start} – ${m.end}`);
    }

    function openShareModal(roomCode, showQrDirectly = false) {
      const room = appData.rooms.find(r => r.code === roomCode);
      if (!room) return;

      const sched = room.schedule[state.activeDay] || { free_slots: [] };
      const freeSlotsFormatted = formatContinuousFreeSlots(sched.free_slots)
        .map(s => `  • ${s}`).join('\n');

      const currentSiteBase = (window.location.origin + window.location.pathname).replace(/\/+$/, '');
      const directRoomUrl = `${currentSiteBase}/?room=${encodeURIComponent(room.code)}`;
      const activeDateStr = getDateForDay(state.activeDay);
      const dayAndDateDisplay = `${state.activeDay}, ${activeDateStr}`;
      const loc = getRoomLocationMeta(room.code);
      const locDisplay = `${loc.floor} • ${loc.wing}`;

      const cleanMessage = `🎓 SRCC Classroom Vacancy Alert

📍 Room: ${room.code} (${room.name})
🏢 Location: ${locDisplay} (${loc.landmark})
🗓️ Day & Date: ${dayAndDateDisplay}

🕒 Free Academic Slots:
${freeSlotsFormatted}

🔗 Live Schedule:
${directRoomUrl}`;

      const whatsappMessage = `🎓 *SRCC Classroom Vacancy Alert*

📍 *Room:* ${room.code} (${room.name})
🏢 *Location:* ${locDisplay} (${loc.landmark})
🗓️ *Day & Date:* ${dayAndDateDisplay}

🕒 *Free Academic Slots:*
${freeSlotsFormatted}

🔗 *Live Schedule:*
${directRoomUrl}`;

      const tweetText = `🎓 SRCC Vacancy: Room ${room.code} is FREE on ${dayAndDateDisplay}! Check live schedule:`;
      const emailSubject = `SRCC Room Vacancy: ${room.code} (${dayAndDateDisplay})`;

      // Direct mobile share sheet: Open WhatsApp/native app share directly on phones
      const isMobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (window.innerWidth <= 768);
      if (isMobileDevice && navigator.share) {
        navigator.share({
          title: `SRCC Room ${room.code} Vacancy Alert`,
          text: whatsappMessage
        }).catch(() => {});
        return;
      }

      currentShareMessage = cleanMessage;

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
        shareBtnX.href = `https://x.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodedUrl}`;
      }
      if (shareBtnTelegram) {
        shareBtnTelegram.href = `https://t.me/share/url?text=${encodedCleanMsg}&url=${encodedUrl}`;
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
        const activeDate = getDateForDayName(state.activeDay);
        const activeRoomLocks = getRoomActiveLocks(room.code, activeDate, state.activeDay);
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
            return `<div class="slot-chip" style="background: rgba(147, 51, 234, 0.08); color: #7e22ce; border: 1px solid rgba(147, 51, 234, 0.25);" title="Lecture suspended: Prof. ${escapeHtml(b.teacher.clean_name)} on leave">✨ ${escapeHtml(b.slot.replace(' to ', '–'))} (On Leave)</div>`;
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
            ? `${p.full}: Vacant · Faculty on Leave`
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
            ? `${p.full}: Vacant · Faculty on Leave`
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
               <span><strong>Extra Free Slot:</strong> Faculty on leave</span>
             </div>`
          : '';

        const catBadgeClass = getCategoryBadgeClass(room.category);

        const unavailableBadgeHtml = isUnavailable
          ? `<span class="badge-room-unavailable">🛠️ Unavailable</span>`
          : '';

        const unavailableCalloutHtml = isUnavailable
          ? `<div class="unavailable-callout">
               <span>🛠️</span>
               <span><strong>Under Maintenance:</strong> ${escapeHtml(roomOv.reason || 'Temporarily Unavailable')}${roomOv.duration ? ` (${escapeHtml(roomOv.duration)})` : ''}</span>
             </div>`
          : '';

        const isGenericName = (room.name === `Lecture Classroom ${room.code.replace(/\D+/g, '')}` || 
                               room.name === `Tutorial Room ${room.code.replace(/\D+/g, '')}` ||
                               room.name === `Classroom ${room.code.replace(/\D+/g, '')}`);

        const loc = getRoomLocationMeta(room.code);

        return `
          <article class="room-card ${cardStyleClass} ${themeClass}" data-room-code="${escapeHtml(room.code)}">
            <div class="card-header room-card-header">
              <div class="card-title-group">
                <div class="card-room-code">${escapeHtml(room.code)}</div>
                ${(!isGenericName && room.name) ? `<div class="card-room-name">${escapeHtml(room.name)}</div>` : ''}
              </div>
              <div class="card-meta-badges">
                <span class="badge-capacity">${escapeHtml(room.capacity)} Seats</span>
                ${unavailableBadgeHtml}
              </div>
            </div>

            <div class="card-room-loc-badge" title="${escapeHtml(loc.wing)} (${escapeHtml(loc.landmark)})">
              <span class="card-loc-floor">${escapeHtml(loc.floor)}</span>
              <span class="card-loc-wing">• ${escapeHtml(loc.wing)}</span>
            </div>

            ${unavailableCalloutHtml}
            ${roomLockBannersHtml}
            ${bonusBannerHtml}

            <div class="card-timeline-wrapper">
              <div class="timeline-header-row">
                <span>Day Period Breakdown</span>
              </div>
              <div class="timeline-periods-strip">
                ${p1_5}
                ${recessMarker}
                ${p6_9}
              </div>
            </div>

            <div class="card-body">
              ${(consecutiveChipsHtml || chipsHtml) ? `
                <div class="vacant-timings-section" style="margin-top: 4px;">
                  <div class="slots-chips-title" style="margin-bottom: 5px;">Vacant Timings:</div>
                  <div class="slots-chips-container room-free-list">
                    ${consecutiveChipsHtml}
                    ${chipsHtml}
                  </div>
                </div>
              ` : (effectiveFreeHours === 0 ? `
                <div class="slots-chips-container room-free-list" style="margin-top: 4px;">
                  <div class="slot-chip slot-none">No free periods on this day</div>
                </div>
              ` : '')}
            </div>

            <div class="card-actions room-card-actions">
              <button class="btn-share-room" data-room="${escapeHtml(room.code)}" title="Share room vacancy & QR directly">
                📤 Share Room & QR
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
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function formatBatchCode(b) {
      if (!b) return '';
      const str = String(b).trim();
      const m = str.match(/^([A-Za-z])(?:P)?(\d+)$/);
      if (m) {
        const l = m[1].toUpperCase();
        const n = m[2];
        return `${l}${n} / ${l}P${n}`;
      }
      return str;
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
    let currentModalDay = 'Monday';
    let campusMapDataCache = null;

    async function loadCampusMapData() {
      if (campusMapDataCache) return campusMapDataCache;
      try {
        const res = await fetch('campus_map_data.json');
        campusMapDataCache = await res.json();
        return campusMapDataCache;
      } catch (e) {
        console.warn('Could not load campus_map_data.json:', e);
        return null;
      }
    }

    loadCampusMapData();

    function getRoomLocationMeta(roomCode) {
      const code = String(roomCode || '').trim().toUpperCase();
      let mapNode = null;
      if (campusMapDataCache && campusMapDataCache.graphData) {
        const nodes = campusMapDataCache.graphData.nodes || [];
        mapNode = nodes.find(n => n.name && n.name.trim().toUpperCase() === code) ||
                  nodes.find(n => n.name && n.name.trim().toUpperCase() === code.replace(/\s+/g, ''));
      }

      let floor = mapNode?.floor || 'Ground Floor';
      let wing = 'Main Building Wing';
      let landmark = 'Central Campus';

      const numMatch = code.match(/\d+/);
      const num = numMatch ? parseInt(numMatch[0], 10) : 0;

      if (code.startsWith('R')) {
        if (num === 32) {
          floor = 'First Floor';
          wing = 'New Building (1st Floor)';
          landmark = 'Near Room 33 (R-33)';
        } else if (num === 35) {
          floor = 'Ground Floor';
          wing = 'Canteen Area';
          landmark = 'Canteen Building';
        } else if (num === 36) {
          floor = 'Ground Floor';
          wing = 'Near Canteen';
          landmark = 'Ground Floor (Near Canteen)';
        } else if (num >= 26 && num <= 28) {
          floor = 'Ground Floor';
          wing = 'New Building (Ground Floor)';
          landmark = 'Near Tutorial Rooms';
        } else if (num >= 1 && num <= 10) {
          floor = 'Ground Floor';
          wing = 'Main Building (Front Wing)';
          landmark = 'Near Principal Office & Central Lawns';
        } else if (num >= 11 && num <= 25) {
          floor = 'First Floor';
          wing = 'Main Building (First Floor Corridor)';
          landmark = 'Accessible via Main Heritage Stairs';
        } else if (num >= 29 && num <= 31) {
          floor = 'Ground Floor';
          wing = 'New Classroom Wing';
          landmark = 'Near Central Lawns & Main Auditorium';
        } else if (num >= 33 && num <= 37) {
          floor = 'First Floor';
          wing = 'New Classroom Wing';
          landmark = 'Near Computer Labs & North Corridor';
        }
      } else if (code.startsWith('T')) {
        wing = 'Tutorial Block';
        if (num >= 37) {
          floor = 'Second Floor';
          landmark = 'Tutorial Block 2nd Floor Corridor';
        } else if (num === 17 || num === 18) {
          floor = 'Ground Floor';
          landmark = 'Tutorial Lawns & Ground Floor Corridor';
        } else if (num >= 19) {
          floor = 'First Floor';
          landmark = 'Tutorial Block 1st Floor Corridor';
        } else {
          floor = 'Ground Floor';
          landmark = 'Tutorial Lawns & Ground Floor Corridor';
        }
      } else if (code.startsWith('PB')) {
        floor = 'Ground Floor';
        wing = 'Principal Bungalow Heritage Wing';
        landmark = 'Near Gate 1 & Green Lawns';
      } else if (code.startsWith('SCR')) {
        floor = 'Ground Floor';
        wing = 'Sports Complex Block';
        landmark = 'Near Sports Ground & Gymnasium';
      } else if (code.startsWith('CL') || code === 'CLIB') {
        floor = 'First Floor';
        wing = 'Computer Center & Library Block';
        landmark = 'Computer Center 1st Floor Corridor';
      } else if (code === 'AUDI') {
        floor = 'Ground Floor';
        wing = 'Main Auditorium';
        landmark = 'Near Front Entrance / Foyer';
      } else if (code === 'GCR') {
        floor = 'Ground Floor';
        wing = 'Girls Common Room Wing';
        landmark = 'Near Canteen Pathway';
      } else if (code.includes('LIBRARY') || code.includes('LIB')) {
        if (code.includes('FF') || code.includes('FIRST')) {
          floor = 'First Floor';
          wing = 'Main Library Block';
          landmark = 'Upper Reading Hall';
        } else {
          floor = 'Ground Floor';
          wing = 'Main Library Block';
          landmark = 'Central Library Hall';
        }
      } else if (code.includes('PLAYGROUND') || code.includes('GROUND')) {
        floor = 'Ground / Outdoor';
        wing = 'Main Sports Ground';
        landmark = 'Beside Gymnasium & Pavilion';
      } else if (code.includes('PRINCIPAL')) {
        floor = 'Ground Floor';
        wing = 'Main Heritage Building';
        landmark = 'Near Gate 1 Main Entrance';
      } else if (code.includes('SEMINAR')) {
        floor = 'Ground Floor';
        wing = 'Main Seminar Hall Block';
        landmark = 'Adjacent to Auditorium & Central Lawns';
      }

      return { code, floor, wing, landmark, mapNode };
    }

    function openScheduleModal(roomCode, targetDay = null) {
      const room = findRoomByCodeOrName(roomCode);
      if (!room) {
        showToast(`⚠️ Schedule not found for Room: ${escapeHtml(roomCode)}`);
        return;
      }
      currentModalRoomCode = room.code;

      const activeTimetableDay = window._srccTtState?.day;
      const dayToUse = targetDay || 
        (state.activeMode === 'timetable' ? (activeTimetableDay || state.activeDay) : 
        (facultyState?.modalActiveDay || facultyState?.activeDay || state.activeDay || 'Monday'));
      state.activeDay = dayToUse;
      currentModalDay = dayToUse;

      const sched = room.schedule[dayToUse] || { free_slots: [], occupied_slots: [], lunch_recess_free: true };
      const loc = getRoomLocationMeta(room.code);

      if (modalRoomTitle) {
        modalRoomTitle.textContent = room.code;
      }
      const modalRoomLocationBar = document.getElementById('modalRoomLocationBar');
      if (modalRoomLocationBar) {
        modalRoomLocationBar.innerHTML = `
          <span class="room-loc-floor-badge">${escapeHtml(loc.floor)}</span>
          <span class="room-loc-text">• ${escapeHtml(loc.wing)} (${escapeHtml(loc.landmark)})</span>
        `;
      }
      if (modalRoomMeta) modalRoomMeta.textContent = `${room.category} · Capacity: ${room.capacity || 0} seats`;

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

      const activeDate = getDateForDayName(state.activeDay);
      const activeRoomLocks = getRoomActiveLocks(room.code, activeDate, state.activeDay);
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
              <td style="color: #047857;">
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                  <span>College-wide recess. Room is 100% vacant for GD & lunch discussions.</span>
                  <button type="button" class="btn-slot-cal-reminder" data-room="${escapeHtml(room.code)}" data-day="${escapeHtml(dayToUse)}" data-slot="1:30 PM to 2:00 PM" title="Add reminder to Google Calendar / Apple Calendar">
                    📅 Add to Calendar
                  </button>
                </div>
              </td>
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
            <tr style="background: rgba(147, 51, 234, 0.05);">
              <td style="white-space: nowrap;"><strong>${slotFormatted}</strong></td>
              <td style="white-space: nowrap;"><span class="badge-slot-leave">Vacant (Faculty Leave)</span></td>
              <td>
                <div class="room-sched-details-wrap">
                  <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                    <div>
                      <strong style="color: #7e22ce;">Lecture Suspended:</strong> Prof. <strong>${escapeHtml(teach.clean_name)}</strong> (${escapeHtml(teach.short_code || '')}) is on leave. Classroom is vacant for self-study.
                    </div>
                    <button type="button" class="btn-slot-cal-reminder" data-room="${escapeHtml(room.code)}" data-day="${escapeHtml(dayToUse)}" data-slot="${escapeHtml(timeSlot)}" title="Add reminder to Google Calendar / Apple Calendar">
                      📅 Add to Calendar
                    </button>
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
              <td style="color: #15803d; font-weight: 600;">
                <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                  <span>Vacant Classroom (Available for Study/GD)</span>
                  <button type="button" class="btn-slot-cal-reminder" data-room="${escapeHtml(room.code)}" data-day="${escapeHtml(dayToUse)}" data-slot="${escapeHtml(timeSlot)}" title="Add reminder to Google Calendar / Apple Calendar">
                    📅 Add to Calendar
                  </button>
                </div>
              </td>
            </tr>
          `;
        } else {
          // Class in Session
          const classDesc = occupiedObj ? occupiedObj.class : 'Scheduled Class';
          let detailsHtml = '';

          if (matchedTeachers.length > 0) {
            const isMulti = matchedTeachers.length > 1;
            detailsHtml = matchedTeachers.map((m, idx) => {
              const teach = m.teacher;
              const cls = m.classInfo;
              const courseStr = cls.course ? `${cls.course}` : 'B.Com (Hons)';
              const semStr = cls.semester ? `(${cls.semester})` : '';
              const cleanSec = (cls.section && cls.section.toLowerCase() !== 'joint') ? cls.section : '';
              const secBatchStr = [cleanSec, cls.batch ? `Batch ${formatBatchCode(cls.batch)}` : ''].filter(Boolean).join(' · ');
              const tCodeDisp = getDisplayShortCode(teach);
              const sessionLabel = isMulti ? `<div class="room-session-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;"><span class="badge-session-idx" style="font-size: 0.72rem; font-weight: 700; background: rgba(59, 130, 246, 0.12); color: #2563eb; padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(59, 130, 246, 0.25);">Session ${idx + 1}</span><span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">${escapeHtml(courseStr)} ${escapeHtml(semStr)}</span></div>` : '';

              return `
                <div class="room-sched-details-wrap${isMulti ? ' is-multi-session' : ''}" style="${isMulti ? 'background: rgba(0,0,0,0.015); border: 1px solid var(--border-color); border-radius: 8px; padding: 9px 12px; margin-bottom: 8px;' : 'margin-bottom: 6px;'}">
                  ${sessionLabel}
                  <div class="room-sched-meta-line">
                    <span class="subject-pill" style="cursor: default;">
                      <strong class="subj-code-badge">${escapeHtml(m.subjectCode)}</strong>
                      <span class="subj-name-text">${escapeHtml(m.subjectFullName)}</span>
                    </span>
                    ${!isMulti ? `<span class="class-sem-badge">${escapeHtml(courseStr)} ${escapeHtml(semStr)}</span>` : ''}
                    ${secBatchStr ? `<span class="class-sec-badge">${escapeHtml(secBatchStr)}</span>` : ''}
                  </div>
                  <div class="room-sched-teacher-row" style="margin-top: 4px;">
                    <div class="rs-teacher-chip">
                      <span class="rs-teacher-avatar">${escapeHtml(teach.initials || teach.clean_name.slice(0, 2).toUpperCase())}</span>
                      <span class="rs-teacher-name">Prof. <strong>${escapeHtml(teach.clean_name)}</strong> ${tCodeDisp ? `(${escapeHtml(tCodeDisp)})` : ''}</span>
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
              <div style="margin-top: 8px; text-align: right;">
                <button type="button" class="btn-slot-cal-reminder" data-room="${escapeHtml(room.code)}" data-day="${escapeHtml(dayToUse)}" data-slot="${escapeHtml(timeSlot)}">
                  📅 Add to Calendar
                </button>
              </div>
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
                <span class="badge-slot-leave">Vacant (Faculty Leave)</span>
              </div>
              <div class="rsm-body-text">
                <div style="margin-bottom: 6px;"><strong style="color: #7e22ce;">Lecture Suspended:</strong> Prof. <strong>${escapeHtml(teach.clean_name)}</strong> is on leave. Room is open for study.</div>
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
              <div style="margin-top: 8px; text-align: right;">
                <button type="button" class="btn-slot-cal-reminder" data-room="${escapeHtml(room.code)}" data-day="${escapeHtml(dayToUse)}" data-slot="${escapeHtml(timeSlot)}">
                  📅 Add to Calendar
                </button>
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
              <div style="margin-top: 8px; text-align: right;">
                <button type="button" class="btn-slot-cal-reminder" data-room="${escapeHtml(room.code)}" data-day="${escapeHtml(dayToUse)}" data-slot="${escapeHtml(timeSlot)}">
                  📅 Add to Calendar
                </button>
              </div>
            </div>
          `;
        } else {
          // Class in Session
          const classDesc = occupiedObj ? occupiedObj.class : 'Scheduled Class';
          let innerContent = '';

          if (matchedTeachers.length > 0) {
            const isMulti = matchedTeachers.length > 1;
            innerContent = matchedTeachers.map((m, idx) => {
              const teach = m.teacher;
              const cls = m.classInfo;
              const courseStr = cls.course ? `${cls.course}` : 'B.Com (Hons)';
              const semStr = cls.semester ? `(${cls.semester})` : '';
              const cleanSec = (cls.section && cls.section.toLowerCase() !== 'joint') ? cls.section : '';
              const secBatchStr = [cleanSec, cls.batch ? `Batch ${formatBatchCode(cls.batch)}` : ''].filter(Boolean).join(' · ');
              const tCodeDisp = getDisplayShortCode(teach);
              const sessionLabel = isMulti ? `<div class="room-session-header" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;"><span class="badge-session-idx" style="font-size: 0.72rem; font-weight: 700; background: rgba(59, 130, 246, 0.12); color: #2563eb; padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(59, 130, 246, 0.25);">Session ${idx + 1}</span><span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">${escapeHtml(courseStr)} ${escapeHtml(semStr)}</span></div>` : '';

              return `
                <div class="room-sched-details-wrap${isMulti ? ' is-multi-session' : ''}" style="${isMulti ? 'background: rgba(0,0,0,0.015); border: 1px solid var(--border-color); border-radius: 8px; padding: 9px 12px; margin-bottom: 8px;' : 'margin-bottom: 6px;'}">
                  ${sessionLabel}
                  <div class="room-sched-meta-line">
                    <span class="subject-pill" style="cursor: default;">
                      <strong class="subj-code-badge">${escapeHtml(m.subjectCode)}</strong>
                      <span class="subj-name-text">${escapeHtml(m.subjectFullName)}</span>
                    </span>
                    ${!isMulti ? `<span class="class-sem-badge">${escapeHtml(courseStr)} ${escapeHtml(semStr)}</span>` : ''}
                    ${secBatchStr ? `<span class="class-sec-badge">${escapeHtml(secBatchStr)}</span>` : ''}
                  </div>
                  <div class="room-sched-teacher-row" style="margin-top: 4px;">
                    <div class="rs-teacher-chip">
                      <span class="rs-teacher-avatar">${escapeHtml(teach.initials || teach.clean_name.slice(0, 2).toUpperCase())}</span>
                      <span class="rs-teacher-name">Prof. <strong>${escapeHtml(teach.clean_name)}</strong> ${tCodeDisp ? `(${escapeHtml(tCodeDisp)})` : ''}</span>
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

        // Attach listeners for setting calendar reminders for vacant slots or scheduled classes
        modalBody.querySelectorAll('.btn-slot-cal-reminder').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (btn.dataset.teacherId) {
              const tId = btn.dataset.teacherId;
              const tObj = teachersData?.teachers?.find(t => t.id === tId);
              const dummyCls = {
                subject: btn.dataset.subject,
                subject_name: btn.dataset.subject,
                course: btn.dataset.course,
                slot: btn.dataset.slot,
                room: btn.dataset.room,
                type: 'Lecture'
              };
              if (tObj) {
                openTeacherCalendarReminderModal(tObj, dummyCls, btn.dataset.day || state.activeDay);
                return;
              }
            }
            openCalendarReminderModal(btn.dataset.room, btn.dataset.day, btn.dataset.slot);
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

    // Toolbar buttons inside Room Schedule Modal
    const btnExportScheduleImg = document.getElementById('btnModalExportScheduleImg');
    if (btnExportScheduleImg) {
      btnExportScheduleImg.addEventListener('click', () => {
        if (currentModalRoomCode) {
          exportScheduleAsImage(currentModalRoomCode, currentModalDay);
        }
      });
    }

    const btnPrintSchedule = document.getElementById('btnModalPrintSchedule');
    if (btnPrintSchedule) {
      btnPrintSchedule.addEventListener('click', () => {
        document.body.classList.add('print-room-modal-active');
        document.body.classList.remove('print-teacher-modal-active');
        window.print();
      });
    }

    const btnModalShareDirect = document.getElementById('btnModalShareDirect');
    if (btnModalShareDirect) {
      btnModalShareDirect.addEventListener('click', () => {
        if (currentModalRoomCode) {
          openShareModal(currentModalRoomCode);
        }
      });
    }

    // Helper: Parse Slot Time Range e.g. "12:30 PM to 1:30 PM"
    function parseSlotTimeRange(slotStr) {
      const parts = (slotStr || '').split(/\s*(?:to|–|-)\s*/i);
      function parsePart(p) {
        if (!p) return { h: 9, min: 0 };
        const m = p.trim().match(/(\d+):(\d+)\s*(AM|PM)?/i);
        if (!m) return { h: 9, min: 0 };
        let h = parseInt(m[1], 10);
        const min = parseInt(m[2], 10);
        const meridiem = (m[3] || '').toUpperCase();
        if (meridiem === 'PM' && h < 12) h += 12;
        if (meridiem === 'AM' && h === 12) h = 0;
        return { h, min };
      }
      const start = parsePart(parts[0]);
      const end = parsePart(parts[1] || parts[0]);
      return { start, end };
    }

    // Helper: Find next upcoming date for given day of week
    function getNextDateForDayName(dayName) {
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const targetIdx = days.indexOf(dayName);
      const now = getIstDate();
      const currentIdx = now.getDay();
      let diff = (targetIdx === -1) ? 0 : targetIdx - currentIdx;
      if (diff < 0) diff += 7;
      return new Date(now.getTime() + diff * 86400000);
    }

    // 📅 Calendar & Slot Reminder Modal Implementation
    function openCalendarReminderModal(roomCode, dayName, slotStr) {
      const room = findRoomByCodeOrName(roomCode);
      if (!room) return;
      const calModal = document.getElementById('calendarReminderModal');
      const calRoomName = document.getElementById('calReminderRoomName');
      const calSlotTime = document.getElementById('calReminderSlotTime');
      const btnGoogle = document.getElementById('btnCalOpenGoogle');
      const btnIcs = document.getElementById('btnCalDownloadIcs');
      const btnCopy = document.getElementById('btnCalCopyGdInvite');
      const btnClose = document.getElementById('btnCalReminderClose');

      if (calRoomName) calRoomName.textContent = `Room ${room.code} (${room.name})`;
      if (calSlotTime) calSlotTime.textContent = `${dayName} · ${slotStr.replace(' to ', ' – ')}`;

      const timeInfo = parseSlotTimeRange(slotStr);
      const targetDate = getNextDateForDayName(dayName);
      const y = targetDate.getFullYear();
      const m = targetDate.getMonth();
      const d = targetDate.getDate();

      const pad = n => String(n).padStart(2, '0');
      const dateStr = `${y}${pad(m + 1)}${pad(d)}`;
      const startStamp = `${dateStr}T${pad(timeInfo.start.h)}${pad(timeInfo.start.min)}00`;
      const endStamp = `${dateStr}T${pad(timeInfo.end.h)}${pad(timeInfo.end.min)}00`;

      const directUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(room.code)}`;
      const eventTitle = `SRCC GD: Room ${room.code}`;
      const eventDesc = `Classroom ${room.code} (${room.name}) is officially vacant at SRCC for Group Discussion & Peer Study.\nCapacity: ${room.capacity}\nWing: ${room.category}\nDirect Room Link: ${directUrl}`;
      const eventLoc = `Room ${room.code}, Shri Ram College of Commerce, University of Delhi, Maurice Nagar, Delhi 110007`;

      const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventTitle)}&dates=${startStamp}/${endStamp}&ctz=Asia/Kolkata&details=${encodeURIComponent(eventDesc)}&location=${encodeURIComponent(eventLoc)}`;

      if (btnGoogle) {
        btnGoogle.href = gcalUrl;
        btnGoogle.onclick = () => {
          showToast(`🗓️ Opening Google Calendar for Room ${room.code}!`);
        };
      }

      if (btnIcs) {
        btnIcs.onclick = () => {
          downloadIcsCalendarFile(room.code, dayName, slotStr, targetDate, timeInfo.start.h, timeInfo.start.min, timeInfo.end.h, timeInfo.end.min, directUrl);
        };
      }

      if (btnCopy) {
        btnCopy.onclick = () => {
          const inviteMsg = `📢 *SRCC GD / Peer Study Session*\n\n📍 *Room:* ${room.code} (${room.name})\n🏛️ *Wing:* ${room.category}\n🗓️ *Day:* ${dayName}\n🕒 *Slot:* ${slotStr.replace(' to ', ' – ')}\n👥 *Capacity:* ${room.capacity}\n\n🔗 Join / Verify Vacancy: ${directUrl}`;
          navigator.clipboard.writeText(inviteMsg).then(() => {
            showToast('📋 Copied GD invite message to clipboard!');
          }).catch(() => {
            showToast(`Invite ready for Room ${room.code}`);
          });
        };
      }

      if (btnClose) {
        btnClose.onclick = () => {
          if (calModal) closeAppModal(calModal);
        };
      }

      if (calModal) {
        calModal.onclick = (e) => {
          if (e.target === calModal) closeAppModal(calModal);
        };
        openAppModal(calModal);
      }
    }

    // 🍏 Generate and Download .ics Calendar File with 15-Minute Prior Alarm
    function downloadIcsCalendarFile(roomCode, dayName, slotStr, targetDate, startH, startMin, endH, endMin, directUrl) {
      const pad = n => String(n).padStart(2, '0');
      const y = targetDate.getFullYear();
      const m = targetDate.getMonth() + 1;
      const d = targetDate.getDate();
      const dateStr = `${y}${pad(m)}${pad(d)}`;
      const dtStart = `${dateStr}T${pad(startH)}${pad(startMin)}00`;
      const dtEnd = `${dateStr}T${pad(endH)}${pad(endMin)}00`;
      const nowIso = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

      const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//SRCC Free Classrooms//GD Reminder//EN',
        'CALSCALE:GREGORIAN',
        'BEGIN:VTIMEZONE',
        'TZID:Asia/Kolkata',
        'BEGIN:STANDARD',
        'DTSTART:19700101T000000',
        'TZOFFSETFROM:+0530',
        'TZOFFSETTO:+0530',
        'TZNAME:IST',
        'END:STANDARD',
        'END:VTIMEZONE',
        'BEGIN:VEVENT',
        `UID:${Date.now()}-${roomCode}@srcc-classrooms`,
        `DTSTAMP:${nowIso}`,
        `DTSTART;TZID=Asia/Kolkata:${dtStart}`,
        `DTEND;TZID=Asia/Kolkata:${dtEnd}`,
        `SUMMARY:SRCC GD: Room ${roomCode}`,
        `DESCRIPTION:Vacant classroom at SRCC for Group Discussion & Peer Study.\\nDirect Link: ${directUrl}`,
        `LOCATION:Room ${roomCode}\\, Shri Ram College of Commerce\\, Maurice Nagar\\, Delhi 110007`,
        'STATUS:CONFIRMED',
        'BEGIN:VALARM',
        'TRIGGER:-PT15M',
        'ACTION:DISPLAY',
        `DESCRIPTION:Reminder: SRCC Room ${roomCode} is vacant for GD in 15 minutes!`,
        'END:VALARM',
        'END:VEVENT',
        'END:VCALENDAR'
      ].join('\r\n');

      const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SRCC_GD_Room_${roomCode}_${dayName}.ics`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      showToast(`🍏 Downloaded Apple / Outlook reminder with 15m alarm!`);
    }

    // 📅 Faculty Class / Lecture Calendar Reminder Modal
    function openTeacherCalendarReminderModal(teacher, cls, dayName) {
      if (!teacher || !cls) return;
      const calModal = document.getElementById('calendarReminderModal');
      const calTitle = document.getElementById('calReminderTitle');
      const calMeta = document.getElementById('calReminderMeta');
      const calRoomName = document.getElementById('calReminderRoomName');
      const calSlotTime = document.getElementById('calReminderSlotTime');
      const btnGoogle = document.getElementById('btnCalOpenGoogle');
      const btnIcs = document.getElementById('btnCalDownloadIcs');
      const btnCopy = document.getElementById('btnCalCopyGdInvite');
      const btnClose = document.getElementById('btnCalReminderClose');

      const subjInfo = (typeof getSubjectDetails === 'function') ? getSubjectDetails(cls.subject, cls.subject_name) : { code: cls.subject, fullName: cls.subject };
      const subjTitle = subjInfo.fullName || cls.course || 'Scheduled Class';
      const slotDisplay = cls.slot ? cls.slot.replace(' to ', ' – ') : 'Period';
      const roomDisplay = cls.room ? `Room ${cls.room.trim()}` : 'Room TBD';

      if (calTitle) calTitle.textContent = `📅 Add Lecture to Calendar`;
      if (calMeta) calMeta.textContent = `Prof. ${teacher.clean_name} · ${cls.type || 'Lecture'}`;
      if (calRoomName) calRoomName.textContent = `${subjTitle} (${subjInfo.code || cls.course || ''})`;
      if (calSlotTime) calSlotTime.textContent = `${dayName} · ${slotDisplay} · ${roomDisplay}`;

      const timeInfo = parseSlotTimeRange(cls.slot);
      const targetDate = getNextDateForDayName(dayName);
      const y = targetDate.getFullYear();
      const m = targetDate.getMonth();
      const d = targetDate.getDate();

      const pad = n => String(n).padStart(2, '0');
      const dateStr = `${y}${pad(m + 1)}${pad(d)}`;
      const startStamp = `${dateStr}T${pad(timeInfo.start.h)}${pad(timeInfo.start.min)}00`;
      const endStamp = `${dateStr}T${pad(timeInfo.end.h)}${pad(timeInfo.end.min)}00`;

      const directUrl = `${window.location.origin}${window.location.pathname}?faculty=${encodeURIComponent(teacher.clean_name)}`;
      const eventTitle = `SRCC Class: ${subjInfo.code || subjTitle} (${roomDisplay})`;
      const eventDesc = `Lecture with Prof. ${teacher.clean_name} (${teacher.department || 'SRCC'})\nSubject: ${subjTitle} [${subjInfo.code}]\nCourse: ${cls.course || 'B.Com (Hons)'} ${cls.semester ? `(${cls.semester})` : ''} ${cls.section ? `Sec ${cls.section}` : ''}\nLocation: ${roomDisplay}\nFaculty Timetable Link: ${directUrl}`;
      const eventLoc = `${roomDisplay}, Shri Ram College of Commerce, Maurice Nagar, Delhi 110007`;

      const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventTitle)}&dates=${startStamp}/${endStamp}&ctz=Asia/Kolkata&details=${encodeURIComponent(eventDesc)}&location=${encodeURIComponent(eventLoc)}`;

      if (btnGoogle) {
        btnGoogle.href = gcalUrl;
        btnGoogle.onclick = () => {
          showToast(`🗓️ Opening Google Calendar for ${subjTitle}!`);
        };
      }

      if (btnIcs) {
        btnIcs.onclick = () => {
          downloadTeacherIcsCalendarFile(teacher, cls, dayName, targetDate, timeInfo.start.h, timeInfo.start.min, timeInfo.end.h, timeInfo.end.min, directUrl);
        };
      }

      if (btnCopy) {
        btnCopy.onclick = () => {
          const inviteMsg = `📢 *SRCC Class Alert*\n\n📚 *Subject:* ${subjTitle} (${subjInfo.code})\n👨‍🏫 *Faculty:* Prof. ${teacher.clean_name}\n🏛️ *Location:* ${roomDisplay}\n🗓️ *Day:* ${dayName}\n🕒 *Slot:* ${slotDisplay}\n\n🔗 Timetable: ${directUrl}`;
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(inviteMsg).then(() => {
              showToast('📋 Copied class alert to clipboard!');
            }).catch(() => {
              showToast(`Class alert ready for Prof. ${teacher.clean_name}`);
            });
          }
        };
      }

      if (btnClose) {
        btnClose.onclick = () => {
          if (calModal) closeAppModal(calModal);
        };
      }

      if (calModal) {
        calModal.onclick = (e) => {
          if (e.target === calModal) closeAppModal(calModal);
        };
        openAppModal(calModal);
      }
    }

    function downloadTeacherIcsCalendarFile(teacher, cls, dayName, targetDate, startH, startMin, endH, endMin, directUrl) {
      const pad = n => String(n).padStart(2, '0');
      const y = targetDate.getFullYear();
      const m = targetDate.getMonth() + 1;
      const d = targetDate.getDate();
      const dateStr = `${y}${pad(m)}${pad(d)}`;
      const dtStart = `${dateStr}T${pad(startH)}${pad(startMin)}00`;
      const dtEnd = `${dateStr}T${pad(endH)}${pad(endMin)}00`;
      const nowIso = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
      const subjInfo = (typeof getSubjectDetails === 'function') ? getSubjectDetails(cls.subject, cls.subject_name) : { code: cls.subject, fullName: cls.subject };
      const subjTitle = subjInfo.fullName || cls.course || 'Lecture';
      const roomDisplay = cls.room ? `Room ${cls.room.trim()}` : 'Room TBD';

      const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//SRCC Free Classrooms//Class Reminder//EN',
        'CALSCALE:GREGORIAN',
        'BEGIN:VTIMEZONE',
        'TZID:Asia/Kolkata',
        'BEGIN:STANDARD',
        'DTSTART:19700101T000000',
        'TZOFFSETFROM:+0530',
        'TZOFFSETTO:+0530',
        'TZNAME:IST',
        'END:STANDARD',
        'END:VTIMEZONE',
        'BEGIN:VEVENT',
        `UID:srcc-cls-${Date.now()}-${Math.floor(Math.random()*10000)}@srcc-classrooms`,
        `DTSTAMP:${nowIso}`,
        `DTSTART;TZID=Asia/Kolkata:${dtStart}`,
        `DTEND;TZID=Asia/Kolkata:${dtEnd}`,
        `SUMMARY:SRCC Class: ${subjInfo.code || subjTitle} (${roomDisplay})`,
        `DESCRIPTION:Lecture with Prof. ${teacher.clean_name}\\nSubject: ${subjTitle} (${subjInfo.code})\\nCourse: ${cls.course || ''}\\nLocation: ${roomDisplay}\\nLink: ${directUrl}`,
        `LOCATION:${roomDisplay}\\, Shri Ram College of Commerce\\, Maurice Nagar\\, Delhi 110007`,
        'STATUS:CONFIRMED',
        'BEGIN:VALARM',
        'TRIGGER:-PT15M',
        'ACTION:DISPLAY',
        `DESCRIPTION:Reminder: SRCC Class with Prof. ${teacher.clean_name} starts in 15 minutes!`,
        'END:VALARM',
        'END:VEVENT',
        'END:VCALENDAR'
      ].join('\r\n');

      const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SRCC_Class_${(subjInfo.code || 'Lecture').replace(/[^a-zA-Z0-9]/g, '_')}_${dayName}.ics`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      showToast(`🍏 Downloaded Apple / Outlook reminder with 15m alarm!`);
    }

    // 📸 Export Complete Daily Room Schedule as Ultra Crisp PNG Image
    function exportScheduleAsImage(roomCode, targetDay = null) {
      const room = findRoomByCodeOrName(roomCode);
      if (!room) return;
      const dayName = targetDay || currentModalDay || state.activeDay || 'Monday';
      const sched = room.schedule[dayName] || { free_slots: [], occupied_slots: [] };
      const effectiveFreeHours = (sched.free_slots || []).length;

      const canvas = document.createElement('canvas');
      canvas.width = 840;
      canvas.height = 1120;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Navy Header Banner
      const grad = ctx.createLinearGradient(0, 0, canvas.width, 150);
      grad.addColorStop(0, '#0a1128');
      grad.addColorStop(1, '#1e293b');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, 150);

      // Gold accent bar
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(0, 146, canvas.width, 4);

      // Header Title
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('SHRI RAM COLLEGE OF COMMERCE · UNIVERSITY OF DELHI', 36, 38);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`Room ${room.code} (${room.name})`, 36, 76);

      ctx.fillStyle = '#38bdf8';
      ctx.font = '600 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`🏛️ ${room.category}   •   👥 Capacity: ${room.capacity}   •   🟢 ${effectiveFreeHours} Academic Hours Free`, 36, 110);

      // Day Info Sub-header
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 150, canvas.width, 46);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText(`🗓️ ${dayName} Class Schedule & Vacancy`, 36, 180);

      const istNow = getIstDate();
      const dateStr = istNow.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
      ctx.fillStyle = '#64748b';
      ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`Verified Timetable · ${dateStr}`, canvas.width - 36, 180);
      ctx.textAlign = 'left';

      // Table Header
      const headerY = 196;
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(0, headerY, canvas.width, 36);

      ctx.fillStyle = '#334155';
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('PERIOD / TIME', 36, headerY + 23);
      ctx.fillText('STATUS', 240, headerY + 23);
      ctx.fillText('CLASS SCHEDULE / AVAILABILITY', 440, headerY + 23);

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

      let currentY = 232;
      const rowHeight = 78;

      allSlots.forEach((slot, idx) => {
        // Row background
        ctx.fillStyle = (idx % 2 === 0) ? '#ffffff' : '#f8fafc';
        ctx.fillRect(0, currentY, canvas.width, rowHeight);

        // Row divider
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, currentY + rowHeight);
        ctx.lineTo(canvas.width, currentY + rowHeight);
        ctx.stroke();

        const slotLabel = slot.replace(' to ', ' – ');
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(slotLabel, 36, currentY + 36);

        // Check status
        const isRecess = (slot === '1:30 PM to 2:00 PM');
        const isFree = isRecess || sched.free_slots.includes(slot);
        const leaveInfo = getRoomScheduledTeacherLeave(room.code, dayName, slot);
        const occupiedObj = sched.occupied_slots.find(o => o.slot === slot);
        const matchedTeachers = getRoomScheduledClassDetails(room.code, dayName, slot);

        if (isRecess) {
          drawBadge(ctx, 240, currentY + 18, '☕ LUNCH RECESS', '#fef3c7', '#b45309', '#fde68a');
          ctx.fillStyle = '#047857';
          ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillText('Campus-wide recess · 100% free for GD & lunch', 440, currentY + 44);
        } else if (leaveInfo) {
          drawBadge(ctx, 240, currentY + 18, '✨ BONUS FREE (LEAVE)', '#f3e8ff', '#7e22ce', '#d8b4fe');
          ctx.fillStyle = '#6d28d9';
          ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillText(`Prof. ${leaveInfo.teacher.clean_name} is on leave`, 440, currentY + 34);
          ctx.fillStyle = '#64748b';
          ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillText('Class cancelled · Room vacant for self-study', 440, currentY + 54);
        } else if (isFree) {
          drawBadge(ctx, 240, currentY + 18, '🟢 VACANT FOR GD', '#dcfce7', '#15803d', '#86efac');
          ctx.fillStyle = '#15803d';
          ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          ctx.fillText('Vacant Classroom (Available for GD & study)', 440, currentY + 44);
        } else {
          drawBadge(ctx, 240, currentY + 18, '🔴 CLASS IN SESSION', '#fee2e2', '#b91c1c', '#fecaca');
          ctx.fillStyle = '#0f172a';
          ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
          if (matchedTeachers.length > 0) {
            const m = matchedTeachers[0];
            const teacherStr = `Prof. ${m.teacher.clean_name}`;
            const subjStr = m.subjectCode || 'Scheduled Class';
            ctx.fillText(`${subjStr} · ${teacherStr}`, 440, currentY + 34);
            ctx.fillStyle = '#64748b';
            ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            const clsInfo = `${m.classInfo.course || 'B.Com (H)'} ${m.classInfo.semester ? `(${m.classInfo.semester})` : ''} ${m.classInfo.section || ''}`;
            ctx.fillText(clsInfo, 440, currentY + 54);
          } else {
            const desc = occupiedObj ? occupiedObj.class : 'Scheduled Class';
            ctx.fillText(desc.slice(0, 42), 440, currentY + 44);
          }
        }

        currentY += rowHeight;
      });

      // Footer bar
      ctx.fillStyle = '#0a1128';
      ctx.fillRect(0, canvas.height - 64, canvas.width, 64);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
      ctx.fillText('🎓 SRCC Free Classroom Finder · Built by Anand Kumar (25BC070)', 36, canvas.height - 28);
      ctx.fillStyle = '#38bdf8';
      ctx.textAlign = 'right';
      ctx.fillText('anand-srcc.github.io/srcc-free-classrooms', canvas.width - 36, canvas.height - 28);
      ctx.textAlign = 'left';

      function drawBadge(c, x, y, text, bg, fg, border) {
        c.save();
        c.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        const textWidth = c.measureText(text).width;
        const padX = 10;
        const badgeW = textWidth + padX * 2;
        const badgeH = 26;
        const r = 6;

        c.fillStyle = bg;
        c.strokeStyle = border;
        c.lineWidth = 1;
        c.beginPath();
        if (typeof c.roundRect === 'function') {
          c.roundRect(x, y, badgeW, badgeH, r);
        } else {
          c.rect(x, y, badgeW, badgeH);
        }
        c.fill();
        c.stroke();

        c.fillStyle = fg;
        c.fillText(text, x + padX, y + 17);
        c.restore();
      }

      function triggerFileDownload(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        showToast(`📸 Saved schedule image for Room ${room.code} (${dayName})!`);
      }

      canvas.toBlob(blob => {
        if (!blob) return;
        const filename = `SRCC_Schedule_${room.code}_${dayName}.png`;
        const file = new File([blob], filename, { type: 'image/png' });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({
            title: `SRCC Room ${room.code} Schedule (${dayName})`,
            text: `Room ${room.code} schedule on ${dayName} at SRCC.`,
            files: [file]
          }).then(() => {
            showToast(`📤 Shared Room ${room.code} schedule image!`);
          }).catch(err => {
            if (err.name !== 'AbortError') {
              triggerFileDownload(blob, filename);
            }
          });
        } else {
          triggerFileDownload(blob, filename);
        }
      }, 'image/png');
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
          text: '',
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
            text: '',
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
        text: '',
        isTeachingNow: false,
        isOnLeave: false,
        isFreeNow: false,
        currentClass: null
      };
    }

    // Helper to get official faculty short code (primary timetable code only; never alias/reference code in student mode)
    function getDisplayShortCode(teacher) {
      if (!teacher) return '';
      let primary = (teacher.short_code || '').trim().toUpperCase();
      // Client-side rule: NEVER show reference codes, placeholder codes, or numeric tags to students
      if (!primary || /\d/.test(primary) || /^(CG|HG|CSG|EG|MG|HGC|PSG|GUEST)\b/i.test(primary)) {
        return '';
      }
      return primary;
    }

    function getCleanStudentFacultyName(rawName, teacherId) {
      if (teacherId && teachersData && teachersData.teachers) {
        const t = teachersData.teachers.find(tch => String(tch.id) === String(teacherId));
        if (t && t.clean_name) return t.clean_name;
      }
      return String(rawName || '')
        .replace(/\s*\([^)]*\)/g, '')
        .replace(/\s*\b(?:cg|hg|csg|eg|mg|hgc|psg)?\d+\b/gi, '')
        .trim();
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
          <div class="active-leaves-strip" role="button" tabindex="0" title="Click to view absent faculty">
            <span class="leaves-strip-badge">Faculty Update</span>
            <span class="leaves-strip-text">
              <strong>${count} ${count === 1 ? 'professor' : 'professors'} on leave today</strong> • <span class="leaves-strip-cta">View list &rarr;</span>
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
      const metricFacultyOnLeave = document.getElementById('metricFacultyOnLeave');
      if (metricFacultyOnLeave) {
        metricFacultyOnLeave.textContent = count;
      }
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
      const qNorm = q.replace(/[\s\-_]+/g, '');

      const name = (teacher.clean_name || '').toLowerCase();
      const label = (teacher.label || '').toLowerCase();
      const code = (teacher.short_code || '').toLowerCase();
      const refCode = (teacher.ref_code || '').toLowerCase();
      const dept = (teacher.department || '').toLowerCase();
      const email = (teacher.email || '').toLowerCase();

      // Direct case-insensitive match on name, label, short code, ref code, department, email
      if (name.includes(q) || label.includes(q) || code.includes(q) || refCode.includes(q) || dept.includes(q) || email.includes(q)) return true;
      if (name.replace(/[\s\-_]+/g, '').includes(qNorm) || label.replace(/[\s\-_]+/g, '').includes(qNorm)) return true;

      // Phonetic / spelling variant matching (e.g. "sefali" matches "Dr. Shefali Kapoor")
      const normQ = normalizeFacultySearchText(q);
      if (normQ.length > 0) {
        const normName = normalizeFacultySearchText(teacher.clean_name);
        const normLabel = normalizeFacultySearchText(teacher.label);
        if (normName.includes(normQ) || normLabel.includes(normQ)) return true;
      }

      // Check subjects array (e.g. FMI, CLAW, BLAW, IF, BRM, etc.) and full names
      if (Array.isArray(teacher.subjects)) {
        for (const sub of teacher.subjects) {
          const subLower = sub.toLowerCase();
          if (subLower.includes(q) || subLower.replace(/[\s\-_]+/g, '').includes(qNorm)) return true;
          const mapped = (SRCC_SUBJECT_MAP[sub] || SRCC_SUBJECT_MAP[sub.toUpperCase()] || '').toLowerCase();
          if (mapped && (mapped.includes(q) || mapped.replace(/[\s\-_]+/g, '').includes(qNorm))) return true;
        }
      }

      // Check inside schedule for room or subject match across ALL days
      if (teacher.schedule) {
        for (const dayKey of Object.keys(teacher.schedule)) {
          const sched = teacher.schedule[dayKey];
          if (Array.isArray(sched)) {
            for (const cls of sched) {
              const clsSubj = (cls.subject || '').toLowerCase();
              const clsSubjName = (cls.subject_name || '').toLowerCase();
              const clsRoom = (cls.room || '').toLowerCase();
              const clsCourse = (cls.course || '').toLowerCase();
              const clsSec = (cls.section || '').toLowerCase();
              const clsBatch = (cls.batch || '').toLowerCase();
              const clsRaw = (cls.raw || '').toLowerCase();
              const mapped = (SRCC_SUBJECT_MAP[cls.subject] || SRCC_SUBJECT_MAP[(cls.subject || '').toUpperCase()] || '').toLowerCase();

              const clsBlob = `${clsSubj} ${clsSubjName} ${mapped} ${clsRoom} ${clsCourse} ${clsSec} ${clsBatch} ${clsRaw}`.toLowerCase();
              if (clsBlob.includes(q) || clsBlob.replace(/[\s\-_]+/g, '').includes(qNorm)) return true;
            }
          }
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

      const metricFacultyEmailTile = document.getElementById('metricFacultyEmailTile');
      const metricFacultyEmailCount = document.getElementById('metricFacultyEmailCount');
      const metricEmailStatusTag = document.getElementById('metricEmailStatusTag');

      if (metricFacultyEmailCount) {
        const countWithEmail = allTeachers.filter(t => Boolean(t.email)).length;
        metricFacultyEmailCount.textContent = countWithEmail;
      }

      if (metricFacultyEmailTile) {
        metricFacultyEmailTile.classList.toggle('active', facultyState.showEmails);
        if (metricEmailStatusTag) {
          metricEmailStatusTag.textContent = facultyState.showEmails ? '(Shown)' : '(Off)';
        }
        if (!metricFacultyEmailTile._listenerAttached) {
          metricFacultyEmailTile._listenerAttached = true;
          metricFacultyEmailTile.onclick = () => {
            facultyState.showEmails = !facultyState.showEmails;
            metricFacultyEmailTile.classList.toggle('active', facultyState.showEmails);
            if (metricEmailStatusTag) {
              metricEmailStatusTag.textContent = facultyState.showEmails ? '(Shown)' : '(Off)';
            }
            renderFaculty();
            showToast(facultyState.showEmails ? '✉️ Faculty emails displayed on cards' : '✉️ Faculty emails hidden');
          };
        }
      }

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
                  ${teacher.email ? `
                    <div class="faculty-email-chip compact" data-email="${escapeHtml(teacher.email)}" data-teacher-name="${escapeHtml(teacher.clean_name)}" title="Click to copy email: ${escapeHtml(teacher.email)}">
                      <span>✉️ ${escapeHtml(teacher.email)}</span>
                      <span class="email-copy-badge">📋</span>
                    </div>` : ''}
                </div>
                <div class="faculty-compact-meta">
                  <span>${daySched.length} classes on ${facultyState.activeDay} (${teacher.total_teaching_periods || 0} periods/wk)</span>
                  ${subjectsHtml}
                </div>
              </div>

              ${status.text ? `
              <div class="faculty-compact-status">
                <div class="faculty-live-status-strip ${status.badgeClass}" style="margin: 0; padding: 4px 8px; font-size: 0.74rem;">
                  <span>${status.text}</span>
                </div>
              </div>` : ''}

              <div class="faculty-compact-actions" style="display: flex; gap: 6px;">
                <button class="btn-teacher-timetable" data-teacher-id="${teacher.id}" title="Full Weekly Schedule">
                  🗓️ Timetable
                </button>
                <button type="button" class="btn-share-faculty-card" data-teacher-id="${teacher.id}" title="Share faculty profile link">
                  📤 Share
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
                ${(roomCode && roomCode !== 'TBD' && roomCode !== 'TBA') ? `
                  <button class="room-badge-link" data-room="${escapeHtml(getTargetRoomJumpCode(roomCode))}" title="Jump to Room ${escapeHtml(getTargetRoomJumpCode(roomCode))} in Free Classroom Finder">
                    🏛️ ${escapeHtml(getDisplayRoomName(roomCode))} ↗
                  </button>
                ` : `<span class="room-pill-tba" title="Room not specified in official college timetable">🏛️ Room TBA</span>`}
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

                ${teacher.email ? `
                  <button type="button" class="btn-teacher-email-icon" data-email="${escapeHtml(teacher.email)}" data-teacher-name="${escapeHtml(teacher.clean_name)}" title="Prof. ${escapeHtml(teacher.clean_name)}: ${escapeHtml(teacher.email)} (Click to view/copy email)">
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="3"></rect>
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                    </svg>
                  </button>
                ` : ''}
              </div>

              <!-- Subjects Taught Row -->
              ${subjectsHtml}

              <!-- Live Status Strip -->
              ${status.text ? `
              <div class="faculty-live-status-strip ${status.badgeClass}">
                <span>${status.text}</span>
              </div>` : ''}

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

            <div class="faculty-card-actions" style="display: flex; gap: 8px;">
              <button class="btn-teacher-timetable" data-teacher-id="${teacher.id}" style="flex: 1;">
                🗓️ Full Weekly Timetable
              </button>
              <button type="button" class="btn-share-faculty-card" data-teacher-id="${teacher.id}" title="Share faculty profile link">
                📤 Share
              </button>
            </div>
          </article>
        `;
      }).join('');

      // Attach Click Handlers
      document.querySelectorAll('.btn-teacher-timetable').forEach(btn => {
        btn.addEventListener('click', () => openTeacherModal(btn.dataset.teacherId));
      });

      document.querySelectorAll('.btn-share-faculty-card').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const tId = btn.dataset.teacherId;
          const allT = (window.SRCC_TEACHERS_DATA?.teachers || teachersData?.teachers || []);
          const tObj = allT.find(t => String(t.id) === String(tId) || t.clean_name === tId);
          if (tObj) {
            shareTeacherProfile(tObj, facultyState.activeDay);
          } else {
            const card = btn.closest('.faculty-card');
            const nameEl = card ? card.querySelector('.faculty-clean-name') : null;
            const tName = nameEl ? nameEl.textContent.trim() : '';
            const fallbackObj = allT.find(t => t.clean_name === tName || t.name === tName);
            if (fallbackObj) {
              shareTeacherProfile(fallbackObj, facultyState.activeDay);
            } else {
              showToast('📤 Opening share sheet...');
            }
          }
        });
      });

    function openFacultyEmailModal(teacher) {
      if (!teacher) return;
      const modal = document.getElementById('facultyEmailModal');
      if (!modal) return;

      const avatarEl = document.getElementById('facultyEmailModalAvatar');
      const nameEl = document.getElementById('facultyEmailModalName');
      const deptEl = document.getElementById('facultyEmailModalDept');
      const codeEl = document.getElementById('facultyEmailModalCode');
      const addrEl = document.getElementById('facultyEmailModalAddress');
      const copyBtn = document.getElementById('btnFacultyEmailModalCopy');
      const copyText = document.getElementById('facultyEmailModalCopyText');
      const mailtoBtn = document.getElementById('btnFacultyEmailModalMailto');
      const closeBtn = document.getElementById('btnFacultyEmailModalClose');

      const cleanName = teacher.clean_name || teacher.name || 'Faculty Member';
      const initials = teacher.initials || cleanName.slice(0, 2).toUpperCase();
      const deptAvatarCls = (typeof getDeptAvatarClass === 'function') ? getDeptAvatarClass(teacher.department) : 'dept-avatar-commerce';
      const displayCode = (typeof getDisplayShortCode === 'function') ? getDisplayShortCode(teacher) : (teacher.short_code || '');

      if (avatarEl) {
        avatarEl.className = `faculty-initials-avatar ${deptAvatarCls}`;
        avatarEl.textContent = initials;
      }
      if (nameEl) nameEl.textContent = `Prof. ${cleanName}`;
      if (deptEl) deptEl.textContent = teacher.department || 'Faculty';
      if (codeEl) {
        if (displayCode) {
          codeEl.textContent = displayCode;
          codeEl.style.display = 'inline-block';
        } else {
          codeEl.style.display = 'none';
        }
      }

      const email = teacher.email || 'srcc@srcc.du.ac.in';
      if (addrEl) addrEl.textContent = email;
      if (mailtoBtn) mailtoBtn.href = `mailto:${encodeURIComponent(email)}`;

      if (copyBtn) {
        copyBtn.onclick = () => {
          copyToClipboard(email).then(() => {
            if (copyText) copyText.textContent = '✓ Copied!';
            showToast(`📋 Copied email for Prof. ${cleanName}`);
            setTimeout(() => { if (copyText) copyText.textContent = 'Copy Email'; }, 2000);
          });
        };
      }

      if (closeBtn) {
        closeBtn.onclick = () => { closeAppModal(modal); };
      }
      modal.onclick = (e) => {
        if (e.target === modal) closeAppModal(modal);
      };

      openAppModal(modal);
    }
    window.openFacultyEmailModal = openFacultyEmailModal;

    // Sleek Top-Right Email Icon & Chip Click Handlers (Student Assist SRCC Style)
    document.querySelectorAll('.btn-teacher-email-icon, .faculty-email-chip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const card = btn.closest('.faculty-card, .faculty-compact-card');
        const tId = card ? card.dataset.teacherId : null;
        const allT = (window.SRCC_TEACHERS_DATA?.teachers || teachersData?.teachers || []);
        const teacher = allT.find(t => String(t.id) === String(tId) || t.clean_name === tId) || {
          clean_name: btn.dataset.teacherName,
          email: btn.dataset.email
        };
        openFacultyEmailModal(teacher);
      });
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
      // Core B.Com (Hons) DSC / DSE
      'BLAW': 'Business Law',
      'FA': 'Financial Accounting',
      'MPA': 'Management Principles and Applications',
      'BECON': 'Business Economics',
      'POM': 'Principles of Marketing',
      'AUD': 'Auditing and Corporate Governance',
      'FMI': 'Financial Markets and Institutions',
      'EOE': 'Principles of Microeconomics',
      'EoE': 'Principles of Microeconomics',
      'EoE1': 'Principles of Microeconomics I',
      'BMATH': 'Business Mathematics',
      'ITLP': 'Income Tax Law and Practice',
      'MA': 'Management Accounting',
      'ED': 'Entrepreneurship Development',
      'MB': 'Money and Banking',
      'FM': 'Financial Management',
      'EVS': 'Environmental Studies',
      'EVS-I': 'Environmental Science: Theory into Practice-I',
      'EVS-II': 'Environmental Science: Theory into Practice-II',
      'PME-I': 'Principles of Microeconomics I',
      'PME': 'Principles of Microeconomics',
      'PMEE': 'Principles of Microeconomics',
      'BRM': 'Brand Management',
      'CAS': 'Computerized Accounting System',
      'CFD': 'Corporate Financial Decisions',
      'CFCR': 'Corporate Finance & Restructuring',
      'DnD': 'Digitalisation and Development',
      'IF': 'International Finance',
      'ODI': 'Organisational Dynamics & Intervention',
      'OB': 'Organisational Behaviour',
      'PAB': 'Public Administration and Business',

      // Core B.A. (Hons) Economics DSC / DSE
      'IM': 'Introductory Microeconomics',
      'IME': 'Introductory Microeconomics',
      'Intro Micro': 'Introductory Microeconomics',
      'Intro MME': 'Introductory Mathematical Methods for Economics',
      'Adv MME': 'Advanced Mathematical Methods for Economics',
      'IMA I': 'Intermediate Macroeconomics I',
      'IMIC1': 'Intermediate Microeconomics 1',
      'ISME': 'Introductory Statistics for Economics',
      'DE': 'Differential Equations',
      'EHI': 'Economic History of India',
      'IDE': 'Issues in Development Economics',
      'GT': 'Game Theory and Strategic Interactions',
      'PE': 'Political Economy',
      'PM': 'Project Management',
      'RM': 'Research Methodology',
      'GBS': 'Global Business Strategy',
      'OEM': 'Open Elective Management',
      'AdTrix': 'Advanced Econometrics',

      // Generic Electives (GE) across B.Com & Eco Hons
      'FOC': 'Fundamentals of Computing',
      'AFE': 'Accounting for Everyone',
      'MFB': 'Marketing for Beginners',
      'ISM': 'Information Systems Management',
      'BDE': 'Basic Development Economics',
      'DEC': 'Delhi through the Ages',
      'FC': 'Fundamentals of Calculus',
      'DMS': 'Database Management Systems',
      'ECom': 'E-Commerce',
      'GF': 'Genre Fiction',
      'RIDL': 'Readings in Indian Democratic Literature',
      'NM': 'Numerical Methods',
      'OS': 'Operating Systems',
      'OOPUP': 'Programming Using Python',
      'OPUP': 'Programming Using Python',
      'PUP': 'Programming Using Python',
      'IIPT': 'Indian Political Thought',
      'NII': 'Nationalism in India',
      'UIR': 'Understanding International Relations',
      'GIC': 'Global Institutions and Commerce',
      'IGT': 'Interactive Game Theory',
      'IMC': 'Integrated Marketing Communication',
      'IST': 'Introduction to Sports Training',
      'OE': 'Open Elective (Physical Education)',
      'TPF': 'Theory of Public Finance',
      'HFPE': 'Health, Fitness & Physical Education',

      // Skill Enhancement Courses (SEC)
      'AS': 'Advanced Spreadsheet',
      'BIT': 'Basic IT Tools',
      'ITSA I': 'IT Skills and Data Analysis I',
      'ITSA II': 'IT Skills and Data Analysis II',
      'BIDV': 'Business Intelligence and Data Visualisation',
      'CIEL': 'Communication in Everyday Life',
      'CPL': 'Communication in Professional Life',
      'CW': 'Creative Writing',
      'DM': 'Digital Marketing',
      'EP': 'Essentials of Python',
      'IE': 'Innovation and Entrepreneurship',
      'NL': 'Negotiation and Leadership',
      'PFP': 'Personal Financial Planning',
      'PSEL': 'Public Speaking in English Language and Leadership',
      'PSELL': 'Public Speaking in English Language and Leadership',
      'SET': 'Sustainable Eco Tourism and Entrepreneurship',
      'SMM': 'Social Media Marketing',
      'SRG': 'Sustainability Reporting',
      'SWR': 'Statistics with R',

      // Value Addition Courses (VAC)
      'ABH': 'The Art of Being Happy',
      'CVFD': 'Constitutional Values and Fundamental Duties',
      'EC': 'Ethics and Culture',
      'EI': 'Emotional Intelligence',
      'RIFE': 'Reading Indian Fiction in English',
      'TGNLC': 'The Gita: Navigating Life Challenges',
      'VAC SEL': 'Social and Emotional Learning',
      'SEL': 'Social and Emotional Learning',
      'VM I': 'Vedic Mathematics-I',
      'VM II': 'Vedic Mathematics-II',
      'VM III': 'Vedic Mathematics-III',

      // M.Com Courses
      'ACPA': 'Advanced Cost and Performance Analysis',
      'ACR': 'Accounting for Corporate Restructuring',
      'AIS': 'Accounting Information Systems',
      'BADS': 'Business Analytics & Data Science',
      'BF': 'Behavioral Finance',
      'BFIM': 'Banking, Financial Institutions & Markets',
      'BM': 'Business Management',
      'BSC': 'Business Communication',
      'DA': 'Data Analysis',
      'DTHRS': 'Design Thinking & HR Systems',
      'FP': 'Financial Planning',
      'IBS': 'International Business Strategy',
      'ITL': 'Income Tax Law',
      'ITPD': 'IT for Professional Development',
      'ME': 'Managerial Economics',
      'MFD': 'Macro Financial Dynamics',
      'SHRM': 'Strategic Human Resource Management',
      'SM': 'Strategic Management',
      'TA': 'Taxation & Accounting',
      'TR': 'Tools for Research',
      'WM': 'Wealth Management',

      // AEC / Languages
      'HA': 'Hindi Cinema aur Uska Adhyayan (Hindi A)',
      'HB': 'Hindi-B',
      'H B': 'Hindi-B',
      'HC': 'Hindi Bhasha aur Sahitya (Hindi C)',
      'HD': 'Hindi Gadhy: Udbhav aur Vikas (Hindi D)',
      'HE': 'Hindi Sahitya (Hindi E)',
      'English': 'English'
    };

    function getSubjectDetails(code, givenFullName, isVac, deptOrRaw) {
      const cleanCode = (code || '').trim();
      let fullName = (givenFullName || '').trim();
      const rawUpper = (deptOrRaw || '').toUpperCase();

      if (isVac || rawUpper.includes('VAC')) {
        if (cleanCode === 'DE') fullName = 'Digital Empowerment';
        else if (cleanCode === 'EC') fullName = 'Ethics and Culture';
        else if (cleanCode === 'EI') fullName = 'Emotional Intelligence';
        else if (cleanCode === 'FC') fullName = 'Financial Literacy';
      } else {
        if (cleanCode === 'DE' && (rawUpper.includes('MATH') || !fullName || fullName === 'DE' || fullName === 'Digital Empowerment' || fullName === 'Development Economics')) {
          fullName = 'Differential Equations';
        }
      }
      if (cleanCode === 'GF' && (rawUpper.includes('ENGLISH') || !fullName || fullName === 'GF' || fullName === 'Global Finance')) {
        fullName = 'Genre Fiction';
      }
      if (cleanCode === 'IST' && (rawUpper.includes('PHY.ED') || rawUpper.includes('PLAYGROUND') || rawUpper.includes('SCR1') || !fullName || fullName === 'IST' || fullName === 'Information Systems and Technology')) {
        fullName = 'Introduction to Sports Training';
      }
      if (cleanCode === 'R4' || (rawUpper.includes('ENGLISH') && rawUpper.includes('R4'))) {
        fullName = 'Readings in Indian Democratic Literature';
      }
      if (!fullName || fullName.toLowerCase() === cleanCode.toLowerCase() ||
          fullName === 'Business Research Management' || fullName === 'Corporate Valuation & Financial Decisions' ||
          fullName === 'Corporate Insolvency & Environmental Law' || fullName === 'Corporate Planning & Law' ||
          fullName === 'Advertising & Media Management' || fullName === 'Cost Accounting System' ||
          fullName === 'Negotiation & Deal Making' || fullName === 'Management of Financial Banks' ||
          fullName === 'Risk & Insurance in Financial Engineering' || fullName === 'Social Work & Relations' ||
          fullName === 'The Good, Nature & Local Community' || fullName === 'Tax Research' ||
          fullName === 'Banking & Finance' || fullName === 'Banking & Financial Institutions Management' ||
          fullName === 'Anuvad: Vyavahar aur Siddhant' || fullName === 'Accounting & Auditing' ||
          fullName === 'Academic & Creative Research' || fullName === 'Accounting for Financial Entities' ||
          fullName === 'English Literature' || fullName === 'GE' || fullName === 'R4' ||
          fullName === 'Business Data Ecosystem' || fullName === 'Digital Economy & E-Commerce') {
        fullName = SRCC_SUBJECT_MAP[cleanCode] || SRCC_SUBJECT_MAP[cleanCode.toUpperCase()] || fullName || cleanCode;
      }
      return {
        code: (cleanCode === 'R4' ? 'RIDL' : cleanCode),
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
          const subjInfo = getSubjectDetails(classItem.subject, classItem.subject_name, classItem.course === 'VAC', classItem.raw || classItem.dept || classItem.course);
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

      // If multiple teachers matched this room slot, validate against the room's official scheduled class
      if (matches.length > 1 && appData && Array.isArray(appData.rooms)) {
        const roomObj = appData.rooms.find(r => (r.code || '').trim().toUpperCase() === targetRoom);
        const daySched = roomObj && roomObj.schedule ? roomObj.schedule[day] : null;
        const occ = daySched && Array.isArray(daySched.occupied_slots) ? daySched.occupied_slots.find(o => o.slot === slot) : null;
        if (occ && occ.class) {
          const occClassUpper = occ.class.toUpperCase();
          const filteredMatches = matches.filter(m => {
            const sc = (m.teacher.short_code || '').trim().toUpperCase();
            if (sc && new RegExp('(^|[-_\\/\\s])' + sc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([-_\\/\\s]|$)', 'i').test(occClassUpper)) {
              return true;
            }
            const cleanNameUpper = (m.teacher.clean_name || '').toUpperCase();
            if (cleanNameUpper && occClassUpper.includes(cleanNameUpper)) {
              return true;
            }
            return false;
          });
          if (filteredMatches.length > 0) {
            return filteredMatches;
          }
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
      const isDeptPattern = /^(\d+\.\s*)?(commerce|economics|hindi|english|mathematics|maths|evs|political\s*science)$/i;

      // 1. Extract from schedule across all days (highest fidelity)
      Object.values(teacher.schedule || {}).flat().forEach(c => {
        let code = (c.subject || '').trim();
        let name = (c.subject_name || '').trim();
        if (isDeptPattern.test(code) && isDeptPattern.test(name)) return;
        if (isDeptPattern.test(code)) code = '';
        if (isDeptPattern.test(name)) name = '';

        if (!name && code) {
          name = SRCC_SUBJECT_MAP[code] || SRCC_SUBJECT_MAP[code.toUpperCase()] || code;
        }
        if (!code && name) {
          code = name.length <= 8 ? name : '';
        }
        if (isDeptPattern.test(code) || isDeptPattern.test(name)) return;

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
        if (!str || isDeptPattern.test(str)) return;
        const norm = str.toLowerCase();
        const normCode = str.toUpperCase();
        if (seenCodes.has(normCode) || seenNames.has(norm)) return;

        if (str.length <= 8 && (SRCC_SUBJECT_MAP[str] || SRCC_SUBJECT_MAP[normCode])) {
          const full = SRCC_SUBJECT_MAP[str] || SRCC_SUBJECT_MAP[normCode];
          if (isDeptPattern.test(full)) return;
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
    // 📤 SHARE FACULTY PROFILE / WEEKLY TIMETABLE
    // ========================================================================
    function shareTeacherProfile(teacher, targetDay = null) {
      if (!teacher) return;
      const currentSiteBase = (window.location.origin + window.location.pathname).replace(/\/+$/, '');
      const directFacultyUrl = `${currentSiteBase}/?faculty=${encodeURIComponent(teacher.clean_name)}`;
      const activeDay = targetDay || facultyState.modalActiveDay || facultyState.activeDay || ((typeof getLiveDayName === 'function') ? getLiveDayName() : 'Monday');
      const displayCode = (typeof getDisplayShortCode === 'function') ? getDisplayShortCode(teacher) : (teacher.short_code || '');
      const shareTitle = `SRCC Faculty Timetable: Prof. ${teacher.clean_name}`;

      // Build daily schedule for the active/tapped day
      const daySched = (teacher.schedule && teacher.schedule[activeDay]) || [];
      let daySchedText = '';
      try {
        if (daySched.length > 0) {
          const sorted = [...daySched].sort((a, b) => {
            const pA = getPeriodInfo(a.slot)?.num || 99;
            const pB = getPeriodInfo(b.slot)?.num || 99;
            return pA - pB;
          });
          const classLines = sorted.map(c => {
            const pInfo = getPeriodInfo(c.slot);
            const timeStr = pInfo ? `${pInfo.start} – ${pInfo.end}` : (c.slot || '');
            const subjName = c.subject_name || c.subject || 'Class';
            const subjCode = (c.subject && c.subject !== subjName) ? ` (${c.subject})` : '';
            const roomStr = c.room ? ` · Room ${c.room}` : '';
            const typeStr = (c.type && c.type !== 'Lecture') ? ` · ${c.type}` : '';
            let secStr = '';
            if (c.section && c.section.toLowerCase() !== 'joint' && !c.section.toLowerCase().includes('reconciled')) {
              secStr = ` · ${c.course ? c.course + ' ' : ''}${c.semester ? c.semester + ' ' : ''}${c.section}`;
              if (c.batch) secStr += ` (Batch ${formatBatchCode(c.batch)})`;
            } else if (c.semester && !c.semester.toLowerCase().includes('all sem')) {
              secStr = ` · ${c.course ? c.course + ' ' : ''}${c.semester}`;
            }
            return `  • ${timeStr}: ${subjName}${subjCode}${roomStr}${typeStr}${secStr}`;
          });
          daySchedText = `📅 Schedule for ${activeDay}:\n${classLines.join('\n')}\n\n`;
        } else {
          daySchedText = `📅 Schedule for ${activeDay}: No lectures scheduled (Free Day)\n\n`;
        }
      } catch (errSched) {
        console.warn('Error formatting schedule for share:', errSched);
        daySchedText = `📅 Schedule for ${activeDay}: Please check online portal\n\n`;
      }

      const emailPart = teacher.email ? `✉️ Email: ${teacher.email}\n` : '';

      const cleanMessage = `👨‍🏫 SRCC Faculty Schedule & Timetable\n\n` +
        `👤 Prof. ${teacher.clean_name} ${displayCode ? `(${displayCode})` : ''}\n` +
        `🏛️ Department: ${teacher.department || 'Faculty'}\n` +
        emailPart + `\n` +
        daySchedText +
        `🔗 View Full Timetable & Classroom Locations:\n${directFacultyUrl}`;

      const whatsappMessage = `👨‍🏫 *SRCC Faculty Schedule & Timetable*\n\n` +
        `👤 *Prof. ${teacher.clean_name}* ${displayCode ? `(${displayCode})` : ''}\n` +
        `🏛️ *Department:* ${teacher.department || 'Faculty'}\n` +
        emailPart + `\n` +
        daySchedText +
        `🔗 *View Full Timetable & Classroom Locations:*\n${directFacultyUrl}`;

      const emailSubject = `SRCC Faculty Timetable: Prof. ${teacher.clean_name} (${activeDay})`;

      // Prepare unified Share Modal contents
      currentShareMessage = cleanMessage;
      if (shareModalTitle) shareModalTitle.textContent = `📤 Share Prof. ${teacher.clean_name} (${activeDay})`;
      if (sharePreviewText) sharePreviewText.textContent = cleanMessage;

      const encodedWaMsg = encodeURIComponent(whatsappMessage);
      const encodedCleanMsg = encodeURIComponent(cleanMessage);
      const encodedUrl = encodeURIComponent(directFacultyUrl);

      if (shareBtnWhatsapp) {
        shareBtnWhatsapp.href = `https://api.whatsapp.com/send?text=${encodedWaMsg}`;
      }
      if (shareBtnGmail) {
        shareBtnGmail.href = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(emailSubject)}&body=${encodedCleanMsg}`;
      }
      if (shareBtnX) {
        shareBtnX.href = `https://x.com/intent/tweet?text=${encodeURIComponent(`👨‍🏫 SRCC Faculty Schedule: Prof. ${teacher.clean_name} (${activeDay})`)}&url=${encodedUrl}`;
      }
      if (shareBtnTelegram) {
        shareBtnTelegram.href = `https://t.me/share/url?text=${encodedCleanMsg}&url=${encodedUrl}`;
      }

      // Check mobile native share sheet
      const isMobileDevice = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || (window.innerWidth <= 768);
      if (isMobileDevice && navigator.share) {
        navigator.share({
          title: shareTitle,
          text: whatsappMessage
        }).then(() => {
          showToast(`📤 Shared schedule for Prof. ${teacher.clean_name} (${activeDay})!`);
        }).catch((err) => {
          if (err.name !== 'AbortError' && shareModal) {
            openAppModal(shareModal);
          }
        });
        return;
      }

      // On Laptop/Desktop or fallback: IMMEDIATELY open Share Modal with WhatsApp, Gmail, Telegram, Copy Link
      if (shareModal) {
        openAppModal(shareModal);
      } else {
        copyToClipboard(cleanMessage).then(() => {
          showToast(`📋 Copied schedule for Prof. ${teacher.clean_name}!`);
        });
      }
    }
    window.shareTeacherProfile = shareTeacherProfile;

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
            ${teacher.email ? `
              <button type="button" class="th-chip th-email-copy-chip" id="btnModalCopyTeacherEmail" title="Copy teacher email" style="cursor: pointer; background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; border-radius: 999px; padding: 2px 10px; font-size: 0.76rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
                ✉️ Copy Email
              </button>` : ''}
          </div>
        `;

        const btnCopyEmail = document.getElementById('btnModalCopyTeacherEmail');
        if (btnCopyEmail && teacher.email) {
          btnCopyEmail.addEventListener('click', (e) => {
            e.stopPropagation();
            copyToClipboard(teacher.email).then(() => {
              btnCopyEmail.textContent = '✓ Copied!';
              showToast(`📋 Copied email for Prof. ${teacher.clean_name}`);
              setTimeout(() => { btnCopyEmail.textContent = '✉️ Copy Email'; }, 2000);
            });
          });
        }
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

      const leaveInfo = isTeacherOnLeave(teacher);

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
        '8:30 AM to 9:30 AM': 1, '8:30 AM – 9:30 AM': 1, '8:30 AM - 9:30 AM': 1,
        '9:30 AM to 10:30 AM': 2, '9:30 AM – 10:30 AM': 2, '9:30 AM - 10:30 AM': 2,
        '10:30 AM to 11:30 AM': 3, '10:30 AM – 11:30 AM': 3, '10:30 AM - 11:30 AM': 3,
        '11:30 AM to 12:30 PM': 4, '11:30 AM – 12:30 PM': 4, '11:30 AM - 12:30 PM': 4,
        '12:30 PM to 1:30 PM': 5, '12:30 PM – 1:30 PM': 5, '12:30 PM - 1:30 PM': 5, '1:00 PM to 2:00 PM': 5,
        '2:00 PM to 3:00 PM': 6, '2:00 PM – 3:00 PM': 6, '2:00 PM - 3:00 PM': 6,
        '3:00 PM to 4:00 PM': 7, '3:00 PM – 4:00 PM': 7, '3:00 PM - 4:00 PM': 7,
        '4:00 PM to 5:00 PM': 8, '4:00 PM – 5:00 PM': 8, '4:00 PM - 5:00 PM': 8,
        '5:00 PM to 6:00 PM': 9, '5:00 PM – 6:00 PM': 9, '5:00 PM - 6:00 PM': 9
      };
      const slotTimes = {
        1: { start: '8:30 AM', end: '9:30 AM' }, 2: { start: '9:30 AM', end: '10:30 AM' },
        3: { start: '10:30 AM', end: '11:30 AM' }, 4: { start: '11:30 AM', end: '12:30 PM' },
        5: { start: '12:30 PM', end: '1:30 PM' }, 6: { start: '2:00 PM', end: '3:00 PM' },
        7: { start: '3:00 PM', end: '4:00 PM' }, 8: { start: '4:00 PM', end: '5:00 PM' },
        9: { start: '5:00 PM', end: '6:00 PM' }
      };

      function getSlotPeriodNum(slot) {
        if (!slot) return 99;
        const s = slot.trim();
        if (periodOrder[s]) return periodOrder[s];
        const norm = s.replace(/\s+/g, ' ');
        if (periodOrder[norm]) return periodOrder[norm];
        const m = norm.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
        if (m) {
          let hr = parseInt(m[1], 10);
          const ampm = (m[3] || '').toUpperCase();
          if (ampm === 'PM' && hr < 12) hr += 12;
          if (ampm === 'AM' && hr === 12) hr = 0;
          if (hr === 8) return 1;
          if (hr === 9) return 2;
          if (hr === 10) return 3;
          if (hr === 11) return 4;
          if (hr === 12 || hr === 13) return 5;
          if (hr === 14) return 6;
          if (hr === 15) return 7;
          if (hr === 16) return 8;
          if (hr === 17) return 9;
        }
        return 99;
      }

      const sortedSched = [...daySched].sort((a, b) => getSlotPeriodNum(a.slot) - getSlotPeriodNum(b.slot));

      // Consolidate duplicate slots with same period & room (e.g. sub-batches J1, J2, J3 / JP1, JP2, JP3 / Lab / Tut)
      const slotTeacherMap = new Map();
      sortedSched.forEach(cls => {
        const pNum = getSlotPeriodNum(cls.slot);
        const rNorm = (cls.room || '').trim().toLowerCase();
        const key = (pNum < 90 && rNorm && rNorm !== 'tbd' && rNorm !== 'none') ? `${pNum}__${rNorm}` : `${cls.slot}__${rNorm}__${(cls.subject || '').trim().toLowerCase()}`;
        if (!slotTeacherMap.has(key)) {
          const clone = { ...cls };
          clone._batchList = [];
          if (cls.batch) clone._batchList.push(cls.batch);
          slotTeacherMap.set(key, clone);
        } else {
          const existing = slotTeacherMap.get(key);
          if (cls.batch && !existing._batchList.includes(cls.batch)) {
            existing._batchList.push(cls.batch);
          }
          if (cls.type && /lab|tut|prac/i.test(cls.type)) {
            existing.type = cls.type;
          }
        }
      });

      const uniqueTeacherSched = Array.from(slotTeacherMap.values()).map(it => {
        if (it._batchList && it._batchList.length > 1) {
          const cleanBatches = it._batchList.map(b => b.replace(/^Batch\s+/i, '')).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
          it.batch = cleanBatches.join(', ');
        }
        delete it._batchList;
        return it;
      });

      uniqueTeacherSched.forEach(cls => {
        const pNum = getSlotPeriodNum(cls.slot);
        if (mergedDaySched.length > 0) {
          const last = mergedDaySched[mergedDaySched.length - 1];
          const isSameClass = last.subject === cls.subject &&
                              last.batch === cls.batch &&
                              last.room === cls.room &&
                              last.course === cls.course &&
                              last.section === cls.section;
          const isSecVac = Boolean(/SEC/i.test(cls.raw || '') || /VAC/i.test(cls.raw || '') || cls.isSec || cls.isVac);
          if (isSecVac && isSameClass && pNum > 0 && last.endPeriodNum + 1 === pNum) {
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
      const tableRows = mergedDaySched.map((cls, idx) => {
        const roomCode = cls.room ? cls.room.trim() : 'TBD';
        const subjInfo = getSubjectDetails(cls.subject, cls.subject_name, /VAC/i.test(cls.raw || ''));
        const subjCode = subjInfo.code;
        const subjFullName = subjInfo.fullName;
        const courseName = cls.course || 'B.Com (Hons)';
        const sem = cls.semester || '';
        const sec = (cls.section && cls.section.toLowerCase() !== 'joint') ? cls.section : '';
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
                ${(batch || rawBatch) ? `<span class="class-batch-badge" style="color: var(--srcc-gold); border-color: rgba(252, 235, 10, 0.3); font-size: 0.72rem; padding: 1.5px 6px; flex-shrink: 0;">Batch ${escapeHtml(formatBatchCode(batch || rawBatch))}</span>` : ''}
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
      const mobileCards = mergedDaySched.map((cls, idx) => {
        const roomCode = cls.room ? cls.room.trim() : 'TBD';
        const subjInfo = getSubjectDetails(cls.subject, cls.subject_name, /VAC/i.test(cls.raw || ''));
        const subjCode = subjInfo.code;
        const subjFullName = subjInfo.fullName;
        const courseName = cls.course || 'B.Com (Hons)';
        const sem = cls.semester || '';
        const sec = (cls.section && cls.section.toLowerCase() !== 'joint') ? cls.section : '';
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
                ${(batch || rawBatch) ? `<span class="batch-chip" style="font-size: 0.72rem; padding: 1.5px 6px; flex-shrink: 0;">Batch ${escapeHtml(formatBatchCode(batch || rawBatch))}</span>` : ''}
              </div>
            </div>
            <div class="m-tt-meta-row" style="display: flex; justify-content: flex-end; align-items: center;">
              <div>
                ${(roomCode && roomCode !== 'TBD' && roomCode !== 'TBA') ? `
                  <button class="m-tt-room-btn modal-room-jump" data-room="${escapeHtml(getTargetRoomJumpCode(roomCode))}" title="View room in Free Classroom Finder">
                    🏛️ Room ${escapeHtml(getDisplayRoomName(roomCode))} ↗
                  </button>
                ` : `<span class="room-pill-tba" title="Room not specified in official college timetable">🏛️ Room TBA</span>`}
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

    if (btnShareTeacherProfile) {
      btnShareTeacherProfile.addEventListener('click', () => {
        if (facultyState.modalActiveTeacher) {
          shareTeacherProfile(facultyState.modalActiveTeacher, facultyState.modalActiveDay);
        }
      });
    }

    if (btnPrintTeacherTimetable) {
      btnPrintTeacherTimetable.addEventListener('click', () => {
        document.body.classList.add('print-teacher-modal-active');
        document.body.classList.remove('print-room-modal-active');
        window.print();
      });
    }

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

    function getClientDisplayCode(leave) {
      if (!leave) return '';
      if (teachersData && teachersData.teachers) {
        const t = teachersData.teachers.find(tch => 
          (leave.teacher_id && String(tch.id) === String(leave.teacher_id)) ||
          (leave.teacher_name && tch.clean_name && tch.clean_name.toLowerCase().trim() === leave.teacher_name.toLowerCase().trim())
        );
        if (t) return getDisplayShortCode(t);
      }
      const raw = (leave.teacher_code || leave.teacherCode || '').trim();
      let primary = raw.includes('/') ? raw.split('/')[0].trim().toUpperCase() : raw.toUpperCase();
      if (!primary || /\d/.test(primary) || /^(cg|hg|csg|eg|mg|hgc|psg|guest)\b/i.test(primary)) return '';
      return primary;
    }

    function buildLeavesWhatsAppMessage(leavesList) {
      const today = getTodayIsoDate();
      const activeList = getActiveTodayLeaves(today);

      if (!activeList || activeList.length === 0) {
        return `*SRCC Faculty Leave Update*\nNo professors are currently marked on leave today.\n\n_Check free classrooms:_ ${getAppPublicUrl()}`;
      }
      const lines = activeList.map((l, idx) => {
        const pCode = getClientDisplayCode(l);
        const code = pCode ? ` [${pCode}]` : '';
        const dates = formatLeaveDates(l.start_date, l.end_date);
        const cName = getCleanStudentFacultyName(l.teacher_name, l.teacher_id);
        return `${idx + 1}. ${cName}${code} (${dates})`;
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
        const pCode = getClientDisplayCode(leave);
        const code = pCode ? ` [${escapeHtml(pCode)}]` : '';
        const dateRangeDisplay = formatLeaveDates(s, e);
        const halfDayBadge = leave.isHalfDay ? `<span style="background: #FEF3C7; color: #92400E; border: 1px solid #FCD34D; font-size: 0.68rem; font-weight: 800; padding: 2px 7px; border-radius: 9999px;">½ DAY</span>` : '';
        const cleanName = getCleanStudentFacultyName(leave.teacher_name, leave.teacher_id);

        const singleLeaveMsg = `*SRCC Faculty Leave Update* 🏖️\n\n1. ${cleanName}${code} (${dateRangeDisplay})\n\n_Check free classrooms:_ ${shareSiteUrl}`;

        return `
          <div class="leave-item-row" data-leave-id="${leave.id}">
            <span class="leave-item-num">${idx + 1}</span>
            <div class="leave-item-details">
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span class="leave-item-teacher">${escapeHtml(cleanName)}${code}</span>
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
      if (leaveManagerModal) openAppModal(leaveManagerModal);
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
                    const details = getSubjectDetails(s.subject, s.subject_name, false);
                    secBatchMeta[sem][batch] = { code: details.code || s.subject || '', name: details.fullName || s.subject_name || '' };
                  }
                }
                if (isVac && isRealVac) {
                  if (!vacBatchesBySem[sem]) vacBatchesBySem[sem] = new Set();
                  vacBatchesBySem[sem].add(batch);
                  if (!vacBatchMeta[sem]) vacBatchMeta[sem] = {};
                  if (!vacBatchMeta[sem][batch]) {
                    const details = getSubjectDetails(s.subject, s.subject_name, true);
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

        // Ingest official direct SEC, VAC and Class sections from SRCC_CLASSES_DATA
        if (window.SRCC_CLASSES_DATA && window.SRCC_CLASSES_DATA.courses) {
          const cData = window.SRCC_CLASSES_DATA.courses;
          if (cData.SEC) {
            Object.keys(cData.SEC).forEach(sem => {
              if (!secBatchesBySem[sem]) secBatchesBySem[sem] = new Set();
              if (!secBatchMeta[sem]) secBatchMeta[sem] = {};
              cData.SEC[sem].forEach(s => {
                if (s.batch) {
                  secBatchesBySem[sem].add(s.batch);
                  secBatchMeta[sem][s.batch] = { code: s.subject || '', name: s.subject_name || '' };
                }
              });
            });
          }
          if (cData.VAC) {
            Object.keys(cData.VAC).forEach(sem => {
              if (!vacBatchesBySem[sem]) vacBatchesBySem[sem] = new Set();
              if (!vacBatchMeta[sem]) vacBatchMeta[sem] = {};
              cData.VAC[sem].forEach(s => {
                if (s.batch) {
                  vacBatchesBySem[sem].add(s.batch);
                  vacBatchMeta[sem][s.batch] = { code: s.subject || '', name: s.subject_name || '' };
                }
              });
            });
          }
          ['B.Com (Hons)', 'B.A. (Hons) Economics', 'M.Com'].forEach(cName => {
            if (cData[cName]) {
              if (!courseMap[cName]) courseMap[cName] = {};
              Object.keys(cData[cName]).forEach(sem => {
                if (!courseMap[cName][sem]) courseMap[cName][sem] = {};
                Object.keys(cData[cName][sem]).forEach(sec => {
                  if (!courseMap[cName][sem][sec]) courseMap[cName][sem][sec] = new Set();
                  cData[cName][sem][sec].forEach(s => {
                    if (s.batch) courseMap[cName][sem][sec].add(s.batch);
                  });
                });
              });
            }
          });
        }
      }

      buildHierarchy();

      const validCourses = ['B.A. (Hons) Economics', 'B.Com (Hons)', 'SEC', 'VAC'];
      let savedCourse = localStorage.getItem('srcc_my_tt_course');
      let savedSem = localStorage.getItem('srcc_my_tt_sem');
      let savedSec = localStorage.getItem('srcc_my_tt_sec');
      let savedBatch = localStorage.getItem('srcc_my_tt_batch') || 'ALL';

      // Fallback from widget preference if timetable storage isn't set yet
      try {
        const widgetPrefRaw = localStorage.getItem('srcc_my_batch_widget_pref_v1');
        if (widgetPrefRaw) {
          const wp = JSON.parse(widgetPrefRaw);
          if (wp) {
            if (!savedCourse && wp.course) savedCourse = wp.course;
            if (!savedSem && wp.sem) savedSem = wp.sem;
            if (!savedSec && wp.sec) savedSec = wp.sec;
            if ((!savedBatch || savedBatch === 'ALL') && wp.batch) savedBatch = wp.batch;
          }
        }
      } catch (e) {}

      // Normalize Semester
      if (savedSem) {
        const sClean = String(savedSem).trim();
        if (sClean === '1' || /^(?:sem(?:ester)?\s*)?1$/i.test(sClean) || /^sem\s*i$/i.test(sClean)) savedSem = 'Sem I';
        else if (sClean === '3' || /^(?:sem(?:ester)?\s*)?3$/i.test(sClean) || /^sem\s*iii$/i.test(sClean)) savedSem = 'Sem III';
        else if (sClean === '5' || /^(?:sem(?:ester)?\s*)?5$/i.test(sClean) || /^sem\s*v$/i.test(sClean)) savedSem = 'Sem V';
        else if (sClean === '7' || /^(?:sem(?:ester)?\s*)?7$/i.test(sClean) || /^sem\s*vii$/i.test(sClean)) savedSem = 'Sem VII';
      }

      // Normalize Section (e.g., "J" -> "Sec J", "Section J" -> "Sec J")
      if (savedSec) {
        const secClean = String(savedSec).trim();
        const m = secClean.match(/^(?:sec(?:tion)?\s*)?([A-Za-z])$/i);
        if (m) {
          savedSec = `Sec ${m[1].toUpperCase()}`;
        }
      }

      // Auto-resolve course if section is between E and N (Only B.Com (Hons) has Sec E through N at SRCC)
      if (savedSec && ['Sec E', 'Sec F', 'Sec G', 'Sec H', 'Sec I', 'Sec J', 'Sec K', 'Sec L', 'Sec M', 'Sec N'].includes(savedSec)) {
        savedCourse = 'B.Com (Hons)';
      }

      if (savedCourse === 'SEC_VAC' || savedCourse === 'SEC / VAC' || savedCourse === 'M.Com' || savedCourse === 'GBO') {
        savedCourse = 'B.Com (Hons)';
      }

      if (!savedCourse || !validCourses.includes(savedCourse)) {
        savedCourse = 'B.Com (Hons)';
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
      window._srccTtState = ttState;

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
          } else {
            ttMainSearchInput.placeholder = 'Search subject (e.g. MME), teacher, batch, or room...';
          }
        }

        // Semesters adjustments for SEC / VAC
        if (isSecVacCourse) {
          if (ttState.sem === 'Sem VII') {
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
        '8:30 AM – 9:30 AM': { num: 1, start: '8:30 AM', end: '9:30 AM' },
        '8:30 AM - 9:30 AM': { num: 1, start: '8:30 AM', end: '9:30 AM' },
        '9:30 AM to 10:30 AM': { num: 2, start: '9:30 AM', end: '10:30 AM' },
        '9:30 AM – 10:30 AM': { num: 2, start: '9:30 AM', end: '10:30 AM' },
        '9:30 AM - 10:30 AM': { num: 2, start: '9:30 AM', end: '10:30 AM' },
        '10:30 AM to 11:30 AM': { num: 3, start: '10:30 AM', end: '11:30 AM' },
        '10:30 AM – 11:30 AM': { num: 3, start: '10:30 AM', end: '11:30 AM' },
        '10:30 AM - 11:30 AM': { num: 3, start: '10:30 AM', end: '11:30 AM' },
        '11:30 AM to 12:30 PM': { num: 4, start: '11:30 AM', end: '12:30 PM' },
        '11:30 AM – 12:30 PM': { num: 4, start: '11:30 AM', end: '12:30 PM' },
        '11:30 AM - 12:30 PM': { num: 4, start: '11:30 AM', end: '12:30 PM' },
        '12:30 PM to 1:30 PM': { num: 5, start: '12:30 PM', end: '1:30 PM' },
        '12:30 PM – 1:30 PM': { num: 5, start: '12:30 PM', end: '1:30 PM' },
        '12:30 PM - 1:30 PM': { num: 5, start: '12:30 PM', end: '1:30 PM' },
        '1:00 PM to 2:00 PM': { num: 5, start: '12:30 PM', end: '1:30 PM' },
        '2:00 PM to 3:00 PM': { num: 6, start: '2:00 PM', end: '3:00 PM' },
        '2:00 PM – 3:00 PM': { num: 6, start: '2:00 PM', end: '3:00 PM' },
        '2:00 PM - 3:00 PM': { num: 6, start: '2:00 PM', end: '3:00 PM' },
        '3:00 PM to 4:00 PM': { num: 7, start: '3:00 PM', end: '4:00 PM' },
        '3:00 PM – 4:00 PM': { num: 7, start: '3:00 PM', end: '4:00 PM' },
        '3:00 PM - 4:00 PM': { num: 7, start: '3:00 PM', end: '4:00 PM' },
        '4:00 PM to 5:00 PM': { num: 8, start: '4:00 PM', end: '5:00 PM' },
        '4:00 PM – 5:00 PM': { num: 8, start: '4:00 PM', end: '5:00 PM' },
        '4:00 PM - 5:00 PM': { num: 8, start: '4:00 PM', end: '5:00 PM' },
        '5:00 PM to 6:00 PM': { num: 9, start: '5:00 PM', end: '6:00 PM' },
        '5:00 PM – 6:00 PM': { num: 9, start: '5:00 PM', end: '6:00 PM' },
        '5:00 PM - 6:00 PM': { num: 9, start: '5:00 PM', end: '6:00 PM' }
      };

      function getPeriodInfo(slotStr) {
        if (!slotStr) return null;
        const trimmed = slotStr.trim();
        if (academicPeriodsMap[trimmed]) return academicPeriodsMap[trimmed];
        const norm = trimmed.replace(/\s+/g, ' ');
        if (academicPeriodsMap[norm]) return academicPeriodsMap[norm];
        const m = norm.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
        if (m) {
          let hr = parseInt(m[1], 10);
          const ampm = (m[3] || '').toUpperCase();
          if (ampm === 'PM' && hr < 12) hr += 12;
          if (ampm === 'AM' && hr === 12) hr = 0;
          if (hr === 8) return academicPeriodsMap['8:30 AM to 9:30 AM'];
          if (hr === 9) return academicPeriodsMap['9:30 AM to 10:30 AM'];
          if (hr === 10) return academicPeriodsMap['10:30 AM to 11:30 AM'];
          if (hr === 11) return academicPeriodsMap['11:30 AM to 12:30 PM'];
          if (hr === 12 || hr === 13) return academicPeriodsMap['12:30 PM to 1:30 PM'];
          if (hr === 14) return academicPeriodsMap['2:00 PM to 3:00 PM'];
          if (hr === 15) return academicPeriodsMap['3:00 PM to 4:00 PM'];
          if (hr === 16) return academicPeriodsMap['4:00 PM to 5:00 PM'];
          if (hr === 17) return academicPeriodsMap['5:00 PM to 6:00 PM'];
        }
        return null;
      }

      function mergeConsecutiveSessions(rawList) {
        if (!rawList || rawList.length === 0) return [];

        // Pre-pass: Consolidate sessions with same periodNum, room, teacher, and subject
        // so that sub-batches (J1, J2, J3 / JP1, JP2, JP3) share one unified tile
        const slotMap = new Map();
        rawList.forEach(item => {
          const tKey = (item.teacherId || item.teacher || '').trim().toLowerCase();
          const sKey = (item.subject || '').trim().toLowerCase();
          const rKey = (item.room || '').trim().toLowerCase();
          const pKey = item.periodNum;
          const slotKey = (pKey && rKey && rKey !== 'none' && rKey !== 'tbd' && tKey) ? `${pKey}__${rKey}__${tKey}` : `${pKey}__${rKey}__${tKey}__${sKey}`;

          if (!slotMap.has(slotKey)) {
            const clone = Object.assign({}, item);
            clone._batchList = [];
            const b = (item.batch || item.rawBatch || '').trim();
            if (b) clone._batchList.push(b);
            slotMap.set(slotKey, clone);
          } else {
            const existing = slotMap.get(slotKey);
            const b = (item.batch || item.rawBatch || '').trim();
            if (b && !existing._batchList.includes(b)) {
              existing._batchList.push(b);
            }
            if (item.isLab || item.isTut || item.type === 'LAB' || item.type === 'TUT') {
              existing.isLab = existing.isLab || item.isLab;
              existing.isTut = existing.isTut || item.isTut;
              existing.type = existing.type || item.type;
            }
          }
        });

        const consolidatedList = Array.from(slotMap.values()).map(it => {
          if (it._batchList && it._batchList.length > 1) {
            const cleanBatches = it._batchList.map(b => b.replace(/^Batch\s+/i, '')).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
            const joined = cleanBatches.join(', ');
            it.batch = `Batch ${joined}`;
            it.rawBatch = joined;
          }
          delete it._batchList;
          return it;
        });

        const groups = {};
        consolidatedList.forEach(item => {
          const key = `${item.teacherId || item.teacher}__${item.subject}__${item.batch}__${item.room}`;
          if (!groups[key]) groups[key] = [];
          groups[key].push(item);
        });

        const merged = [];

        Object.values(groups).forEach(items => {
          const isSecVac = Boolean(items[0].isSec || items[0].isVac);

          const byPeriod = {};
          items.forEach(it => {
            if (!byPeriod[it.periodNum]) {
              byPeriod[it.periodNum] = it;
            } else if (it.rawBatch && it.rawBatch !== byPeriod[it.periodNum].rawBatch) {
              byPeriod[it.periodNum].rawBatch = 'Whole Section';
            }
          });

          const uniquePeriods = Object.keys(byPeriod).map(n => parseInt(n, 10)).sort((a, b) => a - b);

          // Per user rule: In B.Com (Hons), B.A. (Hons) Economics, and normal classes, DO NOT merge consecutive classes into one tile!
          // Only for SEC and VAC courses (practical multi-hour blocks 2-6 periods) should classes be merged.
          if (!isSecVac) {
            uniquePeriods.forEach(pNum => {
              merged.push(createSessionBlock([pNum], byPeriod));
            });
            return;
          }

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

        const getBatchSortNum = (s) => {
          const b = String(s.batch || s.rawBatch || '').toUpperCase();
          const m = b.match(/\d+/);
          return m ? parseInt(m[0], 10) : 999;
        };

        merged.sort((a, b) => {
          if (a.startPeriod !== b.startPeriod) return a.startPeriod - b.startPeriod;
          const bA = getBatchSortNum(a);
          const bB = getBatchSortNum(b);
          if (bA !== bB) return bA - bB;
          return (a.subject || '').localeCompare(b.subject || '');
        });
        return merged;
      }

      function createSessionBlock(periodNums, periodMap) {
        const startP = periodNums[0];
        const endP = periodNums[periodNums.length - 1];
        const base = periodMap[startP];
        const pCount = periodNums.length;

        const startSlot = academicPeriods[startP - 1]?.slot;
        const endSlot = academicPeriods[endP - 1]?.slot;
        const startInfo = getPeriodInfo(startSlot) || { start: '8:30 AM' };
        const endInfo = getPeriodInfo(endSlot) || { end: '9:30 AM' };
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

        // 1. Direct High-Fidelity Query from Official SRCC Classes Data (JOINT SEC-VAC & Class Sections)
        if (window.SRCC_CLASSES_DATA && window.SRCC_CLASSES_DATA.courses) {
          const cData = window.SRCC_CLASSES_DATA.courses;
          let candidateList = [];
          if (targetCourse === 'SEC' && cData.SEC && cData.SEC[targetSem]) {
            candidateList = cData.SEC[targetSem];
          } else if (targetCourse === 'VAC' && cData.VAC && cData.VAC[targetSem]) {
            candidateList = cData.VAC[targetSem];
          } else if (cData[targetCourse] && cData[targetCourse][targetSem]) {
            if (targetSec && targetSec !== 'ALL' && cData[targetCourse][targetSem][targetSec]) {
              candidateList = cData[targetCourse][targetSem][targetSec];
            } else if (!targetSec || targetSec === 'ALL') {
              Object.values(cData[targetCourse][targetSem]).forEach(arr => {
                if (Array.isArray(arr)) candidateList.push(...arr);
              });
            }
          }

          if (candidateList.length > 0) {
            const selBatch = (targetBatch || 'ALL').trim().toUpperCase();
            candidateList.forEach(s => {
              if (s.day !== targetDay) return;
              if (selBatch !== 'ALL') {
                const sBatchRaw = (s.batch || '').trim().toUpperCase();
                // Normal lectures (empty batch or whole section) always match and notify!
                if (sBatchRaw && sBatchRaw !== 'WHOLE SECTION' && sBatchRaw !== 'ALL') {
                  const targetSubBatches = selBatch.split(/[\s,\/]+/).map(x => x.trim().toUpperCase()).filter(Boolean);
                  const expandedTargets = new Set(targetSubBatches);
                  targetSubBatches.forEach(tok => {
                    const mp = tok.match(/^([A-Z]+)P(\d+)$/);
                    if (mp) {
                      expandedTargets.add(`${mp[1]}${mp[2]}`);
                    } else {
                      const m = tok.match(/^([A-Z]+)(\d+)$/);
                      if (m && !m[1].endsWith('P')) {
                        expandedTargets.add(`${m[1]}P${m[2]}`);
                      }
                    }
                  });
                  const classBatches = sBatchRaw.split(/[\s,]+/).map(x => x.trim().toUpperCase()).filter(Boolean);
                  const matches = classBatches.some(cb => expandedTargets.has(cb));
                  if (!matches) return;
                }
              }

              const slotInfo = getPeriodInfo(s.slot);
              if (!slotInfo) return;

              const tName = getCleanStudentFacultyName(s.teacher_name || s.teacher || 'Faculty', s.teacher_id);
              const teacherObj = (teachersData && teachersData.teachers) ? teachersData.teachers.find(tch => String(tch.id) === String(s.teacher_id)) : null;
              const leaveRecord = isTeacherOnLeave(teacherObj || { clean_name: tName, name: tName, id: s.teacher_id });

              rawList.push({
                slot: s.slot,
                periodNum: slotInfo.num,
                subject: s.subject,
                subjectName: s.subject_name,
                type: s.type || 'Lecture',
                batch: s.batch || (s.type === 'Lecture' ? 'Whole Section' : ''),
                rawBatch: s.batch || (s.type === 'Lecture' ? 'Whole Section' : ''),
                teacher: tName,
                teacherId: s.teacher_id || '',
                room: s.room || '',
                isOnLeave: Boolean(leaveRecord),
                isSec: (targetCourse === 'SEC' || s.course === 'SEC'),
                isVac: (targetCourse === 'VAC' || s.course === 'VAC'),
                sem: s.semester || targetSem,
                day: targetDay
              });
            });

            if (rawList.length > 0) {
              return mergeConsecutiveSessions(rawList);
            }
          }
        }

        teachers.forEach(t => {
          const tName = getCleanStudentFacultyName(t.clean_name || t.label || 'Faculty', t.id);
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
                const allBatches = [
                  s.batch,
                  s.raw_batch,
                  ...(s.batches_list || []),
                  ...(s.raw_batches_list || [])
                ].filter(Boolean).map(b => b.toUpperCase().trim());

                // If class has a specific batch (not empty/whole section)
                const isGroupClass = allBatches.length > 0 && allBatches.some(b => b !== 'WHOLE SECTION' && b !== 'ALL');
                if (isGroupClass) {
                  const targetSubBatches = selBatch.split(/[\s,\/]+/).map(x => x.trim().toUpperCase()).filter(Boolean);
                  const expandedTargets = new Set(targetSubBatches);
                  targetSubBatches.forEach(tok => {
                    const mp = tok.match(/^([A-Z]+)P(\d+)$/);
                    if (mp) {
                      expandedTargets.add(`${mp[1]}${mp[2]}`);
                    } else {
                      const m = tok.match(/^([A-Z]+)(\d+)$/);
                      if (m && !m[1].endsWith('P')) {
                        expandedTargets.add(`${m[1]}P${m[2]}`);
                      }
                    }
                  });

                  const matches = allBatches.some(b => {
                    const subBatches = b.split(/[\s,\/]+/).map(x => x.trim().toUpperCase()).filter(Boolean);
                    return subBatches.some(tok => expandedTargets.has(tok));
                  });
                  if (!matches) return;
                }
              }

              const slotInfo = getPeriodInfo(s.slot);
              if (!slotInfo) return;

              const subjInfo = getSubjectDetails(s.subject, s.subject_name, isVac);
              const leaveRecord = isTeacherOnLeave(t);

              rawList.push({
                slot: s.slot,
                periodNum: slotInfo.num,
                subject: subjInfo.code,
                subjectName: subjInfo.fullName,
                type: s.type || 'Lecture',
                batch: s.batch || (s.type === 'Lecture' ? 'Whole Section' : ''),
                rawBatch: s.raw_batch || (s.type === 'Lecture' ? 'Whole Section' : ''),
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
                const pInfo = getPeriodInfo(slotStr);
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
        const mappedSubj = (SRCC_SUBJECT_MAP[session.subject] || SRCC_SUBJECT_MAP[(session.subject || '').toUpperCase()] || '').toLowerCase();
        const type = (session.type || '').toLowerCase();
        const batch = (session.batch || '').toLowerCase();
        const rawBatch = (session.rawBatch || '').toLowerCase();
        const teacher = (session.teacher || '').toLowerCase();
        const room = (session.room || '').toLowerCase();
        const sem = (session.sem || '').toLowerCase();
        const dayVal = (session.day || ttState.day || '').toLowerCase();
        const course = (session.course || '').toLowerCase();
        const sec = (session.section || '').toLowerCase();
        const secVacTerms = `${session.isSec ? 'sec skill enhancement' : ''} ${session.isVac ? 'vac value addition' : ''}`;
        const combined = `${subjCode} ${subjName} ${mappedSubj} ${type} ${batch} ${rawBatch} ${teacher} ${room} ${sem} ${dayVal} ${course} ${sec} ${secVacTerms}`.toLowerCase();
        const combinedNorm = combined.replace(/[\s\-_]+/g, '');

        if (combined.includes(q) || combinedNorm.includes(qNorm)) return true;

        // If query is pure digits (e.g., "12"), check if batch number ends with or equals 12
        if (/^\d+$/.test(q)) {
          const batchDigits = (batch + ' ' + rawBatch).replace(/\D+/g, '');
          if (batchDigits === q || (batch + ' ' + rawBatch).includes(q)) return true;
        }

        // Multi-word matching: all words in query must match
        const words = q.split(/\s+/).filter(Boolean);
        if (words.length > 1 && words.every(w => combined.includes(w) || combinedNorm.includes(w.replace(/[\s\-_]+/g, '')))) {
          return true;
        }

        // Teacher phonetic search
        if (typeof normalizeFacultySearchText === 'function') {
          const normQ = normalizeFacultySearchText(q);
          if (normQ && normalizeFacultySearchText(session.teacher).includes(normQ)) return true;
        }

        return false;
      }

      function renderSessionCard(session, isCrossDay = false) {
        const displayBatch = session.batch || session.rawBatch;
        let batchBadge = '';
        if (displayBatch) {
          const bTrimmed = String(displayBatch).trim();
          if (bTrimmed.toLowerCase() === 'whole section') {
            batchBadge = ' · Whole Section';
          } else if (/^(sec|vac)/i.test(bTrimmed)) {
            batchBadge = ` · ${escapeHtml(bTrimmed)}`;
          } else {
            const cleanBatch = bTrimmed.replace(/^Batch\s+/i, '');
            batchBadge = ` · Batch ${escapeHtml(cleanBatch)}`;
          }
        }

        const secVacBadge = session.isSec 
          ? `<span class="tt-secvac-badge">SEC</span>` 
          : (session.isVac ? `<span class="tt-secvac-badge" style="background: rgba(16, 185, 129, 0.12); color: #059669; border-color: rgba(16, 185, 129, 0.28);">VAC</span>` : '');

        const leaveHtml = session.isOnLeave 
          ? `<div class="tt-leave-badge"><span class="tt-leave-dot"></span>Faculty on Leave</div>` 
          : '';

        const targetRoom = getTargetRoomJumpCode(session.room);
        const displayRoom = getDisplayRoomName(session.room);
        const isRoomTba = !session.room || session.room.toUpperCase() === 'TBA' || session.room_tba || session.room === 'TBD';
        const roomButtonHtml = !isRoomTba 
          ? `<button type="button" class="room-badge-link tt-room-btn btn-jump-room" data-room="${escapeHtml(targetRoom)}" title="Click to view room in campus room finder">🏛️ ${escapeHtml(displayRoom)} <span class="tt-room-arrow">↗</span></button>` 
          : `<span class="room-pill-tba" title="Room not specified in official college timetable">🏛️ Room TBA</span>`;

        const leaveCardCls = session.isOnLeave ? ' is-faculty-leave' : '';
        const displaySubject = session.subjectName || session.subject || 'Subject';
        const showCodeBadge = Boolean(session.subject && session.subject.toLowerCase() !== displaySubject.toLowerCase());

        let courseMetaText = ttState.course;
        let secMetaText = ttState.sec;
        if (session.isSec || session.isVac) {
          courseMetaText = session.isSec ? 'SEC' : 'VAC';
          secMetaText = '';
        }

        const periodBadgeText = (session.periodsCount > 1)
          ? `🕒 Period ${session.startPeriod}–${session.endPeriod} · ${session.startTime} – ${session.endTime}`
          : `🕒 Period ${session.startPeriod} · ${session.startTime} – ${session.endTime}`;

        const dayTagHtml = isCrossDay ? `<span class="tt-day-tag">📅 ${escapeHtml(session.day)}</span>` : '';
        const studentTeacher = getCleanStudentFacultyName(session.teacher, session.teacherId);
        const initials = studentTeacher.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'FC';

        return `
          <article class="tt-card${leaveCardCls}" data-slot="${escapeHtml(session.slot || '')}">
            <div class="tt-card-header">
              <span class="tt-period-badge">${dayTagHtml}${periodBadgeText}</span>
              <div class="tt-card-badges">
                ${secVacBadge}
                <span class="tt-type-pill">${escapeHtml(session.type)}${batchBadge}</span>
              </div>
            </div>
            <div class="tt-card-subject">
              <span>${escapeHtml(displaySubject)}</span>
              ${showCodeBadge ? `<span class="tt-subj-code-pill">${escapeHtml(session.subject)}</span>` : ''}
            </div>
            <div class="tt-card-meta">
              <span>${escapeHtml(courseMetaText)}</span> •
              <span>${escapeHtml(session.sem || ttState.sem)}</span>${(secMetaText && secMetaText.toLowerCase() !== 'joint') ? ` • <span>${escapeHtml(secMetaText)}</span>` : ''}
            </div>
            <div class="tt-card-faculty">
              <div class="tt-faculty-info btn-view-teacher-today" data-teacher-id="${escapeHtml(session.teacherId || '')}" data-teacher-name="${escapeHtml(studentTeacher)}" role="button" tabindex="0" title="Click to view full timetable for ${escapeHtml(studentTeacher)}">
                <div class="tt-faculty-avatar">${initials}</div>
                <div class="tt-faculty-name-wrap">
                  <span class="tt-faculty-name">${escapeHtml(studentTeacher)}</span>
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
          } else if (teachersData && Array.isArray(teachersData.teachers)) {
            // Global cross-course, cross-section & SEC/VAC search fallback
            const globalRawMatches = [];
            const activeLeaves = (leavesData && Array.isArray(leavesData.leaves)) ? leavesData.leaves : (window.SRCC_FACULTY_LEAVES?.leaves || []);

            teachersData.teachers.forEach(t => {
              const tName = t.clean_name || t.label || 'Faculty';
              if (!t.schedule) return;

              allDays.forEach(dayName => {
                const daySched = t.schedule[dayName];
                if (!Array.isArray(daySched)) return;

                daySched.forEach(s => {
                  const slotInfo = getPeriodInfo(s.slot);
                  if (!slotInfo) return;

                  const isSec = isSecSlot(s);
                  const isVac = isVacSlot(s);
                  const subjInfo = getSubjectDetails(s.subject, s.subject_name, isVac);
                  const leaveRecord = isTeacherOnLeave(t);

                  const candidateSession = {
                    slot: s.slot,
                    periodNum: slotInfo.num,
                    subject: subjInfo.code,
                    subjectName: subjInfo.fullName,
                    type: s.type || 'Lecture',
                    batch: s.batch || (s.type === 'Lecture' ? 'Whole Section' : ''),
                    rawBatch: s.raw_batch || (s.type === 'Lecture' ? 'Whole Section' : ''),
                    teacher: tName,
                    teacherId: t.id,
                    room: s.room || '',
                    isOnLeave: Boolean(leaveRecord),
                    isSec: isSec,
                    isVac: isVac,
                    sem: s.semester || '',
                    course: s.course || '',
                    section: s.section || '',
                    day: dayName
                  };

                  if (matchesSessionSearch(candidateSession, filterQuery)) {
                    globalRawMatches.push(candidateSession);
                  }
                });
              });
            });

            if (globalRawMatches.length > 0) {
              const mergedGlobal = mergeConsecutiveSessions(globalRawMatches);
              matchCount = mergedGlobal.length;
              cardsHtml = `
                <div class="tt-search-other-days-banner" style="grid-column: 1 / -1;">
                  <div class="tt-srb-left">
                    <span style="font-size: 1.3rem;">🔍</span>
                    <div class="tt-srb-text">
                      Found <strong>${mergedGlobal.length}</strong> matching classes across SRCC Timetable for "<strong>${escapeHtml(filterQuery)}</strong>"
                    </div>
                  </div>
                </div>
              ` + mergedGlobal.map(s => renderSessionCard(s, true)).join('');
            }
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
            if (ttState.course === 'GBO') {
              ttMainEmptyState.innerHTML = `
                <div class="empty-icon">🏢</div>
                <h3 style="margin-bottom: 6px;">GBO Schedule for ${escapeHtml(ttState.day)}</h3>
                <p style="color: var(--text-muted); max-width: 520px; margin: 0 auto 16px; line-height: 1.5;">
                  On the official SRCC Timetable portal, <strong>GBO (Global Business Operations)</strong> sessions are published on <strong>Wednesday &amp; Friday (4:00 PM – 6:00 PM in Room R14)</strong>. Additional GBO guest lectures/seminars are coordinated directly by the GBO department office.
                </p>
                <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
                  <button class="btn-reset-filters btn-switch-day-quick" data-day="Wednesday">📅 View Wednesday (4–6 PM)</button>
                  <button class="btn-reset-filters btn-switch-day-quick" data-day="Friday">📅 View Friday (4–6 PM)</button>
                </div>
              `;
              ttMainEmptyState.querySelectorAll('.btn-switch-day-quick').forEach(b => {
                b.addEventListener('click', () => {
                  ttState.day = b.dataset.day;
                  renderMainTimetableView();
                });
              });
            } else if (ttState.course === 'M.Com') {
              const mcomActiveDays = (ttState.sem === 'Sem I')
                ? ['Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
                : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
              const activeDaysBtns = mcomActiveDays.map(d => `<button class="btn-reset-filters btn-switch-day-quick" data-day="${d}">View ${d}</button>`).join(' ');
              ttMainEmptyState.innerHTML = `
                <div class="empty-icon">🎓</div>
                <h3 style="margin-bottom: 6px;">No M.Com classes on ${escapeHtml(ttState.day)}</h3>
                <p style="color: var(--text-muted); max-width: 520px; margin: 0 auto 16px; line-height: 1.5;">
                  According to the official SRCC Timetable, <strong>M.Com (${escapeHtml(ttState.sem)})</strong> has lectures &amp; tutorials scheduled on <strong>${mcomActiveDays.join(', ')}</strong>. No lectures are scheduled on ${escapeHtml(ttState.day)}.
                </p>
                <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
                  ${activeDaysBtns}
                </div>
              `;
              ttMainEmptyState.querySelectorAll('.btn-switch-day-quick').forEach(b => {
                b.addEventListener('click', () => {
                  ttState.day = b.dataset.day;
                  renderMainTimetableView();
                });
              });
            } else if (isSecVacMode) {
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

        // Update Class Notification card description with current selected course/sem/sec
        if (typeof updateClassNotifUi === 'function') {
          updateClassNotifUi();
        }

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
      // 🔔 INTERACTIVE STUDENT CLASS & TIMETABLE NOTIFICATION CONTROLLER
      // ========================================================================
      const btnToggleClassAlerts = document.getElementById('btnToggleClassAlerts');
      const ttNotifStatusBadge = document.getElementById('ttNotifStatusBadge');
      const ttToggleLabel = document.getElementById('ttToggleLabel');
      const ttNotifDescText = document.getElementById('ttNotifDescText');
      const notifCourseSelect = document.getElementById('notifCourseSelect');
      const notifSemSelect = document.getElementById('notifSemSelect');
      const notifSecSelect = document.getElementById('notifSecSelect');
      const notifBatchSelect = document.getElementById('notifBatchSelect');
      const notifStudentLeadTimeSelect = document.getElementById('notifStudentLeadTimeSelect');
      const btnSaveClassAlerts = document.getElementById('btnSaveClassAlerts');

      const classNotifModal = document.getElementById('classNotifModal');
      const btnClassNotifModalClose = document.getElementById('btnClassNotifModalClose');
      const btnOpenClassAlertsHeader = document.getElementById('btnOpenClassAlertsHeader');
      const drawerNavClassNotif = document.getElementById('drawerNavClassNotif');
      const drawerClassNotifBadge = document.getElementById('drawerClassNotifBadge');

      function openClassNotifModal() {
        if (classNotifModal) {
          openAppModal(classNotifModal);
        }
      }

      function closeClassNotifModal(options = {}) {
        if (classNotifModal) {
          closeAppModal(classNotifModal, options);
        }
      }

      if (btnOpenClassAlertsHeader) {
        btnOpenClassAlertsHeader.addEventListener('click', () => {
          openClassNotifModal();
        });
      }

      if (drawerNavClassNotif) {
        drawerNavClassNotif.addEventListener('click', () => {
          if (typeof window._closeCampusDrawer === 'function') {
            window._closeCampusDrawer({ noHistory: true });
          }
          const drawerOverlay = document.getElementById('campusDrawerOverlay');
          if (drawerOverlay) {
            drawerOverlay.classList.remove('open');
            drawerOverlay.style.display = 'none';
          }
          openClassNotifModal();
        });
      }

      if (btnClassNotifModalClose) {
        btnClassNotifModalClose.addEventListener('click', () => closeClassNotifModal());
      }

      if (classNotifModal) {
        classNotifModal.addEventListener('click', (e) => {
          if (e.target === classNotifModal) closeClassNotifModal();
        });
      }

      const roleBtnStudent = document.getElementById('btnRoleStudent');
      const roleBtnFaculty = document.getElementById('btnRoleFaculty');
      const notifStudentFields = document.getElementById('notifStudentFields');
      const notifFacultyFields = document.getElementById('notifFacultyFields');
      const notifTeacherSelect = document.getElementById('notifTeacherSelect');
      const notifLeadTimeSelect = document.getElementById('notifLeadTimeSelect');
      const btnSaveAlertsText = document.getElementById('btnSaveAlertsText');

      let currentNotifRole = localStorage.getItem('srcc_notif_role') || 'student';

      function setNotifRole(role) {
        currentNotifRole = role;
        if (roleBtnStudent) {
          roleBtnStudent.classList.toggle('active', role === 'student');
        }
        if (roleBtnFaculty) {
          roleBtnFaculty.classList.toggle('active', role === 'faculty');
        }
        if (notifStudentFields) {
          notifStudentFields.style.display = (role === 'student') ? 'flex' : 'none';
        }
        if (notifFacultyFields) {
          notifFacultyFields.style.display = (role === 'faculty') ? 'flex' : 'none';
        }
        if (btnSaveAlertsText) {
          btnSaveAlertsText.textContent = (role === 'faculty')
            ? 'Save Faculty Alerts'
            : 'Save Class Timetable';
        }
      }

      function populateTeacherSelect(selectedId) {
        if (!notifTeacherSelect || !teachersData || !Array.isArray(teachersData.teachers)) return;
        notifTeacherSelect.innerHTML = '<option value="">-- Choose Professor / Faculty --</option>';
        const sorted = [...teachersData.teachers].sort((a, b) => (a.clean_name || '').localeCompare(b.clean_name || ''));
        sorted.forEach(t => {
          const opt = document.createElement('option');
          opt.value = t.id;
          opt.textContent = `${t.clean_name} (${t.department || 'Faculty'}${t.short_code ? ` - ${t.short_code}` : ''})`;
          if (selectedId && String(t.id) === String(selectedId)) opt.selected = true;
          notifTeacherSelect.appendChild(opt);
        });
      }

      if (roleBtnStudent) {
        roleBtnStudent.addEventListener('click', () => setNotifRole('student'));
      }
      if (roleBtnFaculty) {
        roleBtnFaculty.addEventListener('click', () => {
          setNotifRole('faculty');
          populateTeacherSelect(localStorage.getItem('srcc_my_teacher_id') || '');
        });
      }

      function populateNotifBatches(preferredBatch) {
        if (!notifBatchSelect) return;
        notifBatchSelect.innerHTML = '';
        const c = notifCourseSelect ? notifCourseSelect.value : 'B.Com (Hons)';
        const s = notifSecSelect ? notifSecSelect.value : 'Sec A';
        const savedBatch = preferredBatch || localStorage.getItem('srcc_my_tt_batch') || 'ALL';

        const letterMatch = s.match(/Sec\s*([A-Za-z])/i) || s.match(/([A-Za-z])/i);
        const secLetter = letterMatch ? letterMatch[1].toUpperCase() : '';

        if (secLetter) {
          // Combined Tutorial & Practical Batches as user requested: J1/JP1, J2/JP2, J3/JP3
          const combinedBatches = [
            { val: `${secLetter}1 / ${secLetter}P1`, label: `${secLetter}1 / ${secLetter}P1 (Tutorial 1 & Practical 1)` },
            { val: `${secLetter}2 / ${secLetter}P2`, label: `${secLetter}2 / ${secLetter}P2 (Tutorial 2 & Practical 2)` },
            { val: `${secLetter}3 / ${secLetter}P3`, label: `${secLetter}3 / ${secLetter}P3 (Tutorial 3 & Practical 3)` }
          ];
          combinedBatches.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.val;
            opt.textContent = b.label;
            notifBatchSelect.appendChild(opt);
          });

          // Individual Tutorial Batches
          for (let i = 1; i <= 3; i++) {
            const opt = document.createElement('option');
            opt.value = `${secLetter}${i}`;
            opt.textContent = `${secLetter}${i} (Tutorial Batch ${i} only)`;
            notifBatchSelect.appendChild(opt);
          }

          // Individual Practical Batches
          for (let i = 1; i <= 3; i++) {
            const opt = document.createElement('option');
            opt.value = `${secLetter}P${i}`;
            opt.textContent = `${secLetter}P${i} (Practical / Lab ${i} only)`;
            notifBatchSelect.appendChild(opt);
          }

          // All Batches option at bottom
          const optAll = document.createElement('option');
          optAll.value = 'ALL';
          optAll.textContent = 'All Batches (Full Section + All Tutorials & Labs)';
          notifBatchSelect.appendChild(optAll);
        } else {
          // General / GBO / PG Batches
          ['Group 1 / Lab 1', 'Group 2 / Lab 2', 'Group 3 / Lab 3'].forEach((g, idx) => {
            const opt = document.createElement('option');
            opt.value = `G${idx + 1}`;
            opt.textContent = g;
            notifBatchSelect.appendChild(opt);
          });
          const optAll = document.createElement('option');
          optAll.value = 'ALL';
          optAll.textContent = 'All Batches';
          notifBatchSelect.appendChild(optAll);
        }

        // Restore saved preference or default to Batch 1
        const defaultBatch1 = secLetter ? `${secLetter}1 / ${secLetter}P1` : (notifBatchSelect.options[0]?.value || 'ALL');
        if (savedBatch && Array.from(notifBatchSelect.options).some(o => o.value === savedBatch)) {
          notifBatchSelect.value = savedBatch;
        } else {
          notifBatchSelect.value = defaultBatch1;
        }
      }

      function populateNotifSections(preferredSec, preferredBatch) {
        if (!notifSecSelect) return;
        notifSecSelect.innerHTML = '';
        const c = notifCourseSelect ? notifCourseSelect.value : 'B.Com (Hons)';
        const s = notifSemSelect ? notifSemSelect.value : 'Sem I';
        const secMap = courseMap[c]?.[s] || {};
        const secs = Object.keys(secMap).sort();

        if (secs.length === 0) {
          const opt = document.createElement('option');
          opt.value = 'Sec A';
          opt.textContent = 'Sec A';
          notifSecSelect.appendChild(opt);
        } else {
          secs.forEach(secName => {
            const opt = document.createElement('option');
            opt.value = secName;
            opt.textContent = secName;
            if (preferredSec && secName === preferredSec) {
              opt.selected = true;
            }
            notifSecSelect.appendChild(opt);
          });
        }

        populateNotifBatches(preferredBatch);
      }

      if (notifSecSelect) {
        notifSecSelect.addEventListener('change', () => {
          populateNotifBatches();
        });
      }

      function updateClassNotifUi() {
        const isEnabled = localStorage.getItem('srcc_class_alerts_enabled') !== 'false';
        const role = localStorage.getItem('srcc_notif_role') || 'student';
        const curCourse = localStorage.getItem('srcc_my_tt_course') || 'B.Com (Hons)';
        const curSem = localStorage.getItem('srcc_my_tt_sem') || 'Sem I';
        const curSec = localStorage.getItem('srcc_my_tt_sec') || 'Sec A';
        const curBatch = localStorage.getItem('srcc_my_tt_batch') || 'ALL';
        const curLeadMins = localStorage.getItem('srcc_notif_student_lead_mins') || '10';
        const savedTeacherName = localStorage.getItem('srcc_my_teacher_name') || '';

        const batchBadgeSuffix = (curBatch && curBatch !== 'ALL') ? ` · ${curBatch}` : '';

        if (btnToggleClassAlerts) {
          btnToggleClassAlerts.setAttribute('aria-checked', String(isEnabled));
          btnToggleClassAlerts.classList.toggle('off', !isEnabled);
        }
        if (ttToggleLabel) {
          ttToggleLabel.textContent = isEnabled ? 'Alerts ON' : 'Alerts OFF';
        }
        if (ttNotifStatusBadge) {
          if (!isEnabled) {
            ttNotifStatusBadge.textContent = 'Disabled';
            ttNotifStatusBadge.classList.add('tt-notif-badge-disabled');
          } else if (role === 'faculty') {
            ttNotifStatusBadge.textContent = `Active: Prof. ${savedTeacherName || 'Faculty'}`;
            ttNotifStatusBadge.classList.remove('tt-notif-badge-disabled');
          } else {
            ttNotifStatusBadge.textContent = `Active: ${curCourse} · ${curSem} · ${curSec}${batchBadgeSuffix}`;
            ttNotifStatusBadge.classList.remove('tt-notif-badge-disabled');
          }
        }
        if (drawerClassNotifBadge) {
          if (!isEnabled) {
            drawerClassNotifBadge.textContent = 'Disabled';
            drawerClassNotifBadge.style.background = '#64748b';
          } else if (role === 'faculty') {
            const shortProf = savedTeacherName ? (savedTeacherName.split(' ')[0] || 'Faculty') : 'Faculty';
            drawerClassNotifBadge.textContent = `Active: Prof. ${shortProf}`;
            drawerClassNotifBadge.style.background = '#2563eb';
          } else {
            drawerClassNotifBadge.textContent = `Active: ${curSec}${batchBadgeSuffix}`;
            drawerClassNotifBadge.style.background = '#2563eb';
          }
        }
        if (ttNotifDescText) {
          if (!isEnabled) {
            ttNotifDescText.innerHTML = `Class reminders are currently paused. Tap <strong>Alerts ON</strong> to re-enable lecture and leave notifications.`;
          } else if (role === 'faculty') {
            const lead = localStorage.getItem('srcc_notif_lead_mins') || '15';
            ttNotifDescText.innerHTML = `Automatic device notifications <strong>${lead} min before</strong> every lecture for <strong>Prof. ${escapeHtml(savedTeacherName || 'Faculty')}</strong> with Room No., Course, Semester & Section.`;
          } else {
            ttNotifDescText.innerHTML = `Automatic device notifications <strong>${curLeadMins} min before</strong> every class for <strong>${escapeHtml(curCourse)} · ${escapeHtml(curSem)} · ${escapeHtml(curSec)}${escapeHtml(batchBadgeSuffix)}</strong> with Room No. and instant teacher leave alerts.`;
          }
        }
      }

      // Initialize dropdown selections and roles
      setNotifRole(currentNotifRole);
      populateTeacherSelect(localStorage.getItem('srcc_my_teacher_id') || '');
      if (notifLeadTimeSelect) {
        notifLeadTimeSelect.value = localStorage.getItem('srcc_notif_lead_mins') || '15';
      }
      if (notifStudentLeadTimeSelect) {
        notifStudentLeadTimeSelect.value = localStorage.getItem('srcc_notif_student_lead_mins') || '10';
      }

      const initialSavedCourse = localStorage.getItem('srcc_my_tt_course') || 'B.Com (Hons)';
      const initialSavedSem = localStorage.getItem('srcc_my_tt_sem') || 'Sem I';
      const initialSavedSec = localStorage.getItem('srcc_my_tt_sec') || 'Sec A';
      const initialSavedBatch = localStorage.getItem('srcc_my_tt_batch') || 'ALL';

      if (notifCourseSelect) notifCourseSelect.value = initialSavedCourse;
      if (notifSemSelect) notifSemSelect.value = initialSavedSem;
      populateNotifSections(initialSavedSec, initialSavedBatch);

      if (notifCourseSelect) {
        notifCourseSelect.addEventListener('change', () => populateNotifSections());
      }
      if (notifSemSelect) {
        notifSemSelect.addEventListener('change', () => populateNotifSections());
      }

      // Save Class / Faculty Button
      if (btnSaveClassAlerts) {
        btnSaveClassAlerts.addEventListener('click', async () => {
          localStorage.setItem('srcc_notif_role', currentNotifRole);
          localStorage.setItem('srcc_class_alerts_enabled', 'true');

          let perm = ('Notification' in window) ? Notification.permission : 'denied';
          if ('Notification' in window && perm !== 'granted') {
            try { perm = await Notification.requestPermission(); } catch (e) {}
          }

          if (currentNotifRole === 'faculty') {
            const teacherId = notifTeacherSelect ? notifTeacherSelect.value : '';
            if (!teacherId) {
              showToast('⚠️ Please select your faculty name first');
              return;
            }
            const teacherObj = (teachersData && teachersData.teachers)
              ? teachersData.teachers.find(t => String(t.id) === String(teacherId))
              : null;
            const tName = teacherObj ? teacherObj.clean_name : (notifTeacherSelect.options[notifTeacherSelect.selectedIndex]?.text || 'Faculty');
            const leadMins = notifLeadTimeSelect ? (notifLeadTimeSelect.value || '15') : '15';

            localStorage.setItem('srcc_my_teacher_id', teacherId);
            localStorage.setItem('srcc_my_teacher_name', tName);
            localStorage.setItem('srcc_notif_lead_mins', leadMins);

            // Cache preference for Service Worker
            if ('caches' in window) {
              try {
                const cache = await caches.open('srcc-classroom-v96');
                await cache.put('/__srcc_user_class_pref', new Response(JSON.stringify({
                  role: 'faculty',
                  teacherId: teacherId,
                  teacherName: tName,
                  leadMins: parseInt(leadMins, 10),
                  enabled: true
                })));
              } catch (e) {}
            }

            // Broadcast to Service Worker
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
              navigator.serviceWorker.controller.postMessage({
                type: 'UPDATE_CLASS_PREF',
                role: 'faculty',
                teacherId: teacherId,
                teacherName: tName,
                leadMins: parseInt(leadMins, 10),
                enabled: true
              });
            }

            updateClassNotifUi();

            if (perm === 'granted') {
              triggerDeviceNotification('🔔 Faculty Lecture Alerts Active', {
                body: `Active for Prof. ${tName}. You will receive reminders ${leadMins} min before each lecture with Room No., Course, Semester & Section!`,
                tag: 'srcc-faculty-alert-confirmed'
              });
            }

            checkAndNotifyStudentTimetableAndDeadlines();
            showToast(`✅ Faculty Alerts Active for Prof. ${tName}`, true, 2500);
            setTimeout(() => { closeClassNotifModal(); }, 600);
            return;
          }

          // Student role saving
          const selCourse = notifCourseSelect ? notifCourseSelect.value : 'B.Com (Hons)';
          const selSem = notifSemSelect ? notifSemSelect.value : 'Sem I';
          const selSec = notifSecSelect ? notifSecSelect.value : 'Sec A';
          const selBatch = notifBatchSelect ? notifBatchSelect.value : 'ALL';
          const selLeadMins = notifStudentLeadTimeSelect ? (notifStudentLeadTimeSelect.value || '10') : '10';

          localStorage.setItem('srcc_my_tt_course', selCourse);
          localStorage.setItem('srcc_my_tt_sem', selSem);
          localStorage.setItem('srcc_my_tt_sec', selSec);
          localStorage.setItem('srcc_my_tt_batch', selBatch);
          localStorage.setItem('srcc_notif_student_lead_mins', selLeadMins);

          try {
            saveMyBatchPref({
              course: selCourse,
              sem: selSem,
              sec: selSec,
              batch: selBatch
            });
            if (typeof renderMyBatchDailyWidget === 'function') {
              renderMyBatchDailyWidget();
            }
          } catch (e) {}

          if ('caches' in window) {
            try {
              const cache = await caches.open('srcc-classroom-v96');
              await cache.put('/__srcc_user_class_pref', new Response(JSON.stringify({
                role: 'student',
                course: selCourse,
                sem: selSem,
                sec: selSec,
                batch: selBatch,
                leadMins: parseInt(selLeadMins, 10),
                enabled: true
              })));
            } catch (e) {}
          }

          if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({
              type: 'UPDATE_CLASS_PREF',
              role: 'student',
              course: selCourse,
              sem: selSem,
              sec: selSec,
              batch: selBatch,
              leadMins: parseInt(selLeadMins, 10),
              enabled: true
            });
          }

          updateClassNotifUi();

          if (perm === 'granted') {
            const batchLabel = (selBatch && selBatch !== 'ALL') ? ` (${selBatch})` : '';
            triggerDeviceNotification('🔔 Class & Leave Alerts Active', {
              body: `Active for ${selCourse} · ${selSem} · ${selSec}${batchLabel}. Reminders ${selLeadMins} min before class with Room No. and instant teacher leave alerts!`,
              tag: 'srcc-class-alert-confirmed'
            });
          }

          checkAndNotifyStudentTimetableAndDeadlines();
          showToast('✅ Saved & Notifications Activated', true, 2500);
          setTimeout(() => { closeClassNotifModal(); }, 600);
        });
      }

      // Toggle ON/OFF Switch
      if (btnToggleClassAlerts) {
        btnToggleClassAlerts.addEventListener('click', async () => {
          const currentlyEnabled = localStorage.getItem('srcc_class_alerts_enabled') !== 'false';
          const nextState = !currentlyEnabled;
          localStorage.setItem('srcc_class_alerts_enabled', String(nextState));

          if (nextState) {
            if ('Notification' in window && Notification.permission !== 'granted') {
              try { await Notification.requestPermission(); } catch (e) {}
            }
            updateClassNotifUi();
            showToast('✅ Alerts ON', true, 2000);
          } else {
            updateClassNotifUi();
            showToast('🔕 Alerts OFF', false, 2000);
          }
        });
      }

      updateClassNotifUi();

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
                <div class="batch-teacher-leave-alert">
                  <span class="batch-leave-dot"></span>
                  <span>Faculty on leave today · Class may be suspended</span>
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
                <div class="batch-teacher-leave-alert">
                  <span class="batch-leave-dot"></span>
                  <span>Faculty on leave today · Class may be suspended</span>
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
      renderMainTimetableView();
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

      const istNow = getIstDate();
      const currentDayOfWeek = istNow.getDay(); // 0 is Sunday
      const currentHour = istNow.getHours();

      // 🛑 SUNDAY DAYTIME LEAVE NOTIFICATION SUPPRESSION:
      // Faculty leave notifications run Monday to Saturday during college hours.
      // On Sunday daytime, notifications are completely suppressed because college is closed.
      // Only on Sunday night between 10:00 PM (22:00) and 11:59 PM IST can an upcoming Monday leave preview be sent.
      if (currentDayOfWeek === 0 && !isTest) {
        if (currentHour < 22) {
          return; // Strictly no leave notifications on Sunday before 10 PM
        }
      }

      const count = (activeLeaves && activeLeaves.length) || 0;
      let title = 'SRCC Live Campus Update 🔔';
      let bodyText = '';

      if (currentDayOfWeek === 0 && currentHour >= 22) {
        title = 'SRCC Monday Campus Preview 🔔';
        if (count === 1) {
          bodyText = `Prof. ${activeLeaves[0].teacher_name} is scheduled on leave for tomorrow (Monday).\n⚡ Regular classes resume Monday morning at 8:30 AM.`;
        } else if (count > 1) {
          const topNames = activeLeaves.slice(0, 3).map(l => l.teacher_name).join(', ');
          bodyText = `${count} faculty scheduled on leave for tomorrow (Monday: ${topNames}${count > 3 ? '...' : ''}).\n⚡ Regular classes resume Monday morning at 8:30 AM.`;
        } else {
          bodyText = `All faculty scheduled present for tomorrow (Monday).\n⚡ Regular classes resume Monday morning at 8:30 AM.`;
        }
      } else {
        if (count === 1) {
          bodyText = `Prof. ${activeLeaves[0].teacher_name} is marked on leave today.\n${freeRoomsText}`;
        } else if (count > 1) {
          const topNames = activeLeaves.slice(0, 3).map(l => l.teacher_name).join(', ');
          bodyText = `${count} professors on leave today (${topNames}${count > 3 ? '...' : ''}).\n${freeRoomsText}`;
        } else {
          bodyText = `All professors present today.\n${freeRoomsText}`;
        }
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
        triggerDeviceNotification(title, {
          body: bodyText,
          tag: 'srcc-campus-hourly-update'
        });
      }

      // 2. In-app Toast Banner for live changes
      if (isLiveUpdate) {
        const leaveMsg = count > 0 
          ? `${count} ${count === 1 ? 'professor is' : 'professors are'} on leave today.`
          : 'All professors present today.';
        showToast(`🔔 <strong>Faculty Leave Update:</strong> ${leaveMsg} <button onclick="openFacultyLeavesView()" style="margin-left:8px; padding:3px 8px; border-radius:4px; border:none; background:#070D18; color:#fff; cursor:pointer; font-size:0.75rem;">View</button>`, true, 5000);
      }
    }

    // ========================================================================
    // ☁️ LIVE CLOUD LEAVES SYNC (Runs on load, every 45s, and on device wakeup)
    // ========================================================================
    async function syncLeavesFromCloud(isWakeupTrigger = false) {
      let cloudUrl = (window.SRCC_CLOUD_CONFIG && window.SRCC_CLOUD_CONFIG.db_url) || localStorage.getItem('srcc_cloud_db_url') || 'https://srcc-leaves-default-rtdb.firebaseio.com/leaves.json';
      if (!cloudUrl) return;

      try {
        let data = null;
        try {
          const res = await fetch(cloudUrl, { cache: 'no-cache' });
          if (res.ok) {
            data = await res.json();
          }
        } catch (err) {}

        // Fallback to auto-synced static json if Cloud DB is unreachable or 401
        if (!data || (!data.leaves && !Array.isArray(data))) {
          try {
            const localRes = await fetch('./faculty_leaves.json?t=' + Date.now(), { cache: 'no-cache' });
            if (localRes.ok) {
              data = await localRes.json();
            }
          } catch (e) {}
        }

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
      } finally {
        // Evaluate student timetable class reminder and notice deadlines
        checkAndNotifyStudentTimetableAndDeadlines();
      }
    }

    // ========================================================================
    // 🎓 STUDENT TIMETABLE CLASS & COLLEGE NOTICE DEADLINE NOTIFICATIONS
    // - Class reminders 10 minutes before class according to student's timetable
    // - Alerts with exact Room Number and professor
    // - Instant alert if scheduled professor is on leave today (Class Cancelled/Free)
    // - Daily morning timetable summary notification
    // - College notices alerts & 1-day-left deadline warnings
    // ========================================================================
    function checkAndNotifyStudentTimetableAndDeadlines() {
      try {
        const istNow = getIstDate();
        const yyyy = istNow.getFullYear();
        const mm = String(istNow.getMonth() + 1).padStart(2, '0');
        const dd = String(istNow.getDate()).padStart(2, '0');
        const todayIso = `${yyyy}-${mm}-${dd}`;
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const todayName = dayNames[istNow.getDay()];
        const nowMinutes = istNow.getHours() * 60 + istNow.getMinutes();

        const alertsEnabled = localStorage.getItem('srcc_class_alerts_enabled') !== 'false';

        // -------------------------------------------------------------
        // 1. Timetable Class Reminders (10-15 Min Before) & Leave Alerts
        // Supports both Students (by Section) & Faculty / Teachers (by Name)
        // -------------------------------------------------------------
        if (alertsEnabled && todayName !== 'Sunday') {
          const role = localStorage.getItem('srcc_notif_role') || 'student';

          // ===========================================================
          // ROLE: FACULTY / TEACHER LECTURE ALERTS (10-15 Min Before)
          // ===========================================================
          if (role === 'faculty') {
            const savedTeacherId = localStorage.getItem('srcc_my_teacher_id') || '';
            const leadMins = parseInt(localStorage.getItem('srcc_notif_lead_mins') || '15', 10);
            const teacherObj = (teachersData && teachersData.teachers)
              ? teachersData.teachers.find(t => String(t.id) === String(savedTeacherId))
              : null;

            if (teacherObj) {
              // 1. Alert if teacher is marked on leave today
              const isLeave = Boolean(isTeacherOnLeave(teacherObj));
              if (isLeave) {
                const leaveKey = `srcc_alert_faculty_leave_${todayIso}_${savedTeacherId}`;
                if (!localStorage.getItem(leaveKey)) {
                  localStorage.setItem(leaveKey, '1');
                  triggerDeviceNotification(`🏖️ Portal Status: On Leave Today`, {
                    body: `Prof. ${teacherObj.clean_name}, you are currently recorded on leave today on the portal. Scheduled lecture rooms are unlocked for students.`,
                    tag: 'srcc-faculty-leave-status'
                  });
                }
              }

              // 2. Class Reminders 10-15 Min Before Each Scheduled Lecture
              const daySched = (teacherObj.schedule && teacherObj.schedule[todayName]) || [];
              daySched.forEach(cls => {
                let startMins = -1;
                if (cls.slot) {
                  const firstPart = cls.slot.split(/to|–|-/i)[0];
                  startMins = parseTimeToMinutes(firstPart);
                }
                if (startMins !== -1) {
                  const diff = startMins - nowMinutes;
                  if (diff >= 0 && diff <= leadMins) {
                    const roomStr = cls.room || 'Room TBD';
                    const subName = cls.subject || 'Lecture';
                    const secStr = [cls.course, cls.semester, cls.section, cls.batch].filter(Boolean).join(' ');
                    const notifKey = `srcc_alert_prof_${todayIso}_${cls.slot}_${roomStr}_${subName}`;

                    if (!localStorage.getItem(notifKey)) {
                      localStorage.setItem(notifKey, '1');
                      const minText = diff === 0 ? 'starting right now' : `starting in ${diff} min`;
                      triggerDeviceNotification(`📚 Lecture ${minText}: Room ${roomStr}`, {
                        body: `${subName} with ${secStr}. Slot: ${cls.slot}. Room: ${roomStr}. Tap for full daily schedule!`,
                        tag: `srcc-prof-lecture-${cls.slot}`
                      });
                    }
                  }
                }
              });
            }
          } else {
            // ===========================================================
            // ROLE: STUDENT TIMETABLE CLASS & LEAVE ALERTS
            // ===========================================================
            const myCourse = localStorage.getItem('srcc_my_tt_course') || 'B.Com (Hons)';
            const mySem = localStorage.getItem('srcc_my_tt_sem') || 'Sem I';
            const mySec = localStorage.getItem('srcc_my_tt_sec') || 'Sec A';
            const myBatch = localStorage.getItem('srcc_my_tt_batch') || 'ALL';
            const studentLeadMins = parseInt(localStorage.getItem('srcc_notif_student_lead_mins') || '10', 10);

            // Get student's verified classes today using getClassesForParameters filtered by batch
            const todayClasses = (typeof getClassesForParameters === 'function')
              ? getClassesForParameters(todayName, mySem, myCourse, myBatch, mySec)
              : [];
            const mergedClasses = (typeof mergeConsecutiveSessions === 'function')
              ? mergeConsecutiveSessions(todayClasses)
              : todayClasses;

            // Build quick lookup for faculty leaves active today
            const todayLeaves = (typeof getActiveTodayLeaves === 'function') ? getActiveTodayLeaves() : [];
            const leaveProfMap = {};
            todayLeaves.forEach(l => {
              if (l.teacher_id) leaveProfMap[String(l.teacher_id)] = l;
              if (l.teacher_name) leaveProfMap[l.teacher_name.trim().toLowerCase()] = l;
            });

            function checkTeacherLeave(cls) {
              if (cls.teacherId && leaveProfMap[String(cls.teacherId)]) return leaveProfMap[String(cls.teacherId)];
              if (cls.teacher && leaveProfMap[cls.teacher.trim().toLowerCase()]) return leaveProfMap[cls.teacher.trim().toLowerCase()];
              return null;
            }

            // A. TEACHER ON LEAVE ALERT (Alert for any faculty of this section/batch on leave today)
            mergedClasses.forEach(cls => {
              const leave = checkTeacherLeave(cls);
              if (leave) {
                const tId = cls.teacherId || cls.teacher || 'faculty';
                const leaveNotifKey = `srcc_alert_leave_today_${todayIso}_${tId}_${cls.subject}`;
                if (!localStorage.getItem(leaveNotifKey)) {
                  localStorage.setItem(leaveNotifKey, '1');
                  const tName = cls.teacher || 'Faculty';
                  const sub = cls.subject || 'Class';
                  const slot = cls.slot || `${cls.startTime || ''} to ${cls.endTime || ''}`.trim();
                  triggerDeviceNotification(`⚠️ Teacher on Leave Today: Prof. ${tName}`, {
                    body: `Prof. ${tName} is marked on leave today. Your ${sub} lecture (${slot}) in Room ${cls.room} is free for self-study / GD!`,
                    tag: `srcc-class-leave-${tId}`
                  });
                }
              }
            });

            // B. PRIOR CLASS ALERT (Window: 0 to (studentLeadMins + 2) minutes before lecture start)
            mergedClasses.forEach(cls => {
              const startMins = parseTimeToMinutes(cls.startTime);
              if (startMins !== -1) {
                const diff = startMins - nowMinutes;
                if (diff >= 0 && diff <= (studentLeadMins + 2)) {
                  const subName = cls.subject || 'Class';
                  const roomNo = cls.room || 'Room';
                  const tName = cls.teacher || 'Faculty';
                  const notifKey = `srcc_alert_${studentLeadMins}m_${todayIso}_${cls.startTime}_${subName}`;

                  if (!localStorage.getItem(notifKey)) {
                    localStorage.setItem(notifKey, '1');
                    const leave = checkTeacherLeave(cls);
                    if (leave) {
                      triggerDeviceNotification(`🚨 Class Free / Teacher on Leave: ${subName}`, {
                        body: `Prof. ${tName} is on leave today. Your ${subName} (${cls.slot || cls.startTime}) is free. Room ${roomNo} is vacant for GD!`,
                        tag: `srcc-class-leave-${cls.startTime}`
                      });
                    } else {
                      const minText = diff === 0 ? 'starting right now' : `starting in ${diff} min`;
                      triggerDeviceNotification(`📚 Class ${minText}: ${subName}`, {
                        body: `Room ${roomNo} · Prof. ${tName} (${cls.slot || cls.startTime}). Tap to view full timetable!`,
                        tag: `srcc-class-${studentLeadMins}m-${cls.startTime}`
                      });
                    }
                  }
                }
              }
            });
          }
        }

        // -------------------------------------------------------------
        // 2. College Notices Deadlines (Approaching Deadlines) & New Notice Alerts
        // -------------------------------------------------------------
        const notices = (window.COLLEGE_NOTICES && Array.isArray(window.COLLEGE_NOTICES))
          ? window.COLLEGE_NOTICES
          : ((window.SRCC_NOTICES_DATA && Array.isArray(window.SRCC_NOTICES_DATA.notices))
            ? window.SRCC_NOTICES_DATA.notices
            : ((window.SRCC_OFFICIAL_NOTICES && Array.isArray(window.SRCC_OFFICIAL_NOTICES)) ? window.SRCC_OFFICIAL_NOTICES : []));

        if (notices.length > 0) {
          notices.forEach(n => {
            if (n.has_deadline && n.deadline) {
              const dlMatch = n.deadline.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
              if (dlMatch) {
                const dlDay = parseInt(dlMatch[1], 10);
                const dlMonthStr = dlMatch[2];
                const dlYear = parseInt(dlMatch[3], 10);
                const monthMap = { 'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'May': 4, 'Jun': 5, 'Jul': 6, 'Aug': 7, 'Sep': 8, 'Oct': 9, 'Nov': 10, 'Dec': 11 };
                const dlMonth = monthMap[dlMonthStr.slice(0, 3)] ?? -1;
                if (dlMonth >= 0) {
                  const dlDate = new Date(dlYear, dlMonth, dlDay);
                  const todayMidnight = new Date(istNow.getFullYear(), istNow.getMonth(), istNow.getDate());
                  const diffDays = Math.round((dlDate - todayMidnight) / (1000 * 60 * 60 * 24));

                  if (diffDays === 1) {
                    const dlKey = `srcc_notif_dl_1day_${n.id}`;
                    if (!localStorage.getItem(dlKey)) {
                      localStorage.setItem(dlKey, '1');
                      triggerDeviceNotification(`⏰ 1 Day Left! Notice Deadline`, {
                        body: `Reminder: 1 Day Left for ${n.title} (${n.deadline_label || 'Deadline'}: ${n.deadline}). Tap to view notice.`,
                        tag: `srcc-deadline-1day-${n.id}`,
                        data: { url: n.link }
                      });
                    }
                  } else if (diffDays === 0) {
                    const dlKey0 = `srcc_notif_dl_today_${n.id}`;
                    if (!localStorage.getItem(dlKey0)) {
                      localStorage.setItem(dlKey0, '1');
                      triggerDeviceNotification(`⏰ Final Day Deadline: ${n.title}`, {
                        body: `Today is the final date (${n.deadline}). Ensure timely submission!`,
                        tag: `srcc-deadline-today-${n.id}`,
                        data: { url: n.link }
                      });
                    }
                  } else if (diffDays === 2) {
                    const dlKey2 = `srcc_notif_dl_2days_${n.id}`;
                    if (!localStorage.getItem(dlKey2)) {
                      localStorage.setItem(dlKey2, '1');
                      triggerDeviceNotification(`⏳ 2 Days Left! Notice Deadline`, {
                        body: `Reminder: 2 Days Left for ${n.title} (${n.deadline_label || 'Deadline'}: ${n.deadline}). Tap to view notice.`,
                        tag: `srcc-deadline-2days-${n.id}`,
                        data: { url: n.link }
                      });
                    }
                  }
                }
              }
            }
          });

          // Check newest notice
          const latestNotice = notices[0];
          if (latestNotice) {
            const lastSeenNoticeId = localStorage.getItem('srcc_last_seen_notice_id');
            if (lastSeenNoticeId && lastSeenNoticeId !== latestNotice.id) {
              const noticeAlertKey = `srcc_alert_notice_${latestNotice.id}`;
              if (!localStorage.getItem(noticeAlertKey)) {
                localStorage.setItem(noticeAlertKey, '1');
                triggerDeviceNotification(`📢 New College Notice: ${latestNotice.title}`, {
                  body: `Official circular published on srcc.edu. Tap to view document.`,
                  tag: `srcc-new-notice-${latestNotice.id}`,
                  data: { url: latestNotice.link }
                });
                showToast(`📢 <strong>New Notice:</strong> ${latestNotice.title}`, true, 6000);
              }
            }
            localStorage.setItem('srcc_last_seen_notice_id', latestNotice.id);
          }
        }
      } catch (err) {
        console.warn('[Alerts Dispatcher Note]', err);
      }
    }

    // Run active background ticker every 30 seconds for 10-min class alerts & deadlines
    setInterval(checkAndNotifyStudentTimetableAndDeadlines, 30000);

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
        checkAndNotifyStudentTimetableAndDeadlines();
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
          showToast('⚠️ Notifications are not supported in this browser.', false, 3500);
          return;
        }

        try {
          const perm = await Notification.requestPermission();
          if (perm === 'granted') {
            localStorage.setItem('srcc_leave_notif_enabled', 'true');
            showToast('🔔 <strong>Campus Alerts Enabled</strong> You will receive real-time updates for schedule and classroom vacancies.', true, 4000);

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
            showToast('ℹ️ Notification permission was not enabled. You can enable anytime via browser settings.', false, 3500);
          }
        } catch (e) {
          console.warn('Permission request error:', e);
        }
      }

      // 1. Notification Opt-in Prompt Banner (Reliably shows for users who have not subscribed)
      function evaluateBannerDisplay() {
        const isNotifGranted = ('Notification' in window && Notification.permission === 'granted');
        if (isNotifGranted) {
          if (banner) banner.style.display = 'none';
          window._isNotifBannerActive = false;
          registerDeviceWebPushSubscription();
          const todayActive = getActiveTodayLeaves();
          notifyFacultyLeaves(todayActive, false);
        } else {
          // If not subscribed/granted, display banner to ensure student/teacher sees subscription prompt
          if (banner) {
            banner.style.display = 'block';
            window._isNotifBannerActive = true;
          }
        }
      }
      setTimeout(evaluateBannerDisplay, 400);

      if (btnAllow) {
        btnAllow.addEventListener('click', async () => {
          if (banner) banner.style.display = 'none';
          window._isNotifBannerActive = false;
          await requestLeavePermission();
          if (typeof updateClassNotifUi === 'function') updateClassNotifUi();
          if (typeof window._triggerDeferredPwaPrompt === 'function') {
            window._triggerDeferredPwaPrompt(6000);
          }
        });
      }

      if (btnDismiss) {
        btnDismiss.addEventListener('click', () => {
          if (banner) banner.style.display = 'none';
          window._isNotifBannerActive = false;
          sessionStorage.setItem('srcc_notif_session_dismissed', String(Date.now()));
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
    // 🔗 URL DEEP-LINKING & HASH NAVIGATION HANDLER
    // Supports: ?room=R2, #room=R2, #R2, ?faculty=Name, #faculty=..., ?tab=..., #timetable, #wifi
    // ========================================================================
    function handleUrlDeepLinks(options = {}) {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        const hash = window.location.hash || '';

        // 1. Room deep link: ?room=R2, ?r=R2, #room=R2, #room-R2, #R2
        let roomParam = searchParams.get('room') || searchParams.get('r');
        if (!roomParam && hash) {
          const matchHash = hash.match(/(?:room[=-]?|#)([a-zA-Z0-9]+)/i);
          if (matchHash && matchHash[1]) {
            const candidate = matchHash[1].toUpperCase();
            if (appData && appData.rooms && appData.rooms.some(r => {
              const c = r.code.toUpperCase();
              return c === candidate || c === `R${candidate}` || candidate === `R${c}`;
            })) {
              roomParam = candidate;
            }
          }
        }

        if (roomParam) {
          const rawCode = roomParam.trim().toUpperCase();
          const found = appData?.rooms?.find(r => {
            const c = r.code.toUpperCase();
            return c === rawCode || c === `R${rawCode}` || rawCode === `R${c}`;
          });
          if (found) {
            setAppMode('rooms', true, { isInitial: options.isInitial });
            state.activeCategory = 'ALL';
            state.searchQuery = found.code;
            if (searchInput) searchInput.value = found.code;
            if (btnClearSearch) btnClearSearch.style.display = 'block';
            render();
            setTimeout(() => {
              openScheduleModal(found.code);
              showToast(`📍 Loaded Room ${found.code} Schedule`);
            }, 300);
            return;
          }
        }

        // 2. Faculty deep link: ?faculty=Name, ?teacher=Code, #faculty=..., #teacher=...
        let facultyParam = searchParams.get('faculty') || searchParams.get('teacher');
        if (!facultyParam && hash) {
          const matchFac = hash.match(/(?:faculty|teacher)[=-]?([^&]+)/i);
          if (matchFac && matchFac[1]) facultyParam = decodeURIComponent(matchFac[1]);
        }

        if (facultyParam) {
          const rawQuery = facultyParam.trim();
          const query = rawQuery.toLowerCase();

          // Direct Faculty List tab link (?faculty=all or ?faculty=list)
          if (query === 'all' || query === 'list') {
            setAppMode('faculty', true, { isInitial: options.isInitial });
            renderFaculty();
            return;
          }

          const allTeachers = (window.SRCC_TEACHERS_DATA && window.SRCC_TEACHERS_DATA.teachers) || (teachersData && teachersData.teachers) || [];
          if (allTeachers.length > 0) {
            const cleanQuery = query.replace(/^(?:prof\.?|dr\.?|mr\.?|ms\.?|mrs\.?)\s+/i, '').trim();
            const matchedTeacher = allTeachers.find(t => {
              const tId = (t.id || '').toLowerCase();
              const tCode = (t.short_code || '').toLowerCase();
              const tClean = (t.clean_name || '').toLowerCase();
              const tRaw = (t.name || '').toLowerCase();
              const strippedName = tClean.replace(/^(?:prof\.?|dr\.?|mr\.?|ms\.?|mrs\.?)\s+/i, '').trim();

              return tId === query ||
                     tCode === query ||
                     tClean === query ||
                     tClean === cleanQuery ||
                     strippedName === cleanQuery ||
                     tClean.includes(cleanQuery) ||
                     tRaw.includes(cleanQuery) ||
                     (cleanQuery.length >= 3 && strippedName.includes(cleanQuery));
            });

            if (matchedTeacher) {
              setAppMode('faculty', true, { isInitial: options.isInitial });
              if (facultySearchInput) facultySearchInput.value = matchedTeacher.clean_name;
              renderFaculty();
              setTimeout(() => {
                openTeacherModal(matchedTeacher.id);
                showToast(`👨‍🏫 Loaded Faculty Profile for Prof. ${matchedTeacher.clean_name}`);
              }, 250);
              return;
            } else {
              setAppMode('faculty', true, { isInitial: options.isInitial });
              if (facultySearchInput) facultySearchInput.value = rawQuery;
              facultyState.searchQuery = rawQuery;
              renderFaculty();
              return;
            }
          }
        }

        // 3. Tab deep link: ?tab=timetable | ?tab=notices | ?tab=wifi | ?tab=rooms | ?tab=faculty or #timetable etc.
        const tabParam = searchParams.get('tab') || '';
        if (tabParam === 'timetable' || hash.includes('#timetable')) {
          setAppMode('timetable', false, { isInitial: options.isInitial });
        } else if (tabParam === 'notices' || hash.includes('#notices')) {
          setAppMode('notices', false, { isInitial: options.isInitial });
        } else if (tabParam === 'wifi' || hash.includes('#wifi')) {
          setAppMode('wifi', false, { isInitial: options.isInitial });
        } else if (tabParam === 'faculty' || hash.includes('#faculty')) {
          setAppMode('faculty', false, { isInitial: options.isInitial });
        } else if (searchParams.get('free') === '1' || searchParams.get('freenow') === '1' || hash.includes('#freenow')) {
          setAppMode('rooms', true, { isInitial: options.isInitial });
          setFreeNowState(true);
        } else if (tabParam === 'rooms' || hash.includes('#rooms') || (!hash && !roomParam && !facultyParam)) {
          setAppMode('rooms', true, { isInitial: options.isInitial, replace: true });
        }
      } catch (e) {
        console.warn('URL deep link handler note:', e);
      }
    }

    // ========================================================================
    // 📱 MOBILE SYSTEM BACK BUTTON & HISTORY POPSTATE HANDLER
    // Ensures mobile gesture / hardware back button navigates to previous tab
    // or closes open modal/drawer instead of exiting the entire website!
    // ========================================================================
    function handlePopState(e) {
      _lastPopStateTime = Date.now();

      // 0. If Campus Drawer is open in DOM, close it cleanly on mobile back button
      const drawerOverlay = document.getElementById('campusDrawerOverlay');
      if (drawerOverlay && (drawerOverlay.classList.contains('open') || drawerOverlay.style.display === 'flex')) {
        if (typeof closeCampusDrawer === 'function') {
          closeCampusDrawer({ fromPopState: true });
        } else if (typeof window._closeCampusDrawer === 'function') {
          window._closeCampusDrawer({ fromPopState: true });
        }
        _modalHistoryDepth = Math.max(0, _modalHistoryDepth - 1);
        return;
      }

      const openModal = getCurrentlyOpenModal();
      const stateObj = e && e.state;

      // 1. If any modal is currently open in DOM:
      if (openModal) {
        if (!stateObj || stateObj.type !== 'modal' || stateObj.modalId !== openModal.id) {
          closeAppModal(openModal, { fromPopState: true });
          _modalHistoryDepth = Math.max(0, _modalHistoryDepth - 1);

          // If the state we popped to is another modal (e.g. going back from teacher modal to room modal)
          if (stateObj && stateObj.type === 'modal' && stateObj.modalId) {
            if (stateObj.modalId === 'scheduleModal' && stateObj.roomCode) {
              openScheduleModal(stateObj.roomCode);
            } else if (stateObj.modalId === 'teacherModal' && stateObj.teacherId) {
              openTeacherModal(stateObj.teacherId);
            } else {
              const targetModal = document.getElementById(stateObj.modalId);
              if (targetModal) openAppModal(targetModal, { fromPopState: true });
            }
            return;
          }

          if (stateObj && stateObj.mode && stateObj.mode !== state.activeMode) {
            setAppMode(stateObj.mode, true, { isBackNav: true });
          }
          return;
        }
      }

      // 2. Tab Navigation from state object
      if (stateObj && stateObj.mode) {
        if (stateObj.mode !== state.activeMode) {
          setAppMode(stateObj.mode, true, { isBackNav: true });
        }
        return;
      }

      // 3. Fallback based on URL hash
      const rawHash = (window.location.hash || '').toLowerCase();
      if (rawHash.includes('#menu') || rawHash.includes('#drawer')) {
        // Drawer is opening or opened - do not reset to rooms
        return;
      }
      if (rawHash.includes('#faculty')) {
        if (state.activeMode !== 'faculty') setAppMode('faculty', true, { isBackNav: true });
      } else if (rawHash.includes('#timetable')) {
        if (state.activeMode !== 'timetable') setAppMode('timetable', true, { isBackNav: true });
      } else if (rawHash.includes('#notices')) {
        if (state.activeMode !== 'notices') setAppMode('notices', true, { isBackNav: true });
      } else if (rawHash.includes('#exam_codes') || rawHash.includes('#examcodes') || rawHash.includes('#upc')) {
        if (state.activeMode !== 'exam_codes') setAppMode('exam_codes', true, { isBackNav: true });
      } else if (rawHash.includes('#wifi')) {
        // WiFi option temporarily hidden pending administrative permission
        if (state.activeMode !== 'rooms') setAppMode('rooms', true, { isBackNav: true });
      } else if (rawHash === '' || rawHash === '#' || rawHash.includes('#rooms')) {
        if (state.activeMode !== 'rooms') setAppMode('rooms', true, { isBackNav: true });
      } else {
        handleUrlDeepLinks({ fromPopState: true });
      }
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
              <div style="margin-bottom: 8px; display: flex; justify-content: center;">
                <svg class="wifi-svg-icon" style="width: 42px; height: 42px; color: var(--text-secondary); opacity: 0.6;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M5 12.55a11 11 0 0 1 14.08 0"></path>
                  <path d="M1.42 9a16 16 0 0 1 21.16 0"></path>
                  <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
                  <circle cx="12" cy="20" r="1.3" fill="currentColor"></circle>
                </svg>
              </div>
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
                <span class="wifi-ssid-title"><svg class="wifi-svg-icon" style="width: 16px; height: 16px; vertical-align: -2px; margin-right: 4px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.55a11 11 0 0 1 14.08 0"></path><path d="M1.42 9a16 16 0 0 1 21.16 0"></path><path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path><circle cx="12" cy="20" r="1.3" fill="currentColor"></circle></svg>${escapeHtml(w.ssid)}</span>
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
                <button type="button" class="btn-copy-wifi-pwd" data-pwd="${escapeHtml(w.password)}" title="Copy network password">
                  📋 Copy
                </button>
                <button type="button" class="btn-qr-wifi" data-target="qr-${escapeHtml(w.id || w.ssid)}">
                  📷 Scan QR
                </button>
                <button type="button" class="btn-share-wifi" data-ssid="${escapeHtml(w.ssid)}" data-pwd="${escapeHtml(w.password)}" data-loc="${escapeHtml(w.location || w.wing || 'SRCC Campus')}" data-qr="${qrUrl}" title="Share WiFi credentials & QR code">
                  📤 Share
                </button>
              </div>
              <div class="wifi-qr-popup" id="qr-${escapeHtml(w.id || w.ssid)}" style="display: none;">
                <img data-src="${qrUrl}" alt="WiFi QR for ${escapeHtml(w.ssid)}" />
                <p style="font-size: 0.75rem; color: #475569; margin: 6px 0 0; font-weight: 600;">Point phone camera or scanner to connect directly</p>
                <div style="display: flex; gap: 8px; justify-content: center; margin-top: 8px; flex-wrap: wrap;">
                  <button type="button" class="btn-share-qr-action" data-ssid="${escapeHtml(w.ssid)}" data-pwd="${escapeHtml(w.password)}" data-loc="${escapeHtml(w.location || w.wing || 'SRCC Campus')}" data-qr="${qrUrl}" style="background: #0891b2; color: #ffffff; border: none; padding: 6px 12px; border-radius: 6px; font-size: 0.76rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 5px;">
                    📤 Share QR
                  </button>
                  <a href="${qrUrl}" download="SRCC_WiFi_${escapeHtml(w.ssid)}_QR.png" target="_blank" rel="noopener" class="btn-download-qr-action" style="background: #e2e8f0; color: #1e293b; border: 1px solid #cbd5e1; padding: 6px 12px; border-radius: 6px; font-size: 0.76rem; font-weight: 600; text-decoration: none; display: inline-flex; align-items: center; gap: 5px;">
                    💾 Download QR
                  </a>
                </div>
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
              const img = qrEl.querySelector('img[data-src]');
              if (img && !img.src && !isOpen) {
                img.src = img.dataset.src;
              }
            }
          });
        });

        // Wire WiFi QR Share actions
        const handleShareWifi = async (btn) => {
          const ssid = btn.dataset.ssid;
          const pwd = btn.dataset.pwd;
          const loc = btn.dataset.loc || 'SRCC Campus';
          const qrUrl = btn.dataset.qr;
          const shareMsg = `📶 *SRCC Campus WiFi Network: ${ssid}*\n🔑 Password: ${pwd}\n📍 Location: ${loc}\n\n🔗 Connect Link & Portal:\n${qrUrl || 'https://anand-srcc.github.io/srcc-free-classrooms/'}`;

          if (navigator.share) {
            try {
              let files = [];
              try {
                const resp = await fetch(qrUrl);
                const blob = await resp.blob();
                files = [new File([blob], `SRCC_${ssid}_WiFi_QR.png`, { type: blob.type })];
              } catch (e) {}

              if (files.length > 0 && navigator.canShare && navigator.canShare({ files })) {
                await navigator.share({
                  title: `SRCC WiFi - ${ssid}`,
                  text: `Connect to SRCC WiFi (${ssid}) - Password: ${pwd}`,
                  files: files
                });
                showToast(`✅ Shared WiFi QR for ${ssid}!`);
                return;
              } else {
                await navigator.share({
                  title: `SRCC WiFi - ${ssid}`,
                  text: shareMsg
                });
                showToast(`✅ Shared WiFi details for ${ssid}!`);
                return;
              }
            } catch (err) {
              if (err.name === 'AbortError') return;
            }
          }

          copyToClipboard(shareMsg).then(() => {
            showToast(`📋 Copied WiFi details & QR link for <strong>${ssid}</strong>!`);
          });
        };

        grid.querySelectorAll('.btn-share-wifi, .btn-share-qr-action').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            handleShareWifi(btn);
          });
        });
      };

      // Coordinated WiFi Modal Open / Close Handlers
      function openWifiModal(options = {}) {
        if (typeof window._closeAllPopups === 'function') {
          window._closeAllPopups({ noHistory: true });
        }
        if (!wifiModal) return;
        openAppModal(wifiModal, options);
        window._renderWifiDirectory('wifiModalGrid', '', currentModalBand);
        const bnavWifi = document.getElementById('bnavWifi');
        const bnavRooms = document.getElementById('bnavRooms');
        const bnavFaculty = document.getElementById('bnavFaculty');
        const bnavTimetable = document.getElementById('bnavTimetable');
        const bnavFreeNow = document.getElementById('bnavFreeNow');
        if (bnavRooms) bnavRooms.classList.remove('active');
        if (bnavFaculty) bnavFaculty.classList.remove('active');
        if (bnavTimetable) bnavTimetable.classList.remove('active');
        if (bnavFreeNow) bnavFreeNow.classList.remove('active');
        if (bnavWifi) bnavWifi.classList.add('active');
      }
      window._openWifiModal = openWifiModal;

      function closeWifiModal(options = {}) {
        if (!wifiModal) return;
        closeAppModal(wifiModal, options);
        if (typeof window._updateBottomNavActiveState === 'function') {
          window._updateBottomNavActiveState();
        }
      }
      window._closeWifiModal = closeWifiModal;

      // Header button
      if (btnOpenHeader && wifiModal) {
        btnOpenHeader.addEventListener('click', (e) => {
          e.preventDefault();
          if (wifiModal.style.display === 'flex') {
            closeWifiModal();
          } else {
            openWifiModal();
          }
        });
      }

      if (btnCloseModal && wifiModal) {
        btnCloseModal.addEventListener('click', () => {
          closeWifiModal();
        });
      }

      if (wifiModal) {
        wifiModal.addEventListener('click', (e) => {
          if (e.target === wifiModal) {
            closeWifiModal();
          }
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
    // 📢 OFFICIAL COLLEGE NOTICES & CIRCULARS FEATURE
    // ========================================================================
    function initCollegeNoticesFeature() {
      const searchInput = document.getElementById('noticesSearchInput');
      const btnClearSearch = document.getElementById('btnClearNoticesSearch');
      const categoryPills = document.querySelectorAll('#noticesCategoryPills .notices-pill-btn');
      const noticesGrid = document.getElementById('noticesGrid');
      const noticesTotalPill = document.getElementById('noticesTotalPill');
      const btnNoticesBack = document.getElementById('btnNoticesBack');
      const btnNoticesViewGrid = document.getElementById('btnNoticesViewGrid');
      const btnNoticesViewCompact = document.getElementById('btnNoticesViewCompact');

      let currentCat = 'ALL';
      let currentQuery = '';
      let noticesViewMode = localStorage.getItem('srcc_notices_view_mode') || 'grid';

      if (btnNoticesViewGrid && btnNoticesViewCompact) {
        btnNoticesViewGrid.addEventListener('click', () => {
          noticesViewMode = 'grid';
          localStorage.setItem('srcc_notices_view_mode', 'grid');
          btnNoticesViewGrid.classList.add('active');
          btnNoticesViewCompact.classList.remove('active');
          if (noticesGrid) noticesGrid.classList.remove('view-mode-compact');
        });
        btnNoticesViewCompact.addEventListener('click', () => {
          noticesViewMode = 'compact';
          localStorage.setItem('srcc_notices_view_mode', 'compact');
          btnNoticesViewCompact.classList.add('active');
          btnNoticesViewGrid.classList.remove('active');
          if (noticesGrid) noticesGrid.classList.add('view-mode-compact');
        });
      }

      function getAllCollegeNotices() {
        let official = [];
        if (window.COLLEGE_NOTICES && Array.isArray(window.COLLEGE_NOTICES)) {
          official = window.COLLEGE_NOTICES;
        } else if (window.SRCC_NOTICES_DATA && Array.isArray(window.SRCC_NOTICES_DATA.notices)) {
          official = window.SRCC_NOTICES_DATA.notices;
        } else if (window.SRCC_OFFICIAL_NOTICES && Array.isArray(window.SRCC_OFFICIAL_NOTICES)) {
          official = window.SRCC_OFFICIAL_NOTICES;
        }
        const adminNotices = (window.SRCC_CAMPUS_NOTICES && Array.isArray(window.SRCC_CAMPUS_NOTICES)) ? window.SRCC_CAMPUS_NOTICES : [];

        const formattedAdmin = adminNotices.map((an, i) => ({
          id: an.id || `admin-notice-${i}`,
          title: an.title || 'Campus Announcement',
          category: an.category === 'urgent' ? 'administration' : (an.category || 'administration'),
          link: (an.attachment && an.attachment.dataUrl) ? an.attachment.dataUrl : 'https://www.srcc.edu/announcements',
          link_type: (an.attachment && an.attachment.type) ? an.attachment.type : 'link',
          date: an.created_at ? an.created_at.slice(0, 10) : 'Active',
          deadline: an.deadline || null,
          deadline_label: an.deadline_label || null,
          has_deadline: Boolean(an.deadline),
          source: 'SRCC Admin Announcement'
        }));

        return [...formattedAdmin, ...official];
      }

      function updateCategoryCounts(allNotices) {
        const MONTH_MAP = {
          'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
          'jul': 6, 'aug': 7, 'sep': 8, 'sept': 8, 'oct': 9, 'nov': 10, 'dec': 11
        };

        function parseNoticeDate(str) {
          if (!str) return 0;
          const m = str.match(/(\d{1,2})[\s\-\.\/]+([A-Za-z]+)[\s\-\.\/]+(\d{4})/);
          if (m) {
            const day = parseInt(m[1], 10);
            const mon = MONTH_MAP[m[2].toLowerCase().slice(0, 3)] ?? 0;
            const yr = parseInt(m[3], 10);
            return new Date(yr, mon, day).getTime();
          }
          const m2 = str.match(/([A-Za-z]+)[\s\-\.\/]+(\d{1,2})[\s\-\.\/,]+(\d{4})/);
          if (m2) {
            const mon = MONTH_MAP[m2[1].toLowerCase().slice(0, 3)] ?? 0;
            const day = parseInt(m2[2], 10);
            const yr = parseInt(m2[3], 10);
            return new Date(yr, mon, day).getTime();
          }
          return 0;
        }

        const nowIst = getIstDate();
        const todayMidnight = new Date(nowIst.getFullYear(), nowIst.getMonth(), nowIst.getDate()).getTime();

        function getDeadlineStatus(deadlineStr) {
          if (!deadlineStr) return { time: 0, isActive: false, daysLeft: -999 };
          const time = parseNoticeDate(deadlineStr);
          if (!time) return { time: 0, isActive: false, daysLeft: -999 };
          const diffDays = Math.ceil((time - todayMidnight) / (24 * 60 * 60 * 1000));
          return { time, isActive: diffDays >= 0, daysLeft: diffDays };
        }

        const counts = { ALL: allNotices.length, DEADLINES: 0, DEADLINES_ACTIVE: 0, academic: 0, examinations: 0, societies: 0, administration: 0 };
        allNotices.forEach(n => {
          if (n.has_deadline || n.deadline) {
            counts.DEADLINES++;
            const dlStat = getDeadlineStatus(n.deadline);
            if (dlStat.isActive) counts.DEADLINES_ACTIVE++;
          }
          if (counts[n.category] !== undefined) counts[n.category]++;
          else counts.administration++;
        });

        const elAll = document.getElementById('countCatAll');
        const elDeadlines = document.getElementById('countCatDeadlines');
        const elAcad = document.getElementById('countCatAcademic');
        const elExam = document.getElementById('countCatExams');
        const elSoc = document.getElementById('countCatSocieties');
        const elAdmin = document.getElementById('countCatAdmin');

        if (elAll) elAll.textContent = counts.ALL;
        if (elDeadlines) elDeadlines.textContent = `${counts.DEADLINES_ACTIVE} Active`;
        if (elAcad) elAcad.textContent = counts.academic;
        if (elExam) elExam.textContent = counts.examinations;
        if (elSoc) elSoc.textContent = counts.societies;
        if (elAdmin) elAdmin.textContent = counts.administration;
        if (noticesTotalPill) noticesTotalPill.textContent = `${counts.ALL} Public Notices`;

        const drawerDeadlinesBadge = document.getElementById('drawerDeadlinesBadge');
        if (drawerDeadlinesBadge) {
          if (counts.DEADLINES_ACTIVE > 0) {
            drawerDeadlinesBadge.textContent = `${counts.DEADLINES_ACTIVE} Active Deadline${counts.DEADLINES_ACTIVE > 1 ? 's' : ''} ⏳`;
            drawerDeadlinesBadge.style.display = 'inline-block';
          } else {
            drawerDeadlinesBadge.style.display = 'none';
          }
        }
        const drawerNoticesBadge = document.getElementById('drawerNoticesBadge');
        if (drawerNoticesBadge) drawerNoticesBadge.textContent = `${counts.ALL} Notices`;
      }

      function renderCollegeNotices() {
        if (!noticesGrid) return;
        const allNotices = getAllCollegeNotices();
        updateCategoryCounts(allNotices);

        const MONTH_MAP = {
          'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
          'jul': 6, 'aug': 7, 'sep': 8, 'sept': 8, 'oct': 9, 'nov': 10, 'dec': 11
        };

        function parseNoticeDate(str) {
          if (!str) return 0;
          const m = str.match(/(\d{1,2})[\s\-\.\/]+([A-Za-z]+)[\s\-\.\/]+(\d{4})/);
          if (m) {
            const day = parseInt(m[1], 10);
            const mon = MONTH_MAP[m[2].toLowerCase().slice(0, 3)] ?? 0;
            const yr = parseInt(m[3], 10);
            return new Date(yr, mon, day).getTime();
          }
          const m2 = str.match(/([A-Za-z]+)[\s\-\.\/]+(\d{1,2})[\s\-\.\/,]+(\d{4})/);
          if (m2) {
            const mon = MONTH_MAP[m2[1].toLowerCase().slice(0, 3)] ?? 0;
            const day = parseInt(m2[2], 10);
            const yr = parseInt(m2[3], 10);
            return new Date(yr, mon, day).getTime();
          }
          return 0;
        }

        const nowIst = getIstDate();
        const todayMidnight = new Date(nowIst.getFullYear(), nowIst.getMonth(), nowIst.getDate()).getTime();

        function getDeadlineStatus(deadlineStr) {
          if (!deadlineStr) return { time: 0, isActive: false, daysLeft: -999 };
          const time = parseNoticeDate(deadlineStr);
          if (!time) return { time: 0, isActive: false, daysLeft: -999 };
          const diffDays = Math.ceil((time - todayMidnight) / (24 * 60 * 60 * 1000));
          return { time, isActive: diffDays >= 0, daysLeft: diffDays };
        }

        const q = (currentQuery || '').toLowerCase().trim();
        const filtered = allNotices.filter(n => {
          if (currentCat === 'DEADLINES') {
            if (!n.has_deadline && !n.deadline) return false;
            const dlStat = getDeadlineStatus(n.deadline);
            if (!dlStat.isActive) return false; // Show only currently ACTIVE deadlines!
          } else if (currentCat !== 'ALL' && n.category !== currentCat) {
            return false;
          }
          if (q) {
            const matchTitle = (n.title || '').toLowerCase().includes(q);
            const matchCat = (n.category || '').toLowerCase().includes(q);
            const matchDate = (n.date || '').toLowerCase().includes(q);
            const matchDeadline = (n.deadline || '').toLowerCase().includes(q) || (n.deadline_label || '').toLowerCase().includes(q);
            if (!matchTitle && !matchCat && !matchDate && !matchDeadline) return false;
          }
          return true;
        });

        // 🎯 USER-SPECIFIED PRECISE SORTING:
        // 1. In 'DEADLINES' tab: Active upcoming deadlines sorted ASCENDING (soonest deadline first!).
        // 2. In ALL other tabs ('ALL', 'academic', 'examinations', 'societies', 'administration'):
        //    Sorted DESCENDING by notice date (most recent / today's latest notice on top!).
        if (currentCat === 'DEADLINES') {
          filtered.sort((a, b) => {
            const statA = getDeadlineStatus(a.deadline);
            const statB = getDeadlineStatus(b.deadline);

            if (statA.isActive && !statB.isActive) return -1;
            if (!statA.isActive && statB.isActive) return 1;

            if (statA.isActive && statB.isActive) {
              return statA.time - statB.time; // Soonest upcoming deadline first
            }

            return statB.time - statA.time; // Most recent past deadline first
          });
        } else {
          filtered.sort((a, b) => {
            const timeA = parseNoticeDate(a.date);
            const timeB = parseNoticeDate(b.date);
            if (timeA !== timeB) return timeB - timeA; // Latest date first
            const idA = parseInt((a.id || '').replace(/\D/g, '') || '0', 10);
            const idB = parseInt((b.id || '').replace(/\D/g, '') || '0', 10);
            return idA - idB;
          });
        }

        if (filtered.length === 0) {
          const isDl = (currentCat === 'DEADLINES');
          noticesGrid.innerHTML = `
            <div class="notices-empty-state">
              <div class="notices-empty-icon">${isDl ? '🎉' : '📭'}</div>
              <h3>${isDl ? 'No Active Deadlines Right Now' : 'No Notices Found'}</h3>
              <p>${isDl ? 'All upcoming application & submission deadlines are completed. Check All Notices for recent circulars.' : `No college notices match "${escapeHtml(q)}". Try clearing your search or switching filters.`}</p>
            </div>
          `;
          return;
        }

        const catBadges = {
          academic: '<span class="notice-cat-badge badge-academic">📚 Academic</span>',
          examinations: '<span class="notice-cat-badge badge-examinations">📝 Examination</span>',
          societies: '<span class="notice-cat-badge badge-societies">🏆 Societies & Events</span>',
          administration: '<span class="notice-cat-badge badge-administration">🏛️ Administration</span>'
        };

        const typeLabels = {
          pdf: '📄 Open Circular (PDF)',
          excel: '📊 Open Spreadsheet (Excel)',
          doc: '📝 Open Document (Word)',
          image: '🖼️ View Poster (Image)',
          form: '📋 Open Registration Form',
          link: '🔗 View Official Notice'
        };

        if (noticesGrid) {
          noticesGrid.classList.toggle('view-mode-compact', noticesViewMode === 'compact');
        }
        if (btnNoticesViewGrid) btnNoticesViewGrid.classList.toggle('active', noticesViewMode === 'grid');
        if (btnNoticesViewCompact) btnNoticesViewCompact.classList.toggle('active', noticesViewMode === 'compact');

        noticesGrid.innerHTML = filtered.map(n => {
          const catHtml = catBadges[n.category] || catBadges.administration;
          const openLabel = typeLabels[n.link_type] || typeLabels.pdf;

          let deadlineHtml = '';
          if (n.has_deadline && n.deadline) {
            const dlStat = getDeadlineStatus(n.deadline);
            if (dlStat.isActive) {
              const daysText = dlStat.daysLeft === 0
                ? '⚡ Last Day Today!'
                : (dlStat.daysLeft === 1 ? '⏰ 1 Day Left!' : `⏳ ${dlStat.daysLeft} Days Left`);
              deadlineHtml = `
                <span class="notice-deadline-tag notice-deadline-active" title="Active Deadline: ${escapeHtml(n.deadline)}">
                  <span class="deadline-pulse-dot"></span>
                  <span class="deadline-title-label">${escapeHtml(n.deadline_label || 'Deadline:')}</span>
                  <span class="deadline-exact-time">${escapeHtml(n.deadline)}</span>
                  <span class="deadline-days-badge active">${daysText}</span>
                </span>
              `;
            } else {
              deadlineHtml = `
                <span class="notice-deadline-tag notice-deadline-past" title="Past Deadline: ${escapeHtml(n.deadline)}">
                  <span class="deadline-past-dot"></span>
                  <span class="deadline-title-label">${escapeHtml(n.deadline_label || 'Deadline:')}</span>
                  <span class="deadline-exact-time">${escapeHtml(n.deadline)}</span>
                  <span class="deadline-days-badge past">Passed</span>
                </span>
              `;
            }
          }

          return `
            <div class="notice-card notice-compact-card" id="card-${escapeHtml(n.id)}">
              <div class="notice-card-header">
                <div class="notice-card-meta-left">
                  <span class="notice-date-badge">${escapeHtml(n.date || '2026')}</span>
                  ${catHtml}
                  ${deadlineHtml}
                </div>
              </div>
              <h3 class="notice-title">${escapeHtml(n.title)}</h3>
              <div class="notice-actions">
                <a href="${escapeHtml(n.link)}" target="_blank" rel="noopener noreferrer" class="notice-pdf-text-link" title="Open verified circular">
                  📄 Circular (PDF) ↗
                </a>
                <button type="button" class="btn-notice-share" data-title="${escapeHtml(n.title)}" data-url="${escapeHtml(n.link)}" data-cat="${escapeHtml(n.category)}" title="Share notice with students">
                  📤 Share
                </button>
              </div>
            </div>
          `;
        }).join('');

        // Wire Share buttons
        noticesGrid.querySelectorAll('.btn-notice-share').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const title = btn.dataset.title;
            const url = btn.dataset.url;
            const shareText = `📢 *SRCC Official Notice:*\n"${title}"\n\n🔗 Official Link:\n${url}\n\nVia SRCC Student Portal`;

            if (navigator.share) {
              try {
                await navigator.share({
                  title: `SRCC Notice: ${title}`,
                  text: shareText,
                  url: url
                });
                showToast(`✅ Notice shared successfully!`);
                return;
              } catch (err) {
                if (err.name === 'AbortError') return;
              }
            }

            if (navigator.clipboard) {
              navigator.clipboard.writeText(shareText).then(() => {
                showToast(`📋 Copied formatted notice details & link!`);
              });
            }
          });
        });
      }

      window._renderCollegeNotices = renderCollegeNotices;

      // Search input handler
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          currentQuery = e.target.value;
          if (btnClearSearch) btnClearSearch.style.display = currentQuery ? 'block' : 'none';
          renderCollegeNotices();
        });
      }

      if (btnClearSearch) {
        btnClearSearch.addEventListener('click', () => {
          if (searchInput) searchInput.value = '';
          currentQuery = '';
          btnClearSearch.style.display = 'none';
          renderCollegeNotices();
        });
      }

      // Category filter pill handlers
      categoryPills.forEach(pill => {
        pill.addEventListener('click', () => {
          categoryPills.forEach(p => {
            p.classList.toggle('active', p === pill);
            p.setAttribute('aria-selected', p === pill ? 'true' : 'false');
          });
          currentCat = pill.dataset.cat || 'ALL';
          renderCollegeNotices();
        });
      });

      // Back button to classrooms
      if (btnNoticesBack) {
        btnNoticesBack.addEventListener('click', (e) => {
          e.preventDefault();
          setAppMode('rooms');
        });
      }

      // Initialize counts immediately so drawer badges are accurate on load
      try {
        updateCategoryCounts(getAllCollegeNotices());
      } catch (e) {}
    }

    // ========================================================================
    // 📝 DU EXAM CODES & COURSE UPC DIRECTORY FEATURE (NEP / UGCF 2022)
    // ========================================================================
    function initExamCodesFeature() {
      const examCodesGrid = document.getElementById('examCodesGrid');
      const searchInput = document.getElementById('examCodesSearchInput');
      const btnClearSearch = document.getElementById('btnClearExamCodesSearch');
      const progPills = document.querySelectorAll('#examCodesProgPills .notices-pill-btn');
      const semFilter = document.getElementById('examCodesSemFilter');
      const catFilter = document.getElementById('examCodesCatFilter');
      const btnResetFilters = document.getElementById('btnResetExamCodesFilters');
      const visibleCountEl = document.getElementById('examCodesVisibleCount');
      const btnExamCodesBack = document.getElementById('btnExamCodesBack');
      const btnExamCodesViewGrid = document.getElementById('btnExamCodesViewGrid');
      const btnExamCodesViewCompact = document.getElementById('btnExamCodesViewCompact');

      let currentProg = 'ALL';
      let currentSem = 'ALL';
      let currentCat = 'ALL';
      let currentQuery = '';
      let examCodesViewMode = localStorage.getItem('srcc_examcodes_view_mode') || 'grid';

      if (btnExamCodesViewGrid && btnExamCodesViewCompact) {
        btnExamCodesViewGrid.addEventListener('click', () => {
          examCodesViewMode = 'grid';
          localStorage.setItem('srcc_examcodes_view_mode', 'grid');
          btnExamCodesViewGrid.classList.add('active');
          btnExamCodesViewCompact.classList.remove('active');
          if (examCodesGrid) examCodesGrid.classList.remove('view-mode-compact');
        });
        btnExamCodesViewCompact.addEventListener('click', () => {
          examCodesViewMode = 'compact';
          localStorage.setItem('srcc_examcodes_view_mode', 'compact');
          btnExamCodesViewCompact.classList.add('active');
          btnExamCodesViewGrid.classList.remove('active');
          if (examCodesGrid) examCodesGrid.classList.add('view-mode-compact');
        });
      }

      function getAllExamCodes() {
        return window.EXAM_CODES_DATA || window.SRCC_EXAM_CODES_DATA || [];
      }

      function matchesSemester(targetSem, itemSemStr) {
        if (!itemSemStr || targetSem === 'ALL') return true;
        if (itemSemStr.includes('All Semesters')) return true;
        const tokens = itemSemStr.split(/[^A-Za-z0-9]+/).map(t => t.trim().toUpperCase()).filter(Boolean);
        return tokens.includes(targetSem.toUpperCase());
      }

      function setExamCodesSemester(sem) {
        currentSem = sem || 'ALL';
        const semPills = document.querySelectorAll('#examCodesSemPills .sem-pill-btn');
        semPills.forEach(p => {
          const isTarget = (p.dataset.sem === currentSem);
          p.classList.toggle('active', isTarget);
          p.setAttribute('aria-selected', isTarget ? 'true' : 'false');
        });
        if (semFilter) semFilter.value = currentSem;
        renderExamCodes();
      }
      window._setExamCodesSemester = setExamCodesSemester;

      function updateProgCounts(all) {
        const cAll = document.getElementById('countProgAll');
        const cSrcc = document.getElementById('countProgSrcc');
        const cBCom = document.getElementById('countProgBCom');
        const cEco = document.getElementById('countProgEco');
        const cSec = document.getElementById('countProgSec');
        const cAec = document.getElementById('countProgAec');
        const cVac = document.getElementById('countProgVac');
        const cGe = document.getElementById('countProgGe');
        const cDsc = document.getElementById('countProgDsc');
        const cDse = document.getElementById('countProgDse');

        if (cAll) cAll.textContent = all.length;
        if (cSrcc) cSrcc.textContent = all.filter(r => r.is_srcc_offered).length;
        if (cBCom) cBCom.textContent = all.filter(r => r.programme === 'B.Com. (Hons.)').length;
        if (cEco) cEco.textContent = all.filter(r => r.programme === 'B.A. (Hons.) Economics').length;
        if (cSec) cSec.textContent = all.filter(r => r.programme === 'SEC').length;
        if (cAec) cAec.textContent = all.filter(r => r.programme === 'AEC').length;
        if (cVac) cVac.textContent = all.filter(r => r.programme === 'VAC').length;
        if (cGe) cGe.textContent = all.filter(r => r.category === 'GE' || r.type === 'GE' || r.programme === 'GE (Elective)').length;
        if (cDsc) cDsc.textContent = all.filter(r => r.category === 'Core' || r.type === 'Core' || (r.course_no && r.course_no.includes('DSC'))).length;
        if (cDse) cDse.textContent = all.filter(r => r.category === 'DSE' || r.type === 'DSE' || (r.course_no && r.course_no.includes('DSE'))).length;

        const totalPill = document.getElementById('examCodesTotalPill');
        if (totalPill) totalPill.textContent = `${all.length} Verified Papers`;
      }

      function renderExamCodes() {
        if (!examCodesGrid) return;
        const all = getAllExamCodes();
        updateProgCounts(all);

        const q = (currentQuery || '').toLowerCase().trim();
        const filtered = all.filter(r => {
          // 1. Programme Filter (including SRCC Offered, DSC Core, and DSE tabs)
          if (currentProg === 'SRCC') {
            if (!r.is_srcc_offered) return false;
          } else if (currentProg === 'DSC') {
            const isDsc = (r.category === 'Core' || r.type === 'Core' || (r.course_no && r.course_no.includes('DSC')));
            if (!isDsc) return false;
          } else if (currentProg === 'DSE') {
            const isDse = (r.category === 'DSE' || r.type === 'DSE' || (r.course_no && r.course_no.includes('DSE')));
            if (!isDse) return false;
          } else if (currentProg === 'GE (Elective)') {
            const isGe = (r.category === 'GE' || r.type === 'GE' || r.programme === 'GE (Elective)');
            if (!isGe) return false;
          } else if (currentProg !== 'ALL' && r.programme !== currentProg) {
            return false;
          }

          // 2. Strict Semester Filter (Tokenized roman numerals - no substring leaks)
          if (currentSem !== 'ALL') {
            if (!matchesSemester(currentSem, r.semester)) {
              return false;
            }
          }

          // 3. Category / Type Filter
          if (currentCat !== 'ALL') {
            const cat = (r.category || '').toUpperCase();
            const targetCat = currentCat.toUpperCase();
            if (targetCat === 'CORE' && !cat.includes('CORE')) return false;
            else if (targetCat === 'DSE' && !cat.includes('DSE')) return false;
            else if (targetCat === 'GE' && !cat.includes('GE')) return false;
            else if (targetCat === 'SEC' && !cat.includes('SEC')) return false;
            else if (targetCat === 'AEC' && !cat.includes('AEC')) return false;
            else if (targetCat === 'VAC' && !cat.includes('VAC')) return false;
            else if (targetCat === 'RESEARCH/TRACK' && !cat.includes('RESEARCH') && !cat.includes('TRACK')) return false;
          }

          // 4. Search Query (Title, UPC, Course No, Department, Category)
          if (q) {
            const isNoCode = (!r.upc || r.upc === 'null' || r.upc === 'undefined' || r.upc.trim() === '');
            const matchNoCode = isNoCode && (q.includes('not available') || q.includes('no code') || q.includes('pending') || q.includes('n/a'));
            const matchTitle = (r.title || '').toLowerCase().includes(q);
            const matchUpc = (r.upc || '').toLowerCase().includes(q);
            const matchCourseNo = (r.course_no || '').toLowerCase().includes(q);
            const matchDept = (r.department || '').toLowerCase().includes(q);
            const matchCat = (r.category || '').toLowerCase().includes(q);
            const matchTheme = (r.theme || '').toLowerCase().includes(q);
            const matchType = (r.type || '').toLowerCase().includes(q);
            const matchProg = (r.programme || '').toLowerCase().includes(q);
            if (!matchNoCode && !matchTitle && !matchUpc && !matchCourseNo && !matchDept && !matchCat && !matchTheme && !matchType && !matchProg) {
              return false;
            }
          }

          return true;
        });

        // Category Priority Sort: DSC (Core) -> SEC -> VAC -> AEC -> GE -> DSE -> Research/Track
        const catOrder = {
          'Core': 1,
          'DSC': 1,
          'SEC': 2,
          'VAC': 3,
          'AEC': 4,
          'GE': 5,
          'DSE': 6,
          'Research/Track': 7
        };

        filtered.sort((a, b) => {
          const aCatRank = catOrder[a.category] || 99;
          const bCatRank = catOrder[b.category] || 99;
          if (aCatRank !== bCatRank) {
            return aCatRank - bCatRank;
          }
          const aSem = a.semester || '';
          const bSem = b.semester || '';
          if (aSem !== bSem && currentSem === 'ALL') {
            return aSem.localeCompare(bSem);
          }
          if (a.course_no && b.course_no) {
            return a.course_no.localeCompare(b.course_no);
          }
          return (a.title || '').localeCompare(b.title || '');
        });

        if (visibleCountEl) {
          visibleCountEl.textContent = filtered.length;
        }

        if (filtered.length === 0) {
          examCodesGrid.innerHTML = `
            <div class="notices-empty-state" style="grid-column: 1 / -1;">
              <div class="notices-empty-icon">🔍</div>
              <h3>No Exam Codes Found</h3>
              <p>No DU papers match your search "${escapeHtml(q)}" or selected filters. Try searching by paper name, UPC code, or click "Reset Filters".</p>
              <button type="button" class="btn-reset-examcodes" style="margin-top: 14px; display: inline-flex;" onclick="document.getElementById('btnResetExamCodesFilters').click()">
                🔄 Clear All Filters
              </button>
            </div>
          `;
          return;
        }

        const progBadges = {
          'B.Com. (Hons.)': '<span class="examcode-prog-badge badge-prog-bcom">B.Com. (Hons.)</span>',
          'B.A. (Hons.) Economics': '<span class="examcode-prog-badge badge-prog-eco">Eco (Hons.)</span>',
          'SEC': '<span class="examcode-prog-badge badge-prog-sec">SEC</span>',
          'AEC': '<span class="examcode-prog-badge badge-prog-aec">AEC</span>',
          'VAC': '<span class="examcode-prog-badge badge-prog-vac">VAC</span>'
        };

        const catPills = {
          'Core': '<span class="examcode-pill pill-core">Core (DSC)</span>',
          'DSE': '<span class="examcode-pill pill-dse">DSE</span>',
          'GE': '<span class="examcode-pill pill-ge">GE</span>',
          'SEC': '<span class="examcode-pill pill-sec">SEC</span>',
          'AEC': '<span class="examcode-pill pill-aec">AEC</span>',
          'VAC': '<span class="examcode-pill pill-vac">VAC</span>',
          'Research/Track': '<span class="examcode-pill pill-research">Track</span>'
        };

        if (examCodesGrid) {
          examCodesGrid.classList.toggle('view-mode-compact', examCodesViewMode === 'compact');
        }
        if (btnExamCodesViewGrid) btnExamCodesViewGrid.classList.toggle('active', examCodesViewMode === 'grid');
        if (btnExamCodesViewCompact) btnExamCodesViewCompact.classList.toggle('active', examCodesViewMode === 'compact');

        // Render Compact, Clean Cards (Cleaned up: No star, no department, no credits, no share button)
        examCodesGrid.innerHTML = filtered.map(r => {
          // Prevent duplicate badges (e.g. [SEC] [SEC] or [VAC] [VAC])
          const isRedundantProg = (
            r.programme === 'SEC' ||
            r.programme === 'VAC' ||
            r.programme === 'AEC' ||
            r.programme === r.category ||
            (r.category === 'SEC' && r.programme === 'SEC') ||
            (r.category === 'VAC' && r.programme === 'VAC')
          );
          const progBadgeHtml = isRedundantProg ? '' : (progBadges[r.programme] || `<span class="examcode-prog-badge badge-prog-bcom">${escapeHtml(r.programme)}</span>`);
          const catPill = catPills[r.category] || `<span class="examcode-pill pill-core">${escapeHtml(r.category || r.type || 'Core')}</span>`;
          const courseNoHtml = r.course_no ? `<span class="examcode-cno-tag">${escapeHtml(r.course_no)}</span>` : '';

          // Clean semester formatting: e.g. "Sem 1–6", "All Sem", or "Sem I" (no redundant "Sem All Semesters (I–VI)")
          let semBadgeText = 'All Sem';
          const rawSem = String(r.semester || '').trim();
          if (/all\s*semesters?\s*\(?i[–\-]vi\)?/i.test(rawSem) || /i[–\-]vi/i.test(rawSem) || /1[–\-]6/i.test(rawSem)) {
            semBadgeText = 'Sem 1–6';
          } else if (/^all(\s*semesters?)?$/i.test(rawSem)) {
            semBadgeText = 'All Sem';
          } else if (rawSem.toLowerCase().startsWith('sem')) {
            semBadgeText = rawSem;
          } else if (rawSem) {
            semBadgeText = `Sem ${rawSem}`;
          }

          // Official UPC (Supports dual codes, e.g. "2926000002 / 2926001002"; strictly shows "Not Available" for unassigned)
          const rawUpc = String(r.upc || '').trim();
          const cleanUpc = rawUpc;
          const hasValidUpc = cleanUpc && cleanUpc !== 'null' && cleanUpc !== 'undefined' && cleanUpc !== 'TBD' && cleanUpc !== 'N/A' && /\d{6,}/.test(cleanUpc);

          let upcHtml = '';
          if (hasValidUpc) {
            upcHtml = `
              <div class="examcode-upc-inline">
                <span class="examcode-upc-label">UPC:</span>
                <code class="examcode-upc-code">${escapeHtml(cleanUpc)}</code>
                <button type="button" class="btn-copy-upc" data-upc="${escapeHtml(cleanUpc)}" data-title="${escapeHtml(r.title)}" title="Copy UPC to clipboard">
                  📋 Copy
                </button>
              </div>
            `;
          } else {
            upcHtml = `
              <div class="examcode-upc-inline">
                <span class="examcode-upc-label">UPC:</span>
                <span class="examcode-upc-na" style="display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 6px; background: rgba(148, 163, 184, 0.12); color: var(--text-muted); font-size: 0.78rem; font-weight: 600;">Not Available</span>
              </div>
            `;
          }

          // Verified Official DU Syllabus link
          let syllabusBtn = '';
          const officialSyllabusUrl = (r.syllabus_url && r.syllabus_url.trim()) || '';
          if (officialSyllabusUrl) {
            let syllabusLabel = '📄 DU Syllabus ↗';
            let syllabusTitle = 'Open official verified syllabus from University of Delhi';
            if (officialSyllabusUrl.includes('#page=')) {
              const pageNum = officialSyllabusUrl.split('#page=')[1];
              syllabusLabel = `📄 DU Syllabus (p. ${pageNum}) ↗`;
              syllabusTitle = `Open official DU syllabus booklet (Direct to Page ${pageNum} for ${r.title})`;
            }
            syllabusBtn = `
              <a href="${escapeHtml(officialSyllabusUrl)}" target="_blank" rel="noopener noreferrer" class="btn-view-syllabus" title="${escapeHtml(syllabusTitle)}">
                ${syllabusLabel}
              </a>
            `;
          } else {
            syllabusBtn = `
              <span class="btn-syllabus-not-avail" title="Official DU syllabus for this course is currently not available">
                📄 Syllabus: Not Available
              </span>
            `;
          }

          // Prerequisite note (compact)
          let prereqHtml = '';
          if (r.prerequisite) {
            prereqHtml = `
              <div class="examcode-prereq-compact">
                <span>⚠️</span> <span><strong>Prerequisite:</strong> ${escapeHtml(r.prerequisite)}</span>
              </div>
            `;
          } else if (r.prerequisite_note) {
            prereqHtml = `
              <div class="examcode-prereq-compact" style="background: rgba(2, 132, 199, 0.08); border-left-color: #0284c7; color: #0369a1;">
                <span>ℹ️</span> <span>${escapeHtml(r.prerequisite_note)}</span>
              </div>
            `;
          }

          // Eligibility note (compact)
          const eligibilityHtml = r.eligibility ? `
            <div class="examcode-prereq-compact" style="background: rgba(16, 185, 129, 0.08); border-left-color: #10b981; color: #065f46;">
              <span>📐</span> <span><strong>Eligibility:</strong> ${escapeHtml(r.eligibility)}</span>
            </div>
          ` : '';

          // Repeat rule note (compact)
          const repeatRuleHtml = r.repeat_rule ? `
            <div class="examcode-prereq-compact" style="background: rgba(245, 158, 11, 0.08); border-left-color: #f59e0b; color: #92400e;">
              <span>🚫</span> <span><strong>Year 1 Rule:</strong> ${escapeHtml(r.repeat_rule)}</span>
            </div>
          ` : '';

          return `
            <div class="examcode-card examcode-compact-card">
              <div class="examcode-compact-top">
                <div class="examcode-compact-title-wrap">
                  ${courseNoHtml}
                  <h3 class="examcode-title">${escapeHtml(r.title)}</h3>
                </div>
                <div class="examcode-compact-badges">
                  <span class="examcode-sem-badge">${escapeHtml(semBadgeText)}</span>
                  ${catPill}
                  ${progBadgeHtml}
                </div>
              </div>

              <div class="examcode-compact-meta">
                ${upcHtml}
                <div class="examcode-compact-actions">
                  ${syllabusBtn}
                </div>
              </div>

              ${prereqHtml}
              ${eligibilityHtml}
              ${repeatRuleHtml}
            </div>
          `;
        }).join('');

        // Wire Copy UPC buttons
        examCodesGrid.querySelectorAll('.btn-copy-upc').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.preventDefault();
            const upc = btn.dataset.upc;
            const title = btn.dataset.title;
            if (navigator.clipboard) {
              navigator.clipboard.writeText(upc).then(() => {
                const orig = btn.innerHTML;
                btn.innerHTML = '✓ Copied!';
                btn.style.background = '#16a34a';
                setTimeout(() => {
                  btn.innerHTML = orig;
                  btn.style.background = '#0284c7';
                }, 1800);
                showToast(`📋 Copied UPC: ${upc} (${title})`);
              }).catch(() => {
                showToast(`UPC: ${upc}`);
              });
            } else {
              showToast(`UPC: ${upc}`);
            }
          });
        });

        // Wire Share buttons
        examCodesGrid.querySelectorAll('.btn-share-examcode').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const title = btn.dataset.title;
            const upc = btn.dataset.upc;
            const sem = btn.dataset.sem;
            const url = btn.dataset.url;
            const shareText = `📝 *DU Examination Code (UPC):*\n*Paper:* ${title}\n*UPC Code:* ${upc}\n*Semester:* ${sem}\n\n📄 Official DU Syllabus: ${url || 'https://www.du.ac.in/index.php?page=nep-ugcf-2022-syllabi'}\n🏛️ Official DU Exam Datesheet & UPC Portal: https://exam.du.ac.in/datesheet.html\n\nVia SRCC Student Portal`;

            if (navigator.share) {
              try {
                await navigator.share({
                  title: `${title} - UPC: ${upc}`,
                  text: shareText
                });
                showToast(`✅ Paper code shared!`);
                return;
              } catch (err) {
                if (err.name === 'AbortError') return;
              }
            }

            if (navigator.clipboard) {
              navigator.clipboard.writeText(shareText).then(() => {
                showToast(`📋 Copied paper details & UPC to clipboard!`);
              });
            }
          });
        });
      }

      window._renderExamCodesDirectory = renderExamCodes;

      // Search input handler
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          currentQuery = e.target.value;
          if (btnClearSearch) btnClearSearch.style.display = currentQuery ? 'block' : 'none';
          renderExamCodes();
        });
      }

      if (btnClearSearch) {
        btnClearSearch.addEventListener('click', () => {
          if (searchInput) searchInput.value = '';
          currentQuery = '';
          btnClearSearch.style.display = 'none';
          renderExamCodes();
        });
      }

      // Programme selector pills
      progPills.forEach(pill => {
        pill.addEventListener('click', () => {
          progPills.forEach(p => {
            p.classList.toggle('active', p === pill);
            p.setAttribute('aria-selected', p === pill ? 'true' : 'false');
          });
          currentProg = pill.dataset.prog || 'ALL';
          renderExamCodes();
        });
      });

      // Semester filter dropdown
      if (semFilter) {
        semFilter.addEventListener('change', () => {
          currentSem = semFilter.value;
          renderExamCodes();
        });
      }

      // Semester quick tab pills in view
      const semPillBtns = document.querySelectorAll('#examCodesSemPills .sem-pill-btn');
      semPillBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          setExamCodesSemester(btn.dataset.sem || 'ALL');
        });
      });

      // Category filter dropdown
      if (catFilter) {
        catFilter.addEventListener('change', () => {
          currentCat = catFilter.value;
          renderExamCodes();
        });
      }

      // Reset filters button
      if (btnResetFilters) {
        btnResetFilters.addEventListener('click', () => {
          currentProg = 'ALL';
          currentCat = 'ALL';
          currentQuery = '';
          if (searchInput) searchInput.value = '';
          if (btnClearSearch) btnClearSearch.style.display = 'none';
          if (catFilter) catFilter.value = 'ALL';
          progPills.forEach(p => {
            const isAll = p.dataset.prog === 'ALL';
            p.classList.toggle('active', isAll);
            p.setAttribute('aria-selected', isAll ? 'true' : 'false');
          });
          setExamCodesSemester('ALL');
          showToast('🔄 Filters reset to all papers');
        });
      }

      // Back button to classrooms
      if (btnExamCodesBack) {
        btnExamCodesBack.addEventListener('click', (e) => {
          e.preventDefault();
          setAppMode('rooms');
        });
      }

      // UGCF Guidance Modal Handlers
      const ugcfModal = document.getElementById('ugcfGuidanceModal');
      const btnOpenUgcfGuidance = document.getElementById('btnOpenUgcfGuidance');
      const btnViewAllUgcfNotes = document.getElementById('btnViewAllUgcfNotes');
      const btnCloseUgcfModal = document.getElementById('btnCloseUgcfModal');
      const btnCloseUgcfModalFooter = document.getElementById('btnCloseUgcfModalFooter');

      function openUgcfModal() {
        if (!ugcfModal) return;
        ugcfModal.style.display = 'flex';
        document.body.classList.add('modal-open');
      }

      function closeUgcfModal() {
        if (!ugcfModal) return;
        ugcfModal.style.display = 'none';
        document.body.classList.remove('modal-open');
      }

      if (btnOpenUgcfGuidance) btnOpenUgcfGuidance.addEventListener('click', openUgcfModal);
      if (btnViewAllUgcfNotes) btnViewAllUgcfNotes.addEventListener('click', openUgcfModal);
      if (btnCloseUgcfModal) btnCloseUgcfModal.addEventListener('click', closeUgcfModal);
      if (btnCloseUgcfModalFooter) btnCloseUgcfModalFooter.addEventListener('click', closeUgcfModal);
      if (ugcfModal) {
        ugcfModal.addEventListener('click', (e) => {
          if (e.target === ugcfModal) closeUgcfModal();
        });
      }
    }

    // ========================================================================
    // 🍔 STUDENT ASSIST-STYLE CAMPUS NAVIGATION DRAWER
    // ========================================================================
    function initCampusDrawer() {
      const drawerOverlay = document.getElementById('campusDrawerOverlay');
      const btnThreeLineMenu = document.getElementById('btnThreeLineMenu');
      const bnavMenu = document.getElementById('bnavMenu');
      const btnCloseDrawer = document.getElementById('btnCloseCampusDrawer');
      const drawerNavNotices = document.getElementById('drawerNavNotices');
      const drawerNavExamCodes = document.getElementById('drawerNavExamCodes');

      function openCampusDrawer() {
        if (!drawerOverlay) return;
        closeAllPopups({ noHistory: true });
        drawerOverlay.style.display = 'flex';
        requestAnimationFrame(() => {
          drawerOverlay.classList.add('open');
        });
        document.body.classList.add('modal-open');
        try {
          if (!window.location.hash.includes('drawer')) {
            window.history.pushState({ type: 'drawer', modalId: 'campusDrawerOverlay' }, '', '#menu');
            _modalHistoryDepth++;
          }
        } catch (e) {}
      }
      window._openCampusDrawer = openCampusDrawer;

      function closeCampusDrawer(options = {}) {
        if (!drawerOverlay) return;
        drawerOverlay.classList.remove('open');
        setTimeout(() => {
          drawerOverlay.style.display = 'none';
        }, 280);
        document.body.classList.remove('modal-open');
        if (!options.fromPopState && !options.noHistory && _modalHistoryDepth > 0) {
          _modalHistoryDepth--;
          try {
            window.history.back();
          } catch (e) {}
        }
      }
      window._closeCampusDrawer = closeCampusDrawer;

      if (btnThreeLineMenu) {
        btnThreeLineMenu.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (drawerOverlay && (drawerOverlay.classList.contains('open') || drawerOverlay.style.display === 'flex')) {
            closeCampusDrawer();
          } else {
            openCampusDrawer();
          }
        });
      }

      if (bnavMenu) {
        bnavMenu.addEventListener('click', (e) => {
          e.preventDefault();
          if (drawerOverlay && drawerOverlay.classList.contains('open')) {
            closeCampusDrawer();
          } else {
            openCampusDrawer();
          }
        });
      }

      if (btnCloseDrawer) {
        btnCloseDrawer.addEventListener('click', (e) => {
          e.preventDefault();
          closeCampusDrawer();
        });
      }

      if (drawerOverlay) {
        drawerOverlay.addEventListener('click', (e) => {
          if (e.target === drawerOverlay) {
            closeCampusDrawer();
          }
        });
      }

      // Drawer navigation actions
      if (drawerNavNotices) {
        drawerNavNotices.addEventListener('click', () => {
          closeCampusDrawer({ noHistory: true });
          setAppMode('notices');
        });
      }

      if (drawerNavExamCodes) {
        drawerNavExamCodes.addEventListener('click', () => {
          closeCampusDrawer({ noHistory: true });
          setAppMode('exam_codes');
          if (typeof window._setExamCodesSemester === 'function') {
            window._setExamCodesSemester('ALL');
          }
        });
      }

      // Drawer General Guidelines trigger
      const drawerNavGuidelines = document.getElementById('drawerNavGuidelines');
      if (drawerNavGuidelines) {
        drawerNavGuidelines.addEventListener('click', () => {
          closeCampusDrawer();
          const ugcfModal = document.getElementById('ugcfGuidanceModal');
          if (ugcfModal) {
            ugcfModal.style.display = 'flex';
            document.body.classList.add('modal-open');
          }
        });
      }
    }

    // ========================================================================
    // ✨ TOUR CLEANUP (App Demo & Tour permanently removed per user request)
    // ========================================================================
    function initAppTour() {
      // Clear any lingering spotlight highlight classes from elements
      document.querySelectorAll('.tour-target-highlight').forEach(el => el.classList.remove('tour-target-highlight'));
    }

    // ========================================================================
    // 🚀 INITIAL BOOTSTRAP
    // ========================================================================
    populateLeaveTeacherSelect();
    renderCampusNoticeBanner();
    render();
    renderFaculty();
    initTimetableFeature();
    initCollegeNoticesFeature();
    initExamCodesFeature();
    initCampusDrawer();
    initAppTour();
    initWifiDirectory();
    trackStudentVisitor();
    initLeaveNotificationSystem();
    initDeviceWakeupListeners();
    initOfflineDetection();
    handleUrlDeepLinks({ isInitial: true });
    try {
      const initMode = state.activeMode || 'rooms';
      const initHash = window.location.hash || ('#' + initMode);
      window.history.replaceState({ type: 'tab', mode: initMode, isBase: true }, '', initHash);
    } catch (e) {}

    window.addEventListener('popstate', (e) => handlePopState(e));
    window.addEventListener('hashchange', (e) => {
      if (Date.now() - _lastPopStateTime < 120) return;
      handlePopState(e);
    });
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
    const swUrl = './sw.js?v=97';
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
