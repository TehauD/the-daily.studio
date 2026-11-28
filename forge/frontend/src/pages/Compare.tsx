import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { Explain } from "../components/Explain";
import { Figure, Limits, Score, fmtPct } from "../components/results";
import { Badge, Button, Empty, ErrorLine, Notice, PageHeader, Panel, Prov, Segmented, Skeleton, Toggle, cx, inputCls, td, th, tr } from "../components/ui";
import { goto, handoff, takeHandoff } from "../lib/handoff";
import { useApi } from "../lib/hooks";
import { Sym } from "../lib/math";

interface SubjectT { ref: string; label: string; group: string; splits: string[]; kind: string; taskset: string; adapter: boolean; model: string }
interface Fam { family: string; n: number; rate_a: number; rate_b: number; delta: number; delta_ci: number[]; differ: number }
interface UnitRow { unit: string; id: string; family: string; prompt: string; a: number; b: number; a_seeds: number; b_seeds: number }
interface SideStats { per_seed: Record<string, { rate: number; n: number }>; invalid_rate: number | null; mean_tokens: number | null; median_latency_ms: number | null }
interface WMod { module: string; layer: number | null; kind: string; norm_a: number; norm_b: number; cosine: number | null; rel_distance: number | null }
interface Weights { available: boolean; reason?: string; modules?: WMod[]; overall_cosine?: number | null; norm_a?: number; norm_b?: number; rank_a?: number; rank_b?: number; only_a?: string[]; only_b?: string[]; note?: string }
interface CompareT {
  a: { ref: string; label: string; kind: string; split: string; seeds: number[] }; b: { ref: string; label: string; kind: string; split: string; seeds: number[] };
  coverage: { paired: number; only_a: number; only_b: number; same_id_different_content: number; examples_changed: string[]; same_task_set: boolean };
  honesty: string; comparable: boolean; reason?: string;
  overall?: { n_tasks: number; n_groups: number; rate_a: number; rate_b: number; ci_a: number[]; ci_b: number[]; delta: number; delta_ci: number[]; range_method: string;
    sign_flip_groups: { p: number; method: string; n_units: number; min_attainable_p: number } | null; mcnemar: { b: number; c: number; p: number; n_discordant: number } | null;
    outcomes: Record<string, number>; agreement: number };
  families?: Fam[]; sides?: { a: SideStats; b: SideStats }; units?: UnitRow[]; config?: { key: string; a: unknown; b: unknown; same: boolean }[]; weights?: Weights;
}
interface RecordT { seed: number; messages?: { role: string; content: unknown }[]; events?: { type: string; code?: string; detail?: string }[]; calls?: { tool: string; arguments: unknown; result?: unknown }[];
  answer?: string | null; termination?: string; score?: Record<string, unknown>; usage?: Record<string, number>; expected?: string; raw?: string; correct?: boolean; format?: string | null; image?: string | null; difficulty?: number }
interface UnitT { id: string; family: string; prompt: string; a: { label: string; kind: string; records: RecordT[] }; b: { label: string; kind: string; records: RecordT[] } }

const CA = "var(--cat-1)", CB = "var(--cat-2)";
const SPLIT_LABEL: Record<string, string> = { dev: "practice (dev)", test: "final test", ood: "unfamiliar (OOD)", regression: "regression", bench: "bench items" };
const pp = (v: number | null | undefined, d = 1) => (v == null ? "—" : `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(d)} pts`);
const pv = (p: number | null | undefined) => (p == null ? "—" : p < 0.0001 ? "< 0.0001" : p.toFixed(p < 0.01 ? 4 : 3));
const fmt = (v: unknown) => (v == null ? "—" : typeof v === "object" ? JSON.stringify(v) : String(v));

function Tag({ side }: { side: "A" | "B" }) {
  return <span className="inline-flex h-5 min-w-5 items-center justify-center rounded px-1 font-mono text-[11px] font-semibold text-white" style={{ background: `color-mix(in oklab, ${side === "A" ? CA : CB} 82%, black)` }} aria-label={`side ${side}`}>{side}</span>;
}

/** A difference with its 95 % range on a scale centred at zero — left of the line favours B, right favours A. */
function DiffBar({ delta, ci, max = 1, label }: { delta: number; ci: number[]; max?: number; label?: string }) {
  const x = (v: number) => 50 + (Math.max(-max, Math.min(max, v)) / max) * 50;
  const text = `${label ? `${label}: ` : ""}difference ${pp(delta)}, 95% range ${pp(ci[0])} to ${pp(ci[1])}`;
  return (
    <span className="relative block h-3 w-full" role="img" aria-label={text} title={text}>
      <span className="absolute inset-x-0 top-1.5 h-px bg-line-strong" />
      <span className="absolute top-0 h-3 w-px bg-ink-3" style={{ left: "50%" }} />
      <span className="absolute top-[3px] h-1.5 rounded-full" style={{ left: `${x(Math.min(ci[0], ci[1]))}%`, width: `${Math.max(0.6, x(Math.max(ci[0], ci[1])) - x(Math.min(ci[0], ci[1])))}%`,
        background: `color-mix(in oklab, ${delta >= 0 ? CA : CB} 45%, transparent)` }} />
      <span className="absolute top-0 h-3 w-[3px] rounded" style={{ left: `calc(${x(delta)}% - 1.5px)`, background: delta >= 0 ? CA : CB }} />
    </span>
  );
}

