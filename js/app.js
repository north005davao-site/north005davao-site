/**
 * APEX OmniERP - Master Application Controller
 * High-performance, modular ERP frontend controller
 */

// Sound Engine using Web Audio API (Zero external assets, 100% reliable)
class SoundFX {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
  }

  playClick() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, this.ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.08, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.04);
    } catch (e) { }
  }

  playChime() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.06);
        gain.gain.setValueAtTime(0.12, now + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + i * 0.06);
        osc.stop(now + i * 0.06 + 0.25);
      });
    } catch (e) { }
  }

  playAlert() {
    if (!this.enabled) return;
    this.init();
    if (!this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(880, now + 0.1);
      osc.frequency.setValueAtTime(440, now + 0.2);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch (e) { }
  }
}

const sfx = new SoundFX();

// State variables
let revenueChart = null;
let boothShareChart = null;
let currentSampleCanvas = null;

// Currency Formatter (Philippine Peso)
function formatPHP(num) {
  return '₱' + Number(num || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function formatPHPShort(num) {
  return '₱' + Number(num || 0).toLocaleString('en-PH', {
    maximumFractionDigits: 0
  });
}

// Initialization on DOM Ready or Immediate if already loaded
let appInitialized = false;
function initApp() {
  if (appInitialized) return;
  appInitialized = true;

  // 1. Initialize Universal Router FIRST so the target module is activated immediately
  initRouter();

  // 2. Initialize Core Shell Components
  initLiveClock();
  initTheme();
  initNavigation();
  initModals();
  if (typeof initOcrStudio === 'function') {
    initOcrStudio();
  }
  
  // 3. Populate module data
  renderAll();

  // 4. Subscribe to store updates
  if (window.appStore && typeof window.appStore.subscribe === 'function') {
    window.appStore.subscribe(() => {
      renderAll();
    });
  }

  // 5. Dismiss fast branded splash loader
  dismissSplashLoader();
}

function dismissSplashLoader() {
  const loader = document.getElementById('app-splash-loader');
  if (!loader) return;
  setTimeout(() => {
    loader.classList.add('splash-fade-out');
    setTimeout(() => {
      try { loader.remove(); } catch (e) { loader.style.display = 'none'; }
    }, 380);
  }, 220);
}

// Fallback safeguard to prevent any loader hang
if (typeof setTimeout === 'function') {
  setTimeout(dismissSplashLoader, 1600);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    initApp();
  }
}

function renderAll() {
  try { if (typeof renderDashboard === 'function') renderDashboard(); } catch (e) { console.error('Dashboard render error:', e); }
  try { if (typeof renderEmployeesTable === 'function') renderEmployeesTable(); } catch (e) { console.error('Employees render error:', e); }
  try { if (typeof renderFleetTrackingList === 'function') renderFleetTrackingList(); } catch (e) { console.error('Fleet render error:', e); }
  try { if (typeof renderPipelines === 'function') renderPipelines(); } catch (e) { console.error('Pipelines render error:', e); }
  try { if (typeof renderInventory === 'function') renderInventory(); } catch (e) { console.error('Inventory render error:', e); }
  try { if (window.userManagementModule && typeof window.userManagementModule.render === 'function') window.userManagementModule.render(); } catch (e) { console.error('UserMgmt render error:', e); }
  try { if (window.workforceAttendanceModule && typeof window.workforceAttendanceModule.render === 'function') window.workforceAttendanceModule.render(); } catch (e) { console.error('Attendance render error:', e); }
  try { if (window.employeeDocumentsModule && typeof window.employeeDocumentsModule.render === 'function') window.employeeDocumentsModule.render(); } catch (e) { console.error('Docs render error:', e); }
  try { if (window.expensesPayment && typeof window.expensesPayment.render === 'function') window.expensesPayment.render(); } catch (e) { console.error('Expenses render error:', e); }
  try { if (window.authManager) window.authManager.updateProfileUi(); } catch (e) {}
  try { if (typeof updateSidebarBadges === 'function') updateSidebarBadges(); } catch (e) { console.error('Badges render error:', e); }
}

// 1. Digital Live Clock
function initLiveClock() {
  const clockEl = document.getElementById('clock-display');
  function updateTime() {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString('en-US', { hour12: false });
    clockEl.textContent = `${dateStr} ${timeStr} PST`;
  }
  updateTime();
  setInterval(updateTime, 1000);
}

// 2. Multi-Theme Engine
function initTheme() {
  const picker = document.getElementById('theme-picker');
  const store = window.appStore;
  const currentTheme = store.getSettings().theme || 'corporate';
  
  document.documentElement.setAttribute('data-theme', currentTheme);
  picker.value = currentTheme;

  picker.addEventListener('change', (e) => {
    const newTheme = e.target.value;
    document.documentElement.setAttribute('data-theme', newTheme);
    store.setTheme(newTheme);
    if (window.sfx) sfx.playClick();
  });

  const soundBtn = document.getElementById('sound-toggle-btn');
  soundBtn.addEventListener('click', () => {
    sfx.enabled = !sfx.enabled;
    soundBtn.textContent = sfx.enabled ? '🔔' : '🔕';
    soundBtn.title = sfx.enabled ? 'Sound Enabled' : 'Sound Muted';
    if (sfx.enabled) sfx.playClick();
  });
}

// 3. Navigation View Switching & Universal Router
const ROUTE_MAP = {
  '/dashboard': 'view-dashboard',
  '/': 'view-dashboard',
  '/master-registry': 'view-employees',
  '/employees': 'view-employees',
  '/live-tracking': 'view-tracking',
  '/tracking': 'view-tracking',
  '/ets': 'view-tracking',
  '/sales-collection': 'view-pipelines',
  '/pipelines': 'view-pipelines',
  '/expenses': 'view-finance',
  '/finance': 'view-finance',
  '/expenses-payment': 'view-finance',
  '/outlet-rentals': 'view-inventory',
  '/inventory': 'view-inventory',
  '/user-management': 'view-user-management',
  '/users': 'view-user-management',
  '/workforce-attendance': 'view-workforce-attendance',
  '/attendance': 'view-workforce-attendance',
  '/org-chart': 'view-org-chart',
  '/organizational-charts': 'view-org-chart',
  '/organization': 'view-org-chart',
  '/teams': 'view-org-chart',
  '/employee-documents': 'view-employee-documents',
  '/documents': 'view-employee-documents',
  '/thermal-paper': 'view-thermal-paper',
  '/thermal': 'view-thermal-paper',
  '/thermal-summary': 'view-thermal-paper',
  '/audit-discrepancy': 'view-audit-discrepancy',
  '/discrepancy': 'view-audit-discrepancy',
  '/settings': 'view-settings'
};

const VIEW_TO_ROUTE = {
  'view-dashboard': '/dashboard',
  'view-employees': '/master-registry',
  'view-tracking': '/live-tracking',
  'view-pipelines': '/sales-collection',
  'view-finance': '/expenses',
  'view-inventory': '/outlet-rentals',
  'view-user-management': '/user-management',
  'view-workforce-attendance': '/workforce-attendance',
  'view-org-chart': '/org-chart',
  'view-employee-documents': '/employee-documents',
  'view-thermal-paper': '/thermal-paper',
  'view-audit-discrepancy': '/audit-discrepancy',
  'view-settings': '/settings'
};

function resolveCurrentRoute() {
  // 1. Check URL hash (e.g. #/employee-documents or #view-employee-documents)
  if (window.location.hash) {
    const hashClean = window.location.hash.replace(/^#\/?/, '/');
    const hashRaw = window.location.hash.replace(/^#/, '');
    if (ROUTE_MAP[hashClean]) return ROUTE_MAP[hashClean];
    if (VIEW_TO_ROUTE[hashRaw]) return hashRaw;
  }

  // 2. Check search params fallback (?view=view-employee-documents or ?route=/employee-documents)
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('route') && ROUTE_MAP[params.get('route')]) {
      return ROUTE_MAP[params.get('route')];
    }
    if (params.get('view') && VIEW_TO_ROUTE[params.get('view')]) {
      return params.get('view');
    }
  } catch (e) {}

  // 3. Check URL pathname
  let path = window.location.pathname.replace(/\/$/, '') || '/';
  if (path !== '/' && path !== '' && ROUTE_MAP[path]) {
    return ROUTE_MAP[path];
  }

  // 4. Check persistent storage (retains active module when browser is refreshed!)
  try {
    const storedView = localStorage.getItem('NORTH005_ACTIVE_VIEW');
    if (storedView && VIEW_TO_ROUTE[storedView]) {
      return storedView;
    }
    const storedRoute = localStorage.getItem('NORTH005_CURRENT_ROUTE');
    if (storedRoute && ROUTE_MAP[storedRoute]) {
      return ROUTE_MAP[storedRoute];
    }
  } catch (e) {}

  return 'view-dashboard';
}

function initRouter() {
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    // Handle browser Back / Forward buttons
    window.addEventListener('popstate', (event) => {
      let targetView = null;
      if (event.state && event.state.viewId) {
        targetView = event.state.viewId;
      } else {
        targetView = resolveCurrentRoute();
      }
      if (targetView && typeof window.switchView === 'function') {
        window.switchView(targetView, false);
      }
    });

    // Handle hash changes
    window.addEventListener('hashchange', () => {
      const targetView = resolveCurrentRoute();
      if (targetView && typeof window.switchView === 'function') {
        window.switchView(targetView, false);
      }
    });
  }

  // Resolve and activate initial route from current URL or pre-activated view
  const initialView = window.__INITIAL_ROUTE_VIEW__ || resolveCurrentRoute();
  window.switchView(initialView, false);

  // Clean up early route style now that class="active" is applied to initialView
  const earlyStyle = document.getElementById('early-route-style');
  if (earlyStyle) earlyStyle.remove();

  const initialPath = VIEW_TO_ROUTE[initialView] || '/dashboard';
  if (window.location.protocol.startsWith('http') && window.location.pathname !== initialPath) {
    window.history.replaceState({ viewId: initialView }, '', initialPath);
  }
}

/* ==========================================================================
   NORTH-005 DAVAO DEL NORTE — MOBILE RESPONSIVE SIDEBAR DRAWER CONTROLLER
   ========================================================================== */

window.openMobileSidebar = function() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) sidebar.classList.add('mobile-open');
  if (backdrop) backdrop.classList.add('active');
  document.body.classList.add('mobile-sidebar-active');
  if (window.etsMap && typeof window.etsMap.invalidateMapSize === 'function') {
    window.etsMap.invalidateMapSize();
  }
};

window.closeMobileSidebar = function() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) sidebar.classList.remove('mobile-open');
  if (backdrop) backdrop.classList.remove('active');
  document.body.classList.remove('mobile-sidebar-active');
  if (window.etsMap && typeof window.etsMap.invalidateMapSize === 'function') {
    window.etsMap.invalidateMapSize();
  }
};

window.toggleMobileSidebar = function() {
  const sidebar = document.getElementById('sidebar');
  if (sidebar && sidebar.classList.contains('mobile-open')) {
    window.closeMobileSidebar();
  } else {
    window.openMobileSidebar();
  }
};

function initMobileSidebarGestures() {
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;

  document.addEventListener('touchstart', (e) => {
    if (!e.touches || e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    touchStartTime = Date.now();
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (!e.changedTouches || e.changedTouches.length !== 1) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    const deltaTime = Date.now() - touchStartTime;

    // Fast horizontal swipe (< 500ms, not a vertical scroll gesture)
    if (deltaTime > 500) return;
    if (Math.abs(deltaY) > Math.abs(deltaX) * 0.7) return;

    const sidebar = document.getElementById('sidebar');
    const isMobile = window.innerWidth <= 1024;
    if (!isMobile || !sidebar) return;

    const isOpen = sidebar.classList.contains('mobile-open');

    // Swipe right from left edge (touchStartX <= 40px) to open
    if (!isOpen && touchStartX <= 40 && deltaX > 60) {
      window.openMobileSidebar();
    }
    // Swipe left when open to close
    else if (isOpen && deltaX < -60) {
      window.closeMobileSidebar();
    }
  }, { passive: true });

  // Close with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.closeMobileSidebar();
    }
  });
}

function initNavigation() {
  const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const viewId = item.getAttribute('data-view');
      switchView(viewId, true);
      window.closeMobileSidebar();
    });
  });

  initMobileSidebarGestures();
}

// Module Friendly Display Names for In-Page Transition Loader
const MODULE_NAMES = {
  'view-dashboard': 'Control Center Dashboard',
  'view-employees': 'Master Registry',
  'view-tracking': 'ETS Live GPS Tracking',
  'view-pipelines': 'Sales & Collection Pipeline',
  'view-finance': 'Expenses & Payment',
  'view-outlet-rentals': 'Outlet Rentals & Load Allowance',
  'view-user-management': 'User & Access Management',
  'view-workforce-attendance': 'Attendance / Workforce Monitoring',
  'view-org-chart': 'Organizational Charts',
  'view-employee-documents': 'Employee Documents & 201 Files',
  'view-thermal-paper': 'Thermal Paper Daily Summary',
  'view-audit-discrepancy': 'Audit & Discrepancy Engine',
  'view-inventory': 'Thermal & Equipment Inventory',
  'view-settings': 'System Settings'
};

let moduleTransitionTimer = null;
let moduleHideTimer = null;
function triggerModuleLoadingAnimation(viewId) {
  const overlay = document.getElementById('module-loading-overlay');
  const titleEl = document.getElementById('module-loading-title');
  if (!overlay) return;

  const modTitle = MODULE_NAMES[viewId] || 'Module';
  if (titleEl) {
    titleEl.textContent = `Loading ${modTitle}...`;
  }

  if (moduleTransitionTimer) clearTimeout(moduleTransitionTimer);
  if (moduleHideTimer) clearTimeout(moduleHideTimer);

  overlay.style.display = 'flex';
  void overlay.offsetWidth; // Force reflow
  overlay.classList.add('active');

  moduleTransitionTimer = setTimeout(() => {
    overlay.classList.remove('active');
    moduleHideTimer = setTimeout(() => {
      if (!overlay.classList.contains('active')) {
        overlay.style.display = 'none';
      }
    }, 180);
  }, 210);
}

window.switchView = function(viewId, updateHistory = true, skipAnimation = false) {
  // Automatically close mobile sidebar drawer on navigation
  if (typeof window.closeMobileSidebar === 'function') {
    window.closeMobileSidebar();
  }

  if (window.authManager && typeof window.authManager.canAccessView === 'function') {
    if (!window.authManager.canAccessView(viewId)) {
      alert('Permission Denied: Your account role does not have permission to access this module.');
      const fallbackView = (window.authManager.isTeller && (window.authManager.isTeller() || window.authManager.isReliever()))
        ? 'view-workforce-attendance'
        : 'view-dashboard';
      if (viewId !== fallbackView) {
        window.switchView(fallbackView, true);
      }
      return;
    }
  }

  if (window.sfx) sfx.playClick();
  
  // Trigger Fast In-Page Module Transition (180ms-250ms) with official NORTH-005 logo
  const currentActivePanel = document.querySelector('.view-panel.active');
  const currentViewId = currentActivePanel ? currentActivePanel.id : null;
  if (!skipAnimation && currentViewId && currentViewId !== viewId) {
    triggerModuleLoadingAnimation(viewId);
  }

  // Update sidebar active classes
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    if (item.getAttribute('data-view') === viewId) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Update view panels
  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.classList.remove('active');
  });

  const targetPanel = document.getElementById(viewId);
  if (targetPanel) {
    targetPanel.classList.add('active');
  }

  // View specific handlers
  if (viewId === 'view-tracking') {
    if (window.etsMap) {
      window.etsMap.init('ets-map-container');
      renderFleetTrackingList();
      if (window.etsMap.renderAllMarkers) window.etsMap.renderAllMarkers();
    }
    setTimeout(() => {
      if (window.etsMap && window.etsMap.map) window.etsMap.map.invalidateSize();
    }, 100);
  } else if (viewId === 'view-employees') {
    renderEmployeesTable();
  } else if (viewId === 'view-dashboard') {
    renderDashboard();
  } else if (viewId === 'view-finance') {
    if (window.expensesPayment) {
      window.expensesPayment.init();
    }
  } else if (viewId === 'view-inventory') {
    if (window.outletRentals) {
      if (!window.outletRentals._initialized) {
        window.outletRentals.init();
      } else {
        window.outletRentals.render();
      }
    }
  } else if (viewId === 'view-thermal-paper') {
    if (window.thermalPaperModule) {
      window.thermalPaperModule.render();
    }
  } else if (viewId === 'view-user-management') {
    if (window.userManagementModule) {
      window.userManagementModule.render();
    }
  } else if (viewId === 'view-workforce-attendance') {
    if (window.workforceAttendanceModule) {
      window.workforceAttendanceModule.render();
    }
  } else if (viewId === 'view-org-chart') {
    if (window.orgChartModule) {
      window.orgChartModule.render();
    }
  } else if (viewId === 'view-employee-documents') {
    if (window.employeeDocumentsModule) {
      window.employeeDocumentsModule.render();
    }
  }

  // Update URL route, browser history, and persistent active view storage
  const routePath = VIEW_TO_ROUTE[viewId] || '/dashboard';
  try {
    localStorage.setItem('NORTH005_ACTIVE_VIEW', viewId);
    localStorage.setItem('NORTH005_CURRENT_ROUTE', routePath);
  } catch (e) {}

  if (updateHistory && window.location.protocol.startsWith('http')) {
    const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
    if (currentPath !== routePath) {
      window.history.pushState({ viewId }, '', routePath);
    }
  }
};

