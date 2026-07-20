"use client";

// Bourbonomics: Map Game — "The Distiller's Field Guide".
//
// An in-game manual, re-typeset from the printed field guide into crisp HTML +
// SVG (hexes, pawns, flags, suit chips, reward coins redrawn as vectors). It is
// full-viewport chrome OUTSIDE the fixed 1920×1080 canvas — the one place the
// game is allowed to scroll (like /rules). Committed to the parchment look in
// both themes: it's a physical field guide.

import { useEffect, useRef, useState } from "react";

// ── palette ──────────────────────────────────────────────────────────
const P = {
  bg: "#efe6cd",
  bg2: "#e9ddbe",
  ink: "#2c2216",
  body: "#4a3c28",
  muted: "#9a8664",
  faint: "#b3a37e",
  cardLight: "#f6efdd",
  cardMid: "#eadfc1",
  line: "#d9cba6",
  brown: "#7a4a26",
  brownDeep: "#6b4526",
  gold: "#b8912e",
  red: "#9c3a2e",
  green: "#5a7a3a",
  teal: "#3a6a7a",
  purple: "#6a4a8a",
};
const SERIF = "var(--font-cormorant), Georgia, 'Times New Roman', serif";
const SANS = "var(--font-inter), system-ui, sans-serif";
const MONO = "var(--font-jb), ui-monospace, monospace";

type SuitKey = "DIST" | "SALES" | "MKTG" | "BIZ" | "SRC" | "DSTL";
const SUIT: Record<SuitKey, { label: string; color: string }> = {
  DIST: { label: "Distribution", color: P.brown },
  SALES: { label: "Sales", color: P.red },
  MKTG: { label: "Marketing", color: P.gold },
  BIZ: { label: "Business Dev", color: P.green },
  SRC: { label: "Sourcing", color: P.teal },
  DSTL: { label: "Distill", color: P.purple },
};

// ── root ─────────────────────────────────────────────────────────────
export default function Manual({ onClose }: { onClose: () => void }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [prog, setProg] = useState(0);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    setProg(max > 0 ? el.scrollTop / max : 0);
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: P.bg, color: P.ink, fontFamily: SANS }}>
      {/* subtle paper grain */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.5,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.035'/%3E%3C/svg%3E\")",
        }}
      />
      {/* top bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 clamp(16px, 4vw, 48px)",
          background: `${P.bg}f2`,
          borderBottom: `1px solid ${P.line}`,
          backdropFilter: "blur(4px)",
          zIndex: 2,
        }}
      >
        <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 2, color: P.brown, textTransform: "uppercase" }}>
          The Distiller's Field Guide
        </span>
        <button
          onClick={onClose}
          style={{
            fontFamily: MONO,
            fontSize: 12,
            letterSpacing: 1,
            color: P.brown,
            background: "transparent",
            border: `1px solid ${P.brown}`,
            borderRadius: 8,
            padding: "6px 14px",
            cursor: "pointer",
          }}
        >
          CLOSE ✕
        </button>
      </div>
      {/* reading progress */}
      <div style={{ position: "absolute", top: 56, left: 0, right: 0, height: 2, background: P.line, zIndex: 2 }}>
        <div style={{ height: "100%", width: `${prog * 100}%`, background: P.brown, transition: "width 80ms linear" }} />
      </div>

      <div
        ref={scroller}
        onScroll={onScroll}
        style={{ position: "absolute", inset: "58px 0 0 0", overflowY: "auto", overflowX: "hidden" }}
      >
        <article style={{ maxWidth: 920, margin: "0 auto", padding: "clamp(28px, 5vw, 64px) clamp(18px, 5vw, 40px) 120px" }}>
          <Cover />
          <SectionStart />
          <SectionRound />
          <SectionActions />
          <SectionFloor />
          <SectionHouse />
          <SectionQuick />
          <footer style={{ marginTop: 56, paddingTop: 18, borderTop: `1px solid ${P.line}`, display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, color: P.faint, textTransform: "uppercase" }}>
            <span>Bourbonomics</span>
            <span>The Distiller's Field Guide</span>
          </footer>
        </article>
      </div>
    </div>
  );
}

// ── shared primitives ────────────────────────────────────────────────
function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 3, color: P.muted, textTransform: "uppercase", marginBottom: 10 }}>
      {children}
    </div>
  );
}

function SectionHead({ n, title }: { n: string; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "56px 0 18px" }}>
      <span
        style={{
          fontFamily: MONO,
          fontSize: 11,
          letterSpacing: 2,
          color: P.bg,
          background: P.brownDeep,
          borderRadius: 6,
          padding: "5px 8px",
        }}
      >
        {n}
      </span>
      <h2 style={{ fontFamily: SERIF, fontWeight: 700, fontSize: "clamp(28px, 4.5vw, 40px)", color: P.ink, margin: 0, lineHeight: 1 }}>
        {title}
      </h2>
      <span style={{ flex: 1, height: 1, background: P.line }} />
    </div>
  );
}

function Lede({ children }: { children: React.ReactNode }) {
  return <p style={{ fontFamily: SANS, fontSize: 16, lineHeight: 1.6, color: P.body, margin: "0 0 20px" }}>{children}</p>;
}

