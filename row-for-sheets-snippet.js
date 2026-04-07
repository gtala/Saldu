// Reference only — embedded into n8n Row for Sheets node
const b = $("Build month sheet name").first().json;
const codeNode = $("Code").first().json;
const text = String(b.message?.content || b.content || "");
const m = text.match(/"monto"\s*:\s*([\d.]+)/i);
const cat = text.match(/"categoria"\s*:\s*"([^"]+)"/i);
const desc = text.match(/"descripcion"\s*:\s*"([^"]+)"/i);

const ALLOWED = [
  "Supermercado",
  "Restaurantes y delivery",
  "Transporte",
  "Automóvil",
  "Salud",
  "Servicios e impuestos",
  "Hogar y mantenimiento",
  "Ropa y calzado",
  "Ocio y suscripciones",
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

function pickFirstNonEmpty(values) {
  for (const v of values) {
    const s = String(v ?? "").trim();
    if (s) return s;
  }
  return "";
}

const LEGACY = {
  "comidas y bebidas": "Restaurantes y delivery",
  alimentacion: "Supermercado",
  general: "Otros",
  variado: "Otros",
  "pago tarjeta de credito": "Servicios e impuestos",
  "pago tarjeta de crédito": "Servicios e impuestos",
  estacionamiento: "Automóvil",
  servicios: "Servicios e impuestos",
};

function normalizeCategory(raw) {
  const t = String(raw || "").trim();
  if (!t) return "Otros";
  for (const a of ALLOWED) {
    if (a === t) return a;
  }
  const n = norm(t);
  const legacy = LEGACY[n];
  if (legacy) return legacy;
  for (const a of ALLOWED) {
    if (norm(a) === n) return a;
  }
  const rules = [
    [/restaurant|delivery|cafeter|comedor|bar\b|comidas y bebidas|pedido.*comida/i, "Restaurantes y delivery"],
    [/supermercado|^super\b|carrefour|coto|\bdia\b|disco|walmart|jumbo|vea/i, "Supermercado"],
    [/uber|taxi|colectivo|subte|remis|bondi/i, "Transporte"],
    [/nafta|combustible|estacion|patente|seguro.*auto|lavadero|taller|automovil|automóvil|^auto\b/i, "Automóvil"],
    [/farmacia|medicina|m[eé]dico|laboratorio|salud\b/i, "Salud"],
    [/luz\b|gas\b|internet|expensas|abl|monotributo|impuesto|servicios publicos/i, "Servicios e impuestos"],
    [/mascota|perro|gato|veterinaria|balanceado/i, "Mascotas"],
    [/netflix|streaming|cine|spotify|ocio|suscripcion/i, "Ocio y suscripciones"],
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

function looksGenericReceiptText(s) {
  const n = norm(s);
  return !n || /^(total|aprobado|ticket|factura|comprobante|visa|mastercard|debito|credito)$/i.test(n);
}

// Prefer user text/caption over OCR when available.
const userNote = pickFirstNonEmpty([
  b.user_note,
  b.caption,
  b.message?.caption,
  b.message?.text,
  codeNode.caption,
  codeNode.whatsappText,
  codeNode.message,
]);

const aiDesc = String(desc ? desc[1] : "").trim();
const aiCat = String(cat ? cat[1] : "").trim();

let finalDesc = userNote || aiDesc;
if (!finalDesc || looksGenericReceiptText(finalDesc)) {
  finalDesc = userNote || aiDesc || "";
}

let finalCat = normalizeCategory(aiCat);
if (finalCat === "Otros" && userNote) {
  finalCat = normalizeCategory(userNote);
}

const row = { Monto: m ? m[1] : "", Fecha: codeNode.calculated_date ?? "" };
row["Categoría"] = finalCat;
row["Descripción"] = finalDesc;
return [{ json: row }];
