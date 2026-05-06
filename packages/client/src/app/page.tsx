import MainMenu from "./components/MainMenu";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <header className="mb-12 text-center">
          <h1 className="font-display text-5xl font-bold tracking-tight text-amber-400 drop-shadow-[0_2px_8px_rgba(0,0,0,.55)]">
            Bourbonomics
          </h1>
          <p className="mt-3 text-lg text-slate-300">
            A solo board game of bourbon barons, barrels, and brinkmanship.
          </p>
        </header>

        <MainMenu />
      </div>
    </main>
  );
}