function Picker({ subjects, value, onChange, label, side, sameAs }: { subjects: SubjectT[]; value: string; onChange: (v: string) => void; label: string; side: "A" | "B"; sameAs?: string | null }) {
  const groups = useMemo(() => {
    const m = new Map<string, SubjectT[]>();
    subjects.forEach((s) => { const g = sameAs && s.taskset !== sameAs ? `Other tasks · ${s.group}` : s.group; m.set(g, [...(m.get(g) ?? []), s]); });
    return [...m.entries()].sort((a, b) => Number(a[0].startsWith("Other")) - Number(b[0].startsWith("Other")));
  }, [subjects, sameAs]);
  return (
    <label className="flex min-w-0 flex-1 items-center gap-2">
      <Tag side={side} />
      <span className="sr-only">{label}</span>
      <select className={cx(inputCls, "min-w-0 flex-1 font-sans")} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        <option value="">Choose…</option>
        {groups.map(([g, items]) => <optgroup key={g} label={g}>{items.map((s) => <option key={s.ref} value={s.ref}>{s.label}</option>)}</optgroup>)}
      </select>
    </label>
  );
}

function OutcomeGrid({ o, n, binary }: { o: Record<string, number>; n: number; binary: boolean }) {
  const cells: [string, string, number, string][] = [
    ["both right", "both_right", o.both_right, "var(--good)"], ["only A right", "only_a", o.only_a, CA],
    ["only B right", "only_b", o.only_b, CB], ["both wrong", "both_wrong", o.both_wrong, "var(--crit)"]];
  return (
    <div>
      <div className="grid grid-cols-2 gap-1.5" role="table" aria-label="Task outcomes, A against B">
        {cells.map(([lbl, k, v, c]) => (
          <div key={k} role="row" className="rounded-[var(--radius)] border border-line p-2.5" style={{ background: `color-mix(in oklab, ${c} ${Math.round(5 + (v / Math.max(1, n)) * 13)}%, var(--surface))` }}>
            <div role="cell" className="text-[11.5px] text-ink-2">{lbl}</div>
            <div role="cell" className="num font-mono text-[20px] font-medium leading-tight text-ink">{v}</div>
            <div className="font-mono text-[10.5px] text-ink-2">{fmtPct(v / Math.max(1, n))} of {n}</div>
          </div>))}
      </div>
      {!binary && <div className="mt-2 font-mono text-[11px] text-ink-3">mixed across seeds: A higher {o.a_higher} · B higher {o.b_higher} · equal {o.same_partial}</div>}
    </div>
  );
}

function FamilyChart({ fams }: { fams: Fam[] }) {
  const max = Math.max(0.25, ...fams.flatMap((f) => [Math.abs(f.delta_ci[0]), Math.abs(f.delta_ci[1])]));
  const m = Math.min(1, Math.ceil(max * 4) / 4);
  return (
    <Figure title="Where they differ, skill by skill" x={`difference A − B (percentage points, axis ±${Math.round(m * 100)})  ·  ← B higher · A higher →`}
      legend={[{ label: "A's rate", color: CA }, { label: "B's rate", color: CB }]}
      caption={<>Each row: both rates on the left; the difference with its 95 % range (<Sym k="boot" />, 2 000 resamples) on the right. Rows are sorted from most in B's favour to most in A's.</>}>
      <div className="overflow-x-auto" tabIndex={0} aria-label="Skills table, scrollable">
      <table className="w-full min-w-[620px] text-[12px]">
        <thead><tr><th className={th}>skill</th><th className={cx(th, "text-right")}>n</th><th className={cx(th, "w-[22%]")}>rates</th><th className={cx(th, "text-right")}>A</th><th className={cx(th, "text-right")}>B</th><th className={cx(th, "w-[30%]")}>difference</th><th className={cx(th, "text-right")}>Δ</th></tr></thead>
        <tbody>{fams.map((f) => (
          <tr key={f.family} className={tr}>
            <td className={cx(td, "font-mono")}>{f.family}</td><td className={cx(td, "num text-right font-mono text-ink-3")}>{f.n}</td>
            <td className={td}><span className="relative block h-3 w-full rounded-full bg-surface-3" role="img" aria-label={`A ${fmtPct(f.rate_a)}, B ${fmtPct(f.rate_b)}`}>
              <span className="absolute top-0 h-3 w-3 rounded-full border-2 border-surface" style={{ left: `calc(${f.rate_b * 100}% - 6px)`, background: CB }} />
              <span className="absolute top-0 h-3 w-3 rounded-full border-2 border-surface" style={{ left: `calc(${f.rate_a * 100}% - 6px)`, background: CA }} /></span></td>
            <td className={cx(td, "num text-right font-mono")}>{fmtPct(f.rate_a)}</td><td className={cx(td, "num text-right font-mono")}>{fmtPct(f.rate_b)}</td>
            <td className={td}><DiffBar delta={f.delta} ci={f.delta_ci} max={m} label={f.family} /></td>
            <td className={cx(td, "num whitespace-nowrap text-right font-mono")}>{pp(f.delta, 0)}</td>
          </tr>))}</tbody>
      </table>
      </div>
    </Figure>
  );
}

