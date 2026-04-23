import Link from "next/link";
import NewGameForm from "./components/NewGameForm";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <header className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight text-amber-400">
            Bourbonomics
          </h1>
          <p className="mt-2 text-lg text-slate-300">
            A solo board game of bourbon barons, barrels, and brinkmanship.
          </p>
          <p className="mt-4 text-sm text-slate-500">
            Play against 1–5 computer opponents in Kentucky Straight mode.
            See <Link href="/rules" className="text-amber-400 hover:text-amber-300">the rules</Link>
            {" "}for gameplay details.
          </p>
        </header>

        <NewGameForm />
      </div>
    </main>
  );
}
