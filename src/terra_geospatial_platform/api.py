import os
from fastapi import FastAPI, Query
from fastapi.responses import HTMLResponse
from genesis_core import ResultContract
from .engine import geo_full_report

app = FastAPI(
    title="TERRA Geospatial Platform API",
    description="Plateforme Cartographique & Géospatiale 360°",
    version="1.0.0"
)

TEMPLATE_PATH = os.path.join(os.path.dirname(__file__), "templates", "index.html")

@app.get("/", response_class=HTMLResponse)
def index():
    # sert la page d'accueil de la plateforme géospatiale
    if os.path.exists(TEMPLATE_PATH):
        with open(TEMPLATE_PATH, "r", encoding="utf-8") as f:
            return f.read()
    return "<h1>TERRA Platform API - Interface non trouvee</h1>"

@app.get("/health")
def health():
    return {"status": "ok", "platform": "TERRA", "version": "1.0.0"}

@app.get("/api/v1/report", response_model=ResultContract)
def get_report(lat: float = Query(48.8566), lon: float = Query(2.3522)):
    return geo_full_report(lat, lon)
