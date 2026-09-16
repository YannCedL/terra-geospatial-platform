import { ApiService } from '../services/api_service.js';
import { store } from '../core/store.js';

export async function runArena(mapEngine) {
  const comp = (store.inputs.arena.company || '').trim();
  const rawCoords = (store.inputs.arena.coords || '').trim();
  if (!comp && !rawCoords) {
    store.showFeedback("Veuillez indiquer une entreprise cible ou des coordonnées GPS pour analyser l'arène concurrentielle.", "warning");
    const inputEl = document.querySelector('.dock-input.input-main');
    if (inputEl) inputEl.focus();
    return;
  }

  store.startProgress(`Arène Concurrentielle — ${comp || rawCoords}`, [
    'Géolocalisation de la cible',
    'Scan des concurrents dans la zone',
    'Cartographie de l\'arène'
  ]);
  store.setLoading(true);
  if (mapEngine && typeof mapEngine.clear === 'function') mapEngine.clear();

  let [lat, lon] = rawCoords ? rawCoords.split(',').map(s => parseFloat(s.trim())) : [NaN, NaN];

  try {
    store.stepActive(0, comp ? `Recherche "${comp}" dans SIRENE...` : 'Validation GPS...');
    if ((isNaN(lat) || isNaN(lon)) && comp) {
      const compData = await ApiService.searchCompany(comp);
      const hq = compData.headquarter || (compData.sites && compData.sites[0]) || null;
      if (hq && hq.lat && hq.lon) {
        lat = hq.lat;
        lon = hq.lon;
        store.inputs.arena.coords = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
      }
    }
    if (isNaN(lat) || isNaN(lon)) {
      throw new Error(`Aucune localisation géographique trouvée pour "${comp}". Spécifiez un point GPS.`);
    }
    store.stepDone(0, `Centre : ${lat.toFixed(4)}, ${lon.toFixed(4)}`);

    const rad = parseFloat(store.inputs.arena.radius) || 5;
    store.stepActive(1, `Rayon ${rad} km — interrogation Arena API...`);
    const data = await ApiService.getCompetitiveArena(comp, lat, lon, rad);
    store.results.arena = data;
    const compCount = (data.competitors || []).length;
    store.stepDone(1, `${compCount} concurrent${compCount > 1 ? 's' : ''} détecté${compCount > 1 ? 's' : ''}`);

    store.stepActive(2, 'Tracé du périmètre et des marqueurs...');
    mapEngine.addCircle([lat, lon], rad * 1000, { color: '#a855f7' });
    const targetPopup = `
      <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.8rem;">
        <b style="color: #38bdf8;">🎯 ÉTABLISSEMENT CIBLE</b><br>
        <b>Groupe:</b> ${comp}
      </div>
    `;
    mapEngine.addIconMarker([lat, lon], `<div class="tactical-marker-pin pin-target" title="${comp}">🎯</div>`, 'marker-target-wrapper', [32, 32], targetPopup);

    const bounds = [[lat, lon]];
    (data.competitors || []).forEach(c => {
      if (c.lat && c.lon) {
        bounds.push([c.lat, c.lon]);
        const popupHtml = `
          <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.8rem;">
            <b style="color: #ef4444;">⚔️ SITE CONCURRENT IDENTIFIÉ</b><br>
            <b>Enseigne:</b> ${c.nom || c.nom_complet}<br>
            <b>Distance:</b> ${c.distance_m ? (c.distance_m / 1000).toFixed(2) + ' km' : 'N/A'}
          </div>
        `;
        mapEngine.addIconMarker([c.lat, c.lon], `<div class="tactical-marker-pin pin-seismic" title="${c.nom || c.nom_complet}">⚔️</div>`, 'marker-competitor-wrapper', [28, 28], popupHtml);
      }
    });

    mapEngine.fitBounds(bounds);
    store.stepDone(2, `Arène de ${rad} km tracée`);
    store.endProgress(true);
    store.setLoading(false);
  } catch (err) {
    const activeIdx = store.progress.steps.findIndex(s => s.status === 'active');
    if (activeIdx >= 0) store.stepError(activeIdx, err.message);
    store.endProgress(false);
    store.setError(err.message);
  }
}
