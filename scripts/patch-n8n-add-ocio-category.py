#!/usr/bin/env python3
"""Agrega categoría «Ocio» (cine, Hoyts, etc.) y separa de «Suscripciones» en el workflow n8n."""
import json
import sqlite3
import sys
import uuid
from datetime import datetime, timezone

WF_ID = "ueo6aLqjL4VGjhVP"


def patch_prepare(js: str) -> str:
    old_allowed = """  "Deportes",
  "Suscripciones",
"""
    new_allowed = """  "Deportes",
  "Ocio",
  "Suscripciones",
"""
    if old_allowed not in js:
        raise SystemExit("Prepare: ALLOWED_GASTO block not found (Deportes/Suscripciones)")
    js = js.replace(old_allowed, new_allowed, 1)

    old_rule = """    [/netflix|streaming|cine|spotify|ocio|suscripcion|vpn/i, "Suscripciones"],
"""
    new_rule = """    [/hoyts|cinemark|cinemacenter|ticketera|moviecenter|\\bcine\\b|pel[ií]cula|entrada|teatro|recital|boleter[ií]a/i, "Ocio"],
    [/netflix|streaming|spotify|suscripcion|vpn|youtube\\s+premium|disney\\+|hbomax|paramount|twitch/i, "Suscripciones"],
"""
    if old_rule not in js:
        raise SystemExit("Prepare: netflix/cine rule line not found")
    js = js.replace(old_rule, new_rule, 1)

    anchor = """    [/parque\\s+norte|tenis|cancha/i, "Deportes"],
    [/am\\.nord\\*vpncom|vpn|youtube|spotify|netflix|suscripcion/i, "Suscripciones"],
"""
    insert = """    [/parque\\s+norte|tenis|cancha/i, "Deportes"],
    [/hoyts|cinemark|\\bcine\\b|pel[ií]cula|entrada|teatro|recital/i, "Ocio"],
    [/am\\.nord\\*vpncom|vpn|youtube|spotify|netflix|suscripcion/i, "Suscripciones"],
"""
    if anchor not in js:
        raise SystemExit("Prepare: mdAliasRules anchor not found")
    js = js.replace(anchor, insert, 1)

    if "\n  ocio: \"Ocio\"," not in js:
        js = js.replace(
            '  "ocio y suscripciones": "Suscripciones",',
            '  "ocio y suscripciones": "Suscripciones",\n  ocio: "Ocio",',
            1,
        )

    return js


def patch_analyze_image(txt: str) -> str:
    old_bullets = """- Deportes
- Suscripciones
"""
    new_bullets = """- Deportes
- Ocio
- Suscripciones
"""
    if old_bullets not in txt:
        raise SystemExit("Analyze image: bullet block not found")
    txt = txt.replace(old_bullets, new_bullets, 1)

    old_md = "parque norte, tenis, cancha => Deportes; am.nord*vpncom"
    new_md = (
        "parque norte, tenis, cancha => Deportes; "
        "hoyts, cinemark, cine, pelicula, entrada, teatro, recital => Ocio; "
        "am.nord*vpncom"
    )
    if old_md not in txt:
        raise SystemExit("Analyze image: RULES_FROM_MD snippet not found")
    txt = txt.replace(old_md, new_md, 1)
    return txt


def patch_message_model(txt: str) -> str:
    old_bullets = """- Deportes
- Suscripciones
"""
    new_bullets = """- Deportes
- Ocio
- Suscripciones
"""
    if txt.count(old_bullets) != 1:
        raise SystemExit(f"Message a model: expected 1 bullet block, got {txt.count(old_bullets)}")
    txt = txt.replace(old_bullets, new_bullets, 1)

    old_md = "parque norte, tenis, cancha => Deportes; am.nord*vpncom"
    new_md = (
        "parque norte, tenis, cancha => Deportes; "
        "hoyts, cinemark, cine, pelicula, entrada, teatro, recital => Ocio; "
        "am.nord*vpncom"
    )
    if old_md not in txt:
        raise SystemExit("Message a model: RULES_FROM_MD parque norte snippet not found")
    txt = txt.replace(old_md, new_md, 1)

    old_reglas = (
        "Reglas: súper → Supermercado; delivery/café → Restaurantes y delivery; "
        "Uber/taxi → Transporte; nafta/patente auto → Automóvil; farmacia/médico → Salud; "
        "luz/gas/internet → Servicios e impuestos; alquiler/departamento/expensas/vivienda → Vivienda; "
        "si no encaja → Otros."
    )
    new_reglas = (
        "Reglas: súper → Supermercado; delivery/café → Restaurantes y delivery; "
        "Uber/taxi → Transporte; nafta/patente auto → Automóvil; farmacia/médico → Salud; "
        "luz/gas/internet → Servicios e impuestos; alquiler/departamento/expensas/vivienda → Vivienda; "
        "cine/Hoyts/teatro/entradas → Ocio; Netflix/Spotify/VPN/suscripciones digitales → Suscripciones; "
        "si no encaja → Otros."
    )
    if old_reglas not in txt:
        raise SystemExit("Message a model: Reglas line not found")
    txt = txt.replace(old_reglas, new_reglas, 1)
    return txt


def main():
    db = sys.argv[1] if len(sys.argv) > 1 else "/home/ubuntu/n8n_dot_n8n/database.sqlite"
    conn = sqlite3.connect(db)
    cur = conn.cursor()
    row = cur.execute(
        "SELECT nodes FROM workflow_entity WHERE id=?", (WF_ID,)
    ).fetchone()
    if not row:
        raise SystemExit(f"Workflow {WF_ID} not found")
    nodes = json.loads(row[0])

    for n in nodes:
        name = n.get("name")
        if name == "Prepare sheet rows":
            n["parameters"]["jsCode"] = patch_prepare(n["parameters"]["jsCode"])
        elif name == "Analyze image":
            n["parameters"]["text"] = patch_analyze_image(n["parameters"]["text"])
        elif name == "Message a model":
            vals = n["parameters"]["messages"]["values"]
            vals[0]["content"] = patch_message_model(vals[0]["content"])

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    cur.execute(
        "UPDATE workflow_entity SET nodes=?, versionId=?, updatedAt=? WHERE id=?",
        (json.dumps(nodes), str(uuid.uuid4()), now, WF_ID),
    )
    conn.commit()
    conn.close()
    print("OK: categoría Ocio (Prepare sheet rows + Analyze image + Message a model)")


if __name__ == "__main__":
    main()
