import { ApiService } from '../services/api_service.js';
import { store } from '../core/store.js';

export async function runSigint(mapEngine) {
  const rawCoords = (store.inputs.sigint.coords || '').trim();
  if (!rawCoords) {
    store.showFeedback("Veuillez renseigner un point GPS pour lancer l'interception et le balayage SIGINT.", "warning");
    const inputEl = document.querySelector('.dock-input.input-main');
    if (inputEl) inputEl.focus();
    return;
  }

  let [lat, lon] = rawCoords.split(',').map(s => parseFloat(s.trim()));
  if (isNaN(lat) || isNaN(lon)) {
    store.setError("Coordonnées GPS invalides. Format : latitude, longitude (ex: 48.8566, 2.3522)");
    return;
  }

  store.startProgress(`SIGINT — ${lat.toFixed(4)}, ${lon.toFixed(4)}`, [
    'Validation point d\'interception',
    'Balayage SDR & capteurs RF',
    'Météo spatiale & ionosphère',
    'Projection cartographique'
  ]);
  store.setLoading(true);
  if (mapEngine && typeof mapEngine.clear === 'function') mapEngine.clear();

  try {
    store.stepDone(0, `Point SIGINT : ${lat.toFixed(4)}, ${lon.toFixed(4)}`);

    store.stepActive(1, 'Interrogation stations SDR proches...');
    store.stepActive(2, 'Météo spatiale NOAA / espace...');

    const data = await ApiService.getSigintGlobal(lat, lon);
    store.results.sigint = data;

    const sdrCount = (data.sdr?.receivers || []).length;
    store.stepDone(1, `${sdrCount} station${sdrCount > 1 ? 's' : ''} SDR détectée${sdrCount > 1 ? 's' : ''}`);
    store.stepDone(2, data.space_weather ? 'Données ionosphériques reçues' : 'Données indisponibles');

    store.stepActive(3, 'Tracé des capteurs RF sur la carte...');
    const targetPopup = `
      <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.8rem;">
        <b style="color: #06b6d4;">🎯 POINT D'INTERCEPTION SIGINT</b><br>
        Lat: ${lat.toFixed(4)}, Lon: ${lon.toFixed(4)}
      </div>
    `;
    mapEngine.addIconMarker([lat, lon], `<div class="tactical-marker-pin pin-target" title="SIGINT Target">🎯</div>`, 'marker-target-wrapper', [32, 32], targetPopup);

    (data.sdr?.receivers || []).forEach(sdr => {
      const sLat = sdr.lat ?? sdr.latitude;
      const sLon = sdr.lon ?? sdr.longitude;
      if (sLat && sLon) {
        const popupHtml = `
          <div style="font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.8rem;">
            <b style="color: #3b82f6;">📻 CAPTEUR SDR / INTERCEPTION</b><br>
            <b>Station:</b> ${sdr.name || 'Station SDR'}<br>
            <b>Distance:</b> ${sdr.distance_km || 0} km<br>
            <b>Spectre:</b> ${sdr.coverage || 'HF / VHF / UHF'}
          </div>
        `;
        mapEngine.addIconMarker([sLat, sLon], `<div class="tactical-marker-pin pin-camera" title="${sdr.name}">📻</div>`, 'marker-sdr-wrapper', [30, 30], popupHtml);
      }
    });

    mapEngine.setView([lat, lon], 6);
    store.stepDone(3, 'Arsenal SIGINT déployé');
    store.endProgress(true);
    store.setLoading(false);
  } catch (err) {
    const activeIdx = store.progress.steps.findIndex(s => s.status === 'active');
    if (activeIdx >= 0) store.stepError(activeIdx, err.message);
    store.endProgress(false);
    store.setError(err.message);
  }
}
