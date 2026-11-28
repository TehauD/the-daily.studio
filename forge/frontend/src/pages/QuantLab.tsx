import { useMemo, useState } from "react";
import { Explain } from "../components/Explain";
import { JobLog, StudySelect } from "../components/live";
import { Figure, Limits, fmtPct } from "../components/results";
import { Badge, Button, Empty, ErrorLine, Field, Notice, PageHeader, Panel, Prov, Segmented, Skeleton, cx, inputCls, td, th, tr } from "../components/ui";
import { api } from "../lib/api";
import { goto, handoff } from "../lib/handoff";
import { useAction, useApi } from "../lib/hooks";
import { usePrefs } from "../lib/prefs";
import type { Job } from "../lib/types";

interface Rate { rate: number | null; ci: number[] | null; n: number; speed?: { tokens_per_s: number; median_episode_ms: number | null } | null }
interface VRes extends Rate { agreement: number | null; only_quant_right: number; only_unquantized_right: number; mcnemar_p: number | null }
interface Method { id: string; label: string; family: string; runtime: string; bits: number; group?: number; calibrated: boolean; needs: string[]; about: string }
interface Variant { label: string; method: string; method_label: string; family: string; runtime: string; simulated: boolean; created_at: string; size_bytes: number | null;
  effective_bits: number | null; calibration: { source?: string; samples?: number } | null; summary: { mean_rel_error?: number; mean_sqnr_db?: number; compression?: number }; results: Record<string, VRes>; ref: string }
interface LabT { source: string | null; bf16_bytes: number | null; sealed: boolean; anchors: Record<string, Record<string, Rate>>; unquantized: Record<string, Rate>; unquantized_ref: string;
  variants: Variant[]; methods: Method[]; honesty: string }
interface Layer { module: string; layer: number | null; kind: string; rel_error: number; sqnr_db: number; rel_output_error?: number; alpha: number | null }
interface LayersT { label: string; layers: Layer[]; layer_types: { mixed?: boolean; types?: string[] } | null; summary: Record<string, number> }
interface RecipeT { method: Method; calibration: { file: string; samples: number; sha256: string; source: string }; steps: string[]; spec?: string }

const GB = (b: number | null | undefined) => (b == null ? "—" : b >= 1e9 ? `${(b / 1e9).toFixed(2)} GB` : `${(b / 1e6).toFixed(1)} MB`);
const RUNTIMES = [
  { family: "reference", title: "FORGE reference", sub: "Runs here. Exact per-layer error; simulated (measures behaviour, not size or speed)." },
  { family: "gguf", title: "LM Studio · GGUF", sub: "Made by your llama.cpp through Model Factory; measured as served by LM Studio." },
  { family: "compressed-tensors", title: "vLLM · compressed-tensors", sub: "Made by llm-compressor in its own environment; measured as served by vLLM." }];
const FAM_COLOR: Record<string, string> = { reference: "var(--cat-7)", gguf: "var(--cat-4)", "compressed-tensors": "var(--cat-1)" };

