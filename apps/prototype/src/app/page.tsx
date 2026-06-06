import MainMenu from "./components/MainMenu";

export default function Home() {
  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <header className="mb-12 text-center">
          <h1 className="font-display text-5xl font-bold tracking-tight text-[var(--gold)] drop-shadow-[0_2px_8px_rgba(0,0,0,.55)]">
            Bourbonomics
          </h1>
          <p className="mt-3 text-lg text-[var(--ink-muted)]">
            A cozy engine-builder of barrels, brand lines, and patient demand.
          </p>
          <p className="mt-1 font-mono text-[12px] uppercase tracking-[.18em] text-[var(--mute)]">
            P2 · prototype · placeholder content
          </p>
        </header>

        <MainMenu />
      </div>
    </main>
  );
}
