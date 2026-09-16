import { ApiService } from '../services/api_service.js';
import { store } from '../core/store.js';

export async function runNexus(mapEngine) {
  const company = (store.inputs.nexus.company || '').trim();
  const rawCoords = (store.inputs.nexus.coords || '').trim();

  if (!company && !rawCoords) {
    store.showFeedback("Veuillez saisir le nom d'une entreprise ou des coordonnées GPS pour lancer la fusion 360°.", "warning");
    const inputEl = document.querySelector('.dock-input.input-main');
    if (inputEl) inputEl.focus();
    return;
  }

  const steps = company
    ? ['Recherche entreprise (SIRENE/GLEIF)', 'Géolocalisation des sites', 'Rapport 360° complet', 'Projection cartographique']
    : ['Résolution des coordonnées GPS', 'Rapport 360° complet', 'Projection cartographique'];
  store.startProgress(`Nexus 360° — ${company || rawCoords}`, steps);
  store.setLoading(true);
  if (mapEngine && typeof mapEngine.clear === 'function') mapEngine.clear();

  let [lat, lon] = rawCoords ? rawCoords.split(',').map(s => parseFloat(s.trim())) : [NaN, NaN];

  try {
    let compData = { sites: [], headquarter: null };
    if (company) {
      store.stepActive(0, 'Interrogation SIRENE + GLEIF...');
      compData = await ApiService.searchCompany(company);
      const hq = compData.headquarter || (compData.sites && compData.sites[0]) || null;
      store.stepDone(0, `${(compData.sites || []).length} sites identifiés`);

      store.stepActive(1, 'Calcul du centroïde HQ...');
      if (hq && hq.lat && hq.lon) {
        lat = hq.lat;
        lon = hq.lon;
        store.inputs.nexus.coords = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
      }
      store.stepDone(1, `HQ : ${lat.toFixed(4)}, ${lon.toFixed(4)}`);
    } else {
      store.stepActive(0, 'Validation des coordonnées...');
      store.stepDone(0, `${lat.toFixed(4)}, ${lon.toFixed(4)}`);
    }

    if (isNaN(lat) || isNaN(lon)) {
      throw new Error(`Aucune localisation géographique trouvée pour "${company}". Veuillez spécifier des coordonnées GPS.`);
    }

    const reportIdx = company ? 2 : 1;
    store.stepActive(reportIdx, 'Géorisques • Aviation • Cadastre • OSM...');
    const reportData = await ApiService.getFullReport(lat, lon, company);
    store.results.nexus = { company: company || 'Cible', compData, reportData };
    const flightCount = (reportData.live_flights || []).length;
    store.stepDone(reportIdx, `${flightCount} vecteurs aériens live`);

    const mapIdx = company ? 3 : 2;
    store.stepActive(mapIdx, 'Tracé des marqueurs sur la carte...');

    const bounds = [[lat, lon]];
    mapEngine.addCircleMarker([lat, lon], { radius: 10, fillColor: '#38bdf8' }, `<b>🎯 ${company || 'Cible'}</b><br>Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}`);

    (compData.sites || []).forEach(s => {
      if (s.lat && s.lon) {
        bounds.push([s.lat, s.lon]);
        const popupHtml = `
          <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.8rem;">
            <b style="color: #10b981;">🏢 SITE CORPORATE</b><br>
            <b>Nom:</b> ${s.nom || s.label || company}<br>
            <b>Adresse:</b> ${s.adresse || 'Emplacement répertorié'}
          </div>
        `;
        mapEngine.addIconMarker([s.lat, s.lon], `<div class="tactical-marker-pin pin-corporate" title="${s.nom || s.label}">🏢</div>`, 'marker-corporate-wrapper', [30, 30], popupHtml);
      }
    });

    (reportData.live_flights || []).forEach(fl => {
      if (fl.lat && fl.lon) {
        bounds.push([fl.lat, fl.lon]);
        const popupHtml = `
          <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.8rem;">
            <b style="color: #f59e0b;">✈️ VECTEUR AÉRIEN LIVE</b><br>
            <b>Vol:</b> ${fl.callsign || fl.icao24}
          </div>
        `;
        mapEngine.addIconMarker([fl.lat, fl.lon], `<div class="tactical-marker-pin pin-plane" title="${fl.callsign || fl.icao24}">✈️</div>`, 'marker-plane-wrapper', [32, 32], popupHtml);
      }
    });

    mapEngine.fitBounds(bounds);
    store.stepDone(mapIdx, `${bounds.length} points projetés`);
    store.endProgress(true);
    store.setLoading(false);
  } catch (err) {
    const activeIdx = store.progress.steps.findIndex(s => s.status === 'active');
    if (activeIdx >= 0) store.stepError(activeIdx, err.message);
    store.endProgress(false);
    store.setError(err.message);
  }
}
