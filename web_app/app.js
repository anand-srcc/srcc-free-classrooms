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

  // ☁️ Optional Cloud Database Fetch (if custom cloud_config.js URL is provided)
  const customCloudUrl = (window.SRCC_CLOUD_CONFIG && window.SRCC_CLOUD_CONFIG.db_url && window.SRCC_CLOUD_CONFIG.db_url.trim())
    ? window.SRCC_CLOUD_CONFIG.db_url.trim()
    : (localStorage.getItem('srcc_cloud_db_url_custom') || '');

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
            } else if (Array.isArray(d)) {
              leavesData = { leaves: d, last_updated: 'Live Cloud' };
              window.SRCC_FACULTY_LEAVES = leavesData;
            }
          }
        })
        .catch(err => {
          clearTimeout(timeoutId);
          console.warn('Custom Cloud Sync note:', err);
        })
    );
  }

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

    // ========================================================================
    // 🏖️ FACULTY LEAVE MANAGEMENT STORAGE & HELPERS
    // ========================================================================
    const LEAVES_STORAGE_KEY = 'srcc_faculty_leaves_v2';

    function getLeavesList() {
      // Prioritize authoritative leaves from window.SRCC_FACULTY_LEAVES or leavesData
      const activeSource = (window.SRCC_FACULTY_LEAVES && Array.isArray(window.SRCC_FACULTY_LEAVES.leaves))
        ? window.SRCC_FACULTY_LEAVES
        : leavesData;
      if (activeSource && Array.isArray(activeSource.leaves)) {
        return [...activeSource.leaves];
      }
      try {
        const stored = localStorage.getItem(LEAVES_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) return parsed;
        }
      } catch (e) {
        console.error('Error reading leaves from localStorage:', e);
      }
      return [];
    }

    function saveLeavesList(list) {
      try {
        localStorage.setItem(LEAVES_STORAGE_KEY, JSON.stringify(list));
      } catch (e) {
        console.error('Error saving leaves to localStorage:', e);
      }
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
    const viewRoomsSection = document.getElementById('viewRoomsSection');
    const viewFacultySection = document.getElementById('viewFacultySection');
    const tabModeDirectory = document.getElementById('tabModeDirectory');
    const viewDirectorySection = document.getElementById('viewDirectorySection');
    const directoryGrid = document.getElementById('directoryGrid');
    const searchDirectoryInput = document.getElementById('searchDirectoryInput');

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
          text: '8:30 AM – 6:00 PM (Full Day Continuous)'
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

        return {
          start: startStr,
          end: endStr,
          durationHours: duration,
          periodsCount: group.length,
          text: `${startStr} – ${endStr} (${durationStr} continuous)`
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
      if (currentMinutes >= 13 * 60 + 30 && currentMinutes < 14 * 60 + 0) {
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

    // Populate metadata dates
    const lastSyncedStr = (appData && appData.metadata && appData.metadata.last_synced)
      ? appData.metadata.last_synced
      : new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

    const elHeaderSync = document.getElementById('lastUpdatedHeader');
    const elRibbonSync = document.getElementById('statLastSynced');
    const elFooterSync = document.getElementById('footerLastSynced');
    if (elHeaderSync) elHeaderSync.textContent = lastSyncedStr;
    if (elRibbonSync) elRibbonSync.textContent = lastSyncedStr;
    if (elFooterSync) elFooterSync.textContent = lastSyncedStr;
    if (statFacultyLastSynced) statFacultyLastSynced.textContent = lastSyncedStr;

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
      let onLeaveCount = 0;
      if (typeof teachersData !== 'undefined' && teachersData && teachersData.teachers) {
        onLeaveCount = teachersData.teachers.filter(t => isTeacherOnLeave(t, todayDate)).length;
      } else {
        const allLeaves = getLeavesList();
        onLeaveCount = allLeaves.filter(l => {
          if (!l.start_date && !l.end_date) return true;
          const s = l.start_date || '2000-01-01';
          const e = l.end_date || '2099-12-31';
          return (todayDate >= s && todayDate <= e);
        }).length;
      }
      showToast(`🏖️ Showing <strong>${onLeaveCount} ${onLeaveCount === 1 ? 'professor' : 'professors'}</strong> currently on leave today.`);
    }

    // ========================================================================
    // 🔀 DUAL MODE SWITCHING (ROOMS ⇄ FACULTY)
    // ========================================================================
    function setAppMode(mode, preserveFilters = false) {
      if (mode === 'leaves') {
        openFacultyLeavesView();
        return;
      }
      state.activeMode = mode;
      const isRooms = (mode === 'rooms');
      const isFaculty = (mode === 'faculty');
      const isDirectory = (mode === 'directory');

      if (tabModeRooms) {
        tabModeRooms.classList.toggle('active', isRooms);
        tabModeRooms.setAttribute('aria-selected', isRooms ? 'true' : 'false');
      }
      if (tabModeFaculty) {
        tabModeFaculty.classList.toggle('active', isFaculty);
        tabModeFaculty.setAttribute('aria-selected', isFaculty ? 'true' : 'false');
      }
      if (tabModeDirectory) {
        tabModeDirectory.classList.toggle('active', isDirectory);
        tabModeDirectory.setAttribute('aria-selected', isDirectory ? 'true' : 'false');
      }

      if (viewRoomsSection) viewRoomsSection.style.display = isRooms ? 'block' : 'none';
      if (viewFacultySection) viewFacultySection.style.display = isFaculty ? 'block' : 'none';
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
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    if (tabModeRooms) tabModeRooms.addEventListener('click', () => setAppMode('rooms'));
    if (tabModeFaculty) tabModeFaculty.addEventListener('click', () => setAppMode('faculty'));
    if (bnavRooms) bnavRooms.addEventListener('click', () => setAppMode('rooms'));
    if (bnavFaculty) bnavFaculty.addEventListener('click', () => setAppMode('faculty'));

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
      else renderFaculty();
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

    sheetDayButtons.forEach(btn => {
      if (btn.dataset.day === state.activeDay) btn.classList.add('active');
      btn.addEventListener('click', () => {
        setActiveDay(btn.dataset.day);
        if (daySheetOverlay) daySheetOverlay.style.display = 'none';
      });
    });

    if (bnavDayLabel) bnavDayLabel.textContent = state.activeDay.slice(0, 3);

    // Mobile Bottom Sheet Handlers
    if (bnavDay && daySheetOverlay) {
      bnavDay.addEventListener('click', () => {
        daySheetOverlay.style.display = 'flex';
      });
    }

    if (btnCloseDaySheet && daySheetOverlay) {
      btnCloseDaySheet.addEventListener('click', () => { daySheetOverlay.style.display = 'none'; });
      daySheetOverlay.addEventListener('click', (e) => {
        if (e.target === daySheetOverlay) daySheetOverlay.style.display = 'none';
      });
    }

    if (btnCloseWingsSheet && wingsSheetOverlay) {
      btnCloseWingsSheet.addEventListener('click', () => { wingsSheetOverlay.style.display = 'none'; });
      wingsSheetOverlay.addEventListener('click', (e) => {
        if (e.target === wingsSheetOverlay) wingsSheetOverlay.style.display = 'none';
      });
    }

    sheetWingItems.forEach(item => {
      item.addEventListener('click', () => {
        const cat = item.dataset.cat;
        setActiveCategory(cat);
        if (wingsSheetOverlay) wingsSheetOverlay.style.display = 'none';
        const titleText = item.querySelector('.wing-title')?.textContent || cat;
        showToast(`🏛️ Showing wing: <strong>${escapeHtml(titleText)}</strong>`);
      });
    });

    // Mobile Search Button
    if (bnavSearch) {
      bnavSearch.addEventListener('click', () => {
        if (state.activeMode === 'rooms' && searchInput) {
          searchInput.focus();
          window.scrollTo({ top: searchInput.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
        } else if (facultySearchInput) {
          facultySearchInput.focus();
          window.scrollTo({ top: facultySearchInput.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
        }
      });
    }

    // Community Link Handlers
    if (bnavCommunity) {
      bnavCommunity.addEventListener('click', (e) => {
        e.preventDefault();
        window.open(SRCC_WHATSAPP_LINK, '_blank', 'noopener,noreferrer');
      });
    }

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
        if (state.currentLiveSlot) {
          state.activeSlot = state.currentLiveSlot;
          if (slotSelect) slotSelect.value = state.currentLiveSlot;
        } else {
          state.activeSlot = 'ALL';
          if (slotSelect) slotSelect.value = 'ALL';
        }
        showToast('⚡ Showing classrooms vacant right now!');
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

      if (code.includes(q) || codeNoSpace.includes(qNoSpace) || name.includes(q) || cat.includes(q)) return true;

      const isClassroom = /^r\d+$/i.test(room.code);
      if (['r', 'room', 'rooms', 'classroom', 'classrooms', 'lecture'].includes(q) && isClassroom) return true;
      const rNumMatch = qNoSpace.match(/^r(?:oom)?(\d+)$/);
      if (rNumMatch && isClassroom) return codeNoSpace === `r${rNumMatch[1]}`;

      const isPB = /^pb\d*$/i.test(room.code);
      if (['pb', 'bungalow', 'principal bungalow', 'principalbungalow'].includes(q) && isPB) return true;
      const pbNumMatch = qNoSpace.match(/^pb(\d+)$/);
      if (pbNumMatch && isPB) return codeNoSpace === `pb${pbNumMatch[1]}`;

      const isTut = room.code.startsWith('T') && !room.code.startsWith('PB');
      if (['t', 'tut', 'tutorial', 'tutorials'].includes(q) && isTut) return true;
      const tNumMatch = qNoSpace.match(/^t(?:ut)?(?:orial)?(\d+)$/);
      if (tNumMatch && isTut) return codeNoSpace === `t${tNumMatch[1]}`;

      const isSCR = room.code.startsWith('SCR');
      if (['scr', 'sport', 'sports', 'sports complex'].includes(q) && isSCR) return true;
      const scrNumMatch = qNoSpace.match(/^scr(\d+)$/);
      if (scrNumMatch && isSCR) return codeNoSpace === `scr${scrNumMatch[1]}`;

      const isCL = room.code.startsWith('CL');
      if (['cl', 'lab', 'labs', 'computer', 'computer lab'].includes(q) && isCL) return true;
      const clNumMatch = qNoSpace.match(/^cl(?:ab)?(\d+)$/);
      if (clNumMatch && isCL) return codeNoSpace === `cl${clNumMatch[1]}`;

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

    function openShareModal(roomCode) {
      const room = appData.rooms.find(r => r.code === roomCode);
      if (!room) return;

      const sched = room.schedule[state.activeDay] || { free_slots: [] };
      const freeSlotsList = sched.free_slots.length > 0
        ? sched.free_slots.map(s => `  • ${s.replace(' to ', ' – ')}`).join('\\n')
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

        const effectiveFreeHours = sched.free_hours + bonusFreeSlots.length;
        let cardStyleClass = 'is-booked';
        if (effectiveFreeHours >= 5) cardStyleClass = 'has-many-free';
        else if (effectiveFreeHours > 0) cardStyleClass = 'has-some-free';

        const themeClass = getCategoryThemeClass(room);

        // Calculate consecutive free windows (continuous periods)
        const consecutiveWindows = getConsecutiveFreeWindows(sched.free_slots, bonusFreeSlots);
        let consecutiveChipsHtml = '';
        if (effectiveFreeHours === 9) {
          consecutiveChipsHtml = `<div class="consecutive-window-chip" title="Full Day Uninterrupted Free Window">⚡ ★ 8:30 AM – 6:00 PM (Full Day Continuous)</div>`;
        } else if (consecutiveWindows.length > 0 && effectiveFreeHours >= 2) {
          const multiPeriodWindows = consecutiveWindows.filter(w => w.periodsCount >= 2);
          if (multiPeriodWindows.length > 0) {
            consecutiveChipsHtml = multiPeriodWindows.map(w =>
              `<div class="consecutive-window-chip" title="Continuous uninterrupted free window">⚡ ${escapeHtml(w.text)}</div>`
            ).join('');
          }
        }

        // Format free slot chips
        let chipsHtml = '';
        if (effectiveFreeHours === 9) {
          chipsHtml = `<div class="slot-chip slot-all-free">★ ALL DAY VACANT (8:30 AM – 6:00 PM)</div>`;
        } else if (effectiveFreeHours === 0) {
          chipsHtml = `<div class="slot-chip slot-none">No free periods on this day</div>`;
        } else {
          const regularChips = sched.free_slots.map(slot => {
            const isHighlight = (state.activeSlot !== 'ALL' && state.activeSlot === slot);
            const chipClass = isHighlight ? 'slot-chip slot-highlight' : 'slot-chip slot-free';
            return `<div class="${chipClass}">${escapeHtml(slot.replace(' to ', ' – '))}</div>`;
          }).join('');

          const bonusChips = bonusFreeSlots.map(b => {
            return `<div class="slot-chip" style="background: rgba(168, 85, 247, 0.22); color: #6d28d9; border: 1px solid rgba(168, 85, 247, 0.45);" title="Class cancelled: Prof. ${escapeHtml(b.teacher.clean_name)} on leave">✨ ${escapeHtml(b.slot.replace(' to ', '–'))} (Faculty Leave)</div>`;
          }).join('');

          chipsHtml = regularChips + bonusChips;
        }

        // Timeline strip
        const p1_5 = periodIntervals.slice(0, 5).map(p => {
          let isFree = sched.free_slots.includes(p.slot);
          const hasBonus = bonusFreeSlots.find(b => b.slot === p.slot);
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
          let isFree = sched.free_slots.includes(p.slot);
          const hasBonus = bonusFreeSlots.find(b => b.slot === p.slot);
          if (hasBonus) isFree = true;

          const cls = isFree ? (hasBonus ? 'p-block' : 'p-block free') : 'p-block busy';
          const bonusStyle = hasBonus ? 'background: linear-gradient(135deg, #9333EA, #7C3AED); color: #FFF;' : '';
          const title = hasBonus
            ? `${p.full}: ✨ BONUS FREE (Prof. ${hasBonus.teacher.clean_name} on Leave)`
            : `${p.full}: ${isFree ? 'Vacant for GD' : 'Class in Session'}`;
          return `<div class="${cls}" style="${bonusStyle}" data-room="${room.code}" data-slot="${p.slot}" title="${title}">${p.label}</div>`;
        }).join('');

        const bonusBannerHtml = bonusFreeSlots.length > 0
          ? `<div class="bonus-free-banner">
               <span>✨</span>
               <span><strong>BONUS FREE ROOM:</strong> ${bonusFreeSlots.length} lecture(s) cancelled (Faculty on Leave)</span>
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
                  <div style="font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 4px; letter-spacing: 0.5px;">Continuous Vacant Windows:</div>
                  <div style="display: flex; flex-direction: column; gap: 4px;">
                    ${consecutiveChipsHtml}
                  </div>
                </div>
              ` : ''}

              <div class="slots-chips-title">Free Timings for GD:</div>
              <div class="slots-chips-container room-free-list">
                ${chipsHtml}
              </div>
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
      cleaned = cleaned.replace(/([A-Za-z0-9\.\)])(?=LAB[- ]\d+|TUTE[- ]\d+|BATCH[- ]\d+)/gi, '$1\\n');

      const lines = cleaned.split('\\n').map(l => l.trim()).filter(Boolean);
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

      const rowsHtml = allSlots.map((timeSlot) => {
        if (timeSlot === '1:30 PM to 2:00 PM') {
          return `
            <tr>
              <td><strong>1:30 PM – 2:00 PM</strong></td>
              <td><span class="badge-slot-recess">☕ LUNCH RECESS</span></td>
              <td>College-wide recess. Room is vacant & open for peer discussions.</td>
            </tr>
          `;
        }

        const isFree = sched.free_slots.includes(timeSlot);
        const occupiedObj = sched.occupied_slots.find(o => o.slot === timeSlot);
        const leaveInfo = getRoomScheduledTeacherLeave(room.code, state.activeDay, timeSlot);

        if (leaveInfo) {
          return `
            <tr style="background: rgba(168, 85, 247, 0.08);">
              <td><strong>${timeSlot.replace(' to ', ' – ')}</strong></td>
              <td><span class="badge-slot-leave">✨ BONUS FREE (LEAVE)</span></td>
              <td>
                <strong style="color: #6d28d9;">Class Cancelled:</strong> Prof. <strong>${leaveInfo.teacher.clean_name}</strong> (${leaveInfo.teacher.short_code || ''}) is on leave. Room is open for study!
                <div style="font-size: 0.76rem; color: var(--text-muted); margin-top: 2px;">Scheduled: ${formatClassDetails(occupiedObj ? occupiedObj.class : '')}</div>
              </td>
            </tr>
          `;
        } else if (isFree) {
          return `
            <tr>
              <td><strong>${timeSlot.replace(' to ', ' – ')}</strong></td>
              <td><span class="badge-slot-free">FREE FOR GD</span></td>
              <td style="color: var(--accent-green-light);">Vacant Classroom (Available for Study/GD)</td>
            </tr>
          `;
        } else {
          const classDesc = occupiedObj ? occupiedObj.class : 'Scheduled Class';
          return `
            <tr>
              <td><strong>${timeSlot.replace(' to ', ' – ')}</strong></td>
              <td><span class="badge-slot-occupied">CLASS IN SESSION</span></td>
              <td>${formatClassDetails(classDesc)}</td>
            </tr>
          `;
        }
      }).join('');

      if (modalBody) {
        modalBody.innerHTML = `
          <table class="schedule-table">
            <thead>
              <tr>
                <th style="width: 25%;">Period / Time</th>
                <th style="width: 25%;">Status</th>
                <th style="width: 50%;">Class Details / Availability</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
          <p class="modal-disclaimer-note">ℹ️ <strong>Timetable Vacancy Notice:</strong> Based on official SRCC published schedule. Physical vacancy may vary for student societies, seminars, or exam arrangements.</p>
        `;
      }

      if (scheduleModal) openAppModal(scheduleModal);
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
        return {
          type: 'LEAVE',
          badgeClass: 'status-leave',
          dotClass: 'dot-leave',
          text: `🏖️ On Leave: ${leave.reason || 'Class Cancelled'} (${leave.start_date || ''} – ${leave.end_date || ''})`,
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
      const allLeaves = getLeavesList();
      const todayDate = getTodayIsoDate();
      const activeToday = allLeaves.filter(l => {
        if (!l.start_date && !l.end_date) return true;
        const s = l.start_date || '2000-01-01';
        const e = l.end_date || '2099-12-31';
        return (todayDate >= s && todayDate <= e);
      });

      const buildBannerHtml = (context) => {
        if (activeToday.length === 0) return '';
        let count = activeToday.length;
        if (typeof teachersData !== 'undefined' && teachersData && teachersData.teachers) {
          count = teachersData.teachers.filter(t => isTeacherOnLeave(t, todayDate)).length;
        }
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
        if (activeToday.length > 0) {
          activeLeavesRoomBanner.innerHTML = buildBannerHtml('rooms');
          activeLeavesRoomBanner.style.display = 'flex';
          activeLeavesRoomBanner.onclick = openFacultyLeavesView;
        } else {
          activeLeavesRoomBanner.style.display = 'none';
        }
      }

      if (activeLeavesFacultyBanner) {
        if (activeToday.length > 0) {
          activeLeavesFacultyBanner.innerHTML = buildBannerHtml('faculty');
          activeLeavesFacultyBanner.style.display = 'flex';
          activeLeavesFacultyBanner.onclick = openFacultyLeavesView;
        } else {
          activeLeavesFacultyBanner.style.display = 'none';
        }
      }

      if (headerLeavePill) {
        if (activeToday.length > 0) {
          headerLeavePill.textContent = `${activeToday.length} on leave • View`;
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
        roomsQuickLeaveCount.textContent = activeToday.length > 0
          ? `${activeToday.length} on leave`
          : '0 on leave';
        roomsQuickLeaveCount.style.background = activeToday.length > 0 ? '#E11D48' : 'rgba(255, 255, 255, 0.15)';
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

        // Subject Badges with Active Highlight
        const subjectsHtml = (teacher.subjects && teacher.subjects.length > 0)
          ? `<div class="faculty-subjects-row">
              <span class="subjects-label">📚 Subjects:</span>
              ${teacher.subjects.map(s => {
                const isActive = (facultyState.searchQuery && facultyState.searchQuery.toLowerCase() === s.toLowerCase());
                return `<span class="subject-pill ${isActive ? 'active-filter' : ''}" data-subject="${escapeHtml(s)}" title="${isActive ? 'Click to clear filter' : 'Filter by ' + escapeHtml(s)}">${escapeHtml(s)}${isActive ? ' ✕' : ''}</span>`;
              }).join('')}
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
                  <button class="room-badge-link" data-room="${roomCode}" title="Jump to Room ${roomCode} in Free Classroom Finder">
                    🏛️ ${roomCode} ↗
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
          if (btnClearSearch) btnClearSearch.style.display = 'block';
          render();
          setTimeout(() => {
            openScheduleModal(targetRoom);
          }, 150);
        });
      });
    }

    // ========================================================================
    // 📅 TEACHER WEEKLY TIMETABLE MODAL (RESPONSIVE DESKTOP TABLE & MOBILE CARDS)
    // ========================================================================
    function openTeacherModal(teacherId) {
      if (!teachersData || !teachersData.teachers) return;
      const teacher = teachersData.teachers.find(t => String(t.id) === String(teacherId));
      if (!teacher) return;

      facultyState.modalActiveTeacher = teacher;
      facultyState.modalActiveDay = facultyState.activeDay;

      const initials = teacher.initials || teacher.clean_name.slice(0, 2).toUpperCase();
      const deptAvatarCls = getDeptAvatarClass(teacher.department);
      const displayCode = getDisplayShortCode(teacher);

      if (modalTeacherAvatar) {
        modalTeacherAvatar.className = `faculty-initials-avatar ${deptAvatarCls}`;
        modalTeacherAvatar.textContent = initials;
      }
      if (modalTeacherName) modalTeacherName.textContent = teacher.clean_name;
      if (modalTeacherMeta) {
        modalTeacherMeta.textContent = `${teacher.department} · Short Code: ${displayCode || 'Official Faculty'} · ${teacher.total_teaching_periods || 0} Total Weekly Classes`;
      }

      renderTeacherModalDaySchedule();
      if (teacherModal) openAppModal(teacherModal);
    }

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

      if (daySched.length === 0) {
        modalTeacherBody.innerHTML = `
          <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
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
        const subjCode = cls.subject || '';
        const courseName = cls.course || 'B.Com (Hons)';
        const sem = cls.semester || '';
        const sec = cls.section || '';
        const batch = cls.batch || '';

        return `
          <tr>
            <td style="white-space: nowrap;"><strong>${escapeHtml(cls.slot ? cls.slot.replace(' to ', ' – ') : 'Period')}</strong></td>
            <td><span class="badge-slot-occupied">${escapeHtml(cls.type || 'Lecture')}</span></td>
            <td>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 2px;">
                ${subjCode ? `<span class="subject-pill" style="font-size: 0.76rem; padding: 2px 7px;">${escapeHtml(subjCode)}</span>` : ''}
                <strong style="color: var(--text-primary); font-size: 0.88rem;">${escapeHtml(courseName)}</strong>
                ${sem ? `<span class="class-batch-badge" style="color: #0369a1; border-color: rgba(56, 189, 248, 0.3);">${escapeHtml(sem)}</span>` : ''}
              </div>
              ${(sec || batch) ? `
                <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 3px;">
                  ${sec ? `<span class="class-batch-badge">${escapeHtml(sec)}</span>` : ''}
                  ${batch ? `<span class="class-batch-badge" style="color: var(--srcc-gold); border-color: rgba(252, 235, 10, 0.3);">Batch ${escapeHtml(batch)}</span>` : ''}
                </div>
              ` : ''}
            </td>
            <td>
              ${roomCode !== 'TBD' ? `
                <button class="room-badge-link modal-room-jump" data-room="${escapeHtml(roomCode)}" title="View room vacancy in Free Classroom Finder">
                  🏛️ ${escapeHtml(roomCode)} ↗
                </button>
              ` : `<span style="color: var(--text-muted); font-size: 0.78rem;">TBD</span>`}
            </td>
          </tr>
        `;
      }).join('');

      // 2. Mobile Schedule Cards (<= 640px)
      const mobileCards = daySched.map(cls => {
        const roomCode = cls.room ? cls.room.trim() : 'TBD';
        const subjCode = cls.subject || '';
        const courseName = cls.course || 'B.Com (Hons)';
        const sem = cls.semester || '';
        const sec = cls.section || '';
        const batch = cls.batch || '';

        return `
          <div class="modal-timetable-card">
            <div class="m-tt-header">
              <div class="m-tt-slot">
                <span>🕒</span>
                <span>${escapeHtml(cls.slot ? cls.slot.replace(' to ', ' – ') : 'Period')}</span>
              </div>
              <span class="m-tt-type">${escapeHtml(cls.type || 'Lecture')}</span>
            </div>
            <div class="m-tt-course-row">
              ${subjCode ? `<span class="m-tt-subject">${escapeHtml(subjCode)}</span>` : ''}
              <span class="m-tt-coursename">${escapeHtml(courseName)}</span>
              ${sem ? `<span class="class-batch-badge" style="color: #0369a1; border-color: rgba(56, 189, 248, 0.3); font-size: 0.74rem;">${escapeHtml(sem)}</span>` : ''}
            </div>
            <div class="m-tt-meta-row">
              <div class="m-tt-section-batch">
                ${sec ? `<span>Sec: <strong>${escapeHtml(sec)}</strong></span>` : ''}
                ${(sec && batch) ? `<span>•</span>` : ''}
                ${batch ? `<span style="color: var(--srcc-gold);">Batch ${escapeHtml(batch)}</span>` : ''}
                ${(!sec && !batch) ? `<span style="color: var(--text-muted);">Whole Class</span>` : ''}
              </div>
              <div>
                ${roomCode !== 'TBD' ? `
                  <button class="m-tt-room-btn modal-room-jump" data-room="${escapeHtml(roomCode)}" title="View room in Free Classroom Finder">
                    🏛️ ${escapeHtml(roomCode)} ↗
                  </button>
                ` : `<span style="color: var(--text-muted); font-size: 0.78rem;">TBD</span>`}
              </div>
            </div>
          </div>
        `;
      }).join('');

      modalTeacherBody.innerHTML = `
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
          if (searchInput) searchInput.value = rCode;
          state.searchQuery = rCode;
          state.activeCategory = 'ALL';
          render();
          setTimeout(() => openScheduleModal(rCode), 100);
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

    function renderActiveLeavesList() {
      if (!leavesListContainer) return;
      const leaves = getLeavesList();

      if (activeLeavesCount) activeLeavesCount.textContent = leaves.length;

      if (leaves.length === 0) {
        leavesListContainer.innerHTML = `
          <div class="leaves-empty-msg">
            No professors are currently marked on leave. Add a leave above to cancel their classes and automatically unlock their rooms for GD!
          </div>
        `;
        return;
      }

      leavesListContainer.innerHTML = leaves.map(leave => {
        const code = leave.teacher_code && !/^(cg|eg|mg|hg|hgc)\d*$/i.test(leave.teacher_code) ? ` (${leave.teacher_code})` : '';
        return `
          <div class="leave-item-row" data-leave-id="${leave.id}">
            <div class="leave-item-details">
              <span class="leave-item-teacher">👨‍🏫 ${escapeHtml(leave.teacher_name)}${code}</span>
              <span class="leave-item-dates">🗓️ ${leave.start_date || 'Today'} to ${leave.end_date || 'Today'} · ${leave.department || ''}</span>
              ${leave.reason ? `<span class="leave-item-reason">"${escapeHtml(leave.reason)}"</span>` : ''}
            </div>
            <button class="btn-delete-leave" data-leave-id="${leave.id}" title="Remove leave and restore scheduled classes">
              ✕ Remove
            </button>
          </div>
        `;
      }).join('');

      leavesListContainer.querySelectorAll('.btn-delete-leave').forEach(btn => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.leaveId;
          const current = getLeavesList();
          const updated = current.filter(l => l.id !== id);
          saveLeavesList(updated);
          renderActiveLeavesList();
          renderFaculty();
          render();
          showToast('🗑️ Faculty leave removed. Timetable classes restored!');
        });
      });
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
    window._openTeacherTimetable = function(teacherId) {
      if (typeof openTeacherModal === 'function') {
        openTeacherModal(teacherId);
      }
    };

    // ========================================================================
    // 🚀 INITIAL BOOTSTRAP
    // ========================================================================
    populateLeaveTeacherSelect();
    render();
    renderFaculty();
  }
});
// --- PWA Installation Logic ---
let deferredPrompt;
const installModal = document.getElementById('pwaInstallModal');
const btnInstallApp = document.getElementById('btnInstallApp');
const btnCloseInstall = document.getElementById('btnCloseInstall');
const btnNotNowInstall = document.getElementById('btnNotNowInstall');

// Register Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('SW registered: ', registration);
    }).catch(registrationError => {
      console.log('SW registration failed: ', registrationError);
    });
  });
}

// Catch the install prompt event
window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent Chrome from automatically showing the prompt
  e.preventDefault();
  // Stash the event so it can be triggered later.
  deferredPrompt = e;
  
  // Do not auto-popup on localhost or if user dismissed it in this session
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (isLocal || sessionStorage.getItem('pwa_dismissed')) {
    return;
  }

  // Show the modal after a short delay (3 seconds) to not interrupt immediate reading
  setTimeout(() => {
    if (installModal && !sessionStorage.getItem('pwa_dismissed')) {
      installModal.style.display = 'flex';
    }
  }, 3000);
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
btnInstallApp.addEventListener('click', async () => {
  if (deferredPrompt) {
    installModal.style.display = 'none';
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    // We've used the prompt, and can't use it again, throw it away
    deferredPrompt = null;
  }
});

// Hide modal if successfully installed
window.addEventListener('appinstalled', () => {
  installModal.style.display = 'none';
  deferredPrompt = null;
  console.log('PWA was installed');
});
