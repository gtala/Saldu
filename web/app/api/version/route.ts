import { getSheetRevision } from "@/lib/sheet-revision";

export const dynamic = "force-dynamic";

export async function GET() {
  const { revision, live } = await getSheetRevision();
  return Response.json(
    { version: revision, live },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
