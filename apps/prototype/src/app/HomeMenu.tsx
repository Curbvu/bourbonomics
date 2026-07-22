"use client";

// Bourbonomics — landing home screen. A menu of options in the oak/bourbon
// aesthetic. "Play" opens the territory game (/mapgame); the Field Guide opens
// the in-game manual overlay in place.

import Link from "next/link";
import { useState } from "react";
import Manual from "../mapgame/ui/Manual";
import { MONO, SERIF, T } from "../mapgame/ui/theme";

type Tile = {
  eyebrow: string;
  title: string;
  subtitle: string;
  accent: string;
  href?: string;
  onClick?: () => void;
};

export default function HomeMenu() {
  const [manual, setManual] = useState(false);

  const tiles: Tile[] = [
    {
      eyebrow: "Single player · vs bots",
      title: "Play Bourbonomics",
      subtitle:
        "The territory game. Build the board, stake niches, distill bourbons, and Push for the tiles that pay. Strategic bots fill the empty seats.",
      accent: T.gold,
      href: "/mapgame",
    },
    {
      eyebrow: "Online · 2–5 players",
      title: "Play Together",
      subtitle:
        "Create a table, share the code, and play live over the web. Add bots to fill empty seats; the server keeps everyone in sync.",
      accent: "#4a8a72",
      href: "/online",
    },
    {
      eyebrow: "Player aid",
      title: "The Distiller's Field Guide",
      subtitle:
        "The illustrated manual — every action, tile, and the Push, laid out slot-for-slot. Read before your first game.",
      accent: T.copper,
      onClick: () => setManual(true),
    },
    {
      eyebrow: "Reference",
      title: "The Rulebook",
      subtitle: "The full written rules — the round, the market, combat, and scoring.",
      accent: "#7a8c3a",
      href: "/rules",
    },
    {
      eyebrow: "Catalog",
      title: "Bourbon Wiki",
      subtitle: "Browse every bourbon, tile, and reward token in the box.",
      accent: "#3a6a8b",
      href: "/wiki",
    },
    {
      eyebrow: "Archive · v1",
      title: "The Classic Deckbuilder",
      subtitle: "The original Bourbonomics prototype — drafting, aging, and the demand market.",
      accent: "#8a5a2b",
      href: "/play",
    },
  ];

  return (
    <main
      style={{
        minHeight: "100vh",
        background: `radial-gradient(120% 100% at 50% 20%, #2a2016, ${T.oak} 60%, ${T.feltDeep})`,
        color: T.cream,
        fontFamily: "var(--font-inter), system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "clamp(40px, 8vh, 96px) 20px 64px",
        position: "relative",
      }}
    >
      {/* paper grain */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.4,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E\")",
        }}
      />
      <header style={{ textAlign: "center", position: "relative", marginBottom: "clamp(28px, 5vh, 52px)" }}>
        <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: 6, color: T.goldSoft, textTransform: "uppercase", marginBottom: 8 }}>
          The Territory Game
        </div>
        <h1 style={{ fontFamily: SERIF, fontSize: "clamp(56px, 11vw, 104px)", fontWeight: 800, letterSpacing: -2, color: T.gold, lineHeight: 0.92, textShadow: "0 3px 16px #0009", margin: 0 }}>
          Bourbonomics
        </h1>
        <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "clamp(16px, 2.6vw, 22px)", color: T.muted, marginTop: 12 }}>
          A game of demand, distribution &amp; the angel&apos;s share.
        </p>
      </header>

      <nav style={{ position: "relative", width: "100%", maxWidth: 660, display: "flex", flexDirection: "column", gap: 12 }}>
        {tiles.map((t, i) => (
          <MenuTile key={t.title} tile={t} primary={i === 0} />
        ))}
      </nav>

      <footer style={{ position: "relative", marginTop: 40, fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, color: T.faint, textTransform: "uppercase" }}>
        Bourbonomics · pre-balance playtest
      </footer>

      {manual && <Manual onClose={() => setManual(false)} />}
    </main>
  );
}

function MenuTile({ tile, primary }: { tile: Tile; primary: boolean }) {
  const inner = (
    <div
      className="bb-tile"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        borderRadius: 12,
        border: `1px solid ${tile.accent}55`,
        borderLeft: `4px solid ${tile.accent}`,
        background: primary ? `linear-gradient(100deg, ${tile.accent}1f, ${T.panel})` : T.panel,
        padding: "18px 22px",
        cursor: "pointer",
        transition: "background 120ms, transform 120ms",
        boxShadow: primary ? `0 6px 20px ${tile.accent}22` : "0 2px 8px #0005",
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: tile.accent }}>
          {tile.eyebrow}
        </div>
        <h2 style={{ fontFamily: SERIF, fontSize: primary ? 30 : 24, fontWeight: 700, color: T.cream, margin: "4px 0 4px" }}>
          {tile.title}
        </h2>
        <p style={{ fontSize: 14, lineHeight: 1.5, color: T.muted, margin: 0 }}>{tile.subtitle}</p>
      </div>
      <span style={{ flexShrink: 0, fontFamily: SERIF, fontSize: 34, color: tile.accent }}>→</span>
    </div>
  );

  if (tile.href) {
    return (
      <Link href={tile.href} style={{ textDecoration: "none" }}>
        {inner}
      </Link>
    );
  }
  return (
    <button onClick={tile.onClick} style={{ textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
      {inner}
    </button>
  );
}