function updateSidebarBadges() {
  const store = window.appStore;
  const emps = store.getEmployees() || [];
  
  // Exclude Operations Administrator, Supervisors, and Collectors from Master Registry staff count
  const operationalEmps = emps.filter(e => {
    const r = (e.role || '').toUpperCase();
    const d = (e.department || '').toLowerCase();
    const isLeadershipOrCollector = r.includes('ADMIN') || r.includes('SUPERVISOR') || r.includes('TEAM LEADER') || r.includes('COLLECTOR') || d === 'dept-admin' || d === 'dept-sup' || d === 'dept-col';
    return !isLeadershipOrCollector;
  });

  const inv = store.getInventory();
  const lowPaper = inv.filter(i => i.type === 'THERMAL PAPER' && (i.quantity < 25 || i.status === 'Low Stock Alert'));

  const empBadge = document.getElementById('sidebar-emp-count');
  if (empBadge) empBadge.textContent = operationalEmps.length;

  const invAlert = document.getElementById('sidebar-inv-alert');
  if (invAlert) {
    invAlert.style.display = lowPaper.length > 0 ? 'inline-block' : 'none';
  }
}

// =========================================================================
// VIEW 1: EXECUTIVE DASHBOARD
// =========================================================================
// =========================================================================
// VIEW 1: CENTRAL CONTROL CENTER & EXECUTIVE DASHBOARD
// =========================================================================
let currentDashboardMuniFilter = 'ALL';

function renderDashboard() {
  const store = window.appStore;
  if (!store || !store.data) return;

  const employees = store.getEmployees() || [];
  const booths = store.getBooths() || [];
  const inv = store.getInventory(false) || [];
  const txns = store.data.transactions || [];
  const outletRentals = store.data.outletRentals || [];

  // A. Workforce Authoritative Metrics (from Master Registry)
  const totalStaff = employees.length;
  const countTellers = employees.filter(e => {
    const r = (e.role || '').toUpperCase();
    return r.includes('TELLER') || r.includes('SALES REP') || r.includes('RELIEVER');
  }).length;
  const countCollectors = employees.filter(e => (e.role || '').toUpperCase().includes('COLLECTOR')).length;
  const countSupervisors = employees.filter(e => (e.role || '').toUpperCase().includes('SUPERVISOR')).length;
  const countAdmins = employees.filter(e => {
    const r = (e.role || '').toUpperCase();
    return r.includes('ADMIN') || r.includes('TEAM LEADER') || (e.department || '').includes('admin');
  }).length;
  const countActiveStaff = employees.filter(e => (e.status || 'ACTIVE').toUpperCase() === 'ACTIVE').length;
  const countTerminatedStaff = employees.filter(e => (e.status || '').toUpperCase() === 'TERMINATED').length;

  // B. Booths Authoritative Metrics (from Master Registry)
  const totalBooths = booths.length;
  const assignedBooths = booths.filter(b => b.assignedTellerName || b.assignedTellerId).length;
  const inactiveBooths = Math.max(0, totalBooths - assignedBooths);

  // Municipal Counts (from Master Registry booths)
  const muniCounts = {
    'Sto. Tomas': 0,
    'Tagum City': 0,
    'Carmen': 0,
    'Panabo City': 0,
    'Kapalong': 0,
    'Talaingod': 0,
    'Samal': 0
  };
  booths.forEach(b => {
    const area = (b.area || b.municipality || '').trim();
    if (area.includes('Tagum')) muniCounts['Tagum City']++;
    else if (area.includes('Panabo')) muniCounts['Panabo City']++;
    else if (area.includes('Carmen')) muniCounts['Carmen']++;
    else if (area.includes('Kapalong')) muniCounts['Kapalong']++;
    else if (area.includes('Talaingod')) muniCounts['Talaingod']++;
    else if (area.includes('Samal') || area.includes('IGACOS')) muniCounts['Samal']++;
    else muniCounts['Sto. Tomas']++;
  });

  // C. Sales & Collection Authoritative Metrics (Strictly from actual transactions)
  const summary = store.getFinancialSummary ? store.getFinancialSummary() : { totalIncome: 0 };
  const totalCollection = summary.totalIncome || 0; // 0 if reset -> ₱0.00

  // D. Expenses & Payment Authoritative Metrics (Strictly from actual transactions)
  let totalExpenses = 0, totalShortages = 0, totalCashAdvances = 0, totalPayments = 0;
  txns.forEach(t => {
    const a = Number(t.amount) || 0;
    if (t.classification === 'OTHER' || t.type === 'EXPENSE' || t.isExpense) totalExpenses += a;
    else if (t.classification === 'SHORT' || t.type === 'SHORT' || (t.description && t.description.toUpperCase().includes('SHORT'))) totalShortages += a;
    else if (t.classification === 'CA' || t.type === 'CASH ADVANCE' || (t.description && t.description.toUpperCase().includes('CASH ADVANCE'))) totalCashAdvances += a;
    else if (t.classification === 'PAYMENT' || t.type === 'PAYMENT') totalPayments += a;
  });

  const activeShortRemaining = Math.max(0, totalShortages - totalPayments);
  const activeCARemaining = Math.max(0, totalCashAdvances - (txns.filter(t => (t.type === 'PAYMENT' || t.classification === 'PAYMENT') && t.applyToCA).reduce((sum, t) => sum + (Number(t.amount) || 0), 0)));

  // E. Outlet Rentals & Load Allowance Authoritative Metrics (Strictly from Outlet Rentals module)
  let totalRentalsAmt = 0, totalLoadAmt = 0, activeRentalsCount = 0;
  outletRentals.forEach(r => {
    const a = Number(r.amount) || 0;
    if (r.category === 'Outlet Rental') {
      totalRentalsAmt += a;
      activeRentalsCount++;
    } else if (r.category === 'Load Allowance') {
      totalLoadAmt += a;
    }
  });

  // F. Thermal Paper Authoritative Metrics (Strictly from Thermal Paper Daily Summary)
  let stocksOnHand = 0;
  let rollsAllocated = 0;
  let rollsRemaining = 0;
  if (window.thermalPaperModule && typeof window.thermalPaperModule.calculateDailyStocks === 'function') {
    const tpSummary = window.thermalPaperModule.calculateDailyStocks(window.thermalPaperModule.selectedDate || '2026-09-29');
    stocksOnHand = tpSummary.stocksOnHand || 0;
    rollsAllocated = tpSummary.totalAllocated || 0;
    rollsRemaining = tpSummary.rollsRemaining || 0;
  } else {
    const thermalSummary = (store.data && store.data.thermalPaperDailySummary) || {};
    stocksOnHand = thermalSummary.stocksOnHand || 0;
    if (thermalSummary.allocations && Array.isArray(thermalSummary.allocations)) {
      rollsAllocated = thermalSummary.allocations.reduce((sum, item) => sum + (Number(item.rollsAllocated || item.rolls) || 0), 0);
    }
    rollsRemaining = Math.max(0, stocksOnHand - rollsAllocated);
  }

  // Safe element text updater
  const setEl = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  // 1. Top KPI Summary Cards
  const countRelievers = employees.filter(e => (e.role || '').toUpperCase().includes('RELIEVER')).length;
  const countSalesReps = Math.max(0, countTellers - countRelievers);

  setEl('dash-total-employees', totalStaff + ' Personnel');
  setEl('dash-emp-subtext', `${countSalesReps} Sales Reps • ${countRelievers} Relievers`);
  setEl('dash-active-booths', totalBooths + ' Outlets');
  setEl('dash-booth-subtext', `${totalBooths} Outlets • 8 Corridors Active`);
  setEl('dash-total-properties', activeRentalsCount + ' Leased Outlets');
  setEl('dash-today-collection', formatPHP(totalCollection));
  setEl('dash-live-ets', totalBooths + ' / ' + totalBooths + ' Online');
  setEl('dash-thermal-stock', rollsRemaining + ' Rolls');

  // 2. Control Center Workforce Breakdown
  setEl('dash-wf-total', totalStaff);
  setEl('dash-wf-tellers', countSalesReps);
  setEl('dash-wf-relievers', countRelievers);
  setEl('dash-wf-collectors', countCollectors);
  setEl('dash-wf-supervisors', countSupervisors);
  setEl('dash-wf-admins', countAdmins);
  setEl('dash-wf-field-total', countSalesReps + countRelievers);
  setEl('dash-wf-active', countActiveStaff);
  setEl('dash-wf-terminated', countTerminatedStaff);

  // 3. Control Center Booth Breakdown by Municipality
  setEl('dash-booth-total', totalBooths);
  setEl('dash-booth-muni-stomas', muniCounts['Sto. Tomas'] + ' Outlets');
  setEl('dash-booth-muni-tagum', muniCounts['Tagum City'] + ' Outlets');
  setEl('dash-booth-muni-carmen', muniCounts['Carmen'] + ' Outlets');
  setEl('dash-booth-muni-panabo', muniCounts['Panabo City'] + ' Outlets');
  setEl('dash-booth-muni-samal', (muniCounts['Samal'] || 0) + ' Outlets');
  setEl('dash-booth-muni-kapalong', muniCounts['Kapalong'] + ' Outlets');
  setEl('dash-booth-muni-talaingod', muniCounts['Talaingod'] + ' Outlets');

  // 4. Control Center Cash Advance & Ledger
  setEl('dash-fin-ca', formatPHP(totalCashAdvances));
  setEl('dash-fin-ca-balance', formatPHP(activeCARemaining));
  setEl('dash-fin-short', formatPHP(totalShortages));
  setEl('dash-fin-payments', formatPHP(totalPayments));

  // 5. Control Center Thermal & Equipment
  setEl('dash-inv-remaining', rollsRemaining + ' Rolls');
  setEl('dash-inv-allocated', rollsAllocated + ' Rolls');
  setEl('dash-rent-total', formatPHP(totalRentalsAmt));
  setEl('dash-load-total', formatPHP(totalLoadAmt));

  // 6. Render Dynamic Live Operations Table & Municipality Pills
  renderDashboardLiveOperations(currentDashboardMuniFilter);
}

window.filterDashboardMuni = function(muni) {
  currentDashboardMuniFilter = muni;
  renderDashboardLiveOperations(muni);
};

function renderDashboardLiveOperations(selectedMuni) {
  if (!selectedMuni) selectedMuni = 'ALL';
  const container = document.getElementById('dash-muni-pills-container');
  const tbody = document.getElementById('dash-live-operations-tbody');
  const store = window.appStore;
  if (!store) return;

  const booths = store.getBooths() || [];
  const employees = store.getEmployees() || [];
  const txns = store.data.transactions || [];

  // 1. Calculate dynamic municipality counts from Master Registry booths
  const muniCounts = {
    'Sto. Tomas': 0,
    'Tagum City': 0,
    'Carmen': 0,
    'Panabo City': 0,
    'Kapalong': 0,
    'Talaingod': 0,
    'Samal': 0
  };

  booths.forEach(b => {
    const area = (b.area || b.municipality || '').trim();
    if (area.includes('Tagum')) muniCounts['Tagum City']++;
    else if (area.includes('Panabo')) muniCounts['Panabo City']++;
    else if (area.includes('Carmen')) muniCounts['Carmen']++;
    else if (area.includes('Kapalong')) muniCounts['Kapalong']++;
    else if (area.includes('Talaingod')) muniCounts['Talaingod']++;
    else if (area.includes('Samal') || area.includes('IGACOS')) muniCounts['Samal']++;
    else muniCounts['Sto. Tomas']++;
  });

  // 2. Render Municipality Pills
  if (container) {
    const pillConfigs = [
      { key: 'ALL', label: 'All Municipalities', count: booths.length, color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.12)', border: 'rgba(56, 189, 248, 0.45)' },
      { key: 'Sto. Tomas', label: 'Sto. Tomas', count: muniCounts['Sto. Tomas'], color: '#eab308', bg: 'rgba(234, 179, 8, 0.12)', border: 'rgba(234, 179, 8, 0.45)' },
      { key: 'Tagum City', label: 'Tagum City', count: muniCounts['Tagum City'], color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.12)', border: 'rgba(139, 92, 246, 0.45)' },
      { key: 'Carmen', label: 'Carmen', count: muniCounts['Carmen'], color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.45)' },
      { key: 'Panabo City', label: 'Panabo City', count: muniCounts['Panabo City'], color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.45)' },
      { key: 'Kapalong', label: 'Kapalong', count: muniCounts['Kapalong'], color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.12)', border: 'rgba(59, 130, 246, 0.45)' },
      { key: 'Talaingod', label: 'Talaingod', count: muniCounts['Talaingod'], color: '#ec4899', bg: 'rgba(236, 72, 153, 0.12)', border: 'rgba(236, 72, 153, 0.45)' },
      { key: 'Samal', label: 'Samal (IGACOS)', count: muniCounts['Samal'], color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.12)', border: 'rgba(6, 182, 212, 0.45)' }
    ].filter(p => p.key === 'ALL' || p.count > 0);

    container.innerHTML = pillConfigs.map(p => {
      const isSelected = (selectedMuni === p.key || (selectedMuni === 'ALL' && p.key === 'ALL'));
      const activeStyle = isSelected
        ? `border: 2px solid ${p.color}; background: ${p.color}33; color: #ffffff; font-weight: 800; transform: translateY(-1px) scale(1.03); box-shadow: 0 0 14px ${p.color}66;`
        : `border: 1px solid ${p.border}; background: ${p.bg}; color: ${p.color === '#eab308' ? '#fde047' : p.color}; opacity: 0.95; cursor: pointer;`;

      return `
        <span class="badge clickable" 
          onclick="window.filterDashboardMuni('${p.key}')"
          style="display: inline-flex; align-items: center; gap: 7px; padding: 7px 14px; font-size: 12px; border-radius: 9999px; cursor: pointer; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); ${activeStyle}"
          title="Filter by ${p.label} (Matches ${p.color} ETS Booth Pins)">
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${p.color}; box-shadow: 0 0 8px ${p.color}; flex-shrink: 0;"></span>
          <span>${p.label}:</span>
          <strong style="color: #ffffff; background: rgba(0, 0, 0, 0.28); padding: 1px 7px; border-radius: 9999px; font-size: 11.5px;">${p.count} Outlets</strong>
        </span>
      `;
    }).join('');
  }

  // 3. Filter booths by selected municipality
  let filteredBooths = booths;
  if (selectedMuni && selectedMuni !== 'ALL') {
    filteredBooths = booths.filter(b => {
      const area = (b.area || b.municipality || '').toLowerCase();
      const target = selectedMuni.toLowerCase().replace(' city', '');
      return area.includes(target);
    });
  }

  if (!tbody) return;

  if (filteredBooths.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 24px; color: var(--text-muted);">
          No outlets registered for ${selectedMuni} in Master Registry.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filteredBooths.map(b => {
    // Find assigned teller / sales rep in Master Registry
    const assignedEmp = employees.find(e => (e.boothCode === b.id || e.booth === b.id) && (e.status || 'ACTIVE').toUpperCase() !== 'TERMINATED');
    const tellerName = assignedEmp ? assignedEmp.name : (b.assignedTellerName || 'Unassigned');
    const isOnline = assignedEmp && (assignedEmp.status || 'ACTIVE').toUpperCase() === 'ACTIVE';

    // Calculate actual collection intake for this specific booth from sales/collection transactions
    const boothTxns = txns.filter(t => t.boothCode === b.id || (t.description && t.description.includes(b.id)));
    const boothIntake = boothTxns.reduce((sum, t) => {
      const a = Number(t.amount) || 0;
      if (t.type === 'COLLECTION' || t.classification === 'INCOME' || (!t.isExpense && !t.isShortage && !t.isCashAdvance && t.type !== 'PAYMENT')) {
        return sum + a;
      }
      return sum;
    }, 0);

    const muniDisplay = b.municipality || (b.area && b.area !== '-' ? b.area : 'Sto. Tomas');
    const locDisplay = b.location || b.address || b.area || '-';

    return `
      <tr>
        <td><strong><code style="font-size: 12px; color: var(--primary); font-weight: 700;">${b.id}</code></strong></td>
        <td>
          <div style="font-weight: 600; color: var(--text-main); font-size: 12px;">${tellerName}</div>
          <div style="font-size: 10.5px; color: var(--text-dim); font-family: monospace;">POS-${b.id}</div>
        </td>
        <td>
          <div style="font-size: 11.5px; color: var(--text-muted); max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${locDisplay}">
            ${locDisplay}
          </div>
        </td>
        <td>
          <span style="font-size: 12px; font-weight: 600; color: var(--text-main);">${muniDisplay}</span>
        </td>
        <td style="text-align: right; font-weight: 700; color: ${boothIntake > 0 ? 'var(--success)' : 'var(--text-dim)'}; font-family: var(--font-mono);">
          ${formatPHP(boothIntake)}
        </td>
        <td style="text-align: center;">
          ${isOnline 
            ? '<span class="badge badge-success" style="font-size: 10.5px; padding: 2px 8px;">● Online</span>' 
            : '<span class="badge badge-neutral" style="font-size: 10.5px; padding: 2px 8px; opacity: 0.65;">○ Offline</span>'}
        </td>
      </tr>
    `;
  }).join('');
}

window.renderDashboard = renderDashboard;
window.refreshDashboard = function() {
  if (typeof sfx !== 'undefined' && sfx.playChime) sfx.playChime();
  renderDashboard();
};

// =========================================================================
// =========================================================================
// VIEW 2: MASTER DATA REGISTRY (DAVAO DEL NORTE - DDN005)
// =========================================================================
let currentRegistryCategory = 'all';
let registryCurrentPage = 1;
let registryRowsPerPage = 15;

function parseAddressHelper(rawAddress) {
  if (!rawAddress || rawAddress.trim() === '' || rawAddress.trim() === '-') {
    return { purok: '-', municipality: '-' };
  }
  const addr = rawAddress.trim();

  // If the address contains multi-municipality route slashes (e.g. "Tagum / Kapalong / Talaingod" or "Carmen / Tagum")
  // and has no comma, this is an assigned coverage territory/route without a purok!
  if (addr.includes('/') && !addr.includes(',')) {
    return {
      purok: '-',
      municipality: addr
    };
  }

  // Strip trailing province suffix if present so municipality is not masked
  const cleanAddr = addr.replace(/,\s*Davao\s+del\s+Norte\s*$/i, '').trim();

  const knownMunicipalities = [
    'Sto. Tomas', 'Sto Tomas', 'St. Tomas',
    'Tagum City', 'Tagum',
    'Panabo City', 'Panabo',
    'Carmen', 'Kapalong',
    'Sto. Nino Talaingod', 'Sto. Niño Talaingod', 'Talaingod',
    'Samal', 'Island Garden City of Samal',
    'Asuncion'
  ];

  // Check if entire address is a known municipality
  for (const m of knownMunicipalities) {
    if (cleanAddr.toLowerCase() === m.toLowerCase()) {
      return {
        purok: '-',
        municipality: m === 'Sto Tomas' || m === 'St. Tomas' ? 'Sto. Tomas' : (m === 'Tagum' ? 'Tagum City' : (m === 'Panabo' ? 'Panabo City' : m))
      };
    }
  }

  for (const m of knownMunicipalities) {
    const re = new RegExp('(?:,\\s*|\\s+)' + m.replace('.', '\\.') + '\\s*$', 'i');
    if (re.test(cleanAddr)) {
      const match = cleanAddr.match(re);
      const purokPart = cleanAddr.substring(0, match.index).trim().replace(/[,\/\s]+$/, '');
      return {
        purok: purokPart || '-',
        municipality: m === 'Sto Tomas' || m === 'St. Tomas' ? 'Sto. Tomas' : (m === 'Tagum' ? 'Tagum City' : (m === 'Panabo' ? 'Panabo City' : m))
      };
    }
  }

  const parts = addr.split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length > 1) {
    const muni = parts.pop();
    const pPart = parts.join(', ').replace(/[,\/\s]+$/, '').trim();
    return {
      purok: pPart || '-',
      municipality: muni
    };
  } else if (parts.length === 1) {
    return {
      purok: '-',
      municipality: parts[0]
    };
  }
  return { purok: '-', municipality: '-' };
}

