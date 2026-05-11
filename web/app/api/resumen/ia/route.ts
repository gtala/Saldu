import { auth } from "@/auth";
import { isMultiUserAuthEnabled } from "@/lib/auth-mode";
import type { ResumenStatsForApi } from "@/lib/resumen-stats";

export const maxDuration = 60;

const SYSTEM = `Sos un asistente financiero personal para un usuario en Argentina.
Recibís un JSON con totales de UN mes de gastos (ARS), categorías, heurística fijo/variable y comparación con el mes anterior si existe.
Escribí en español rioplatense, tono claro y breve (máx. ~350 palabras).
Incluí: (1) una frase de síntesis del mes, (2) qué categoría concentra más gasto y si conviene revisar algo, (3) el reparto fijo vs variable solo como orientación (es heurística por categoría, no bancaria), (4) hasta 3 ideas concretas de mejora o revisión, (5) si hay comparación con el mes previo, comentala sin alarmismo.
No inventés montos que no estén en el JSON. No des asesoramiento legal/impositivo.`;

export async function POST(req: Request) {
  const multi = isMultiUserAuthEnabled();
  const session = multi ? await auth() : null;
  if (multi && !session?.user?.id) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return Response.json(
      {
        error:
          "Falta OPENAI_API_KEY en el servidor (Vercel → Settings → Environment Variables).",
        code: "NO_OPENAI",
      },
      { status: 503 }
    );
  }

  let body: { stats?: ResumenStatsForApi };
  try {
    body = (await req.json()) as { stats?: ResumenStatsForApi };
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }
  const stats = body.stats;
  if (!stats || typeof stats !== "object" || !stats.monthName) {
    return Response.json({ error: "Falta stats.monthName" }, { status: 400 });
  }

  const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        max_tokens: 1200,
        messages: [
          { role: "system", content: SYSTEM },
          {
            role: "user",
            content: `Datos del mes (JSON):\n${JSON.stringify(stats, null, 2)}`,
          },
        ],
      }),
    });

    const raw = await r.text();
    if (!r.ok) {
      let msg = raw.slice(0, 400);
      try {
        const j = JSON.parse(raw) as { error?: { message?: string } };
        if (j.error?.message) msg = j.error.message;
      } catch {
        /* ignore */
      }
      return Response.json(
        { error: msg || `OpenAI HTTP ${r.status}`, code: "OPENAI_ERROR" },
        { status: 502 }
      );
    }

    const data = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text =
      data.choices?.[0]?.message?.content?.trim() || "Sin contenido en la respuesta.";
    return Response.json({ text, model });
  } catch (e: unknown) {
    const err = e as { message?: string };
    return Response.json(
      { error: err.message || "Error al llamar a OpenAI", code: "FETCH_FAIL" },
      { status: 502 }
    );
  }
}
