const DOLAR_CRIPTO_URL = "https://dolarapi.com/v1/dolares/cripto";

export async function GET() {
  try {
    const r = await fetch(DOLAR_CRIPTO_URL, {
      headers: {
        Accept: "application/json",
        "User-Agent": "saldu-next/1",
      },
      next: { revalidate: 120 },
    });
    if (!r.ok) {
      return Response.json(
        { error: "COTIZACION_ERROR", message: `DolarApi HTTP ${r.status}` },
        { status: 502 }
      );
    }
    const data = await r.json();
    return Response.json(data, {
      headers: { "Cache-Control": "public, max-age=120" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json(
      { error: "COTIZACION_ERROR", message: msg },
      { status: 502 }
    );
  }
}
