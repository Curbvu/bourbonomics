import { notFound } from "next/navigation";
import {
  GAME_DOC_FILES,
  GAME_DOC_TITLES,
  isGameDocSlug,
  loadGameDoc,
  type GameDocSlug,
} from "@/lib/game-docs";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ doc: string }>;
};

export async function generateMetadata({ params }: PageProps) {
  const { doc } = await params;
  if (!isGameDocSlug(doc)) return { title: "Rules" };
  return { title: `${GAME_DOC_TITLES[doc as GameDocSlug]} — Bourbonomics` };
}

export default async function RulesDocPage({ params }: PageProps) {
  const { doc } = await params;
  if (!isGameDocSlug(doc)) notFound();
  const slug = doc as GameDocSlug;
  const content = loadGameDoc(slug);

  return (
    <div>
      <p className="mb-6 text-sm text-amber-800 dark:text-amber-200">
        Source:{" "}
        <code className="rounded bg-amber-200/80 px-1 dark:bg-amber-800/80">
          docs/{GAME_DOC_FILES[slug]}
        </code>
        . Edits apply on the next request (
        <code className="rounded bg-amber-200/80 px-1 dark:bg-amber-800/80">
          dynamic
        </code>
        ).
      </p>
      <article className="max-w-none whitespace-pre-wrap wrap-break-word font-mono text-xs leading-relaxed text-slate-900 dark:text-slate-100 sm:text-sm">
        {content}
      </article>
    </div>
  );
}
