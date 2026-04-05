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
      <h1 className="mb-4 text-2xl font-bold text-amber-900 dark:text-amber-100">
        Bourbonomics — design docs
      </h1>
      <p className="mb-2 text-amber-800 dark:text-amber-200">
        The app reads sources from{" "}
        <code className="rounded bg-amber-200/80 px-1 dark:bg-amber-800/80">docs/</code>{" "}
        (rules as Markdown; card catalogs as YAML rendered to Markdown). Edit those files to
        tune rules and cards; the rules UI and API load them on each request (no rebuild needed
        in development).
      </p>
      <ul className="mb-8 mt-6 space-y-2">
        {slugs.map((slug) => (
          <li key={slug}>
            <Link
              href={`/rules/${slug}`}
              className="font-medium text-amber-900 underline-offset-2 hover:underline dark:text-amber-100"
            >
              {GAME_DOC_TITLES[slug]}
            </Link>
            <span className="ml-2 text-sm text-amber-700 dark:text-amber-400">
              — docs/{GAME_DOC_FILES[slug]}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-sm text-amber-800 dark:text-amber-300">
        <strong>API:</strong>{" "}
        <code className="rounded bg-amber-200/80 px-1 dark:bg-amber-800/80">
          GET /api/game-docs
        </code>{" "}
        returns all documents;{" "}
        <code className="rounded bg-amber-200/80 px-1 dark:bg-amber-800/80">
          ?slug=operations-cards
        </code>{" "}
        returns one;{" "}
        <code className="rounded bg-amber-200/80 px-1 dark:bg-amber-800/80">
          ?includeData=1
        </code>{" "}
        adds parsed YAML <code className="rounded bg-amber-200/80 px-1 dark:bg-amber-800/80">data</code>{" "}
        for card slugs.
      </p>
    </div>
  );
}
