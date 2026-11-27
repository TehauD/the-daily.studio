import { useMemo, useState, type ReactNode } from "react";
import { fmt } from "../lib/api";
import { useChartVars } from "../lib/prefs";
import { cx } from "./ui";

/* ------------------------------------------------------------- shared */
export function useTooltipStyle() {
  const v = useChartVars();
  return {
    contentStyle: { background: v.surface, border: `1px solid ${v["line-strong"]}`, borderRadius: 4, fontSize: 11.5,
                    fontFamily: "var(--font-mono)", boxShadow: "0 4px 16px rgb(0 0 0 / .08)", padding: "6px 9px" },
    labelStyle: { color: v["ink-3"], marginBottom: 2 }, itemStyle: { color: v.ink, padding: 0 },
    cursor: { stroke: v["line-strong"], strokeWidth: 1 },
  };
}

export function LegendKey({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-2">
          <svg width="16" height="8" aria-hidden><line x1="0" x2="16" y1="4" y2="4" stroke={i.color} strokeWidth="2" strokeDasharray={i.dashed ? "3 2" : undefined} strokeLinecap="round" /></svg>
          {i.label}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------- telemetry small multiple */
export function TraceStrip({ title, unit, values, times, max = 100, current, sub }: {
  title: string; unit: string; values: (number | null)[]; times: number[]; max?: number; current: ReactNode; sub?: ReactNode;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 320, H = 64;
  const n = values.length;
  const x = (i: number) => (n <= 1 ? W : (i / (n - 1)) * W);
  const y = (v: number) => H - 2 - (Math.min(v, max) / max) * (H - 6);
  let d = "", area = "";
  values.forEach((v, i) => {
    if (v == null) return;
    const seg = values[i - 1] == null ? "M" : "L";
    d += `${seg}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
  });
  const firstIdx = values.findIndex((v) => v != null);
  const lastIdx = n - 1 - [...values].reverse().findIndex((v) => v != null);
  if (firstIdx >= 0 && values.every((v, i) => i < firstIdx || i > lastIdx || v != null)) area = `${d}L${x(lastIdx)},${H}L${x(firstIdx)},${H}Z`;
  const hv = hover != null ? values[hover] : null;
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="micro text-ink-3">{title}</span>
        <span className="num font-mono text-[15px] font-medium text-ink">{hover != null ? (hv == null ? "—" : hv.toFixed(0)) : current}<span className="ml-0.5 text-[10.5px] text-ink-3">{unit}</span></span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-16 w-full touch-none" role="img" aria-label={`${title} trace`}
        onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHover(Math.round(((e.clientX - r.left) / r.width) * (n - 1))); }}
        onPointerLeave={() => setHover(null)}>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={0} x2={W} y1={y(max * f)} y2={y(max * f)} stroke="var(--line)" strokeWidth={1} vectorEffect="non-scaling-stroke" />)}
        {area && <path d={area} fill="var(--accent)" opacity={0.08} />}
        <path d={d} fill="none" stroke="var(--accent)" strokeWidth={1.6} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={0} y2={H} stroke="var(--line-strong)" vectorEffect="non-scaling-stroke" />}
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-ink-3">
        <span>{hover != null && times[hover] ? new Date(times[hover] * 1000).toLocaleTimeString() : times[0] ? `−${Math.round((times[n - 1] - times[0]))}s` : ""}</span>
        <span>{sub}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- learning curves */
export interface ForestRow { key: string; label: string; sub?: string; mean: number; lo: number; hi: number; note?: ReactNode }

export function ForestPlot({ rows, minGain, domain }: { rows: ForestRow[]; minGain?: number; domain?: [number, number] }) {
  const [hover, setHover] = useState<string | null>(null);
  const ext = Math.max(0.1, ...rows.flatMap((r) => [Math.abs(r.lo), Math.abs(r.hi)]), minGain ?? 0);
  const [d0, d1] = domain ?? [-Math.min(1, ext * 1.15), Math.min(1, ext * 1.15)];
  const L = 210, R = 150, W = 760, rowH = 34, top = 26;
  const H = top + rows.length * rowH + 22;
  const x = (val: number) => L + ((val - d0) / (d1 - d0)) * (W - L - R);
  const ticks = niceTicks(d0, d1, 5);
  const color = (r: ForestRow) => (r.lo > 0 ? "var(--div-pos)" : r.hi < 0 ? "var(--div-neg)" : "var(--ink-3)");
  return (
    <div className="scroll-thin overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px] max-w-[1040px]" role="img" aria-label="Paired effect estimates with 95% confidence intervals">
        <text x={L} y={12} className="fill-[var(--ink-3)] font-mono text-[10px]">Δ strict success (arm − base), 95% CI</text>
        <text x={W - R + 12} y={12} className="fill-[var(--ink-3)] font-mono text-[10px]">mean [CI]</text>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={top - 6} y2={H - 18} stroke="var(--line)" />
            <text x={x(t)} y={H - 4} textAnchor="middle" className="num fill-[var(--ink-3)] font-mono text-[10px]">{t > 0 ? "+" : ""}{(t * 100).toFixed(0)}</text>
          </g>
        ))}
        <line x1={x(0)} x2={x(0)} y1={top - 8} y2={H - 18} stroke="var(--div-mid)" strokeWidth={1.5} />
        {minGain != null && minGain > 0 && minGain < d1 && (
          <g>
            <line x1={x(minGain)} x2={x(minGain)} y1={top - 8} y2={H - 18} stroke="var(--accent)" strokeWidth={1} />
            <text x={x(minGain) + 4} y={top - 1} className="fill-[var(--accent)] font-mono text-[9.5px]">min gain {(minGain * 100).toFixed(0)}pp</text>
          </g>
        )}
        {rows.map((r, i) => {
          const cy = top + i * rowH + rowH / 2;
          const on = hover === r.key;
          return (
            <g key={r.key} onPointerEnter={() => setHover(r.key)} onPointerLeave={() => setHover(null)}>
              <rect x={0} y={cy - rowH / 2} width={W} height={rowH} fill={on ? "var(--surface-2)" : "transparent"} />
              <text x={8} y={cy - 2} className="fill-[var(--ink)] text-[12px]">{r.label}</text>
              {r.sub && <text x={8} y={cy + 11} className="fill-[var(--ink-3)] font-mono text-[9.5px]">{r.sub}</text>}
              <line x1={x(r.lo)} x2={x(r.hi)} y1={cy} y2={cy} stroke={color(r)} strokeWidth={2} strokeLinecap="round" />
              <line x1={x(r.lo)} x2={x(r.lo)} y1={cy - 5} y2={cy + 5} stroke={color(r)} strokeWidth={1.5} />
              <line x1={x(r.hi)} x2={x(r.hi)} y1={cy - 5} y2={cy + 5} stroke={color(r)} strokeWidth={1.5} />
              <rect x={x(r.mean) - 5} y={cy - 5} width={10} height={10} transform={`rotate(45 ${x(r.mean)} ${cy})`} fill={color(r)} stroke="var(--surface)" strokeWidth={2} />
              <text x={W - R + 12} y={cy + 4} className="num fill-[var(--ink)] font-mono text-[11px]">
                {fmt.pp(r.mean)} <tspan className="fill-[var(--ink-3)]">[{(r.lo * 100).toFixed(1)}, {(r.hi * 100).toFixed(1)}]</tspan>
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export function niceTicks(a: number, b: number, n: number): number[] {
  const span = b - a;
  const step0 = span / n;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? step0;
  const out = [];
  for (let t = Math.ceil(a / step) * step; t <= b + 1e-9; t += step) out.push(Math.round(t * 1e6) / 1e6);
  return out;
}

/* ------------------------------------------------------------- skill map */
export interface SkillFamily { family: string; teacher?: { rate: number; n: number; ci: [number, number] }; base?: { rate: number; n: number; ci: [number, number] }; tuned?: { rate: number; n: number; ci: [number, number] } }
export function SkillMap({ families }: { families: SkillFamily[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const rings: { key: "teacher" | "base" | "tuned"; r: number; color: string }[] = [
    { key: "teacher", r: 40, color: "var(--s-teacher)" }, { key: "base", r: 31, color: "var(--s-base)" }, { key: "tuned", r: 22, color: "var(--s-tuned)" }];
  const arc = (r: number, frac: number) => {
    if (frac <= 0) return "";
    if (frac >= 0.9999) return `M 0 ${-r} A ${r} ${r} 0 1 1 -0.01 ${-r}`;
    const a = frac * Math.PI * 2;
    return `M 0 ${-r} A ${r} ${r} 0 ${frac > 0.5 ? 1 : 0} 1 ${(r * Math.sin(a)).toFixed(2)} ${(-r * Math.cos(a)).toFixed(2)}`;
  };
  return (
    <div>
      <LegendKey items={[{ label: "teacher (outer)", color: "var(--s-teacher)" }, { label: "base student", color: "var(--s-base)" }, { label: "tuned student (inner)", color: "var(--s-tuned)" }]} />
      <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(176px,1fr))] gap-3">
        {families.map((f) => {
          const delta = f.tuned && f.base ? f.tuned.rate - f.base.rate : null;
          return (
            <div key={f.family} onPointerEnter={() => setHover(f.family)} onPointerLeave={() => setHover(null)}
              className={cx("rounded-[var(--radius)] border p-3 transition", hover === f.family ? "border-accent-line bg-surface-2" : "border-line")}>
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-[11.5px] text-ink">{f.family}</span>
                {delta != null && <span className={cx("num font-mono text-[11.5px]", delta > 0 ? "text-[color:var(--div-pos)]" : delta < 0 ? "text-[color:var(--div-neg)]" : "text-ink-3")}>{fmt.pp(delta, 0)}</span>}
              </div>
              <div className="mt-1 flex items-center gap-3">
                <svg viewBox="-48 -48 96 96" className="h-24 w-24 shrink-0" role="img" aria-label={`${f.family} success rates`}>
                  {rings.map((g) => (
                    <g key={g.key}>
                      <circle r={g.r} fill="none" stroke="var(--surface-3)" strokeWidth={6} />
                      {f[g.key] && <path d={arc(g.r, f[g.key]!.rate)} fill="none" stroke={g.color} strokeWidth={6} strokeLinecap="round" />}
                    </g>
                  ))}
                </svg>
                <dl className="num space-y-1 font-mono text-[10.5px]">
                  {rings.map((g) => (
                    <div key={g.key} className="flex items-center gap-1.5" title={f[g.key] ? `Wilson 95% CI ${fmt.pct(f[g.key]!.ci[0], 0)}–${fmt.pct(f[g.key]!.ci[1], 0)} · n=${f[g.key]!.n}` : "not measured"}>
                      <dt className="flex w-14 items-center gap-1.5 text-ink-3"><span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: g.color }} aria-hidden />{g.key}</dt><dd className="text-ink">{f[g.key] ? fmt.pct(f[g.key]!.rate, 0) : "—"}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- weight-change heat strip */
export function HeatStrip({ cells, layers, kinds, metric, onSelect, selected, layerTypes }: {
  cells: { layer: number; kind: string; value: number | null; module: string }[]; layers: number[]; kinds: string[]; metric: string;
  onSelect?: (module: string) => void; selected?: string | null; layerTypes?: string[] | null;
}) {
  const typeRow = layerTypes && new Set(layerTypes).size > 1 ? 11 : 0; // a sliding / full marker row only when the model mixes them
  const [hover, setHover] = useState<{ module: string; value: number | null; layer: number; kind: string } | null>(null);
  const vals = cells.map((c) => c.value).filter((v): v is number => v != null);
  const max = Math.max(1e-12, ...vals);
  const ramp = ["var(--seq-0)", "var(--seq-1)", "var(--seq-2)", "var(--seq-3)", "var(--seq-4)"];
  const color = (v: number | null) => (v == null ? "var(--surface-3)" : ramp[Math.min(4, Math.floor((v / max) * 4.999))]);
  const map = useMemo(() => new Map(cells.map((c) => [`${c.layer}|${c.kind}`, c])), [cells]);
  const cw = Math.max(10, Math.min(26, 720 / Math.max(1, layers.length)));
  const W = 92 + layers.length * cw, H = 18 + typeRow + kinds.length * 22;
  return (
    <div>
      <div className="scroll-thin overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: W, maxWidth: "none" }} role="img" aria-label={`Per-layer ${metric}`}>
          {kinds.map((k, ki) => (
            <g key={k}>
              <text x={84} y={14 + typeRow + ki * 22 + 13} textAnchor="end" className="fill-[var(--ink-2)] font-mono text-[10px]">{k}</text>
              {layers.map((l, li) => {
                const c = map.get(`${l}|${k}`);
                return (
                  <rect key={l} x={92 + li * cw} y={14 + typeRow + ki * 22} width={cw - 2} height={20} rx={2}
                    fill={color(c?.value ?? null)} stroke={c && selected === c.module ? "var(--ink)" : "none"} strokeWidth={1.5}
                    className={c ? "cursor-pointer" : ""} onPointerEnter={() => c && setHover({ module: c.module, value: c.value, layer: l, kind: k })}
                    onPointerLeave={() => setHover(null)} onClick={() => c && onSelect?.(c.module)} />
                );
              })}
            </g>
          ))}
          {typeRow > 0 && <text x={84} y={21} textAnchor="end" className="fill-[var(--ink-3)] font-mono text-[9px]">attention</text>}
          {typeRow > 0 && layers.map((l, li) => { const t = layerTypes![l]; return (
            <rect key={`t${l}`} x={92 + li * cw} y={14} width={cw - 2} height={7} rx={1.5} fill={t === "full" ? "var(--ink-2)" : "none"}
              stroke="var(--ink-3)" strokeWidth={t === "full" ? 0 : 1} strokeDasharray={t === "full" ? undefined : "2 1.5"}><title>{`layer ${l}: ${t === "full" ? "full attention" : "sliding-window attention"}`}</title></rect>); })}
          {layers.map((l, li) => (li % Math.ceil(layers.length / 14) === 0 ? (
            <text key={l} x={92 + li * cw + (cw - 2) / 2} y={10} textAnchor="middle" className="num fill-[var(--ink-3)] font-mono text-[9px]">{l}</text>) : null))}
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-mono text-[10px] text-ink-3">
          <span>0</span>
          <span className="flex h-2 w-28 overflow-hidden rounded-sm">{ramp.map((c) => <span key={c} className="flex-1" style={{ background: c }} />)}</span>
          <span>{max.toExponential(2)}</span><span>· {metric}</span>
          {typeRow > 0 && <span className="ml-2 flex items-center gap-1.5"><span className="inline-block h-2 w-3 rounded-[1.5px] bg-ink-2" />full attention
            <span className="ml-1 inline-block h-2 w-3 rounded-[1.5px] border border-dashed border-ink-3" />sliding window</span>}
        </div>
        <span className="num font-mono text-[11px] text-ink-2">{hover ? `L${hover.layer} ${hover.kind} · ${hover.value == null ? "—" : hover.value.toExponential(3)}` : "hover a cell · click to inspect"}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- singular spectrum */
export function Spectrum({ sigma, effRank }: { sigma: number[]; effRank: number }) {
  const max = Math.max(1e-12, ...sigma);
  const W = 320, H = 120, bw = W / Math.max(1, sigma.length);
  const total = sigma.reduce((a, b) => a + b * b, 0);
  let cum = 0;
  const cumPts = sigma.map((s, i) => { cum += s * s; return `${i ? "L" : "M"}${(i + 0.5) * bw},${H - (cum / total) * (H - 8)}`; }).join("");
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H + 16}`} className="w-full" role="img" aria-label="Singular value spectrum">
        <line x1={0} x2={W} y1={H} y2={H} stroke="var(--line-strong)" />
        {sigma.map((s, i) => <rect key={i} x={i * bw + 1} y={H - (s / max) * (H - 8)} width={Math.max(1, bw - 2)} height={(s / max) * (H - 8)} rx={Math.min(3, bw / 4)} fill="var(--seq-2)" />)}
        <path d={cumPts} fill="none" stroke="var(--ink-2)" strokeWidth={1.25} />
        <line x1={(effRank) * bw} x2={effRank * bw} y1={4} y2={H} stroke="var(--accent)" />
        <text x={effRank * bw > W * 0.6 ? effRank * bw - 4 : effRank * bw + 4} y={H - 6} textAnchor={effRank * bw > W * 0.6 ? "end" : "start"} className="fill-[var(--accent)] font-mono text-[9.5px]" paintOrder="stroke" stroke="var(--surface)" strokeWidth={3}>eff. rank {effRank.toFixed(2)}</text>
        <text x={0} y={H + 12} className="fill-[var(--ink-3)] font-mono text-[9.5px]">σ₁ … σᵣ (bars) · cumulative energy Σσ² (line)</text>
      </svg>
    </div>
  );
}
