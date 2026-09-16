import { ApiService } from '../services/api_service.js';
import { store } from '../core/store.js';

export async function runMobility(mapEngine) {
  const companyA = (store.inputs.mobility.companyA || '').trim();
  const companyB = (store.inputs.mobility.companyB || '').trim();
  const rawCoords = (store.inputs.mobility.coords || '').trim();

  if (!companyA && !companyB && !rawCoords) {
    store.showFeedback("Veuillez spécifier au moins une entreprise ou une zone aéroportuaire pour la détection de mobilité.", "warning");
    const inputEl = document.querySelector('.dock-input.input-mini');
    if (inputEl) inputEl.focus();
    return;
  }

  const label = companyA || companyB || rawCoords;
  store.startProgress(`Aviation & M&A — ${label}`, [
    'Géolocalisation de la zone',
    'Surveillance de l\'espace aérien',
    'Cartographie des vecteurs'
  ]);
  store.setLoading(true);
  if (mapEngine && typeof mapEngine.clear === 'function') mapEngine.clear();

  let [lat, lon] = rawCoords ? rawCoords.split(',').map(s => parseFloat(s.trim())) : [NaN, NaN];

  try {
    store.stepActive(0, companyA ? `Localisation "${companyA}"...` : 'Validation zone aéroportuaire...');
    if ((isNaN(lat) || isNaN(lon)) && companyA) {
      const compData = await ApiService.searchCompany(companyA);
      const hq = compData.headquarter || (compData.sites && compData.sites[0]) || null;
      if (hq && hq.lat && hq.lon) {
        lat = hq.lat;
        lon = hq.lon;
        store.inputs.mobility.coords = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
      }
    }
    if (isNaN(lat) || isNaN(lon)) {
      lat = 48.7262; lon = 2.3652; // Orly / Aviation d'affaires
    }
    store.stepDone(0, `Zone : ${lat.toFixed(4)}, ${lon.toFixed(4)}`);

    store.stepActive(1, 'OpenSky + Aérodromes VIP...');
    const data = await ApiService.getExecutiveMobility(companyA, companyB, lat, lon);
    store.results.mobility = data;
    const flightCount = (data.airspace_monitoring?.flights || []).length;
    const airfieldCount = (data.nearby_airfields || []).length;
    store.stepDone(1, `${flightCount} vol${flightCount > 1 ? 's' : ''} • ${airfieldCount} aérodrome${airfieldCount > 1 ? 's' : ''}`);

    store.stepActive(2, 'Projection des trajectoires...');
    const bounds = [[lat, lon]];
    (data.nearby_airfields || []).forEach(af => {
      if (af.lat && af.lon) {
        bounds.push([af.lat, af.lon]);
        const popupHtml = `
          <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.8rem;">
            <b style="color: #38bdf8;">🛫 INFRASTRUCTURE AÉROPORTUAIRE VIP</b><br>
            <b>Nom:</b> ${af.name || 'Aérodrome'}<br>
            <b>Type:</b> Terminal d'affaires / Piste certifiée
          </div>
        `;
        mapEngine.addIconMarker([af.lat, af.lon], `<div class="tactical-marker-pin pin-port" title="${af.name || 'Aérodrome'}">🛫</div>`, 'marker-airfield-wrapper', [32, 32], popupHtml);
      }
    });

    (data.airspace_monitoring?.flights || []).forEach(fl => {
      if (fl.lat && fl.lon) {
        bounds.push([fl.lat, fl.lon]);
        const popupHtml = `
          <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.8rem;">
            <b style="color: #f59e0b;">✈️ JET D'AFFAIRES / VOL ACTIF</b><br>
            <b>Identifiant:</b> ${fl.callsign || fl.icao24}<br>
            <b>Altitude:</b> ${fl.baro_altitude_m ? Math.round(fl.baro_altitude_m) + ' m' : 'En vol'}<br>
            <b>Vitesse:</b> ${fl.velocity_mps ? Math.round(fl.velocity_mps * 3.6) + ' km/h' : 'N/A'}
          </div>
        `;
        mapEngine.addIconMarker([fl.lat, fl.lon], `<div class="tactical-marker-pin pin-plane" title="${fl.callsign || fl.icao24}">✈️</div>`, 'marker-plane-wrapper', [32, 32], popupHtml);
      }
    });

    mapEngine.fitBounds(bounds);
    store.stepDone(2, `${bounds.length} vecteurs cartographiés`);
    store.endProgress(true);
    store.setLoading(false);
  } catch (err) {
    const activeIdx = store.progress.steps.findIndex(s => s.status === 'active');
    if (activeIdx >= 0) store.stepError(activeIdx, err.message);
    store.endProgress(false);
    store.setError(err.message);
  }
}
