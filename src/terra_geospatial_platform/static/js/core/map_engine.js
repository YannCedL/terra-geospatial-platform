// ==========================================================================
// TERRA MAP ENGINE — GESTIONNAIRE CARTOGRAPHIQUE ISOLÉ
// Pilote Leaflet, les tuiles satellites ESRI HD et les calques vectoriels
// ==========================================================================
export class MapEngine {
  constructor(elementId) {
    this.map = L.map(elementId, { zoomControl: false }).setView([48.8566, 2.3522], 12);
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    this.baseLayers = {
      satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri & Maxar, Earthstar Geographics',
        maxZoom: 19
      }),
      dark: L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenMapTiles & OpenStreetMap',
        maxZoom: 19
      }),
      osm: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }),
      terrain: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Physical_Map/MapServer/tile/{z}/{y}/{x}', {
        attribution: '&copy; Esri, USGS, NOAA',
        maxZoom: 16
      })
    };

    this.currentBaseLayer = this.baseLayers.satellite.addTo(this.map);
    this.markersLayer = L.layerGroup().addTo(this.map);
    this.vesselsLayer = L.layerGroup().addTo(this.map);
    this.flightsLayer = L.layerGroup().addTo(this.map);
    this.vesselMarkers = new Map();
    this.flightMarkers = new Map();
    this.mapEl = document.getElementById(elementId);
  }

  setBaseLayer(type) {
    if (this.baseLayers[type]) {
      this.map.removeLayer(this.currentBaseLayer);
      this.currentBaseLayer = this.baseLayers[type].addTo(this.map);
    }
  }

  setShader(mode) {
    if (!this.mapEl) return;
    this.mapEl.classList.remove('shader-flir', 'shader-nvg', 'shader-crt');
    if (mode === 'flir') this.mapEl.classList.add('shader-flir');
    else if (mode === 'nvg') this.mapEl.classList.add('shader-nvg');
    else if (mode === 'crt') this.mapEl.classList.add('shader-crt');
  }

  clear() {
    this.markersLayer.clearLayers();
    this.vesselsLayer.clearLayers();
    this.flightsLayer.clearLayers();
    this.vesselMarkers.clear();
    this.flightMarkers.clear();
  }

  updateLiveVessel(v) {
    const vLat = v.lat ?? v.latitude;
    const vLon = v.lon ?? v.longitude;
    if (!vLat || !vLon) return;
    const key = String(v.mmsi || v.name);
    const speed = v.speed_knots ? `${v.speed_knots} kts` : 'N/A';
    const popupHtml = `
      <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.8rem; min-width: 190px;">
        <b style="color: #38bdf8;">🚢 NAVIRE MARCHAND AIS (LIVE WS)</b><br>
        <b>Nom:</b> ${v.name || 'Inconnu'}<br>
        <b>MMSI:</b> ${v.mmsi || 'N/A'}<br>
        <b>Type:</b> ${v.vessel_type || v.category || 'Cargo/Tanker'}<br>
        <b>Vitesse:</b> ${speed}<br>
        <b>Cap:</b> ${v.course || v.heading || 0}°<br>
        <b>Destination:</b> ${v.destination || 'En route'}<br>
        <b>Pavillon:</b> ${v.flag || 'International'}
      </div>
    `;

    if (this.vesselMarkers.has(key)) {
      const marker = this.vesselMarkers.get(key);
      marker.setLatLng([vLat, vLon]);
      marker.setPopupContent(popupHtml);
    } else {
      const icon = L.divIcon({
        className: 'marker-vessel-wrapper',
        html: `<div class="tactical-marker-pin pin-vessel" title="${v.name || v.mmsi}">🚢</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -15]
      });
      const marker = L.marker([vLat, vLon], { icon }).addTo(this.vesselsLayer);
      marker.bindPopup(popupHtml);
      this.vesselMarkers.set(key, marker);
    }
  }

  updateLiveFlight(fl) {
    if (!fl.lat || !fl.lon) return;
    const key = String(fl.icao24 || fl.callsign);
    const alt = fl.baro_altitude_m ? `${Math.round(fl.baro_altitude_m)} m` : (fl.altitude_m ? `${Math.round(fl.altitude_m)} m` : (fl.alt_ft ? `${Math.round(fl.alt_ft)} ft` : 'En vol'));
    const speed = fl.velocity_kmh ? `${fl.velocity_kmh} km/h` : (fl.velocity_mps ? `${Math.round(fl.velocity_mps * 3.6)} km/h` : (fl.speed_kts ? `${fl.speed_kts} kts` : 'N/A'));
    const popupHtml = `
      <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.8rem; min-width: 180px;">
        <b style="color: #f59e0b;">✈️ VECTEUR AÉRIEN LIVE (WS)</b><br>
        <b>Vol / Callsign:</b> ${fl.callsign || fl.icao24 || 'Inconnu'}<br>
        <b>Opérateur:</b> ${fl.operator || fl.origin_country || 'International'}<br>
        <b>Modèle:</b> ${fl.model || 'Aéronef Civil'}<br>
        <b>Altitude:</b> ${alt}<br>
        <b>Vitesse:</b> ${speed}
      </div>
    `;

    if (this.flightMarkers.has(key)) {
      const marker = this.flightMarkers.get(key);
      marker.setLatLng([fl.lat, fl.lon]);
      marker.setPopupContent(popupHtml);
    } else {
      const icon = L.divIcon({
        className: 'marker-plane-wrapper',
        html: `<div class="tactical-marker-pin pin-plane" title="${fl.callsign || fl.icao24}">✈️</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16]
      });
      const marker = L.marker([fl.lat, fl.lon], { icon }).addTo(this.flightsLayer);
      marker.bindPopup(popupHtml);
      this.flightMarkers.set(key, marker);
    }
  }

  addCircleMarker(coords, options = {}, popupHtml = null) {
    const defaultOpts = { radius: 8, fillColor: '#38bdf8', color: '#fff', weight: 2, fillOpacity: 0.9 };
    const marker = L.circleMarker(coords, { ...defaultOpts, ...options }).addTo(this.markersLayer);
    if (popupHtml) marker.bindPopup(popupHtml);
    return marker;
  }

  addIconMarker(coords, iconHtml, className = 'custom-map-icon', iconSize = [32, 32], popupHtml = null) {
    const icon = L.divIcon({
      className: className,
      html: iconHtml,
      iconSize: iconSize,
      iconAnchor: [iconSize[0] / 2, iconSize[1] / 2],
      popupAnchor: [0, -iconSize[1] / 2]
    });
    const marker = L.marker(coords, { icon: icon }).addTo(this.markersLayer);
    if (popupHtml) marker.bindPopup(popupHtml);
    return marker;
  }

  addCircle(coords, radiusM, options = {}) {
    const defaultOpts = { color: '#38bdf8', weight: 1.5, fillOpacity: 0.05 };
    return L.circle(coords, { radius: radiusM, ...defaultOpts, ...options }).addTo(this.markersLayer);
  }

  fitBounds(points, padding = [40, 40]) {
    if (points && points.length > 0) {
      this.map.fitBounds(points, { padding });
    }
  }

  setView(coords, zoom) {
    this.map.setView(coords, zoom);
  }
}
