# test du rapport cartographique 360 de la plateforme Terra
from terra_geospatial_platform.engine import geo_full_report

def test_rapport_geospatial_360():
    contract = geo_full_report(48.8566, 2.3522, "Zara")
    assert contract is not None
    assert contract.result["cadastre_parcel"].get("parcel_id") is not None
    assert contract.result["supply_chain"].get("company_name") is not None
    assert len(contract.result["engines_used"]) >= 3
    assert len(contract.evidence) >= 3


import asyncio

def test_modules_site_audit_et_forensic():
    from terra_geospatial_platform.modules import run_tactical_site_audit_async, run_forensic_studio_async

    # Test Tactical Site Audit (Waypoint + Bedrock + Orbit + Delta)
    c_audit = asyncio.run(run_tactical_site_audit_async(48.8566, 2.3522))
    assert c_audit is not None
    assert c_audit.result["module"] == "tactical_site_audit"
    assert "cadastre" in c_audit.result
    assert "vital_networks" in c_audit.result
    assert "environmental_exposure" in c_audit.result
    assert c_audit.result["asset_compliance_score"] > 0

    # Test Forensic Studio (Northstar + Delta + Waypoint)
    c_forensic = asyncio.run(run_forensic_studio_async(
        lat=48.8584,
        lon=2.2945,
        date_capture="2023-07-14T12:00:00",
        object_height_px=180.0,
        shadow_length_px=104.0
    ))
    assert c_forensic is not None
    assert c_forensic.result["module"] == "forensic_studio"
    assert "solar_forensics" in c_forensic.result
    assert "cadastral_ground_truth" in c_forensic.result
    assert "certificate_of_sincerity" in c_forensic.result