function cosColor(c: number | null) {
  if (c == null) return "var(--surface-3)";
  const t = Math.max(-1, Math.min(1, c));
  return t >= 0 ? `color-mix(in oklab, var(--div-pos) ${Math.round(t * 100)}%, var(--div-mid))` : `color-mix(in oklab, var(--div-neg) ${Math.round(-t * 100)}%, var(--div-mid))`;
}

function WeightsView({ w, a, b }: { w: Weights; a: string; b: string }) {
  const [hi, setHi] = useState<WMod | null>(null);
  if (!w.available) return <Notice tone="info">Weight comparison not available: {w.reason}.</Notice>;
  const mods = w.modules ?? [];
  const layers = [...new Set(mods.map((m) => m.layer).filter((x): x is number => x != null))].sort((x, y) => x - y);
  const kinds = [...new Set(mods.map((m) => m.kind))];
  const at = (l: number, k: string) => mods.find((m) => m.layer === l && m.kind === k);
  const worst = [...mods].filter((m) => m.cosine != null).sort((x, y) => (x.cosine ?? 0) - (y.cosine ?? 0)).slice(0, 8);
  const cell = Math.max(10, Math.min(26, Math.floor(640 / Math.max(1, layers.length))));
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] [&>*]:min-w-0">
      <Figure title="How similar the two weight changes are, module by module" x="layer" y="module"
        caption={<>Colour = <Sym k="cos" /> of ΔW between A and B for that module: blue = same direction of change, grey = unrelated, red = opposite. Exact from the LoRA factors; it says nothing about which side is better.</>}>
        <div className="overflow-x-auto" tabIndex={0} aria-label="Cosine heatmap, scrollable">
          <svg width={cell * layers.length + 74} height={cell * kinds.length + 18} role="img" aria-label={`Cosine of weight changes per module; overall ${w.overall_cosine?.toFixed(3)}`} onMouseLeave={() => setHi(null)}>
            {kinds.map((k, i) => <text key={k} x={70} y={i * cell + cell / 2 + 4} fontSize={10} textAnchor="end" fill="var(--ink-3)" fontFamily="var(--font-mono)">{k}</text>)}
            {layers.map((l, j) => kinds.map((k, i) => { const m = at(l, k); return (
              <rect key={`${l}-${k}`} x={74 + j * cell} y={i * cell} width={cell - 1.5} height={cell - 1.5} rx={2} fill={cosColor(m?.cosine ?? null)} onMouseEnter={() => m && setHi(m)}
                stroke={hi && m && hi.module === m.module ? "var(--ink)" : "none"} strokeWidth={1.5}><title>{m ? `${m.module}: cosine ${m.cosine?.toFixed(3)}` : "not adapted"}</title></rect>); }))}
            {layers.map((l, j) => (layers.length <= 24 || j % Math.ceil(layers.length / 14) === 0) && <text key={l} x={74 + j * cell + cell / 2} y={kinds.length * cell + 13} fontSize={9.5} textAnchor="middle" fill="var(--ink-3)">{l}</text>)}
          </svg>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-3 font-mono text-[11px] text-ink-3">
          <span className="flex items-center gap-1.5">−1<span className="h-2 w-24 rounded" style={{ background: "linear-gradient(90deg, var(--div-neg), var(--div-mid), var(--div-pos))" }} />+1</span>
          <span>{hi ? `${hi.module} · cos ${hi.cosine?.toFixed(3)} · ‖ΔW‖ A ${hi.norm_a.toExponential(2)} B ${hi.norm_b.toExponential(2)} · distance ${hi.rel_distance?.toFixed(2)}` : "hover a cell for its numbers"}</span>
        </div>
      </Figure>
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div><div className="micro text-ink-3">overall <Sym k="cos" /></div><div className="num font-mono text-[22px] text-ink">{w.overall_cosine?.toFixed(3)}</div></div>
          <div><div className="micro text-ink-3"><Sym k="fro">‖ΔW‖_F</Sym> A</div><div className="num font-mono text-[16px] text-ink">{w.norm_a?.toFixed(3)}</div><div className="font-mono text-[10.5px] text-ink-3">rank {w.rank_a}</div></div>
          <div><div className="micro text-ink-3"><Sym k="fro">‖ΔW‖_F</Sym> B</div><div className="num font-mono text-[16px] text-ink">{w.norm_b?.toFixed(3)}</div><div className="font-mono text-[10.5px] text-ink-3">rank {w.rank_b}</div></div>
        </div>
        <div>
          <div className="micro mb-1 text-ink-3">least similar modules</div>
          <table className="w-full text-[12px]"><thead><tr><th className={th}>module</th><th className={cx(th, "text-right")}>cosine</th><th className={cx(th, "text-right")}>distance</th></tr></thead>
            <tbody>{worst.map((m) => <tr key={m.module} className={tr}><td className={cx(td, "truncate font-mono text-[11px]")} title={m.module}>{m.module.replace(/^model\./, "")}</td>
              <td className={cx(td, "num text-right font-mono")}>{m.cosine?.toFixed(3)}</td><td className={cx(td, "num text-right font-mono")}>{m.rel_distance?.toFixed(2)}</td></tr>)}</tbody></table>
          <div className="mt-1.5 text-[11px] text-ink-3">distance = ‖ΔW_A − ΔW_B‖_F ÷ the larger of the two sizes. Open a module in <button type="button" className="underline decoration-dotted" onClick={() => goto("factory")}>Model Factory → weight microscope</button> to see either change in detail.</div>
        </div>
        {(w.only_a?.length || w.only_b?.length) ? <Notice tone="info">Adapted on one side only — A: {w.only_a?.length ?? 0}, B: {w.only_b?.length ?? 0} modules (not compared).</Notice> : null}
        <div className="sr-only">{a} versus {b}</div>
      </div>
    </div>
  );
}

