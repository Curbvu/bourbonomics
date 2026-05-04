import Link from "next/link";

export default function RulesPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link href="/" className="font-mono text-xs text-amber-400 hover:text-amber-300">
          ← back to menu
        </Link>
        <h1 className="mt-4 font-display text-4xl font-bold tracking-tight text-amber-400">
          Rules
        </h1>
        <p className="mt-3 text-sm text-slate-400">
          The full rulebook lives in{" "}
          <code className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-xs text-amber-200">
            docs/GAME_RULES.md
          </code>{" "}
          in the repo. A nicer in-app rules viewer is on the roadmap.
        </p>
      </div>
    </main>
  );
}
