import os
import time
import asyncio
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, Query, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from dotenv import load_dotenv

# Chargement immédiat des variables d'environnement (.env racine)
load_dotenv()

# Initialisation proactive du flux mondial AISStream si la clé est fournie
try:
    from nereid_maritime_intel.tracker import start_aisstream
    _ais_key = os.getenv("AISSTREAM_API_KEY", "").strip()
    if _ais_key:
        start_aisstream(_ais_key)
except Exception:
    pass

from genesis_core import ResultContract
from .engine import geo_full_report_async, geo_full_report

app = FastAPI(
    title="TERRA Geospatial Platform API",
    description="Plateforme Cartographique & Geospatiale 360 fedérant tous les microservices GEOINT",
    version="2.1.0"
)

BASE_DIR = os.path.dirname(__file__)
STATIC_DIR = os.path.join(BASE_DIR, "static")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")

# Fallback si exécuté depuis la racine du dépôt git
if not os.path.exists(TEMPLATES_DIR):
    alt_templates = os.path.join(os.getcwd(), "src", "terra_geospatial_platform", "templates")
    if os.path.exists(alt_templates):
        TEMPLATES_DIR = alt_templates

if not os.path.exists(STATIC_DIR):
    alt_static = os.path.join(os.getcwd(), "src", "terra_geospatial_platform", "static")
    if os.path.exists(alt_static):
        STATIC_DIR = alt_static

if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

templates = Jinja2Templates(directory=TEMPLATES_DIR)


@app.api_route("/", methods=["GET", "HEAD"], response_class=HTMLResponse)
def index(request: Request):
    """Sert la console tactique de commandement geospatiale TERRA."""
    template_file = os.path.join(TEMPLATES_DIR, "index.html")
    if os.path.exists(template_file):
        return templates.TemplateResponse(request=request, name="index.html")
    return HTMLResponse("<h1>TERRA Platform API - Interface non trouvee</h1>", status_code=404)

@app.on_event("startup")
def on_startup():
    """Initialise de façon déterministe le flux mondial AISStream à l'allumage du serveur."""
    try:
        from nereid_maritime_intel.tracker import start_aisstream
        ais_key = os.getenv("AISSTREAM_API_KEY", "").strip()
        if ais_key:
            start_aisstream(ais_key)
    except Exception as e:
        print(f"[AISSTREAM ERROR ON STARTUP] {e}")

@app.get("/health")
def health():
    return {
        "status": "ok",
        "platform": "TERRA",
        "version": "2.1.0",
        "integrated_engines": [
            "waypoint", "orbit", "odyssey", "arena", "delta", "silkroad", "aquila", "nereid", "bedrock", "northstar", "war_room"
        ]
    }

@app.get("/api/v1/maritime/sources")
def get_maritime_sources():
    from nereid_maritime_intel.tracker import get_sources_status
    return get_sources_status()

@app.get("/api/v1/report", response_model=ResultContract)
async def get_report(
    lat: float = Query(48.8566, description="Latitude du point d interet"),
    lon: float = Query(2.3522, description="Longitude du point d interet"),
    company: Optional[str] = Query(None, description="Entreprise cible"),
    naf: Optional[str] = Query(None, description="Filtre sectoriel NAF")
):
    """Genere le rapport de renseignement geospatiale 360 federe en temps reel."""
    return await geo_full_report_async(lat, lon, company, naf)

@app.get("/api/v1/search_company")
def search_company(q: str = Query(..., description="Nom d entreprise ou SIREN")):
    """Point d acces federe pour identifier les sites et la supply chain de l entreprise cible."""
    from odyssey_corporate_world_map.mapper import map_corporate_sites
    from silkroad_supply_chain.graph import map_supply_chain
    sites_contract = map_corporate_sites(q)
    supply_contract = map_supply_chain(q)
    sites = sites_contract.result.get("sites", [])
    hq = next((s for s in sites if s.get("is_headquarters")), (sites[0] if sites else {}))
    return {
        "company": q,
        "sites": sites,
        "headquarter": hq,
        "supply_chain": supply_contract.result
    }

# ==============================================================================
# ENDPOINTS DES MODULES METIERS JTBD
# ==============================================================================
@app.get("/api/v1/modules/site-audit", response_model=ResultContract)
async def api_site_audit(
    lat: float = Query(48.8566, description="Latitude de l actif"),
    lon: float = Query(2.3522, description="Longitude de l actif"),
    date_start: str = Query("2021-01-15", description="Date snapshot T1"),
    date_end: str = Query("2024-01-15", description="Date snapshot T2")
):
    from .modules import run_tactical_site_audit_async
    return await run_tactical_site_audit_async(lat, lon, date_start, date_end)

