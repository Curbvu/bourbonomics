"use client";

// Bourbonomics — landing home screen. A menu of options in the oak/bourbon
// aesthetic. "Play" opens the territory game (/mapgame); the Field Guide opens
// the in-game manual overlay in place.

import Link from "next/link";
import { type CSSProperties, useEffect, useMemo, useState } from "react";
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
        background: `radial-gradient(135% 115% at 50% 8%, #3a2c1c 0%, #241a10 46%, #14100a 100%)`,
        color: T.cream,
        fontFamily: "var(--font-inter), system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "clamp(40px, 8vh, 96px) 20px 64px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <Ambience />

      {/* paper grain */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
          opacity: 0.35,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E\")",
        }}
      />
      <header style={{ textAlign: "center", position: "relative", zIndex: 2, marginBottom: "clamp(28px, 5vh, 52px)" }}>
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

      <nav style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: 660, display: "flex", flexDirection: "column", gap: 12 }}>
        {tiles.map((t, i) => (
          <MenuTile key={t.title} tile={t} primary={i === 0} />
        ))}
      </nav>

      <footer style={{ position: "relative", zIndex: 2, marginTop: 40, fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, color: T.faint, textTransform: "uppercase" }}>
        Bourbonomics · pre-balance playtest
      </footer>

      {manual && <Manual onClose={() => setManual(false)} />}
    </main>
  );
}

// ── Ambient background — drifting warm light pools + slowly rising "angel's
// share" embers (evaporating bourbon vapor). Subtle, low-opacity, and disabled
// under prefers-reduced-motion. Lives behind all content (zIndex 0).
function Ambience() {
  // Purely decorative — mount client-side only so the randomized ember field
  // never has to reconcile against server-rendered HTML (Math.sin differs by a
  // ULP between Node and the browser, which trips React's hydration check).
  const [shown, setShown] = useState(false);
  useEffect(() => setShown(true), []);

  const embers = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => {
        const r = (n: number) => {
          // cheap seeded-ish jitter so the field looks scattered, not gridded
          const x = Math.sin((i + 1) * (n * 12.9898)) * 43758.5453;
          return x - Math.floor(x);
        };
        const size = 2 + r(1) * 4;
        return {
          left: r(2) * 100,
          size,
          dur: 14 + r(3) * 16,
          delay: -r(4) * 30,
          dx: (r(5) - 0.5) * 120,
          op: 0.18 + r(6) * 0.4,
          gold: r(7) > 0.35,
        };
      }),
    [],
  );

  return (
    <div
      aria-hidden
      className="bb-amb"
      style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}
    >
      <style>{`
        @keyframes bbGlowA { 0%,100%{transform:translate(-6%,-4%) scale(1)} 50%{transform:translate(7%,9%) scale(1.28)} }
        @keyframes bbGlowB { 0%,100%{transform:translate(9%,3%) scale(1.18)} 50%{transform:translate(-7%,-9%) scale(1)} }
        @keyframes bbGlowC { 0%,100%{transform:translate(0,8%) scale(1.1);opacity:.45} 50%{transform:translate(-4%,-5%) scale(1.34);opacity:.75} }
        @keyframes bbRise {
          0%   { transform: translateY(30px) translateX(0) scale(1); opacity: 0; }
          12%  { opacity: var(--o); }
          85%  { opacity: var(--o); }
          100% { transform: translateY(-108vh) translateX(var(--dx)) scale(.35); opacity: 0; }
        }
        .bb-glow { position:absolute; border-radius:50%; filter:blur(64px); will-change:transform; }
        .bb-ember { position:absolute; bottom:-12px; border-radius:50%; will-change:transform,opacity;
                    animation:bbRise var(--dur) linear var(--delay) infinite; }
        @media (prefers-reduced-motion: reduce) {
          .bb-amb .bb-glow, .bb-amb .bb-ember { animation:none !important; }
          .bb-amb .bb-ember { display:none; }
        }
      `}</style>

      {/* drifting warm light pools */}
      <div
        className="bb-glow"
        style={{
          top: "-14%", left: "6%", width: 640, height: 640,
          background: "radial-gradient(circle, rgba(214,164,74,0.30), rgba(214,164,74,0) 68%)",
          animation: "bbGlowA 26s ease-in-out infinite",
        }}
      />
      <div
        className="bb-glow"
        style={{
          bottom: "-18%", right: "2%", width: 720, height: 720,
          background: "radial-gradient(circle, rgba(168,92,46,0.24), rgba(168,92,46,0) 70%)",
          animation: "bbGlowB 34s ease-in-out infinite",
        }}
      />
      <div
        className="bb-glow"
        style={{
          top: "34%", left: "44%", width: 520, height: 520,
          background: "radial-gradient(circle, rgba(240,214,150,0.20), rgba(240,214,150,0) 66%)",
          animation: "bbGlowC 22s ease-in-out infinite",
        }}
      />

      {/* rising embers / angel's share (client-only to avoid hydration drift) */}
      {shown && embers.map((e, i) => (
        <span
          key={i}
          className="bb-ember"
          style={
            {
              left: `${e.left}%`,
              width: e.size,
              height: e.size,
              background: e.gold ? "#e8c877" : "#d68b46",
              boxShadow: `0 0 ${e.size * 2.4}px ${e.size * 0.8}px ${e.gold ? "rgba(232,200,119,0.55)" : "rgba(214,139,70,0.5)"}`,
              "--dur": `${e.dur}s`,
              "--delay": `${e.delay}s`,
              "--dx": `${e.dx}px`,
              "--o": e.op,
            } as CSSProperties
          }
        />
      ))}
    </div>
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
