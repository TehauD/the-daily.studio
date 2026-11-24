import { useMemo, useRef, useState } from "react";
import { Icon } from "../components/icons";
import { StudySelect } from "../components/live";
import { Badge, Button, Empty, ErrorLine, Hash, KV, Notice, PageHeader, Panel, Prov, Segmented, Skeleton, Toggle, cx, inputCls, td, th, tr } from "../components/ui";
import { fmt, qs } from "../lib/api";
import { useApi } from "../lib/hooks";
import { usePrefs } from "../lib/prefs";
import type { KEdge, KMetric, KNode, KnowledgeT, ProjectionT } from "../lib/types";

const METRIC_LABEL: Record<KMetric, string> = {
  strict_success: "Strict success", answer_correct: "Answer correct", tool_selection_correct: "Tool selection",
  argument_accuracy: "Argument accuracy", invalid_rate: "Invalid-call rate (lower is better)",
};
const KIND: Record<KNode["kind"], { color: string; tag: string }> = {
  teacher: { color: "var(--s-teacher)", tag: "TEACHER" }, reference: { color: "var(--ink-3)", tag: "REFERENCE" },
  base: { color: "var(--s-base)", tag: "BASE STUDENT" }, tuned: { color: "var(--s-tuned)", tag: "TUNED STUDENT" },
  dataset: { color: "var(--seq-3)", tag: "DATASET" }, skill: { color: "var(--accent)", tag: "SKILL" }, tool: { color: "var(--ink-2)", tag: "TOOL" },
};
// Concrete font stacks (not CSS variables) so an exported SVG renders identically outside FORGE.
const MONO = "'JetBrains Mono','Cascadia Mono',Consolas,ui-monospace,monospace";
const SANS = "Inter,'Segoe UI Variable Text','Segoe UI',system-ui,sans-serif";
const NW = 200, NH = 58, COLW = 270, ROWH = 74, PADX = 20, PADY = 34;
const COL_TITLE = ["Sources", "Training data", "Tuned students", "Skills (measured)", "Tools"];

function sub(n: KNode): string {
  switch (n.kind) {
    case "teacher": return [n.provider, n.params ? fmt.params(n.params as number) : null, n.quant].filter(Boolean).join(" · ");
    case "base": return [n.params ? fmt.params((n.unique_params ?? n.params) as number) : null, n.base_hash ? `sha ${String(n.base_hash).slice(0, 8)}` : null].filter(Boolean).join(" · ");
    case "tuned": return `${n.seeds_trained}/${n.seeds_planned} seeds · r=${n.rank}`;
    case "dataset": return n.built ? `${n.records} records · ${n.episodes} episodes` : "not built yet";
    case "skill": return n.ood ? "held-out wording" : String(n.family ?? "");
    case "tool": return "read-only";
    default: return "";
  }
}

function edgeStroke(e: KEdge, nodes: Map<string, KNode>, metric: KMetric, delta: boolean): { color: string; width: number; dash?: string; opacity: number } {
  if (!e.measured) return { color: "var(--line-strong)", width: 1.2, dash: "4 4", opacity: 0.9 };
  if (e.kind === "requires") return { color: "var(--line-strong)", width: 1.2, opacity: 0.9 };
  if (e.kind !== "performs") return { color: "var(--ink-2)", width: 1.6, opacity: 0.85 };
  const src = nodes.get(e.from)!;
  if (delta) {
    const d = e.delta_vs_base?.[metric];
    if (d == null) return { color: KIND[src.kind].color, width: 1, opacity: 0.18 };
    const good = metric === "invalid_rate" ? d < 0 : d > 0;
    return { color: Math.abs(d) < 1e-9 ? "var(--div-mid)" : good ? "var(--div-pos)" : "var(--div-neg)", width: 1.2 + 9 * Math.abs(d), opacity: 0.85 };
  }
  const v = e.metrics?.[metric] ?? 0;
  return { color: KIND[src.kind].color, width: 0.8 + 7 * v, opacity: 0.25 + 0.6 * v };
}

