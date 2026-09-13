from terra_geospatial_platform import geo_full_report

def test_geo_full_report():
    c = geo_full_report(48.8566, 2.3522, "Zara")
    assert "waypoint" in c.result["engines_used"]
    assert "silkroad" in c.result["engines_used"]
    assert c.confidence > 0.9
