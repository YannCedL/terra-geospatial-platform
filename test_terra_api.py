#!/usr/bin/env python3
"""
TERRA API Tactical Suite - Testeur Automatique avec Barres de Progression TQDM
Récupère et inspecte les données JSON RÉELLES retournées par chaque module de l'écosystème TERRA.
Sauvegarde tous les JSON bruts dans un dossier dédié pour chaque entreprise auditée.
"""

import os
import sys
import json
import time
import argparse
from datetime import datetime
from typing import Any, Dict, Optional
import httpx
from tqdm import tqdm


def print_banner(company: str, base_url: str):
    print("=" * 76)
    print(" 🛰️   TERRA PLATFORM - BANC D'ESSAI DES API & AUDIT GEOINT 360°")
    print(f" 🎯  Entreprise Cible : {company}")
    print(f" 🌐  Serveur Cible    : {base_url}")
    print("=" * 76)
    print()


def save_json(folder: str, filename: str, data: Any):
    """Sauvegarde le payload JSON brut avec indentation pour inspection."""
    os.makedirs(folder, exist_ok=True)
    filepath = os.path.join(folder, filename)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return filepath


def format_preview(title: str, obj: Any, max_lines: int = 15):
    """Génère un aperçu visuel élégant du JSON dans la console."""
    if isinstance(obj, (dict, list)):
        raw_text = json.dumps(obj, ensure_ascii=False, indent=2)
    else:
        raw_text = str(obj)
    
    lines = raw_text.splitlines()
    if len(lines) > max_lines:
        preview = "\n".join(lines[:max_lines]) + f"\n      ... (+ {len(lines) - max_lines} lignes supplémentaires)"
    else:
        preview = "\n".join(lines)
    return preview


def test_endpoint(
    client: httpx.Client,
    method: str,
    path: str,
    name: str,
    params: Optional[Dict[str, Any]] = None,
    timeout: float = 35.0
) -> Dict[str, Any]:
    start = time.perf_counter()
    try:
        if method.upper() == "GET":
            response = client.get(path, params=params, timeout=timeout)
        else:
            response = client.post(path, json=params, timeout=timeout)
        
        elapsed = (time.perf_counter() - start) * 1000.0
        is_json = response.headers.get("content-type", "").startswith("application/json")
        data = response.json() if is_json else response.text
        return {
            "name": name,
            "status_code": response.status_code,
            "elapsed_ms": elapsed,
            "data": data,
            "error": None
        }
    except Exception as e:
        elapsed = (time.perf_counter() - start) * 1000.0
        return {
            "name": name,
            "status_code": 0,
            "elapsed_ms": elapsed,
            "data": None,
            "error": str(e)
        }


