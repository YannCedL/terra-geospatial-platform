// ==========================================================================
// TERRA GLOBE ENGINE — MOTEUR DE PROJECTION GLOBE 3D (MAPLIBRE GL)
// Rendu WebGL Spherique Haute Fidelite & Telemetrie C4ISR en Temps Reel
// ==========================================================================

export class GlobeEngine {
  constructor(elementId) {
    this.elementId = elementId;
    this.map = null;
    this.isLoaded = false;
    this.vesselMarkers = new Map();
    this.flightMarkers = new Map();
    this.generalMarkers = [];
    this.currentBaseLayer = 'satellite';

    this.baseStyles = {
      satellite: {
        version: 8,
        sources: {
          'esri-satellite': {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            attribution: '&copy; Esri, Maxar, Earthstar Geographics'
          }
        },
        layers: [
          {
            id: 'esri-satellite-layer',
            type: 'raster',
            source: 'esri-satellite',
            minzoom: 0,
            maxzoom: 19
          }
        ]
      },
      dark: {
        version: 8,
        sources: {
          'carto-dark': {
            type: 'raster',
            tiles: [
              'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
              'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'
            ],
            tileSize: 256,
            attribution: '&copy; CARTO & OpenStreetMap'
          }
        },
        layers: [
          {
            id: 'carto-dark-layer',
            type: 'raster',
            source: 'carto-dark',
            minzoom: 0,
            maxzoom: 19
          }
        ]
      },
      osm: {
        version: 8,
        sources: {
          'osm-tiles': {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '&copy; OpenStreetMap contributors'
          }
        },
        layers: [
          {
            id: 'osm-layer',
            type: 'raster',
            source: 'osm-tiles',
            minzoom: 0,
            maxzoom: 19
          }
        ]
      },
      terrain: {
        version: 8,
        sources: {
          'esri-terrain': {
            type: 'raster',
            tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}'],
            tileSize: 256,
            attribution: '&copy; Esri, USGS, NOAA'
          }
        },
        layers: [
          {
            id: 'esri-terrain-layer',
            type: 'raster',
            source: 'esri-terrain',
            minzoom: 0,
            maxzoom: 16
          }
        ]
      }
    };

