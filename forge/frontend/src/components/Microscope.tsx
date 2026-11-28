import { useMemo, useState } from "react";
import { qs } from "../lib/api";
import { useApi } from "../lib/hooks";
import { Sym } from "../lib/math";
import { Explain } from "./Explain";
import { Figure, Limits } from "./results";
import { ErrorLine, Panel, Prov, Segmented, Skeleton, cx } from "./ui";

interface Micro {
  module: string; shape: [number, number]; rank: number; scale: number; effective_rank: number;
  norms: { W: number; dW: number; W_after: number; relative: number | null };
  map: { abs: number[][]; relative: number[][]; grid: [number, number]; rows_per_cell: number; cols_per_cell: number };
  profiles: { rows: number[] | null; cols: number[] | null; top_rows: number[]; top_cols: number[] };
  hist: { edges: number[]; before: number[]; after: number[]; delta_edges: number[]; delta: number[]; stats: Record<string, number> };
  spectra: { W: number[]; W_after: number[]; dW: number[]; W_total: number };
  alignment: Record<string, number>; random_baseline: Record<string, number>;
  parts: { i: number; sigma: number; share: number; grid: number[][] }[];
  over_training?: { label: string; dW: number }[]; across_seeds?: { label: string; cosine: number | null }[]; honesty: string;
  layer_type?: { type: string; sliding_window: number | null; pattern: string } | null;
}
const e3 = (v: number) => (Math.abs(v) >= 0.01 && Math.abs(v) < 1000 ? v.toPrecision(3) : v.toExponential(2));
const pc = (v: number) => `${(v * 100).toFixed(1)}%`;

