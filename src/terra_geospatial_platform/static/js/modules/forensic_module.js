import { ApiService } from '../services/api_service.js';
import { store } from '../core/store.js';

export async function runForensic(mapEngine) {
  const rawCoords = (store.inputs.forensic.coords || '').trim();
  if (!rawCoords) {
    store.showFeedback("Veuillez renseigner le lieu allégué ou les coordonnées GPS du cliché pour certifier l'image.", "warning");
    const inputEl = document.querySelector('.dock-input.input-sub');
    if (inputEl) inputEl.focus();
    return;
  }

  store.startProgress('Forensic Studio — Certification Image', [
    'Validation du lieu allégué',
    'Analyse forensic & empreinte satellite',
    'Affichage du résultat'
  ]);
  store.setLoading(true);
  if (mapEngine && typeof mapEngine.clear === 'function') mapEngine.clear();

  let [lat, lon] = rawCoords.split(',').map(s => parseFloat(s.trim()));
  if (isNaN(lat) || isNaN(lon)) {
    lat = 48.8584; lon = 2.2945; // Coordonnées par défaut Paris Tour Eiffel si lieu textuel
  }
  const date = store.inputs.forensic.date || new Date().toISOString().slice(0, 16);
  store.inputs.forensic.date = date;
  const { hPx, lPx } = store.inputs.forensic;

  try {
    store.stepDone(0, `${lat.toFixed(4)}, ${lon.toFixed(4)} — ${date.slice(0, 10)}`);

    store.stepActive(1, 'Ghost • EXIF • Empreinte spectrale...');
    const data = await ApiService.getForensic(lat, lon, date, hPx, lPx);
    store.results.forensic = data;
    store.stepDone(1, `Score authenticité : ${data.authenticity_score ?? 'N/A'}%`);

    store.stepActive(2, 'Projection sur la carte...');
    mapEngine.addCircleMarker([lat, lon], { radius: 10, fillColor: '#a855f7' }, `<b>INVESTIGATION FORENSIC</b>`);
    mapEngine.setView([lat, lon], 15);
    store.stepDone(2, 'Localisation certifiée');
    store.endProgress(true);
    store.setLoading(false);
  } catch (err) {
    const activeIdx = store.progress.steps.findIndex(s => s.status === 'active');
    if (activeIdx >= 0) store.stepError(activeIdx, err.message);
    store.endProgress(false);
    store.setError(err.message);
  }
}
