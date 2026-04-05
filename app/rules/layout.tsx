import Link from "next/link";
import { GAME_DOC_TITLES, listGameDocSlugs } from "@/lib/game-docs";

export default function RulesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const slugs = listGameDocSlugs();
  return (
    <div className="min-h-screen bg-amber-50 dark:bg-amber-950/20">
      <nav className="sticky top-0 z-10 border-b border-amber-200 bg-amber-100/90 px-4 py-3 backdrop-blur dark:border-amber-800 dark:bg-amber-900/50">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2">
          <Link
            href="/rules"
            className="font-semibold text-amber-900 dark:text-amber-100"
          >
            Rules hub
          </Link>
          <span className="hidden text-amber-600 sm:inline" aria-hidden>
            |
          </span>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {slugs.map((slug) => (
              <Link
                key={slug}
                href={`/rules/${slug}`}
                className="text-amber-800 underline-offset-2 hover:text-amber-950 hover:underline dark:text-amber-200 dark:hover:text-amber-50"
              >
                {GAME_DOC_TITLES[slug]}
              </Link>
            ))}
          </div>
          <Link
            href="/"
            className="ml-auto text-sm text-amber-700 hover:underline dark:text-amber-300"
          >
            Lobby
          </Link>
        </div>
      </nav>
      <div className="mx-auto max-w-5xl px-4 py-8">{children}</div>
    </div>
  );
}