function Heat({ grid, title, rowsPer, colsPer, sqrt }: { grid: number[][]; title: string; rowsPer: number; colsPer: number; sqrt: boolean }) {
  const [hi, setHi] = useState<[number, number] | null>(null);
  const max = Math.max(1e-12, ...grid.flat().map(Math.abs));
  const R = grid.length, C = grid[0]?.length ?? 0, cw = 8, ch = 6;
  const f = (v: number) => { const x = Math.abs(v) / max; return sqrt ? Math.sqrt(x) : x; };
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${C * cw} ${R * ch}`} className="block h-auto w-full rounded border border-line" role="img" aria-label={title} onMouseLeave={() => setHi(null)}>
        {grid.map((row, i) => row.map((v, j) => (
          <rect key={`${i}-${j}`} x={j * cw} y={i * ch} width={cw} height={ch} onMouseEnter={() => setHi([i, j])}
            style={{ fill: `color-mix(in oklab, var(--s-teacher) ${Math.round(f(v) * 100)}%, var(--surface))` }} />)))}
        {hi && <rect x={hi[1] * cw} y={hi[0] * ch} width={cw} height={ch} fill="none" stroke="var(--ink)" strokeWidth={1} />}
      </svg>
      <div className="mt-1 h-5 font-mono text-[11px] text-ink-2" aria-live="polite">{hi ? `output dims ${Math.floor(hi[0] * rowsPer)}–${Math.floor((hi[0] + 1) * rowsPer) - 1} × input dims ${Math.floor(hi[1] * colsPer)}–${Math.floor((hi[1] + 1) * colsPer) - 1}: mean ${e3(grid[hi[0]][hi[1]])}` : "hover a cell for its dimensions and value"}</div>
      <div className="flex items-center gap-2 text-[10.5px] text-ink-3"><span>0</span><span className="h-2 w-32 rounded" style={{ background: "linear-gradient(90deg, var(--surface), var(--s-teacher))" }} /><span>{e3(max)}{sqrt ? " (√ scale)" : ""}</span></div>
    </div>
  );
}

function Bars({ values, max, color, h = 70 }: { values: number[]; max: number; color: string; h?: number }) {
  const w = values.length;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="block h-[70px] w-full" aria-hidden>
      {values.map((v, i) => <rect key={i} x={i} y={h - (v / (max || 1)) * h} width={0.9} height={(v / (max || 1)) * h} fill={color} />)}
    </svg>
  );
}

/** Weight microscope: one adapted matrix before and after training, exact and read-only. */
export function Microscope({ sid, arm, seed, module }: { sid: string; arm: string; seed: number; module: string }) {
  const m = useApi<Micro>(`/api/studies/${sid}/microscope${qs({ arm, seed, module })}`);
  const [view, setView] = useState<"abs" | "relative" | "parts">("abs");
  const [sqrt, setSqrt] = useState(true);
  const [on, setOn] = useState<Set<number> | null>(null);
  const d = m.data;
  const partsGrid = useMemo(() => {
    if (!d) return null;
    const sel = on ?? new Set(d.parts.map((p) => p.i));
    const R = d.parts[0]?.grid.length ?? 0, C = d.parts[0]?.grid[0]?.length ?? 0;
    const g = Array.from({ length: R }, () => new Array(C).fill(0));
    d.parts.filter((p) => sel.has(p.i)).forEach((p) => p.grid.forEach((row, i) => row.forEach((v, j) => { g[i][j] += v; })));
    return g;
  }, [d, on]);
  const short = module.replace(/^model\./, "");
  if (m.error) return <Panel title={`Weight microscope · ${short}`}><ErrorLine error={m.error} /></Panel>;
  if (!d) return <Panel title={`Weight microscope · ${short}`}><Skeleton h={320} /></Panel>;
  const [out, inn] = d.shape;
  const selShare = d.parts.filter((p) => (on ?? new Set(d.parts.map((x) => x.i))).has(p.i)).reduce((a, p) => a + p.share, 0);
  const hmax = Math.max(...d.hist.before, ...d.hist.after);
  return (
    <Panel title={`Weight microscope · ${short}`} eyebrow={`${arm} · seed ${seed}${d.layer_type && d.layer_type.pattern !== "all full attention" ? ` · ${d.layer_type.type === "full" ? "full-attention layer" : `sliding-window layer (${d.layer_type.sliding_window ?? "?"} tokens)`}` : ""}`} prov={<Prov kind="computed" source="adapter + base safetensors, read-only" />}
      right={<Explain title="Weight microscope" what={<>One matrix of the model — <b>{short}</b>, {out} outputs × {inn} inputs — before training (<Sym k="W" />) and after (<Sym k="Wp" /> = W + <Sym k="dW" />). Training never edits W; it adds a small learned change.</>}
        read={<ul className="list-disc space-y-1 pl-4"><li><b>Size</b>: the change is {d.norms.relative != null ? pc(d.norms.relative) : "—"} of W's size. Small percentages are normal: LoRA nudges, it doesn't rewrite.</li>
          <li><b>Change map</b>: darker cells are blocks of the matrix that changed more. Bands across a row mean some <i>outputs</i> changed for many inputs; bands down a column mean some <i>inputs</i> are now used differently.</li>
          <li><b>Parts</b>: the change is a sum of {d.parts.length} simple pieces; toggle them to see which piece does what.</li>
          <li><b>Alignment</b>: compare each bar with its random baseline — well above it means training reinforced directions W already uses.</li></ul>}
        math={<><p><Sym k="dW" /> = <Sym k="s" /> · <Sym k="B" /> · <Sym k="A" />, with <Sym k="s" /> = <Sym k="alpha" /> / <Sym k="r" /> = {d.scale.toFixed(2)} and <Sym k="r" /> = {d.rank}.</p>
          <p><Sym k="fro" /> = √Σ<Sym k="sigma" />² = {e3(d.norms.dW)}; ‖W‖_F = {e3(d.norms.W)}; ratio {d.norms.relative != null ? e3(d.norms.relative) : "—"}.</p>
          <p><Sym k="effrank" /> = exp(<Sym k="H" />(σ/Σσ)) = {d.effective_rank.toFixed(2)} of {d.rank}.</p>
          <p>σ of ΔW comes from <Sym k="qr" /> — exact, without building the {out}×{inn} matrix for the spectrum.</p></>} />}>
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {([["‖W‖_F (before)", e3(d.norms.W), "W"], ["‖W′‖_F (after)", e3(d.norms.W_after), "Wp"], ["‖ΔW‖_F (change)", e3(d.norms.dW), "fro"],
            ["change ÷ original", d.norms.relative != null ? pc(d.norms.relative) : "—", "rel"], ["effective rank", `${d.effective_rank.toFixed(2)} / ${d.rank}`, "effrank"]] as [string, string, string][]).map(([l, v, k]) => (
            <div key={l}><div className="micro text-ink-3"><Sym k={k}>{l}</Sym></div><div className="num mt-1 font-mono text-[18px] text-ink">{v}</div></div>))}
        </div>

        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] [&>*]:min-w-0">
          <Figure title="Where the matrix changed" subtitle={view === "relative" ? "|ΔW| relative to |W|, block means" : view === "parts" ? "selected rank-1 parts, |block mean|" : "|ΔW|, block means"}
            y="output dimension (rows) →" x="input dimension (columns) →"
            caption={<>Each cell averages a block of about {d.map.rows_per_cell.toFixed(0)} × {d.map.cols_per_cell.toFixed(0)} entries of the {out} × {inn} matrix — exact block means, not a sample.</>}>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Segmented label="Map" value={view} onChange={setView} options={[{ value: "abs", label: "|ΔW|" }, { value: "relative", label: "|ΔW| / |W|" }, { value: "parts", label: "by part" }]} />
              <Segmented label="Scale" value={sqrt ? "sqrt" : "lin"} onChange={(v) => setSqrt(v === "sqrt")} options={[{ value: "sqrt", label: "√ (shows faint)" }, { value: "lin", label: "linear" }]} />
            </div>
            <Heat grid={view === "relative" ? d.map.relative : view === "parts" ? partsGrid! : d.map.abs} title={`Change map of ${short}`} rowsPer={d.map.rows_per_cell} colsPer={d.map.cols_per_cell} sqrt={sqrt} />
            {view === "parts" && (
              <div className="mt-2">
                <div className="mb-1 text-[11.5px] text-ink-2">Rank-1 parts (<Sym k="part" />) — toggle to see each one's pattern. Selected: {pc(selShare)} of the change.</div>
                <div className="flex flex-wrap gap-1">{d.parts.map((p) => { const sel = (on ?? new Set(d.parts.map((x) => x.i))).has(p.i); return (
                  <button key={p.i} type="button" aria-pressed={sel} onClick={() => { const n = new Set(on ?? d.parts.map((x) => x.i)); if (sel) n.delete(p.i); else n.add(p.i); setOn(n); }}
                    className={cx("rounded-full border px-2 py-0.5 font-mono text-[10.5px]", sel ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-3")}>#{p.i + 1} {pc(p.share)}</button>); })}
                  <button type="button" className="px-2 text-[11px] text-accent" onClick={() => setOn(new Set([0]))}>only #1</button>
                  <button type="button" className="px-2 text-[11px] text-accent" onClick={() => setOn(null)}>all</button></div>
              </div>)}
          </Figure>

          <div className="space-y-6">
            <Figure title="Weight values before and after" y="count of weights" x={`weight value (${e3(d.hist.edges[0])} … ${e3(d.hist.edges[d.hist.edges.length - 1])})`}
              legend={[{ label: "before (W)", color: "var(--ink-3)" }, { label: "after (W′)", color: "var(--s-teacher)" }]}
              caption={<>Mean {e3(d.hist.stats.W_mean)} → {e3(d.hist.stats.after_mean)}; spread (std) {e3(d.hist.stats.W_std)} → {e3(d.hist.stats.after_std)}. Overlapping shapes are expected: the change is small relative to W.</>}>
              <div className="relative">
                <svg viewBox={`0 0 ${d.hist.before.length} 70`} preserveAspectRatio="none" className="block h-[90px] w-full" role="img" aria-label="Histogram of weight values before and after">
                  {d.hist.before.map((v, i) => <rect key={i} x={i} y={70 - (v / hmax) * 70} width={0.95} height={(v / hmax) * 70} fill="var(--ink-3)" opacity={0.35} />)}
                  <polyline fill="none" stroke="var(--s-teacher)" strokeWidth={0.8} vectorEffect="non-scaling-stroke" points={d.hist.after.map((v, i) => `${i + 0.5},${70 - (v / hmax) * 70}`).join(" ")} />
                </svg>
              </div>
            </Figure>
            <Figure title="The change itself (ΔW values)" y="count" x={`ΔW value (${e3(d.hist.delta_edges[0])} … ${e3(d.hist.delta_edges[d.hist.delta_edges.length - 1])})`}
              caption={<>Largest single change {e3(d.hist.stats.dW_max_abs)}; std {e3(d.hist.stats.dW_std)}.</>}>
              <Bars values={d.hist.delta} max={Math.max(...d.hist.delta)} color="var(--s-tuned)" />
            </Figure>
          </div>
        </div>

        <div className="grid gap-6 2xl:grid-cols-3 [&>*]:min-w-0">
          <Figure title="Spectra: strength of each direction" y="σ (log scale)" x="direction number (largest first)"
            legend={[{ label: "W (before)", color: "var(--ink-3)" }, { label: "W′ (after)", color: "var(--s-teacher)", dashed: true }, { label: "ΔW (the change)", color: "var(--s-tuned)" }]}
            caption={<>Top {d.spectra.W.length} of {d.spectra.W_total} singular values of W and W′ (exact), and all {d.spectra.dW.length} of ΔW. Hover <Sym k="sigma" /> for what σ means.</>}>
            {(() => { const all = [...d.spectra.W, ...d.spectra.W_after, ...d.spectra.dW].filter((v) => v > 0); const lo = Math.log10(Math.min(...all)), hi = Math.log10(Math.max(...all));
              const n = d.spectra.W.length, L = 40, Wd = 320, Hd = 124, T = 6, B = 6, y = (v: number) => T + (1 - (Math.log10(Math.max(v, 1e-30)) - lo) / (hi - lo || 1)) * (Hd - T - B), x = (i: number) => L + (i / Math.max(1, n - 1)) * (Wd - L - 4);
              const ticks = [hi, (hi + lo) / 2, lo];
              return (
                <svg viewBox={`0 0 ${Wd} ${Hd}`} className="block h-auto w-full max-w-[560px]" role="img" aria-label="Singular value spectra of W, W′ and ΔW">
                  {ticks.map((t) => <g key={t}><line x1={L} x2={Wd - 4} y1={y(10 ** t)} y2={y(10 ** t)} stroke="var(--line)" strokeWidth={0.6} />
                    <text x={L - 4} y={y(10 ** t) + 3} fontSize={8.5} textAnchor="end" fill="var(--ink-3)" className="num">{e3(10 ** t)}</text></g>)}
                  <polyline fill="none" stroke="var(--ink-3)" strokeWidth={1.6} points={d.spectra.W.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
                  <polyline fill="none" stroke="var(--s-teacher)" strokeWidth={1.4} strokeDasharray="4 3" points={d.spectra.W_after.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
                  {d.spectra.dW.map((v, i) => <circle key={i} cx={x(i)} cy={y(v)} r={2.4} fill="var(--s-tuned)"><title>{`ΔW σ${i + 1} = ${e3(v)}`}</title></circle>)}
                </svg>); })()}
          </Figure>
          <Figure title="Does the change reuse W's main directions?" x="share of ΔW's energy inside W's top-k directions" caption={<>Bars: measured share (<Sym k="align" />). Ticks: what a random direction would give. Well above the tick = training reinforced directions W already uses.</>}>
            <ul className="space-y-2.5 text-[12px]">
              {Object.entries(d.alignment).map(([k, v]) => { const base = d.random_baseline[k] ?? 0; const [side, top] = k.split("_"); return (
                <li key={k}>
                  <div className="flex justify-between"><span className="text-ink-2">{side === "out" ? "output side" : "input side"} · top {top.replace("top", "")}</span><span className="num font-mono text-ink">{pc(v)} <span className="text-ink-3">(random {pc(base)})</span></span></div>
                  <div className="relative mt-1 h-2 rounded-full bg-surface-3"><div className="h-2 rounded-full bg-accent" style={{ width: `${Math.min(100, v * 100)}%` }} />
                    <span className="absolute -top-0.5 h-3 w-0.5 bg-ink" style={{ left: `${Math.min(100, base * 100)}%` }} title={`random baseline ${pc(base)}`} /></div>
                </li>); })}
            </ul>
          </Figure>
          <Figure title="Which dimensions changed most" y="‖row‖ or ‖column‖ of ΔW" x="dimension index"
            caption={<>Top output rows: {d.profiles.top_rows.slice(0, 5).join(", ")} · top input columns: {d.profiles.top_cols.slice(0, 5).join(", ")}.</>}>
            {d.profiles.rows && <><div className="text-[10.5px] text-ink-3">output dimensions ({out})</div><Bars values={d.profiles.rows} max={Math.max(...d.profiles.rows)} color="var(--s-teacher)" /></>}
            {d.profiles.cols && <><div className="mt-1 text-[10.5px] text-ink-3">input dimensions ({inn})</div><Bars values={d.profiles.cols} max={Math.max(...d.profiles.cols)} color="var(--s-base)" /></>}
          </Figure>
        </div>

        {(d.over_training?.length || d.across_seeds?.length) ? (
          <div className="grid gap-6 md:grid-cols-2 [&>*]:min-w-0">
            {d.over_training && d.over_training.length > 0 && (
              <Figure title="How the change grew during training" y="‖ΔW‖_F" x="saved snapshot → final" caption="Measured from each saved snapshot of this module.">
                {(() => { const pts = [...d.over_training!, { label: "final", dW: d.norms.dW }]; const mx = Math.max(...pts.map((p) => p.dW)) || 1;
                  const L = 40, R = 18, Wd = 320, Hd = 100, T = 8, xs = (i: number) => L + (i / Math.max(1, pts.length - 1)) * (Wd - L - R), ys = (v: number) => T + (1 - v / mx) * (Hd - T);
                  return (<svg viewBox={`0 0 ${Wd} ${Hd + 16}`} className="block h-auto w-full max-w-[560px]" role="img" aria-label="Size of the change over training">
                    {[mx, mx / 2, 0].map((t) => <g key={t}><line x1={L} x2={Wd - R} y1={ys(t)} y2={ys(t)} stroke="var(--line)" strokeWidth={0.6} />
                      <text x={L - 4} y={ys(t) + 3} fontSize={8.5} textAnchor="end" fill="var(--ink-3)" className="num">{t === 0 ? "0" : e3(t)}</text></g>)}
                    <polyline fill="none" stroke="var(--accent)" strokeWidth={2} points={pts.map((p, i) => `${xs(i)},${ys(p.dW)}`).join(" ")} />
                    {pts.map((p, i) => <g key={p.label}><circle cx={xs(i)} cy={ys(p.dW)} r={3} fill="var(--accent)"><title>{`${p.label}: ${e3(p.dW)}`}</title></circle>
                      <text x={xs(i)} y={Hd + 13} fontSize={8.5} textAnchor="middle" fill="var(--ink-3)">{p.label.replace("step ", "")}</text></g>)}
                  </svg>); })()}
              </Figure>)}
            {d.across_seeds && d.across_seeds.length > 0 && (
              <Figure title="Do other seeds learn the same change here?" x="cosine similarity with this seed's ΔW (−1 … 1)" caption={<>Near 1 = the same change every time (stable); near 0 = different changes reach similar results. Hover <Sym k="cos" /> for the definition.</>}>
                <ul className="space-y-2 text-[12px]">{d.across_seeds.map((x) => (
                  <li key={x.label}><div className="flex justify-between"><span>{x.label}</span><span className="num font-mono">{x.cosine == null ? "—" : x.cosine.toFixed(3)}</span></div>
                    <div className="relative mt-1 h-2 rounded-full bg-surface-3"><span className="absolute top-0 h-2 w-px bg-ink-3" style={{ left: "50%" }} />
                      {x.cosine != null && <span className="absolute -top-0.5 h-3 w-1 rounded bg-accent" style={{ left: `calc(${((x.cosine + 1) / 2) * 100}% - 2px)` }} />}</div></li>))}</ul>
              </Figure>)}
          </div>) : null}
        <Limits>{d.honesty}</Limits>
      </div>
    </Panel>
  );
}
