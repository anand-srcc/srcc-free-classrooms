/**
 * SRCC Free Classroom Finder - Core Application Logic (Modern Staging Preview)
 */

document.addEventListener('DOMContentLoaded', () => {
  let appData = window.SRCC_DATA;

  // Fallback to fetch if window.SRCC_DATA is not populated
  if (!appData) {
    fetch('srcc_data.json')
      .then(r => r.json())
      .then(data => {
        appData = data;
        initApp();
      })
      .catch(err => {
        console.error('Failed to load timetable data:', err);
        document.getElementById('roomsGrid').innerHTML = `
          <div class="empty-state">
            <h3>Error loading timetable data</h3>
            <p>Please make sure data.js or srcc_data.json is accessible.</p>
          </div>
        `;
      });
  } else {
    initApp();
  }

  function initApp() {
    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const todayIndex = new Date().getDay();
    const todayName = daysOfWeek[todayIndex];
    const initialDay = (todayName === 'Sunday') ? 'Monday' : todayName;

    // Reactive State
    const state = {
      activeDay: initialDay,
      activeCategory: 'ALL',
      activeSlot: 'ALL',
      searchQuery: '',
      freeNowActive: false,
      sortBy: 'ROOM_ASC',
      viewMode: 'grid', // 'grid' | 'compact'
      currentLiveSlot: null
    };

    // DOM Elements - Controls
    const dayButtons = document.querySelectorAll('.day-btn');
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

    // Live Metrics
    const metricVacantNowCount = document.getElementById('metricVacantNowCount');
    const metricTotalFreeCount = document.getElementById('metricTotalFreeCount');
    const metricDayLabel = document.getElementById('metricDayLabel');
    const metricBestCat = document.getElementById('metricBestCat');

    // Stats Ribbon
    const statRoomCount = document.getElementById('statRoomCount');
    const statActiveDay = document.getElementById('statActiveDay');
    const statFilterDesc = document.getElementById('statFilterDesc');
    const statTotalFreeHours = document.getElementById('statTotalFreeHours');

    // Schedule Modal Elements
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
    const btnNativeShare = document.getElementById('btnNativeShare');
    let currentShareMessage = '';
    let currentTweetText = '';
    let currentEmailSubject = '';

    // Mobile Bottom Nav Elements
    const mobileBottomNav = document.getElementById('mobileBottomNav');
    const bnavDay = document.getElementById('bnavDay');
    const bnavDayLabel = document.getElementById('bnavDayLabel');
    const bnavRooms = document.getElementById('bnavRooms');
    const bnavFreeNow = document.getElementById('bnavFreeNow');
    const bnavSearch = document.getElementById('bnavSearch');
    const bnavCommunity = document.getElementById('bnavCommunity');

    // Mobile Day Sheet Elements
    const daySheetOverlay = document.getElementById('daySheetOverlay');
    const btnCloseDaySheet = document.getElementById('btnCloseDaySheet');
    const sheetDayButtons = document.querySelectorAll('.sheet-day-btn');

    // Mobile Wings Sheet Elements
    const wingsSheetOverlay = document.getElementById('wingsSheetOverlay');
    const btnCloseWingsSheet = document.getElementById('btnCloseWingsSheet');
    const sheetWingItems = document.querySelectorAll('.sheet-wing-item');

    // Toast Container
    const toastContainer = document.getElementById('toastContainer');

    // Period timings map for live detection & visual period bar
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

    // Toast Helper
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

    // Live Clock Update
    function updateLiveClock() {
      const now = new Date();
      const options = { weekday: 'short', hour: 'numeric', minute: '2-digit', hour12: true };
      const timeStr = now.toLocaleTimeString([], options);
      
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      // Check lunch recess specifically (1:30 PM - 2:00 PM)
      if (currentMinutes >= 13 * 60 + 30 && currentMinutes < 14 * 60 + 0) {
        state.currentLiveSlot = '1:30 PM to 2:00 PM';
        liveClockText.textContent = `${timeStr} · Lunch Recess (All 96 Rooms Free)`;
        return;
      }

      const matched = periodIntervals.find(p => currentMinutes >= p.start && currentMinutes < p.end);
      if (matched) {
        state.currentLiveSlot = matched.slot;
        liveClockText.textContent = `${timeStr} · ${matched.full}`;
      } else {
        state.currentLiveSlot = null;
        liveClockText.textContent = `${timeStr} · College Off-Hours`;
      }
    }

    updateLiveClock();
    setInterval(updateLiveClock, 30000);

    // Set Active Day Helper
    function setActiveDay(day) {
      state.activeDay = day;
      dayButtons.forEach(b => b.classList.toggle('active', b.dataset.day === day));
      sheetDayButtons.forEach(b => b.classList.toggle('active', b.dataset.day === day));
      if (bnavDayLabel) {
        bnavDayLabel.textContent = day.slice(0, 3);
      }
      render();
    }

    // Set Active Category Helper
    function setActiveCategory(cat) {
      state.activeCategory = cat;
      catPills.forEach(p => p.classList.toggle('active', p.dataset.cat === cat));
      sheetWingItems.forEach(w => w.classList.toggle('active', w.dataset.cat === cat));
      render();
    }

    // Day Picker Buttons (Desktop)
    dayButtons.forEach(btn => {
      if (btn.dataset.day === state.activeDay) btn.classList.add('active');
      btn.addEventListener('click', () => setActiveDay(btn.dataset.day));
    });

    // Mobile Sheet Day Buttons
    sheetDayButtons.forEach(btn => {
      if (btn.dataset.day === state.activeDay) btn.classList.add('active');
      btn.addEventListener('click', () => {
        setActiveDay(btn.dataset.day);
        if (daySheetOverlay) daySheetOverlay.style.display = 'none';
      });
    });

    if (bnavDayLabel) {
      bnavDayLabel.textContent = state.activeDay.slice(0, 3);
    }

    // Mobile Day Bottom Sheet Handlers
    if (bnavDay) {
      bnavDay.addEventListener('click', () => {
        if (daySheetOverlay) daySheetOverlay.style.display = 'flex';
      });
    }

    if (btnCloseDaySheet && daySheetOverlay) {
      btnCloseDaySheet.addEventListener('click', () => {
        daySheetOverlay.style.display = 'none';
      });
      daySheetOverlay.addEventListener('click', (e) => {
        if (e.target === daySheetOverlay) daySheetOverlay.style.display = 'none';
      });
    }

    // Mobile Wings Bottom Sheet Handlers
    if (bnavRooms) {
      bnavRooms.addEventListener('click', () => {
        sheetWingItems.forEach(w => w.classList.toggle('active', w.dataset.cat === state.activeCategory));
        if (wingsSheetOverlay) wingsSheetOverlay.style.display = 'flex';
      });
    }

    if (btnCloseWingsSheet && wingsSheetOverlay) {
      btnCloseWingsSheet.addEventListener('click', () => {
        wingsSheetOverlay.style.display = 'none';
      });
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
        searchInput.focus();
        window.scrollTo({ top: searchInput.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
      });
    }

    // Community Button / WhatsApp Link Reliability Handlers
    if (bnavCommunity) {
      bnavCommunity.addEventListener('click', (e) => {
        e.preventDefault();
        window.open('https://chat.whatsapp.com/G0VT9qsCLEe5Qqy8b7VCvp', '_blank', 'noopener,noreferrer');
      });
    }

    document.querySelectorAll('.btn-community-header, .whatsapp-card').forEach(card => {
      card.addEventListener('click', (e) => {
        e.preventDefault();
        window.open('https://chat.whatsapp.com/G0VT9qsCLEe5Qqy8b7VCvp', '_blank', 'noopener,noreferrer');
      });
    });

    document.querySelectorAll('.btn-dev-header, .linkedin-card').forEach(card => {
      card.addEventListener('click', (e) => {
        e.preventDefault();
        window.open('https://www.linkedin.com/in/anandkumar563/', '_blank', 'noopener,noreferrer');
      });
    });

    // Category Pills UI (Desktop)
    catPills.forEach(pill => {
      pill.addEventListener('click', () => {
        setActiveCategory(pill.dataset.cat);
      });
    });

    // Search Input UI
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      btnClearSearch.style.display = state.searchQuery.trim() ? 'block' : 'none';
      render();
    });

    btnClearSearch.addEventListener('click', () => {
      searchInput.value = '';
      state.searchQuery = '';
      btnClearSearch.style.display = 'none';
      searchInput.focus();
      render();
    });

    // Slot Select UI
    slotSelect.addEventListener('change', (e) => {
      state.activeSlot = e.target.value;
      if (state.freeNowActive && state.activeSlot !== state.currentLiveSlot) {
        setFreeNowState(false);
      }
      render();
    });

    // Sort Select UI
    sortSelect.addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      render();
    });

    // Helper: Set Free Right Now State
    function setFreeNowState(isOn) {
      state.freeNowActive = isOn;
      if (toggleFreeNowWrapper) toggleFreeNowWrapper.classList.toggle('is-on', isOn);
      if (toggleStatusText) toggleStatusText.textContent = isOn ? 'ON' : 'OFF';
      if (btnFreeNow) btnFreeNow.setAttribute('aria-checked', isOn ? 'true' : 'false');
      if (bnavFreeNow) bnavFreeNow.classList.toggle('active', isOn);

      if (isOn) {
        const nowDay = daysOfWeek[new Date().getDay()];
        if (nowDay !== 'Sunday') {
          setActiveDay(nowDay);
        }
        if (state.currentLiveSlot) {
          state.activeSlot = state.currentLiveSlot;
          slotSelect.value = state.currentLiveSlot;
        } else {
          state.activeSlot = 'ALL';
          slotSelect.value = 'ALL';
        }
        showToast('⚡ Showing classrooms vacant right now!');
      } else {
        state.activeSlot = 'ALL';
        slotSelect.value = 'ALL';
      }
      render();
    }

    // Toggle Free Right Now logic
    function toggleFreeNow() {
      setFreeNowState(!state.freeNowActive);
    }

    if (btnFreeNow) btnFreeNow.addEventListener('click', toggleFreeNow);
    if (toggleFreeNowWrapper) toggleFreeNowWrapper.addEventListener('click', (e) => {
      if (e.target !== btnFreeNow && !btnFreeNow.contains(e.target)) {
        toggleFreeNow();
      }
    });
    if (bnavFreeNow) bnavFreeNow.addEventListener('click', toggleFreeNow);

    // View Mode Toggle (Grid vs Compact)
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

    // Reset Filters
    btnResetFilters.addEventListener('click', () => {
      state.activeCategory = 'ALL';
      state.activeSlot = 'ALL';
      state.searchQuery = '';
      setFreeNowState(false);
      state.sortBy = 'ROOM_ASC';

      catPills.forEach(p => p.classList.toggle('active', p.dataset.cat === 'ALL'));
      sheetWingItems.forEach(w => w.classList.toggle('active', w.dataset.cat === 'ALL'));
      searchInput.value = '';
      btnClearSearch.style.display = 'none';
      slotSelect.value = 'ALL';
      sortSelect.value = 'ROOM_ASC';

      render();
    });

    // Modal Close Handlers
    if (btnModalClose) btnModalClose.addEventListener('click', () => scheduleModal.style.display = 'none');
    if (scheduleModal) {
      scheduleModal.addEventListener('click', (e) => {
        if (e.target === scheduleModal) scheduleModal.style.display = 'none';
      });
    }

    if (btnShareModalClose) btnShareModalClose.addEventListener('click', () => shareModal.style.display = 'none');
    if (shareModal) {
      shareModal.addEventListener('click', (e) => {
        if (e.target === shareModal) shareModal.style.display = 'none';
      });
    }

    // Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (scheduleModal && scheduleModal.style.display !== 'none') {
          scheduleModal.style.display = 'none';
        } else if (shareModal && shareModal.style.display !== 'none') {
          shareModal.style.display = 'none';
        } else if (daySheetOverlay && daySheetOverlay.style.display !== 'none') {
          daySheetOverlay.style.display = 'none';
        } else if (wingsSheetOverlay && wingsSheetOverlay.style.display !== 'none') {
          wingsSheetOverlay.style.display = 'none';
        } else if (document.activeElement === searchInput) {
          searchInput.blur();
        }
      } else if (e.key === '/' && document.activeElement !== searchInput) {
        e.preventDefault();
        searchInput.focus();
        window.scrollTo({ top: searchInput.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
      } else if (!e.ctrlKey && !e.metaKey && document.activeElement !== searchInput) {
        // Quick 1-6 day jump: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
        const keyNum = parseInt(e.key);
        if (keyNum >= 1 && keyNum <= 6) {
          const daysMap = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          setActiveDay(daysMap[keyNum - 1]);
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

    // Helper: Distinct Category Theme Class for Cards
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

    // Natural Room Sorting: R1..R37, PB2..PB4, T1..T54, SCR1..SCR4, CL1..
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

    // Comprehensive Smart Search Query Matcher
    function matchesSearch(room, rawQuery) {
      if (!rawQuery) return true;
      const q = rawQuery.trim().toLowerCase();
      if (!q) return true;
      const qNoSpace = q.replace(/[\s\-_]/g, '');
      const code = room.code.toLowerCase();
      const codeNoSpace = code.replace(/[\s\-_]/g, '');
      const name = room.name.toLowerCase();
      const cat = room.category.toLowerCase();

      // 1. Direct contains
      if (code.includes(q) || codeNoSpace.includes(qNoSpace) || name.includes(q) || cat.includes(q)) {
        return true;
      }

      // 2. Classrooms ("r", "r 2", "room 2", "classroom", "lecture")
      const isClassroom = /^r\d+$/i.test(room.code);
      if (q === 'r' || q === 'room' || q === 'rooms' || q === 'classroom' || q === 'classrooms' || q === 'lecture') {
        if (isClassroom) return true;
      }
      const rNumMatch = qNoSpace.match(/^r(?:oom)?(\d+)$/);
      if (rNumMatch && isClassroom) {
        return codeNoSpace === `r${rNumMatch[1]}`;
      }

      // 3. Principal Bungalow ("pb", "pb 2", "principal", "bungalow")
      const isPB = /^pb\d*$/i.test(room.code);
      if (q === 'pb' || q === 'bungalow' || q === 'principal bungalow' || q === 'principalbungalow') {
        if (isPB) return true;
      }
      const pbNumMatch = qNoSpace.match(/^pb(\d+)$/);
      if (pbNumMatch && isPB) {
        return codeNoSpace === `pb${pbNumMatch[1]}`;
      }
      if (q.includes('principal') && (isPB || room.code === 'Principal Office')) {
        return true;
      }

      // 4. Tutorial Rooms ("t", "t 14", "tut", "tutorial")
      const isTut = room.code.startsWith('T') && !room.code.startsWith('PB');
      if (q === 't' || q === 'tut' || q === 'tutorial' || q === 'tutorials') {
        if (isTut) return true;
      }
      const tNumMatch = qNoSpace.match(/^t(?:ut)?(?:orial)?(\d+)$/);
      if (tNumMatch && isTut) {
        return codeNoSpace === `t${tNumMatch[1]}`;
      }

      // 5. Sports Complex ("scr", "scr 1", "sport", "sports", "sports complex")
      const isSCR = room.code.startsWith('SCR');
      if (q === 'scr' || q === 'sport' || q === 'sports' || q === 'sports complex' || q === 'sportscomplex') {
        if (isSCR) return true;
      }
      const scrNumMatch = qNoSpace.match(/^scr(\d+)$/);
      if (scrNumMatch && isSCR) {
        return codeNoSpace === `scr${scrNumMatch[1]}`;
      }

      // 6. Computer Labs ("cl", "lab", "computer", "computer lab")
      const isCL = room.code.startsWith('CL');
      if (q === 'cl' || q === 'lab' || q === 'labs' || q === 'computer' || q === 'computer lab' || q === 'computerlab') {
        if (isCL) return true;
      }
      const clNumMatch = qNoSpace.match(/^cl(?:ab)?(\d+)$/);
      if (clNumMatch && isCL) {
        return codeNoSpace === `cl${clNumMatch[1]}`;
      }

      // 7. Library, Seminar, Playground
      if (q.includes('lib') && (room.code.includes('Library') || room.name.includes('Library'))) return true;
      if (q.includes('sem') && (room.code.includes('Seminar') || room.name.includes('Seminar'))) return true;
      if ((q.includes('ground') || q.includes('play')) && room.code.includes('PLAYGROUND')) return true;

      return false;
    }

    // Robust Clipboard Copy with execCommand fallback
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

    // Open Social Media Share Modal & Copy Room Details
    function openShareModal(roomCode) {
      const room = appData.rooms.find(r => r.code === roomCode);
      if (!room) return;

      const sched = room.schedule[state.activeDay] || { free_slots: [] };
      const freeSlotsList = sched.free_slots.length > 0 
        ? sched.free_slots.map(s => `  • ${s.replace(' to ', ' – ')}`).join('\n')
        : '  • Only Lunch Recess (1:30 PM – 2:00 PM)';

      const siteUrl = 'https://srcc-classroom-finder.netlify.app/';

      // 1. WhatsApp formatted message (uses * for bold formatting in WhatsApp chats)
      const whatsappMessage = `🎓 *SRCC Classroom Vacancy Alert*\n\n` +
        `📍 *Room:* ${room.code} (${room.name})\n` +
        `🏛️ *Wing:* ${room.category.split(' (')[0]}\n` +
        `📅 *Day:* ${state.activeDay}\n` +
        `👥 *Capacity:* ${room.capacity} seats\n` +
        `☕ *Lunch Recess:* 1:30 PM – 2:00 PM (Vacant)\n\n` +
        `🕒 *Free Academic Slots:*\n${freeSlotsList}\n\n` +
        `🔍 *Live Timetable & Vacancy Tracker:* ${siteUrl}`;

      // 2. Clean formatted message for Gmail, Clipboard, LinkedIn, Facebook, Instagram (No asterisks so it never appears as raw stars)
      const cleanMessage = `🎓 SRCC Classroom Vacancy Alert\n\n` +
        `📍 Room: ${room.code} (${room.name})\n` +
        `🏛️ Wing: ${room.category.split(' (')[0]}\n` +
        `📅 Day: ${state.activeDay}\n` +
        `👥 Capacity: ${room.capacity} seats\n` +
        `☕ Lunch Recess: 1:30 PM – 2:00 PM (Vacant)\n\n` +
        `🕒 Free Academic Slots:\n${freeSlotsList}\n\n` +
        `🔍 Live Timetable & Vacancy Tracker: ${siteUrl}`;

      // Short tweet text strictly <= 240 chars for guaranteed Twitter/X pre-fill on desktop
      const shortFreeSlots = sched.free_slots.length > 0
        ? sched.free_slots.slice(0, 3).map(s => s.replace(' to ', '-')).join(', ') + (sched.free_slots.length > 3 ? '...' : '')
        : '1:30-2:00 PM Recess';
      const tweetText = `🎓 SRCC Vacancy: Room ${room.code} is FREE on ${state.activeDay}!\n🕒 Slots: ${shortFreeSlots}\nCheck live timetable:`;

      const emailSubject = `SRCC Room Vacancy: ${room.code} (${state.activeDay})`;

      currentShareMessage = cleanMessage;
      currentTweetText = tweetText;
      currentEmailSubject = emailSubject;

      // Auto copy clean message to clipboard immediately on modal open & display notification toast
      copyToClipboard(cleanMessage)
        .then(() => {
          showToast(`📋 Room details for <strong>${room.code}</strong> copied to clipboard!`, true, 3500);
        })
        .catch(() => {
          showToast(`📤 Share Room <strong>${room.code}</strong>`, false, 2500);
        });

      if (shareModalTitle) shareModalTitle.textContent = `📤 Share ${room.code} (${room.name})`;
      if (sharePreviewText) sharePreviewText.textContent = cleanMessage;

      const encodedCleanMsg = encodeURIComponent(cleanMessage);
      const encodedWaMsg = encodeURIComponent(whatsappMessage);
      const encodedUrl = encodeURIComponent(siteUrl);

      // 1. WhatsApp: Direct pre-fill text with WhatsApp bold syntax (*)
      if (shareBtnWhatsapp) {
        shareBtnWhatsapp.href = `https://api.whatsapp.com/send?text=${encodedWaMsg}`;
        shareBtnWhatsapp.onclick = () => {
          copyToClipboard(whatsappMessage);
          showToast('💬 Opening WhatsApp with formatted schedule!', true, 3000);
        };
      }

      // 2. Gmail: Direct pre-fill Subject & Body without asterisks (clean text)
      if (shareBtnGmail) {
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(emailSubject)}&body=${encodedCleanMsg}`;
        shareBtnGmail.href = gmailUrl;
        shareBtnGmail.onclick = (e) => {
          e.preventDefault();
          copyToClipboard(cleanMessage);
          showToast('📧 Opening Gmail with pre-filled room schedule!', true, 3500);
          window.open(gmailUrl, '_blank', 'noopener,noreferrer');
        };
      }

      // 3. X (Twitter): Concise tweet strictly within 280 chars to ensure pre-fill on desktop
      if (shareBtnX) {
        const xUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(tweetText)}&url=${encodedUrl}`;
        shareBtnX.href = xUrl;
        shareBtnX.onclick = (e) => {
          e.preventDefault();
          copyToClipboard(cleanMessage);
          showToast('🐦 Opening X (Twitter) with pre-filled tweet!', true, 3500);
          window.open(xUrl, '_blank', 'noopener,noreferrer');
        };
      }

      // 4. Telegram: Pre-filled message
      if (shareBtnTelegram) {
        const teleUrl = `https://t.me/share/url?url=${encodedUrl}&text=${encodedCleanMsg}`;
        shareBtnTelegram.href = teleUrl;
        shareBtnTelegram.onclick = (e) => {
          e.preventDefault();
          copyToClipboard(cleanMessage);
          showToast('✈️ Opening Telegram with room details!', true, 3500);
          window.open(teleUrl, '_blank', 'noopener,noreferrer');
        };
      }

      // 5. LinkedIn: Copies clean schedule to clipboard + opens post composer
      if (shareBtnLinkedin) {
        shareBtnLinkedin.onclick = (e) => {
          e.preventDefault();
          copyToClipboard(cleanMessage)
            .then(() => {
              showToast('💼 <strong>Post text copied!</strong> Opening LinkedIn — press <strong>Ctrl+V (Paste)</strong> to add schedule.', true, 4500);
            })
            .catch(() => {
              showToast('💼 Opening LinkedIn post composer...', false, 3000);
            });
          window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`, '_blank', 'noopener,noreferrer');
        };
      }

      // 6. Instagram: Copies clean schedule to clipboard + opens Direct Messages (DMs)
      if (shareBtnInstagram) {
        shareBtnInstagram.onclick = (e) => {
          e.preventDefault();
          copyToClipboard(cleanMessage)
            .then(() => {
              showToast('📸 <strong>Schedule copied!</strong> Opening Instagram DMs — press <strong>Ctrl+V</strong> to send to friends or group!', true, 4500);
            })
            .catch(() => {
              showToast('📸 Opening Instagram DMs...', false, 3000);
            });
          window.open('https://www.instagram.com/direct/inbox/', '_blank', 'noopener,noreferrer');
        };
      }

      // 7. Facebook: Copies clean schedule to clipboard + opens post composer
      if (shareBtnFacebook) {
        shareBtnFacebook.onclick = (e) => {
          e.preventDefault();
          copyToClipboard(cleanMessage)
            .then(() => {
              showToast('👥 <strong>Room schedule copied!</strong> Opening Facebook — press <strong>Ctrl+V (Paste)</strong> into your post.', true, 4500);
            })
            .catch(() => {
              showToast('👥 Opening Facebook share...', false, 3000);
            });
          window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`, '_blank', 'noopener,noreferrer');
        };
      }

      // 8. Native Share API support check (Windows share sheet)
      if (navigator.share && btnNativeShare) {
        btnNativeShare.style.display = 'block';
        btnNativeShare.onclick = () => {
          navigator.share({
            title: `SRCC Room Vacancy: ${room.code}`,
            text: cleanMessage,
            url: siteUrl
          }).catch(() => {});
        };
      } else if (btnNativeShare) {
        btnNativeShare.style.display = 'none';
      }

      if (shareModal) shareModal.style.display = 'flex';
    }

    // Copy Full Text Button in Modal with Visual Feedback
    if (btnCopyShareText) {
      btnCopyShareText.addEventListener('click', () => {
        copyToClipboard(currentShareMessage)
          .then(() => {
            btnCopyShareText.innerHTML = '✅ Copied to Clipboard! (Press Ctrl+V anywhere)';
            btnCopyShareText.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.28), rgba(16, 185, 129, 0.12))';
            btnCopyShareText.style.borderColor = '#10B981';
            btnCopyShareText.style.color = '#34D399';
            showToast(`📋 <strong>Room schedule copied!</strong> Ready to paste anywhere (Ctrl+V).`, true, 3500);
            setTimeout(() => {
              btnCopyShareText.innerHTML = '📋 Copy Formatted Text to Clipboard';
              btnCopyShareText.style.background = '';
              btnCopyShareText.style.borderColor = '';
              btnCopyShareText.style.color = '';
            }, 2800);
          })
          .catch(() => {
            showToast('⚠️ Copy failed — please copy manually', false, 3000);
          });
      });
    }

    // Render Function
    function render() {
      statActiveDay.textContent = state.activeDay;
      if (metricDayLabel) metricDayLabel.textContent = state.activeDay;

      // Display live last synced timestamp from metadata in footer
      const sourceLink = document.querySelector('.source-link');
      if (sourceLink && appData.metadata && appData.metadata.last_synced) {
        sourceLink.innerHTML = `Timetable sourced from official portal: <a href="https://srcccollegetimetable.in/" target="_blank" rel="noopener">srcccollegetimetable.in</a> • Last verified: <strong>${appData.metadata.last_synced}</strong>`;
      }

      // Filter Rooms
      let filtered = appData.rooms.filter(room => {
        if (!matchesCategory(room, state.activeCategory)) return false;
        if (state.searchQuery && !matchesSearch(room, state.searchQuery)) return false;

        if (state.activeSlot !== 'ALL') {
          const daySched = room.schedule[state.activeDay];
          if (!daySched) return false;
          const isFree = daySched.free_slots.includes(state.activeSlot);
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

      statRoomCount.textContent = filtered.length;
      statTotalFreeHours.textContent = totalFreeHoursCount;
      if (metricTotalFreeCount) metricTotalFreeCount.textContent = totalFreeHoursCount;

      // Calculate live vacant count right now
      if (metricVacantNowCount) {
        if (state.currentLiveSlot === '1:30 PM to 2:00 PM') {
          metricVacantNowCount.textContent = '96 (Lunch)';
        } else if (state.currentLiveSlot) {
          const vacantNow = appData.rooms.filter(r => {
            const s = r.schedule[state.activeDay];
            return s && s.free_slots.includes(state.currentLiveSlot);
          }).length;
          metricVacantNowCount.textContent = `${vacantNow} Rooms`;
        } else {
          metricVacantNowCount.textContent = 'Off-Hours';
        }
      }

      // Calculate most vacant wing on current day
      if (metricBestCat) {
        const catStats = {
          'Tutorials': { count: 0, free: 0 },
          'Classrooms': { count: 0, free: 0 },
          'PB Wing': { count: 0, free: 0 },
          'Sports Complex': { count: 0, free: 0 }
        };

        appData.rooms.forEach(r => {
          const s = r.schedule[state.activeDay];
          const free = s ? s.free_hours : 0;
          if (r.code.startsWith('T') && !r.code.startsWith('PB')) {
            catStats['Tutorials'].count++;
            catStats['Tutorials'].free += free;
          } else if (/^R\d+$/.test(r.code)) {
            catStats['Classrooms'].count++;
            catStats['Classrooms'].free += free;
          } else if (r.code.startsWith('PB')) {
            catStats['PB Wing'].count++;
            catStats['PB Wing'].free += free;
          } else if (r.code.startsWith('SCR')) {
            catStats['Sports Complex'].count++;
            catStats['Sports Complex'].free += free;
          }
        });

        let bestWing = 'Tutorials';
        let maxAvgFree = -1;
        Object.keys(catStats).forEach(wing => {
          const item = catStats[wing];
          const avg = item.count > 0 ? (item.free / item.count) : 0;
          if (avg > maxAvgFree) {
            maxAvgFree = avg;
            bestWing = wing;
          }
        });
        metricBestCat.textContent = bestWing;
      }

      // Filter description tag
      let filterDesc = [];
      if (state.activeCategory !== 'ALL') {
        const pill = Array.from(catPills).find(p => p.dataset.cat === state.activeCategory);
        if (pill) filterDesc.push(pill.textContent.split(' (')[0]);
      }
      if (state.activeSlot !== 'ALL') {
        filterDesc.push(`Slot: ${state.activeSlot.replace(' to ', '–')}`);
      }
      if (state.searchQuery) {
        filterDesc.push(`Search: "${state.searchQuery}"`);
      }
      statFilterDesc.textContent = filterDesc.length ? `• ${filterDesc.join(', ')}` : '';

      // Render Cards
      if (filtered.length === 0) {
        roomsGrid.innerHTML = '';
        emptyState.style.display = 'block';
        return;
      }

      emptyState.style.display = 'none';

      roomsGrid.innerHTML = filtered.map(room => {
        const sched = room.schedule[state.activeDay] || {
          free_slots: [],
          free_hours: 0,
          lunch_recess_free: true,
          occupied_slots: []
        };

        const freeHours = sched.free_hours;
        let cardStyleClass = 'is-booked';
        if (freeHours >= 5) cardStyleClass = 'has-many-free';
        else if (freeHours > 0) cardStyleClass = 'has-some-free';

        const themeClass = getCategoryThemeClass(room);

        // Format free slot chips
        let chipsHtml = '';
        if (freeHours === 9) {
          chipsHtml = `<div class="slot-chip slot-all-free">★ ALL DAY VACANT (8:30 AM – 6:00 PM)</div>`;
        } else if (freeHours === 0) {
          chipsHtml = `<div class="slot-chip slot-none">No free periods on this day</div>`;
        } else {
          chipsHtml = sched.free_slots.map(slot => {
            const isHighlight = (state.activeSlot !== 'ALL' && state.activeSlot === slot);
            const chipClass = isHighlight ? 'slot-chip slot-highlight' : 'slot-chip slot-free';
            const compactTime = slot.replace(' to ', ' – ');
            return `<div class="${chipClass}">${compactTime}</div>`;
          }).join('');
        }

        // Build 9-period interactive timeline strip
        const p1_5 = periodIntervals.slice(0, 5).map(p => {
          const isFree = sched.free_slots.includes(p.slot);
          const cls = isFree ? 'p-block free' : 'p-block busy';
          const title = `${p.full}: ${isFree ? 'Vacant for GD' : 'Class in Session'}`;
          return `<div class="${cls}" data-room="${room.code}" data-slot="${p.slot}" title="${title}">${p.label}</div>`;
        }).join('');

        const recessMarker = `<div class="p-recess-divider" title="1:30–2:00 PM Lunch Recess (All 96 rooms universally free for GD)">☕</div>`;

        const p6_9 = periodIntervals.slice(5).map(p => {
          const isFree = sched.free_slots.includes(p.slot);
          const cls = isFree ? 'p-block free' : 'p-block busy';
          const title = `${p.full}: ${isFree ? 'Vacant for GD' : 'Class in Session'}`;
          return `<div class="${cls}" data-room="${room.code}" data-slot="${p.slot}" title="${title}">${p.label}</div>`;
        }).join('');

        const timelineHtml = `
          <div class="card-timeline-wrapper">
            <div class="timeline-header-row">
              <span>Day Period Breakdown</span>
              <span>${freeHours}/9 Free</span>
            </div>
            <div class="timeline-periods-strip">
              ${p1_5}
              ${recessMarker}
              ${p6_9}
            </div>
          </div>
        `;

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

            <!-- 9-Block Visual Timeline Strip -->
            ${timelineHtml}

            <div class="card-body">
              <div class="free-summary-bar ${freeHours === 0 ? 'zero-free' : ''}">
                <span>${freeHours > 0 ? `🟢 ${freeHours} Academic Hours Free` : `🔴 Fully Booked Day`}</span>
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
        btn.addEventListener('click', () => {
          const code = btn.dataset.room;
          openScheduleModal(code);
        });
      });

      // Attach Share Room Listeners
      document.querySelectorAll('.btn-share-room').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const code = btn.dataset.room;
          openShareModal(code);
        });
      });

      // Attach Timeline Period click to open schedule
      document.querySelectorAll('.p-block').forEach(block => {
        block.addEventListener('click', (e) => {
          e.stopPropagation();
          const roomCode = block.dataset.room;
          openScheduleModal(roomCode);
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

    // Format Class details with proper semester spacing and multi-batch line splits
    function formatClassDetails(raw) {
      if (!raw || typeof raw !== 'string') return '<span class="class-batch-line">Scheduled Class</span>';
      
      // Clean ASCII arrows like <---------> or <----->
      let cleaned = raw.replace(/<[-=]+>/g, '').trim();
      
      // Separate concatenated batches like ...KTKLAB-2. or ...PED1LAB-2. into separate lines
      cleaned = cleaned.replace(/([A-Za-z0-9\.\)])(?=LAB[- ]\d+|TUTE[- ]\d+|BATCH[- ]\d+)/gi, '$1\n');

      const lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean);
      
      const formattedLines = lines.map(line => {
        let text = line;
        
        // 1. Spacing for SEM / Semester with Roman or Arabic numerals:
        // When attached directly to course/subject letters: e.g. SEM VPhy.Ed -> Sem V • Phy.Ed
        if (/SEM(?:ESTER)?\s*(VIII|VII|VI|IV|V|III|II|I|\d+)(?=[A-Za-z])/i.test(text)) {
          text = text.replace(/[- ]*SEM(?:ESTER)?\s*(VIII|VII|VI|IV|V|III|II|I|\d+)(?=[A-Za-z])/gi, ' • Sem $1 • ');
        } else {
          text = text.replace(/[- ]*SEM(?:ESTER)?\s*(VIII|VII|VI|IV|V|III|II|I|\d+)\b/gi, ' • Sem $1');
        }
        
        // Clean and collapse multiple bullets or spaces into a single clean bullet
        text = text.replace(/(?:\s*•\s*)+/g, ' • ').trim();
        if (text.startsWith('• ')) text = text.slice(2).trim();

        return `<div class="class-batch-line">${escapeHtml(text)}</div>`;
      });

      if (formattedLines.length > 1) {
        return `<div class="class-batch-list">${formattedLines.join('')}</div>`;
      }
      return formattedLines[0] || '<span class="class-batch-line">Scheduled Class</span>';
    }

    // Schedule Modal Builder
    function openScheduleModal(roomCode) {
      const room = appData.rooms.find(r => r.code === roomCode);
      if (!room) return;

      const sched = room.schedule[state.activeDay] || { free_slots: [], occupied_slots: [], lunch_recess_free: true };

      modalRoomTitle.textContent = `${room.code} - ${room.name}`;
      modalRoomMeta.textContent = `${room.category} · Capacity: ${room.capacity} · Selected Day: ${state.activeDay}`;

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
        const isLunch = (timeSlot === '1:30 PM to 2:00 PM');
        
        if (isLunch) {
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

        if (isFree) {
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

      scheduleModal.style.display = 'flex';
    }

    // Initial render
    render();
  }
});
