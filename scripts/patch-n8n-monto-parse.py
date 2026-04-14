#!/usr/bin/env python3
"""
Parche: n8n workflow → nodo Code «Prepare sheet rows».
- Quita la heurística /1e8 que achicaba montos.
- Parseo AR (76.800,00 / 1.234,56) y miles con puntos (22.000).
- extractFields: también lee "monto" como string JSON (antes solo número).
Ejecutar en el VPS:
  python3 patch-n8n-monto-parse.py /home/ubuntu/n8n_dot_n8n/database.sqlite
"""
import json
import sqlite3
import sys
import uuid
from datetime import datetime, timezone

WF_ID = "ueo6aLqjL4VGjhVP"

OLD_BLOCK = r'''/** Corrige montos con separadores raros o valores gigantes mal parseados. */
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


function extractFields(obj) {
  const s = JSON.stringify(obj);
  const m = s.match(/"monto"\s*:\s*(-?[\d.]+(?:[eE][+-]?\d+)?)/i);
  const cat = s.match(/"categoria"\s*:\s*"([^"]+)"/i);
  const desc = s.match(/"descripcion"\s*:\s*"([^"]*)"/i);
  const tipoJ = s.match(/"tipo"\s*:\s*"([^"]*)"/i);
  const mon = s.match(/"moneda"\s*:\s*"([^"]*)"/i);
  return { m, cat, desc, tipoJ, mon };
}'''

NEW_BLOCK = r'''/** Normaliza montos (ARS: miles '.', decimal ','; sin /1e8). */
function sanitizeMontoInput(raw) {
  if (raw == null || raw === "") return "";
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const t = Math.abs(raw);
    let out = String(t);
    if (out.includes("e") || out.includes("E")) out = Number(t).toFixed(12).replace(/\.?0+$/, "");
    else if (out.includes(".")) out = out.replace(/\.?0+$/, "");
    return out;
  }
  let s = String(raw)
    .trim()
    .replace(/\s/g, "")
    .replace(/[\u00a0\u202f]/g, "")
    .replace(/ARS?$/i, "")
    .replace(/USDT?$/i, "")
    .replace(/\$/g, "");
  s = s.replace(/^[-−+]/, "").replace(/^\(([\s\S]*)\)$/, "$1");

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    if (s.lastIndexOf(",") > s.lastIndexOf(".")) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasComma && !hasDot) {
    const parts = s.split(",");
    if (
      parts.length === 2 &&
      parts[1].length <= 2 &&
      /^\d+$/.test(parts[0]) &&
      /^\d+$/.test(parts[1])
    ) {
      s = parts[0] + "." + parts[1];
    } else {
      s = s.replace(/,/g, "");
    }
  } else if (hasDot && !hasComma) {
    if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
      s = s.replace(/\./g, "");
    } else if ((s.match(/\./g) || []).length > 1) {
      const p = s.split(".");
      const last = p.pop();
      if (last.length <= 2) s = p.join("") + "." + last;
      else s = p.join("") + last;
    }
  }

  const n = parseFloat(s);
  if (!Number.isFinite(n)) return String(raw).trim();
  const v = Math.abs(n);
  let out = String(v);
  if (out.includes("e") || out.includes("E")) out = v.toFixed(12).replace(/\.?0+$/, "");
  else if (out.includes(".")) out = out.replace(/\.?0+$/, "");
  return out;
}

function extractMontoFromJsonString(s) {
  const mq = s.match(/"monto"\s*:\s*"((?:\\.|[^"\\])*)"/i);
  if (mq) return mq[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  const mn = s.match(/"monto"\s*:\s*(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/i);
  if (mn) return mn[1];
  return null;
}

function extractFields(obj) {
  const s = JSON.stringify(obj);
  const mVal = extractMontoFromJsonString(s);
  const m = mVal != null ? ["", mVal] : null;
  const cat = s.match(/"categoria"\s*:\s*"([^"]+)"/i);
  const desc = s.match(/"descripcion"\s*:\s*"([^"]*)"/i);
  const tipoJ = s.match(/"tipo"\s*:\s*"([^"]*)"/i);
  const mon = s.match(/"moneda"\s*:\s*"([^"]*)"/i);
  return { m, cat, desc, tipoJ, mon };
}'''


def main():
    db = sys.argv[1] if len(sys.argv) > 1 else "/home/ubuntu/n8n_dot_n8n/database.sqlite"
    conn = sqlite3.connect(db)
    cur = conn.cursor()
    row = cur.execute(
        "SELECT nodes, connections FROM workflow_entity WHERE id=?", (WF_ID,)
    ).fetchone()
    if not row:
        raise SystemExit(f"Workflow {WF_ID} not found")
    nodes_json, con_json = row
    nodes = json.loads(nodes_json)

    updated = False
    for n in nodes:
        if n.get("name") != "Prepare sheet rows":
            continue
        js = n["parameters"]["jsCode"]
        if OLD_BLOCK not in js:
            raise SystemExit("OLD_BLOCK not found in Prepare sheet rows (ya parcheado o distinto)")
        n["parameters"]["jsCode"] = js.replace(OLD_BLOCK, NEW_BLOCK, 1)
        updated = True
        break

    if not updated:
        raise SystemExit("Prepare sheet rows node not found")

    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    cur.execute(
        "UPDATE workflow_entity SET nodes=?, versionId=?, updatedAt=? WHERE id=?",
        (json.dumps(nodes), str(uuid.uuid4()), now, WF_ID),
    )
    conn.commit()
    conn.close()
    print("OK: sanitizeMontoInput + extractFields (monto string)")


if __name__ == "__main__":
    main()