function Content({ c }: { c: unknown }) {
  if (typeof c === "string") return <>{c}</>;
  if (Array.isArray(c)) return <>{c.map((p, i) => <span key={i}>{(p as { text?: string }).text ?? "[image]"} </span>)}</>;
  return <>{JSON.stringify(c)}</>;
}

function Record({ r, kind, rid }: { r: RecordT; kind: string; rid?: string }) {
  if (kind === "lane") return (
    <div className="space-y-2 text-[12px]">
      <div className="flex flex-wrap gap-2"><Badge tone={r.correct ? "good" : "crit"}>{r.correct ? "correct" : "wrong"}</Badge>{r.format && <Badge tone="warn">format: {r.format}</Badge>}{r.difficulty != null && <Badge>difficulty {r.difficulty}</Badge>}</div>
      <div className="grid grid-cols-[90px_1fr] gap-y-1 font-mono"><span className="text-ink-3">expected</span><span>{r.expected}</span><span className="text-ink-3">answer</span><span>{r.answer ?? "—"}</span></div>
      <details><summary className="cursor-pointer text-ink-3">raw reply</summary><pre className="mt-1 whitespace-pre-wrap break-words rounded bg-surface-2 p-2 font-mono text-[11px]">{r.raw}</pre></details>
      {r.image && rid && <img src={`/api/bench/runs/${rid}/images/${r.image}`} alt="The bench item's document image" className="max-h-64 rounded border border-line" />}
    </div>);
  const sc = r.score ?? {};
  const errs = (r.events ?? []).filter((e) => e.type === "error");
  return (
    <div className="space-y-2 text-[12px]">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge tone={sc.strict_success ? "good" : "crit"}>{sc.strict_success ? "success" : "failed"}</Badge>
        <Badge>seed {r.seed}</Badge><Badge>{r.termination}</Badge>
        {Number(sc.invalid_calls) > 0 && <Badge tone="warn">{String(sc.invalid_calls)} invalid call(s)</Badge>}
        {r.usage && <span className="font-mono text-[10.5px] text-ink-3">{r.usage.completion_tokens} tokens · {r.usage.latency_ms} ms</span>}
      </div>
      <div className="grid grid-cols-[110px_1fr] gap-y-1 font-mono text-[11.5px]">
        {(["answer_correct", "tool_selection_correct", "argument_accuracy", "unsupported_answer"] as const).filter((k) => k in sc).map((k) => <Fragment key={k}><span className="text-ink-3">{k.replace(/_/g, " ")}</span><span>{fmt(sc[k])}</span></Fragment>)}
        <span className="text-ink-3">final answer</span><span className="break-words">{r.answer ?? "—"}</span>
      </div>
      {(r.calls ?? []).length > 0 && <div><div className="micro mb-1 text-ink-3">tool calls</div>{r.calls!.map((cl, i) => <pre key={i} className="mb-1 whitespace-pre-wrap break-words rounded bg-surface-2 p-1.5 font-mono text-[11px]">{cl.tool}({JSON.stringify(cl.arguments)})</pre>)}</div>}
      {errs.length > 0 && <div className="space-y-1">{errs.map((e, i) => <div key={i} className="rounded border border-[color:var(--crit)]/40 bg-[color:var(--crit)]/5 px-2 py-1 font-mono text-[11px] text-crit-ink">{e.code}: {e.detail}</div>)}</div>}
      <details><summary className="cursor-pointer text-ink-3">full conversation ({(r.messages ?? []).length} messages)</summary>
        <ol className="mt-1.5 space-y-1.5">{(r.messages ?? []).map((m, i) => (
          <li key={i} className={cx("rounded border border-line px-2 py-1.5", m.role === "assistant" ? "bg-accent-soft" : m.role === "system" ? "bg-surface-2" : "bg-surface")}>
            <div className="micro mb-0.5 text-ink-3">{m.role}</div>
            <div className={cx("whitespace-pre-wrap break-words text-[11.5px]", m.role === "system" ? "max-h-28 overflow-y-auto font-mono text-ink-3" : "text-ink")}><Content c={m.content} /></div>
          </li>))}</ol></details>
    </div>
  );
}

