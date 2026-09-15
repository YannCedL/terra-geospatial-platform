// ==========================================================================
// TERRA STORE — ÉTAT RÉACTIF VUE 3 & CACHE MÉMOIRE
// Assure la persistance des résultats et la synchronisation multi-onglets
// ==========================================================================
const { reactive } = Vue;

export const store = reactive({
  currentTab: 'nexus',
  sidebarOpen: true,
  manifestOpen: false,
  baseLayer: 'satellite',
  shader: 'normal',
  viewMode: 'globe', // 'globe' (MapLibre 3D) ou '2d' (Leaflet)
  isLoading: false,
  errorMessage: null,

  // Mode War Room, Caméras & Streaming WebSocket
  warRoomActive: false,
  liveStreaming: false,
  wsConnected: false,
  wsLastEvent: null,
  activeCamera: null,
  cameraFullscreen: false,
  legendMinimized: false,
  legendVisible: true,
  mapControlsOpen: false, // Menu contextuel compact de configuration carte au-dessus de la légende
  dockVisible: true,
  zenMode: false, // Mode plein écran épuré pour contempler la carte / globe
  isFullscreen: false, // Plein écran matériel (F11 / HTML5 Fullscreen API)
  mobileNavOpen: false,

  // Écran d'accueil & Hub de Mission Tactique
  homeScreenActive: true,
  launcherQuery: '',
  bgServicesReady: false,
  servicesHealth: {
    total: 14,
    online: 0,
    services: []
  },

  // Données des formulaires de commande par onglet (champs vides par défaut, aucune donnée en dur)
  inputs: {
    nexus: { company: '', coords: '' },
    siteAudit: { coords: '', dateStart: '', dateEnd: '' },
    arena: { company: '', coords: '', radius: '5' },
    supply: { company: '', coords: '' },
    mobility: { companyA: '', companyB: '', coords: '' },
    forensic: { coords: '', date: '', hPx: null, lPx: null },
    sigint: { coords: '' }
  },

  // Cache mémoire des résultats réels par onglet
  results: {
    nexus: null,
    siteAudit: null,
    arena: null,
    supply: null,
    mobility: null,
    forensic: null,
    sigint: null,
    warRoom: null
  },

  setTab(tabId) {
    this.currentTab = tabId;
    this.sidebarOpen = true;
  },

  setLoading(val) {
    this.isLoading = val;
    if (val) this.errorMessage = null;
  },

  setError(msg) {
    this.errorMessage = msg;
    this.isLoading = false;
    this.showFeedback(msg, 'error');
  },

  feedbackToast: null,
  toastTimeout: null,
  showFeedback(msg, type = 'warning') {
    if (this.toastTimeout) clearTimeout(this.toastTimeout);
    this.feedbackToast = { message: msg, type };
    this.toastTimeout = setTimeout(() => {
      this.feedbackToast = null;
    }, 4500);
  },

  // ── Suivi de progression temps réel ──────────────────────────────────────
  progress: {
    active: false,
    title: '',
    steps: [],   // [{ label, status: 'pending'|'active'|'done'|'error', detail: '' }]
    percent: 0
  },

  startProgress(title, stepLabels) {
    this.progress = {
      active: true,
      title,
      steps: stepLabels.map(label => ({ label, status: 'pending', detail: '' })),
      percent: 0
    };
  },

  stepActive(index, detail = '') {
    if (!this.progress.steps[index]) return;
    this.progress.steps[index].status = 'active';
    this.progress.steps[index].detail = detail;
    this.progress.percent = Math.round((index / this.progress.steps.length) * 100);
  },

  stepDone(index, detail = '') {
    if (!this.progress.steps[index]) return;
    this.progress.steps[index].status = 'done';
    this.progress.steps[index].detail = detail;
    const doneCount = this.progress.steps.filter(s => s.status === 'done').length;
    this.progress.percent = Math.round((doneCount / this.progress.steps.length) * 100);
  },

  stepError(index, detail = '') {
    if (!this.progress.steps[index]) return;
    this.progress.steps[index].status = 'error';
    this.progress.steps[index].detail = detail;
  },

  endProgress(success = true) {
    this.progress.percent = 100;
    setTimeout(() => {
      this.progress.active = false;
    }, success ? 2000 : 4000);
  }
});