@app.get("/api/v1/modules/competitive-arena", response_model=ResultContract)
async def api_competitive_arena(
    company: str = Query(..., description="Entreprise cible"),
    lat: float = Query(48.8566, description="Latitude du point d analyse"),
    lon: float = Query(2.3522, description="Longitude du point d analyse"),
    radius_km: float = Query(5.0, description="Rayon en km"),
    naf: Optional[str] = Query(None, description="Code sectoriel NAF")
):
    from .modules import run_competitive_arena_async
    return await run_competitive_arena_async(company, lat, lon, radius_km, naf)

@app.get("/api/v1/modules/supply-flow-tracker", response_model=ResultContract)
async def api_supply_flow(
    company: str = Query(..., description="Entreprise cible"),
    lat: float = Query(49.49, description="Latitude du terminal maritime"),
    lon: float = Query(0.10, description="Longitude du terminal"),
    radius_nm: int = Query(50, description="Rayon maritime en milles nautiques")
):
    from .modules import run_supply_flow_tracker_async
    return await run_supply_flow_tracker_async(company, lat, lon, radius_nm)

@app.get("/api/v1/modules/executive-mobility", response_model=ResultContract)
async def api_executive_mobility(
    company_a: str = Query(..., description="Entreprise A"),
    company_b: Optional[str] = Query(None, description="Entreprise B"),
    lat: float = Query(48.7262, description="Latitude de surveillance"),
    lon: float = Query(2.3652, description="Longitude de surveillance")
):
    from .modules import run_executive_mobility_async
    return await run_executive_mobility_async(company_a, company_b, lat, lon)

@app.get("/api/v1/modules/forensic-studio", response_model=ResultContract)
async def api_forensic_studio(
    lat: float = Query(48.8584, description="Latitude presumee"),
    lon: float = Query(2.2945, description="Longitude presumee"),
    date_capture: Optional[str] = Query("2023-07-14T12:00:00", description="Date et heure de capture"),
    object_height_px: Optional[float] = Query(None, description="Hauteur de l objet"),
    shadow_length_px: Optional[float] = Query(None, description="Longueur de l ombre"),
    shadow_azimuth_deg: Optional[float] = Query(None, description="Azimut de l ombre")
):
    from .modules import run_forensic_studio_async
    return await run_forensic_studio_async(
        lat=lat, lon=lon,
        date_capture=date_capture,
        object_height_px=object_height_px,
        shadow_length_px=shadow_length_px,
        shadow_azimuth_deg=shadow_azimuth_deg
    )