window.filterRegistryCategory = function(cat) {
  if (cat === 'unused-booths') cat = 'inactive-booths';
  sfx.playClick();
  currentRegistryCategory = cat;
  registryCurrentPage = 1;

  ['all', 'tellers', 'relievers', 'inactive-booths', 'unused-booths', 'terminated', 'supervisors', 'collectors'].forEach(c => {
    const btn = document.getElementById(`tab-btn-${c}`);
    if (btn) {
      if (c === cat || (c === 'inactive-booths' && cat === 'unused-booths') || (c === 'unused-booths' && cat === 'inactive-booths')) {
        btn.classList.remove('btn-secondary');
        btn.classList.add('btn-primary');
      } else {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-secondary');
      }
    }
  });

  renderEmployeesTable();
};

window.changeRowsPerPage = function(val) {
  sfx.playClick();
  registryRowsPerPage = parseInt(val, 10) || 15;
  registryCurrentPage = 1;
  renderEmployeesTable();
};

window.goToRegistryPage = function(page) {
  sfx.playClick();
  registryCurrentPage = page;
  renderEmployeesTable();
};

window.updateEmployeeStatus = function(id, newStatus, empName = null) {
  if (window.sfx) sfx.playClick();
  const normStatus = (newStatus || 'ACTIVE').toUpperCase();
  window.appStore.updateEmployee(id, { status: normStatus, _targetName: empName }, empName);
  renderEmployeesTable();
  if (window.orgChartModule && typeof window.orgChartModule.render === 'function') window.orgChartModule.render();
  if (typeof renderFleetTrackingList === 'function') renderFleetTrackingList();
  if (window.etsMap && typeof window.etsMap.renderAllMarkers === 'function') window.etsMap.renderAllMarkers();
};

window.updateEmployeePrinter = function(id, newPrinter, empName = null) {
  if (window.sfx) sfx.playClick();
  const val = newPrinter === 'WITH PORTABLE PRINTER' ? 'WITH PORTABLE PRINTER' : 'N/A';
  window.appStore.updateEmployee(id, { printerName: val, printerSerial: val, _targetName: empName }, empName);
  renderEmployeesTable();
  if (typeof renderFleetTrackingList === 'function') renderFleetTrackingList();
};

window.handleRoleChangeInModal = function(role) {
  const rUpper = (role || '').toUpperCase();
  const deptSelect = document.getElementById('emp-form-dept');
  if (!deptSelect) return;
  if (rUpper.includes('COLLECTOR')) {
    deptSelect.value = 'dept-col';
  } else if (rUpper.includes('SUPERVISOR')) {
    deptSelect.value = 'dept-sup';
  } else if (rUpper.includes('ADMINISTRATOR') || rUpper.includes('ADMIN') || rUpper.includes('TEAM LEADER')) {
    deptSelect.value = 'dept-admin';
  } else {
    deptSelect.value = 'dept-tel';
  }
};

window.handleDeptChangeInModal = function(dept) {
  const dVal = (dept || '').toLowerCase();
  const roleSelect = document.getElementById('emp-form-role');
  if (!roleSelect) return;
  if (dVal === 'dept-col' || dVal.includes('collector')) {
    roleSelect.value = 'COLLECTOR';
  } else if (dVal === 'dept-sup' || dVal.includes('supervisor')) {
    roleSelect.value = 'SUPERVISOR';
  } else if (dVal === 'dept-admin' || dVal.includes('admin')) {
    roleSelect.value = 'OPERATIONS ADMINISTRATOR';
  } else {
    if (roleSelect.value !== 'RELIEVER') {
      roleSelect.value = 'TELLER';
    }
  }
};

let pendingDeleteEmployeeId = null;
let pendingDeleteTargetName = '';

window.requestDeleteEmployee = function(id, targetName = null) {
  if (window.authManager && !window.authManager.isAdmin()) {
    alert('Permission Denied: Only Administrators can delete records.');
    return;
  }
  if (window.sfx) sfx.playAlert();
  pendingDeleteEmployeeId = id;
  const store = window.appStore;
  let emp = null;
  if (targetName && (id === 'DDN005-SR000' || !id || id === 'N/A')) {
    emp = store.getEmployees().find(e => e.name && e.name.toLowerCase().trim() === targetName.toLowerCase().trim()) ||
          (store.data.relievers && store.data.relievers.find(r => r.name && r.name.toLowerCase().trim() === targetName.toLowerCase().trim()));
  }
  if (!emp) {
    emp = store.getEmployees().find(e => e.id === id) || 
          (store.data.relievers && store.data.relievers.find(r => r.id === id));
  }
  const booth = (store.data && store.data.booths) ? store.data.booths.find(b => b.id === id || b.id === `BOOTH-${id}` || b.code === id) : null;
  
  const empName = emp ? (emp.name && emp.name !== 'N/A' ? `${emp.name} (${emp.id})` : `Booth ${emp.boothCode || emp.id}`) : (booth ? `Station ${booth.id}` : id);
  pendingDeleteTargetName = emp ? emp.name : empName;

  const msgEl = document.getElementById('delete-confirm-message');
  if (msgEl) {
    const roleBadge = emp && emp.role ? `<span class="badge badge-info" style="font-size: 10px; text-transform: uppercase; margin-left: 6px;">${emp.role}</span>` : '';
    msgEl.innerHTML = `
      You are about to permanently delete <strong>${empName}</strong> ${roleBadge} from the system registry.<br>
      <span style="font-size: 12.5px; color: var(--text-muted); margin-top: 8px; display: block; line-height: 1.5;">
        ⚠️ This action cannot be undone. All assigned booth data, GPS tracking markers, and terminal linkages will be erased.
      </span>
    `;
  }
  document.getElementById('modal-delete-confirm').classList.add('active');
};

window.confirmDeleteEmployee = function() {
  if (!pendingDeleteEmployeeId) return;
  const deletedName = pendingDeleteTargetName || pendingDeleteEmployeeId;
  if (window.sfx) sfx.playChime();
  window.appStore.deleteEmployee(pendingDeleteEmployeeId, pendingDeleteTargetName);
  pendingDeleteEmployeeId = null;
  pendingDeleteTargetName = '';
  document.getElementById('modal-delete-confirm').classList.remove('active');
  renderEmployeesTable();
  if (window.orgChartModule && typeof window.orgChartModule.render === 'function') window.orgChartModule.render();
  renderFleetTrackingList();
  if (window.etsMap && window.etsMap.renderAllMarkers) {
    window.etsMap.renderAllMarkers();
  }
  alert(`✓ Data is successfully deleted: ${deletedName} has been permanently removed from the system registry.`);
};

window.cancelDeleteEmployee = function() {
  if (window.sfx) sfx.playClick();
  pendingDeleteEmployeeId = null;
  pendingDeleteTargetName = '';
  document.getElementById('modal-delete-confirm').classList.remove('active');
};

let pendingReactivateTellerId = null;

window.promptReactivateTeller = function(id) {
  if (window.authManager && !window.authManager.isAdmin()) {
    alert('Permission Denied: Only Administrators can reactivate tellers.');
    return;
  }
  if (window.sfx) sfx.playClick();
  pendingReactivateTellerId = id;
  const store = window.appStore;
  const emp = store.getEmployees().find(e => e.id === id);
  if (!emp) return;

  const nameEl = document.getElementById('reactivate-teller-name');
  const boothEl = document.getElementById('reactivate-teller-booth');
  if (nameEl) nameEl.textContent = `${emp.name} (${emp.id})`;
  if (boothEl) boothEl.textContent = emp.boothCode || emp.booth || '-';

  const modal = document.getElementById('modal-reactivate-confirm');
  if (modal) modal.classList.add('active');
};

window.confirmReactivateTeller = function() {
  if (!pendingReactivateTellerId) return;
  if (window.sfx) sfx.playChime();
  window.appStore.updateEmployee(pendingReactivateTellerId, { status: 'ACTIVE' });
  pendingReactivateTellerId = null;
  const modal = document.getElementById('modal-reactivate-confirm');
  if (modal) modal.classList.remove('active');
  renderEmployeesTable();
  alert('Teller status changed to ACTIVE and returned to the active registry.');
};

window.cancelReactivateTeller = function() {
  if (window.sfx) sfx.playClick();
  pendingReactivateTellerId = null;
  const modal = document.getElementById('modal-reactivate-confirm');
  if (modal) modal.classList.remove('active');
};

window.viewEmployeeDetails = function(id, empName = null) {
  window.editEmployee(id, true, empName);
};

