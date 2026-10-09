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
          <button type="button" class="btn-notice-dismiss" id="btnDismissCampusNotice" title="Dismiss notice">✕</button>
          <div class="campus-notice-header">
            ${catBadge}
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

      if (attachment.type === 'pdf') {
        bodyEl.innerHTML = `
          <iframe src="${attachment.dataUrl}" style="width: 100%; height: 70vh; border: none; border-radius: 6px;"></iframe>
          <div style="margin-top: 10px; display: flex; justify-content: flex-end;">
            <a href="${attachment.dataUrl}" download="${escapeHtml(attachment.name || 'SRCC_Notice.pdf')}" class="btn-primary" style="text-decoration: none; font-size: 0.8rem; padding: 6px 14px; background: #1e293b; color: #fff; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;">
              ⬇️ Download PDF
            </a>
          </div>
        `;
      } else {
        bodyEl.innerHTML = `
          <div style="text-align: center;">
            <img src="${attachment.dataUrl}" alt="Notice Poster" style="max-width: 100%; max-height: 70vh; object-fit: contain; border-radius: 6px; box-shadow: 0 4px 14px rgba(0,0,0,0.1);" />
            <div style="margin-top: 10px; display: flex; justify-content: flex-end;">
              <a href="${attachment.dataUrl}" download="${escapeHtml(attachment.name || 'SRCC_Poster.png')}" class="btn-primary" style="text-decoration: none; font-size: 0.8rem; padding: 6px 14px; background: #1e293b; color: #fff; border-radius: 6px; display: inline-flex; align-items: center; gap: 4px;">
                ⬇️ Download Image
              </a>
            </div>
          </div>
        `;
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

      // Update mobile bottom nav
      if (bnavRooms) bnavRooms.classList.toggle('active', isRooms);
      if (bnavFaculty) bnavFaculty.classList.toggle('active', isFaculty);
      if (bnavTimetable) bnavTimetable.classList.toggle('active', isTimetable);

      // Clean filter reset when switching tabs so users never get stuck with leftover filters
      if (!preserveFilters) {
        // 1. Reset Room Finder filters
        state.activeCategory = 'ALL';
        state.activeSlot = 'ALL';
        state.searchQuery = '';
        state.freeNowActive = false;
        if (btnFreeNow) btnFreeNow.checked = false;
        if (toggleStatusText) {
          toggleStatusText.textContent = 'ALL SLOTS';
          toggleStatusText.style.color = '';
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
    if (bnavRooms) bnavRooms.addEventListener('click', () => setAppMode('rooms'));
    if (bnavFaculty) bnavFaculty.addEventListener('click', () => setAppMode('faculty'));
    if (bnavTimetable) bnavTimetable.addEventListener('click', () => setAppMode('timetable'));
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
          state.activeSlot = 'ALL';
          if (slotSelect) slotSelect.value = 'ALL';
          showToast('🌙 <strong>College Off-Hours right now.</strong> Classes run 8:30 AM – 6:00 PM (Showing all rooms).');
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
      setFreeNowState(!state.freeNowActive);
    }

    if (btnFreeNow) btnFreeNow.addEventListener('click', toggleFreeNow);
    if (toggleFreeNowWrapper) {
      toggleFreeNowWrapper.addEventListener('click', (e) => {
        if (e.target !== btnFreeNow && !btnFreeNow.contains(e.target)) toggleFreeNow();
      });
    }
    if (bnavFreeNow) {
      bnavFreeNow.addEventListener('click', () => {
        if (state.activeMode !== 'rooms') {
          setAppMode('rooms');
        }
        toggleFreeNow();
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

      const siteUrl = window.location.origin + window.location.pathname;
      const activeDateStr = getDateForDay(state.activeDay);
      const dayAndDateDisplay = `${state.activeDay}, ${activeDateStr}`;

      const cleanMessage = `🎓 SRCC Classroom Vacancy Alert

` +
        `📍 Room: ${room.code} (${room.name})
` +
        `🏛️ Wing: ${room.category.split(' (')[0]}
` +
        `🗓️ Day & Date: ${dayAndDateDisplay}
` +
        `👥 Capacity: ${room.capacity} seats
` +
        `☕ Lunch Recess: 1:30 PM – 2:00 PM (Vacant)

` +
        `🕒 Free Academic Slots:
${freeSlotsList}

` +
        `🔍 Live Timetable & Vacancy Tracker: ${siteUrl}`;

      const whatsappMessage = `🎓 *SRCC Classroom Vacancy Alert*

` +
        `📍 *Room:* ${room.code} (${room.name})
` +
        `🏛️ *Wing:* ${room.category.split(' (')[0]}
` +
        `🗓️ *Day & Date:* ${dayAndDateDisplay}
` +
        `👥 *Capacity:* ${room.capacity} seats
` +
        `☕ *Lunch Recess:* 1:30 PM – 2:00 PM (Vacant)

` +
        `🕒 *Free Academic Slots:*
${freeSlotsList}

` +
        `🔍 *Live Timetable & Vacancy Tracker:* ${siteUrl}`;

      const tweetText = `🎓 SRCC Vacancy: Room ${room.code} is FREE on ${dayAndDateDisplay}!
🕒 Check live timetable:`;
      const emailSubject = `SRCC Room Vacancy: ${room.code} (${dayAndDateDisplay})`;

      currentShareMessage = cleanMessage;

      copyToClipboard(cleanMessage)
        .then(() => showToast(`📋 Room details for <strong>${escapeHtml(room.code)}</strong> copied to clipboard!`, true, 3500))
        .catch(() => showToast(`📤 Share Room <strong>${escapeHtml(room.code)}</strong>`, false, 2500));

      if (shareModalTitle) shareModalTitle.textContent = `📤 Share ${room.code} (${room.name})`;
      if (sharePreviewText) sharePreviewText.textContent = cleanMessage;

      const encodedCleanMsg = encodeURIComponent(cleanMessage);
      const encodedWaMsg = encodeURIComponent(whatsappMessage);
      const encodedUrl = encodeURIComponent(siteUrl);

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
        shareBtnTelegram.href = `https://t.me/share/url?url=${encodedUrl}&text=${encodedCleanMsg}`;
      }

      if (shareBtnLinkedin) {
        shareBtnLinkedin.onclick = (e) => {
          e.preventDefault();
          if (navigator.share) {
            navigator.share({ title: `SRCC Room ${room.code} Vacancy`, text: cleanMessage }).catch(() => {});
          } else {
            copyToClipboard(cleanMessage);
            window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`, '_blank', 'noopener,noreferrer');
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
            window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, '_blank', 'noopener,noreferrer');
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
    function render() {
      renderActiveLeavesBanners();
      if (statActiveDay) statActiveDay.textContent = state.activeDay;
      if (metricDayLabel) metricDayLabel.textContent = state.activeDay;

      // Filter Rooms
      let filtered = appData.rooms.filter(room => {
        if (!matchesCategory(room, state.activeCategory)) return false;
        if (state.searchQuery && !matchesSearch(room, state.searchQuery)) return false;

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

        let effectiveFreeSlots = (sched.free_slots || []).filter(s => !lockedSlotsSet.has(s));
        let effectiveBonusSlots = bonusFreeSlots.filter(b => !lockedSlotsSet.has(b.slot));
        if (isFullDayLocked) {
          effectiveFreeSlots = [];
          effectiveBonusSlots = [];
        }

        const effectiveFreeHours = isFullDayLocked ? 0 : (effectiveFreeSlots.length + effectiveBonusSlots.length);
        let cardStyleClass = 'is-booked';
        if (effectiveFreeHours >= 5) cardStyleClass = 'has-many-free';
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
              </div>
            </div>

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

    function openScheduleModal(roomCode) {
      const room = appData.rooms.find(r => r.code === roomCode);
      if (!room) return;

      const sched = room.schedule[state.activeDay] || { free_slots: [], occupied_slots: [], lunch_recess_free: true };

      if (modalRoomTitle) modalRoomTitle.textContent = `${room.code} - ${room.name}`;
      if (modalRoomMeta) modalRoomMeta.textContent = `${room.category} · Capacity: ${room.capacity} · Selected Day: ${state.activeDay}`;

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

      // Clicking room badges jumps straight to Classroom Finder
      document.querySelectorAll('.room-badge-link').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const targetRoom = btn.dataset.room;
          setAppMode('rooms');
          if (searchInput) searchInput.value = targetRoom;
          state.searchQuery = targetRoom;
          state.activeCategory = 'ALL';
          state.activeSlot = 'ALL';
          if (categoryPills) categoryPills.forEach(p => p.classList.toggle('active', p.dataset.cat === 'ALL'));
          if (slotSelect) slotSelect.value = 'ALL';
          if (btnClearSearch) btnClearSearch.style.display = 'block';
          render();
          setTimeout(() => {
            openScheduleModal(targetRoom);
          }, 150);
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

      // 1. Desktop Table Rows (> 640px)
      const tableRows = daySched.map(cls => {
        const roomCode = cls.room ? cls.room.trim() : 'TBD';
        const subjInfo = getSubjectDetails(cls.subject, cls.subject_name);
        const subjCode = subjInfo.code;
        const subjFullName = subjInfo.fullName;
        const courseName = cls.course || 'B.Com (Hons)';
        const sem = cls.semester || '';
        const sec = cls.section || '';
        const batch = cls.batch || '';
        const rawBatch = cls.raw_batch || '';

        return `
          <tr>
            <td style="white-space: nowrap;"><strong>${escapeHtml(cls.slot ? cls.slot.replace(' to ', ' – ') : 'Period')}</strong></td>
            <td><span class="badge-slot-occupied">${escapeHtml(cls.type || 'Lecture')}</span></td>
            <td>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 2px;">
                ${subjCode ? `<span class="subject-pill" title="${escapeHtml(subjFullName)}" style="font-size: 0.76rem; padding: 2px 7px;">${escapeHtml(subjCode)}</span>` : ''}
                <strong style="color: var(--text-primary); font-size: 0.88rem;">${escapeHtml(subjFullName && subjFullName !== subjCode ? subjFullName : courseName)}</strong>
                ${sem ? `<span class="class-batch-badge" style="color: #0369a1; border-color: rgba(56, 189, 248, 0.3);">${escapeHtml(sem)}</span>` : ''}
              </div>
              ${(sec || batch) ? `
                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 3px;">
                  ${sec ? `<span class="class-batch-badge">${escapeHtml(sec)}</span>` : ''}
                  ${batch ? `<span class="class-batch-badge" style="color: var(--srcc-gold); border-color: rgba(252, 235, 10, 0.3);">Batch ${escapeHtml(batch)}${rawBatch && rawBatch !== batch ? ` (${escapeHtml(rawBatch)})` : ''}</span>` : ''}
                </div>
              ` : ''}
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
      const mobileCards = daySched.map(cls => {
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

        return `
          <div class="modal-timetable-card ${typeCls}">
            <div class="m-tt-header">
              <div class="m-tt-slot">
                <span>🕒</span>
                <span>${escapeHtml(cls.slot ? cls.slot.replace(' to ', ' – ') : 'Period')}</span>
              </div>
              <span class="m-tt-type">${escapeHtml(cls.type || 'Lecture')}</span>
            </div>
            <div class="m-tt-course-row">
              ${subjCode ? `<span class="m-tt-subject" title="${escapeHtml(subjFullName)}">${escapeHtml(subjCode)}</span>` : ''}
              <span class="m-tt-coursename">${escapeHtml(subjFullName && subjFullName !== subjCode ? subjFullName : courseName)}</span>
              ${sem ? `<span class="class-sem-badge">${escapeHtml(sem)}</span>` : ''}
            </div>
            <div class="m-tt-meta-row">
              <div class="m-tt-section-batch">
                ${sec ? `<span class="sec-chip">Sec: <strong>${escapeHtml(sec)}</strong></span>` : ''}
                ${batch ? `<span class="batch-chip">Batch ${escapeHtml(batch)}${rawBatch && rawBatch !== batch ? ` (${escapeHtml(rawBatch)})` : ''}</span>` : ''}
                ${(!sec && !batch) ? `<span class="sec-chip">Whole Class</span>` : ''}
              </div>
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
        btn.addEventListener('click', () => {
          const rCode = btn.dataset.room;
          if (teacherModal) closeAppModal(teacherModal);
          setAppMode('rooms');
          state.activeCategory = 'ALL';
          state.activeSlot = 'ALL';
          if (categoryPills) categoryPills.forEach(p => p.classList.toggle('active', p.dataset.cat === 'ALL'));
          if (slotSelect) slotSelect.value = 'ALL';
          if (searchInput) searchInput.value = rCode;
          state.searchQuery = (rCode || '').trim();
          if (btnClearSearch) btnClearSearch.style.display = 'block';
          render();
          setTimeout(() => openScheduleModal(rCode), 120);
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

      // Extract Course -> Sem -> Sec -> Batches hierarchy from teachersData
      const courseMap = {};
      const getTeachers = () => (teachersData && teachersData.teachers) ? teachersData.teachers : (window.SRCC_TEACHERS_DATA?.teachers || []);

      function buildHierarchy() {
        const teachers = getTeachers();
        teachers.forEach(t => {
          if (!t.schedule) return;
          Object.keys(t.schedule).forEach(day => {
            (t.schedule[day] || []).forEach(s => {
              const c = (s.course || '').trim();
              const sem = (s.semester || '').trim();
              const sec = (s.section || '').trim();
              const batch = (s.batch || '').trim();

              if (c && sem && sec) {
                if (!courseMap[c]) courseMap[c] = {};
                if (!courseMap[c][sem]) courseMap[c][sem] = {};
                if (!courseMap[c][sem][sec]) courseMap[c][sem][sec] = new Set();
                if (batch) courseMap[c][sem][sec].add(batch);
              }
            });
          });
        });
      }

      buildHierarchy();

      const availableCourses = Object.keys(courseMap).sort();
      let savedCourse = localStorage.getItem('srcc_my_tt_course');
      let savedSem = localStorage.getItem('srcc_my_tt_sem');
      let savedSec = localStorage.getItem('srcc_my_tt_sec');
      let savedBatch = localStorage.getItem('srcc_my_tt_batch') || 'ALL';

      if (!savedCourse || !courseMap[savedCourse]) {
        savedCourse = availableCourses.find(c => c.includes('B.Com')) || availableCourses[0] || 'B.Com (Hons)';
      }
      if (!savedSem || !courseMap[savedCourse]?.[savedSem]) {
        savedSem = Object.keys(courseMap[savedCourse] || {})[0] || 'Sem I';
      }
      if (!savedSec || !courseMap[savedCourse]?.[savedSem]?.[savedSec]) {
        savedSec = Object.keys(courseMap[savedCourse]?.[savedSem] || {})[0] || 'Sec A';
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
        const secs = Object.keys(courseMap[ttState.course]?.[ttState.sem] || {}).sort();
        if (ttMainSecSelect) {
          ttMainSecSelect.innerHTML = '';
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

        // Batches for current sec
        const batchSet = courseMap[ttState.course]?.[ttState.sem]?.[ttState.sec] || new Set();
        const batches = Array.from(batchSet).sort();

        const batchOptionsHtml = '<option value="ALL">All batches</option>' + 
          batches.map(b => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join('');

        if (ttMainBatchSelect) {
          ttMainBatchSelect.innerHTML = batchOptionsHtml;
          if (ttState.batch !== 'ALL' && batches.includes(ttState.batch)) {
            ttMainBatchSelect.value = ttState.batch;
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
        ttMainDayButtons.forEach(btn => {
          btn.classList.toggle('active', btn.dataset.day === ttState.day);
        });
        ttMainCoursePills.forEach(pill => {
          pill.classList.toggle('active', pill.dataset.course === ttState.course);
        });
        ttMainSemPills.forEach(pill => {
          pill.classList.toggle('active', pill.dataset.sem === ttState.sem);
        });
        if (ttMainSecSelect) ttMainSecSelect.value = ttState.sec;
        if (ttMainBatchSelect) ttMainBatchSelect.value = ttState.batch;
        if (ttMainSlotSelect) ttMainSlotSelect.value = ttState.slot;
      }

      function getTimetableData() {
        const teachers = getTeachers();
        const activeLeaves = (leavesData && Array.isArray(leavesData.leaves)) 
          ? leavesData.leaves 
          : (window.SRCC_FACULTY_LEAVES?.leaves || []);

        const classesBySlot = {};
        academicPeriods.forEach(p => { classesBySlot[p.slot] = []; });

        teachers.forEach(t => {
          const tName = t.clean_name || t.label || 'Faculty';
          const daySched = t.schedule?.[ttState.day] || [];
          daySched.forEach(s => {
            const courseMatches = s.course === ttState.course || 
                                  (Array.isArray(s.courses_list) && s.courses_list.includes(ttState.course)) ||
                                  (s.course && s.course.includes(ttState.course));
            const semMatches = s.semester === ttState.sem || 
                               (Array.isArray(s.semesters_list) && s.semesters_list.includes(ttState.sem)) ||
                               (s.semester && s.semester.includes(ttState.sem));
            const secMatches = s.section === ttState.sec || 
                               (Array.isArray(s.sections_list) && s.sections_list.includes(ttState.sec)) ||
                               (s.section && s.section.includes(ttState.sec));

            if (courseMatches && semMatches && secMatches) {
              const selBatch = (ttState.batch || 'ALL').trim().toUpperCase();

              // Batch filtering:
              if (selBatch !== 'ALL') {
                const allBatches = [
                  s.batch,
                  s.raw_batch,
                  ...(s.batches_list || []),
                  ...(s.raw_batches_list || [])
                ].filter(Boolean).map(b => b.toUpperCase().trim());

                if (allBatches.length > 0) {
                  const matches = allBatches.some(b => {
                    const normB = b.replace(/P(\d+)$/, '$1');
                    const normSel = selBatch.replace(/P(\d+)$/, '$1');
                    const subBatches = b.split(/[\s,\/]+/).map(x => x.trim().toUpperCase());
                    return b === selBatch ||
                           normB === normSel ||
                           subBatches.includes(selBatch) ||
                           subBatches.some(sb => sb.replace(/P(\d+)$/, '$1') === normSel);
                  });
                  if (!matches) {
                    return;
                  }
                }
              }

              const slot = s.slot;
              if (classesBySlot[slot]) {
                // Deduplicate if already added for this teacher and subject
                const already = classesBySlot[slot].find(ex => ex.teacherId === t.id && ex.subject === s.subject && ex.room === s.room);
                if (already) return;

                const leaveRecord = (typeof isTeacherOnLeave === 'function' ? isTeacherOnLeave(t) : null) || activeLeaves.find(l => {
                  const nameMatch = l.teacher_name && (tName.toLowerCase().includes(l.teacher_name.toLowerCase()) || l.teacher_name.toLowerCase().includes(tName.toLowerCase()));
                  const dayMatch = l.day === ttState.day || !l.day;
                  return nameMatch && dayMatch;
                });
                const isOnLeave = Boolean(leaveRecord);

                const subjInfo = getSubjectDetails(s.subject, s.subject_name);

                classesBySlot[slot].push({
                  subject: subjInfo.code,
                  subjectName: subjInfo.fullName,
                  type: s.type || 'Lecture',
                  batch: s.batch || '',
                  rawBatch: s.raw_batch || '',
                  teacher: tName,
                  teacherId: t.id,
                  room: s.room || '',
                  isOnLeave: isOnLeave
                });
              }
            }
          });
        });

        // Compute free rooms for current day
        const freeRoomsBySlot = {};
        const roomsList = (appData && Array.isArray(appData.rooms)) ? appData.rooms : (window.SRCC_DATA?.rooms || []);

        academicPeriods.forEach(p => {
          const slot = p.slot;
          const freeCodes = [];
          roomsList.forEach(r => {
            const daySched = r.schedule?.[ttState.day];
            if (daySched && Array.isArray(daySched.free_slots) && daySched.free_slots.includes(slot)) {
              freeCodes.push(r.code);
            }
          });
          freeRoomsBySlot[slot] = freeCodes;
        });

        return { classesBySlot, freeRoomsBySlot };
      }

      // --- Render Native Full View Section (#viewTimetableSection) ---
      function renderMainTimetableView() {
        if (!viewTimetableSection) return;

        syncControlPills();
        const { classesBySlot, freeRoomsBySlot } = getTimetableData();
        const filterQuery = (ttState.searchQuery || '').trim().toLowerCase();

        if (btnClearTtMainSearch) {
          btnClearTtMainSearch.style.display = filterQuery ? 'block' : 'none';
        }

        let totalClassesToday = 0;
        let totalFreePeriodsToday = 0;
        let matchCount = 0;
        let cardsHtml = '';

        academicPeriods.forEach(p => {
          const slot = p.slot;
          const timeLabel = p.time;
          const slotClasses = classesBySlot[slot] || [];
          const freeRooms = freeRoomsBySlot[slot] || [];

          if (slotClasses.length > 0) {
            totalClassesToday += slotClasses.length;
          } else {
            totalFreePeriodsToday++;
          }

          // Slot filter (ALL or specific period)
          if (ttState.slot !== 'ALL' && ttState.slot !== slot) {
            return;
          }

          // Search text filtering
          let filteredClasses = slotClasses;
          if (filterQuery) {
            filteredClasses = slotClasses.filter(c => {
              const fullText = `${c.subject} ${c.subjectName || ''} ${c.type} ${c.batch} ${c.rawBatch || ''} ${c.teacher} ${c.room}`.toLowerCase();
              return fullText.includes(filterQuery);
            });
            if (filteredClasses.length === 0) {
              return;
            }
          }

          if (filteredClasses.length > 0) {
            matchCount += filteredClasses.length;
            // Scheduled Classes Card
            filteredClasses.forEach(c => {
              const displayBatch = c.rawBatch || c.batch;
              const batchBadge = displayBatch 
                ? ` · Batch ${escapeHtml(displayBatch)}`
                : '';
              const initials = c.teacher.split(' ').map(n => n[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || 'FC';
              const leaveHtml = c.isOnLeave 
                ? `<div class="tt-leave-badge">🏖️ Faculty on Leave Today · Class Suspended</div>` 
                : '';
              const targetRoom = getTargetRoomJumpCode(c.room);
              const displayRoom = getDisplayRoomName(c.room);
              const roomButtonHtml = c.room 
                ? `<button type="button" class="tt-room-btn btn-jump-room" data-room="${escapeHtml(targetRoom)}" title="Click to view room in campus room finder">🏛️ ${escapeHtml(displayRoom)}</button>` 
                : `<span style="font-size: 0.8rem; color: var(--text-muted);">Room TBD</span>`;

              const leaveCardCls = c.isOnLeave ? ' is-faculty-leave' : '';
              const displaySubject = c.subjectName || c.subject || 'Subject';
              const showCodeBadge = Boolean(c.subject && c.subject.toLowerCase() !== displaySubject.toLowerCase());

              cardsHtml += `
                <article class="tt-card${leaveCardCls}" data-slot="${escapeHtml(slot)}">
                  <div class="tt-card-header">
                    <span class="tt-period-badge">🕒 Period ${p.num} · ${timeLabel}</span>
                    <span class="tt-type-pill">${escapeHtml(c.type)}${batchBadge}</span>
                  </div>
                  <div class="tt-card-subject">
                    <span>${escapeHtml(displaySubject)}</span>
                    ${showCodeBadge ? `<span class="tt-subj-code-pill">${escapeHtml(c.subject)}</span>` : ''}
                  </div>
                  <div class="tt-card-meta">
                    <span>${escapeHtml(ttState.course)}</span> •
                    <span>${escapeHtml(ttState.sem)}</span> •
                    <span>${escapeHtml(ttState.sec)}</span>
                  </div>
                  <div class="tt-card-faculty">
                    <div class="tt-faculty-info btn-view-teacher-today" data-teacher-id="${escapeHtml(c.teacherId || '')}" data-teacher-name="${escapeHtml(c.teacher)}" role="button" tabindex="0" title="View ${escapeHtml(c.teacher)}'s timetable">
                      <div class="tt-faculty-avatar">${initials}</div>
                      <div class="tt-faculty-name">${escapeHtml(c.teacher)}</div>
                    </div>
                    ${roomButtonHtml}
                  </div>
                  ${leaveHtml}
                </article>
              `;
            });
          }
        });

        // Update Stat tiles
        if (ttCountClasses) ttCountClasses.textContent = totalClassesToday;
        if (ttCountFreePeriods) ttCountFreePeriods.textContent = totalFreePeriodsToday;
        if (ttSelectedSummary) {
          const shortCourse = ttState.course.includes('Economics') ? 'Economics' : 'B.Com (Hons)';
          ttSelectedSummary.textContent = `${shortCourse} · ${ttState.sem}`;
        }
        if (ttSelectedBatchSummary) {
          const batchLabel = ttState.batch === 'ALL' ? 'All batches' : `Batch ${ttState.batch}`;
          ttSelectedBatchSummary.textContent = `${ttState.sec} · ${batchLabel}`;
        }
        if (ttRibbonCourseSec) {
          ttRibbonCourseSec.textContent = `${ttState.course}, ${ttState.sem}, ${ttState.sec} (${ttState.batch === 'ALL' ? 'All batches' : 'Batch ' + ttState.batch})`;
        }
        if (ttRibbonDay) {
          ttRibbonDay.textContent = ttState.day;
        }

        // Render schedule grid & empty state
        if (ttMainScheduleGrid) {
          ttMainScheduleGrid.innerHTML = cardsHtml;
        }
        if (ttMainEmptyState) {
          ttMainEmptyState.style.display = (matchCount === 0) ? 'block' : 'none';
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

          // Attach 1-click room jumping
          ttMainScheduleGrid.querySelectorAll('.btn-jump-room').forEach(btn => {
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              const targetRoom = btn.dataset.room;
              if (targetRoom) {
                setAppMode('rooms');
                state.activeCategory = 'ALL';
                state.activeSlot = 'ALL';
                if (categoryPills) categoryPills.forEach(p => p.classList.toggle('active', p.dataset.cat === 'ALL'));
                if (slotSelect) slotSelect.value = 'ALL';
                if (searchInput) {
                  searchInput.value = targetRoom;
                  state.searchQuery = targetRoom.trim();
                  if (btnClearSearch) btnClearSearch.style.display = 'block';
                  render();
                  setTimeout(() => {
                    openScheduleModal(targetRoom);
                  }, 150);
                }
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

      // Populate initial values
      updateSectionsAndBatches(false);
      syncControlPills();
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
    // 🚀 INITIAL BOOTSTRAP
    // ========================================================================
    populateLeaveTeacherSelect();
    renderCampusNoticeBanner();
    render();
    renderFaculty();
    initTimetableFeature();
    trackStudentVisitor();
    initLeaveNotificationSystem();
    initDeviceWakeupListeners();
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