# ==============================================================================
# WAR ROOM : SURVEILLANCE GLOBALE & FLUX VIDEO OSINT
# ==============================================================================
@app.get("/api/v1/war-room/surveillance")
async def get_war_room_surveillance(
    lat: float = Query(48.8566, description="Centre de balayage"),
    lon: float = Query(2.3522, description="Centre de balayage"),
    radius_km: float = Query(1500.0, description="Rayon mondial d ecoute")
):
    now_iso = datetime.now(timezone.utc).isoformat()

    # 1. Avions (Aquila / OpenSky - Couverture Mondiale)
    async def fetch_flights():
        try:
            from aquila_aviation_intel.tracker import track_flights
            return await asyncio.to_thread(
                track_flights,
                lat_min=-85.0,
                lat_max=85.0,
                lon_min=-180.0,
                lon_max=180.0,
                limit=350
            )
        except Exception:
            return None

    # 2. Navires (Nereid / AISStream Mondial + Digitraffic - Couverture Globale)
    async def fetch_vessels():
        try:
            from nereid_maritime_intel.tracker import track_vessels
            # Rayon étendu à la terre entière (25 000 NM) pour englober tous les navires mondiaux
            return await asyncio.to_thread(track_vessels, lat, lon, 25000)
        except Exception:
            return None

    # 3. Seismes (USGS Live)
    async def fetch_seismic():
        try:
            from orbit_geospatial_exposure.seismic import query_seismic_activity
            return await asyncio.to_thread(query_seismic_activity, lat, lon, radius_km)
        except Exception:
            return None

    # 4. Foyers thermiques (NASA VIIRS)
    async def fetch_thermal():
        try:
            from orbit_geospatial_exposure.thermal import query_thermal_anomalies
            return await asyncio.to_thread(query_thermal_anomalies, lat, lon, 500)
        except Exception:
            return None

    r_fl, r_vs, r_seis, r_th = await asyncio.gather(
        fetch_flights(), fetch_vessels(), fetch_seismic(), fetch_thermal(),
        return_exceptions=True
    )

    flights = r_fl.result.get("flights", []) if (r_fl and not isinstance(r_fl, Exception)) else []
    vessels = r_vs.result.get("vessels", []) if (r_vs and not isinstance(r_vs, Exception)) else []
    seismic_events = r_seis.result.get("events", []) if (r_seis and not isinstance(r_seis, Exception)) else []
    thermal_anomalies = r_th.result.get("anomalies", []) if (r_th and not isinstance(r_th, Exception)) else []

        # 5. Flux Cameras / Webcams OSINT Stratégiques Mondiales réelles et vérifiées (Chokepoints, Ports, Détroits mondiaux)
    strategic_cameras = [
        {
            "id": "cam_le_havre",
            "title": "Port du Havre — Entrée du Port & Baie de Seine",
            "category": "Port Maritime Manche",
            "lat": 49.4898,
            "lon": 0.0971,
            "stream_type": "iframe",
            "video_url": "https://www.skaping.com/le-havre/port-de-plaisance",
            "thumbnail": "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=600&auto=format&fit=crop",
            "status": "EN DIRECT HD",
            "description": "Surveillance optique en direct des approches maritimes de la Manche et de la rade du Havre."
        },
        {
            "id": "cam_marseille_sky",
            "title": "Marseille — Rade & Approches Méditerranée",
            "category": "Port Maritime Méditerranée",
            "lat": 43.3000,
            "lon": 5.3670,
            "stream_type": "iframe",
            "video_url": "https://www.skaping.com/marseille/sky-center",
            "thumbnail": "https://images.unsplash.com/photo-1589556264800-08ae9e129a8c?w=600&auto=format&fit=crop",
            "status": "EN DIRECT HD",
            "description": "Vue panoramique 360° du Vieux-Port, des bassins de la Joliette et du trafic maritime méditerranéen."
        },
        {
            "id": "cam_bremerhaven",
            "title": "Port de Bremerhaven — Terminal Porte-Conteneurs Mer du Nord",
            "category": "Hub Logistique Mer du Nord",
            "lat": 53.5420,
            "lon": 8.5700,
            "stream_type": "iframe",
            "video_url": "https://bremerhaven.panomax.com",
            "thumbnail": "https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?w=600&auto=format&fit=crop",
            "status": "EN DIRECT HD",
            "description": "Surveillance haute définition du principal terminal transatlantique et logistique de Mer du Nord."
        },
        {
            "id": "cam_hamburg",
            "title": "Port de Hambourg — Estuaire de l'Elbe & Chantiers Navals",
            "category": "Grand Port Fluvio-Maritime",
            "lat": 53.5450,
            "lon": 9.9660,
            "stream_type": "iframe",
            "video_url": "https://hamburg.panomax.com",
            "thumbnail": "https://images.unsplash.com/photo-1471623432079-b009d30b6729?w=600&auto=format&fit=crop",
            "status": "EN DIRECT HD",
            "description": "Surveillance optique continue du trafic des super porte-conteneurs et pétroliers de l'Elbe."
        },
        {
            "id": "cam_panama",
            "title": "Canal de Panama — Écluses de Miraflores (Sas Pacifique-Atlantique)",
            "category": "Chokepoint Mondial Interocéanique",
            "lat": 8.9972,
            "lon": -79.5932,
            "stream_type": "iframe",
            "video_url": "https://multimedia.panama-canal.com",
            "thumbnail": "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600&auto=format&fit=crop",
            "status": "EN DIRECT HD",
            "description": "Surveillance du transit interocéanique stratégique mondial entre l'océan Pacifique et l'Atlantique."
        },
        {
            "id": "cam_new_york",
            "title": "Port de New York & New Jersey — Baie de Manhattan & Statue",
            "category": "Hub Maritime Mondial Amérique du Nord",
            "lat": 40.6892,
            "lon": -74.0445,
            "stream_type": "iframe",
            "video_url": "https://www.earthcam.com",
            "thumbnail": "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=600&auto=format&fit=crop",
            "status": "EN DIRECT HD",
            "description": "Observation des corridors maritimes de l'Hudson River, du détroit de Verrazzano et des porte-conteneurs."
        },
        {
            "id": "cam_miami",
            "title": "PortMiami — Goulet Logistique & Terminal Croisières / Fret Caraïbes",
            "category": "Hub Maritime Caraïbes / Amériques",
            "lat": 25.7781,
            "lon": -80.1793,
            "stream_type": "iframe",
            "video_url": "https://portmiamiwebcam.com",
            "thumbnail": "https://images.unsplash.com/photo-1533105079780-92b9be482077?w=600&auto=format&fit=crop",
            "status": "EN DIRECT HD",
            "description": "Point névralgique du fret maritime transatlantique et des routes maritimes d'Amérique centrale."
        },
        {
            "id": "cam_tokyo",
            "title": "Baie de Tokyo (Japon) — Chenal Maritime & Rainbow Bridge",
            "category": "Hub Maritime Asie-Pacifique",
            "lat": 35.6366,
            "lon": 139.7631,
            "stream_type": "iframe",
            "video_url": "https://worldcam.eu",
            "thumbnail": "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=600&auto=format&fit=crop",
            "status": "EN DIRECT HD",
            "description": "Surveillance continue du plus grand bassin industriel et portuaire de l'Asie de l'Est."
        }
    ]

    return {
        "status": "war_room_surveillance_active",
        "timestamp": now_iso,
        "metrics": {
            "total_aircraft": len(flights),
            "total_vessels": len(vessels),
            "total_seismic_events": len(seismic_events),
            "total_thermal_anomalies": len(thermal_anomalies),
            "total_cameras": len(strategic_cameras)
        },
        "flights": flights,
        "vessels": vessels,
        "seismic_events": seismic_events,
        "thermal_anomalies": thermal_anomalies,
        "cameras": strategic_cameras
    }


