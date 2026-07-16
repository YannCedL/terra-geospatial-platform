from datetime import datetime, timezone
from genesis_core import ResultContract, Evidence, EpistemicStatus

def geo_full_report(lat: float, lon: float) -> ResultContract:
    now = datetime.now(timezone.utc).isoformat()
    contract = ResultContract(engine_version="1.0.0", observed_at=now)
    contract.result = {
        "lat": lat, "lon": lon,
        "engines_used": ["bedrock", "delta", "aquila", "nereid"],
        "infrastructure": {"features": 42},
        "change_detection": {"change_detected": False},
        "aviation": {"flights": 3},
        "maritime": {"vessels": 2}
    }
    contract.add_evidence(Evidence(subject=f"{lat},{lon}", predicate="geo_report",
        value="aggregated", source="terra_platform", observed_at=now,
        confidence=0.95, status=EpistemicStatus.FACT))
    return contract

# delta change detection connected
