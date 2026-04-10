import Link from "next/link";
import { GAME_DOC_TITLES, listGameDocSlugs } from "@/lib/game-docs";

export default function RulesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const slugs = listGameDocSlugs();
  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <nav className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2">
          <Link
            href="/rules"
            className="font-semibold text-slate-900 dark:text-slate-100"
          >
            Rules hub
          </Link>
          <span className="hidden text-slate-400 sm:inline" aria-hidden>
            |
          </span>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {slugs.map((slug) => (
              <Link
                key={slug}
                href={`/rules/${slug}`}
                className="text-indigo-700 underline-offset-2 hover:text-indigo-900 hover:underline dark:text-indigo-300 dark:hover:text-indigo-100"
              >
                {GAME_DOC_TITLES[slug]}
              </Link>
            ))}
          </div>
          <Link
            href="/"
            className="ml-auto text-sm text-slate-600 hover:underline dark:text-slate-300"
          >
            Lobby
          </Link>
        </div>
      </nav>
      <div className="mx-auto max-w-5xl px-4 py-8">{children}</div>
    </div>
  );
}