function SideBySide({ a, b, split, unit, onClose }: { a: string; b: string; split: string; unit: string; onClose: () => void }) {
  const d = useApi<UnitT>(`/api/compare/unit?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}&split=${split}&unit=${unit}`);
  const rid = (ref: string) => (ref.startsWith("lane:") ? ref.split(":")[1] : undefined);
  return (
    <Panel title="One task, side by side" prov={<Prov kind="measured" source="stored episodes / bench rows" />} right={<Button size="sm" icon="x" onClick={onClose}>Close</Button>} id="sidebyside">
      <ErrorLine error={d.error} />
      {!d.data ? <Skeleton h={200} /> : (
        <div className="space-y-3">
          <div className="rounded-[var(--radius)] border border-line bg-surface-2 p-3"><div className="micro text-ink-3">{d.data.family} · {d.data.id}</div><div className="mt-0.5 text-[13px] text-ink">{d.data.prompt}</div></div>
          <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
            {(["a", "b"] as const).map((k) => (
              <section key={k} aria-label={`Side ${k.toUpperCase()}`} className="rounded-[var(--radius)] border p-3" style={{ borderColor: `color-mix(in oklab, ${k === "a" ? CA : CB} 45%, var(--line))` }}>
                <div className="mb-2 flex items-center gap-2"><Tag side={k === "a" ? "A" : "B"} /><span className="truncate text-[12.5px] font-medium text-ink">{d.data![k].label}</span></div>
                <div className="space-y-3 divide-y divide-line">{d.data![k].records.map((r, i) => <div key={i} className={i ? "pt-3" : ""}><Record r={r} kind={d.data![k].kind} rid={rid(k === "a" ? a : b)} /></div>)}</div>
              </section>))}
          </div>
        </div>)}
    </Panel>
  );
}

function TaskList({ units, onOpen, open }: { units: UnitRow[]; onOpen: (u: string) => void; open: string | null }) {
  const [filter, setFilter] = useState<"differ" | "a" | "b" | "all">("differ");
  const [fam, setFam] = useState("");
  const [n, setN] = useState(40);
  const fams = [...new Set(units.map((u) => u.family))].sort();
  const rows = units.filter((u) => (filter === "all" || (filter === "differ" ? u.a !== u.b : filter === "a" ? u.a > u.b : u.b > u.a)) && (!fam || u.family === fam));
  const cell = (v: number, seeds: number, c: string) => (
    <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full border" style={{ background: v >= 1 ? c : v > 0 ? `color-mix(in oklab, ${c} 45%, transparent)` : "transparent", borderColor: c }} />
      <span className="num font-mono">{seeds > 1 ? fmtPct(v) : v >= 1 ? "right" : "wrong"}</span></span>);
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Segmented label="Which tasks" value={filter} onChange={setFilter} options={[{ value: "differ", label: `they differ (${units.filter((u) => u.a !== u.b).length})` },
          { value: "a", label: "A better" }, { value: "b", label: "B better" }, { value: "all", label: `all (${units.length})` }]} />
        <select className={cx(inputCls, "!w-auto font-sans")} value={fam} onChange={(e) => setFam(e.target.value)} aria-label="Skill"><option value="">all skills</option>{fams.map((f) => <option key={f}>{f}</option>)}</select>
      </div>
      {!rows.length ? <Empty icon="check">No tasks match — {filter === "differ" ? "A and B got exactly the same tasks right and wrong." : "try another filter."}</Empty> : (
        <div className="overflow-x-auto" tabIndex={0} aria-label="Paired tasks, scrollable">
          <table className="w-full min-w-[640px] text-[12px]">
            <thead><tr><th className={th}>skill</th><th className={th}>task</th><th className={th}><Tag side="A" /></th><th className={th}><Tag side="B" /></th><th className={th}><span className="sr-only">open</span></th></tr></thead>
            <tbody>{rows.slice(0, n).map((u) => (
              <tr key={u.unit} className={cx(tr, open === u.unit && "bg-accent-soft")}>
                <td className={cx(td, "whitespace-nowrap font-mono text-[11px] text-ink-3")}>{u.family}</td>
                <td className={cx(td, "max-w-[520px]")}><div className="truncate" title={u.prompt}>{u.prompt}</div></td>
                <td className={cx(td, "whitespace-nowrap")}>{cell(u.a, u.a_seeds, CA)}</td><td className={cx(td, "whitespace-nowrap")}>{cell(u.b, u.b_seeds, CB)}</td>
                <td className={cx(td, "text-right")}><Button size="sm" onClick={() => onOpen(u.unit)}>Side by side</Button></td>
              </tr>))}</tbody>
          </table>
          {rows.length > n && <div className="mt-2"><Button size="sm" onClick={() => setN(n + 60)}>Show more ({rows.length - n} left)</Button></div>}
        </div>)}
    </div>
  );
}

