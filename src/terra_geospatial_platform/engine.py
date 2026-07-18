# moteur d'agregation de la plateforme cartographique TERRA combinant les moteurs geospatiaux

from datetime import datetime, timezone
from genesis_core import ResultContract, Evidence, EpistemicStatus
from bedrock_infrastructure_intel.osm import query_infrastructure
from waypoint_site_intelligence.cadastre import query_parcel
from aquila_aviation_intel.tracker import track_flights

def geo_full_report(lat: float = 48.8566, lon: float = 2.3522) -> ResultContract:
    # genere un rapport géospatial 360 (infrastructures + cadastre + vols live) autour d'un point
    now_iso = datetime.now(timezone.utc).isoformat()
    contract = ResultContract(engine_version="1.0.0", observed_at=now_iso)
    
    # 1. Infrastructures via Bedrock
    infra_res = query_infrastructure(lat, lon, radius_m=2000)
    
    # 2. Parcelle Cadastrale via Waypoint
    parcel_res = query_parcel(lat, lon)
    
    # 3. Vols ADS-B Live via Aquila
    aquila_res = track_flights(lat_min=lat-1.5, lat_max=lat+1.5, lon_min=lon-2.0, lon_max=lon+2.0)
    
    contract.result = {
        "center": [lat, lon],
        "infrastructures": infra_res.result.get("elements", []),
        "cadastre_parcel": parcel_res.result.get("parcel", {}),
        "live_flights": aquila_res.result.get("flights", []),
        "engines_used": ["bedrock", "waypoint", "aquila"],
        "status": "rapport_geospatial_360_complet"
    }
    
    for ev in infra_res.evidence + parcel_res.evidence + aquila_res.evidence:
        contract.add_evidence(ev)
        
    return contract
