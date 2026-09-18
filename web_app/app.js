/**
 * SRCC Free Classroom Finder & Faculty Locator - Core Application Logic
 * Integrates 96 Classrooms and 210 Faculty Members from Shri Ram College of Commerce
 */

// ==========================================================================
// 🔗 SRCC WHATSAPP COMMUNITY / GROUP LINK CONFIGURATION
// 👉 UPDATE YOUR ACTIVE WHATSAPP GROUP INVITE LINK HERE:
// ==========================================================================
const SRCC_WHATSAPP_LINK = 'https://chat.whatsapp.com/G0VT9qsCLEe5Qqy8b7VCvp';

document.addEventListener('DOMContentLoaded', () => {
  let appData = window.SRCC_DATA;
  let teachersData = window.SRCC_TEACHERS_DATA;
  let leavesData = window.SRCC_FACULTY_LEAVES;

  const loadPromises = [];
  if (!appData) {
    loadPromises.push(
      fetch('srcc_data.json')
        .then(r => r.json())
        .then(d => { appData = d; })
        .catch(err => console.error('Failed to fetch srcc_data.json:', err))
    );
  }
  if (!teachersData) {
    loadPromises.push(
      fetch('teachers_data.json')
        .then(r => r.json())
        .then(d => { teachersData = d; })
        .catch(err => {
          console.warn('Failed to fetch teachers_data.json:', err);
          teachersData = { teachers: [] };
        })
    );
  }
  if (!leavesData) {
    loadPromises.push(
      fetch('faculty_leaves.json')
        .then(r => r.json())
        .then(d => { leavesData = d; })
        .catch(err => {
          console.warn('Failed to fetch faculty_leaves.json:', err);
          leavesData = { leaves: [] };
        })
    );
  }

  // ☁️ Live Cloud Database Fetch (100% Free Firebase Realtime DB)
  const cloudDbUrl = (window.SRCC_CLOUD_CONFIG && window.SRCC_CLOUD_CONFIG.db_url) || localStorage.getItem('srcc_cloud_db_url');
  if (cloudDbUrl) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    loadPromises.push(
      fetch(cloudDbUrl, { signal: controller.signal, cache: 'no-cache' })
        .then(r => {
          clearTimeout(timeoutId);
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then(d => {
          if (d) {
            if (Array.isArray(d.leaves)) {
              leavesData = d;
            } else if (Array.isArray(d)) {
              leavesData = { leaves: d, last_updated: 'Live Cloud' };
            }
          }
        })
        .catch(err => {
          clearTimeout(timeoutId);
          console.warn('Live Cloud Sync fetch timed out or failed, using local fallback:', err);
        })
    );
  }

  if (loadPromises.length > 0) {
    Promise.all(loadPromises)
      .then(() => initApp())
      .catch(err => {
        console.error('Initialization error:', err);
        if (appData) initApp();
      });
  } else {
    initApp();
  }

  function initApp() {
    if (!appData || !appData.rooms) {
      console.error('Timetable data is empty.');
      return;
    }

    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayIndex = new Date().getDay();
    const todayName = daysOfWeek[todayIndex];
    const initialDay = (todayName === 'Sunday') ? 'Monday' : todayName;

    // Standard local date string YYYY-MM-DD
    function getTodayIsoDate() {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // ========================================================================
    // 🏖️ FACULTY LEAVE MANAGEMENT STORAGE & HELPERS
    // ========================================================================
    const LEAVES_STORAGE_KEY = 'srcc_faculty_leaves_v2';

    function getLeavesList() {
      // Prioritize authoritative leaves from Cloud DB or faculty_leaves.js
      if (leavesData && Array.isArray(leavesData.leaves)) {
        return [...leavesData.leaves];
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
    const modeFacultyCount = document.getElementById('modeFacultyCount');

    // DOM Elements - Room Controls
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
    const modalTeacherDayTabs = document.querySelectorAll('#modalTeacherDayTabs .day-btn');
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
    // 🕒 LIVE CLOCK UPDATE
    // ========================================================================
    function updateLiveClock() {
      const now = new Date();
      const options = { weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true };
      const timeStr = now.toLocaleTimeString([], options);
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
    // 🔀 DUAL MODE SWITCHING (ROOMS ⇄ FACULTY)
    // ========================================================================
    function setAppMode(mode, preserveFilters = false) {
      state.activeMode = mode;

      const isRooms = (mode === 'rooms');
      if (tabModeRooms) {
        tabModeRooms.classList.toggle('active', isRooms);
        tabModeRooms.setAttribute('aria-selected', isRooms ? 'true' : 'false');
      }
      if (tabModeFaculty) {
        tabModeFaculty.classList.toggle('active', !isRooms);
        tabModeFaculty.setAttribute('aria-selected', !isRooms ? 'true' : 'false');
      }

      if (viewRoomsSection) viewRoomsSection.style.display = isRooms ? 'block' : 'none';
      if (viewFacultySection) viewFacultySection.style.display = !isRooms ? 'block' : 'none';

      // Update mobile bottom nav
      if (bnavRooms) bnavRooms.classList.toggle('active', isRooms);
      if (bnavFaculty) bnavFaculty.classList.toggle('active', !isRooms);

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
        if (facultySearchInput) facultySearchInput.value = '';
        if (btnClearFacultySearch) btnClearFacultySearch.style.display = 'none';
        if (facultyStatusSelect) facultyStatusSelect.value = 'ALL';
        if (facultySortSelect) facultySortSelect.value = 'NAME_ASC';
        if (statFacultyFilterDesc) statFacultyFilterDesc.innerHTML = '';
      }

      if (isRooms) {
        render();
      } else {
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
        showToast(`🏛️ Showing wing: <strong>${titleText}</strong>`);
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

    // Modal Close Handlers
    if (btnModalClose) btnModalClose.addEventListener('click', () => { scheduleModal.style.display = 'none'; });
    if (scheduleModal) {
      scheduleModal.addEventListener('click', (e) => {
        if (e.target === scheduleModal) scheduleModal.style.display = 'none';
      });
    }

    if (btnShareModalClose) btnShareModalClose.addEventListener('click', () => { shareModal.style.display = 'none'; });
    if (shareModal) {
      shareModal.addEventListener('click', (e) => {
        if (e.target === shareModal) shareModal.style.display = 'none';
      });
    }

    if (btnTeacherModalClose) btnTeacherModalClose.addEventListener('click', () => { teacherModal.style.display = 'none'; });
    if (teacherModal) {
      teacherModal.addEventListener('click', (e) => {
        if (e.target === teacherModal) teacherModal.style.display = 'none';
      });
    }

    if (btnLeaveModalClose) btnLeaveModalClose.addEventListener('click', () => { leaveManagerModal.style.display = 'none'; });
    if (leaveManagerModal) {
      leaveManagerModal.addEventListener('click', (e) => {
        if (e.target === leaveManagerModal) leaveManagerModal.style.display = 'none';
      });
    }

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (scheduleModal && scheduleModal.style.display !== 'none') scheduleModal.style.display = 'none';
        else if (shareModal && shareModal.style.display !== 'none') shareModal.style.display = 'none';
        else if (teacherModal && teacherModal.style.display !== 'none') teacherModal.style.display = 'none';
        else if (leaveManagerModal && leaveManagerModal.style.display !== 'none') leaveManagerModal.style.display = 'none';
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

    // Calculate calendar date for any day of the current academic week
    function getDateForDay(targetDayName) {
      const daysMap = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };
      const now = new Date();
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

      const siteUrl = 'https://srcc-classroom-finder.netlify.app/';
      const activeDateStr = getDateForDay(state.activeDay);
      const dayAndDateDisplay = `${state.activeDay}, ${activeDateStr}`;

      const cleanMessage = `🎓 SRCC Classroom Vacancy Alert\n\n` +
        `📍 Room: ${room.code} (${room.name})\n` +
        `🏛️ Wing: ${room.category.split(' (')[0]}\n` +
        `📅 Day & Date: ${dayAndDateDisplay}\n` +
        `👥 Capacity: ${room.capacity} seats\n` +
        `☕ Lunch Recess: 1:30 PM – 2:00 PM (Vacant)\n\n` +
        `🕒 Free Academic Slots:\n${freeSlotsList}\n\n` +
        `🔍 Live Timetable & Vacancy Tracker: ${siteUrl}`;

      const whatsappMessage = `🎓 *SRCC Classroom Vacancy Alert*\n\n` +
        `📍 *Room:* ${room.code} (${room.name})\n` +
        `🏛️ *Wing:* ${room.category.split(' (')[0]}\n` +
        `📅 *Day & Date:* ${dayAndDateDisplay}\n` +
        `👥 *Capacity:* ${room.capacity} seats\n` +
        `☕ *Lunch Recess:* 1:30 PM – 2:00 PM (Vacant)\n\n` +
        `🕒 *Free Academic Slots:*\n${freeSlotsList}\n\n` +
        `🔍 *Live Timetable & Vacancy Tracker:* ${siteUrl}`;

      const tweetText = `🎓 SRCC Vacancy: Room ${room.code} is FREE on ${dayAndDateDisplay}!\n🕒 Check live timetable:`;
      const emailSubject = `SRCC Room Vacancy: ${room.code} (${dayAndDateDisplay})`;

      currentShareMessage = cleanMessage;

      copyToClipboard(cleanMessage)
        .then(() => showToast(`📋 Room details for <strong>${room.code}</strong> copied to clipboard!`, true, 3500))
        .catch(() => showToast(`📤 Share Room <strong>${room.code}</strong>`, false, 2500));

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
            navigator.share({ title: `SRCC Room ${room.code} Vacancy`, text: cleanMessage, url: siteUrl }).catch(() => {});
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
            navigator.share({ title: `SRCC Room ${room.code} Vacancy`, text: cleanMessage, url: siteUrl }).catch(() => {});
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
            navigator.share({ title: `SRCC Room ${room.code} Vacancy`, text: cleanMessage, url: siteUrl }).catch(() => {});
          } else {
            copyToClipboard(cleanMessage);
            window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, '_blank', 'noopener,noreferrer');
          }
        };
      }

      if (navigator.share && btnPrimaryShare) {
        btnPrimaryShare.style.display = 'flex';
        btnPrimaryShare.onclick = () => {
          navigator.share({ title: `SRCC Room ${room.code} Vacancy`, text: cleanMessage, url: siteUrl }).catch(() => {});
        };
      } else if (btnPrimaryShare) {
        btnPrimaryShare.style.display = 'none';
      }

      if (shareModal) shareModal.style.display = 'flex';
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
            return `<div class="${chipClass}">${slot.replace(' to ', ' – ')}</div>`;
          }).join('');

          const bonusChips = bonusFreeSlots.map(b => {
            return `<div class="slot-chip" style="background: rgba(168, 85, 247, 0.22); color: #E9D5FF; border: 1px solid rgba(168, 85, 247, 0.45);" title="Class cancelled: Prof. ${b.teacher.clean_name} on leave">✨ ${b.slot.replace(' to ', '–')} (Faculty Leave)</div>`;
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
          <article class="room-card ${cardStyleClass} ${themeClass}" data-room-code="${room.code}">
            <div class="card-header room-card-header">
              <div class="card-title-group">
                <div class="card-room-code">${room.code}</div>
                <div class="card-room-name">${room.name}</div>
              </div>
              <div class="card-meta-badges">
                <span class="badge-category ${catBadgeClass}">${room.category.split(' (')[0]}</span>
                <span class="badge-capacity">${room.capacity} Seats</span>
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

              <div class="slots-chips-title">Free Timings for GD:</div>
              <div class="slots-chips-container room-free-list">
                ${chipsHtml}
              </div>
            </div>

            <div class="card-actions room-card-actions">
              <button class="btn-share-room" data-room="${room.code}" title="Share room vacancy on WhatsApp, LinkedIn, Facebook, Instagram">
                📤 Share Room
              </button>
              <button class="btn-view-schedule" data-room="${room.code}">
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
                <strong style="color: #E9D5FF;">Class Cancelled:</strong> Prof. <strong>${leaveInfo.teacher.clean_name}</strong> (${leaveInfo.teacher.short_code || ''}) is on leave. Room is open for study!
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
        `;
      }

      if (scheduleModal) scheduleModal.style.display = 'flex';
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

    // Department Filter Pills (Resets statusFilter & search query so all teachers of selected dept are shown!)
    facultyDeptPills.forEach(pill => {
      pill.addEventListener('click', () => {
        facultyState.activeDept = pill.dataset.dept;
        facultyDeptPills.forEach(p => p.classList.toggle('active', p.dataset.dept === facultyState.activeDept));

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
        if (facultySearchInput) facultySearchInput.value = '';
        if (btnClearFacultySearch) btnClearFacultySearch.style.display = 'none';
        if (facultyStatusSelect) facultyStatusSelect.value = 'ALL';
        if (facultySortSelect) facultySortSelect.value = 'NAME_ASC';

        renderFaculty();
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
          text: `📅 ${daySched.length} Lecture(s) Scheduled on ${facultyState.activeDay}`,
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
        const count = activeToday.length;
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

      const handleLeaveBannerClick = () => {
        setAppMode('faculty', true);
        facultyState.activeDept = 'ALL';
        facultyState.statusFilter = 'ON_LEAVE';
        facultyDeptPills.forEach(p => p.classList.toggle('active', p.dataset.dept === 'ALL'));
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
        showToast(`🏖️ Showing <strong>${activeToday.length} ${activeToday.length === 1 ? 'professor' : 'professors'}</strong> currently on leave today.`);
      };

      if (activeLeavesRoomBanner) {
        if (activeToday.length > 0) {
          activeLeavesRoomBanner.innerHTML = buildBannerHtml('rooms');
          activeLeavesRoomBanner.style.display = 'flex';
          activeLeavesRoomBanner.onclick = handleLeaveBannerClick;
        } else {
          activeLeavesRoomBanner.style.display = 'none';
        }
      }

      if (activeLeavesFacultyBanner) {
        if (activeToday.length > 0) {
          activeLeavesFacultyBanner.innerHTML = buildBannerHtml('faculty');
          activeLeavesFacultyBanner.style.display = 'flex';
          activeLeavesFacultyBanner.onclick = handleLeaveBannerClick;
        } else {
          activeLeavesFacultyBanner.style.display = 'none';
        }
      }

      if (headerLeavePill) {
        if (activeToday.length > 0) {
          headerLeavePill.textContent = `${activeToday.length} on leave • View`;
          headerLeavePill.style.display = 'inline-block';
          headerLeavePill.onclick = handleLeaveBannerClick;
        } else {
          headerLeavePill.style.display = 'none';
        }
      }
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

      // Case-insensitive match on name, label, short code, ref code, department
      if (name.includes(q) || label.includes(q) || code.includes(q) || refCode.includes(q) || dept.includes(q)) return true;

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

      // Sorting
      list.sort((a, b) => {
        const daySchedA = (a.schedule && a.schedule[facultyState.activeDay]) ? a.schedule[facultyState.activeDay].length : 0;
        const daySchedB = (b.schedule && b.schedule[facultyState.activeDay]) ? b.schedule[facultyState.activeDay].length : 0;

        if (facultyState.sortBy === 'NAME_ASC') {
          return (a.clean_name || '').localeCompare(b.clean_name || '');
        } else if (facultyState.sortBy === 'NAME_DESC') {
          return (b.clean_name || '').localeCompare(a.clean_name || '');
        } else if (facultyState.sortBy === 'CLASSES_DESC') {
          if (daySchedB !== daySchedA) return daySchedB - daySchedA;
          return (a.clean_name || '').localeCompare(b.clean_name || '');
        } else if (facultyState.sortBy === 'DEPT_ASC') {
          const deptComp = (a.department || '').localeCompare(b.department || '');
          if (deptComp !== 0) return deptComp;
          return (a.clean_name || '').localeCompare(b.clean_name || '');
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
          headerLeavePill.textContent = `${leaveCount} on leave`;
          headerLeavePill.style.display = 'inline-block';
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
                  📅 Timetable
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
                📅 Full Weekly Timetable
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
    // 📅 TEACHER WEEKLY TIMETABLE MODAL
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
      if (teacherModal) teacherModal.style.display = 'flex';
    }

    function renderTeacherModalDaySchedule() {
      const teacher = facultyState.modalActiveTeacher;
      if (!teacher) return;

      modalTeacherDayTabs.forEach(tab => {
        tab.classList.toggle('active', tab.dataset.day === facultyState.modalActiveDay);
      });

      const daySched = (teacher.schedule && teacher.schedule[facultyState.modalActiveDay]) || [];

      if (daySched.length === 0) {
        modalTeacherBody.innerHTML = `
          <div style="text-align: center; padding: 40px 20px; color: var(--text-muted);">
            <div style="font-size: 2rem; margin-bottom: 8px;">☕</div>
            <h4 style="color: var(--text-primary); margin-bottom: 4px;">No Classes on ${facultyState.modalActiveDay}</h4>
            <p style="font-size: 0.85rem;">Prof. ${teacher.clean_name} has no scheduled lectures or tutorials on this day.</p>
          </div>
        `;
        return;
      }

      const rows = daySched.map(cls => {
        const roomCode = cls.room ? cls.room.trim() : 'TBD';
        const subjCode = cls.subject || '';
        const courseName = cls.course || 'B.Com (Hons)';
        const sem = cls.semester || '';
        const sec = cls.section || '';
        const batch = cls.batch || '';

        return `
          <tr>
            <td style="white-space: nowrap;"><strong>${cls.slot ? cls.slot.replace(' to ', ' – ') : 'Period'}</strong></td>
            <td><span class="badge-slot-occupied">${escapeHtml(cls.type || 'Lecture')}</span></td>
            <td>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 2px;">
                ${subjCode ? `<span class="subject-pill" style="font-size: 0.76rem; padding: 2px 7px;">${escapeHtml(subjCode)}</span>` : ''}
                <strong style="color: var(--text-primary); font-size: 0.88rem;">${escapeHtml(courseName)}</strong>
                ${sem ? `<span class="class-batch-badge" style="color: #38BDF8; border-color: rgba(56, 189, 248, 0.3);">${escapeHtml(sem)}</span>` : ''}
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
                <button class="room-badge-link modal-room-jump" data-room="${roomCode}" title="View room vacancy in Free Classroom Finder">
                  🏛️ ${roomCode} ↗
                </button>
              ` : `<span style="color: var(--text-muted); font-size: 0.78rem;">TBD</span>`}
            </td>
          </tr>
        `;
      }).join('');

      modalTeacherBody.innerHTML = `
        <table class="schedule-table">
          <thead>
            <tr>
              <th style="width: 25%;">Time Slot</th>
              <th style="width: 15%;">Type</th>
              <th style="width: 45%;">Subject & Course</th>
              <th style="width: 15%;">Room</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
        </table>
      `;

      modalTeacherBody.querySelectorAll('.modal-room-jump').forEach(btn => {
        btn.addEventListener('click', () => {
          const rCode = btn.dataset.room;
          if (teacherModal) teacherModal.style.display = 'none';
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
              <span class="leave-item-dates">📅 ${leave.start_date || 'Today'} to ${leave.end_date || 'Today'} · ${leave.department || ''}</span>
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

        showToast(`🏖️ Marked <strong>${teacher.clean_name}</strong> on leave! Scheduled rooms are now unlocked.`);
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
        showToast('💾 <strong>faculty_leaves.js downloaded!</strong> Replace this file in your project or Netlify upload to sync for all students.', true, 4000);
      });
    }

    if (btnCopyLeavesJs) {
      btnCopyLeavesJs.addEventListener('click', () => {
        const leaves = getLeavesList();
        const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        const content = `window.SRCC_FACULTY_LEAVES = {\n  "last_updated": "${todayStr}",\n  "leaves": ${JSON.stringify(leaves, null, 2)}\n};\n`;
        copyToClipboard(content).then(() => {
          btnCopyLeavesJs.textContent = '✅ Copied!';
          showToast('📋 <strong>Leaves code copied to clipboard!</strong> Ready to paste into faculty_leaves.js.', true, 3500);
          setTimeout(() => { btnCopyLeavesJs.textContent = '📋 Copy Code'; }, 2500);
        });
      });
    }

    // ========================================================================
    // 🚀 INITIAL BOOTSTRAP
    // ========================================================================
    populateLeaveTeacherSelect();
    render();
    renderFaculty();
  }
});