/** Accuracy vs size: every variant against the unquantized student, with the untrained student and teacher as reference lines. */
function Frontier({ d, split }: { d: LabT; split: string }) {
  const pts = [
    ...(d.bf16_bytes && d.unquantized[split]?.rate != null ? [{ key: "unquantized (16-bit)", size: d.bf16_bytes, r: d.unquantized[split], fam: "base", est: false }] : []),
    ...d.variants.filter((v) => v.size_bytes && v.results[split]?.rate != null).map((v) => ({ key: v.label, size: v.size_bytes!, r: v.results[split] as Rate, fam: v.family, est: v.simulated }))];
  if (!pts.length) return <Empty icon="chart">No measured variants on {split === "test" ? "the final test" : "practice tasks"} yet.</Empty>;
  const W = 640, H = 270, L = 48, R = 16, T = 12, B = 34;
  const sizes = pts.map((p) => p.size);
  const lo = Math.log10(Math.min(...sizes) * 0.7), hi = Math.log10(Math.max(...sizes) * 1.3);
  const x = (s: number) => L + ((Math.log10(s) - lo) / (hi - lo || 1)) * (W - L - R);
  const y = (v: number) => T + (1 - v) * (H - T - B);
  // Pareto frontier: smallest size for each accuracy level (no other point is both smaller and more accurate).
  const front = [...pts].sort((a, b) => a.size - b.size).reduce<typeof pts>((acc, p) => (acc.length && (p.r.rate ?? 0) <= (acc[acc.length - 1].r.rate ?? 0) ? acc : [...acc, p]), []);
  const ticks = [1e6, 2e6, 5e6, 1e7, 2e7, 5e7, 1e8, 2e8, 5e8, 1e9, 2e9, 5e9, 1e10, 2e10, 5e10].filter((t) => Math.log10(t) >= lo && Math.log10(t) <= hi);
  // Label placement: nudge labels that would collide with an earlier one (same neighbourhood) downwards.
  const placed: { x: number; y: number }[] = [];
  const labelY = new Map<string, number>();
  [...pts].sort((a, b) => (b.r.rate ?? 0) - (a.r.rate ?? 0)).forEach((p) => {
    const lx = x(p.size); let ly = y(p.r.rate ?? 0) + 3.5;
    while (placed.some((q) => Math.abs(q.x - lx) < 90 && Math.abs(q.y - ly) < 11)) ly += 11;
    placed.push({ x: lx, y: ly }); labelY.set(p.key, ly);
  });
  const anchor = (n: string) => d.anchors[n]?.[split]?.rate;
  return (
    <Figure title="Accuracy against size" y="strict success" x="model size (log scale) — up and to the left is better"
      legend={[{ label: "unquantized", color: "var(--s-tuned)" }, ...RUNTIMES.map((r) => ({ label: r.title, color: FAM_COLOR[r.family] })), { label: "untrained / teacher", color: "var(--ink-3)", dashed: true }]}
      caption={<>Each point: strict success with its 95 % range. Hollow = size estimated (FORGE reference variants are simulated). The line joins the variants nothing beats on both size and accuracy (the frontier).</>}>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full max-w-[820px]" role="img" aria-label={`Strict success against model size: ${pts.map((p) => `${p.key} ${fmtPct(p.r.rate)} at ${GB(p.size)}`).join("; ")}`}>
        {[0, 0.25, 0.5, 0.75, 1].map((v) => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--line)" /><text x={L - 6} y={y(v) + 3} fontSize={9.5} textAnchor="end" fill="var(--ink-3)">{Math.round(v * 100)}%</text></g>)}
        {ticks.map((t) => <text key={t} x={x(t)} y={H - 12} fontSize={9.5} textAnchor="middle" fill="var(--ink-3)">{GB(t).replace(".00", "").replace(".0 MB", " MB")}</text>)}
        {(["untrained", "teacher"] as const).map((n) => { const v = anchor(n); return v == null ? null : <g key={n}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--ink-3)" strokeDasharray="4 4" /><text x={L + 4} y={y(v) - 4} fontSize={10} textAnchor="start" fill="var(--ink-2)">{n} {fmtPct(v)}</text></g>; })}
        {front.length > 1 && <polyline fill="none" stroke="var(--ink-2)" strokeWidth={1.2} points={front.map((p) => `${x(p.size)},${y(p.r.rate ?? 0)}`).join(" ")} />}
        {pts.map((p) => { const c = p.fam === "base" ? "var(--s-tuned)" : FAM_COLOR[p.fam] ?? "var(--ink-2)"; return (
          <g key={p.key}>
            {p.r.ci && <line x1={x(p.size)} x2={x(p.size)} y1={y(p.r.ci[0])} y2={y(p.r.ci[1])} stroke={c} strokeWidth={2} strokeOpacity={0.6} />}
            <circle cx={x(p.size)} cy={y(p.r.rate ?? 0)} r={5.5} fill={p.est ? "var(--surface)" : c} stroke={c} strokeWidth={2}><title>{`${p.key}: ${fmtPct(p.r.rate, 1)} at ${GB(p.size)}${p.est ? " (estimated size)" : ""}`}</title></circle>
            {(() => { const right = x(p.size) > W - R - 130; return <text x={x(p.size) + (right ? -9 : 8)} y={labelY.get(p.key)} textAnchor={right ? "end" : "start"} fontSize={10} fill="var(--ink)" paintOrder="stroke" stroke="var(--surface)" strokeWidth={3}>{p.key}</text>; })()}
          </g>); })}
      </svg>
    </Figure>
  );
}

/** Per-layer quantization error: layers × projection kinds. */
function LayerMap({ sid, label }: { sid: string; label: string }) {
  const r = useApi<LayersT>(`/api/studies/${sid}/quant/${label}/layers`);
  const [metric, setMetric] = useState<"rel_error" | "rel_output_error">("rel_error");
  if (!r.data) return r.error ? <ErrorLine error={r.error} /> : <Skeleton h={140} />;
  const ls = r.data.layers;
  if (!ls.length) return <Empty icon="layers">No per-layer record: served variants are quantized outside FORGE.</Empty>;
  const hasOut = ls.some((l) => l.rel_output_error != null);
  const m = hasOut ? metric : "rel_error";
  const kinds = [...new Set(ls.map((l) => l.kind))];
  const layers = [...new Set(ls.map((l) => l.layer ?? -1))].sort((a, b) => a - b);
  const val = (l: Layer) => (m === "rel_output_error" ? l.rel_output_error ?? 0 : l.rel_error);
  const max = Math.max(...ls.map(val), 1e-9);
  const cell = new Map(ls.map((l) => [`${l.layer ?? -1}|${l.kind}`, l]));
  const shade = (v: number) => `color-mix(in oklab, var(--seq-3) ${Math.round(12 + (v / max) * 88)}%, var(--surface))`;
  const worst = [...ls].sort((a, b) => val(b) - val(a)).slice(0, 3);
  return (
    <Figure title={`Where the rounding error is — ${label}`} x="layer" y="projection"
      caption={<>Darker = larger relative error ‖W − Ŵ‖ / ‖W‖{m === "rel_output_error" ? ", weighted by how strongly each input channel is used" : ""}. Worst: {worst.map((l) => `${l.module.split(".").slice(-3).join(".")} ${(val(l) * 100).toFixed(2)} %`).join(" · ")}.</>}>
      {hasOut && <div className="mb-2"><Segmented label="Error" value={metric} onChange={setMetric} options={[{ value: "rel_error", label: "weight error" }, { value: "rel_output_error", label: "output-weighted" }]} /></div>}
      <div className="overflow-x-auto" tabIndex={0} aria-label="Per-layer error map, scrollable">
        <table className="border-separate border-spacing-[2px] text-[10.5px]" role="grid" aria-label={`Per-layer ${m === "rel_error" ? "weight" : "output-weighted"} error`}>
          <thead><tr><th className="pr-1 text-right font-normal text-ink-3" scope="col">kind \ layer</th>{layers.map((n) => <th key={n} scope="col" className="w-6 font-mono font-normal text-ink-3">{n < 0 ? "—" : n}</th>)}</tr></thead>
          <tbody>{kinds.map((k) => (
            <tr key={k}><th scope="row" className="pr-1 text-right font-mono font-normal text-ink-2">{k}</th>
              {layers.map((n) => { const l = cell.get(`${n}|${k}`); return <td key={n} className="h-5 w-6 rounded-[3px]" style={{ background: l ? shade(val(l)) : "transparent" }} title={l ? `${l.module}: ${(val(l) * 100).toFixed(3)} %, SQNR ${l.sqnr_db.toFixed(1)} dB${l.alpha != null ? `, α ${l.alpha.toFixed(1)}` : ""}` : ""} aria-label={l ? `layer ${n} ${k} ${(val(l) * 100).toFixed(2)} percent` : undefined} />; })}</tr>))}</tbody>
        </table>
      </div>
      <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-ink-3"><span>0</span><span className="h-2 w-28 rounded" style={{ background: `linear-gradient(90deg, ${shade(0)}, ${shade(max)})` }} /><span>{(max * 100).toFixed(2)} %</span></div>
    </Figure>
  );
}

/** The plain answer: the smallest variant that behaves like the unquantized student on these tasks. */
function pick(d: LabT, split: string): { v: Variant; diff: number } | null {
  const u = d.unquantized[split]?.rate;
  if (u == null) return null;
  const ok = d.variants.map((v) => ({ v, r: v.results[split] })).filter(({ v, r }) => r?.rate != null && v.size_bytes && (r.agreement ?? 0) >= 0.95 && (r.rate! - u) >= -0.02 && (r.mcnemar_p ?? 1) >= 0.05);
  ok.sort((a, b) => (a.v.size_bytes ?? 0) - (b.v.size_bytes ?? 0));
  return ok[0] ? { v: ok[0].v, diff: ok[0].r!.rate! - u } : null;
}

export default function QuantLab() {
  const { prefs } = usePrefs();
  const expert = prefs.mode === "expert";
  const sid = prefs.activeStudy ?? null;
  const q = useApi<LabT>(sid ? `/api/studies/${sid}/quant` : null, 5000);
  const d = q.data;
  const [split, setSplit] = useState<"dev" | "test">("dev");
  const [pickL, setPickL] = useState<string | null>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [recipe, setRecipe] = useState<RecipeT | null>(null);
  const [fam, setFam] = useState("reference");
  const [srv, setSrv] = useState({ method: "gguf_q4_k_m_imatrix", label: "", endpoint: "http://127.0.0.1:1234/v1", model: "", size_gb: "" });
  const [found, setFound] = useState<string[] | null>(null);
  const [job, setJob] = useState<{ id: string; what: string } | null>(null);
  const act = useAction();
  const start = (what: string, path: string, body: unknown) => void act.run(async () => { const j = await api.post<Job>(path, body); setJob({ id: j.id, what }); });
  const refVariants = useMemo(() => d?.variants.filter((v) => v.family === "reference") ?? [], [d]);
  const layerPick = pickL && d?.variants.some((v) => v.label === pickL) ? pickL : refVariants[0]?.label ?? null;
  const served = d?.methods.filter((m) => m.family !== "reference") ?? [];
  const unq = d?.unquantized[split];
  const best = d ? pick(d, split) : null;
  const cols = expert ? ["variant", "method", "size", "strict success", "vs unquantized", "same verdict", "only-q / only-u", "McNemar p", "speed", ""] : ["variant", "how", "size", "strict success", "vs unquantized", "same verdict on", ""];
  return (
    <div className="space-y-4">
      <PageHeader kicker="Make it smaller & ship" title="Quantization Lab"
        subtitle="Make smaller versions of the trained student — in FORGE, for LM Studio or for vLLM — and see exactly what each one costs on the study's own tasks."
        right={<div className="flex flex-wrap items-center gap-2"><StudySelect /><Segmented label="Split" value={split} onChange={setSplit} options={[{ value: "dev", label: "practice (dev)" }, { value: "test", label: "final test" }]} /></div>} />
      <ErrorLine error={q.error} />
      {!sid ? <Panel><Empty icon="layers">Choose a study in the top bar.</Empty></Panel> : !d ? <Skeleton h={300} /> : (
        <>
          {!d.source && <Notice tone="warn">Quantization starts from the study's verified merged export. Seal the study, run the final test, then export (Pipeline → Make it smaller &amp; ship). Served variants can still be measured.</Notice>}
          {job && <Panel title={`Working: ${job.what}`} eyebrow="live"><JobLog key={job.id} jobId={job.id} height={160} onDone={() => { setJob(null); void q.reload(); }} /></Panel>}
          <Panel title="The answer" prov={<Prov kind="measured" source={split === "test" ? "sealed final test" : "practice tasks"} />}>
            {!d.variants.length ? <p className="text-[13px] text-ink-2">No smaller versions yet. Start with <b>8-bit</b> (almost always safe) and <b>4-bit activation-aware</b> below, then compare.</p>
              : best ? <p className="text-[13px] text-ink-2"><b className="text-good-ink">Smallest version that behaves like the original: {best.v.label}</b> — {GB(best.v.size_bytes)}{best.v.simulated ? " (estimated)" : ""} instead of {GB(d.bf16_bytes)}, {best.diff >= 0 ? "+" : "−"}{Math.abs(best.diff * 100).toFixed(1)} pts, same verdict on {fmtPct(best.v.results[split]?.agreement)} of tasks{split === "dev" ? ". Confirm it once on the final test." : "."}
                {best.v.simulated && " It is a FORGE simulation: make the real file for LM Studio or vLLM with the same bit width, then measure that."}</p>
              : <p className="text-[13px] text-warn-ink"><b>No version matches the original yet</b> on {split === "test" ? "the final test" : "practice tasks"} (needs ≥ 95 % same verdicts and no measurable drop). Try a higher bit width{unq?.rate == null ? " — or measure the unquantized student first" : ""}.</p>}
          </Panel>
          <Panel title="Size against accuracy" prov={<Prov kind="measured" source="same tasks, tools and scoring" />}
            right={<Explain title="Quantization" what={<>Quantization stores each weight with fewer bits. Each smaller version is a new model, measured on the same tasks as the original, task by task.</>}
              read={<ul className="list-disc space-y-1 pl-4"><li><b>Same verdict</b>: share of tasks where the smaller version and the original are both right or both wrong.</li><li>Expert mode adds which tasks only one of them gets right and McNemar's test of that difference.</li><li>Choose on practice tasks; confirm the chosen version once on the final test.</li></ul>}
              math={<p>Reference quantizer: per group of g weights, scale = max|w| / (2^(b−1) − 1), ŵ = round(w/scale)·scale. Activation-aware: scale input channels by a^α before rounding, α chosen per layer to minimise ‖(W − Ŵ)·diag(a)‖.</p>} />}>
            <Frontier d={d} split={split} />
          </Panel>
          <Panel title="Versions" prov={<Prov kind="measured" />}>
            {!d.variants.length ? <Empty icon="layers">None yet — make one below.</Empty> : (
              <div className="overflow-x-auto" tabIndex={0} aria-label="Versions, scrollable"><table className={cx("w-full text-[12px]", expert ? "min-w-[920px]" : "min-w-[640px]")}>
                <thead><tr>{cols.map((h, i) => <th key={h + i} className={cx(th, i >= 2 && i < cols.length - 1 && "text-right")}>{h}</th>)}</tr></thead>
                <tbody>
                  {unq && <tr className={tr}><td className={cx(td, "font-medium")}>original</td><td className={td}>16-bit merged export</td><td className={cx(td, "num whitespace-nowrap text-right font-mono")}>{GB(d.bf16_bytes)}</td>
                    <td className={cx(td, "num whitespace-nowrap text-right font-mono")}>{fmtPct(unq.rate, 1)}</td>{Array.from({ length: cols.length - 4 }, (_, k) => <td key={k} className={td} />)}</tr>}
                  {d.variants.map((v) => { const r = v.results[split]; const diff = r?.rate != null && unq?.rate != null ? r.rate - unq.rate : null; return (
                    <tr key={v.label} className={cx(tr, best?.v.label === v.label && "bg-[color:var(--good)]/[0.05]")}>
                      <td className={cx(td, "whitespace-nowrap font-mono")}><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: FAM_COLOR[v.family] }} />{v.label}{best?.v.label === v.label && <span className="ml-1.5"><Badge tone="good">smallest match</Badge></span>}</td>
                      <td className={td}>{v.method_label}{v.simulated && <span className="ml-1"><Badge>simulated</Badge></span>}</td>
                      <td className={cx(td, "num whitespace-nowrap text-right font-mono")}>{GB(v.size_bytes)}{v.simulated && v.size_bytes ? " est." : ""}</td>
                      <td className={cx(td, "num whitespace-nowrap text-right font-mono")}>{r ? `${fmtPct(r.rate, 1)}${expert && r.ci ? ` (${fmtPct(r.ci[0])}–${fmtPct(r.ci[1])})` : ""}` : "—"}</td>
                      <td className={cx(td, "num text-right font-mono", diff != null && diff < -0.02 && "text-crit-ink")}>{diff == null ? "—" : `${diff >= 0 ? "+" : "−"}${Math.abs(diff * 100).toFixed(1)} pts`}</td>
                      <td className={cx(td, "num text-right font-mono")}>{r?.agreement == null ? "—" : `${fmtPct(r.agreement)}${expert ? "" : " of tasks"}`}</td>
                      {expert && <><td className={cx(td, "num text-right font-mono")}>{r ? `${r.only_quant_right} / ${r.only_unquantized_right}` : "—"}</td>
                        <td className={cx(td, "num text-right font-mono")}>{r?.mcnemar_p == null ? "—" : r.mcnemar_p.toFixed(3)}</td>
                        <td className={cx(td, "num whitespace-nowrap text-right font-mono")} title={v.simulated ? "16-bit simulation speed, not a real low-bit kernel" : "measured while answering the tasks"}>{r?.speed ? `${r.speed.tokens_per_s.toFixed(1)} tok/s${v.simulated ? "*" : ""}` : "—"}</td></>}
                      <td className={cx(td, "whitespace-nowrap text-right [&>*+*]:ml-1")}>
                        {!r && (split === "dev" || d.sealed) && <Button size="sm" busy={act.busy} disabled={!!job} onClick={() => start(`measure ${v.label} on ${split}`, `/api/studies/${sid}/quant/${v.label}/evaluate`, { split })}>Measure</Button>}
                        {v.family === "reference" && <Button size="sm" onClick={() => { setPickL(v.label); document.getElementById("q-layers")?.scrollIntoView({ behavior: "smooth" }); }}>Layers</Button>}
                        <Button size="sm" icon="compare" onClick={() => { handoff("compare.a", v.ref); handoff("compare.b", d.unquantized_ref); goto("compare"); }}>Compare</Button>
                      </td>
                    </tr>); })}
                </tbody></table>
                {expert && <p className="mt-1 text-[11px] text-ink-3">* speed of the 16-bit simulation, not representative of a low-bit kernel.</p>}</div>)}
            {split === "test" && !d.sealed && <div className="mt-2"><Notice tone="info">The final test opens after SEAL.</Notice></div>}
            <ErrorLine error={act.error} />
          </Panel>
          <div className="grid gap-4 xl:grid-cols-2 [&>*]:min-w-0">
            <Panel title="Make a smaller version" prov={<Prov kind="declared" source="method catalogue" />}>
              <div className="mb-3"><Segmented label="Where it will run" value={fam} onChange={(v) => { setFam(v); setRecipe(null); }} options={RUNTIMES.map((r) => ({ value: r.family, label: r.title }))} /></div>
              <p className="mb-2 text-[12px] text-ink-2">{RUNTIMES.find((r) => r.family === fam)?.sub}</p>
              <ul className="space-y-2">{d.methods.filter((m) => m.family === fam).map((m) => (
                <li key={m.id} className="rounded-[var(--radius)] border border-line p-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2"><div className="min-w-0"><div className="text-[12.5px] font-medium text-ink">{m.label}</div><div className="text-[11.5px] text-ink-2">{m.about}</div>
                    {expert && <div className="mt-0.5 font-mono text-[10.5px] text-ink-3">≈{m.bits} bits{m.group ? ` · group ${m.group}` : ""}{m.calibrated ? " · calibrated on training split" : ""}{m.needs.length ? ` · needs ${m.needs.join(", ")}` : ""}</div>}</div>
                    {m.family === "reference" ? (
                      <span className="flex items-center gap-1.5 whitespace-nowrap"><input aria-label={`Label for ${m.label}`} className={cx(inputCls, "!w-28")} placeholder={m.id} value={labels[m.id] ?? ""} onChange={(e) => setLabels({ ...labels, [m.id]: e.target.value })} />
                        <Button size="sm" tone="primary" disabled={!d.source || !!job} busy={act.busy} onClick={() => start(`make ${labels[m.id] || m.id}`, `/api/studies/${sid}/quant/reference`, { method: m.id, label: labels[m.id] || null, split: "dev" })}>Make & measure</Button></span>
                    ) : <Button size="sm" disabled={!d.source} busy={act.busy} onClick={() => void act.run(async () => setRecipe(await api.get<RecipeT>(`/api/studies/${sid}/quant/recipe?method=${m.id}`)))}>How to make it</Button>}
                  </div>
                </li>))}</ul>
              {recipe && recipe.method.family === fam && (
                <div className="mt-3 rounded-[var(--radius)] border border-line bg-surface-2 p-3">
                  <div className="mb-1.5 text-[12.5px] font-medium text-ink">{recipe.method.label}: steps</div>
                  <ol className="list-decimal space-y-1.5 pl-5 text-[12px] text-ink-2">{recipe.steps.map((x) => <li key={x} className="break-words">{x}</li>)}</ol>
                  {expert && <div className="mt-2 font-mono text-[11px] text-ink-3 break-all">calibration: {recipe.calibration.samples} samples · {recipe.calibration.source} · sha256 {recipe.calibration.sha256.slice(0, 16)}…{recipe.spec ? <><br />spec: {recipe.spec}</> : null}</div>}
                </div>)}
            </Panel>
            <Panel title="Measure one that's running" prov={<Prov kind="measured" source="server on this machine" />}>
              <p className="mb-2 text-[12px] text-ink-2">A GGUF loaded in LM Studio, or a model served by vLLM: FORGE runs the study's tasks through it and adds it to the comparison.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Field label="Server"><select className={inputCls} value={srv.endpoint} onChange={(e) => { setSrv({ ...srv, endpoint: e.target.value, method: e.target.value.includes(":8000") ? "vllm_w4a16_gptq" : "gguf_q4_k_m_imatrix", model: "" }); setFound(null); }}>
                  <option value="http://127.0.0.1:1234/v1">LM Studio (127.0.0.1:1234)</option><option value="http://127.0.0.1:8000/v1">vLLM (127.0.0.1:8000)</option></select></Field>
                <Field label="Model">{found ? <select className={inputCls} value={srv.model} onChange={(e) => setSrv({ ...srv, model: e.target.value, label: srv.label || e.target.value.split("/").pop()!.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 30) })}>
                  <option value="">— choose —</option>{found.map((m) => <option key={m}>{m}</option>)}</select>
                  : <Button size="sm" busy={act.busy} onClick={() => void act.run(async () => setFound((await api.get<{ models: string[] }>(`/api/studies/${sid}/quant/served-models?endpoint=${encodeURIComponent(srv.endpoint)}`)).models))}>Find running models</Button>}</Field>
                <Field label="How it was made"><select className={inputCls} value={srv.method} onChange={(e) => setSrv({ ...srv, method: e.target.value })}>{served.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}</select></Field>
                <Field label="Label"><input className={inputCls} value={srv.label} placeholder="e.g. q4km_lmstudio" onChange={(e) => setSrv({ ...srv, label: e.target.value })} /></Field>
                {expert && <Field label="File size (GB, optional)"><input className={inputCls} inputMode="decimal" value={srv.size_gb} onChange={(e) => setSrv({ ...srv, size_gb: e.target.value })} /></Field>}
              </div>
              <div className="mt-2"><Button tone="primary" icon="play" busy={act.busy} disabled={!srv.label.trim() || !srv.model.trim() || !!job}
                onClick={() => start(`measure served ${srv.label}`, `/api/studies/${sid}/quant/served`, { method: srv.method, label: srv.label, endpoint: srv.endpoint, model: srv.model, split: "dev", size_bytes: srv.size_gb ? Math.round(Number(srv.size_gb) * 1e9) : null })}>Measure on practice tasks</Button></div>
            </Panel>
          </div>
          {layerPick && expert && <div id="q-layers"><Panel title="Per-layer error" prov={<Prov kind="measured" source="exact, from the quantized weights" />}
            right={refVariants.length > 1 ? <select aria-label="Version" className={cx(inputCls, "w-40")} value={layerPick} onChange={(e) => setPickL(e.target.value)}>{refVariants.map((v) => <option key={v.label}>{v.label}</option>)}</select> : undefined}>
            <LayerMap sid={sid} label={layerPick} /></Panel></div>}
          {layerPick && !expert && <div id="q-layers"><Notice tone="info">Expert mode shows where in the model each version's rounding error is (per-layer map).</Notice></div>}
          <Limits>{d.honesty}</Limits>
        </>)}
    </div>
  );
}