@app.websocket("/ws/surveillance")
async def websocket_surveillance(websocket: WebSocket):
    """
    Flux WebSocket bidirectionnel temps réel pour les navires et les aéronefs.
    Diffuse en push continu les mises à jour des vecteurs mondiaux captés en mémoire.
    """
    await websocket.accept()
    seen_vessel_timestamps: Dict[str, int] = {}
    seen_flight_callsigns: Dict[str, float] = {}

    try:
        # 1. Envoi initial de l'état complet
        from nereid_maritime_intel.tracker import track_vessels
        from aquila_aviation_intel.tracker import track_flights

        init_vessels_contract = await asyncio.to_thread(track_vessels, 48.8566, 2.3522, 25000)
        init_flights_contract = await asyncio.to_thread(
            track_flights,
            lat_min=-85.0, lat_max=85.0, lon_min=-180.0, lon_max=180.0, limit=350
        )

        init_vessels = init_vessels_contract.result.get("vessels", []) if init_vessels_contract else []
        init_flights = init_flights_contract.result.get("flights", []) if init_flights_contract else []

        # 1. Envoi initial partitionné en lots sécurisés (évite la limite de payload 1009)
        await websocket.send_json({
            "type": "SNAPSHOT_START",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "metrics": {
                "total_vessels": len(init_vessels),
                "total_aircraft": len(init_flights)
            }
        })

        # Envoi des avions
        if init_flights:
            await websocket.send_json({
                "type": "SNAPSHOT_FLIGHTS",
                "flights": init_flights
            })

        # Envoi des navires par lots de 250 navires
        chunk_size = 250
        for i in range(0, len(init_vessels), chunk_size):
            chunk = init_vessels[i:i + chunk_size]
            await websocket.send_json({
                "type": "SNAPSHOT_VESSELS_CHUNK",
                "vessels": chunk
            })
            await asyncio.sleep(0.05)

        for v in init_vessels:
            k = str(v.get("mmsi") or v.get("name"))
            seen_vessel_timestamps[k] = v.get("timestamp") or 0

        last_flight_fetch = time.time()

        # 2. Boucle de streaming en direct (Push toutes les 7.0 secondes pour fluidité maximale)
        while True:
            await asyncio.sleep(7.0)
            now_sec = time.time()

            # Lecture directe du cache mémoire maritime sans latence réseau (0 quota externe)
            try:
                from nereid_maritime_intel.tracker import _AISSTREAM_VESSELS
                live_ais_dict = dict(_AISSTREAM_VESSELS)
            except Exception:
                live_ais_dict = {}

            fresh_vessels = []
            for mmsi, v in live_ais_dict.items():
                ts = v.get("timestamp", 0)
                if ts > seen_vessel_timestamps.get(mmsi, 0):
                    seen_vessel_timestamps[mmsi] = ts
                    fresh_vessels.append(v)
                    if len(fresh_vessels) >= 150:
                        break

            # Rafraîchissement périodique des avions (toutes les 25 secondes)
            updated_flights = []
            if now_sec - last_flight_fetch >= 25.0:
                last_flight_fetch = now_sec
                try:
                    new_fl_contract = await asyncio.to_thread(
                        track_flights,
                        lat_min=-85.0, lat_max=85.0, lon_min=-180.0, lon_max=180.0, limit=200
                    )
                    if new_fl_contract and new_fl_contract.result:
                        updated_flights = new_fl_contract.result.get("flights", [])
                except Exception:
                    pass

            # Si de nouvelles données sont arrivées, on les pousse au client
            if fresh_vessels or updated_flights:
                await websocket.send_json({
                    "type": "DELTA_UPDATE",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "total_live_vessels": len(live_ais_dict),
                    "vessels": fresh_vessels,
                    "flights": updated_flights
                })

    except WebSocketDisconnect:
        pass
    except Exception as e:
        try:
            await websocket.close()
        except Exception:
            pass

