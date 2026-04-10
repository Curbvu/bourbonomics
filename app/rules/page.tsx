import Link from "next/link";
import {
  GAME_DOC_FILES,
  GAME_DOC_TITLES,
  listGameDocSlugs,
} from "@/lib/game-docs";

export const dynamic = "force-dynamic";

export default function RulesHubPage() {
  const slugs = listGameDocSlugs();
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-slate-900 dark:text-slate-100">
        Bourbonomics — design docs
      </h1>
      <p className="mb-2 text-slate-700 dark:text-slate-300">
        The app reads YAML card catalogs from{" "}
        <code className="rounded bg-slate-200/90 px-1 dark:bg-slate-800">docs/</code>{" "}
        and shows them as plain text (pipe tables and headings preserved). Edit those files to
        tune cards; the rules UI and API load them on each request (no rebuild needed in
        development). Full prose rules live in{" "}
        <code className="rounded bg-slate-200/90 px-1 dark:bg-slate-800">docs/GAME_RULES.md</code>{" "}
        in the repo only—not served by this app.
      </p>
      <ul className="mb-8 mt-6 space-y-2">
        {slugs.map((slug) => (
          <li key={slug}>
            <Link
              href={`/rules/${slug}`}
              className="font-medium text-indigo-800 underline-offset-2 hover:underline dark:text-indigo-200"
            >
              {GAME_DOC_TITLES[slug]}
            </Link>
            <span className="ml-2 text-sm text-slate-600 dark:text-slate-400">
              — docs/{GAME_DOC_FILES[slug]}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-sm text-slate-700 dark:text-slate-300">
        <strong>API:</strong>{" "}
        <code className="rounded bg-slate-200/90 px-1 dark:bg-slate-800">
          GET /api/game-docs
        </code>{" "}
        returns all documents;{" "}
        <code className="rounded bg-slate-200/90 px-1 dark:bg-slate-800">
          ?slug=operations-cards
        </code>{" "}
        returns one;{" "}
        <code className="rounded bg-slate-200/90 px-1 dark:bg-slate-800">
          ?includeData=1
        </code>{" "}
        adds parsed YAML <code className="rounded bg-slate-200/90 px-1 dark:bg-slate-800">data</code>{" "}
        for card slugs.
      </p>
    </div>
  );
}
