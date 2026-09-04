import { readIndex } from "@/lib/board";

export const dynamic = "force-static";

export async function GET() {
  const index = await readIndex();
  if (!index) return Response.json({ error: "No data published yet" }, { status: 404 });
  return Response.json(index, { headers: { "Cache-Control": "public, max-age=300" } });
}