function Callout({ tone = "gold", label, children }: { tone?: "gold" | "red" | "green" | "brown"; label?: string; children: React.ReactNode }) {
  const c = { gold: P.gold, red: P.red, green: P.green, brown: P.brown }[tone];
  return (
    <div style={{ background: P.cardLight, border: `1px solid ${P.line}`, borderLeft: `4px solid ${c}`, borderRadius: 12, padding: "16px 20px", margin: "8px 0 20px" }}>
      {label && <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: c, textTransform: "uppercase", marginBottom: 8 }}>{label}</div>}
      <div style={{ fontFamily: SANS, fontSize: 15.5, lineHeight: 1.6, color: P.body }}>{children}</div>
    </div>
  );
}

function B({ children }: { children: React.ReactNode }) {
  return <strong style={{ color: P.ink, fontWeight: 700 }}>{children}</strong>;
}
function R({ children }: { children: React.ReactNode }) {
  return <strong style={{ color: P.red, fontWeight: 700 }}>{children}</strong>;
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background: P.cardLight, border: `1px solid ${P.line}`, borderRadius: 14, padding: 18, ...style }}>{children}</div>;
}

function SuitChip({ k, showLabel = false }: { k: SuitKey; showLabel?: boolean }) {
  const s = SUIT[k];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: 1, color: s.color, background: `${s.color}18`, border: `1px solid ${s.color}55`, borderRadius: 999, padding: "3px 9px" }}>
      <span style={{ width: 7, height: 7, borderRadius: 999, background: s.color }} />
      {k}
      {showLabel && <span style={{ color: P.muted, fontWeight: 400, letterSpacing: 0 }}>{s.label}</span>}
    </span>
  );
}

