import Link from "next/link";
import NewGameForm from "./components/NewGameForm";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <header className="mb-10">
          <h1 className="font-display text-4xl font-bold tracking-tight text-amber-400">
            Bourbonomics
          </h1>
          <p className="mt-2 text-lg text-slate-300">
            A solo board game of bourbon barons, barrels, and brinkmanship.
          </p>
          <p className="mt-4 text-sm text-slate-500">
            Watch heuristic bots play a full game in your browser. See{" "}
            <Link href="/rules" className="text-amber-400 hover:text-amber-300">
              the rules
            </Link>{" "}
            for gameplay details, or browse the{" "}
            <Link
              href="/mash-bills"
              className="text-amber-400 hover:text-amber-300"
            >
              Bourbon Cards
            </Link>{" "}
            gallery for every recipe in the supply.
          </p>
        </header>

        <Link
          href="/mash-bills"
          className="mb-6 block rounded-lg border border-amber-700/50 bg-amber-900/20 px-5 py-4 transition-colors hover:border-amber-500 hover:bg-amber-900/30"
        >
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold text-amber-200">
                Bourbon Cards
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Browse every mash bill — recipes, payoff grids, and tier
                breakdowns.
              </p>
            </div>
            <span className="font-mono text-xl text-amber-400">→</span>
          </div>
        </Link>

        <NewGameForm />
      </div>
    </main>
  );
}
