import fs from "node:fs";
import path from "node:path";

import MainMenu from "./components/MainMenu";
import RulesMarkdown from "./rules/RulesMarkdown";

export const dynamic = "force-static";

export default function Home() {
  // The canonical rulebook, read at build time (cwd is the prototype app
  // workspace, so two levels up lands on the repo root). Same source as /rules.
  const rulebook = fs.readFileSync(
    path.resolve(process.cwd(), "../../docs/GAME_RULES.md"),
    "utf8",
  );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <header className="mb-12 text-center">
          <h1 className="font-display text-5xl font-bold tracking-tight text-amber-400 drop-shadow-[0_2px_8px_rgba(0,0,0,.55)]">
            Bourbonomics
          </h1>
          <p className="mt-3 text-lg text-slate-300">
            A cozy game of bourbon barons, barrels, and brinkmanship — for 2–6.
          </p>
        </header>

        <MainMenu />

        {/* Detailed rules, inline. The menu's "Rules" tile jumps here; the
            dedicated /rules page renders the same content with a TOC. */}
        <section id="rules" className="mt-20 scroll-mt-6">
          <div className="mb-6 flex items-baseline justify-between gap-4 border-b border-[var(--rule)] pb-3">
            <h2 className="font-display text-3xl font-bold tracking-tight text-amber-400">
              Game Rules
            </h2>
            <a
              href="/rules"
              className="flex-shrink-0 font-mono text-[12px] uppercase tracking-[.16em] text-[var(--gold)] hover:text-[var(--amber-2)]"
            >
              Open full page →
            </a>
          </div>
          <div className="text-[15px] leading-relaxed">
            <RulesMarkdown markdown={rulebook} />
          </div>
        </section>
      </div>
    </main>
  );
}