// ── diagram atoms ────────────────────────────────────────────────────
function Hex({ size = 34, fill = "none", stroke = P.gold, sw = 2, label, labelColor = P.brown, cx = 0, cy = 0 }: { size?: number; fill?: string; stroke?: string; sw?: number; label?: string; labelColor?: string; cx?: number; cy?: number }) {
  // pointy-top hexagon
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 90);
    return `${(cx + size * Math.cos(a)).toFixed(1)},${(cy + size * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
  return (
    <g>
      <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
      {label && <text x={cx} y={cy + 3} textAnchor="middle" fontFamily={MONO} fontSize={9} fontWeight={700} fill={labelColor}>{label}</text>}
    </g>
  );
}

function Pawn({ x, y, color = P.brown, dark = false }: { x: number; y: number; color?: string; dark?: boolean }) {
  // simple pawn silhouette; dark = tipped on its side + desaturated
  return (
    <g transform={`translate(${x} ${y}) ${dark ? "rotate(72)" : ""}`} opacity={dark ? 0.55 : 1}>
      <circle cx={0} cy={-9} r={5} fill={dark ? P.faint : color} />
      <path d="M -6 8 Q -6 -2 0 -3 Q 6 -2 6 8 Z" fill={dark ? P.faint : color} />
      <rect x={-8} y={8} width={16} height={3} rx={1.5} fill={dark ? P.faint : color} />
    </g>
  );
}

function Flag({ x, y, color = P.red }: { x: number; y: number; color?: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-1} y={-16} width={2} height={22} fill={color} />
      <path d="M 1 -16 L 14 -12 L 1 -8 Z" fill={color} />
    </g>
  );
}

function Coin({ top, label, color = P.gold }: { top: string; label: string; color?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, width: 58 }}>
      <div style={{ width: 30, height: 30, borderRadius: 999, background: color, color: "#fff", display: "grid", placeItems: "center", fontFamily: SERIF, fontWeight: 700, fontSize: 15, boxShadow: "inset 0 -2px 3px rgba(0,0,0,.2)" }}>{top}</div>
      <div style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: 0.5, color: P.muted, textAlign: "center", lineHeight: 1.2 }}>{label}</div>
    </div>
  );
}

// ── COVER ────────────────────────────────────────────────────────────
function Cover() {
  return (
    <header>
      <Kicker>Player Aid · The Distiller's Field Guide</Kicker>
      <h1 style={{ fontFamily: SERIF, fontWeight: 800, fontSize: "clamp(52px, 12vw, 104px)", color: P.ink, margin: "0 0 4px", lineHeight: 0.92, letterSpacing: -1 }}>
        Bourbonomics
      </h1>
      <div style={{ height: 2, background: P.line, margin: "10px 0 12px" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
        <p style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: "clamp(18px, 3vw, 24px)", color: P.body, margin: 0 }}>
          A game of demand, distribution &amp; the angel&apos;s share.
        </p>
        <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 2, color: P.gold, textTransform: "uppercase" }}>Quick Reference</span>
      </div>
    </header>
  );
}

// ── 01 START ─────────────────────────────────────────────────────────
function SectionStart() {
  const steps: [string, React.ReactNode][] = [
    ["Seed the board.", <>Place <B>3 tiles in a line</B> in the center.</>],
    ["Deal setup tiles.", <>Give each player <B>5 tiles</B>. In turn order, each player places one tile at a time onto the board. <B>Every tile must touch at least 2 existing tiles.</B> Continue until all setup tiles are placed.</>],
    ["Prepare the Market.", <>Shuffle the bourbon deck; lay out a face-up pool of <B>PLAYERS + 1</B> bourbons.</>],
    ["The opening draft (snake order).", <>Going around the table and then back (<code style={mono()}>1-2-3-3-2-1…</code>), each player takes a turn. On each turn, do <B>ONE</B> of the two options below. Each player does this <B>4 times</B> total.</>],
    ["First player.", <>Whoever drafted <B>last in the very first snake round</B> takes the first action of the game.</>],
  ];
  return (
    <section>
      <SectionHead n="01" title="How to start a game" />
      <Callout tone="gold" label="The goal & the board">
        Serve the market — a board of consumer-demand tiles. Place <B>Distribution Points (DPs)</B>, flag <B>niches</B>, and <B>Push</B> for the segments that pay. <R>Most Capital after 5 ages wins.</R>
      </Callout>
      <Kicker>Setup steps</Kicker>
      <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 18 }}>
        {steps.map(([h, body], i) => (
          <li key={i} style={{ display: "flex", gap: 16 }}>
            <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 30, color: P.gold, lineHeight: 1, width: 26, textAlign: "right", flexShrink: 0 }}>{i + 1}</span>
            <div style={{ fontFamily: SANS, fontSize: 15.5, lineHeight: 1.6, color: P.body }}>
              <B>{h}</B> {body}
              {i === 3 && <DraftTable />}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function DraftTable() {
  return (
    <div style={{ marginTop: 12, border: `1px solid ${P.line}`, borderRadius: 10, overflow: "hidden" }}>
      <div style={{ display: "grid", gridTemplateColumns: "170px 1fr", background: P.cardMid, fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, color: P.muted, textTransform: "uppercase", padding: "8px 14px" }}>
        <span>Option</span>
        <span>What you do</span>
      </div>
      {[
        ["Draft a bourbon", "Take 1 bourbon from the face-up pool. Refill the pool back to PLAYERS+1."],
        ["Place a DP", "Put 1 Distribution Point (live) on any tile."],
      ].map(([a, b], i) => (
        <div key={i} style={{ display: "grid", gridTemplateColumns: "170px 1fr", padding: "10px 14px", borderTop: `1px solid ${P.line}`, background: P.cardLight }}>
          <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 16, color: P.ink }}>{a}</span>
          <span style={{ fontSize: 14, color: P.body }}>{b}</span>
        </div>
      ))}
    </div>
  );
}

// ── 02 ROUND ─────────────────────────────────────────────────────────
function SectionRound() {
  const ages = ["Frontier", "Bottled-in-Bond", "Repeal", "Revival", "Bourbon Boom"];
  const roman = ["I", "II", "III", "IV", "V"];
  const rows: [string, React.ReactNode][] = [
    ["Age start", <>Each player is dealt <B>5 action cards</B> — one for each round of the age.</>],
    ["Each round", <>Every player plays <B>one action card</B>, taking its actions. You may also spend a <B>token</B> for a bonus action of that suit.</>],
    ["Age end", <>After all 5 rounds, the <B>board is scored</B> — niches pay out and controlled tiles earn Capital.</>],
  ];
  return (
    <section>
      <SectionHead n="02" title="The round, in brief" />
      <Lede><B>5 ages, 5 rounds each.</B> The age is the scoring window.</Lede>
      <div style={{ border: `1px solid ${P.line}`, borderRadius: 12, overflow: "hidden", marginBottom: 26 }}>
        <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", background: P.cardMid, fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, color: P.muted, textTransform: "uppercase", padding: "9px 16px" }}>
          <span>Phase</span><span>What happens</span>
        </div>
        {rows.map(([h, b], i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "150px 1fr", padding: "12px 16px", borderTop: `1px solid ${P.line}`, background: P.cardLight }}>
            <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 17, color: P.brown }}>{h}</span>
            <span style={{ fontSize: 14.5, lineHeight: 1.55, color: P.body }}>{b}</span>
          </div>
        ))}
      </div>
      <Kicker>The 5 ages — the scoring windows</Kicker>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
        {ages.map((a, i) => (
          <div key={a} style={{ background: P.cardMid, border: `1px solid ${P.line}`, borderRadius: 12, textAlign: "center", padding: "14px 8px" }}>
            <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 26, color: P.gold }}>{roman[i]}</div>
            <div style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 15, color: P.ink }}>{a}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── 03 ACTIONS ───────────────────────────────────────────────────────
function SectionActions() {
  const actions: [string, SuitKey[], React.ReactNode][] = [
    ["Build DP", ["DIST", "BIZ", "SRC"], <>Place a DP — <B>live</B> on yours / empty, <B>dark</B> on a rival&apos;s.</>],
    ["Repair DP", ["DIST", "SRC"], <>Stand a dark DP back up to live.</>],
    ["Push", ["SALES"], <>Fight for a tile — bourbons in, rival DPs out.</>],
    ["Add niche flag", ["SALES", "MKTG"], <>Claim a tile into your niche.</>],
    ["Remove niche flag", ["MKTG"], <>Take back one of your own flags.</>],
    ["Expand Market", ["MKTG", "BIZ"], <>Draw a tile, or place your held tile (2+ adjacency).</>],
    ["Bid", ["SRC", "DSTL"], <>Put a marker on a Market bourbon lot.</>],
    ["Refresh", ["DSTL"], <>Return one depleted bourbon to fresh.</>],
  ];
  return (
    <section>
      <SectionHead n="03" title="The actions & their suits" />
      <Lede>Your action card&apos;s <B>suit</B> decides which of these you may take — mix freely up to its pips.</Lede>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
        {(Object.keys(SUIT) as SuitKey[]).map((k) => <SuitChip key={k} k={k} showLabel />)}
      </div>
      <div style={{ border: `1px solid ${P.line}`, borderRadius: 14, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "160px 190px 1fr", background: P.brownDeep, color: P.bg, fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", padding: "10px 16px" }}>
          <span>Action</span><span>Suits that can</span><span>What it does</span>
        </div>
        {actions.map(([name, suits, desc], i) => (
          <div key={name} style={{ display: "grid", gridTemplateColumns: "160px 190px 1fr", gap: 8, alignItems: "center", padding: "12px 16px", borderTop: `1px solid ${P.line}`, background: i % 2 ? P.cardMid : P.cardLight, borderLeft: `4px solid ${SUIT[suits[0]!].color}` }}>
            <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 18, color: P.ink }}>{name}</span>
            <span style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>{suits.map((s) => <SuitChip key={s} k={s} />)}</span>
            <span style={{ fontSize: 14.5, color: P.body }}>{desc}</span>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16 }}>
        <Callout tone="brown">
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            <span style={{ color: P.purple, fontSize: 18 }}>▼</span>
            <span><B>The face-down card.</B> A face-down card = <B>1 action, any house, no rank.</B> Always in your back pocket.</span>
          </span>
        </Callout>
      </div>
    </section>
  );
}

// ── 04 ON THE FLOOR ──────────────────────────────────────────────────
function SectionFloor() {
  return (
    <section>
      <SectionHead n="04" title="On the floor" />
      <Lede>Every action, in the order you&apos;ll usually think about them: grow the board, wire it for distribution, stake your niches, distill for the Market, then fight for what pays.</Lede>

      <SubHead color={P.green} title="Grow the board" tag="Marketing · Business Dev" />
      <Card>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
          <h4 style={h4()}>Expand Market</h4>
          <Pill>1 pip each</Pill>
        </div>
        <p style={pStyle()}>Draw a tile <B>OR</B> place your held tile (hold <B>max 1</B>). Tiles are hexagons — a newly placed tile must sit against <B>2 or more</B> existing tiles.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <MiniPanel ok caption="touches 2 tiles → place it">
            <svg viewBox="0 0 200 120" width="100%" height="110">
              <Hex cx={70} cy={44} stroke={P.gold} />
              <Hex cx={100} cy={44} stroke={P.gold} />
              <Hex cx={130} cy={44} stroke={P.gold} />
              <Hex cx={100} cy={76} fill={`${P.green}33`} stroke={P.green} label="NEW" labelColor={P.green} />
            </svg>
          </MiniPanel>
          <MiniPanel caption="touches only 1 tile">
            <svg viewBox="0 0 200 120" width="100%" height="110">
              <Hex cx={60} cy={44} stroke={P.gold} />
              <Hex cx={90} cy={44} stroke={P.gold} />
              <Hex cx={120} cy={44} stroke={P.gold} />
              <Hex cx={150} cy={76} fill={`${P.red}22`} stroke={P.red} label="NEW" labelColor={P.red} />
            </svg>
          </MiniPanel>
        </div>
      </Card>

      <SubHead color={P.brown} title="Distribution points — how you control tiles" tag="Distribution · Sourcing · Bus Dev" />
      <Card>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
          <h4 style={h4()}>Build DP · placing a pawn</h4>
        </div>
        <p style={pStyle()}>Stand a pawn on a tile. On <B>your or a neutral tile</B> it comes in <B>LIVE</B> — upright. On a <B>tile you don&apos;t control</B> it drops <B>DARK</B>, knocked on its side, doing nothing until repaired.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <MiniPanel caption="LIVE · stands up" label="YOUR / EMPTY TILE">
            <svg viewBox="0 0 160 90" width="100%" height="90">
              <Pawn x={80} y={44} color={P.brown} />
              <path d="M 50 58 L 80 70 L 110 58" fill="none" stroke={P.gold} strokeWidth={2} />
            </svg>
          </MiniPanel>
          <MiniPanel caption="DARK · on its side" label="A RIVAL'S TILE">
            <svg viewBox="0 0 160 90" width="100%" height="90">
              <Pawn x={80} y={44} dark />
              <path d="M 50 58 L 80 70 L 110 58" fill="none" stroke={P.gold} strokeWidth={2} />
            </svg>
          </MiniPanel>
        </div>
      </Card>
      <Card style={{ marginTop: 12, display: "grid", gridTemplateColumns: "200px 1fr", gap: 18, alignItems: "center" }}>
        <div style={{ background: P.cardMid, borderRadius: 10, padding: 8 }}>
          <svg viewBox="0 0 200 80" width="100%" height="76">
            <Pawn x={50} y={44} dark />
            <path d="M 96 42 L 120 42 M 112 36 L 120 42 L 112 48" stroke={P.brown} strokeWidth={2} fill="none" />
            <Pawn x={155} y={40} color={P.brown} />
          </svg>
          <div style={{ textAlign: "center", fontFamily: MONO, fontSize: 10, color: P.muted, marginTop: 4 }}>a DARK pawn stands back up to LIVE</div>
        </div>
        <div>
          <h4 style={h4()}>Repair DP</h4>
          <p style={pStyle()}>Stand a <B>DARK</B> pawn back up to <B>LIVE</B>. Only LIVE pawns count toward control, so repairing revives your presence on a tile a rival knocked out.</p>
        </div>
      </Card>

      <SubHead color={P.brown} title="Control — who holds the tile" />
      <Card style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "center" }}>
        <MiniPanel ok caption="2 LIVE vs 1 → you control">
          <svg viewBox="0 0 200 90" width="100%" height="90">
            <Pawn x={70} y={44} color={P.brown} />
            <Pawn x={100} y={40} color={P.teal} />
            <Pawn x={130} y={44} color={P.brown} />
            <path d="M 55 58 L 100 72 L 145 58" fill="none" stroke={P.gold} strokeWidth={2} />
          </svg>
        </MiniPanel>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <MiniNote title="No DPs?" body="A tile with none of your pawns is not yours — no control." />
          <MiniNote title="DARK doesn't count." body="Pawns on their side are inactive — they never add to your total." />
          <MiniNote title="Tied for the lead?" body="Equal LIVE pawns (e.g. 1–1) means nobody holds it." />
        </div>
      </Card>

      <SubHead color={P.red} title="Stake your niches — how you earn Capital" tag="Sales · Marketing" />
      <Lede>You may only add or remove <B>your own</B> flags — you can <B>never</B> touch an opponent&apos;s. Plant a flag on <B>any tile</B> to claim it, and it pays a bonus every age you hold it.</Lede>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <Card>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}><h4 style={h4()}>Add niche flag</h4><Pill tone={P.red}>niche</Pill></div>
          <svg viewBox="0 0 260 90" width="100%" height="84" style={{ margin: "6px 0" }}>
            <rect x={6} y={12} width={248} height={66} rx={8} fill="none" stroke={P.red} strokeWidth={1.5} strokeDasharray="5 4" />
            {[40, 82, 124, 166, 208].map((x, i) => <Hex key={x} cx={x} cy={45} size={22} stroke={i === 2 ? P.red : P.gold} fill={i === 2 ? `${P.red}22` : "none"} />)}
            <Flag x={124} y={34} />
          </svg>
          <div style={{ textAlign: "center", fontFamily: MONO, fontSize: 10, color: P.red, marginBottom: 8 }}>NICHE = 5+ ADJACENT TILES</div>
          <p style={pStyle()}>Plant a flag on <B>any tile</B>. <B>Control not required</B> to plant it — the flag just marks that tile as yours to harvest.</p>
        </Card>
        <Card>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}><h4 style={h4()}>Remove niche flag</h4><Pill tone={P.red}>niche</Pill></div>
          <svg viewBox="0 0 260 90" width="100%" height="84" style={{ margin: "6px 0" }}>
            <rect x={6} y={12} width={248} height={66} rx={8} fill="none" stroke={P.muted} strokeWidth={1.5} strokeDasharray="5 4" />
            {[40, 82, 124, 166, 208].map((x) => <Hex key={x} cx={x} cy={45} size={22} stroke={P.gold} />)}
            <g opacity={0.5}><Flag x={124} y={30} color={P.muted} /></g>
            <path d="M 124 30 L 124 8 M 118 14 L 124 8 L 130 14" stroke={P.brown} strokeWidth={1.5} fill="none" />
          </svg>
          <div style={{ textAlign: "center", fontFamily: MONO, fontSize: 10, color: P.muted, marginBottom: 8 }}>PULL YOUR OWN FLAG</div>
          <p style={pStyle()}>Pull one of <B>your own</B> flags — freeing it to re-stake a better, larger, or safer niche. You can never remove a rival&apos;s flag.</p>
        </Card>
      </div>

      <Card style={{ marginTop: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}><h4 style={h4()}>At the end of the age, niche tiles score</h4><Pill tone={P.gold}>age end</Pill></div>
        <p style={pStyle()}>Each tile in your niche is worth a <B>bonus</B>, shown beneath it. What you collect depends on your grip on the niche — counted in LIVE DPs.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
          <ScorePanel title="MAJORITY" tone={P.gold} rivals caption="majority of the niche — score any 1 of these" highlight={false} />
          <ScorePanel title="MONOPOLY" tone={P.green} rivals={false} caption="no rival DP in the niche — score EVERY bonus" highlight />
        </div>
      </Card>

      <SubHead color={P.teal} title="Distill for the market" tag="Distill · Sourcing" />
      <Card style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 18, alignItems: "center" }}>
        <div style={{ background: P.cardMid, borderRadius: 10, padding: 10 }}>
          <div style={{ textAlign: "center", fontFamily: MONO, fontSize: 10, letterSpacing: 1, color: P.teal, marginBottom: 6 }}>THE MARKET</div>
          <svg viewBox="0 0 200 96" width="100%" height="86">
            <polygon points="100,10 110,20 100,30 90,20" fill={P.teal} />
            {[[45, P.gold], [100, P.red], [155, P.green]].map(([x, c], i) => (
              <g key={i}>
                <rect x={(x as number) - 22} y={38} width={44} height={44} rx={4} fill={P.cardLight} stroke={i === 1 ? P.teal : P.line} strokeWidth={i === 1 ? 2 : 1} />
                <rect x={(x as number) - 22} y={38} width={44} height={12} fill={c as string} />
                <circle cx={(x as number) - 8} cy={66} r={3} fill={P.brown} />
                <circle cx={(x as number) + 8} cy={66} r={3} fill={c as string} />
              </g>
            ))}
          </svg>
          <div style={{ textAlign: "center", fontFamily: MONO, fontSize: 10, color: P.teal, marginTop: 4 }}>YOUR MARKER SITS ON A LOT</div>
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}><h4 style={h4()}>Bid</h4><Pill tone={P.teal}>market</Pill></div>
          <p style={pStyle()}>Set a marker on a Market bourbon lot. At <B>Age end</B> the Market resolves — <B>most bids win the lot; ties discard.</B></p>
        </div>
      </Card>

      <SubHead color={P.red} title="Fight for the tile — The Push" tag="Sales" />
      <Card style={{ display: "grid", gridTemplateColumns: "230px 1fr", gap: 20, alignItems: "center" }}>
        <div style={{ background: P.cardMid, borderRadius: 10, padding: 12 }}>
          <div style={{ textAlign: "center", fontFamily: MONO, fontSize: 10, letterSpacing: 1, color: P.muted, marginBottom: 6 }}>THE DISPUTED TILE</div>
          <svg viewBox="0 0 180 96" width="100%" height="86">
            <rect x={40} y={14} width={100} height={72} rx={10} fill="none" stroke={P.red} strokeWidth={2} />
            <circle cx={78} cy={40} r={9} fill={P.brown} />
            <circle cx={104} cy={40} r={9} fill={P.brown} />
            <circle cx={91} cy={62} r={9} fill={P.teal} />
          </svg>
          <div style={{ textAlign: "center", fontFamily: MONO, fontSize: 10, color: P.brown, marginTop: 6, lineHeight: 1.4 }}>play as many bourbons as you have active DPs — highest fit wins</div>
        </div>
        <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            <>Play a <B>Push</B> action on a tile. The player who played it is the <B>attacker</B>.</>,
            <>Each side may play <B>as many bourbons as they have active DPs</B> on the tile.</>,
            <>The <B>attacker shows their bourbons first</B>, then the defenders show theirs.</>,
            <><B>Fit</B> = the number of traits shared between your bourbon(s) and the tile. Highest total fit wins.</>,
            <>The <B>difference in fit</B> is how many of the loser&apos;s DPs you remove. All played bourbons are <B>used up</B> — refresh them with a Distill action.</>,
          ].map((b, i) => (
            <li key={i} style={{ display: "flex", gap: 12 }}>
              <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 22, color: P.red, width: 18, textAlign: "right", flexShrink: 0, lineHeight: 1.3 }}>{i + 1}</span>
              <span style={{ fontSize: 14.5, lineHeight: 1.55, color: P.body }}>{b}</span>
            </li>
          ))}
        </ol>
      </Card>
    </section>
  );
}

function SubHead({ color, title, tag }: { color: string; title: string; tag?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "30px 0 12px" }}>
      <span style={{ width: 14, height: 14, borderRadius: 3, background: color }} />
      <h3 style={{ fontFamily: SERIF, fontWeight: 700, fontSize: "clamp(20px, 3vw, 26px)", color: P.ink, margin: 0 }}>{title}</h3>
      {tag && <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 1.5, color: P.muted, textTransform: "uppercase" }}>{tag}</span>}
      <span style={{ flex: 1, height: 1, background: P.line }} />
    </div>
  );
}

function MiniPanel({ children, caption, label, ok, }: { children: React.ReactNode; caption: string; label?: string; ok?: boolean }) {
  return (
    <div style={{ position: "relative", background: P.cardMid, border: `1px solid ${P.line}`, borderRadius: 10, padding: "12px 10px 8px" }}>
      {ok !== undefined && (
        <span style={{ position: "absolute", top: -10, right: -8, width: 24, height: 24, borderRadius: 999, background: ok ? P.green : P.red, color: "#fff", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 700 }}>{ok ? "✓" : "✕"}</span>
      )}
      {label && <div style={{ textAlign: "center", fontFamily: MONO, fontSize: 10, letterSpacing: 1, color: P.muted, marginBottom: 4 }}>{label}</div>}
      {children}
      <div style={{ textAlign: "center", fontFamily: MONO, fontSize: 10.5, color: ok === false ? P.red : ok ? P.green : P.brown, marginTop: 4 }}>{caption}</div>
    </div>
  );
}

function MiniNote({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ background: P.cardMid, borderRadius: 8, padding: "8px 12px", fontSize: 13.5, lineHeight: 1.45, color: P.body }}>
      <B>{title}</B> {body}
    </div>
  );
}

function ScorePanel({ title, tone, rivals, caption, highlight }: { title: string; tone: string; rivals: boolean; caption: string; highlight: boolean }) {
  const coins: [string, string, string][] = [
    ["+2", "CAPITAL", P.gold],
    ["+1", "DIST TOKEN", P.brown],
    ["+3", "CAPITAL", P.gold],
    ["+1", "SALES TOKEN", P.red],
    ["+2", "CAPITAL", P.gold],
  ];
  return (
    <div style={{ position: "relative", background: P.cardMid, border: `1px solid ${P.line}`, borderRadius: 10, padding: 14 }}>
      {highlight && <span style={{ position: "absolute", top: -10, right: -8, width: 24, height: 24, borderRadius: 999, background: P.green, color: "#fff", display: "grid", placeItems: "center", fontSize: 13 }}>★</span>}
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, color: tone, background: `${tone}1e`, border: `1px solid ${tone}55`, borderRadius: 999, padding: "3px 12px" }}>{title}</span>
      </div>
      <div style={{ position: "relative", height: 44 }}>
        <svg viewBox="0 0 260 44" width="100%" height="44">
          {[26, 78, 130, 182, 234].map((x, i) => (
            <circle key={x} cx={x} cy={26} r={9} fill={rivals && i === 3 ? P.teal : P.brown} />
          ))}
          <Flag x={130} y={16} />
        </svg>
      </div>
      <div style={{ textAlign: "center", fontFamily: MONO, fontSize: 10, color: P.muted, margin: "2px 0 8px" }}>
        {rivals ? "you ×4    rival ×1" : "you ×5    rival ×0"}
      </div>
      <div style={{ display: "flex", justifyContent: "center", gap: 4, flexWrap: "wrap", padding: highlight ? "8px 6px" : 0, background: highlight ? `${P.green}12` : "transparent", borderRadius: 8 }}>
        {coins.map((c, i) => <Coin key={i} top={c[0]} label={c[1]} color={c[2]} />)}
      </div>
      <div style={{ textAlign: "center", fontFamily: MONO, fontSize: 10, color: highlight ? P.green : P.muted, marginTop: 8, lineHeight: 1.4 }}>{caption}</div>
    </div>
  );
}

// ── 05 HOUSE RULES ───────────────────────────────────────────────────
function SectionHouse() {
  const cards: [string, React.ReactNode][] = [
    ["Live / Dark", <>Only <B>LIVE</B> points count. A <B>DARK</B> point does nothing until repaired.</>],
    ["Control", <>Hold a tile with <B>one more LIVE point than any single rival</B>. Tied for the lead = nobody holds it.</>],
    ["Growth", <>After setup, a new point goes beside a tile you control, or onto open ground. You can&apos;t grow <i>through</i> a rival.</>],
    ["Fit", <>How many of a tile&apos;s tags your committed bourbon shares (Age is meet-or-exceed). Add fit across every bourbon you commit; the highest total wins a Push.</>],
  ];
  return (
    <section>
      <SectionHead n="05" title="House rules & scoring" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {cards.map(([h, b]) => (
          <div key={h} style={{ background: P.cardLight, border: `1px solid ${P.line}`, borderRadius: 12, padding: "14px 16px" }}>
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: P.brown, textTransform: "uppercase", marginBottom: 6 }}>{h}</div>
            <p style={{ ...pStyle(), margin: 0 }}>{b}</p>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12 }}>
        <Callout tone="red" label="The Push (Sales)">
          Play a <B>Push</B> action on a tile — whoever plays it is the <B>attacker</B>. Each side may play as many bourbons as they have <B>active DPs</B> on the tile; the attacker shows first, then defenders. <B>Fit</B> is the number of traits shared between your bourbon(s) and the tile, and highest total fit wins. The <B>difference in fit</B> is how many of the loser&apos;s DPs you remove. All played bourbons are used up — refresh them with a Distill action.
        </Callout>
        <Callout tone="brown" label="Ownership">
          Some tiles carry an <B>ownership slot</B>. Put your DP in it to <B>own</B> the tile and hold its power — a Loyalty tile&apos;s defense bonus, or the State Capital&apos;s token each age. Owning differs from controlling; take it by winning a <B>Push</B> that clears the owner out (the slot DP falls last).
        </Callout>
      </div>
      <Banner big="Most Capital after Age 5 wins the house." small="Capital is your whole score — earned only through the niches you build and hold." />
    </section>
  );
}

function Banner({ big, small }: { big: string; small: string }) {
  return (
    <div style={{ marginTop: 20, background: `linear-gradient(120deg, ${P.brownDeep}, ${P.brown})`, borderRadius: 14, padding: "22px 26px", display: "flex", alignItems: "center", gap: 18, boxShadow: "0 8px 24px rgba(90,60,30,.25)" }}>
      <span style={{ fontFamily: SERIF, fontSize: 30, color: P.gold }}>◆</span>
      <div>
        <div style={{ fontFamily: SERIF, fontWeight: 800, fontSize: "clamp(22px, 3.5vw, 32px)", color: "#f6efdd", lineHeight: 1.1 }}>{big}</div>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 15, color: "#e6d3ad", marginTop: 4 }}>{small}</div>
      </div>
    </div>
  );
}

// ── QUICK GUIDE ──────────────────────────────────────────────────────
function SectionQuick() {
  return (
    <section>
      <SectionHead n="QG" title="One-Page Quick Guide" />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
        <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 18, color: P.body }}>Serve the market, control tiles, harvest niches.</span>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 1.5, color: P.gold, textTransform: "uppercase" }}>Most Capital after 5 ages wins</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <QCard title="Setup">
            <ol style={qol()}>
              <li>Lay <B>3 tiles</B> in a line. Deal <B>5 tiles</B> each; place one at a time, each touching <B>2+</B> tiles.</li>
              <li>Lay a Market of <B>PLAYERS+1</B> bourbons.</li>
              <li>Snake draft <B>4 picks</B> each: draft a bourbon <i>or</i> place a DP.</li>
              <li>Whoever drafted last leads the first round.</li>
            </ol>
          </QCard>
          <QCard title="The round — 5 ages × 5 rounds">
            <ul style={qul()}>
              <li><B>Age start:</B> deal <B>5 action cards</B> (one per round).</li>
              <li><B>Each round:</B> everyone plays <B>1 card</B> and takes its actions (mix freely, up to its pips). You may also spend <B>1 token</B> for a bonus action of that suit.</li>
              <li><B>Age end:</B> Market resolves (most bids win a lot; ties discard), then <B>niches score</B>.</li>
            </ul>
          </QCard>
          <QCard title="Actions & suits">
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {([
                ["Build DP", "Place a DP — live on yours/empty, dark on a rival's", ["DIST", "BIZ", "SRC"]],
                ["Repair DP", "Stand a dark DP back up to live", ["DIST", "SRC"]],
                ["Push", "Fight for a tile — bourbons in, DPs out", ["SALES"]],
                ["Add flag", "Claim a tile into your niche", ["SALES", "MKTG"]],
                ["Remove flag", "Take back one of your own flags", ["MKTG"]],
                ["Expand Market", "Draw a tile, or place your held tile", ["MKTG", "BIZ"]],
                ["Bid", "Put a marker on a Market lot", ["SRC", "DSTL"]],
                ["Refresh", "Return a depleted bourbon to fresh", ["DSTL"]],
              ] as [string, string, SuitKey[]][]).map(([a, d, s]) => (
                <div key={a} style={{ display: "grid", gridTemplateColumns: "104px 1fr auto", gap: 8, alignItems: "center", fontSize: 12.5, color: P.body, paddingBottom: 6, borderBottom: `1px solid ${P.line}` }}>
                  <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 14, color: P.ink }}>{a}</span>
                  <span>{d}</span>
                  <span style={{ display: "flex", gap: 3 }}>{s.map((x) => <SuitChip key={x} k={x} />)}</span>
                </div>
              ))}
            </div>
          </QCard>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <QCard title="Distribution & control">
            <ul style={qul()}>
              <li>A DP lands <B>LIVE</B> on your / empty tile, <B>DARK</B> on a rival&apos;s. Repair stands a DARK one back up.</li>
              <li><B>Control</B> = one more LIVE DP than any single rival. A tie = nobody; DARK DPs never count.</li>
              <li>Grow only from a tile you control or open ground — never <i>through</i> a rival.</li>
            </ul>
          </QCard>
          <QCard title="Niches & scoring">
            <ul style={qul()}>
              <li>Flag <B>any tile</B> (your own flags only) to claim it. Each niche tile is worth a printed <B>bonus</B>.</li>
              <li><B>Majority</B> of the niche → score <B>any 1</B> bonus.</li>
              <li><B>Monopoly</B> (no rival DP in it) → score <B>every</B> bonus.</li>
            </ul>
          </QCard>
          <QCard title="The Push (Sales)" tone={P.red}>
            <ol style={qol()}>
              <li>Whoever plays the Push card is the <B>attacker</B>.</li>
              <li>Each side may play bourbons up to their <B>active DPs</B> on the tile.</li>
              <li><B>Attacker shows first</B>, then defenders.</li>
              <li><B>Fit</B> = traits shared with the tile; highest total wins.</li>
              <li><B>Fit difference</B> = how many losing DPs you remove.</li>
              <li>Played bourbons deplete — <B>Refresh</B> (Distill) to reuse.</li>
            </ol>
          </QCard>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <QCard title="Tokens"><p style={{ ...pStyle(), margin: 0, fontSize: 13 }}>Won from tiles. Spend <B>1</B> for a bonus action of its suit. Pure tempo — never scored.</p></QCard>
            <QCard title="Ownership"><p style={{ ...pStyle(), margin: 0, fontSize: 13 }}>Some tiles have a <B>slot</B>: fill it to hold the tile&apos;s power. Take it by winning a Push.</p></QCard>
          </div>
        </div>
      </div>
      <Banner big="Most Capital after Age 5 wins — and Capital comes only from niches." small="Build niches, hold them through the age, harvest at the buzzer." />
    </section>
  );
}

function QCard({ title, children, tone }: { title: string; children: React.ReactNode; tone?: string }) {
  return (
    <div style={{ background: P.cardLight, border: `1px solid ${tone ? `${tone}66` : P.line}`, borderLeft: tone ? `4px solid ${tone}` : `1px solid ${P.line}`, borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 2, color: tone ?? P.brown, textTransform: "uppercase", marginBottom: 8 }}>{title}</div>
      {children}
    </div>
  );
}

// ── inline style helpers ─────────────────────────────────────────────
function mono(): React.CSSProperties {
  return { fontFamily: MONO, fontSize: 12, color: P.brown, background: `${P.brown}14`, padding: "1px 5px", borderRadius: 4 };
}
function h4(): React.CSSProperties {
  return { fontFamily: SERIF, fontWeight: 700, fontSize: 21, color: P.ink, margin: 0 };
}
function pStyle(): React.CSSProperties {
  return { fontFamily: SANS, fontSize: 14.5, lineHeight: 1.6, color: P.body, margin: "6px 0 0" };
}
function qol(): React.CSSProperties {
  return { margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6, fontSize: 13.5, lineHeight: 1.5, color: P.body };
}
function qul(): React.CSSProperties {
  return { margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6, fontSize: 13.5, lineHeight: 1.5, color: P.body };
}
function Pill({ children, tone }: { children: React.ReactNode; tone?: string }) {
  const c = tone ?? P.green;
  return <span style={{ fontFamily: MONO, fontSize: 10.5, letterSpacing: 1, color: c, border: `1px solid ${c}66`, borderRadius: 999, padding: "2px 9px" }}>{children}</span>;
}
