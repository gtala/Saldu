// Reference: embedded in n8n "Parse edit command" node
const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

function sheetTabNameArgentina() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  let y;
  let m;
  for (const p of parts) {
    if (p.type === "year") y = parseInt(p.value, 10);
    if (p.type === "month") m = parseInt(p.value, 10) - 1;
  }
  return `${MONTHS[m]} ${y}`;
}

const ALLOWED = [
  "Supermercado",
  "Restaurantes y delivery",
  "Transporte",
  "Automóvil",
  "Salud",
  "Servicios e impuestos",
  "Hogar y mantenimiento",
  "Ropa y calzado",
  "Ocio",
  "Suscripciones",
  "Mascotas",
  "Educación",
  "Regalos y donaciones",
  "Otros",
];

function norm(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const LEGACY = {
  "ocio y suscripciones": "Suscripciones",
};

function normalizeCategory(raw) {
  const t = String(raw || "").trim();
  if (!t) return "Otros";
  for (const a of ALLOWED) {
    if (a === t) return a;
  }
  const n = norm(t);
  if (LEGACY[n]) return LEGACY[n];
  for (const a of ALLOWED) {
    if (norm(a) === n) return a;
  }
  const rules = [
    [/restaurant|delivery|cafeter|comedor|bar\b|comidas y bebidas/i, "Restaurantes y delivery"],
    [/supermercado|^super\b|carrefour|coto|\bdia\b|disco|walmart|jumbo|vea/i, "Supermercado"],
    [/uber|taxi|colectivo|subte|remis|bondi/i, "Transporte"],
    [/nafta|combustible|estacion|patente|seguro|lavadero|taller|automovil|automóvil|^auto\b/i, "Automóvil"],
    [/farmacia|medicina|m[eé]dico|laboratorio|salud\b/i, "Salud"],
    [/luz\b|gas\b|internet|expensas|abl|monotributo|impuesto|servicios publicos/i, "Servicios e impuestos"],
    [/mascota|perro|gato|veterinaria|balanceado/i, "Mascotas"],
    [/hoyts|cinemark|\bcine\b|pel[ií]cula|entrada|teatro|recital/i, "Ocio"],
    [/netflix|streaming|spotify|suscripcion|vpn/i, "Suscripciones"],
    [/ropa|zapatilla|calzado/i, "Ropa y calzado"],
    [/curso|libro|universidad|colegio|educacion/i, "Educación"],
    [/regalo|donacion/i, "Regalos y donaciones"],
    [/ferreteria|mueble|hogar|mantenimiento|electro/i, "Hogar y mantenimiento"],
  ];
  for (const [re, label] of rules) {
    if (re.test(t)) return label;
  }
  return "Otros";
}

function parseMontoNum(str) {
  let s = String(str ?? "").trim();
  if (!s) return NaN;
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else s = s.replace(",", ".");
  return parseFloat(s);
}

const raw = String($("Code").first().json.message || "").trim();
const rest = raw.replace(/^\s*editar\s*/i, "").trim();

let edit_error = null;
let edit_monto = NaN;
let edit_fecha = "";
let desc_incluye = "";
let new_categoria = "";
let new_descripcion = "";

const pipeParts = rest
  .split("|")
  .map((s) => s.trim())
  .filter(Boolean);

if (pipeParts.length >= 3) {
  const m0 = pipeParts[0].replace(/^monto\s*[=:]\s*/i, "");
  edit_monto = parseMontoNum(m0);
  new_categoria = normalizeCategory(pipeParts[1]);
  new_descripcion = pipeParts.slice(2).join(" | ");
} else {
  const descM = rest.match(
    /(?:descripcion|descripción|desc)\s*[=:]\s*(.+)$/is
  );
  let restNoDesc = rest;
  if (descM) {
    new_descripcion = descM[1].trim();
    restNoDesc = rest.slice(0, rest.indexOf(descM[0])).trim();
  }
  const montoM = restNoDesc.match(/monto\s*[=:]\s*([\d.\s]+)/i);
  const fechaM = restNoDesc.match(/fecha\s*[=:]\s*(\d{4}-\d{2}-\d{2})/i);
  const inclM = rest.match(/desc(?:ripcion)?_?incluye\s*[=:]\s*([^\n]+)/i);
  const catM = restNoDesc.match(/categor[ií]a\s*[=:]\s*(.+?)\s*$/is);
  if (montoM && catM) {
    edit_monto = parseMontoNum(montoM[1]);
    new_categoria = normalizeCategory(catM[1].trim());
    if (!descM) new_descripcion = "";
    if (fechaM) edit_fecha = fechaM[1];
    if (inclM) desc_incluye = inclM[1].trim().toLowerCase();
  } else {
    edit_error =
      "Formato: editar monto=190701 categoria=Automóvil descripcion=Seguro del auto. Opcional: fecha=2026-04-05 desc_incluye=tarjeta. O con barras: editar 190701 | Automóvil | Seguro del auto";
  }
}

if (!edit_error) {
  if (!Number.isFinite(edit_monto)) edit_error = "No entendí el monto.";
  else if (!new_categoria) edit_error = "Falta la categoría.";
}

if (!edit_fecha) {
  edit_fecha = $("Code").first().json.calculated_date || "";
}

return [
  {
    json: {
      sheet_tab_name: sheetTabNameArgentina(),
      edit_error: edit_error || "",
      parse_failed: Boolean(edit_error),
      edit_monto,
      edit_fecha,
      desc_incluye,
      new_categoria,
      new_descripcion,
    },
  },
];