    this.initMap();
  }

  initMap() {
    if (typeof maplibregl === 'undefined') {
      console.warn('[TERRA GLOBE] MapLibre GL non charge.');
      return;
    }

    this.map = new maplibregl.Map({
      container: this.elementId,
      style: this.baseStyles.satellite,
      center: [2.3522, 48.8566],
      zoom: 1.8,
      pitch: 20,
      bearing: 0,
      attributionControl: false
    });

    // Activer la projection Globe spherique native de MapLibre GL v4
    this.map.on('style.load', () => {
      try {
        if (typeof this.map.setProjection === 'function') {
          this.map.setProjection({ type: 'globe' });
        }
      } catch (err) {
        console.warn('[TERRA GLOBE] Projection globe exception:', err);
      }
    });

    this.map.on('load', () => {
      this.isLoaded = true;
      console.log('[TERRA GLOBE] Globe 3D initialise avec succes');
    });

    this.map.addControl(new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }), 'bottom-right');
  }

  setBaseLayer(type) {
    if (!this.map || !this.baseStyles[type]) return;
    this.currentBaseLayer = type;
    this.map.setStyle(this.baseStyles[type]);
    this.map.once('style.load', () => {
      if (typeof this.map.setProjection === 'function') {
        this.map.setProjection({ type: 'globe' });
      }
    });
  }

  clear() {
    this.vesselMarkers.forEach(m => m.remove());
    this.vesselMarkers.clear();

    this.flightMarkers.forEach(m => m.remove());
    this.flightMarkers.clear();

    this.generalMarkers.forEach(m => m.remove());
    this.generalMarkers = [];
  }

  addIconMarker(coords, iconHtml, className = 'custom-globe-icon', iconSize = [32, 32], popupHtml = null) {
    if (!this.map) return null;
    const [lat, lon] = coords;
    if (lat == null || lon == null) return null;

    const el = document.createElement('div');
    el.className = className;
    el.innerHTML = iconHtml;
    el.style.width = `${iconSize[0]}px`;
    el.style.height = `${iconSize[1]}px`;

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([lon, lat])
      .addTo(this.map);

    if (popupHtml) {
      const popup = new maplibregl.Popup({ offset: iconSize[1] / 2 }).setHTML(popupHtml);
      marker.setPopup(popup);
    }

    this.generalMarkers.push(marker);
    return marker;
  }

  addCircleMarker(coords, options = {}, popupHtml = null) {
    if (!this.map) return null;
    const [lat, lon] = coords;
    if (lat == null || lon == null) return null;

    const el = document.createElement('div');
    el.className = 'custom-globe-target-pin';
    el.innerHTML = `<span style="font-size: 22px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8));">🎯</span>`;
    el.style.width = '24px';
    el.style.height = '24px';
    el.style.display = 'flex';
    el.style.alignItems = 'center';
    el.style.justifyContent = 'center';
    el.style.cursor = 'pointer';

    const marker = new maplibregl.Marker({ element: el })
      .setLngLat([lon, lat])
      .addTo(this.map);

    if (popupHtml) {
      const popup = new maplibregl.Popup({ offset: 14 }).setHTML(popupHtml);
      marker.setPopup(popup);
    }

    this.generalMarkers.push(marker);
    return marker;
  }

  addCircle(coords, radiusM, options = {}) {
    // Globe 3D fallback: simple point center / bounds
    return null;
  }

  updateLiveVessel(v) {
    if (!this.map) return;
    const vLat = v.lat ?? v.latitude;
    const vLon = v.lon ?? v.longitude;
    if (vLat == null || vLon == null) return;

    const key = String(v.mmsi || v.name);
    const speed = v.speed_knots ? `${v.speed_knots} kts` : 'N/A';
    const popupHtml = `
      <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.8rem; min-width: 190px;">
        <b style="color: #38bdf8;">NAVIRE MARCHAND AIS (GLOBE 3D)</b><br>
        <b>Nom:</b> ${v.name || 'Inconnu'}<br>
        <b>MMSI:</b> ${v.mmsi || 'N/A'}<br>
        <b>Type:</b> ${v.vessel_type || v.category || 'Cargo/Tanker'}<br>
        <b>Vitesse:</b> ${speed}<br>
        <b>Cap:</b> ${v.course || v.heading || 0}&deg;<br>
        <b>Destination:</b> ${v.destination || 'En route'}<br>
        <b>Pavillon:</b> ${v.flag || 'International'}
      </div>
    `;

    if (this.vesselMarkers.has(key)) {
      const marker = this.vesselMarkers.get(key);
      marker.setLngLat([vLon, vLat]);
      const popup = marker.getPopup();
      if (popup) popup.setHTML(popupHtml);
    } else {
      const el = document.createElement('div');
      el.className = 'marker-vessel-wrapper';
      el.innerHTML = `<div class="tactical-marker-pin pin-vessel" title="${v.name || v.mmsi}">🚢</div>`;
      el.style.width = '30px';
      el.style.height = '30px';

      const popup = new maplibregl.Popup({ offset: 15 }).setHTML(popupHtml);
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([vLon, vLat])
        .setPopup(popup)
        .addTo(this.map);

      this.vesselMarkers.set(key, marker);
    }
  }

  updateLiveFlight(fl) {
    if (!this.map || fl.lat == null || fl.lon == null) return;
    const key = String(fl.icao24 || fl.callsign);
    const alt = fl.baro_altitude_m ? `${Math.round(fl.baro_altitude_m)} m` : (fl.altitude_m ? `${Math.round(fl.altitude_m)} m` : (fl.alt_ft ? `${Math.round(fl.alt_ft)} ft` : 'En vol'));
    const speed = fl.velocity_kmh ? `${fl.velocity_kmh} km/h` : (fl.velocity_mps ? `${Math.round(fl.velocity_mps * 3.6)} km/h` : (fl.speed_kts ? `${fl.speed_kts} kts` : 'N/A'));

    const popupHtml = `
      <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.8rem; min-width: 180px;">
        <b style="color: #f59e0b;">VECTEUR AERIEN LIVE (GLOBE 3D)</b><br>
        <b>Vol / Callsign:</b> ${fl.callsign || fl.icao24 || 'Inconnu'}<br>
        <b>Operateur:</b> ${fl.operator || fl.origin_country || 'International'}<br>
        <b>Modele:</b> ${fl.model || 'Aeronef Civil'}<br>
        <b>Altitude:</b> ${alt}<br>
        <b>Vitesse:</b> ${speed}
      </div>
    `;

    if (this.flightMarkers.has(key)) {
      const marker = this.flightMarkers.get(key);
      marker.setLngLat([fl.lon, fl.lat]);
      const popup = marker.getPopup();
      if (popup) popup.setHTML(popupHtml);
    } else {
      const el = document.createElement('div');
      el.className = 'marker-plane-wrapper';
      el.innerHTML = `<div class="tactical-marker-pin pin-plane" title="${fl.callsign || fl.icao24}">✈️</div>`;
      el.style.width = '32px';
      el.style.height = '32px';

      const popup = new maplibregl.Popup({ offset: 16 }).setHTML(popupHtml);
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([fl.lon, fl.lat])
        .setPopup(popup)
        .addTo(this.map);

      this.flightMarkers.set(key, marker);
    }
  }

  fitBounds(points) {
    if (!this.map || !points || points.length === 0) return;
    try {
      const bounds = new maplibregl.LngLatBounds();
      points.forEach(pt => {
        if (Array.isArray(pt) && pt.length >= 2) {
          bounds.extend([pt[1], pt[0]]);
        }
      });
      this.map.fitBounds(bounds, { padding: 80, maxZoom: 14 });
    } catch (e) {
      console.warn('[TERRA GLOBE] fitBounds warning:', e);
    }
  }

  setView(coords, zoom = 3) {
    if (!this.map) return;
    const [lat, lon] = coords;
    this.map.flyTo({ center: [lon, lat], zoom: zoom, essential: true });
  }

  resize() {
    if (this.map) {
      setTimeout(() => this.map.resize(), 100);
    }
  }
}
