#!/usr/bin/env python3
"""One-off: patch n8n workflow in SQLite (run on VPS against n8n_dot_n8n/database.sqlite)."""
import copy
import json
import sqlite3
import uuid
from datetime import datetime, timezone

DB = "/home/ubuntu/n8n_dot_n8n/database.sqlite"
WF_ID = "ueo6aLqjL4VGjhVP"


def nid():
    return str(uuid.uuid4())


def main():
    conn = sqlite3.connect(DB)
    cur = conn.cursor()
    nodes = json.loads(cur.execute("SELECT nodes FROM workflow_entity WHERE id=?", (WF_ID,)).fetchone()[0])
    con = json.loads(cur.execute("SELECT connections FROM workflow_entity WHERE id=?", (WF_ID,)).fetchone()[0])

    for n in nodes:
        if n.get("name") == "Code":
            js = n["parameters"]["jsCode"]
            old = r"const is_income_command = !is_edit_command && /^ingreso\b/i.test(message);"
            new = r"const is_income_command = !is_edit_command && /^ingresos?\b/i.test(message);"
            if old not in js:
                raise SystemExit("Code node pattern not found")
            n["parameters"]["jsCode"] = js.replace(old, new, 1)
            print("Code: ingresos? fixed")

    for n in nodes:
        if n.get("name") != "Prepare sheet rows":
            continue
        js = n["parameters"]["jsCode"]
        needle = (
            "if (parsed && Array.isArray(parsed.movimientos))\n"
            "    return { objects: parsed.movimientos, error: null };"
        )
        insert = (
            "if (parsed && Array.isArray(parsed.ingresos))\n"
            "    return { objects: parsed.ingresos, error: null };"
        )
        if insert not in js:
            if needle not in js:
                raise SystemExit("tryParse insert point not found")
            js = js.replace(needle, insert + "\n  " + needle, 1)

        hook = "function extractFields(obj) {"
        if "function sanitizeMontoInput" not in js:
            san = r"""
/** Corrige montos con separadores raros o valores gigantes mal parseados. */
function sanitizeMontoInput(raw) {
  if (raw == null || raw === "") return "";
  if (typeof raw === "number" && Number.isFinite(raw)) {
    let t = raw;
    if (Math.abs(t) > 1e7 && Math.abs(t) < 1e15) t = t / 1e8;
    return String(Number(t.toFixed(8))).replace(/\.?0+$/, "") || String(t);
  }
  let s = String(raw).trim().replace(/\s/g, "").replace(/USDT?$/i, "");
  const neg = /^[-−]/.test(s) || /^\(.+\)$/.test(s);
  s = s.replace(/^[-−+]/, "").replace(/^\(|\)$/g, "");
  const dots = (s.match(/\./g) || []).length;
  const commas = (s.match(/,/g) || []).length;
  if (commas && (!dots || s.lastIndexOf(",") > s.lastIndexOf("."))) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (dots > 1) {
    const p = s.split(".");
    const last = p.pop();
    if (last.length <= 2) s = p.join("") + "." + last;
    else s = p.join("") + last;
  }
  let n = parseFloat(s);
  if (!Number.isFinite(n)) return String(raw).trim();
  if (Math.abs(n) > 1e7 && Math.abs(n) < 1e15) n = n / 1e8;
  n = Math.abs(n);
  return String(Number(n.toFixed(8))).replace(/\.?0+$/, "");
}

"""
            js = js.replace(hook, san + "\n" + hook, 1)

        old_block = """  let mStr = "";
  if (o.monto != null && o.monto !== "") mStr = String(o.monto).trim();
  if (!mStr && ex.m) mStr = ex.m[1];"""
        new_block = """  let mStr = "";
  if (o.monto != null && o.monto !== "") mStr = String(o.monto).trim();
  if (!mStr && ex.m) mStr = ex.m[1];
  mStr = sanitizeMontoInput(mStr || "");"""
        if new_block not in js:
            if old_block not in js:
                raise SystemExit("rowFromObject mStr block not found")
            js = js.replace(old_block, new_block, 1)

        js = js.replace(
            'const m = s.match(/"monto"\\s*:\\s*([\\d.]+)/i);',
            'const m = s.match(/"monto"\\s*:\\s*(-?[\\d.]+(?:[eE][+-]?\\d+)?)/i);',
        )
        n["parameters"]["jsCode"] = js
        print("Prepare sheet rows: sanitizer + ingresos[] + regex")
        break

    base_ai = next(x for x in nodes if x.get("name") == "Analyze image")
    ai_in = copy.deepcopy(base_ai)
    new_ai_id = nid()
    ai_in["id"] = new_ai_id
    ai_in["name"] = "Analyze image ingreso"
    ai_in["position"] = [base_ai["position"][0] - 40, base_ai["position"][1] + 200]
    ai_in["parameters"]["text"] = """Analizá la captura (Binance, exchange, banco, comprobante). El usuario registró un INGRESO (dinero que entra), aunque la app muestre "Retirar", signo menos o retiro a billetera propia.

REGLAS DE MONTO:
- Devolvé **un solo número** en "monto": el valor principal de la operación en la moneda indicada (USDT/USD), **positivo**, usando **punto** solo como decimal (ej. 201.61). Sin separadores de miles.
- Si ves -201.61 USDT o "Retirar" hacia cuenta propia, usá el **valor absoluto** del monto (~200 USD).
- NUNCA devuelvas montos con varios puntos tipo 20.161.478.542.

Categoría EXACTAMENTE una de: Salario | Inversiones | Rendimientos | Otros ingresos
Trading, P2P, retiros desde exchange a cuenta propia, venta cripto → Inversiones salvo interés explícito → Rendimientos.

JSON SOLO (sin markdown):
{ "ingresos": [ { "monto": <número>, "moneda": "USD" o "ARS", "categoria": "...", "descripcion": "...", "tipo": "Ingreso", "fecha": "{{ $('Code').first().json.calculated_date }}" } ] }

Un solo elemento en el array si hay un movimiento. Fecha siempre la de arriba."""
    nodes.append(ai_in)

    if_doc_id = nid()
    if_doc = {
        "parameters": {
            "conditions": {
                "options": {
                    "caseSensitive": True,
                    "leftValue": "",
                    "typeValidation": "loose",
                    "version": 2,
                },
                "conditions": [
                    {
                        "id": nid(),
                        "leftValue": "={{ $json.has_document }}",
                        "rightValue": "={{ true }}",
                        "operator": {
                            "type": "string",
                            "operation": "equals",
                            "name": "filter.operator.equals",
                        },
                    }
                ],
                "combinator": "and",
            },
            "looseTypeValidation": True,
            "options": {},
        },
        "type": "n8n-nodes-base.if",
        "typeVersion": 2.2,
        "position": [-620, 300],
        "id": if_doc_id,
        "name": "IF ingreso con imagen",
    }

    if_vis_id = nid()
    if_vis = {
        "parameters": {
            "conditions": {
                "options": {
                    "caseSensitive": True,
                    "leftValue": "",
                    "typeValidation": "loose",
                    "version": 2,
                },
                "conditions": [
                    {
                        "id": nid(),
                        "leftValue": "={{ $json.income_route }}",
                        "rightValue": "income",
                        "operator": {
                            "type": "string",
                            "operation": "equals",
                            "name": "filter.operator.equals",
                        },
                    }
                ],
                "combinator": "and",
            },
            "looseTypeValidation": True,
            "options": {},
        },
        "type": "n8n-nodes-base.if",
        "typeVersion": 2.2,
        "position": [-120, 380],
        "id": if_vis_id,
        "name": "IF vision ingreso o gasto",
    }
    nodes.extend([if_doc, if_vis])

    INC = "IF is income"
    OLD_TGT = "Message income"
    HTTP = "HTTP Request1"
    AN_G = "Analyze image"
    AN_I = "Analyze image ingreso"
    IFD = "IF ingreso con imagen"
    IFV = "IF vision ingreso o gasto"

    inc_main = con[INC]["main"]
    if len(inc_main[0]) != 1:
        raise SystemExit(f"unexpected IF is income out0: {inc_main[0]}")
    inc_main[0] = [{"node": IFD, "type": "main", "index": 0}]

    con[IFD] = {
        "main": [
            [{"node": HTTP, "type": "main", "index": 0}],
            [{"node": OLD_TGT, "type": "main", "index": 0}],
        ]
    }

    h = con[HTTP]["main"][0]
    if len(h) != 1:
        raise SystemExit(f"unexpected HTTP Request1 out: {h}")
    con[HTTP]["main"][0] = [{"node": IFV, "type": "main", "index": 0}]

    con[IFV] = {
        "main": [
            [{"node": AN_I, "type": "main", "index": 0}],
            [{"node": AN_G, "type": "main", "index": 0}],
        ]
    }

    for n in nodes:
        if n.get("name") == "Message income":
            vals = n["parameters"]["messages"]["values"]
            c = vals[0]["content"]
            vals[0]["content"] = c.replace(
                'Si el mensaje empieza con la palabra "ingreso", ignorala',
                'Si el mensaje empieza con "ingreso" o "ingresos", ignorá esa palabra',
            )
            break

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    cur.execute(
        "UPDATE workflow_entity SET nodes=?, connections=?, versionId=?, updatedAt=? WHERE id=?",
        (json.dumps(nodes), json.dumps(con), str(uuid.uuid4()), now, WF_ID),
    )
    conn.commit()
    conn.close()
    print("OK")


if __name__ == "__main__":
    main()
