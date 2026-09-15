// ==========================================================================
// TERRA API SERVICE — CLIENT RÉSEAU UNIFIÉ (ZERO FAKE DATA)
// Appelle directement les microservices réels fédérés
// ==========================================================================
export class ApiService {
  static async searchCompany(company) {
    const resp = await fetch(`/api/v1/search_company?q=${encodeURIComponent(company)}`);
    if (!resp.ok) throw new Error(`Erreur recherche entreprise (${resp.status})`);
    return await resp.json();
  }

  static async getFullReport(lat, lon, company) {
    const resp = await fetch(`/api/v1/report?lat=${lat}&lon=${lon}&company=${encodeURIComponent(company)}`);
    if (!resp.ok) throw new Error(`Erreur rapport nexus (${resp.status})`);
    const data = await resp.json();
    return data.result;
  }

  static async getSiteAudit(lat, lon, dateStart, dateEnd) {
    const resp = await fetch(`/api/v1/modules/site-audit?lat=${lat}&lon=${lon}&date_start=${encodeURIComponent(dateStart)}&date_end=${encodeURIComponent(dateEnd)}`);
    if (!resp.ok) throw new Error(`Erreur audit foncier (${resp.status})`);
    const data = await resp.json();
    return data.result;
  }

  static async getCompetitiveArena(company, lat, lon, radiusKm) {
    const resp = await fetch(`/api/v1/modules/competitive-arena?company=${encodeURIComponent(company)}&lat=${lat}&lon=${lon}&radius_km=${radiusKm}`);
    if (!resp.ok) throw new Error(`Erreur arène concurrentielle (${resp.status})`);
    const data = await resp.json();
    return data.result;
  }

  static async getSupplyFlow(company, lat, lon) {
    const resp = await fetch(`/api/v1/modules/supply-flow-tracker?company=${encodeURIComponent(company)}&lat=${lat}&lon=${lon}`);
    if (!resp.ok) throw new Error(`Erreur supply flow (${resp.status})`);
    const data = await resp.json();
    return data.result;
  }

  static async getExecutiveMobility(companyA, companyB, lat, lon) {
    const resp = await fetch(`/api/v1/modules/executive-mobility?company_a=${encodeURIComponent(companyA)}&company_b=${encodeURIComponent(companyB)}&lat=${lat}&lon=${lon}`);
    if (!resp.ok) throw new Error(`Erreur mobilité exécutive (${resp.status})`);
    const data = await resp.json();
    return data.result;
  }

  static async getForensic(lat, lon, dateCapture, hPx, lPx) {
    const resp = await fetch(`/api/v1/modules/forensic-studio?lat=${lat}&lon=${lon}&date_capture=${encodeURIComponent(dateCapture)}&object_height_px=${hPx}&shadow_length_px=${lPx}`);
    if (!resp.ok) throw new Error(`Erreur analyse forensic (${resp.status})`);
    const data = await resp.json();
    return data.result;
  }

  static async getSigintGlobal(lat, lon) {
    const [rSdr, rSw, rSeismic, rThermal, rJam] = await Promise.all([
      fetch(`http://localhost:8006/api/v1/sdr?lat=${lat}&lon=${lon}&max_results=5`).then(r => r.json()).catch(() => null),
      fetch(`http://localhost:8002/api/v1/space-weather`).then(r => r.json()).catch(() => null),
      fetch(`http://localhost:8002/api/v1/seismic?lat=${lat}&lon=${lon}&radius_km=500`).then(r => r.json()).catch(() => null),
      fetch(`http://localhost:8004/api/v1/thermal?lat=${lat}&lon=${lon}&radius_km=100`).then(r => r.json()).catch(() => null),
      fetch(`http://localhost:8003/api/v1/gnss-jamming?lat=${lat}&lon=${lon}&radius_nm=250`).then(r => r.json()).catch(() => null)
    ]);

    return {
      sdr: rSdr?.result || {},
      sw: rSw?.result || {},
      seismic: rSeismic?.result || {},
      thermal: rThermal?.result || {},
      jam: rJam?.result || {}
    };
  }

  static async getWarRoomSurveillance(lat = 48.8566, lon = 2.3522) {
    const resp = await fetch(`/api/v1/war-room/surveillance?lat=${lat}&lon=${lon}`);
    if (!resp.ok) throw new Error(`Erreur surveillance War Room (${resp.status})`);
    return await resp.json();
  }
}
