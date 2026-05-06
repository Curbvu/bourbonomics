import Link from "next/link";
import NewGameForm from "@/app/components/NewGameForm";

export default function NewGamePage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <Link
          href="/"
          className="font-mono text-xs text-amber-400 hover:text-amber-300"
        >
          ← back to menu
        </Link>
        <header className="mt-4 mb-8">
          <h1 className="font-display text-4xl font-bold tracking-tight text-amber-400">
            New game
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Pick your seat, opponents, and seed. Bots play themselves.
          </p>
        </header>

        <NewGameForm />
      </div>
    </main>
  );
}
