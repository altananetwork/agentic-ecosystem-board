import { knownSlugs, readBoard } from "@/lib/board";

export const dynamic = "force-static";
export const dynamicParams = false;

export async function generateStaticParams() {
  const slugs = await knownSlugs();
  return slugs.map((chain) => ({ chain }));
}

export async function GET(_req: Request, { params }: { params: Promise<{ chain: string }> }) {
  const { chain } = await params;
  const board = await readBoard(chain);
  if (!board) return Response.json({ error: "Unknown chain or no data published yet" }, { status: 404 });
  return Response.json(board, { headers: { "Cache-Control": "public, max-age=300" } });
}
