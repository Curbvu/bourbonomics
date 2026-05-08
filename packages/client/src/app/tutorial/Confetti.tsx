"use client";

/**
 * Cheap CSS-driven confetti. 24 particles, randomized hue between
 * gold/silver/amber, drift down with a tumble. Mounts when shown=true,
 * unmounts when false — the keyframes restart on each mount so a
 * second Silver award (e.g. tutorial replay) re-triggers cleanly.
 */

export default function Confetti({ shown }: { shown: boolean }) {
  if (!shown) return null;

  const particles = Array.from({ length: 28 }, (_, i) => i);

  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {particles.map((i) => {
        const left = (i * 37) % 100; // pseudo-random spread
        const duration = 2.4 + ((i * 13) % 18) / 10;
        const delay = ((i * 7) % 22) / 20;
        const hue = i % 3 === 0 ? "amber" : i % 3 === 1 ? "yellow" : "orange";
        const palette: Record<string, string> = {
          amber: "bg-amber-300",
          yellow: "bg-yellow-200",
          orange: "bg-orange-300",
        };
        return (
          <span
            key={i}
            className={["confetti absolute h-2 w-3 rounded-sm", palette[hue]].join(" ")}
            style={{
              left: `${left}%`,
              top: "-24px",
              animationDuration: `${duration}s`,
              animationDelay: `${delay}s`,
              transform: `rotate(${(i * 23) % 360}deg)`,
            }}
          />
        );
      })}
      <style>{`
        @keyframes confetti-fall {
          0%   { transform: translateY(0) rotate(0deg);     opacity: 0;   }
          10%  { opacity: 1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
        }
        .confetti {
          animation-name: confetti-fall;
          animation-timing-function: ease-in;
          animation-iteration-count: 1;
          box-shadow: 0 0 8px rgba(251,191,36,0.55);
        }
      `}</style>
    </div>
  );
}
