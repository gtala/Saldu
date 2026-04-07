// Reference: embedded in n8n "Find row for edit" node
const p = $("Parse edit command").first().json;

if (p.edit_error) {
  return [{ json: { whatsappText: p.edit_error, find_failed: true } }];
}

function norm(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normDateCell(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return norm(s);
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2, "0");
    const mm = m[2].padStart(2, "0");
    return norm(`${m[3]}-${mm}-${dd}`);
  }
  return norm(s);
}

function num(v) {
  if (v == null || v === "") return NaN;
  let s = String(v).trim();
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

const targetM = p.edit_monto;
const targetF = normDateCell(p.edit_fecha);
const hint = (p.desc_incluye || "").toLowerCase();

const items = $input.all();
const matches = [];

for (const it of items) {
  const r = it.json;
  const rn = r.row_number;
  if (rn == null || rn === "") continue;
  const m = num(r.Monto);
  const f = normDateCell(r.Fecha);
  const d = norm(r["Descripción"] || r.Descripcion || "");
  if (Number.isNaN(m) || Math.abs(m - targetM) > 0.009) continue;
  if (targetF && f !== targetF) continue;
  if (hint && !d.includes(hint)) continue;
  matches.push({ row_number: rn, r });
}

const tab = p.sheet_tab_name || "";

if (matches.length === 0) {
  return [
    {
      json: {
        whatsappText:
          "No encontré ese gasto en " +
          tab +
          ". Revisá monto y fecha, o mandá desc_incluye=palabra de la descripción si hay varios iguales.",
        find_failed: true,
      },
    },
  ];
}

if (matches.length > 1) {
  return [
    {
      json: {
        whatsappText:
          "Hay varios movimientos con ese monto y fecha. Agregá desc_incluye=algo que figure en la descripción (ej: desc_incluye=tarjeta).",
        find_failed: true,
      },
    },
  ];
}

return [
  {
    json: {
      row_number: matches[0].row_number,
      new_categoria: p.new_categoria,
      new_descripcion: p.new_descripcion,
      sheet_tab_name: tab,
      find_failed: false,
    },
  },
];
