import { NextResponse } from "next/server";
import {
  GAME_DOC_FILES,
  GAME_DOC_TITLES,
  isGameDocSlug,
  loadGameDoc,
  loadGameDocData,
  type GameDocSlug,
} from "@/lib/game-docs";

export const dynamic = "force-dynamic";

function docPayload(s: GameDocSlug, includeData: boolean) {
  const base = {
    slug: s,
    title: GAME_DOC_TITLES[s],
    filename: GAME_DOC_FILES[s],
    markdown: loadGameDoc(s),
  };
  if (!includeData) return base;
  return { ...base, data: loadGameDocData(s) };
}

/**
 * GET /api/game-docs — all docs as JSON: { docs: { [slug]: { title, markdown, ... } } }
 * GET /api/game-docs?slug=bourbon-cards — one doc
 * GET ?includeData=1 — add parsed `data` (YAML)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get("slug");
  const includeData = searchParams.get("includeData") === "1";

  if (slug) {
    if (!isGameDocSlug(slug)) {
      return NextResponse.json(
        { error: "Unknown slug", valid: Object.keys(GAME_DOC_FILES) },
        { status: 400 }
      );
    }
    const s = slug as GameDocSlug;
    return NextResponse.json(docPayload(s, includeData));
  }

  const slugs = Object.keys(GAME_DOC_FILES) as GameDocSlug[];
  const docs = Object.fromEntries(
    slugs.map((s) => [s, docPayload(s, includeData)])
  );

  return NextResponse.json({ docs });
}