/** Compare any two measured things on byte-identical tasks: rates, the paired difference, skills, tasks side by side,
 *  configuration and — for two adapters on one base — the weight changes themselves. */
export default function Compare() {
  const subs = useApi<{ subjects: SubjectT[] }>("/api/compare/subjects", 30000);
  const list = useMemo(() => subs.data?.subjects ?? [], [subs.data]);
  const [a, setA] = useState(() => takeHandoff("compare.a") ?? "");
  const [b, setB] = useState(() => takeHandoff("compare.b") ?? "");
  const [split, setSplit] = useState("dev");
  const [all, setAll] = useState(false);
  const [unit, setUnit] = useState<string | null>(null);
  const [onlyDiff, setOnlyDiff] = useState(true);
  const SA = list.find((s) => s.ref === a), SB = list.find((s) => s.ref === b);
  useEffect(() => {
    if (!list.length || a) return;
    const t = list.find((s) => s.kind === "arm" && !/:(base|teacher)$/.test(s.ref) && s.splits.includes("dev"));
    if (t) { setA(t.ref); const base = list.find((s) => s.ref === t.ref.split(":").slice(0, 2).join(":") + ":base"); if (base && !b) setB(base.ref); }
  }, [list, a, b]);
  const bChoices = useMemo(() => list.filter((s) => s.ref !== a && (all || !SA || s.taskset === SA.taskset)), [list, a, all, SA]);
  const splits = useMemo(() => {
    if (!SA || !SB) return [] as string[];
    if (SA.kind === "lane" || SB.kind === "lane") return ["bench"];
    return ["dev", "test", "ood", "regression"].filter((x) => SA.splits.includes(x) && SB.splits.includes(x));
  }, [SA, SB]);
  const eff = splits.includes(split) ? split : splits[0] ?? "dev";
  useEffect(() => { setUnit(null); }, [a, b, eff]);
  const q = a && b && a !== b && splits.length ? `/api/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}&split=${eff === "bench" ? "dev" : eff}` : null;
  const r = useApi<CompareT>(q);
  const d = r.data && q && r.data.a.ref === a && r.data.b.ref === b ? r.data : null;
  const o = d?.overall;
  const binary = !!o?.mcnemar;
  const swap = () => { setA(b); setB(a); };
  return (
    <div className="space-y-4">
      <PageHeader kicker="Measure" title="Compare"
        subtitle="Any two measured things — arms, seeds, studies, Weight Lab variants, bench lanes — on exactly the same tasks: how often each is right, the difference with its range, where they differ, and why." />
      <Panel title="What to compare" prov={<Prov kind="computed" source="paired on byte-identical tasks" />}>
        <ErrorLine error={subs.error} />
        {!subs.data ? <Skeleton h={40} /> : !list.length ? <Empty icon="compare">Nothing measured yet — evaluate a study, a Weight Lab variant or run a bench first.</Empty> : (
          <div className="space-y-3">
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
              <Picker subjects={list} value={a} onChange={setA} label="Side A" side="A" />
              <button type="button" onClick={swap} className="inline-flex h-8 shrink-0 items-center justify-center gap-1 self-center rounded-full border border-line px-3 text-[12px] text-ink-2 hover:border-accent-line hover:text-ink" aria-label="Swap A and B">⇄ swap</button>
              <Picker subjects={bChoices} value={b} onChange={setB} label="Side B" side="B" sameAs={SA?.taskset} />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              {splits.length > 0 && (splits[0] === "bench" ? <Badge>bench items</Badge> :
                <Segmented label="Which tasks" value={eff} onChange={setSplit} options={splits.map((x) => ({ value: x, label: SPLIT_LABEL[x] }))} />)}
              <Toggle checked={all} onChange={setAll} label="Show B options on other task sets too" />
              {SA && SB && SA.taskset !== SB.taskset && <span className="text-[11.5px] text-warn-ink">Different task sets: only byte-identical tasks will be paired.</span>}
              {SA && SB && !splits.length && <span className="text-[11.5px] text-warn-ink">These two have no task split in common.</span>}
            </div>
          </div>)}
      </Panel>

      <ErrorLine error={r.error} />
      {q && !d && !r.error && <div className="space-y-3" aria-busy="true" aria-label="Comparing"><Skeleton h={150} /><Skeleton h={260} /></div>}
      {d && !d.comparable && <Panel><Notice tone="warn">{d.reason}</Notice><div className="mt-2 font-mono text-[11.5px] text-ink-3">A has {d.coverage.only_a} tasks, B has {d.coverage.only_b}; same id but different content: {d.coverage.same_id_different_content}.</div></Panel>}
      {d && d.comparable && o && (
        <>
          <Panel title="Head to head" prov={<Prov kind="measured" source={`${o.n_tasks} paired tasks · ${SPLIT_LABEL[d.a.split] ?? d.a.split}`} />}
            right={<Explain title="Head to head" what={<>Both sides ran the same {o.n_tasks} tasks ({o.n_groups} groups of paraphrases). A task counts only when its content is byte-identical on both sides. Success means the strict score: the right answer AND the right tool use.</>}
              read={<ul className="list-disc space-y-1 pl-4"><li><b>Rates</b> — share of tasks each side got right, with its 95 % range.</li><li><b>Difference</b> — A minus B in percentage points; the bar is centred at zero, the shaded band is the 95 % range. A band that crosses zero means these tasks cannot tell the two apart.</li><li><b>Outcome grid</b> — the tasks only one side got right are the whole story of the difference.</li><li>Ranges reflect which tasks were drawn, not variation between training runs — see "per seed" for that.</li></ul>}
              math={<><p><Sym k="delta" /> = {fmtPct(o.rate_a, 1)} − {fmtPct(o.rate_b, 1)} = <b>{pp(o.delta)}</b>; 95 % range {pp(o.delta_ci[0])} to {pp(o.delta_ci[1])} (<Sym k="boot" /> over {o.n_groups} groups).</p>
                <p>Rates: {binary ? <Sym k="wilson" /> : <Sym k="boot" />} — {o.range_method}.</p>
                {o.mcnemar && <p><Sym k="mcnemar" />: b = {o.mcnemar.b} (only A right), c = {o.mcnemar.c} (only B right), p = {pv(o.mcnemar.p)}.</p>}
                {o.sign_flip_groups && <p><Sym k="signflip" /> over {o.sign_flip_groups.n_units} groups: p = {pv(o.sign_flip_groups.p)} ({o.sign_flip_groups.method}; smallest possible {pv(o.sign_flip_groups.min_attainable_p)}).</p>}</>} />}>
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)] [&>*]:min-w-0">
              <div className="space-y-1"><div className="flex items-center gap-2"><Tag side="A" /><span className="truncate text-[12px] text-ink-2" title={d.a.label}>{d.a.label}</span></div>
                <Score label="right (strict)" rate={o.rate_a} ci={o.ci_a} n={o.n_tasks} size="lg" /></div>
              <div className="space-y-1"><div className="flex items-center gap-2"><Tag side="B" /><span className="truncate text-[12px] text-ink-2" title={d.b.label}>{d.b.label}</span></div>
                <Score label="right (strict)" rate={o.rate_b} ci={o.ci_b} n={o.n_tasks} size="lg" /></div>
              <div>
                <div className="micro text-ink-3">difference <Sym k="delta" /></div>
                <div className={cx("num mt-0.5 font-mono text-[30px] font-medium leading-none", o.delta_ci[0] > 0 ? "text-good-ink" : o.delta_ci[1] < 0 ? "text-crit-ink" : "text-ink")}>{pp(o.delta)}</div>
                <DiffBar delta={o.delta} ci={o.delta_ci} max={Math.max(0.25, Math.min(1, Math.ceil(Math.max(Math.abs(o.delta_ci[0]), Math.abs(o.delta_ci[1])) * 4) / 4))} label="A − B" />
                <div className="mt-1 flex justify-between font-mono text-[10.5px] text-ink-3"><span>← B higher</span><span>95% {pp(o.delta_ci[0])} … {pp(o.delta_ci[1])}</span><span>A higher →</span></div>
                <div className="mt-2 text-[12px] text-ink-2">
                  {o.delta_ci[0] > 0 ? "A is right more often on these tasks; the whole range is above zero." : o.delta_ci[1] < 0 ? "B is right more often on these tasks; the whole range is below zero." : "The range includes zero: these tasks do not separate A from B."}
                  {" "}<span className="font-mono text-[11px] text-ink-3">{o.sign_flip_groups ? `sign-flip p ${pv(o.sign_flip_groups.p)}` : ""}{o.mcnemar ? ` · McNemar p ${pv(o.mcnemar.p)}` : ""}</span>
                </div>
              </div>
            </div>
            {(d.coverage.only_a > 0 || d.coverage.only_b > 0 || d.coverage.same_id_different_content > 0) && (
              <div className="mt-3"><Notice tone="info">Not paired: {d.coverage.only_a} task(s) only A ran, {d.coverage.only_b} only B ran{d.coverage.same_id_different_content ? `, and ${d.coverage.same_id_different_content} with the same id but different content (e.g. ${d.coverage.examples_changed.slice(0, 3).join(", ")})` : ""}. They are left out of every number here.</Notice></div>)}
          </Panel>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] [&>*]:min-w-0">
            <Panel title="Task by task" prov={<Prov kind="measured" />}>
              <OutcomeGrid o={o.outcomes} n={o.n_tasks} binary={binary} />
              <div className="mt-2 text-[11.5px] text-ink-3">Agreement {fmtPct(o.agreement)}: the share of tasks both got right or both got wrong.</div>
              <div className="mt-4">
                <div className="micro mb-1 text-ink-3">per seed and cost</div>
                <table className="w-full text-[12px]"><thead><tr><th className={th} /><th className={cx(th, "text-right")}>A</th><th className={cx(th, "text-right")}>B</th></tr></thead>
                  <tbody>
                    {[...new Set([...Object.keys(d.sides!.a.per_seed), ...Object.keys(d.sides!.b.per_seed)])].map((s) => (
                      <tr key={s} className={tr}><td className={td}>seed {s}</td><td className={cx(td, "num text-right font-mono")}>{fmtPct(d.sides!.a.per_seed[s]?.rate)}</td><td className={cx(td, "num text-right font-mono")}>{fmtPct(d.sides!.b.per_seed[s]?.rate)}</td></tr>))}
                    <tr className={tr}><td className={td}>invalid / format problems</td><td className={cx(td, "num text-right font-mono")}>{fmtPct(d.sides!.a.invalid_rate)}</td><td className={cx(td, "num text-right font-mono")}>{fmtPct(d.sides!.b.invalid_rate)}</td></tr>
                    <tr className={tr}><td className={td}>mean output tokens</td><td className={cx(td, "num text-right font-mono")}>{d.sides!.a.mean_tokens?.toFixed(0) ?? "—"}</td><td className={cx(td, "num text-right font-mono")}>{d.sides!.b.mean_tokens?.toFixed(0) ?? "—"}</td></tr>
                    <tr className={tr}><td className={td}>median latency</td><td className={cx(td, "num text-right font-mono")}>{d.sides!.a.median_latency_ms ?? "—"} ms</td><td className={cx(td, "num text-right font-mono")}>{d.sides!.b.median_latency_ms ?? "—"} ms</td></tr>
                  </tbody></table>
                <div className="mt-1 text-[11px] text-ink-3">Latency depends on the machine and what else was running; compare it only between runs on the same machine.</div>
              </div>
            </Panel>
            <Panel title="By skill" prov={<Prov kind="measured" />}>{d.families && <FamilyChart fams={d.families} />}</Panel>
          </div>

          <Panel title="The tasks" prov={<Prov kind="measured" source="stored results" />}>
            <TaskList units={d.units ?? []} open={unit} onOpen={(u) => { setUnit(u); setTimeout(() => document.getElementById("sidebyside")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }} />
          </Panel>
          {unit && <SideBySide a={a} b={b} split={eff === "bench" ? "dev" : eff} unit={unit} onClose={() => setUnit(null)} />}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] [&>*]:min-w-0">
            <Panel title="What is different about them" prov={<Prov kind="declared" source="plans, recipes, adapter configs" />} right={<Toggle checked={onlyDiff} onChange={setOnlyDiff} label="Only differences" />}>
              <table className="w-full table-fixed text-[12px]">
                <thead><tr><th className={cx(th, "w-[34%]")}>setting</th><th className={th}><Tag side="A" /></th><th className={th}><Tag side="B" /></th></tr></thead>
                <tbody>{(d.config ?? []).filter((c) => !onlyDiff || !c.same).map((c) => (
                  <tr key={c.key} className={cx(tr, !c.same && "bg-[color:var(--warn)]/8")}><td className={cx(td, "text-ink-2")}>{c.key}</td>
                    <td className={cx(td, "break-words font-mono text-[11px]")}>{fmt(c.a)}</td><td className={cx(td, "break-words font-mono text-[11px]")}>{fmt(c.b)}</td></tr>))}</tbody>
              </table>
              <div className="mt-1.5 text-[11px] text-ink-3">A difference in results can come from any row here — including the task set or the seed, not only the setting you meant to change.</div>
            </Panel>
            <Panel title="Inside the weights" prov={<Prov kind="computed" source="adapter safetensors, exact" />}>
              {d.weights && <WeightsView w={d.weights} a={d.a.label} b={d.b.label} />}
            </Panel>
          </div>
          <Limits>{d.honesty} Success is FORGE's strict score on synthetic tasks; it says nothing about clinical validity or deployment readiness.</Limits>
          <div className="flex flex-wrap gap-2">
            <Button icon="clock" onClick={() => goto("history")}>See results over time</Button>
            <Button icon="seal" onClick={() => { handoff("governance.tab", "decide"); goto("governance"); }}>Record a decision</Button>
          </div>
        </>)}
      {!q && subs.data && list.length > 0 && <Panel><Empty icon="compare">Choose A and B above. Arms and variants of one study, a study and its Turbo clone, or two lanes of one bench run share their tasks.</Empty></Panel>}
      <ChooseHint show={!q} />
    </div>
  );
}

function ChooseHint({ show }: { show: boolean }): ReactNode {
  if (!show) return null;
  return <Limits title="How pairing works">A task enters a comparison only when both sides ran it and its content is byte-identical (SHA-256). Results on different tasks are never mixed into one number.</Limits>;
}