function resolveVars(svg: SVGSVGElement): string {
  const cs = getComputedStyle(document.documentElement);
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("style", `background:${cs.getPropertyValue("--surface").trim()}`);
  return new XMLSerializer().serializeToString(clone).replace(/var\(--([\w-]+)\)/g, (_, v) => cs.getPropertyValue(`--${v}`).trim());
}

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  Object.assign(document.createElement("a"), { href: url, download: name }).click();
  URL.revokeObjectURL(url);
}

export default function Knowledge() {
  const { prefs } = usePrefs();
  const sid = prefs.activeStudy;
  const [view, setView] = useState<"auto" | "dev" | "heldout">("auto");
  const [metric, setMetric] = useState<KMetric>("strict_success");
  const [delta, setDelta] = useState(false);
  const [showProv, setShowProv] = useState(true);
  const [showCap, setShowCap] = useState(true);
  const [sel, setSel] = useState<string | null>(null);
  const g = useApi<KnowledgeT>(sid ? `/api/studies/${sid}/knowledge${qs({ view })}` : null, 15000);
  const svgRef = useRef<SVGSVGElement>(null);
  const node = g.data?.nodes.find((n) => n.id === sel) ?? null;
  return (
    <div className="space-y-4 fit:flex fit:h-full fit:min-h-0 fit:flex-col fit:space-y-0">
      <PageHeader kicker="See inside & control" title="Knowledge Graph" subtitle="Teacher, data, base and tuned students, skills, and tools — with measured capability on every edge. Built from the study's own files; nothing is inferred about concepts inside the weights."
        right={<>
          <StudySelect />
          <Segmented label="Evaluation view" value={view} onChange={setView} options={[{ value: "auto", label: "auto" }, { value: "dev", label: "dev" }, { value: "heldout", label: "held-out" }]} />
          <select className={cx(inputCls, "h-8 !w-auto max-w-[260px] font-sans")} value={metric} onChange={(e) => setMetric(e.target.value as KMetric)} aria-label="Metric">
            {(Object.keys(METRIC_LABEL) as KMetric[]).map((m) => <option key={m} value={m}>{METRIC_LABEL[m]}</option>)}
          </select>
          <Toggle checked={delta} onChange={setDelta} label="Δ vs base" />
        </>} />
      <ErrorLine error={g.error} />
      {!sid ? <Panel><Empty icon="graph">Select or create a study.</Empty></Panel> : !g.data ? <Skeleton h={480} /> : (
        <div className="grid gap-4 fit:min-h-0 fit:flex-1 fit:grid-cols-[minmax(0,1fr)_400px] 3xl:fit:grid-cols-[minmax(0,1fr)_460px]">
          <div className="flex min-w-0 flex-col gap-4 fit:min-h-0 fit:gap-3">
            <Panel fill flush className="fit:flex-[3]" title="Graph" prov={<Prov kind="measured" source={`${g.data.view} · ${g.data.splits.join(" + ")}`} />}
              right={<>
                <Toggle checked={showProv} onChange={setShowProv} label="Lineage" />
                <Toggle checked={showCap} onChange={setShowCap} label="Capability" />
                <Button size="sm" icon="download" onClick={() => svgRef.current && download(`forge-${g.data!.study_id}-graph.svg`, resolveVars(svgRef.current), "image/svg+xml")}>SVG</Button>
                <Button size="sm" icon="download" onClick={() => download(`forge-${g.data!.study_id}-graph.json`, JSON.stringify(g.data, null, 2), "application/json")}>JSON</Button>
                <a className="inline-flex h-7 items-center gap-1.5 rounded-[calc(var(--radius)-1px)] border border-line-strong px-2.5 text-[11.5px] font-medium text-ink hover:bg-accent-soft"
                  href={`/api/studies/${sid}/knowledge${qs({ view, format: "graphml" })}`} download><Icon name="download" size={14} />GraphML</a>
              </>}>
              <GraphCanvas g={g.data} metric={metric} delta={delta} showProv={showProv} showCap={showCap} sel={sel} onSelect={setSel} svgRef={svgRef} />
            </Panel>
            <Panel fill flush className="fit:flex-[2]" title="Capability matrix" eyebrow={METRIC_LABEL[metric]} prov={<Prov kind="computed" source="episodes pooled across seeds · Wilson 95%" />}>
              <Matrix g={g.data} metric={metric} onSelect={setSel} sel={sel} />
            </Panel>
          </div>
          <Panel fill title={node ? node.label : "Inspector"} eyebrow={node ? KIND[node.kind].tag : undefined} className="fit:min-h-0">
            {node ? <Inspector n={node} g={g.data} sid={sid} metric={metric} /> : (
              <div className="space-y-3 text-[12.5px] text-ink-2">
                <p>Click any node. Tuned students show what training changed: measured gains and regressions against the base, adapter statistics, and a token projection of the update directions.</p>
                <Notice tone="honesty">{g.data.honesty}</Notice>
                <div className="text-[11.5px] text-ink-3">{g.data.provenance}.</div>
              </div>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}

function GraphCanvas({ g, metric, delta, showProv, showCap, sel, onSelect, svgRef }: {
  g: KnowledgeT; metric: KMetric; delta: boolean; showProv: boolean; showCap: boolean; sel: string | null;
  onSelect: (id: string | null) => void; svgRef: React.RefObject<SVGSVGElement | null>;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const [hoverEdge, setHoverEdge] = useState<KEdge | null>(null);
  const nodes = useMemo(() => new Map(g.nodes.map((n) => [n.id, n])), [g]);
  const W = PADX * 2 + (g.cols - 1) * COLW + NW, H = PADY + g.rows * ROWH + 8;
  const pos = (n: KNode) => ({ x: PADX + n.col * COLW, y: PADY + n.y * ROWH });
  const focus = hover ?? sel;
  const linked = useMemo(() => {
    if (!focus) return null;
    const s = new Set([focus]);
    g.edges.forEach((e) => { if (e.from === focus || e.to === focus) { s.add(e.from); s.add(e.to); } });
    return s;
  }, [focus, g]);
  const edges = g.edges.filter((e) => (e.kind === "performs" ? showCap : showProv));
  return (
    <div className="relative h-full min-h-[420px]">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="block h-full w-full" role="img"
        aria-label="Study knowledge graph" onClick={() => onSelect(null)}>
        {COL_TITLE.slice(0, g.cols).map((t, i) => (
          <text key={t} x={PADX + i * COLW} y={16} fontFamily={MONO} fontSize={9.5} letterSpacing="0.08em" fill="var(--ink-3)">{t.toUpperCase()}</text>
        ))}
        {edges.map((e, i) => {
          const a = nodes.get(e.from), b = nodes.get(e.to);
          if (!a || !b) return null;
          const pa = pos(a), pb = pos(b);
          const back = b.col <= a.col;
          const x1 = pa.x + NW, y1 = pa.y + NH / 2, x2 = pb.x, y2 = pb.y + NH / 2;
          const d = back ? `M${pa.x + NW / 2},${pa.y + NH} C${pa.x + NW / 2},${pa.y + NH + 40} ${pb.x + NW / 2},${pb.y - 40} ${pb.x + NW / 2},${pb.y}`
            : `M${x1},${y1} C${x1 + (x2 - x1) * 0.45},${y1} ${x2 - (x2 - x1) * 0.45},${y2} ${x2},${y2}`;
          const s = edgeStroke(e, nodes, metric, delta);
          const dim = linked && !(linked.has(e.from) && linked.has(e.to)) ? 0.07 : s.opacity;
          return (
            <g key={i} onPointerEnter={() => setHoverEdge(e)} onPointerLeave={() => setHoverEdge(null)}>
              <path d={d} fill="none" stroke="transparent" strokeWidth={12} />
              <path d={d} fill="none" stroke={s.color} strokeWidth={s.width} strokeDasharray={s.dash} opacity={dim} strokeLinecap="round" />
            </g>
          );
        })}
        {g.nodes.map((n) => {
          const p = pos(n);
          const k = KIND[n.kind];
          const dim = linked && !linked.has(n.id);
          const selected = sel === n.id;
          return (
            <g key={n.id} transform={`translate(${p.x},${p.y})`} opacity={dim ? 0.3 : 1} className="cursor-pointer"
              onPointerEnter={() => setHover(n.id)} onPointerLeave={() => setHover(null)} onClick={(ev) => { ev.stopPropagation(); onSelect(n.id); }}
              role="button" aria-label={`${k.tag} ${n.label}`}>
              <rect width={NW} height={NH} rx={6} fill="var(--surface)" stroke={selected ? "var(--ink)" : "var(--line-strong)"} strokeWidth={selected ? 1.8 : 1}
                strokeDasharray={n.kind === "reference" ? "4 3" : undefined} />
              <rect x={0} y={6} width={3.5} height={NH - 12} rx={1.75} fill={k.color} />
              <text x={13} y={16} fontFamily={MONO} fontSize={8.5} letterSpacing="0.08em" fill="var(--ink-3)">{k.tag}</text>
              <text x={13} y={33} fontFamily={SANS} fontSize={12} fontWeight={600} fill="var(--ink)">{n.label.length > 26 ? n.label.slice(0, 25) + "…" : n.label}</text>
              <text x={13} y={48} fontFamily={MONO} fontSize={9.5} fill="var(--ink-2)">{sub(n).slice(0, 34)}</text>
            </g>
          );
        })}
      </svg>
      <div className="pointer-events-none absolute bottom-2 left-3 right-3 flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-wrap gap-x-3 gap-y-1 rounded bg-surface/90 px-2 py-1 text-[10.5px] text-ink-2 backdrop-blur">
          {(["teacher", "base", "tuned"] as const).map((k) => <span key={k} className="inline-flex items-center gap-1"><span className="h-[3px] w-4 rounded" style={{ background: KIND[k].color }} />{k}</span>)}
          {delta ? <><span className="inline-flex items-center gap-1"><span className="h-[3px] w-4 rounded bg-[color:var(--div-pos)]" />better than base</span><span className="inline-flex items-center gap-1"><span className="h-[3px] w-4 rounded bg-[color:var(--div-neg)]" />worse</span></>
            : <span className="text-ink-3">edge width = {METRIC_LABEL[metric].toLowerCase()}</span>}
          <span className="text-ink-3">dashed = not produced / not measured yet</span>
        </div>
        {hoverEdge && (
          <div className="rounded border border-line-strong bg-surface px-2.5 py-1.5 font-mono text-[11px] text-ink shadow">
            <div className="text-ink-3">{nodes.get(hoverEdge.from)?.label} → {nodes.get(hoverEdge.to)?.label}</div>
            {hoverEdge.kind === "performs" && hoverEdge.metrics ? (
              <div className="num">{METRIC_LABEL[metric].split(" (")[0]} {fmt.pct(hoverEdge.metrics[metric], 1)}
                {hoverEdge.ci?.[metric] && ` [${fmt.pct(hoverEdge.ci[metric]![0], 0)}–${fmt.pct(hoverEdge.ci[metric]![1], 0)}]`} · n={hoverEdge.n}
                {hoverEdge.delta_vs_base && <> · Δ {fmt.pp(hoverEdge.delta_vs_base[metric])}</>}</div>
            ) : <div>{hoverEdge.kind} · {hoverEdge.label}</div>}
          </div>
        )}
      </div>
    </div>
  );
}

function Matrix({ g, metric, onSelect, sel }: { g: KnowledgeT; metric: KMetric; onSelect: (id: string) => void; sel: string | null }) {
  const skills = g.nodes.filter((n) => n.kind === "skill");
  const models = g.nodes.filter((n) => ["teacher", "base", "tuned"].includes(n.kind));
  const cell = new Map(g.edges.filter((e) => e.kind === "performs").map((e) => [`${e.from}|${e.to}`, e]));
  return (
    <div className="scroll-thin overflow-auto">
      <table className="w-full text-[12px]">
        <thead className="sticky top-0 z-10 bg-surface-2"><tr><th className={th}>Model</th>{skills.map((s) => <th key={s.id} className={cx(th, "text-right")} title={s.label}>{s.label}</th>)}</tr></thead>
        <tbody>{models.map((m) => (
          <tr key={m.id} onClick={() => onSelect(m.id)} className={cx(tr, "cursor-pointer", sel === m.id && "!bg-accent-soft")}>
            <td className={cx(td, "whitespace-nowrap")}><span className="mr-2 inline-block h-2 w-2 rounded-full align-middle" style={{ background: KIND[m.kind].color }} />{m.label}</td>
            {skills.map((s) => {
              const e = cell.get(`${m.id}|${s.id}`);
              const v = e?.metrics?.[metric];
              const d = e?.delta_vs_base?.[metric];
              return (
                <td key={s.id} className={cx(td, "text-right")} title={e?.ci?.[metric] ? `Wilson 95% ${fmt.pct(e.ci[metric]![0], 0)}–${fmt.pct(e.ci[metric]![1], 0)} · n=${e.n}` : undefined}>
                  {v == null ? <span className="text-ink-3">—</span> : (
                    <div className="ml-auto flex w-[118px] items-center justify-end gap-2">
                      <span className="h-[5px] flex-1 rounded-full bg-surface-3"><span className="block h-full rounded-full" style={{ width: `${v * 100}%`, background: KIND[m.kind].color }} /></span>
                      <span className="num w-10 font-mono text-[11px] text-ink">{fmt.pct(v, 0)}</span>
                    </div>
                  )}
                  {d != null && Math.abs(d) > 1e-9 && <div className={cx("num font-mono text-[10px]", (metric === "invalid_rate" ? d < 0 : d > 0) ? "text-[color:var(--div-pos)]" : "text-[color:var(--div-neg)]")}>{fmt.pp(d, 0)} vs base</div>}
                </td>
              );
            })}
          </tr>))}
        </tbody>
      </table>
    </div>
  );
}

function Inspector({ n, g, sid, metric }: { n: KNode; g: KnowledgeT; sid: string; metric: KMetric }) {
  const rows: [string, React.ReactNode][] = [];
  const add = (k: string, v: unknown) => { if (v != null && v !== "") rows.push([k, typeof v === "number" ? (Number.isInteger(v) ? fmt.exact(v) : v.toExponential(3)) : String(v)]); };
  if (n.kind === "teacher") { add("provider", n.provider); add("endpoint", n.endpoint); add("parameters", n.params ? fmt.params(n.params as number) : null); add("quantization", n.quant); add("architecture", n.arch); add("context", n.context); }
  if (n.kind === "base") { add("stored params", n.params); add("unique params", n.unique_params); add("architecture", n.arch); rows.push(["base sha256", <Hash key="h" value={n.base_hash as string} n={18} />]); add("path", n.path); }
  if (n.kind === "dataset") { add("policy", n.policy); add("records", n.records); add("episodes", n.episodes); rows.push(["sha256", <Hash key="h" value={n.sha256 as string} n={18} />]); }
  if (n.kind === "reference" || n.kind === "tool") add("note", n.note);
  const perf = g.edges.filter((e) => e.kind === "performs" && (e.from === n.id || e.to === n.id));
  return (
    <div className="space-y-4">
      {rows.length > 0 && <KV rows={rows} />}
      {n.kind === "tuned" && <TunedProfile n={n} sid={sid} measured={g.edges.some((e) => e.from === n.id && e.delta_vs_base)} />}
      {perf.length > 0 && (
        <div>
          <div className="micro mb-1.5 text-ink-3">{n.kind === "skill" ? "Who performs this skill" : "Measured capability"} · {METRIC_LABEL[metric].split(" (")[0]}</div>
          <ul className="space-y-1.5">{perf.map((e) => {
            const other = g.nodes.find((x) => x.id === (n.kind === "skill" ? e.from : e.to))!;
            const v = e.metrics![metric];
            return (
              <li key={e.from + e.to} className="grid grid-cols-[minmax(0,1fr)_96px_52px] items-center gap-2 text-[11.5px]">
                <span className="truncate text-ink-2" title={other.label}>{other.label}</span>
                <span className="h-[5px] rounded-full bg-surface-3"><span className="block h-full rounded-full" style={{ width: `${v * 100}%`, background: KIND[(n.kind === "skill" ? other : n).kind].color }} /></span>
                <span className="num text-right font-mono text-ink">{fmt.pct(v, 0)}</span>
              </li>);
          })}</ul>
        </div>
      )}
    </div>
  );
}

function TunedProfile({ n, sid, measured }: { n: KNode; sid: string; measured: boolean }) {
  const trained = (n.trained_seeds as number[]) ?? [];
  const seedsDone = trained.length;
  const [seed, setSeed] = useState<number>(trained[0] ?? 0);
  const proj = useApi<ProjectionT>(seedsDone ? `/api/studies/${sid}/projection${qs({ arm: n.arm as string, seed, layers: 4, k: 10 })}` : null);
  const gains = (n.gains as { skill: string; delta: number }[]) ?? [];
  const regs = (n.regressions as { skill: string; delta: number }[]) ?? [];
  return (
    <div className="space-y-4">
      <div>
        <KV rows={[["arm", String(n.arm)], ["factor vs primary", Object.entries(n.factor as Record<string, unknown>).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`).join(" · ")], ["seeds trained", `${n.seeds_trained} / ${n.seeds_planned}`],
          ["trainable params", fmt.exact(n.trainable_params as number)], [`tokens seen (s${trained[0] ?? 0})`, fmt.exact(n.tokens_seen as number)],
          ["mean ‖ΔW‖/‖W‖", n.mean_relative_change != null ? (n.mean_relative_change as number).toExponential(2) : "—"],
          ["mean eff. rank", n.mean_effective_rank != null ? `${(n.mean_effective_rank as number).toFixed(2)} / ${n.rank}` : "—"],
          ["peak VRAM", n.peak_vram_mb ? fmt.mb(n.peak_vram_mb as number) : "—"]]} />
      </div>
      <div>
        <div className="micro mb-1.5 text-ink-3">After training · strict success vs base</div>
        {gains.length + regs.length === 0 ? <div className="text-[12px] text-ink-3">{measured ? "Measured: no difference from the base student on any skill in this view." : "Not evaluated on this view yet."}</div> : (
          <ul className="space-y-1">
            {[...gains, ...regs].map((x) => (
              <li key={x.skill} className="flex items-center justify-between text-[12px]"><span className="text-ink-2">{x.skill}</span>
                <span className={cx("num font-mono", x.delta > 0 ? "text-[color:var(--div-pos)]" : "text-[color:var(--div-neg)]")}>{fmt.pp(x.delta, 0)}</span></li>))}
          </ul>
        )}
      </div>
      <div className="border-t border-line pt-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2"><span className="micro text-ink-3">Token projection</span><Prov kind="computed" source="heuristic · from weights" /></div>
          {seedsDone > 1 && <select className={cx(inputCls, "h-7 w-auto")} value={seed} onChange={(e) => setSeed(Number(e.target.value))} aria-label="Seed">
            {trained.map((s) => <option key={s} value={s}>seed {s}</option>)}</select>}
        </div>
        {!seedsDone ? <div className="text-[12px] text-ink-3">Train this arm to project its adapter.</div> : proj.error ? <ErrorLine error={proj.error} /> : !proj.data ? <Skeleton h={160} /> : (
          <div className="space-y-3">
            {proj.data.modules.slice().reverse().map((m) => (
              <div key={m.module} className="rounded-[var(--radius)] border border-line p-2.5">
                <div className="mb-1.5 flex items-baseline justify-between font-mono text-[10.5px]">
                  <span className="text-ink">L{m.layer} · {m.kind}</span>
                  <span className="text-ink-3">σ₁ {m.sigma1.toExponential(2)} · {fmt.pct(m.energy_share, 0)} of energy</span>
                </div>
                {(["plus", "minus"] as const).map((end) => (
                  <div key={end} className="mb-1 flex flex-wrap items-center gap-1">
                    <span className="w-8 font-mono text-[10px] text-ink-3">{end === "plus" ? "+u₁" : "−u₁"}</span>
                    {m[end].slice(0, 8).map((t) => (
                      <span key={t.id} title={`token id ${t.id} · z ${t.z.toFixed(1)}`}
                        className={cx("rounded-[3px] border px-1.5 py-[1px] font-mono text-[10.5px]", t.special ? "border-accent-line text-accent" : "border-line-strong text-ink")}>
                        {t.token}<span className="ml-1 text-[9px] text-ink-3">{Math.abs(t.z).toFixed(0)}σ</span>
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            ))}
            <ul className="list-inside list-disc space-y-0.5 text-[11px] leading-snug text-ink-3">{proj.data.caveats.map((c) => <li key={c}>{c}</li>)}</ul>
            <div className="font-mono text-[10px] text-ink-3">{proj.data.method} · {proj.data.unembedding} · vocab {fmt.exact(proj.data.vocab_size)}</div>
            <Badge>{proj.data.adapter_sha256.slice(0, 12)}</Badge>
          </div>
        )}
      </div>
    </div>
  );
}