function renderEmployeesTable(customList = null) {
  const tbody = document.getElementById('employee-table-tbody');
  if (!tbody) return;

  const store = window.appStore;
  if (store.sanitizeEmployeeIds) {
    store.sanitizeEmployeeIds();
  }
  const rawEmployees = store.getEmployees() || [];
  // Permanently filter out any fake buffer relievers
  const allStaff = rawEmployees.filter(e => !e.name || !e.name.includes('Buffer Reliever'));

  // Strictly categorize by role:
  const isLeadershipOrCollector = (emp) => {
    if (!emp) return false;
    const r = (emp.role || '').toUpperCase();
    const d = (emp.department || '').toLowerCase();
    return r.includes('ADMIN') || 
           r.includes('SUPERVISOR') || 
           r.includes('TEAM LEADER') || 
           r.includes('COLLECTOR') || 
           d === 'dept-admin' || 
           d === 'dept-sup' || 
           d === 'dept-col' || 
           d.includes('admin') || 
           d.includes('supervisor') || 
           d.includes('collector');
  };

  // Operational staff list for All Staff (excluding Leadership and Collectors)
  const allStaffOperational = allStaff.filter(e => !isLeadershipOrCollector(e));

  const supervisors = allStaff.filter(e => (e.role || '').toUpperCase().includes('SUPERVISOR') || (e.role || '').toUpperCase().includes('TEAM LEADER'));
  const collectors = allStaff.filter(e => (e.role || '').toUpperCase().includes('COLLECTOR'));
  const relieversList = allStaff.filter(e => {
    const r = (e.role || '').toUpperCase();
    const id = (e.id || '').toUpperCase();
    return r.includes('RELIEVER') || r.includes('RELIVER') || r.includes('BUFFER') || id.includes('-REL');
  });

  // Section 4: 3. Sales Representatives Registry must count ACTIVE Sales Representatives only.
  // Inactive Sales Representatives must NOT be included in this count.
  const tellers = allStaff.filter(e => {
    const r = (e.role || '').toUpperCase();
    const id = (e.id || '').toUpperCase();
    const isOtherRole = r.includes('RELIEVER') || r.includes('RELIVER') || r.includes('BUFFER') || id.includes('-REL') || 
                        r.includes('SUPERVISOR') || r.includes('COLLECTOR') || r.includes('TEAM LEADER') || r.includes('ADMIN');
    if (isOtherRole) return false;
    const statusUpper = (e.status || 'ACTIVE').toUpperCase();
    const isNameMissing = !e.name || e.name.trim() === '' || e.name.trim().toUpperCase() === 'N/A' || e.name.trim() === '-';
    return statusUpper === 'ACTIVE' && !isNameMissing;
  });

  // Section 5: 6. Terminated Tellers Registry
  const terminatedTellers = allStaff.filter(e => {
    const r = (e.role || '').toUpperCase();
    const id = (e.id || '').toUpperCase();
    const isOtherRole = r.includes('RELIEVER') || r.includes('RELIVER') || r.includes('BUFFER') || id.includes('-REL') || 
                        r.includes('SUPERVISOR') || r.includes('COLLECTOR') || r.includes('TEAM LEADER') || r.includes('ADMIN');
    if (isOtherRole) return false;
    return (e.status || '').toUpperCase() === 'TERMINATED';
  });


  // Section 3: 5. Unused Booths (The 7 Authentic Operational Booths without Assigned Tellers from September 2026 Masterlist)
  const seenUnusedBoothCodes = new Set();
  const unusedBooths = [];

  // A. Include the 7 authentic unused booths from RAW_UNUSED_BOOTHS (or fallback definitions)
  if (typeof RAW_UNUSED_BOOTHS !== 'undefined' && Array.isArray(RAW_UNUSED_BOOTHS)) {
    RAW_UNUSED_BOOTHS.forEach(ub => {
      const bCode = ub.boothCode.toUpperCase();
      seenUnusedBoothCodes.add(bCode);
      const storeBooth = (store.data && store.data.booths) ? store.data.booths.find(b => (b.id && b.id.toUpperCase() === bCode) || (b.code && b.code.toUpperCase() === bCode)) : null;
      unusedBooths.push({
        id: ub.id,
        name: (storeBooth && storeBooth.assignedTellerName && storeBooth.assignedTellerName !== '-') ? storeBooth.assignedTellerName : 'N/A',
        role: 'N/A',
        department: 'dept-tel',
        purok: (storeBooth && storeBooth.purok) ? storeBooth.purok : ub.purok,
        municipality: (storeBooth && storeBooth.municipality) ? storeBooth.municipality : ub.municipality,
        address: (storeBooth && storeBooth.area) ? storeBooth.area : ub.address,
        area: (storeBooth && storeBooth.area) ? storeBooth.area : ub.area,
        boothCode: ub.boothCode,
        booth: ub.boothCode,
        lat: (storeBooth && storeBooth.lat) ? storeBooth.lat : ub.lat,
        lng: (storeBooth && storeBooth.lng) ? storeBooth.lng : ub.lng,
        coordinates: (storeBooth && storeBooth.coordinates) ? storeBooth.coordinates : ub.coordinates,
        phone: (storeBooth && storeBooth.phone) ? storeBooth.phone : ub.phone,
        status: 'UNUSED',
        posSerial: (storeBooth && storeBooth.posSerial) ? storeBooth.posSerial : ub.posSerial,
        printerName: 'N/A',
        printerSerial: 'N/A'
      });
    });
  }

  // B. Also include any other booths from store.data.booths with status === 'UNUSED'
  const allBooths = (store.data && store.data.booths) ? store.data.booths : [];
  allBooths.forEach(b => {
    const bCode = (b.id || b.code || '').trim().toUpperCase().replace(/^BOOTH-/, '');
    if (!bCode || bCode === '-' || seenUnusedBoothCodes.has(bCode)) return;
    const isUnused = (b.status || '').toUpperCase() === 'UNUSED';
    if (isUnused) {
      seenUnusedBoothCodes.add(bCode);
      unusedBooths.push({
        id: b.id.startsWith('DDN005-') ? b.id : `DDN005-SR${bCode.replace(/[^0-9]/g, '').padStart(3, '0')}`,
        name: b.assignedTellerName || 'N/A',
        role: 'N/A',
        department: 'dept-tel',
        purok: b.purok || '-',
        municipality: b.municipality || 'Sto. Tomas',
        address: b.area || `${b.purok || '-'}, ${b.municipality || 'Sto. Tomas'}`,
        area: b.area || b.municipality,
        boothCode: bCode,
        booth: bCode,
        lat: b.lat,
        lng: b.lng,
        coordinates: (b.lat && b.lng) ? { lat: b.lat, lng: b.lng } : null,
        phone: b.phone || 'N/A',
        status: 'UNUSED',
        posSerial: b.posSerial || `POS-${bCode}`,
        printerName: b.printerSerial ? 'WITH PORTABLE PRINTER' : 'N/A',
        printerSerial: b.printerSerial || 'N/A'
      });
    }
  });

  const inactiveBooths = unusedBooths; // alias for backwards compatibility

  // Update dynamic counter badges (All Staff count excludes Leadership & Collectors)
  if (document.getElementById('count-all')) document.getElementById('count-all').textContent = allStaffOperational.length;
  if (document.getElementById('count-supervisors')) document.getElementById('count-supervisors').textContent = supervisors.length;
  if (document.getElementById('count-collectors')) document.getElementById('count-collectors').textContent = collectors.length;
  if (document.getElementById('count-tellers')) document.getElementById('count-tellers').textContent = tellers.length;
  if (document.getElementById('count-relievers')) document.getElementById('count-relievers').textContent = relieversList.length;
  if (document.getElementById('count-inactive-booths')) document.getElementById('count-inactive-booths').textContent = unusedBooths.length;
  if (document.getElementById('count-unused-booths')) document.getElementById('count-unused-booths').textContent = unusedBooths.length;
  if (document.getElementById('count-terminated')) document.getElementById('count-terminated').textContent = terminatedTellers.length;

  const empBadge = document.getElementById('sidebar-emp-count');
  if (empBadge) empBadge.textContent = allStaffOperational.length;

  let list = customList ? customList.filter(e => !isLeadershipOrCollector(e)) : null;
  if (!list) {
    if (currentRegistryCategory === 'tellers') {
      list = tellers;
    } else if (currentRegistryCategory === 'relievers') {
      list = relieversList;
    } else if (currentRegistryCategory === 'inactive-booths' || currentRegistryCategory === 'unused-booths') {
      list = unusedBooths;
    } else if (currentRegistryCategory === 'terminated') {
      list = terminatedTellers;
    } else if (currentRegistryCategory === 'supervisors') {
      list = supervisors;
    } else if (currentRegistryCategory === 'collectors') {
      list = collectors;
    } else {
      list = allStaffOperational;
    }
  }

  // Pagination calculation
  const totalCount = list.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / registryRowsPerPage));
  if (registryCurrentPage > totalPages) registryCurrentPage = totalPages;
  if (registryCurrentPage < 1) registryCurrentPage = 1;

  const startIndex = (registryCurrentPage - 1) * registryRowsPerPage;
  const pageItems = list.slice(startIndex, startIndex + registryRowsPerPage);

  // Render Table Body for All 11 Exact Columns:
  // | ID No. | Full Name | Role | Purok / Street / Barangay | Municipality | Booth Code | GPS Coordinates | Contact Phone | Status | POS Serial No. | PORTABLE PRINTER NAME | Actions |
  const isAdmin = typeof window.authManager !== 'undefined' ? window.authManager.isAdmin() : true;
  tbody.innerHTML = pageItems.map(emp => {
    let roleUpper = (emp.role || 'SALES REPRESENTATIVE').toUpperCase();
    if (roleUpper === 'TELLER' || roleUpper === 'STATION TELLER') roleUpper = 'SALES REPRESENTATIVE';
    else if (roleUpper === 'RELIVER') roleUpper = 'RELIEVER';

    let roleBadge = 'badge-info';
    if (roleUpper.includes('SUPERVISOR')) roleBadge = 'badge-purple';
    else if (roleUpper.includes('TEAM LEADER')) roleBadge = 'badge-teal';
    else if (roleUpper.includes('COLLECTOR')) roleBadge = 'badge-warning';
    else if (roleUpper.includes('RELIEVER') || roleUpper.includes('BUFFER') || emp.id === 'DDN005-SR000') roleBadge = 'badge-neutral';

    const isReliever = roleUpper.includes('RELIEVER') || roleUpper.includes('BUFFER') || emp.id === 'DDN005-SR000';

    // 1. Purok / Street / Barangay & 2. Municipality
    // Auto-clean any legacy dangling slash puroks
    let rawP = emp.purok;
    if (rawP === 'Tagum / Kapalong /' || rawP === 'Carmen /' || (typeof rawP === 'string' && rawP.trim().endsWith('/'))) {
      rawP = '-';
      emp.purok = '-';
    }

    let purok = '-';
    let muni = '-';

    if (isReliever) {
      purok = '-';
      const normName = (emp.name || '').toLowerCase().trim();
      const authMuni = (typeof window.getRelieverMunicipality === 'function')
        ? window.getRelieverMunicipality(emp.name)
        : ((typeof getRelieverMunicipality === 'function')
          ? getRelieverMunicipality(emp.name)
          : (typeof OFFICIAL_RELIEVER_MUNICIPALITIES !== 'undefined' && OFFICIAL_RELIEVER_MUNICIPALITIES[normName]
            ? OFFICIAL_RELIEVER_MUNICIPALITIES[normName]
            : (emp.municipality && !emp.municipality.includes('Davao Sector') && emp.municipality !== '-' && emp.municipality !== 'N/A' ? emp.municipality : 'Sto. Tomas')));
      muni = authMuni;
      // Self-heal reliever state in memory
      emp.municipality = authMuni;
      emp.purok = '-';
      emp.address = `-, ${authMuni}`;
      emp.area = emp.address;
      emp.booth = '-';
      emp.boothCode = '-';
      emp.lat = null;
      emp.lng = null;
      emp.coordinates = null;
      emp.etsStatus = 'Offline';
    } else {
      purok = (rawP !== undefined && rawP !== null && String(rawP).trim() !== '') ? String(rawP).trim() : '-';
      const rawM = (emp.municipality !== undefined && emp.municipality !== null) ? String(emp.municipality).trim() : '';
      const isBadMuni = !rawM || rawM === '-' || rawM === 'N/A' || rawM.includes('Davao Sector') || rawM.includes('Davao Del Norte');
      if (!isBadMuni) {
        muni = rawM;
      } else {
        const rawA = (emp.area && emp.area !== '-' && !emp.area.includes('Davao Sector') && !emp.area.includes('Davao Del Norte')) ? emp.area : '';
        if (rawA) {
          muni = rawA;
        } else {
          const parsed = parseAddressHelper(emp.address || emp.area || '');
          if (parsed.municipality && parsed.municipality !== '-' && !parsed.municipality.includes('Davao Sector') && !parsed.municipality.includes('Davao Del Norte')) {
            muni = parsed.municipality;
          } else {
            muni = 'Sto. Tomas';
          }
          if (purok === '-' || !purok) purok = parsed.purok;
        }
      }
    }

    // 3. Booth Code (Checks boothCode or booth)
    const displayBooth = isReliever ? '-' : ((emp.boothCode && emp.boothCode !== '-') ? emp.boothCode : (emp.booth && emp.booth !== '-' ? emp.booth : '-'));

    // 4. GPS Coordinates (Checks lat/lng or coordinates object)
    let latVal = isReliever ? null : ((emp.lat !== undefined && emp.lat !== null && emp.lat !== '' && !isNaN(emp.lat)) ? Number(emp.lat) : (emp.coordinates && emp.coordinates.lat !== undefined && emp.coordinates.lat !== null && emp.coordinates.lat !== '' && !isNaN(emp.coordinates.lat) ? Number(emp.coordinates.lat) : null));
    let lngVal = isReliever ? null : ((emp.lng !== undefined && emp.lng !== null && emp.lng !== '' && !isNaN(emp.lng)) ? Number(emp.lng) : (emp.coordinates && emp.coordinates.lng !== undefined && emp.coordinates.lng !== null && emp.coordinates.lng !== '' && !isNaN(emp.coordinates.lng) ? Number(emp.coordinates.lng) : null));
    const gpsDisplay = (latVal !== null && lngVal !== null) ? `${latVal.toFixed(6)}, ${lngVal.toFixed(6)}` : '-';

    // 5. Contact Phone
    const phoneDisplay = emp.phone || emp.contact || '-';

    // 6. POS Serial No.
    const posDisplay = emp.posSerial || emp.pos || (displayBooth !== '-' ? `POS-${displayBooth}` : '-');

    // 7. PORTABLE PRINTER NAME (Dropdown: WITH PORTABLE PRINTER or N/A)
    const rawPr = (emp.printerName || emp.printerSerial || '').toUpperCase().trim();
    const isWithPrinter = rawPr.includes('WITH') || rawPr.includes('PRT-') || rawPr.includes('PRINTER') || rawPr.includes('PORTABLE');
    const printerVal = isWithPrinter ? 'WITH PORTABLE PRINTER' : 'N/A';

    // 8. Status styling
    const statusUpper = (emp.status || 'ACTIVE').toUpperCase();
    let statusStyle = 'border: 1px solid rgba(16, 185, 129, 0.4); background: rgba(16, 185, 129, 0.15); color: #10b981;';
    if (statusUpper === 'INACTIVE') {
      statusStyle = 'border: 1px solid rgba(245, 158, 11, 0.4); background: rgba(245, 158, 11, 0.15); color: #f59e0b;';
    } else if (statusUpper === 'UNUSED') {
      statusStyle = 'border: 1px solid rgba(148, 163, 184, 0.4); background: rgba(148, 163, 184, 0.15); color: #94a3b8;';
    } else if (statusUpper === 'TERMINATED') {
      statusStyle = 'border: 1px solid rgba(239, 68, 68, 0.4); background: rgba(239, 68, 68, 0.15); color: #ef4444;';
    }

    const safeEmpName = (emp.name || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    return `
      <tr>
        <td><code style="font-weight: 700; color: var(--primary); font-size: 12px;">${emp.id}</code></td>
        <td>
          <span style="font-weight: 600; color: var(--text-main);">${emp.name}</span>
        </td>
        <td>
          <span class="badge ${roleBadge}" style="font-size: 11px; font-weight: 700; text-transform: uppercase;">${roleUpper}</span>
        </td>
        <td><strong style="font-size: 12px; color: var(--text-main); font-weight: 700;">${purok || '-'}</strong></td>
        <td><strong style="font-size: 12.5px; color: var(--text-main); font-weight: 700;">${muni || '-'}</strong></td>
        <td><code style="font-weight: 700; font-size: 12px; color: ${displayBooth !== '-' ? 'var(--primary)' : 'var(--text-dim)'};">${displayBooth}</code></td>
        <td style="font-family: monospace; font-size: 11px;">
          <strong style="font-weight: 700; color: var(--text-main);">${gpsDisplay}</strong>
        </td>
        <td>
          <span style="font-family: monospace; font-size: 11.5px; color: var(--text-main);">${phoneDisplay}</span>
        </td>
        <td style="text-align: center;">
          <select class="form-select" style="padding: 3px 8px; font-size: 11px; font-weight: 700; width: auto; border-radius: 4px; display: inline-block; margin: 0 auto; ${statusStyle}" ${!isAdmin ? 'disabled title="Supervisor: View-only"' : `onchange="window.updateEmployeeStatus('${emp.id}', this.value, '${safeEmpName}')"`}>
            <option value="ACTIVE" ${statusUpper === 'ACTIVE' ? 'selected' : ''}>ACTIVE</option>
            <option value="INACTIVE" ${statusUpper === 'INACTIVE' ? 'selected' : ''}>INACTIVE</option>
            <option value="UNUSED" ${statusUpper === 'UNUSED' ? 'selected' : ''}>UNUSED</option>
            <option value="TERMINATED" ${statusUpper === 'TERMINATED' ? 'selected' : ''}>TERMINATED</option>
          </select>
        </td>
        <td>
          <code style="font-weight: 700; font-size: 11.5px; color: var(--text-main);">${posDisplay}</code>
        </td>
        <td style="text-align: center;">
          <select class="form-select" style="padding: 3px 8px; font-size: 11px; font-weight: 700; width: auto; border-radius: 4px; display: inline-block; margin: 0 auto; ${isWithPrinter ? 'border-color: rgba(16, 185, 129, 0.4); color: #10b981; background: rgba(16, 185, 129, 0.1);' : 'color: var(--text-muted);'}" ${!isAdmin ? 'disabled title="Supervisor: View-only"' : `onchange="window.updateEmployeePrinter('${emp.id}', this.value, '${safeEmpName}')"`}>
            <option value="WITH PORTABLE PRINTER" ${isWithPrinter ? 'selected' : ''}>WITH PORTABLE PRINTER</option>
            <option value="N/A" ${!isWithPrinter ? 'selected' : ''}>N/A</option>
          </select>
        </td>
        <td style="text-align: center;">
          <div style="display: flex; gap: 4px; align-items: center; justify-content: center;">
            ${(() => {
              if (isAdmin) {
                if (statusUpper === 'TERMINATED') {
                  return `
                    <button class="btn btn-outline-success btn-sm" style="padding: 3px 8px; font-size: 11px; font-weight:700; background:rgba(16,185,129,0.15); color:#10b981; border:1px solid #10b981;" onclick="window.promptReactivateTeller('${emp.id}', '${safeEmpName}')" title="Reactivate Teller">
                      🔄 Reactivate
                    </button>
                    <button class="btn btn-secondary btn-sm" style="padding: 3px 8px; font-size: 11px;" onclick="window.editEmployee('${emp.id}', false, '${safeEmpName}')" title="Edit Terminated Staff Record">
                      ✏️ Edit
                    </button>
                    <button class="btn btn-secondary btn-sm" style="padding: 3px 8px; font-size: 11px; color: var(--danger); border-color: rgba(239, 68, 68, 0.4);" onclick="window.requestDeleteEmployee('${emp.id}', '${safeEmpName}')" title="Delete Record">
                      🗑️ Delete
                    </button>
                    <input type="checkbox" class="registry-row-checkbox" value="${emp.id}" ${window.selectedRegistryEmpIds && window.selectedRegistryEmpIds.has(emp.id) ? 'checked' : ''} onchange="window.toggleRegistryRowSelection('${emp.id}', this.checked)" style="cursor:pointer; transform:scale(1.15); margin-left: 4px;" title="Select employee for bulk delete">
                  `;
                }
                return `
                  <button class="btn btn-secondary btn-sm" style="padding: 3px 8px; font-size: 11px;" onclick="window.editEmployee('${emp.id}', false, '${safeEmpName}')" title="Edit Staff Member">
                    ✏️ Edit
                  </button>
                  <button class="btn btn-secondary btn-sm" style="padding: 3px 8px; font-size: 11px; color: var(--danger); border-color: rgba(239, 68, 68, 0.4);" onclick="window.requestDeleteEmployee('${emp.id}', '${safeEmpName}')" title="Delete Record">
                    🗑️ Delete
                  </button>
                  <input type="checkbox" class="registry-row-checkbox" value="${emp.id}" ${window.selectedRegistryEmpIds && window.selectedRegistryEmpIds.has(emp.id) ? 'checked' : ''} onchange="window.toggleRegistryRowSelection('${emp.id}', this.checked)" style="cursor:pointer; transform:scale(1.15); margin-left: 4px;" title="Select employee for bulk delete">
                  <button class="btn btn-primary btn-sm" style="padding: 3px 8px; font-size: 11px;" onclick="window.showQrPass('${emp.id}')" title="View Digital Pass">
                    🪪 Pass
                  </button>
                `;
              } else {
                // Supervisor: Master Registry is VIEW-ONLY!
                return `
                  <button class="btn btn-secondary btn-sm" style="padding: 3px 8px; font-size: 11px;" onclick="window.viewEmployeeDetails('${emp.id}', '${safeEmpName}')" title="View Staff Details (Read-Only)">
                    👁️ Details
                  </button>
                  <button class="btn btn-primary btn-sm" style="padding: 3px 8px; font-size: 11px;" onclick="window.showQrPass('${emp.id}')" title="View Digital Pass">
                    🪪 Pass
                  </button>
                `;
              }
            })()}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Render Pagination Controls
  renderRegistryPagination(totalCount, totalPages);
  if (typeof window.updateRegistrySelectionUI === 'function') window.updateRegistrySelectionUI();
}

function renderRegistryPagination(totalCount, totalPages) {
  const pageInfo = document.getElementById('registry-page-info');
  const controls = document.getElementById('registry-pagination-controls');
  if (!pageInfo || !controls) return;

  pageInfo.textContent = `Page ${registryCurrentPage} of ${totalPages}`;

  let html = '';

  // Previous button
  const prevDisabled = registryCurrentPage <= 1 ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : '';
  html += `<button class="btn btn-secondary btn-sm" ${prevDisabled} onclick="window.goToRegistryPage(${registryCurrentPage - 1})">Previous</button>`;

  // Numbered page buttons (1, 2, 3, 4, 5, etc.)
  for (let p = 1; p <= totalPages; p++) {
    const isActive = p === registryCurrentPage;
    const btnClass = isActive ? 'btn-primary' : 'btn-secondary';
    html += `<button class="btn ${btnClass} btn-sm" style="min-width: 32px; padding: 4px 8px; font-weight: 700;" onclick="window.goToRegistryPage(${p})">${p}</button>`;
  }

  // Next button
  const nextDisabled = registryCurrentPage >= totalPages ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : '';
  html += `<button class="btn btn-secondary btn-sm" ${nextDisabled} onclick="window.goToRegistryPage(${registryCurrentPage + 1})">Next</button>`;

  controls.innerHTML = html;
}

/* --- MASTER REGISTRY BULK SELECTION & ACTIONS (SELECT ALL / UNSELECT ALL / BULK DELETE) --- */
window.selectedRegistryEmpIds = new Set();

window.toggleRegistryRowSelection = function(id, isChecked) {
  if (!id) return;
  if (!window.selectedRegistryEmpIds) window.selectedRegistryEmpIds = new Set();
  if (isChecked) {
    window.selectedRegistryEmpIds.add(id);
  } else {
    window.selectedRegistryEmpIds.delete(id);
  }
  window.updateRegistrySelectionUI();
};

window.toggleRegistrySelectAll = function(forceState) {
  if (!window.selectedRegistryEmpIds) window.selectedRegistryEmpIds = new Set();
  const store = window.appStore;
  const emps = (store && typeof store.getEmployees === 'function') ? store.getEmployees() : [];
  const staff = emps.filter(e => {
    const r = (e.role || '').toUpperCase();
    return !r.includes('ADMIN') && !r.includes('SUPERVISOR') && !r.includes('COLLECTOR');
  });
  const uniqueStaffIds = new Set(staff.map(e => e.id));
  if (uniqueStaffIds.size === 0) return;

  const shouldSelect = typeof forceState === 'boolean'
    ? forceState
    : window.selectedRegistryEmpIds.size < uniqueStaffIds.size;

  if (shouldSelect) {
    uniqueStaffIds.forEach(id => window.selectedRegistryEmpIds.add(id));
  } else {
    window.selectedRegistryEmpIds.clear();
  }
  renderEmployeesTable();
};

window.unselectRegistryAll = function() {
  if (window.selectedRegistryEmpIds) window.selectedRegistryEmpIds.clear();
  renderEmployeesTable();
};

window.updateRegistrySelectionUI = function() {
  const banner = document.getElementById('registry-selection-banner');
  const countEl = document.getElementById('registry-selected-count');
  const actionSelectAllCb = document.getElementById('registry-select-all-checkbox');
  const actionSelectAllLabel = document.getElementById('registry-select-all-label');

  const store = window.appStore;
  const emps = (store && typeof store.getEmployees === 'function') ? store.getEmployees() : [];
  const staff = emps.filter(e => {
    const r = (e.role || '').toUpperCase();
    return !r.includes('ADMIN') && !r.includes('SUPERVISOR') && !r.includes('COLLECTOR');
  });
  const uniqueStaffIds = new Set(staff.map(e => e.id));
  const count = window.selectedRegistryEmpIds ? window.selectedRegistryEmpIds.size : 0;
  const allSelected = uniqueStaffIds.size > 0 && count >= uniqueStaffIds.size;

  if (countEl) countEl.textContent = count;
  if (banner) {
    banner.style.display = count > 0 ? 'flex' : 'none';
  }
  if (actionSelectAllCb) {
    actionSelectAllCb.checked = allSelected;
    actionSelectAllCb.indeterminate = count > 0 && count < uniqueStaffIds.size;
  }
  if (actionSelectAllLabel) {
    actionSelectAllLabel.textContent = allSelected ? 'UNSELECT ALL' : 'SELECT ALL';
  }

  if (typeof document !== 'undefined') {
    const rowCheckboxes = document.querySelectorAll('.registry-row-checkbox');
    rowCheckboxes.forEach(cb => {
      cb.checked = window.selectedRegistryEmpIds && window.selectedRegistryEmpIds.has(cb.value);
    });
  }
};

window.deleteSelectedRegistryEmployees = async function() {
  if (!window.authManager || !window.authManager.isAdmin()) {
    alert('Permission Denied: Only Administrators can delete personnel records.');
    return;
  }
  const count = window.selectedRegistryEmpIds ? window.selectedRegistryEmpIds.size : 0;
  if (count === 0) {
    alert('Please select one or more master registry records to delete.');
    return;
  }

  const confirmMsg = `Are you sure you want to permanently delete the ${count} selected master registry personnel record(s)? This action cannot be undone.`;
  const shouldDelete = (typeof confirm === 'function')
    ? confirm(confirmMsg)
    : (typeof window !== 'undefined' && typeof window.confirm === 'function' ? window.confirm(confirmMsg) : true);
  if (!shouldDelete) return;

  const idsToDelete = Array.from(window.selectedRegistryEmpIds);
  for (const id of idsToDelete) {
    if (window.appStore && typeof window.appStore.deleteEmployee === 'function') {
      window.appStore.deleteEmployee(id);
    }
  }

  window.selectedRegistryEmpIds.clear();
  renderEmployeesTable();
  if (typeof updateStats === 'function') updateStats();
  alert(`Successfully deleted ${idsToDelete.length} master registry personnel record(s).`);
};

window.filterEmployees = function() {
  const input = document.getElementById('employee-search-input');
  const query = (input ? input.value : '').trim().toLowerCase();
  const store = window.appStore;
  registryCurrentPage = 1;

  if (!query) {
    // When search is cleared/empty, strictly revert to the default All Staff view
    // (which excludes Supervisors, Collectors, and Operations Administrator)
    renderEmployeesTable();
    return;
  }

  // Master Registry Search: MUST strictly search the Master Registry personnel dataset only.
  // Never include Operations Administrator, Supervisors, or Collectors.
  const employees = store.getEmployees() || [];
  const relievers = (store.data && store.data.relievers) || [];
  const allStaff = [...employees, ...relievers.filter(r => !employees.some(e => e.id === r.id))];
  
  // Strictly filter out leadership & collectors to guarantee Master Registry boundary
  const masterRegistryStaff = allStaff.filter(e => {
    if (!e) return false;
    const r = (e.role || '').toUpperCase();
    const d = (e.department || '').toLowerCase();
    const isLeadershipOrCol = r.includes('ADMIN') || r.includes('SUPERVISOR') || r.includes('TEAM LEADER') || r.includes('COLLECTOR') ||
                              d === 'dept-admin' || d === 'dept-sup' || d === 'dept-col' ||
                              d.includes('admin') || d.includes('supervisor') || d.includes('collector');
    return !isLeadershipOrCol;
  });

  const filtered = masterRegistryStaff.filter(e => {
    return (e.name && e.name.toLowerCase().includes(query)) ||
           (e.id && e.id.toLowerCase().includes(query)) ||
           (e.boothCode && e.boothCode.toLowerCase().includes(query)) ||
           (e.booth && e.booth.toLowerCase().includes(query)) ||
           (e.address && e.address.toLowerCase().includes(query)) ||
           (e.purok && e.purok.toLowerCase().includes(query)) ||
           (e.municipality && e.municipality.toLowerCase().includes(query)) ||
           (e.phone && e.phone.toLowerCase().includes(query)) ||
           (e.contact && e.contact.toLowerCase().includes(query)) ||
           (e.role && e.role.toLowerCase().includes(query)) ||
           (e.posSerial && e.posSerial.toLowerCase().includes(query)) ||
           (e.pos && e.pos.toLowerCase().includes(query)) ||
           (e.printerSerial && e.printerSerial.toLowerCase().includes(query)) ||
           (e.printerName && e.printerName.toLowerCase().includes(query)) ||
           (e.area && e.area.toLowerCase().includes(query));
  });
  renderEmployeesTable(filtered);
};

window.showQrPass = function(id) {
  sfx.playClick();
  const store = window.appStore;
  const emp = store.getEmployees().find(e => e.id === id) || 
              (store.data.relievers && store.data.relievers.find(r => r.id === id));
  if (!emp) {
    alert('Employee record not found: ' + id);
    return;
  }

  const roleUpper = (emp.role || 'STAFF').toUpperCase();
  const boothDisplay = (emp.boothCode && emp.boothCode !== '-') ? emp.boothCode : (emp.booth || '-');
  const muniDisplay = emp.municipality || emp.area || 'Davao Del Norte';
  const qrData = encodeURIComponent(`APEX-DDN005|${emp.id}|${emp.name}|${roleUpper}|${boothDisplay}`);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${qrData}`;

  const content = document.getElementById('qr-modal-content');
  content.innerHTML = `
    <div style="background: linear-gradient(135deg, #1e3a8a, #2563eb); color: #fff; padding: 18px; border-radius: 8px; margin-bottom: 16px; text-align: left; box-shadow: 0 4px 12px rgba(30, 58, 138, 0.35);">
      <div style="font-size: 10.5px; text-transform: uppercase; letter-spacing: 1.5px; opacity: 0.85;">Apex Mindanao Operations • Davao Del Norte</div>
      <div style="font-size: 18px; font-weight: 800; margin-top: 4px; letter-spacing: -0.5px;">${emp.name}</div>
      <div style="display: flex; gap: 8px; align-items: center; margin-top: 6px;">
        <span style="font-size: 11px; font-weight: 700; background: rgba(255,255,255,0.22); padding: 2px 8px; border-radius: 4px;">${roleUpper}</span>
        <span style="font-size: 12px; font-family: monospace; opacity: 0.9;">${emp.id}</span>
      </div>
      <div style="font-size: 11.5px; margin-top: 10px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 8px; opacity: 0.95; display: flex; flex-direction: column; gap: 3px;">
        <div><strong>Assigned Booth:</strong> <code>${boothDisplay}</code></div>
        <div><strong>Municipality:</strong> ${muniDisplay}</div>
        <div><strong>Contact Phone:</strong> ${emp.phone || '-'}</div>
        <div><strong>POS Serial No.:</strong> ${emp.posSerial || '-'}</div>
        <div><strong>PORTABLE PRINTER NAME:</strong> ${emp.printerSerial || emp.printerName || 'N/A'}</div>
        <div><strong>GPS Location:</strong> ${emp.lat ? `${emp.lat.toFixed(4)}, ${emp.lng.toFixed(4)}` : 'Outlet Anchored'}</div>
      </div>
    </div>
    <div style="display: inline-block; padding: 12px; background: #ffffff; border: 2px solid var(--border-color); border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
      <img src="${qrUrl}" alt="QR ID Pass" style="width: 160px; height: 160px; display: block;" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'160\\' height=\\'160\\' viewBox=\\'0 0 100 100\\'><rect width=\\'100\\' height=\\'100\\' fill=\\'%23fff\\'/><rect x=\\'10\\' y=\\'10\\' width=\\'30\\' height=\\'30\\' fill=\\'%23000\\'/><rect x=\\'15\\' y=\\'15\\' width=\\'20\\' height=\\'20\\' fill=\\'%23fff\\'/><rect x=\\'60\\' y=\\'10\\' width=\\'30\\' height=\\'30\\' fill=\\'%23000\\'/><rect x=\\'65\\' y=\\'15\\' width=\\'20\\' height=\\'20\\' fill=\\'%23fff\\'/><rect x=\\'10\\' y=\\'60\\' width=\\'30\\' height=\\'30\\' fill=\\'%23000\\'/><rect x=\\'15\\' y=\\'65\\' width=\\'20\\' height=\\'20\\' fill=\\'%23fff\\'/><rect x=\\'45\\' y=\\'45\\' width=\\'15\\' height=\\'15\\' fill=\\'%23000\\'/><text x=\\'50\\' y=\\'92\\' font-size=\\'7\\' text-anchor=\\'middle\\'>OFFICIAL PASS</text></svg>'">
    </div>
    <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 12px;">
      Official Employee Identification Card • Verified by Davao Del Norte Sector Command.
    </div>
  `;
  document.getElementById('modal-qr').classList.add('active');
};

window.openAddEmployeeModal = function() {
  if (window.sfx) sfx.playClick();
  window._currentEditingEmployeeTargetName = null;
  document.getElementById('modal-employee-title').textContent = 'Register New Staff Member';
  document.getElementById('emp-form-id').value = '';
  const idDisplay = document.getElementById('emp-form-id-display');
  if (idDisplay) idDisplay.value = '';
  document.getElementById('emp-form-name').value = '';
  document.getElementById('emp-form-role').value = 'TELLER';
  document.getElementById('emp-form-dept').value = 'dept-tel';
  document.getElementById('emp-form-purok').value = '';
  document.getElementById('emp-form-muni').value = 'Sto. Tomas';
  document.getElementById('emp-form-booth').value = '';
  document.getElementById('emp-form-phone').value = '';
  const statusEl = document.getElementById('emp-form-status');
  if (statusEl) statusEl.value = 'ACTIVE';
  document.getElementById('emp-form-pos').value = '';
  document.getElementById('emp-form-printer').value = 'WITH PORTABLE PRINTER';
  document.getElementById('emp-form-lat').value = '';
  document.getElementById('emp-form-lng').value = '';
  document.getElementById('modal-employee').classList.add('active');
};

window.editEmployee = function(id, isViewOnly = false, empName = null) {
  if (window.sfx) sfx.playClick();
  const store = window.appStore;
  let emp = null;
  if (empName && (id === 'DDN005-SR000' || !id || id === 'N/A')) {
    emp = store.getEmployees().find(e => e.name && e.name.toLowerCase().trim() === empName.toLowerCase().trim()) || 
          (store.data.relievers && store.data.relievers.find(r => r.name && r.name.toLowerCase().trim() === empName.toLowerCase().trim()));
  }
  if (!emp) {
    emp = store.getEmployees().find(e => e.id === id) || 
          (store.data.relievers && store.data.relievers.find(r => r.id === id));
  }

  // If not found in employees or relievers, check booths (e.g. Inactive Booths or booth-keyed items)
  if (!emp && store.data.booths) {
    const cleanBoothCode = id.replace(/^BOOTH-/, '');
    const b = store.data.booths.find(b => b.id === id || b.id === cleanBoothCode || b.assignedTellerId === id);
    if (b) {
      emp = {
        id: b.assignedTellerId || `BOOTH-${b.id}`,
        name: b.assignedTellerName || b.activeTeller || '',
        role: 'TELLER',
        department: 'dept-tel',
        purok: b.purok || '',
        municipality: b.municipality || 'Sto. Tomas',
        address: b.area || `${b.purok || ''}, ${b.municipality || 'Sto. Tomas'}`,
        boothCode: b.id,
        phone: b.phone || '',
        status: b.status || 'INACTIVE',
        posSerial: b.posSerial || `POS-${b.id}`,
        printerSerial: b.printerSerial || 'N/A',
        lat: b.lat,
        lng: b.lng
      };
    }
  }

  if (!emp) {
    alert(`Staff record with ID "${id}" could not be found.`);
    return;
  }

  window._currentEditingEmployeeTargetName = emp.name;

  const parsed = parseAddressHelper(emp.address || emp.area || '');

  document.getElementById('modal-employee-title').textContent = `Edit Staff: ${emp.id}`;
  document.getElementById('emp-form-id').value = emp.id;
  const idDisplay = document.getElementById('emp-form-id-display');
  if (idDisplay) idDisplay.value = emp.id;
  document.getElementById('emp-form-name').value = (emp.name && emp.name !== 'N/A' && emp.name !== '-') ? emp.name : (emp.name === 'N/A' ? 'N/A' : '');
  
  // Standardize Role dropdown selection
  const rUpper = (emp.role || 'TELLER').toUpperCase();
  let normalizedRole = 'TELLER';
  if (rUpper.includes('ADMINISTRATOR') || rUpper.includes('ADMIN') || rUpper.includes('TEAM LEADER')) normalizedRole = 'OPERATIONS ADMINISTRATOR';
  else if (rUpper.includes('SUPERVISOR')) normalizedRole = 'SUPERVISOR';
  else if (rUpper.includes('COLLECTOR')) normalizedRole = 'COLLECTOR';
  else if (rUpper.includes('RELIEVER') || rUpper.includes('RELIVER') || (emp.id && emp.id.includes('-REL'))) normalizedRole = 'RELIEVER';
  else normalizedRole = 'TELLER';
  document.getElementById('emp-form-role').value = normalizedRole;

  // Department normalization
  const dVal = (emp.department || '').toLowerCase();
  const deptEl = document.getElementById('emp-form-dept');
  if (deptEl) {
    if (dVal === 'dept-col' || dVal.includes('collector')) deptEl.value = 'dept-col';
    else if (dVal === 'dept-sup' || dVal.includes('supervisor')) deptEl.value = 'dept-sup';
    else if (dVal === 'dept-admin' || dVal.includes('admin') || normalizedRole === 'OPERATIONS ADMINISTRATOR') deptEl.value = 'dept-admin';
    else deptEl.value = 'dept-tel';
  }

  // Purok / Street / Barangay
  let rawPurok = '';
  if (emp.purok !== undefined && emp.purok !== null) {
    const pTrim = String(emp.purok).trim();
    if (pTrim !== '-' && pTrim !== 'Tagum / Kapalong /' && pTrim !== 'Carmen /' && !pTrim.endsWith('/')) {
      rawPurok = pTrim;
    }
  } else if (parsed.purok && parsed.purok !== '-' && !parsed.purok.endsWith('/')) {
    rawPurok = parsed.purok;
  }
  document.getElementById('emp-form-purok').value = rawPurok;

  // Municipality
  let rawMuni = '';
  if (normalizedRole === 'RELIEVER') {
    rawMuni = (typeof window.getRelieverMunicipality === 'function') 
      ? window.getRelieverMunicipality(emp.name)
      : ((typeof getRelieverMunicipality === 'function') ? getRelieverMunicipality(emp.name) : 'Sto. Tomas');
    document.getElementById('emp-form-purok').value = '-';
  } else {
    if (emp.municipality && emp.municipality !== '-' && emp.municipality !== 'N/A' && !emp.municipality.includes('Davao Sector') && !emp.municipality.includes('Davao Del Norte')) {
      rawMuni = emp.municipality;
    } else if (emp.area && emp.area !== '-' && !emp.area.includes('Davao Sector') && !emp.area.includes('Davao Del Norte')) {
      rawMuni = emp.area;
    } else if (parsed.municipality && parsed.municipality !== '-' && !parsed.municipality.includes('Davao Sector') && !parsed.municipality.includes('Davao Del Norte')) {
      rawMuni = parsed.municipality;
    }
    if (!rawMuni || rawMuni.includes('Davao Sector') || rawMuni.includes('Davao Del Norte')) {
      const rawT = `${emp.address || ''} ${emp.area || ''} ${emp.purok || ''}`.toLowerCase();
      if (rawT.includes('tagum')) rawMuni = 'Tagum City';
      else if (rawT.includes('panabo')) rawMuni = 'Panabo City';
      else if (rawT.includes('carmen')) rawMuni = 'Carmen';
      else if (rawT.includes('tomas')) rawMuni = 'Sto. Tomas';
      else if (rawT.includes('kapalong')) rawMuni = 'Kapalong';
      else if (rawT.includes('talaingod')) rawMuni = 'Talaingod';
      else if (rawT.includes('samal')) rawMuni = 'Samal';
      else rawMuni = 'Sto. Tomas';
    }
  }
  document.getElementById('emp-form-muni').value = rawMuni;

  // Assigned Booth Code
  const boothVal = (emp.boothCode && emp.boothCode !== '-') ? emp.boothCode : (emp.booth && emp.booth !== '-' ? emp.booth : '');
  document.getElementById('emp-form-booth').value = boothVal || '';

  // Contact Phone
  const phoneVal = (emp.phone && emp.phone !== '0917-000-0000' && emp.phone !== '-' && emp.phone !== 'N/A') ? emp.phone : (emp.contact && emp.contact !== '-' && emp.contact !== 'N/A' ? emp.contact : '');
  document.getElementById('emp-form-phone').value = phoneVal || '';

  // POS Machine S/N
  document.getElementById('emp-form-pos').value = (emp.posSerial && emp.posSerial !== '-') ? emp.posSerial : (emp.pos && emp.pos !== '-' ? emp.pos : '');
  
  // Status dropdown selection (ACTIVE / INACTIVE / TERMINATED)
  const statusUpper = (emp.status || 'ACTIVE').toUpperCase();
  const statusEl = document.getElementById('emp-form-status');
  if (statusEl) {
    if (statusUpper === 'TERMINATED') {
      statusEl.value = 'TERMINATED';
    } else if (statusUpper === 'INACTIVE') {
      statusEl.value = 'INACTIVE';
    } else {
      statusEl.value = 'ACTIVE';
    }
  }

  // Standardize Portable Printer dropdown selection
  const rawPr = (emp.printerName || emp.printerSerial || '').toUpperCase().trim();
  const isWithPr = rawPr.includes('WITH') || rawPr.includes('PRT-') || rawPr.includes('PRINTER') || rawPr.includes('PORTABLE');
  document.getElementById('emp-form-printer').value = isWithPr ? 'WITH PORTABLE PRINTER' : 'N/A';

  // Extract coordinate values from direct lat/lng or coordinates object
  let latVal = null;
  if (emp.lat !== undefined && emp.lat !== null && emp.lat !== '' && !isNaN(emp.lat)) {
    latVal = Number(emp.lat);
  } else if (emp.coordinates && emp.coordinates.lat !== undefined && emp.coordinates.lat !== null && emp.coordinates.lat !== '' && !isNaN(emp.coordinates.lat)) {
    latVal = Number(emp.coordinates.lat);
  }

  let lngVal = null;
  if (emp.lng !== undefined && emp.lng !== null && emp.lng !== '' && !isNaN(emp.lng)) {
    lngVal = Number(emp.lng);
  } else if (emp.coordinates && emp.coordinates.lng !== undefined && emp.coordinates.lng !== null && emp.coordinates.lng !== '' && !isNaN(emp.coordinates.lng)) {
    lngVal = Number(emp.coordinates.lng);
  }

  document.getElementById('emp-form-lat').value = latVal !== null ? latVal : '';
  document.getElementById('emp-form-lng').value = lngVal !== null ? lngVal : '';
  document.getElementById('modal-employee').classList.add('active');
};

let _isSavingEmployee = false;
window.saveEmployeeForm = function() {
  if (_isSavingEmployee) return;
  const origId = document.getElementById('emp-form-id').value;
  const idDisplay = document.getElementById('emp-form-id-display');
  const customId = idDisplay ? idDisplay.value.trim() : '';
  const finalId = customId || origId || undefined;

  let name = document.getElementById('emp-form-name').value.trim();
  const role = document.getElementById('emp-form-role').value;
  const dept = document.getElementById('emp-form-dept').value;
  const statusEl = document.getElementById('emp-form-status');
  const selectedStatus = statusEl ? statusEl.value.toUpperCase() : 'ACTIVE';

  if (!name) {
    if (selectedStatus === 'INACTIVE') {
      name = 'N/A';
    } else {
      alert('Validation Error: Staff Full Name is required.');
      document.getElementById('emp-form-name').focus();
      return;
    }
  }

  const inputPurok = document.getElementById('emp-form-purok').value.trim();
  const purok = (inputPurok === '' || inputPurok === '-') ? '-' : inputPurok;
  const inputMuni = document.getElementById('emp-form-muni').value.trim();
  const muni = (inputMuni === '' || inputMuni === '-') ? '-' : inputMuni;
  if (!muni || muni === '-') {
    alert('Validation Error: Municipality is required.');
    document.getElementById('emp-form-muni').focus();
    return;
  }
  const fullAddress = purok !== '-' ? (muni !== '-' ? `${purok}, ${muni}` : purok) : muni;
  const boothCode = document.getElementById('emp-form-booth').value.trim() || '-';
  
  // Contact phone
  const rawPhone = document.getElementById('emp-form-phone').value.trim();
  const phone = (rawPhone && rawPhone !== '0917-000-0000' && rawPhone !== '-') ? rawPhone : 'N/A';

  // Standardized Portable Printer
  const printerVal = document.getElementById('emp-form-printer').value === 'WITH PORTABLE PRINTER' ? 'WITH PORTABLE PRINTER' : 'N/A';

  // Validate GPS Coordinates
  const rawLat = document.getElementById('emp-form-lat').value.trim();
  const rawLng = document.getElementById('emp-form-lng').value.trim();

  let finalLat = null;
  let finalLng = null;

  if (rawLat !== '') {
    const numLat = Number(rawLat);
    if (isNaN(numLat) || numLat < -90 || numLat > 90) {
      alert('Validation Error: Invalid latitude. Please enter a number between -90 and 90.');
      document.getElementById('emp-form-lat').focus();
      return;
    }
    finalLat = numLat;
  }

  if (rawLng !== '') {
    const numLng = Number(rawLng);
    if (isNaN(numLng) || numLng < -180 || numLng > 180) {
      alert('Validation Error: Invalid longitude. Please enter a number between -180 and 180.');
      document.getElementById('emp-form-lng').focus();
      return;
    }
    finalLng = numLng;
  }

  if ((finalLat !== null && finalLng === null) || (finalLat === null && finalLng !== null)) {
    alert('Validation Error: Please enter both Latitude and Longitude, or leave both blank.');
    return;
  }

  const payload = {
    id: finalId,
    name: name,
    role: role === 'RELIEVER' ? 'Reliever' : role,
    department: dept,
    area: muni !== '-' ? muni : (purok !== '-' ? purok : '-'),
    address: fullAddress,
    purok: purok,
    municipality: muni,
    boothCode: boothCode,
    booth: boothCode,
    phone: phone,
    contact: phone,
    status: selectedStatus,
    posSerial: document.getElementById('emp-form-pos').value || (boothCode !== '-' ? `POS-${boothCode}` : 'POS-N9-GEN'),
    printerName: printerVal,
    printerSerial: printerVal,
    lat: finalLat,
    lng: finalLng,
    coordinates: (finalLat !== null && finalLng !== null) ? { lat: finalLat, lng: finalLng } : null,
    etsStatus: (selectedStatus === 'ACTIVE' && finalLat !== null && finalLng !== null) ? 'Active' : 'Offline'
  };

  _isSavingEmployee = true;
  try {
    let savedRecord = null;
    if (origId) {
      if (customId && customId !== origId) {
        payload.id = customId;
      }
      const targetName = window._currentEditingEmployeeTargetName || name;
      payload._targetName = targetName;
      savedRecord = window.appStore.updateEmployee(origId, payload, targetName);
      if (!savedRecord) {
        alert(`Failed to update record. Staff member "${origId}" could not be found.`);
        _isSavingEmployee = false;
        return;
      }
    } else {
      savedRecord = window.appStore.addEmployee(payload);
      if (!savedRecord) {
        alert('Failed to register employee. Please try again.');
        _isSavingEmployee = false;
        return;
      }
    }

    if (window.sfx) window.sfx.playChime();
    window.closeModals();
    renderEmployeesTable();
    if (window.orgChartModule && typeof window.orgChartModule.render === 'function') window.orgChartModule.render();
    if (typeof renderFleetTrackingList === 'function') renderFleetTrackingList();
    if (window.etsMap && typeof window.etsMap.renderAllMarkers === 'function') window.etsMap.renderAllMarkers();
    if (typeof renderDashboard === 'function') renderDashboard();

    alert(origId ? `Staff record for "${name}" (${savedRecord.id || origId}) updated successfully.` : `Staff record for "${name}" registered successfully.`);
  } catch (err) {
    console.error('Error saving employee record:', err);
    alert(`Unable to save record: ${err.message || err}`);
  } finally {
    _isSavingEmployee = false;
  }
};

// =========================================================================
// VIEW 3: EMPLOYEE TRACKING SYSTEM (ETS) & PIN RECALIBRATION ENGINE
// =========================================================================
let fleetSearchQuery = '';

window.filterFleetActivityList = function(query) {
  fleetSearchQuery = (query || '').toLowerCase().trim();
  renderFleetTrackingList();

  // If user searched for a specific booth code, coordinates, or name, focus map on first match
  if (fleetSearchQuery.length >= 3) {
    const store = window.appStore;
    const employees = store.getEmployees() || [];
    // Only booth-assigned Sales Representatives with valid coordinates appear in ETS Map
    const operationalStaff = employees.filter(e => {
      const r = (e.role || '').toUpperCase();
      const isRel = r.includes('RELIEVER') || r.includes('RELIVER') || r.includes('BUFFER') || e.id === 'DDN005-SR000';
      const isAdm = r.includes('ADMIN') || (e.department || '').includes('admin');
      const isSup = r.includes('SUPERVISOR') || (e.department || '').includes('sup');
      const isCol = r.includes('COLLECTOR') || (e.department || '').includes('col');
      return !isRel && !isAdm && !isSup && !isCol;
    });
    const match = operationalStaff.find(e => 
      (e.boothCode && e.boothCode.toLowerCase().includes(fleetSearchQuery)) ||
      (e.name && e.name.toLowerCase().includes(fleetSearchQuery)) ||
      (e.id && e.id.toLowerCase().includes(fleetSearchQuery)) ||
      (`${e.lat}, ${e.lng}`.includes(fleetSearchQuery))
    );
    if (match && window.etsMap && match.lat && match.lng) {
      window.etsMap.focusCoordinates(match.lat, match.lng, 15);
      const marker = window.etsMap.allMarkerInstances[match.id];
      if (marker) marker.openPopup();
    }
  }
};

function renderFleetTrackingList() {
  const container = document.getElementById('ets-fleet-list');
  if (!container) return;

  const store = window.appStore;
  if (!store) return;
  const employees = store.getEmployees() || [];

  // Fleet Activity Monitor: Exclusively show booth-assigned Sales Representatives with STL Booths.
  // Relievers, Admins, Supervisors, and Collectors have no STL Booth coordinates and must not appear here.
  const boothStaff = employees.filter(emp => {
    const roleUpper = (emp.role || '').toUpperCase();
    const deptLower = (emp.department || '').toLowerCase();
    const isAdmin = roleUpper.includes('ADMIN') || deptLower === 'dept-admin' || deptLower.includes('admin');
    const isSupervisor = roleUpper.includes('SUPERVISOR') || roleUpper.includes('TEAM LEADER') || deptLower === 'dept-sup';
    const isCollector = roleUpper.includes('COLLECTOR') || deptLower === 'dept-col';
    const isReliever = roleUpper.includes('RELIEVER') || roleUpper.includes('RELIVER') || roleUpper.includes('BUFFER') || emp.id === 'DDN005-SR000';
    return !isAdmin && !isSupervisor && !isCollector && !isReliever;
  });

  let list = boothStaff;
  if (fleetSearchQuery) {
    const q = fleetSearchQuery.toLowerCase().trim();
    list = boothStaff.filter(emp => {
      const gps = (typeof window.parseGpsCoordinates === 'function') 
        ? window.parseGpsCoordinates(emp) 
        : { isValid: false };
      const coordStr = gps.isValid ? `${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}` : '';
      return (emp.name && emp.name.toLowerCase().includes(q)) ||
             (emp.id && emp.id.toLowerCase().includes(q)) ||
             (emp.boothCode && emp.boothCode.toLowerCase().includes(q)) ||
             (emp.booth && emp.booth.toLowerCase().includes(q)) ||
             (emp.role && emp.role.toLowerCase().includes(q)) ||
             (emp.address && emp.address.toLowerCase().includes(q)) ||
             (emp.purok && emp.purok.toLowerCase().includes(q)) ||
             (emp.municipality && emp.municipality.toLowerCase().includes(q)) ||
             (emp.area && emp.area.toLowerCase().includes(q)) ||
             (coordStr && coordStr.includes(q));
    });
  }

  if (list.length === 0) {
    const emptyMsg = fleetSearchQuery 
      ? `🔍 No staff records found matching "<strong>${fleetSearchQuery}</strong>"`
      : `📍 No staff records found in Master Registry.`;
    container.innerHTML = `
      <div style="text-align: center; padding: 24px 12px; color: var(--text-muted); font-size: 12px;">
        ${emptyMsg}
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(emp => {
    let statusBg = '#dcfce7; color: #166534;';
    const roleUpper = (emp.role || '').toUpperCase();
    if (roleUpper.includes('COLLECTOR')) statusBg = '#fef3c7; color: #b45309;';
    else if (roleUpper.includes('SUPERVISOR')) statusBg = '#f3e8ff; color: #7e22ce;';
    else if (roleUpper.includes('TEAM LEADER')) statusBg = '#ccfbf1; color: #0f766e;';
    else if (roleUpper.includes('RELIEVER') || roleUpper.includes('RELIVER')) statusBg = '#e2e8f0; color: #334155;';

    let gps = (typeof window.parseGpsCoordinates === 'function')
      ? window.parseGpsCoordinates(emp)
      : { isValid: false };

    // Resolve GPS from linked Master Registry booth if not on employee directly
    if (!gps.isValid && emp.boothCode && emp.boothCode !== '-') {
      const normB = (typeof window.normalizeBoothCode === 'function') ? window.normalizeBoothCode(emp.boothCode) : emp.boothCode;
      const boothRec = (store.getBooths() || []).find(b => {
        const bNorm = (typeof window.normalizeBoothCode === 'function') ? window.normalizeBoothCode(b.id || b.code) : (b.id || b.code);
        return bNorm === normB;
      });
      if (boothRec) {
        const bGps = window.parseGpsCoordinates(boothRec);
        if (bGps.isValid) gps = bGps;
      }
    }

    let displayRole = emp.role || 'Staff';
    if (roleUpper === 'TELLER' || roleUpper === 'STATION TELLER') displayRole = 'Sales Representative';
    else if (roleUpper === 'RELIVER') displayRole = 'Reliever';

    const boothDisplay = emp.boothCode || emp.booth || '-';
    const muniDisplay = emp.municipality || emp.address || emp.area || '-';

    const gpsStatusHtml = gps.isValid
      ? `<span style="font-size: 10px; font-weight: 700; color: #10b981; background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); padding: 1px 6px; border-radius: 3px;">GPS ACTIVE</span>`
      : `<span style="font-size: 10px; font-weight: 700; color: #ef4444; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3); padding: 1px 6px; border-radius: 3px;">GPS UNAVAILABLE</span>`;

    const gpsCoordsHtml = gps.isValid
      ? `<span style="font-size: 10.5px; font-family: monospace; color: var(--primary); font-weight: 700;">📍 ${gps.lat.toFixed(6)}, ${gps.lng.toFixed(6)}</span>`
      : `<span style="font-size: 10.5px; color: var(--text-muted); font-style: italic;">No Coordinates</span>`;

    return `
      <div style="padding: 10px 12px; border-radius: var(--radius-sm); background: var(--bg-surface); border: 1px solid var(--border-color); cursor: pointer; transition: background 0.15s;" onclick="window.focusStaffMember('${emp.id}')" title="Click to track ${emp.name}'s STL BOOTH">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div style="font-size: 13px; font-weight: 700; color: var(--text-main);">${emp.name}</div>
          <span style="font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 4px; background: ${statusBg}">${displayRole}</span>
        </div>
        <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
          Outlet: <code>${boothDisplay}</code> • ${muniDisplay}
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px;">
          ${gpsCoordsHtml}
          ${gpsStatusHtml}
        </div>
      </div>
    `;
  }).join('');
}

// Precision GPS Pin Calibration Modal Logic
window.openPrecisionCalibrateModal = function(preselectedId = null) {
  if (window.sfx) sfx.playClick();
  const select = document.getElementById('calib-select-target');
  const store = window.appStore;
  if (!store || !select) return;
  // Precision Calibration is exclusively for booth-stationed field staff (Sales Representatives)
  const boothStaff = (store.getEmployees() || []).filter(emp => {
    const roleUpper = (emp.role || '').toUpperCase();
    const deptLower = (emp.department || '').toLowerCase();
    const isAdmin = roleUpper.includes('ADMIN') || deptLower === 'dept-admin' || deptLower.includes('admin');
    const isSupervisor = roleUpper.includes('SUPERVISOR') || roleUpper.includes('TEAM LEADER') || deptLower === 'dept-sup';
    const isCollector = roleUpper.includes('COLLECTOR') || deptLower === 'dept-col';
    const isReliever = roleUpper.includes('RELIEVER') || roleUpper.includes('RELIVER') || roleUpper.includes('BUFFER') || emp.id === 'DDN005-SR000';
    return !isAdmin && !isSupervisor && !isCollector && !isReliever;
  });

  select.innerHTML = boothStaff.map(e => {
    let rName = e.role;
    const rU = (e.role || '').toUpperCase();
    if (rU === 'TELLER' || rU === 'STATION TELLER') rName = 'Sales Representative';
    else if (rU === 'RELIVER') rName = 'Reliever';
    return `
      <option value="${e.id}" ${e.id === preselectedId ? 'selected' : ''}>
        ${rName}: ${e.name} (${e.id}) - Outlet: ${e.boothCode || e.booth || '-'}
      </option>
    `;
  }).join('');

  if (preselectedId) {
    select.value = preselectedId;
  }

  window.onCalibTargetSelected();
  const modal = document.getElementById('modal-precision-calibrate');
  if (modal) modal.classList.add('active');
};

window.onCalibTargetSelected = function() {
  const targetId = document.getElementById('calib-select-target').value;
  const store = window.appStore;
  if (!store) return;
  const emp = store.getEmployees().find(e => e.id === targetId) ||
              (store.data.relievers && store.data.relievers.find(r => r.id === targetId));
  if (!emp) return;

  const gps = (typeof window.parseGpsCoordinates === 'function') ? window.parseGpsCoordinates(emp) : { isValid: false };
  document.getElementById('calib-input-lat').value = gps.isValid ? gps.lat.toFixed(6) : '7.447500';
  document.getElementById('calib-input-lng').value = gps.isValid ? gps.lng.toFixed(6) : '125.807800';
  document.getElementById('calib-address-preview').innerHTML = `
    <strong>Registered Address:</strong> ${emp.address || emp.area || '-'} | <strong>Outlet / Booth Location:</strong> <code>${emp.boothCode || emp.booth || '-'}</code>
  `;
};

window.savePrecisionCalibration = function() {
  const targetId = document.getElementById('calib-select-target').value;
  const latVal = document.getElementById('calib-input-lat').value.trim();
  const lngVal = document.getElementById('calib-input-lng').value.trim();
  const lat = parseFloat(latVal);
  const lng = parseFloat(lngVal);

  if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    alert('Please enter valid latitude (-90 to 90) and longitude (-180 to 180) numbers.');
    return;
  }

  window.appStore.updateCoordinates(targetId, lat, lng);
  if (window.etsMap && window.etsMap.renderAllMarkers) {
    window.etsMap.renderAllMarkers();
    window.etsMap.focusCoordinates(lat, lng, 16);
    const marker = window.etsMap.allMarkerInstances[targetId];
    if (marker) {
      marker.openPopup();
    }
  }
  renderFleetTrackingList();
  renderEmployeesTable();
  if (window.sfx) sfx.playChime();
  window.closeModals();
};

window.focusStaffMember = function(empId) {
  if (window.sfx) sfx.playClick();
  const store = window.appStore;
  if (!store) return;
  const employees = store.getEmployees() || [];
  const emp = employees.find(e => e.id === empId || e.name === empId);
  if (!emp) return;

  const roleUpper = (emp.role || '').toUpperCase();
  const isReliever = roleUpper.includes('RELIEVER') || roleUpper.includes('RELIVER') || roleUpper.includes('BUFFER') || emp.id === 'DDN005-SR000';
  if (isReliever) {
    alert(`GPS TRACKING UNAVAILABLE: ${emp.name} is a Reliever with no fixed STL Booth or GPS coordinates.`);
    return;
  }

  let gps = (typeof window.parseGpsCoordinates === 'function') 
    ? window.parseGpsCoordinates(emp) 
    : { isValid: false };

  // Resolve GPS from linked Master Registry booth if not on employee directly
  if (!gps.isValid && emp.boothCode && emp.boothCode !== '-') {
    const normB = (typeof window.normalizeBoothCode === 'function') ? window.normalizeBoothCode(emp.boothCode) : emp.boothCode;
    const boothRec = (store.getBooths() || []).find(b => {
      const bNorm = (typeof window.normalizeBoothCode === 'function') ? window.normalizeBoothCode(b.id || b.code) : (b.id || b.code);
      return bNorm === normB;
    });
    if (boothRec) {
      const bGps = window.parseGpsCoordinates(boothRec);
      if (bGps.isValid) gps = bGps;
    }
  }

  if (!gps.isValid) {
    const boothName = emp.boothCode || emp.booth || 'Unassigned';
    alert(`GPS UNAVAILABLE: ${emp.name} (Booth: ${boothName}) does not have valid GPS coordinates recorded in Master Registry.`);
    return;
  }

  if (window.etsMap) {
    const boothCode = emp.boothCode || emp.booth;
    const normBooth = (typeof window.normalizeBoothCode === 'function') ? window.normalizeBoothCode(boothCode) : boothCode;
    const marker = (normBooth && window.etsMap.allMarkerInstances[normBooth]) ||
                   (boothCode && window.etsMap.allMarkerInstances[boothCode]) ||
                   window.etsMap.allMarkerInstances[emp.id] ||
                   (emp.name && window.etsMap.allMarkerInstances[emp.name.toLowerCase().trim()]);

    if (marker) {
      if (typeof marker.getLatLng === 'function') {
        const pos = marker.getLatLng();
        window.etsMap.focusCoordinates(pos.lat, pos.lng, 16);
      } else {
        window.etsMap.focusCoordinates(gps.lat, gps.lng, 16);
      }
      marker.openPopup();
    } else {
      window.etsMap.focusCoordinates(gps.lat, gps.lng, 16);
    }

    if (typeof window !== 'undefined' && window.innerWidth <= 1024) {
      const mapTarget = document.getElementById('ets-map-container') || document.querySelector('.ets-map-card');
      if (mapTarget && typeof mapTarget.scrollIntoView === 'function') {
        mapTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }
};

window.focusEmployeeCoords = function(lat, lng, empId = null) {
  if (empId) {
    window.focusStaffMember(empId);
  } else if (window.etsMap && !isNaN(lat) && !isNaN(lng)) {
    window.etsMap.focusCoordinates(lat, lng, 16);
  }
};

window.focusEmployeeRoute = function(empId) {
  sfx.playClick();
  window.etsMap.showRoute(empId);
};

window.focusBoothInView = function(boothId) {
  sfx.playClick();
  window.switchView('view-pipelines');
};

window.pingEmployee = function(empId) {
  sfx.playChime();
  alert(`Telemetry Ping sent to unit ${empId}. GPS location synchronized successfully.`);
};

window.refreshEtsMap = function() {
  sfx.playClick();
  window.etsMap.renderAllMarkers();
};

window.triggerEmergencyBroadcast = function() {
  sfx.playAlert();
  alert('🚨 [EMERGENCY DRILL TRIGGERED] Broadcast dispatched to all Team Davao Del Norte Supervisors and Field Collectors: Check-in verified.');
};


// =========================================================================
// VIEW 4: SALES & COLLECTION — DAILY ACCOUNTING SUMMARY → EOD AUTOMATION
// =========================================================================
function renderPipelines() {
  if (window.eodEngine && typeof window.eodEngine.init === 'function') {
    window.eodEngine.init();
  }
}





// =========================================================================
// VIEW 7: INVENTORY & COMPANY PROPERTY MANAGEMENT
// =========================================================================
// =========================================================================
// VIEW 7: INVENTORY & COMPANY PROPERTY MANAGEMENT (REBUILT)
// =========================================================================
let currentInventoryTab = 'active'; // 'active' or 'archived'
window.targetArchivePropertyId = null;

// Approved make & models mapping
const APPROVED_MODELS = {
  'POS MACHINE': ['Sunmi V2', 'Sunmi V2s Pro', 'Newland N910', 'Pax A930'],
  'CELLPHONE': ['Vivo Y93'],
  'THERMAL PAPER': ['Thermal Roll 57mm'],
  'VEST': ['Official DDN Collector Vest']
};

window.onPropertyTypeChange = function(selectedType) {
  const modelSelect = document.getElementById('prop-form-model');
  if (!modelSelect) return;
  const models = APPROVED_MODELS[selectedType] || ['Sunmi V2'];
  modelSelect.innerHTML = models.map(m => `<option value="${m}">${m}</option>`).join('');
};

function renderInventory(filteredList = null) {
  const tbody = document.getElementById('inventory-table-tbody');
  if (!tbody) return;

  const store = window.appStore;
  const activeItems = store.getInventory(false);
  const archivedItems = store.getArchivedInventory();

  // 1. Update Section 25 Counters at the top
  const elTotal = document.getElementById('inv-stat-total');
  if (elTotal) elTotal.textContent = activeItems.length;

  const elAssigned = document.getElementById('inv-stat-assigned');
  if (elAssigned) {
    const assignedCount = activeItems.filter(i => i.status === 'Assigned' || i.status === 'Deployed').length;
    elAssigned.textContent = assignedCount;
  }

  const elAvailable = document.getElementById('inv-stat-available');
  if (elAvailable) {
    const availableCount = activeItems.filter(i => i.status === 'Available' || i.status === 'In-Stock').length;
    elAvailable.textContent = availableCount;
  }

  const elRepair = document.getElementById('inv-stat-repair');
  if (elRepair) {
    const repairCount = activeItems.filter(i => 
      i.status === 'Under Repair' || i.status === 'In-Repair' || 
      i.condition === 'Damaged' || i.condition === 'For Repair'
    ).length;
    elRepair.textContent = repairCount;
  }

  const elMissing = document.getElementById('inv-stat-missing');
  if (elMissing) {
    const missingCount = activeItems.filter(i => i.status === 'Missing' || i.condition === 'Lost').length;
    elMissing.textContent = missingCount;
  }

  // Tab count badges
  const elActiveTabCount = document.getElementById('inv-tab-active-count');
  if (elActiveTabCount) elActiveTabCount.textContent = activeItems.length;

  const elArchivedTabCount = document.getElementById('inv-tab-archived-count');
  if (elArchivedTabCount) elArchivedTabCount.textContent = archivedItems.length;

  // 2. Select active vs archived data source
  let baseList = currentInventoryTab === 'active' ? activeItems : archivedItems;
  const list = filteredList || baseList;

  // Update status summary text
  const statusText = document.getElementById('inv-table-status-text');
  if (statusText) {
    statusText.textContent = currentInventoryTab === 'active' 
      ? `Displaying ${list.length} active registered properties` 
      : `Displaying ${list.length} archived properties (historical audit mode)`;
  }
  const rowCount = document.getElementById('inv-table-row-count');
  if (rowCount) rowCount.textContent = `${list.length} items`;

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 36px; color: var(--text-muted);">
          <div style="font-size: 28px; margin-bottom: 8px;">📦</div>
          <div style="font-size: 14px; font-weight: 600;">No property records found matching current criteria</div>
          <div style="font-size: 12px; margin-top: 4px;">Try clearing filters or click "+ Add Property" to register a new asset.</div>
        </td>
      </tr>
    `;
    return;
  }

  // 3. Render exact 9 columns:
  // No. | Property Type | Make & Model | Serial / Batch No. | Assigned To | Booth Code | Condition / Health | Status | Actions
  tbody.innerHTML = list.map(item => {
    // Type Badge
    let typeBadge = 'badge-purple';
    if (item.type === 'CELLPHONE') typeBadge = 'badge-info';
    if (item.type === 'THERMAL PAPER') typeBadge = 'badge-warning';
    if (item.type === 'VEST') typeBadge = 'badge-success';

    // Condition Badge (Physical Condition)
    let condBadge = 'badge-neutral';
    if (item.condition === 'Brand New') condBadge = 'badge-success';
    if (item.condition === 'Good') condBadge = 'badge-info';
    if (item.condition === 'Used') condBadge = 'badge-neutral';
    if (item.condition === 'Damaged' || item.condition === 'For Repair') condBadge = 'badge-warning';
    if (item.condition === 'For Replacement' || item.condition === 'Lost') condBadge = 'badge-danger';

    // Status Badge (Operational State)
    let statusBadge = 'badge-neutral';
    if (item.status === 'Assigned' || item.status === 'Deployed') statusBadge = 'badge-success';
    if (item.status === 'Available' || item.status === 'In-Stock') statusBadge = 'badge-info';
    if (item.status === 'Under Repair' || item.status === 'In-Repair') statusBadge = 'badge-warning';
    if (item.status === 'Missing') statusBadge = 'badge-danger';
    if (item.status === 'Returned' || item.status === 'Retired') statusBadge = 'badge-neutral';

    // Booth Location lookup from Master Registry if not present
    let locationText = item.boothLocation || '';
    if (!locationText && item.boothCode) {
      const b = store.getBooths().find(x => x.id === item.boothCode);
      if (b) locationText = b.area || b.municipality;
    }

    const isArchived = item.isArchived === true;

    return `
      <tr id="prop-row-${item.no}" style="${isArchived ? 'opacity: 0.75; background: rgba(0,0,0,0.05);' : ''}">
        <!-- 1. No. (Auto-generated 3-digit number) -->
        <td>
          <span style="font-family: var(--font-mono); font-weight: 700; font-size: 13.5px; color: var(--primary);">
            ${item.no || item.id}
          </span>
        </td>

        <!-- 2. Property Type -->
        <td>
          <span class="badge ${typeBadge}" style="font-weight: 700; font-size: 11px;">${item.type}</span>
        </td>

        <!-- 3. Make & Model (Combined field) -->
        <td>
          <strong style="color: var(--text-main); font-size: 13px;">${item.brandModel}</strong>
        </td>

        <!-- 4. Serial / Batch No. -->
        <td>
          <code style="font-size: 12px; padding: 2px 6px; background: var(--bg-surface-elevated); border-radius: 4px;">
            ${item.serial || 'N/A'}
          </code>
        </td>

        <!-- 5. Assigned To (Master Registry employee) -->
        <td>
          <div style="font-weight: 600; color: var(--text-main); display: flex; align-items: center; gap: 6px;">
            ${item.assignedTo && item.assignedTo !== 'Unassigned' 
              ? `<span style="color: var(--success); font-size: 10px;">●</span> <span>${item.assignedTo}</span>`
              : `<span style="color: var(--text-dim); font-style: italic;">Unassigned (Depot Buffer)</span>`
            }
          </div>
          ${item.employeeId ? `<div style="font-size: 10.5px; font-family: var(--font-mono); color: var(--text-dim);">${item.employeeId}</div>` : ''}
        </td>

        <!-- 6. Booth Code (Master Registry booth) -->
        <td>
          <div style="display: flex; align-items: center; gap: 6px;">
            <code style="font-weight: 700; font-size: 12px;">${item.boothCode || 'HQ-BUFFER'}</code>
          </div>
          ${locationText ? `
            <div style="font-size: 11px; color: var(--text-muted); max-width: 170px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${locationText}">
              ${locationText}
            </div>` : ''}
        </td>

        <!-- 7. Condition / Health -->
        <td>
          <span class="badge ${condBadge}" style="font-size: 11px;">${item.condition}</span>
        </td>

        <!-- 8. Status -->
        <td>
          <span class="badge ${statusBadge}" style="font-size: 11px;">${item.status}</span>
        </td>

        <!-- 9. Actions -->
        <td style="text-align: center;">
          <div style="display: inline-flex; gap: 6px; align-items: center;">
            ${!isArchived ? `
              <!-- Edit -->
              <button class="btn btn-secondary btn-sm" onclick="window.openEditPropertyModal('${item.id}')" title="Edit Property Details" style="padding: 4px 8px; font-size: 12px;">
                ✏️
              </button>
              <!-- History -->
              <button class="btn btn-secondary btn-sm" onclick="window.openPropertyHistoryModal('${item.id}')" title="View Assignment History" style="padding: 4px 8px; font-size: 12px;">
                📜
              </button>
              <!-- Delete = Archive -->
              <button class="btn btn-secondary btn-sm" onclick="window.openArchivePropertyModal('${item.id}')" title="Archive Property" style="padding: 4px 8px; font-size: 12px; color: var(--warning);">
                📦
              </button>
            ` : `
              <!-- History -->
              <button class="btn btn-secondary btn-sm" onclick="window.openPropertyHistoryModal('${item.id}')" title="View Assignment History" style="padding: 4px 8px; font-size: 12px;">
                📜 History
              </button>
              <!-- Restore -->
              <button class="btn btn-primary btn-sm" onclick="window.restoreArchivedProperty('${item.id}')" title="Restore to Active Inventory" style="padding: 4px 8px; font-size: 12px;">
                🔄 Restore
              </button>
            `}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

window.filterInventoryTable = function() {
  const query = (document.getElementById('inv-search-input')?.value || '').toLowerCase().trim();
  const typeFilter = document.getElementById('inv-filter-type')?.value || 'ALL';
  const condFilter = document.getElementById('inv-filter-condition')?.value || 'ALL';
  const statusFilter = document.getElementById('inv-filter-status')?.value || 'ALL';
  const assignFilter = document.getElementById('inv-filter-assigned')?.value || 'ALL';

  const store = window.appStore;
  const baseList = currentInventoryTab === 'active' ? store.getInventory(false) : store.getArchivedInventory();

  const filtered = baseList.filter(item => {
    // 1. Search Query
    if (query) {
      const matchNo = (item.no || item.id || '').toLowerCase().includes(query);
      const matchType = (item.type || '').toLowerCase().includes(query);
      const matchModel = (item.brandModel || '').toLowerCase().includes(query);
      const matchSerial = (item.serial || '').toLowerCase().includes(query);
      const matchEmp = (item.assignedTo || '').toLowerCase().includes(query);
      const matchBooth = (item.boothCode || '').toLowerCase().includes(query);
      const matchLoc = (item.boothLocation || '').toLowerCase().includes(query);
      if (!matchNo && !matchType && !matchModel && !matchSerial && !matchEmp && !matchBooth && !matchLoc) {
        return false;
      }
    }

    // 2. Type Filter
    if (typeFilter !== 'ALL' && item.type !== typeFilter) {
      return false;
    }

    // 3. Condition Filter
    if (condFilter !== 'ALL' && item.condition !== condFilter) {
      return false;
    }

    // 4. Status Filter
    if (statusFilter !== 'ALL' && item.status !== statusFilter) {
      return false;
    }

    // 5. Assignment Filter
    if (assignFilter === 'ASSIGNED') {
      if (!item.assignedTo || item.assignedTo === 'Unassigned') return false;
    } else if (assignFilter === 'UNASSIGNED') {
      if (item.assignedTo && item.assignedTo !== 'Unassigned') return false;
    }

    return true;
  });

  renderInventory(filtered);
};

window.switchInventoryTab = function(tab) {
  currentInventoryTab = tab;
  sfx.playClick();

  const btnActive = document.getElementById('inv-tab-btn-active');
  const btnArchived = document.getElementById('inv-tab-btn-archived');

  if (tab === 'active') {
    if (btnActive) {
      btnActive.className = 'btn btn-primary btn-sm';
      btnActive.style.background = '';
    }
    if (btnArchived) {
      btnArchived.className = 'btn btn-secondary btn-sm';
      btnArchived.style.background = 'transparent';
      btnArchived.style.border = 'none';
    }
  } else {
    if (btnArchived) {
      btnArchived.className = 'btn btn-primary btn-sm';
      btnArchived.style.background = '';
    }
    if (btnActive) {
      btnActive.className = 'btn btn-secondary btn-sm';
      btnActive.style.background = 'transparent';
      btnActive.style.border = 'none';
    }
  }

  window.filterInventoryTable();
};

function populatePropertyDropdowns(selectedEmpId = '', selectedBoothCode = '') {
  const store = window.appStore;
  const emps = store.getEmployees();
  const booths = store.getBooths();
  const relievers = store.data.relievers || [];

  // 1. Populate Assigned To dropdown directly from Master Registry
  const assignedSelect = document.getElementById('prop-form-assigned');
  if (assignedSelect) {
    let options = `<option value="Unassigned">-- Unassigned (Buffer Stock / Depot) --</option>`;
    
    // Tellers
    options += `<optgroup label="Registered Tellers (Master Registry)">`;
    emps.filter(e => e.role === 'TELLER').forEach(e => {
      const isSel = (e.name === selectedEmpId || e.id === selectedEmpId) ? 'selected' : '';
      options += `<option value="${e.name}" data-empid="${e.id}" data-booth="${e.boothCode || ''}" ${isSel}>${e.name} (${e.boothCode || 'No Station'})</option>`;
    });
    options += `</optgroup>`;

    // Collectors & Officers
    options += `<optgroup label="Field Collectors & Supervisors">`;
    emps.filter(e => e.role !== 'TELLER').forEach(e => {
      const isSel = (e.name === selectedEmpId || e.id === selectedEmpId) ? 'selected' : '';
      options += `<option value="${e.name}" data-empid="${e.id}" data-booth="${e.boothCode || ''}" ${isSel}>${e.name} (${e.role})</option>`;
    });
    options += `</optgroup>`;

    // Relievers
    options += `<optgroup label="Reliever Pool">`;
    relievers.forEach(r => {
      const isSel = (r.name === selectedEmpId || r.id === selectedEmpId) ? 'selected' : '';
      options += `<option value="${r.name}" data-empid="${r.id}" data-booth="${r.boothCode || ''}" ${isSel}>${r.name}</option>`;
    });
    options += `</optgroup>`;

    assignedSelect.innerHTML = options;
  }

  // 2. Populate Booth Code dropdown directly from Master Registry
  const boothSelect = document.getElementById('prop-form-booth');
  if (boothSelect) {
    let boothOptions = `
      <option value="HQ-BUFFER" data-loc="Sto. Tomas Logistics Depot Buffer">HQ-BUFFER (Sto. Tomas Logistics Depot)</option>
      <option value="HQ-WHSE" data-loc="Central Warehouse Sto. Tomas HQ">HQ-WHSE (Central Logistics Warehouse)</option>
    `;

    boothOptions += `<optgroup label="Registered Stations (Master Registry)">`;
    booths.forEach(b => {
      const isSel = b.id === selectedBoothCode ? 'selected' : '';
      boothOptions += `<option value="${b.id}" data-loc="${b.area || b.municipality}" ${isSel}>${b.id} - ${b.area || b.municipality}</option>`;
    });
    boothOptions += `</optgroup>`;

    boothSelect.innerHTML = boothOptions;
  }
}

window.onPropAssignedChange = function(empName) {
  const assignedSelect = document.getElementById('prop-form-assigned');
  const boothSelect = document.getElementById('prop-form-booth');
  const statusSelect = document.getElementById('prop-form-status');
  const assignedHint = document.getElementById('prop-form-assigned-hint');
  const boothHint = document.getElementById('prop-form-booth-hint');

  if (!assignedSelect) return;

  if (empName === 'Unassigned') {
    if (statusSelect) statusSelect.value = 'Available';
    if (boothSelect) boothSelect.value = 'HQ-BUFFER';
    if (assignedHint) assignedHint.innerHTML = `<span style="color: var(--text-dim);">Available for deployment from buffer pool</span>`;
    if (boothHint) boothHint.innerHTML = `<span style="color: var(--text-dim);">HQ Logistics Buffer</span>`;
    return;
  }

  const opt = assignedSelect.options[assignedSelect.selectedIndex];
  const linkedBooth = opt?.getAttribute('data-booth');
  const empId = opt?.getAttribute('data-empid');

  if (statusSelect) statusSelect.value = 'Assigned';

  if (assignedHint) {
    assignedHint.innerHTML = `<span style="color: var(--success); font-weight: 600;">✓ Master Registry Record: ${empId || empName}</span>`;
  }

  if (linkedBooth && boothSelect) {
    for (let i = 0; i < boothSelect.options.length; i++) {
      if (boothSelect.options[i].value === linkedBooth) {
        boothSelect.selectedIndex = i;
        const bOpt = boothSelect.options[i];
        const loc = bOpt.getAttribute('data-loc');
        if (boothHint) {
          boothHint.innerHTML = `<span style="color: var(--primary); font-weight: 600;">✓ Auto-assigned Station: ${loc}</span>`;
        }
        return;
      }
    }
  }
};

window.onPropBoothChange = function(boothCode) {
  const boothSelect = document.getElementById('prop-form-booth');
  const boothHint = document.getElementById('prop-form-booth-hint');
  if (!boothSelect || !boothHint) return;

  const opt = boothSelect.options[boothSelect.selectedIndex];
  const loc = opt?.getAttribute('data-loc') || 'Davao Del Norte Operations Base';
  boothHint.innerHTML = `<span style="color: var(--primary); font-weight: 600;">Station Location: ${loc}</span>`;
};

window.openAddPropertyModal = function() {
  sfx.playClick();
  const store = window.appStore;
  const nextNo = store.getNextPropertyNo();

  document.getElementById('prop-modal-title').textContent = `+ Add Property (Next: No. ${nextNo})`;
  document.getElementById('prop-form-id').value = '';
  document.getElementById('prop-form-type').value = 'POS MACHINE';
  window.onPropertyTypeChange('POS MACHINE');
  document.getElementById('prop-form-serial').value = `SN-DDN-${Math.floor(10000 + Math.random() * 90000)}`;
  document.getElementById('prop-form-condition').value = 'Good';
  document.getElementById('prop-form-status').value = 'Assigned';
  document.getElementById('prop-form-note').value = 'Initial Registration in Davao Del Norte HQ Registry';

  populatePropertyDropdowns();
  document.getElementById('modal-property-form').classList.add('active');
};

window.openEditPropertyModal = function(id) {
  sfx.playClick();
  const store = window.appStore;
  const item = store.data.inventory.find(i => i.id === id || i.no === id);
  if (!item) return;

  document.getElementById('prop-modal-title').textContent = `Edit Property [No. ${item.no}]`;
  document.getElementById('prop-form-id').value = item.id;
  document.getElementById('prop-form-type').value = item.type;
  window.onPropertyTypeChange(item.type);
  
  // Select make & model
  const modelSelect = document.getElementById('prop-form-model');
  if (modelSelect) modelSelect.value = item.brandModel;

  document.getElementById('prop-form-serial').value = item.serial || '';
  document.getElementById('prop-form-condition').value = item.condition;
  document.getElementById('prop-form-status').value = item.status;
  document.getElementById('prop-form-note').value = '';

  populatePropertyDropdowns(item.assignedTo, item.boothCode);

  const assignedSelect = document.getElementById('prop-form-assigned');
  if (assignedSelect) assignedSelect.value = item.assignedTo;

  const boothSelect = document.getElementById('prop-form-booth');
  if (boothSelect) boothSelect.value = item.boothCode;

  window.onPropBoothChange(item.boothCode);

  document.getElementById('modal-property-form').classList.add('active');
};

window.savePropertyForm = function() {
  const store = window.appStore;
  const id = document.getElementById('prop-form-id').value;
  const type = document.getElementById('prop-form-type').value;
  const brandModel = document.getElementById('prop-form-model').value;
  const serial = document.getElementById('prop-form-serial').value.trim();
  const assignedTo = document.getElementById('prop-form-assigned').value;
  const boothCode = document.getElementById('prop-form-booth').value;
  const condition = document.getElementById('prop-form-condition').value;
  const status = document.getElementById('prop-form-status').value;
  const note = document.getElementById('prop-form-note').value.trim();

  if (!serial) {
    alert('Please provide a Serial / Batch No. (use N/A if not applicable).');
    document.getElementById('prop-form-serial').focus();
    return;
  }

  const boothOpt = document.getElementById('prop-form-booth')?.selectedOptions[0];
  const boothLoc = boothOpt?.getAttribute('data-loc') || 'Davao Del Norte Operations Base';

  const empOpt = document.getElementById('prop-form-assigned')?.selectedOptions[0];
  const empId = empOpt?.getAttribute('data-empid') || '';

  if (id) {
    // Edit existing property
    store.updateInventoryProperty(id, {
      type,
      brandModel,
      serial,
      assignedTo,
      employeeId: empId,
      boothCode,
      boothLocation: boothLoc,
      condition,
      status
    }, note || 'Property details updated');
  } else {
    // Add new property
    store.addInventoryProperty({
      type,
      brandModel,
      serial,
      assignedTo,
      employeeId: empId,
      boothCode,
      boothLocation: boothLoc,
      condition,
      status,
      note: note || 'New property registered'
    });
  }

  sfx.playChime();
  window.closeModals();
  renderInventory();
  renderDashboard();
};

window.openPropertyHistoryModal = function(id) {
  sfx.playClick();
  const store = window.appStore;
  const item = store.data.inventory.find(i => i.id === id || i.no === id);
  if (!item) return;

  const subtitle = document.getElementById('prop-hist-subtitle');
  if (subtitle) {
    subtitle.textContent = `Property No. ${item.no} • ${item.type} (${item.brandModel}) • Serial: ${item.serial}`;
  }

  const summaryCard = document.getElementById('prop-hist-summary-card');
  if (summaryCard) {
    summaryCard.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-size: 12px;">
        <div>
          <span style="color: var(--text-dim); display: block; font-size: 10px; text-transform: uppercase;">Current Assignment</span>
          <strong style="color: var(--text-main); font-size: 13px;">${item.assignedTo}</strong>
        </div>
        <div>
          <span style="color: var(--text-dim); display: block; font-size: 10px; text-transform: uppercase;">Current Booth</span>
          <strong style="color: var(--text-main); font-size: 13px;">${item.boothCode}</strong>
        </div>
        <div>
          <span style="color: var(--text-dim); display: block; font-size: 10px; text-transform: uppercase;">Physical Condition</span>
          <strong style="color: var(--warning); font-size: 13px;">${item.condition}</strong>
        </div>
        <div>
          <span style="color: var(--text-dim); display: block; font-size: 10px; text-transform: uppercase;">Operational Status</span>
          <strong style="color: var(--success); font-size: 13px;">${item.status}</strong>
        </div>
      </div>
    `;
  }

  const timelineContainer = document.getElementById('prop-hist-timeline');
  if (timelineContainer) {
    const history = item.assignmentHistory || [];
    if (history.length === 0) {
      timelineContainer.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 20px;">No previous assignment history recorded.</div>`;
    } else {
      timelineContainer.innerHTML = history.map((h, i) => `
        <div style="background: var(--bg-surface-elevated); padding: 12px 14px; border-radius: var(--radius-sm); border-left: 3px solid var(--primary); position: relative;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="badge badge-info" style="font-size: 10px;">${h.action || 'Assignment'}</span>
              <strong style="color: var(--text-main); font-size: 13px;">${h.assignedTo || 'Unassigned'} [${h.boothCode || 'HQ'}]</strong>
            </div>
            <span style="font-family: var(--font-mono); font-size: 11px; color: var(--text-dim);">${h.date || 'Historical'}</span>
          </div>
          <div style="font-size: 11.5px; color: var(--text-muted); margin-bottom: 4px;">
            Location: <strong>${h.boothLocation || 'Davao Del Norte HQ'}</strong> • Condition: <strong>${h.condition}</strong> • Status: <strong>${h.status}</strong>
          </div>
          ${h.note ? `<div style="font-size: 11px; color: var(--text-main); font-style: italic; background: var(--bg-surface); padding: 4px 8px; border-radius: 4px;">"${h.note}"</div>` : ''}
        </div>
      `).join('');
    }
  }

  document.getElementById('modal-property-history').classList.add('active');
};

window.openArchivePropertyModal = function(id) {
  sfx.playClick();
  const store = window.appStore;
  const item = store.data.inventory.find(i => i.id === id || i.no === id);
  if (!item) return;

  window.targetArchivePropertyId = item.id;

  const box = document.getElementById('archive-property-details-box');
  if (box) {
    box.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
        <div><strong>Property No:</strong> <span style="color: var(--primary); font-family: var(--font-mono);">#${item.no}</span></div>
        <div><strong>Type:</strong> ${item.type}</div>
        <div><strong>Make & Model:</strong> ${item.brandModel}</div>
        <div><strong>Serial:</strong> <code>${item.serial}</code></div>
        <div><strong>Assigned To:</strong> ${item.assignedTo}</div>
        <div><strong>Booth Code:</strong> <code>${item.boothCode}</code></div>
      </div>
    `;
  }

  document.getElementById('modal-property-archive').classList.add('active');
};

window.confirmArchiveProperty = function() {
  if (!window.targetArchivePropertyId) return;

  const store = window.appStore;
  store.archiveInventoryProperty(window.targetArchivePropertyId, 'Archived by Operator Carrillo');

  sfx.playClick();
  window.closeModals();
  window.targetArchivePropertyId = null;

  renderInventory();
  renderDashboard();
};

window.restoreArchivedProperty = function(id) {
  const store = window.appStore;
  store.restoreInventoryProperty(id);

  sfx.playChime();
  renderInventory();
  renderDashboard();
};

// =========================================================================
// VIEW 8: ORGANIZATION DEPARTMENTS & TEAMS/ROLES
// =========================================================================
function renderOrganization() {
  const container = document.getElementById('org-departments-list');
  if (!container) return;

  const store = window.appStore;
  const depts = store.data.departments;
  const emps = store.getEmployees();

  container.innerHTML = depts.map(d => {
    const deptEmps = emps.filter(e => e.department === d.id);

    return `
      <div style="padding: 14px 18px; border-radius: var(--radius-sm); background: var(--bg-surface-elevated); border: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 14.5px; font-weight: 700; color: var(--text-main);">${d.name}</div>
          <div style="font-size: 12px; color: var(--text-muted); margin-top: 3px;">
            Unit Lead: <strong>${d.head}</strong>
          </div>
        </div>
        <div style="text-align: right;">
          <span class="badge badge-info">${deptEmps.length} Staff Members</span>
        </div>
      </div>
    `;
  }).join('');
}

// =========================================================================
// THERMAL PAPER & GENERAL BACKUP UTILITIES
// =========================================================================

// Step 2 & OCR Studio functions removed.

// Legacy OCR recognition studio functions removed.

// Step 2 & OCR Studio functions removed in favor of Thermal Paper Daily Summary module.

// Database Backup & Restore
window.backupDatabaseJson = function() {
  sfx.playChime();
  const data = window.appStore.data;
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `APEX-DDN005-OmniERP-Backup-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  window.URL.revokeObjectURL(url);
};

window.restoreDatabaseJson = function(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(event) {
    try {
      const data = JSON.parse(event.target.result);
      window.appStore.save(data);
      sfx.playChime();
      alert('Database successfully restored from JSON backup!');
    } catch (err) {
      alert('Invalid backup JSON file: ' + err.message);
    }
  };
  reader.readAsText(file);
};

// Modal helpers
function initModals() {
  document.querySelectorAll('.modal-overlay').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        window.closeModals();
      }
    });
  });
}

window.closeModals = function() {
  sfx.playClick();
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
};

