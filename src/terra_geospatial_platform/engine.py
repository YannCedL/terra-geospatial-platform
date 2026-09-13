# Moteur d'agrégation de la plateforme cartographique TERRA
# Fédère les moteurs géospatiaux spécialisés :
# - Waypoint (Cadastre parcellaire IGN)
# - Orbit (Exposition aux risques naturels & Seveso)
# - Arena (Géographie concurrentielle SIRENE)
# - Silkroad (Chaînes d'approvisionnement & Hubs logistiques)
# - Aquila (Surveillance de l'espace aérien ADS-B)
# - Nereid (Suivi maritime mondial AIS)
# - Bedrock (Infrastructures critiques)
# - Odyssey (Implantations mondiales & SIRENE)

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import httpx

from genesis_core import ResultContract, Evidence, EpistemicStatus

logger = logging.getLogger("terra_platform")


async def geo_full_report_async(
    lat: float = 48.8566,
    lon: float = 2.3522,
    company: Optional[str] = None,
    naf: Optional[str] = None
) -> ResultContract:
    """
    Génère un rapport géospatial 360° complet et fédéré en temps réel :
    Cadastre + Risques Géorisques + Concurrence sectorielle + Chaine d'approvisionnement + Vols ADS-B.
    Toutes les requêtes s'exécutent en parallèle avec tolérance aux pannes réseau.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    contract = ResultContract(engine_version="2.0.0", observed_at=now_iso)

    # Import dynamique sécurisé des sous-moteurs TERRA
    async def fetch_waypoint():
        try:
            from waypoint_site_intelligence.cadastre import query_parcel
            return await asyncio.to_thread(query_parcel, lat, lon)
        except Exception as e:
            logger.warning(f"Waypoint error: {e}")
            return None

    async def fetch_orbit():
        try:
            from orbit_geospatial_exposure.risk import calculate_site_risk
            return await asyncio.to_thread(calculate_site_risk, lat, lon)
        except Exception as e:
            logger.warning(f"Orbit error: {e}")
            return None

    async def fetch_arena():
        try:
            from arena_competitive_geography.analyzer import analyze_territory
            return await asyncio.to_thread(analyze_territory, lat, lon, 3.0, naf)
        except Exception as e:
            logger.warning(f"Arena error: {e}")
            return None

    async def fetch_silkroad():
        if not company:
            return None
        try:
            from silkroad_supply_chain.graph import map_supply_chain
            return await asyncio.to_thread(map_supply_chain, company)
        except Exception as e:
            logger.warning(f"Silkroad error: {e}")
            return None

    async def fetch_aquila():
        try:
            from aquila_aviation_intel.tracker import track_flights
            return await asyncio.to_thread(
                track_flights,
                lat_min=lat - 0.75,
                lat_max=lat + 0.75,
                lon_min=lon - 1.0,
                lon_max=lon + 1.0
            )
        except Exception as e:
            logger.warning(f"Aquila error: {e}")
            return None

    async def fetch_bedrock():
        try:
            from bedrock_infrastructure_intel.osm import query_infrastructure
            # Timeout rapide avec fallback gracieux si Overpass saturé
            return await asyncio.wait_for(
                asyncio.to_thread(query_infrastructure, lat, lon, 1000, "all"),
                timeout=4.0
            )
        except Exception as e:
            logger.warning(f"Bedrock timeout/error: {e}")
            return None

    async def fetch_space_weather():
        try:
            from orbit_geospatial_exposure.space_weather import query_space_weather
            return await asyncio.to_thread(query_space_weather)
        except Exception as e:
            logger.warning(f"Space weather error: {e}")
            return None

    # Lancement simultané non-bloquant de tous les moteurs
    results = await asyncio.gather(
        fetch_waypoint(),
        fetch_orbit(),
        fetch_arena(),
        fetch_silkroad(),
        fetch_aquila(),
        fetch_bedrock(),
        fetch_space_weather(),
        return_exceptions=True
    )

    r_waypoint, r_orbit, r_arena, r_silkroad, r_aquila, r_bedrock, r_sw = [
        r if (r is not None and not isinstance(r, Exception)) else None for r in results
    ]


    engines_used = []
    evidences = []

    # 1. Waypoint Cadastre
    cadastre_data = {}
    if r_waypoint:
        cadastre_data = r_waypoint.result.get("parcel", {})
        engines_used.append("waypoint")
        evidences.extend(r_waypoint.evidence)

    # 2. Orbit Exposition Risques
    risk_data = {}
    if r_orbit:
        risk_data = {
            "score": r_orbit.result.get("risk_score"),
            "level": r_orbit.result.get("risk_level"),
            "catnat_count": len(r_orbit.result.get("catnat_events", [])),
            "icpe_count": len(r_orbit.result.get("icpe_installations", [])),
            "seveso": r_orbit.result.get("seveso_present", False)
        }
        engines_used.append("orbit")
        evidences.extend(r_orbit.evidence)

    # 3. Arena Concurrence
    arena_data = {}
    if r_arena:
        arena_data = {
            "competitors_count": len(r_arena.result.get("competitors", [])),
            "nearest_competitor": r_arena.result.get("competitors", [{}])[0] if r_arena.result.get("competitors") else None,
            "density_level": r_arena.result.get("density_level")
        }
        engines_used.append("arena")
        evidences.extend(r_arena.evidence)

    # 4. Silkroad Supply Chain
    supply_chain_data = {}
    if r_silkroad:
        supply_chain_data = {
            "company_name": r_silkroad.result.get("company_name"),
            "sector": r_silkroad.result.get("sector"),
            "suppliers_count": r_silkroad.result.get("total_suppliers", 0),
            "hubs_count": r_silkroad.result.get("total_hubs", 0),
            "bottlenecks": r_silkroad.result.get("bottlenecks_detected", []),
            "resilience_score": r_silkroad.result.get("supply_chain_resilience_score")
        }
        engines_used.append("silkroad")
        evidences.extend(r_silkroad.evidence)

    # 5. Aquila Vols Live
    flights_data = []
    if r_aquila:
        flights_data = r_aquila.result.get("flights", [])
        engines_used.append("aquila")
        evidences.extend(r_aquila.evidence)

    # 6. Bedrock Infrastructures
    infra_data = []
    if r_bedrock:
        infra_data = r_bedrock.result.get("elements", [])
        engines_used.append("bedrock")
        evidences.extend(r_bedrock.evidence)

    # 7. NOAA Space Weather
    sw_data = {}
    if r_sw:
        sw_data = {
            "kp_index": r_sw.result.get("kp_index"),
            "storm_level": r_sw.result.get("storm_level"),
            "gnss_impact": r_sw.result.get("gnss_impact_status")
        }
        engines_used.append("noaa_space_weather")
        evidences.extend(r_sw.evidence)


    contract.result = {
        "center": [lat, lon],
        "company": company or "N/A",
        "cadastre_parcel": cadastre_data,
        "risk_exposure": risk_data,
        "competitive_geography": arena_data,
        "supply_chain": supply_chain_data,
        "live_flights": flights_data,
        "infrastructures": infra_data,
        "space_weather": sw_data,
        "engines_used": engines_used,
        "status": "rapport_geospatial_360_complet"
    }


    for ev in evidences:
        contract.add_evidence(ev)

    contract.add_evidence(Evidence(
        subject=f"{lat},{lon}",
        predicate="fusion_geospatiale_terra_360",
        value=f"Rapport géospatial 360 fédéré ({len(engines_used)} moteurs opérationnels : {', '.join(engines_used)})",
        source="terra_geospatial_platform_engine",
        observed_at=now_iso,
        confidence=0.95,
        status=EpistemicStatus.FACT
    ))

    return contract


def geo_full_report(lat: float = 48.8566, lon: float = 2.3522, company: Optional[str] = None) -> ResultContract:
    """Wrapper synchrone pour compatibilité et tests existants."""
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

    if loop.is_running():
        # Déjà dans une boucle événementielle
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = executor.submit(asyncio.run, geo_full_report_async(lat, lon, company))
            return future.result()
    else:
        return loop.run_until_complete(geo_full_report_async(lat, lon, company))