def run_benchmark(company: str, base_url: str, timeout: float, show_full_json: bool = False):
    print_banner(company, base_url)

    # Dossier d'export dédié à cette analyse
    clean_name = "".join(c if c.isalnum() else "_" for c in company.lower())
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = os.path.join(os.getcwd(), "benchmark_results", f"{clean_name}_{timestamp}")

    # Définition des modules et requêtes
    steps = [
        ("01_health", "Vérification Santé Plateforme", "/health", "GET", None),
        ("02_search_company", "Recherche Entreprise & Sites (SIRENE)", "/api/v1/search_company", "GET", {"q": company}),
        ("03_report_360", "Rapport GEOINT 360° Complet", "/api/v1/report", "GET", {"company": company, "lat": 48.8566, "lon": 2.3522}),
        ("04_competitive_arena", "Arène Concurrentielle (Arena)", "/api/v1/modules/competitive-arena", "GET", {"company": company, "lat": 48.8566, "lon": 2.3522, "radius_km": 10.0}),
        ("05_supply_flow", "Flux Logistiques & Maritimes (Supply)", "/api/v1/modules/supply-flow-tracker", "GET", {"company": company, "lat": 49.49, "lon": 0.10, "radius_nm": 50}),
        ("06_executive_mobility", "Mobilité Aérienne & Vols Jets (Mobility)", "/api/v1/modules/executive-mobility", "GET", {"company_a": company, "lat": 48.7262, "lon": 2.3652}),
        ("07_site_audit", "Audit Foncier d'Actif (Site Audit)", "/api/v1/modules/site-audit", "GET", {"lat": 48.8566, "lon": 2.3522, "date_start": "2021-01-01", "date_end": "2024-01-01"}),
        ("08_war_room", "Surveillance Globale War Room", "/api/v1/war-room/surveillance", "GET", {"lat": 48.8566, "lon": 2.3522, "radius_km": 500.0})
    ]

    results = []
    consolidated = {}
    lat_target = 48.8566
    lon_target = 2.3522

    with httpx.Client(base_url=base_url, timeout=timeout) as client:
        # Barre TQDM globale
        pbar = tqdm(
            total=len(steps),
            desc="🚀 Évaluation globale",
            unit="module",
            bar_format="{l_bar}{bar:25}{r_bar}",
            colour="cyan"
        )

        for slug, name, path, method, params in steps:
            pbar.set_description(f"⚡ {name[:28]}")

            # Sous-barre TQDM animée pour le suivi de la requête en cours
            with tqdm(total=100, desc=f"   ↳ {slug}", leave=False, bar_format="{desc}: |{bar:20}| {percentage:3.0f}%", colour="green") as sub_pbar:
                sub_pbar.update(25)

                # Coordonnées réelles du siège si trouvées
                if params and "lat" in params and "company" in params:
                    params["lat"] = lat_target
                    params["lon"] = lon_target
                
                sub_pbar.update(25)
                res = test_endpoint(client, method, path, name, params, timeout=timeout)
                sub_pbar.update(30)

                # Si c'est search_company, extraire les coordonnées réelles
                if path == "/api/v1/search_company" and res["data"] and isinstance(res["data"], dict):
                    hq = res["data"].get("headquarter") or {}
                    if hq.get("lat") and hq.get("lon"):
                        try:
                            lat_target = float(hq["lat"])
                            lon_target = float(hq["lon"])
                        except Exception:
                            pass

                sub_pbar.update(20)

            # Sauvegarde du fichier JSON brut individuel
            file_saved = None
            if res["data"] is not None:
                file_saved = save_json(output_dir, f"{slug}.json", res["data"])
                consolidated[slug] = res["data"]

            results.append((slug, res, file_saved))

            # Affichage console du résultat de l'étape
            status_icon = "✅" if res["status_code"] == 200 else ("⚠️" if res["status_code"] in [404, 422] else "❌")
            tqdm.write(f"\n{status_icon} [{slug}] {name} -> HTTP {res['status_code']} ({res['elapsed_ms']:.0f} ms)")
            
            # Affichage des données JSON réelles
            if res["data"]:
                preview = format_preview(name, res["data"], max_lines=20 if show_full_json else 10)
                tqdm.write("   📦 DONNÉES JSON RÉELLES REÇUES :")
                for line in preview.splitlines():
                    tqdm.write(f"      {line}")
                if file_saved:
                    tqdm.write(f"   💾 Fichier sauvegardé : {os.path.basename(file_saved)}")
            elif res["error"]:
                tqdm.write(f"   ❌ Erreur : {res['error']}")

            pbar.update(1)

        pbar.set_description("🏁 Tous les modules ont été exécutés")
        pbar.close()

    # Sauvegarde consolidée
    consolidated_file = save_json(output_dir, "FULL_AUDIT_CONSOLIDATED.json", {
        "metadata": {
            "company": company,
            "target_coordinates": {"lat": lat_target, "lon": lon_target},
            "audited_at": datetime.now().isoformat(),
            "server": base_url
        },
        "modules": consolidated
    })

    # Synthèse Finale
    print("\n" + "=" * 76)
    print(" 📊 SYNTHÈSE DES DONNÉES GEOINT RÉCOLTÉES")
    print("=" * 76)
    print(f"{'Module':<22} | {'HTTP':<6} | {'Temps':<8} | {'Contenu réel extrait'}")
    print("-" * 76)

    for slug, r, path in results:
        code_str = f"{r['status_code']}" if r["status_code"] > 0 else "ERR"
        time_str = f"{r['elapsed_ms']:.0f} ms"
        
        detail = "Aucune donnée"
        if r["error"]:
            detail = f"Échec: {r['error'][:30]}"
        elif isinstance(r["data"], dict):
            if "sites" in r["data"]:
                sites = r["data"].get("sites", [])
                hq = r["data"].get("headquarter", {})
                detail = f"{len(sites)} sites | HQ: {hq.get('label', hq.get('nom', 'N/A'))[:25]}"
            elif "result" in r["data"] and isinstance(r["data"]["result"], dict):
                sub = r["data"]["result"]
                if "competitors" in sub:
                    comps = [c.get("nom", c.get("nom_complet", "")) for c in sub.get("competitors", [])[:3]]
                    detail = f"{len(sub.get('competitors', []))} concurrents: {', '.join(comps)}"
                elif "airspace_monitoring" in sub:
                    fl = sub.get("airspace_monitoring", {}).get("flights", [])
                    detail = f"{len(fl)} vol(s) en direct (ADS-B)"
                elif "maritime_traffic" in sub:
                    vessels = sub.get("maritime_traffic", {}).get("vessels", [])
                    detail = f"{len(vessels)} navire(s) AIS en mouvement"
                elif "asset_compliance_score" in sub:
                    detail = f"Score conformité: {sub.get('asset_compliance_score')}/100"
                elif "evidence" in sub or "evidence" in r["data"]:
                    ev_count = len(sub.get("evidence", r["data"].get("evidence", [])))
                    detail = f"{ev_count} preuves de renseignement vérifiées"
            elif "integrated_engines" in r["data"]:
                detail = f"{len(r['data']['integrated_engines'])} moteurs opérationnels"

        print(f"{slug:<22} | {code_str:<6} | {time_str:<8} | {detail[:38]}")

    print("-" * 76)
    print(f"📁 Tous les fichiers JSON bruts sont sauvegardés dans :")
    print(f"   👉 {output_dir}")
    print("=" * 76)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Testeur interactif de l'API TERRA avec affichage des données JSON réelles")
    parser.add_argument("company", nargs="?", default=None, help="Nom de l'entreprise cible (ou interactif si omis)")
    parser.add_argument("--url", default=None, help="URL de base (ex: http://127.0.0.1:8005 ou https://terra-4i1u.onrender.com)")
    parser.add_argument("--timeout", type=float, default=35.0, help="Délai d'attente max par requête en secondes")
    parser.add_argument("--full", action="store_true", help="Afficher l'intégralité des JSON dans la console sans troncature")
    
    args = parser.parse_args()

    # Mode interactif convivial pour la ligne de commande
    company = args.company
    if not company:
        print()
        print("🛰️   BANC D'ESSAI DES API TERRA (GEOINT 360°)")
        print("-" * 55)
        try:
            company_input = input("👉 Entrez le nom de l'entreprise à tester [Airbus] : ").strip()
            company = company_input if company_input else "Airbus"
        except (KeyboardInterrupt, EOFError):
            print("\nAnnulé.")
            sys.exit(0)

    base_url = args.url
    if not base_url:
        print()
        print("🌐 Choisissez l'environnement à interroger :")
        print("  [1] Production Render (https://terra-4i1u.onrender.com) [Défaut]")
        print("  [2] Serveur Local     (http://127.0.0.1:8005)")
        print("  [3] Saisir une autre URL")
        try:
            choice = input("👉 Votre choix [1] : ").strip()
            if choice == "2":
                base_url = "http://127.0.0.1:8005"
            elif choice == "3":
                custom = input("👉 Entrez l'URL complète : ").strip()
                base_url = custom if custom else "https://terra-4i1u.onrender.com"
            else:
                base_url = "https://terra-4i1u.onrender.com"
        except (KeyboardInterrupt, EOFError):
            base_url = "https://terra-4i1u.onrender.com"

    print()
    run_benchmark(
        company=company,
        base_url=base_url.rstrip("/"),
        timeout=args.timeout,
        show_full_json=args.full
    )
