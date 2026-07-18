from fastapi import FastAPI
from genesis_core import ResultContract
from .engine import geo_full_report

app = FastAPI(title="Terra Geospatial Platform API", version="1.0.0")

@app.get("/health")
def health():
    return {"status": "ok", "engine": "Terra"}

@app.get("/api/v1/geo-report", response_model=ResultContract)
def report(lat: float, lon: float):
    return geo_full_report(lat, lon)
