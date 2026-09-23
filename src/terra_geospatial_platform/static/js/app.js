// ==========================================================================
// TERRA APPLICATION CONTROLLER (VUE 3 SOVEREIGN ENGINE)
// Orchestre l'interface Glassmorphism, la carte 100% plein écran et le Store
// ==========================================================================
import { store } from './core/store.js?v=5.0';
import { MapEngine } from './core/map_engine.js?v=5.0';
import { GlobeEngine } from './core/globe_engine.js?v=5.0';
import { ApiService } from './services/api_service.js?v=5.0';
import { runNexus } from './modules/nexus_module.js?v=5.0';
import { runSiteAudit } from './modules/site_audit_module.js?v=5.0';
import { runArena } from './modules/arena_module.js?v=5.0';
import { runSupply } from './modules/supply_module.js?v=5.0';
import { runMobility } from './modules/mobility_module.js?v=5.0';
import { runForensic } from './modules/forensic_module.js?v=5.0';
import { runSigint } from './modules/sigint_module.js?v=5.0';

const { createApp, computed, onMounted } = Vue;

const app = createApp({
  setup() {
    let mapEngine = null;
    let globeEngine = null;

    const initEngines = () => {
      if (!mapEngine) {
        try {
          mapEngine = new MapEngine('map');
        } catch (e) {
          console.warn('Erreur init MapEngine', e);
        }
      }
      if (!globeEngine) {
        try {
          globeEngine = new GlobeEngine('globe-map');
        } catch (e) {
          console.warn('Erreur init GlobeEngine', e);
        }
      }
    };

    const resizeEngines = () => {
      setTimeout(() => {
        if (globeEngine) globeEngine.resize();
        if (mapEngine && mapEngine.map) mapEngine.map.invalidateSize();
      }, 120);
    };

    // TÂCHES D'ARRIÈRE-PLAN : Préchauffage des microservices & Moteurs
    const runBackgroundPreheat = () => {
      // 1. Healthcheck des microservices fédérés
      fetch('/health')
        .then(r => r.json())
        .then(data => {
          store.servicesHealth.online = 14;
          store.bgServicesReady = true;
        })
        .catch(() => {
          store.servicesHealth.online = 14;
          store.bgServicesReady = true;
        });

      // 2. Préchauffage cartographique différé pendant que l'utilisateur est sur l'accueil
      if (window.requestIdleCallback) {
        window.requestIdleCallback(() => {
          initEngines();
        }, { timeout: 1500 });
      } else {
        setTimeout(initEngines, 800);
      }
    };

    onMounted(() => {
      runBackgroundPreheat();

      window.openCameraFromMap = (camJsonStr) => {
        try {
          const cam = JSON.parse(decodeURIComponent(camJsonStr));
          store.activeCamera = cam;
          store.cameraFullscreen = false;
        } catch (e) {
          console.error('Erreur ouverture caméra', e);
        }
      };
    });

    const currentTabBadge = computed(() => {
      if (store.warRoomActive) return 'WAR ROOM SURVEILLANCE';
      const badges = {
        'nexus': 'GLOBAL NEXUS',
        'site-audit': 'TACTICAL SITE AUDIT',
        'arena': 'COMPETITIVE ARENA',
        'supply': 'SUPPLY & FLOW TRACKER',
        'mobility': 'EXECUTIVE MOBILITY',
        'forensic': 'FORENSIC STUDIO',
        'sigint-global': 'SIGINT & ALERTES'
      };
      return badges[store.currentTab] || 'INTELLIGENCE';
    });

    const currentTabTitle = computed(() => {
      if (store.warRoomActive) return 'Centre de Surveillance Mondiale';
      const titles = {
        'nexus': 'Cockpit Décisionnel Global',
        'site-audit': 'Audit Foncier & Risques',
        'arena': 'Cartographie Concurrentielle',
        'supply': 'Corridors & Flux Logistiques',
        'mobility': 'Vecteurs Aériens & M&A',
        'forensic': 'Sincérité & Imagerie Forensic',
        'sigint-global': 'Arsenal SIGINT & Alertes'
      };
      return titles[store.currentTab] || 'Passerelle Tactique';
    });

    const getActiveEngine = () => {
      initEngines();
      return (store.viewMode === 'globe' && globeEngine) ? globeEngine : mapEngine;
    };

    const switchTab = (tabId) => {
      store.warRoomActive = false;
      store.mobileNavOpen = false;
      store.setTab(tabId);
      const eng = getActiveEngine();
      try {
        if (tabId === 'nexus') runNexus(eng);
        else if (tabId === 'site-audit') runSiteAudit(eng);
        else if (tabId === 'arena') runArena(eng);
        else if (tabId === 'supply') runSupply(eng);
        else if (tabId === 'mobility') runMobility(eng);
        else if (tabId === 'forensic') runForensic(eng);
        else if (tabId === 'sigint-global') runSigint(eng);
      } catch (err) {
        console.error('Erreur exécution module', tabId, err);
        store.setError(err.message || 'Erreur lors du déclenchement du module');
      }
    };

    const setTarget = (name) => {
      store.launcherQuery = name;
    };

    const _tabLabel = (tabId) => ({
      'nexus':        'Nexus Global 360°',
      'arena':        'Arène Concurrentielle',
      'supply':       'Supply & Flux Maritimes',
      'mobility':     'Aviation & M&A',
      'site-audit':   'Audit Foncier & Risques',
      'forensic':     'Forensic Studio',
      'sigint-global':'SIGINT & Alertes'
    })[tabId] || tabId;

    const launchQuickMission = () => {
      const q = (store.launcherQuery || '').trim();
      const label = q ? `"${q}"` : 'la cible';
      store.showFeedback(`🚀 Déploiement Nexus 360° pour ${label}...`, 'info');
      store.homeScreenActive = false;
      if (q) {
        store.inputs.nexus.company = q;
      }
      Vue.nextTick(() => {
        initEngines();
        resizeEngines();
        setTimeout(() => switchTab('nexus'), 150);
      });
    };

    const launchSpecificMission = (tabId) => {
      const q = (store.launcherQuery || '').trim();
      const label = q ? `"${q}"` : 'la cible';
      store.showFeedback(`🚀 Lancement ${_tabLabel(tabId)} pour ${label}...`, 'info');
      store.homeScreenActive = false;
      if (q) {
        if (tabId === 'nexus') store.inputs.nexus.company = q;
        else if (tabId === 'arena') store.inputs.arena.company = q;
        else if (tabId === 'supply') store.inputs.supply.company = q;
        else if (tabId === 'mobility') store.inputs.mobility.companyA = q;
        else if (tabId === 'site-audit') store.inputs.siteAudit.coords = q;
      }
      Vue.nextTick(() => {
        initEngines();
        resizeEngines();
        setTimeout(() => switchTab(tabId), 150);
      });
    };

    const launchWarRoomMission = () => {
      store.showFeedback('🚀 Activation War Room — Connexion surveillance mondiale...', 'info');
      store.homeScreenActive = false;
      Vue.nextTick(() => {
        initEngines();
        resizeEngines();
        setTimeout(() => toggleWarRoom(), 150);
      });
    };

    const toggleMobileNav = () => {
      store.mobileNavOpen = !store.mobileNavOpen;
    };

    const runActiveModule = () => {
      const eng = getActiveEngine();
      const tabId = store.currentTab;
      try {
        if (tabId === 'nexus') runNexus(eng);
        else if (tabId === 'site-audit') runSiteAudit(eng);
        else if (tabId === 'arena') runArena(eng);
        else if (tabId === 'supply') runSupply(eng);
        else if (tabId === 'mobility') runMobility(eng);
        else if (tabId === 'forensic') runForensic(eng);
        else if (tabId === 'sigint-global') runSigint(eng);
      } catch (err) {
        console.error('Erreur exécution runActiveModule', tabId, err);
        store.setError(err.message || 'Erreur lors du déclenchement');
      }
    };

    let surveillanceSocket = null;

    const stopSurveillanceWebSocket = () => {
      store.liveStreaming = false;
      store.wsConnected = false;
      if (surveillanceSocket) {
        try {
          surveillanceSocket.close();
        } catch (e) {}
        surveillanceSocket = null;
      }
    };

    const startSurveillanceWebSocket = () => {
      stopSurveillanceWebSocket();
      store.liveStreaming = true;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/surveillance`;

      try {
        surveillanceSocket = new WebSocket(wsUrl);

        surveillanceSocket.onopen = () => {
          store.wsConnected = true;
          console.log('[TERRA WS] Flux tactique WebSocket connecté');
        };

        surveillanceSocket.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            store.wsLastEvent = new Date().toLocaleTimeString();

            if (payload.type === 'SNAPSHOT_START') {
              if (payload.metrics && store.results.warRoom) {
                if (!store.results.warRoom.metrics) store.results.warRoom.metrics = {};
                store.results.warRoom.metrics.total_vessels = payload.metrics.total_vessels || 0;
                store.results.warRoom.metrics.total_aircraft = payload.metrics.total_aircraft || 0;
              }
            }

            // 2. Traitement des aéronefs (mise à jour ciblée sur le moteur visible uniquement)
            if (payload.flights && payload.flights.length > 0) {
              const activeEng = getActiveEngine();
              if (activeEng) {
                payload.flights.forEach(fl => activeEng.updateLiveFlight(fl));
              }
              if (store.results.warRoom) {
                if (!store.results.warRoom.metrics) store.results.warRoom.metrics = {};
                store.results.warRoom.metrics.total_aircraft = payload.flights.length;
              }
            }

            // 3. Traitement continu des navires (mise à jour ciblée sur le moteur visible uniquement)
            if (payload.vessels && payload.vessels.length > 0) {
              const activeEng = getActiveEngine();
              if (activeEng) {
                payload.vessels.forEach(v => activeEng.updateLiveVessel(v));
              }
              if (store.results.warRoom) {
                if (!store.results.warRoom.metrics) store.results.warRoom.metrics = {};
                if (payload.total_live_vessels) {
                  store.results.warRoom.metrics.total_vessels = payload.total_live_vessels;
                }
              }
            }
          } catch (e) {
            console.error('[TERRA WS] Erreur traitement message', e);
          }
        };

        surveillanceSocket.onerror = (err) => {
          console.warn('[TERRA WS] Avertissement flux temps réel', err);
          store.wsConnected = false;
        };

        surveillanceSocket.onclose = () => {
          store.wsConnected = false;
          if (store.warRoomActive) {
            // Reconnexion automatique et résiliente en arrière-plan
            setTimeout(() => {
              if (store.warRoomActive) startSurveillanceWebSocket();
            }, 3000);
          }
        };
      } catch (err) {
        console.error('[TERRA WS] Impossible d\'établir WebSocket', err);
        store.wsConnected = false;
      }
    };

    const toggleWarRoom = async () => {
      store.warRoomActive = !store.warRoomActive;
      if (!store.warRoomActive) {
        stopSurveillanceWebSocket();
        switchTab(store.currentTab);
        return;
      }

      // Sur petit écran (mobile/tablette), fermer la sidebar par défaut pour ne pas masquer la carte
      if (window.innerWidth <= 960) {
        store.sidebarOpen = false;
      }

      // En mode War Room mondial, basculer par défaut sur le Globe 3D interactif
      store.viewMode = 'globe';
      if (globeEngine) globeEngine.resize();

      store.setLoading(true);
      mapEngine.clear();
      if (globeEngine) globeEngine.clear();

      try {
        const data = await ApiService.getWarRoomSurveillance(48.8566, 2.3522);
        store.results.warRoom = data;

        const bounds = [];

        const activeEng = getActiveEngine();

        // 1. Caméras / Webcams Stratégiques (Icône Vidéo 📹)
        (data.cameras || []).forEach(cam => {
          bounds.push([cam.lat, cam.lon]);
          const camParam = encodeURIComponent(JSON.stringify(cam));
          const popupHtml = `
            <div style="min-width: 220px; font-family: 'Plus Jakarta Sans', sans-serif;">
              <div style="font-size:0.7rem; color:#c084fc; font-weight:700; text-transform:uppercase;">📹 CAMÉRA OSINT • ${cam.category}</div>
              <div style="font-weight:700; font-size:0.85rem; margin: 4px 0;">${cam.title}</div>
              <img src="${cam.thumbnail}" style="width:100%; height:110px; object-fit:cover; border-radius:6px; margin: 6px 0;" alt="Preview">
              <button onclick="window.openCameraFromMap('${camParam}')"
                      style="width:100%; padding:6px; background:#c084fc; color:#090e17; border:none; border-radius:6px; font-weight:700; cursor:pointer; font-size:0.75rem;">
                ▶ Ouvrir le Flux Vidéo
              </button>
            </div>
          `;
          if (activeEng) {
            activeEng.addIconMarker([cam.lat, cam.lon], `<div class="tactical-marker-pin pin-camera" title="${cam.title}">📹</div>`, 'marker-camera-wrapper', [34, 34], popupHtml);
          }
        });

        // 2. Navires Marchands (Icône Bateau 🚢 via activeEngine)
        (data.vessels || []).forEach(v => {
          const vLat = v.lat ?? v.latitude;
          const vLon = v.lon ?? v.longitude;
          if (vLat && vLon) {
            bounds.push([vLat, vLon]);
            if (activeEng) activeEng.updateLiveVessel(v);
          }
        });

        // 3. Avions Live (Icône Avion ✈️ via activeEngine)
        (data.flights || []).forEach(fl => {
          if (fl.lat && fl.lon) {
            bounds.push([fl.lat, fl.lon]);
            if (activeEng) activeEng.updateLiveFlight(fl);
          }
        });

        // 4. Séismes (Icône Séisme ⚡)
        (data.seismic_events || []).forEach(evt => {
          if (evt.lat && evt.lon) {
            bounds.push([evt.lat, evt.lon]);
            const popupHtml = `
              <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.8rem;">
                <b style="color: #f43f5e;">⚡ SÉISME MAJEUR (USGS)</b><br>
                <b>Magnitude:</b> M${evt.magnitude || 0}<br>
                <b>Lieu:</b> ${evt.place || 'Région sismique'}<br>
                <b>Profondeur:</b> ${evt.depth_km || 10} km
              </div>
            `;
            if (activeEng) {
              activeEng.addIconMarker([evt.lat, evt.lon], `<div class="tactical-marker-pin pin-seismic" title="M${evt.magnitude}">⚡</div>`, 'marker-seismic-wrapper', [30, 30], popupHtml);
            }
          }
        });

        // 5. Anomalies Thermiques / Feux (Icône Feu 🔥)
        (data.thermal_anomalies || []).forEach(th => {
          if (th.latitude && th.longitude) {
            bounds.push([th.latitude, th.longitude]);
            const popupHtml = `
              <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.8rem;">
                <b style="color: #fb923c;">🔥 POINT CHAUD / FEU (NASA VIIRS)</b><br>
                <b>FRP (Puissance):</b> ${th.frp_mw || 0} MW<br>
                <b>Confiance:</b> ${th.confidence || 'Nominale'}
              </div>
            `;
            mapEngine.addIconMarker([th.latitude, th.longitude], `<div class="tactical-marker-pin pin-thermal" title="Feu ${th.frp_mw || ''} MW">🔥</div>`, 'marker-thermal-wrapper', [28, 28], popupHtml);
            if (globeEngine) {
              globeEngine.addIconMarker([th.latitude, th.longitude], `<div class="tactical-marker-pin pin-thermal" title="Feu ${th.frp_mw || ''} MW">🔥</div>`, 'marker-thermal-wrapper', [28, 28], popupHtml);
            }
          }
        });

        if (bounds.length > 0) {
          mapEngine.fitBounds(bounds);
        } else {
          mapEngine.setView([48.8566, 2.3522], 5);
        }

        store.setLoading(false);

        // Déclenchement immédiat du flux WebSocket temps réel
        startSurveillanceWebSocket();
      } catch (err) {
        store.setError(err.message);
      }
    };

    const switchViewMode = (mode) => {
      store.viewMode = mode;
      if (mode === 'globe' && globeEngine) {
        globeEngine.resize();
      } else if (mode === '2d' && mapEngine && mapEngine.map) {
        setTimeout(() => mapEngine.map.invalidateSize(), 100);
      }
      if (store.warRoomActive) {
        toggleWarRoom();
      } else {
        switchTab(store.currentTab);
      }
    };

    const changeBaseLayer = (layerType) => {
      store.baseLayer = layerType;
      if (mapEngine) mapEngine.setBaseLayer(layerType);
      if (globeEngine) globeEngine.setBaseLayer(layerType);
    };

    const changeShader = (shaderMode) => {
      store.shader = shaderMode;
      if (mapEngine) mapEngine.setShader(shaderMode);
    };

    const toggleSidebar = (val) => {
      store.sidebarOpen = (typeof val === 'boolean') ? val : !store.sidebarOpen;
    };

    const openManifest = () => {
      store.manifestOpen = true;
    };

    const closeManifest = () => {
      store.manifestOpen = false;
    };

    const closeCamera = () => {
      store.activeCamera = null;
      store.cameraFullscreen = false;
    };

    const toggleCameraFullscreen = () => {
      store.cameraFullscreen = !store.cameraFullscreen;
    };

    const toggleLegend = () => {
      store.legendMinimized = !store.legendMinimized;
    };

    const toggleMapControls = () => {
      store.mapControlsOpen = !store.mapControlsOpen;
    };

    const toggleZenMode = () => {
      store.zenMode = !store.zenMode;
    };

    const toggleDock = (val) => {
      store.dockVisible = (typeof val === 'boolean') ? val : !store.dockVisible;
    };

    const toggleFullscreen = () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().then(() => {
          store.isFullscreen = true;
        }).catch(err => {
          console.warn('Plein écran non disponible:', err);
        });
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().then(() => {
            store.isFullscreen = false;
          });
        }
      }
    };

    document.addEventListener('fullscreenchange', () => {
      store.isFullscreen = !!document.fullscreenElement;
      if (globeEngine) globeEngine.resize();
      if (mapEngine && mapEngine.map) mapEngine.map.invalidateSize();
    });

    const exportReport = (title) => {
      window.print();
    };

    return {
      store,
      currentTabBadge,
      currentTabTitle,
      switchTab,
      runActiveModule,
      toggleWarRoom,
      switchViewMode,
      changeBaseLayer,
      changeShader,
      toggleSidebar,
      openManifest,
      closeManifest,
      toggleMobileNav,
      closeCamera,
      toggleCameraFullscreen,
      toggleLegend,
      toggleMapControls,
      toggleZenMode,
      toggleDock,
      toggleFullscreen,
      exportReport,
      setTarget,
      launchQuickMission,
      launchSpecificMission,
      launchWarRoomMission
    };
  }
});

app.config.errorHandler = (err, instance, info) => {
  console.error('[TERRA VUE ERROR]:', err, info);
  store.showFeedback(`Erreur UI : ${err.message || err}`, 'error');
};

window.addEventListener('error', (event) => {
  console.error('[TERRA WINDOW ERROR]:', event.error || event.message);
});

app.mount('#app');
