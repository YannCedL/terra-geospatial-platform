import { ApiService } from '../services/api_service.js';
import { store } from '../core/store.js';

export async function runSiteAudit(mapEngine) {
  const rawCoords = (store.inputs.siteAudit.coords || '').trim();
  if (!rawCoords) {
    store.showFeedback("Veuillez renseigner les coordonnées GPS de l'actif foncier à auditer (ex: 48.8566, 2.3522).", "warning");
    const inputEl = document.querySelector('.dock-input.input-main');
    if (inputEl) inputEl.focus();
    return;
  }

  let [lat, lon] = rawCoords.split(',').map(s => parseFloat(s.trim()));
  if (isNaN(lat) || isNaN(lon)) {
    store.setError("Coordonnées GPS invalides. Format attendu : latitude, longitude (ex: 43.6047, 1.4442)");
    return;
  }

  store.startProgress(`Audit Foncier — ${lat.toFixed(4)}, ${lon.toFixed(4)}`, [
    'Validation des coordonnées GPS',
    'Audit foncier & risques naturels',
    'Réseaux vitaux & infrastructures',
    'Projection cartographique'
  ]);
  store.setLoading(true);
  if (mapEngine && typeof mapEngine.clear === 'function') mapEngine.clear();

  // Si les dates sont laissées vides, définir une période par défaut (3 dernières années)
  const today = new Date();
  const dateEnd = store.inputs.siteAudit.dateEnd || today.toISOString().split('T')[0];
  const dateStart = store.inputs.siteAudit.dateStart || new Date(today.getFullYear() - 3, today.getMonth(), today.getDate()).toISOString().split('T')[0];
  store.inputs.siteAudit.dateStart = dateStart;
  store.inputs.siteAudit.dateEnd = dateEnd;

  try {
    store.stepDone(0, `${lat.toFixed(4)}, ${lon.toFixed(4)}`);

    store.stepActive(1, `Géorisques • Cadastre • Période ${dateStart} → ${dateEnd}...`);
    const data = await ApiService.getSiteAudit(lat, lon, dateStart, dateEnd);
    store.results.siteAudit = data;
    store.stepDone(1, `Score conformité : ${data.asset_compliance_score ?? 'N/A'}/100`);

    store.stepActive(2, 'Détection réseaux OSM critiques...');
    const vitalCount = (data.vital_networks?.elements || []).length;
    store.stepDone(2, `${vitalCount} infrastructure${vitalCount > 1 ? 's' : ''} vitale${vitalCount > 1 ? 's' : ''}`);

    store.stepActive(3, 'Tracé des éléments sur la carte...');
    const auditPopup = `
      <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.8rem;">
        <b style="color: #10b981;">🏛️ ACTIF FONCIER AUDITÉ</b><br>
        <b>Score Conformité:</b> ${data.asset_compliance_score}/100<br>
        Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}
      </div>
    `;
    mapEngine.addIconMarker([lat, lon], `<div class="tactical-marker-pin pin-corporate" title="Actif Foncier">🏛️</div>`, 'marker-audit-wrapper', [34, 34], auditPopup);
    mapEngine.addCircle([lat, lon], 1000, { color: '#38bdf8' });

    (data.vital_networks?.elements || []).forEach(el => {
      if (el.lat && el.lon) {
        const popupHtml = `
          <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.8rem;">
            <b style="color: #f59e0b;">⚡ INFRASTRUCTURE VITALE</b><br>
            <b>Type:</b> ${el.type?.toUpperCase() || 'RÉSEAU'}<br>
            <b>Détail:</b> ${el.name || 'Installation critique'}
          </div>
        `;
        mapEngine.addIconMarker([el.lat, el.lon], `<div class="tactical-marker-pin pin-thermal" title="${el.type}">⚡</div>`, 'marker-vital-wrapper', [26, 26], popupHtml);
      }
    });

    mapEngine.setView([lat, lon], 14);
    store.stepDone(3, 'Carte prête');
    store.endProgress(true);
    store.setLoading(false);
  } catch (err) {
    const activeIdx = store.progress.steps.findIndex(s => s.status === 'active');
    if (activeIdx >= 0) store.stepError(activeIdx, err.message);
    store.endProgress(false);
    store.setError(err.message);
  }
}
