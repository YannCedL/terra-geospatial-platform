import { ApiService } from '../services/api_service.js';
import { store } from '../core/store.js';

export async function runSupply(mapEngine) {
  const comp = (store.inputs.supply.company || '').trim();
  const rawCoords = (store.inputs.supply.coords || '').trim();
  if (!comp && !rawCoords) {
    store.showFeedback("Veuillez spécifier une entreprise cible ou un port pour surveiller les flux logistiques.", "warning");
    const inputEl = document.querySelector('.dock-input.input-main');
    if (inputEl) inputEl.focus();
    return;
  }

  store.startProgress(`Supply & Flux Maritimes — ${comp || rawCoords}`, [
    'Géolocalisation du terminal',
    'Interception trafic AIS maritime',
    'Cartographie des corridors'
  ]);
  store.setLoading(true);
  if (mapEngine && typeof mapEngine.clear === 'function') mapEngine.clear();

  let [lat, lon] = rawCoords ? rawCoords.split(',').map(s => parseFloat(s.trim())) : [NaN, NaN];

  try {
    store.stepActive(0, comp ? `Recherche "${comp}"...` : 'Validation terminal portuaire...');
    if ((isNaN(lat) || isNaN(lon)) && comp) {
      const compData = await ApiService.searchCompany(comp);
      const hq = compData.headquarter || (compData.sites && compData.sites[0]) || null;
      if (hq && hq.lat && hq.lon) {
        lat = hq.lat;
        lon = hq.lon;
        store.inputs.supply.coords = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
      }
    }
    if (isNaN(lat) || isNaN(lon)) {
      lat = 49.49; lon = 0.10; // Port du Havre par défaut
    }
    store.stepDone(0, `Terminal : ${lat.toFixed(4)}, ${lon.toFixed(4)}`);

    store.stepActive(1, 'Appel AIS + Supply Chain API...');
    const data = await ApiService.getSupplyFlow(comp, lat, lon);
    store.results.supply = data;
    const vesselCount = (data.maritime_traffic?.vessels || []).length;
    const hubCount = (data.supply_chain?.hubs || []).length;
    store.stepDone(1, `${vesselCount} navire${vesselCount > 1 ? 's' : ''} • ${hubCount} hub${hubCount > 1 ? 's' : ''}`);

    store.stepActive(2, 'Projection des vecteurs maritimes...');
    const bounds = [[lat, lon]];
    mapEngine.addCircleMarker([lat, lon], { radius: 10, fillColor: '#0284c7' }, `<b>TERMINAL PORTUAIRE</b>`);

    (data.supply_chain?.hubs || []).forEach(h => {
      if (h.lat && h.lon) {
        bounds.push([h.lat, h.lon]);
        const popupHtml = `
          <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.8rem;">
            <b style="color: #0284c7;">⚓ HUB LOGISTIQUE & PORTUAIRE</b><br>
            <b>Nom:</b> ${h.label || 'Hub Stratégique'}<br>
            <b>Rôle:</b> ${h.role || 'Logistique & Transit'}
          </div>
        `;
        mapEngine.addIconMarker([h.lat, h.lon], `<div class="tactical-marker-pin pin-port" title="${h.label}">⚓</div>`, 'marker-port-wrapper', [32, 32], popupHtml);
      }
    });

    (data.maritime_traffic?.vessels || []).forEach(v => {
      const vLat = v.lat ?? v.latitude;
      const vLon = v.lon ?? v.longitude;
      if (vLat && vLon) {
        bounds.push([vLat, vLon]);
        const speed = v.speed_knots ? `${v.speed_knots} kts` : 'N/A';
        const popupHtml = `
          <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.8rem; min-width: 190px;">
            <b style="color: #38bdf8;">🚢 NAVIRE MARCHAND AIS</b><br>
            <b>Nom:</b> ${v.name || 'Inconnu'}<br>
            <b>MMSI:</b> ${v.mmsi || 'N/A'}<br>
            <b>Type:</b> ${v.vessel_type || v.category || 'Cargo/Tanker'}<br>
            <b>Vitesse:</b> ${speed}<br>
            <b>Destination:</b> ${v.destination || 'En route'}<br>
            <b>Pavillon:</b> ${v.flag || 'International'}
          </div>
        `;
        mapEngine.addIconMarker([vLat, vLon], `<div class="tactical-marker-pin pin-vessel" title="${v.name || v.mmsi}">🚢</div>`, 'marker-vessel-wrapper', [30, 30], popupHtml);
      }
    });

    mapEngine.fitBounds(bounds);
    store.stepDone(2, `${bounds.length} vecteurs projetés`);
    store.endProgress(true);
    store.setLoading(false);
  } catch (err) {
    const activeIdx = store.progress.steps.findIndex(s => s.status === 'active');
    if (activeIdx >= 0) store.stepError(activeIdx, err.message);
    store.endProgress(false);
    store.setError(err.message);
  }
}
