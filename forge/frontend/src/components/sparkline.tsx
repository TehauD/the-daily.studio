/* Dependency-free sparkline used by the always-loaded instrument bar (keeps Recharts out of the main chunk). */
/* ------------------------------------------------------------- sparkline */
export function Sparkline({ values, max = 100, w = 72, h = 20, color }: { values: (number | null)[]; max?: number; w?: number; h?: number; color?: string }) {
  const pts = values.map((v, i) => (v == null ? null : [i * (w / Math.max(1, values.length - 1)), h - 1 - (Math.min(v, max) / max) * (h - 2)]));
  const d = pts.reduce((acc, p, i) => (p ? `${acc}${acc && pts[i - 1] ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}` : acc), "");
  const last = [...pts].reverse().find(Boolean);
  return (
    <svg width={w} height={h} aria-hidden className="overflow-visible">
      <line x1={0} x2={w} y1={h - 0.5} y2={h - 0.5} stroke="var(--line)" />
      <path d={d} fill="none" stroke={color ?? "var(--accent)"} strokeWidth={1.5} strokeLinejoin="round" />
      {last && <circle cx={last[0]} cy={last[1]} r={2} fill={color ?? "var(--accent)"} />}
    </svg>
  );
}

