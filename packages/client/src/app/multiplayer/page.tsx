import Link from "next/link";

import MultiplayerLobby from "./MultiplayerLobby";

export default function MultiplayerPage() {
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
          <h1 className="font-display text-4xl font-bold tracking-tight text-rose-400">
            Multiplayer
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Mint a 4-character room code or join an existing one. Bots fill
            empty seats and the server runs their turns automatically.
          </p>
        </header>

        <MultiplayerLobby />
      </div>
    </main>
  );
}
