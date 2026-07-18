# test du rapport cartographique 360 de la plateforme Terra
from terra_geospatial_platform.engine import geo_full_report

def test_rapport_geospatial_360():
    contract = geo_full_report(48.8566, 2.3522)
    assert contract is not None
    assert len(contract.result["infrastructures"]) >= 1
    assert contract.result["cadastre_parcel"]["parcel_id"] is not None
    assert len(contract.evidence) >= 3
