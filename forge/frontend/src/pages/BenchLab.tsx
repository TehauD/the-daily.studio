import { useMemo, useState } from "react";
import { Icon } from "../components/icons";
import { JobLog } from "../components/live";
import { Badge, Button, Empty, ErrorLine, Field, Notice, PageHeader, Panel, Prov, Segmented, Tabs, cx, inputCls, td, th, tr } from "../components/ui";
import { api } from "../lib/api";
import { useAction, useApi } from "../lib/hooks";
import { useHashParamless } from "../lib/benchTab";
import type { Model, StudyRow } from "../lib/types";

type Suite = "compute" | "vision" | "security";
interface SuiteInfo { title: string; categories: Record<string, string>; modes: string[]; honesty: string }
interface Agg { n: number; correct: number; rate: number; ci: [number, number] | null }
interface Row extends Partial<Agg> { lane: string; mode: string; skipped: number; errors: number; answered?: number; confident_wrong?: number; format_problems?: number;
  median_latency_ms?: number | null; by_category?: Record<string, Agg>; by_difficulty?: Record<string, Agg>; set_precision?: number; set_recall?: number;
  rubric_coverage?: number; injection_obeyed?: number }
interface RunT { id: string; suite: Suite; created_at: string; seed: number; items: number; honesty: string; lanes: { label: string; kind: string; vision: boolean }[];
  summary: { rows: Row[]; done: number; expected?: number }; jobs: { id: string; status: string }[] }
interface ItemRow { item: string; lane: string; mode: string; category: string; difficulty: number; answer: string | null; expected: unknown; correct?: boolean; prompt: string;
  raw?: string; image?: string | null; skipped?: string; error?: string; coverage?: number; missing?: string[]; obeyed?: boolean | null; calls?: number; format?: string | null }

const pct = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v * 100)}%`);
const MODE = { no_tools: "on its own", tools: "with tools", direct: "" } as Record<string, string>;
const SUITES: { key: Suite; label: string; icon: "evaluation" | "layers" | "lock" }[] = [{ key: "compute", label: "Model Bench", icon: "evaluation" },
  { key: "vision", label: "Vision Bench", icon: "layers" }, { key: "security", label: "Security Bench", icon: "lock" }];

export default function BenchLab() {
  const [tab, setTab] = useHashParamless<"scorecard" | Suite>("scorecard");
  const suites = useApi<Record<Suite, SuiteInfo>>("/api/bench/suites");
  return (
    <div className="space-y-4">
      <PageHeader kicker="Measure" title="Bench Lab"
        subtitle="Exact-answer tests for any model: computation (with and without tools), reading synthetic administrative documents, and defensive security analysis with red-team knowledge. Every item is generated with a known answer; every score carries a 95 % range." />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: "scorecard", label: "Scorecard" }, ...SUITES.map((s) => ({ value: s.key, label: s.label }))]} />
      {tab === "scorecard" ? <Scorecard onOpen={setTab} /> : suites.data ? <SuiteView key={tab} suite={tab} info={suites.data[tab]} /> : <ErrorLine error={suites.error} />}
    </div>
  );
}

function Scorecard({ onOpen }: { onOpen: (s: Suite) => void }) {
  const sc = useApi<{ rows: { lane: string; suite: Suite; mode: string; rate: number; ci: [number, number] | null; n: number; at: string }[]; note: string }>("/api/bench/scorecard", 10000);
  const rows = sc.data?.rows ?? [];
  const lanes = [...new Set(rows.map((r) => r.lane))];
  const cols = [["compute", "no_tools", "Computation · on its own"], ["compute", "tools", "Computation · with tools"], ["vision", "direct", "Documents (vision)"], ["security", "direct", "Security analysis"]] as const;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {SUITES.map((s) => (
          <button key={s.key} type="button" onClick={() => onOpen(s.key)} className="flex items-start gap-3 rounded-[var(--radius)] border border-line bg-surface p-4 text-left transition hover:border-accent-line">
            <span className="rounded-[var(--radius)] bg-accent-soft p-2 text-accent"><Icon name={s.icon} size={18} /></span>
            <span><span className="block text-[13.5px] font-medium text-ink">{s.label}</span><span className="mt-1 block text-[12px] text-ink-2">{
              { compute: "Arithmetic, percentages, dates, units and word problems — does the model compute correctly on its own, and does it reach for the calculator?",
                vision: "Prior-authorization forms, member cards, tables and charts drawn by FORGE, from clean to fax quality.",
                security: "Logs, indicators, phishing, ATT&CK mapping, mitigations, hardening, break/fix, prioritisation, injection resistance, IR steps." }[s.key]}</span></span>
          </button>))}
      </div>
      <Panel flush title="Model scorecard" eyebrow="latest run per model" prov={<Prov kind="measured" source="bench runs" />}>
        {!rows.length ? <Empty icon="evaluation">No bench runs yet. Open a bench above and run it on one or more models.</Empty> : (
          <div className="overflow-x-auto"><table className="w-full text-[12.5px]">
            <thead><tr><th className={th}>Model</th>{cols.map(([, , l]) => <th key={l} className={cx(th, "text-right")}>{l}</th>)}</tr></thead>
            <tbody>{lanes.map((ln) => (
              <tr key={ln} className={tr}><td className={td}>{ln}</td>
                {cols.map(([s, m, l]) => { const r = rows.find((x) => x.lane === ln && x.suite === s && x.mode === m); return (
                  <td key={l} className={cx(td, "text-right")}>{r ? <span className="inline-flex flex-col items-end"><span className="num font-mono text-[14px] text-ink">{pct(r.rate)}</span>
                    <span className="font-mono text-[10.5px] text-ink-3">{r.ci ? `${pct(r.ci[0])}–${pct(r.ci[1])}` : ""} · n={r.n}</span></span> : <span className="text-ink-3">—</span>}</td>); })}
              </tr>))}</tbody></table></div>)}
        <div className="p-[var(--pad)] text-[11.5px] text-ink-3">{sc.data?.note}</div>
      </Panel>
    </div>
  );
}

function SuiteView({ suite, info }: { suite: Suite; info: SuiteInfo }) {
  const runs = useApi<{ id: string; suite: Suite; created_at: string; items: number; lanes: string[]; done: number; expected: number | null }[]>("/api/bench/runs", 6000);
  const mine = (runs.data ?? []).filter((r) => r.suite === suite);
  const [sel, setSel] = useState<string | null>(null);
  const rid = sel ?? mine[0]?.id ?? null;
  const run = useApi<RunT>(rid ? `/api/bench/runs/${rid}` : null, 4000);
  const job = run.data?.jobs.find((j) => j.status === "running");
  return (
    <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)] [&>*]:min-w-0">
      <div className="space-y-4">
        <Builder suite={suite} info={info} onStarted={(id) => { setSel(id); void runs.reload(); }} />
        {job && <Panel title="Running" eyebrow="live"><JobLog jobId={job.id} height={180} onDone={() => { void run.reload(); void runs.reload(); }} /></Panel>}
        <Notice tone="honesty">{info.honesty}</Notice>
      </div>
      <div className="space-y-4">
        {mine.length > 0 && (
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-[12px]">
            <span className="text-ink-3">Run</span>
            <select className={cx(inputCls, "!w-auto max-w-full min-w-0 font-sans")} value={rid ?? ""} onChange={(e) => setSel(e.target.value)} aria-label="Bench run">
              {mine.map((r) => <option key={r.id} value={r.id}>{new Date(r.created_at).toLocaleString()} · {r.lanes.join(", ")} · {r.items} items</option>)}</select>
            {run.data && <span className="text-ink-3">{run.data.summary.done} / {run.data.summary.expected ?? "?"} answers recorded · seed {run.data.seed}</span>}
          </div>)}
        {!rid ? <Panel><Empty icon="evaluation">No {info.title} runs yet. Choose models on the left and run it.</Empty></Panel>
          : run.data ? <Results run={run.data} info={info} /> : <ErrorLine error={run.error} />}
      </div>
    </div>
  );
}

function Builder({ suite, info, onStarted }: { suite: Suite; info: SuiteInfo; onStarted: (id: string) => void }) {
  const models = useApi<{ models: Model[] }>("/api/models");
  const studies = useApi<StudyRow[]>("/api/studies", 15000);
  const rd = useApi<{ cpu_wiring_mode?: boolean }>("/api/system/readiness");
  const all = (models.data?.models ?? []).filter((m) => m.status === "available");
  const endpoint = all.filter((m) => ["lmstudio", "ollama"].includes(m.provider) || m.provider.startsWith("endpoint:")).filter((m) => m.metadata.model_kind !== "embedding" && (m.metadata as Record<string, unknown>).lmstudio_type !== "embeddings");
  const local = all.filter((m) => m.storage_path && m.capabilities.lora?.status === "supported");
  const isVision = (m: Model) => (m.metadata as Record<string, unknown>).lmstudio_type === "vlm" || ((m.metadata as Record<string, unknown>).lmstudio_capabilities as string[] | undefined)?.includes("vision");
  const trained = (studies.data ?? []).filter((s) => s.stages?.train === "completed");
  const [lanes, setLanes] = useState<{ model_id: string; study_id?: string; arm?: string; seed?: number; label: string }[]>([]);
  const [cats, setCats] = useState<string[]>(Object.keys(info.categories));
  const [n, setN] = useState(suite === "vision" ? 4 : 6);
  const [device, setDevice] = useState<"cuda" | "cpu">("cuda");
  const act = useAction();
  const add = (l: { model_id: string; study_id?: string; arm?: string; seed?: number; label: string }) => setLanes((x) => x.some((y) => y.label === l.label) ? x : [...x, l].slice(0, 6));
  const total = cats.length * (suite === "security" && cats.includes("out_of_bounds") ? 4 : 4) * n;
  return (
    <Panel title={`Run ${info.title}`}>
      <div className="space-y-3 text-[12.5px]">
        <div className="micro text-ink-3">Models (up to 6)</div>
        <div className="flex flex-wrap gap-1.5">
          {endpoint.map((m) => (
            <button key={m.id} type="button" onClick={() => add({ model_id: m.id, label: m.name })} disabled={suite === "vision" && !isVision(m)}
              title={suite === "vision" && !isVision(m) ? "Not a vision model (LM Studio type 'vlm')" : `${m.provider} · ${m.name}`}
              className={cx("rounded-full border px-2.5 py-1 text-[11.5px] disabled:opacity-40", lanes.some((l) => l.label === m.name) ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-2 hover:border-line-strong")}>
              {m.name}{isVision(m) && <span className="ml-1 text-accent">· vision</span>}</button>))}
          {suite !== "vision" && local.map((m) => (
            <button key={m.id} type="button" onClick={() => add({ model_id: m.id, label: `${m.name} (untrained)` })}
              className="rounded-full border border-dashed border-line px-2.5 py-1 text-[11.5px] text-ink-2 hover:border-line-strong">{m.name} · local</button>))}
        </div>
        {suite !== "vision" && trained.length > 0 && (
          <Field label="Add a trained adapter">
            <select className={inputCls} value="" onChange={(e) => { const [sid, arm, seed] = e.target.value.split("|"); const s = trained.find((x) => x.id === sid); const m = local.find((x) => x.name === s?.student);
              if (s && m) add({ model_id: m.id, study_id: sid, arm, seed: Number(seed), label: `${s.name} (${arm} s${seed})`.slice(0, 60) }); }}>
              <option value="">choose a study's adapter…</option>
              {trained.flatMap((s) => s.arms.flatMap((a) => s.seeds.map((sd) => <option key={`${s.id}${a}${sd}`} value={`${s.id}|${a}|${sd}`}>{s.name} · {a} · seed {sd}</option>)))}
            </select></Field>)}
        {lanes.length > 0 && <ul className="space-y-1">{lanes.map((l) => <li key={l.label} className="flex items-center justify-between gap-2 rounded border border-line px-2 py-1"><span className="truncate">{l.label}</span>
          <button type="button" aria-label={`Remove ${l.label}`} className="text-ink-3 hover:text-crit-ink" onClick={() => setLanes(lanes.filter((x) => x !== l))}><Icon name="x" size={13} /></button></li>)}</ul>}
        <div className="micro text-ink-3">Categories</div>
        <div className="flex flex-wrap gap-1.5">{Object.entries(info.categories).map(([k, v]) => {
          const on = cats.includes(k);
          return <button key={k} type="button" aria-pressed={on} onClick={() => setCats(on ? cats.filter((c) => c !== k) : [...cats, k])}
            className={cx("rounded-full border px-2 py-0.5 text-[11px]", on ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-3")}>{v}</button>; })}</div>
        <Field label={`Items per category × difficulty · ${n}`} hint={`≈ ${total} items${suite === "compute" ? " × 2 modes" : ""} per model. More items → narrower ranges.`}>
          <input type="range" min={1} max={20} value={n} onChange={(e) => setN(Number(e.target.value))} className="w-full accent-[var(--accent)]" aria-label="Items per cell" /></Field>
        {rd.data?.cpu_wiring_mode && <Field label="Local models run on"><Segmented label="Device" value={device} onChange={setDevice} options={[{ value: "cuda", label: "GPU" }, { value: "cpu", label: "CPU (wiring)" }]} /></Field>}
        <Button tone="primary" icon="play" busy={act.busy} disabled={!lanes.length || !cats.length}
          onClick={() => void act.run(async () => { const r = await api.post<{ id: string }>("/api/bench/runs", { suite, lanes: lanes.map(({ label, ...x }) => ({ ...x, label })), n_per_cell: n, categories: cats, device }); onStarted(r.id); })}>Run bench</Button>
        <ErrorLine error={act.error ?? models.error} />
      </div>
    </Panel>
  );
}

function CI({ a }: { a?: Agg }) {
  if (!a) return <span className="text-ink-3">—</span>;
  return (
    <span className="inline-flex w-full flex-col gap-0.5" title={`${a.correct}/${a.n} · 95% ${a.ci ? `${pct(a.ci[0])}–${pct(a.ci[1])}` : ""}`}>
      <span className="num font-mono text-[12.5px] text-ink">{pct(a.rate)}</span>
      <span className="relative h-1.5 w-full rounded-full bg-surface-3">
        {a.ci && <span className="absolute top-0 h-1.5 rounded-full bg-accent/30" style={{ left: `${a.ci[0] * 100}%`, width: `${(a.ci[1] - a.ci[0]) * 100}%` }} />}
        <span className="absolute -top-0.5 h-2.5 w-0.5 bg-accent" style={{ left: `calc(${a.rate * 100}% - 1px)` }} />
      </span>
    </span>
  );
}

function Results({ run, info }: { run: RunT; info: SuiteInfo }) {
  const rows = run.summary.rows;
  const measured = rows.filter((r) => r.n);
  const series = measured.map((r, i) => ({ r, i, key: `${r.lane}${MODE[r.mode] ? ` · ${MODE[r.mode]}` : ""}` }));
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
        {rows.map((r) => (
          <div key={r.lane + r.mode} className="rounded-[var(--radius)] border border-line bg-surface p-3">
            <div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="truncate text-[13px] font-medium text-ink">{r.lane}</div>
              {MODE[r.mode] && <div className="micro text-ink-3">{MODE[r.mode]}</div>}</div>
              {r.n ? <span className="num font-mono text-[22px] text-ink">{pct(r.rate)}</span> : <Badge>{r.skipped ? "skipped" : "pending"}</Badge>}</div>
            {r.n ? (
              <>
                <div className="mt-1 font-mono text-[11px] text-ink-3">95% {r.ci ? `${pct(r.ci[0])}–${pct(r.ci[1])}` : "—"} · {r.correct}/{r.n}</div>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11.5px] text-ink-2">
                  <span>confidently wrong</span><span className={cx("text-right font-mono", (r.confident_wrong ?? 0) > 0.2 && "text-crit-ink")}>{pct(r.confident_wrong)}</span>
                  <span>format problems</span><span className="text-right font-mono">{pct(r.format_problems)}</span>
                  {r.injection_obeyed != null && <><span>obeyed planted text</span><span className={cx("text-right font-mono", r.injection_obeyed > 0 ? "text-crit-ink" : "text-good-ink")}>{pct(r.injection_obeyed)}</span></>}
                  {r.rubric_coverage != null && <><span title="Share of required elements mentioned — evidence, not proof of quality">IR rubric coverage</span><span className="text-right font-mono">{pct(r.rubric_coverage)}</span></>}
                  {r.set_precision != null && <><span>indicators precision / recall</span><span className="text-right font-mono">{pct(r.set_precision)} / {pct(r.set_recall)}</span></>}
                  <span>median time / item</span><span className="text-right font-mono">{r.median_latency_ms != null ? `${(r.median_latency_ms / 1000).toFixed(1)} s` : "—"}</span>
                </div>
              </>) : <div className="mt-2 text-[11.5px] text-ink-3">{r.skipped ? `${r.skipped} items skipped: not a vision model` : r.errors ? `${r.errors} errors` : "waiting…"}</div>}
          </div>))}
      </div>
      {measured.length > 0 && (
        <div className="grid gap-4 2xl:grid-cols-2 [&>*]:min-w-0">
          <Panel flush title="By category" prov={<Prov kind="measured" />}>
            <div className="overflow-x-auto"><table className="w-full text-[12px]">
              <thead><tr><th className={th}>Category</th>{series.map((s) => <th key={s.key} className={cx(th, "min-w-[120px]")}>{s.key}</th>)}</tr></thead>
              <tbody>{Object.entries(info.categories).filter(([k]) => measured.some((r) => r.by_category?.[k])).map(([k, v]) => (
                <tr key={k} className={tr}><td className={td}>{v}</td>{series.map((s) => <td key={s.key} className={td}><CI a={s.r.by_category?.[k]} /></td>)}</tr>))}</tbody></table></div>
          </Panel>
          <Panel title="By difficulty" prov={<Prov kind="measured" />}>
            <DiffChart series={series.map((s) => ({ key: s.key, i: s.i, dashed: s.r.mode === "no_tools", pts: [1, 2, 3, 4].map((d) => s.r.by_difficulty?.[String(d)] ?? null) }))} vision={run.suite === "vision"} />
          </Panel>
        </div>)}
      <Explorer run={run} />
    </>
  );
}

function DiffChart({ series, vision }: { series: { key: string; i: number; dashed: boolean; pts: (Agg | null)[] }[]; vision: boolean }) {
  const W = 460, H = 220, L = 40, B = 30, T = 12, R = 36;
  const x = (d: number) => L + ((d - 1) / 3) * (W - L - R), y = (v: number) => T + (1 - v) * (H - T - B);
  const lbl = vision ? ["clean", "low-res", "rotated", "fax"] : ["easy", "medium", "hard", "hardest"];
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-[560px]" role="img" aria-label="Success by difficulty">
        {[0, 0.5, 1].map((v) => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--line)" /><text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="var(--ink-3)">{v * 100}%</text></g>)}
        {lbl.map((t, i) => <text key={t} x={x(i + 1)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--ink-3)">{t}</text>)}
        {series.map((s) => (
          <g key={s.key}>
            <polyline fill="none" stroke={`var(--cat-${(s.i % 8) + 1})`} strokeWidth="2" strokeDasharray={s.dashed ? "5 4" : undefined}
              points={s.pts.map((p, d) => (p ? `${x(d + 1)},${y(p.rate)}` : "")).filter(Boolean).join(" ")} />
            {s.pts.map((p, d) => p && <circle key={d} cx={x(d + 1)} cy={y(p.rate)} r="3" fill={`var(--cat-${(s.i % 8) + 1})`}><title>{`${s.key} · ${lbl[d]}: ${pct(p.rate)} (${p.correct}/${p.n})`}</title></circle>)}
          </g>))}
      </svg>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink-2">{series.map((s) => <span key={s.key} className="flex items-center gap-1.5"><span className="h-0.5 w-4" style={{ background: `var(--cat-${(s.i % 8) + 1})`, opacity: s.dashed ? 0.6 : 1 }} />{s.key}</span>)}</div>
    </>
  );
}

function Explorer({ run }: { run: RunT }) {
  const [lane, setLane] = useState("");
  const [wrong, setWrong] = useState(true);
  const [open, setOpen] = useState<string | null>(null);
  const q = useMemo(() => new URLSearchParams({ ...(lane ? { lane } : {}), only_wrong: String(wrong) }).toString(), [lane, wrong]);
  const it = useApi<{ rows: ItemRow[]; total: number }>(`/api/bench/runs/${run.id}/items?${q}`, 8000);
  return (
    <Panel flush title="Items" eyebrow={it.data ? `${it.data.total} shown` : undefined}
      right={<span className="flex flex-wrap items-center gap-2"><select className={cx(inputCls, "h-7 !w-auto font-sans")} value={lane} onChange={(e) => setLane(e.target.value)} aria-label="Model">
        <option value="">all models</option>{run.lanes.map((l) => <option key={l.label}>{l.label}</option>)}</select>
        <Segmented label="Filter" value={wrong ? "wrong" : "all"} onChange={(v) => setWrong(v === "wrong")} options={[{ value: "wrong", label: "wrong only" }, { value: "all", label: "all" }]} /></span>}>
      <div className="scroll-thin max-h-[560px] overflow-auto">
        <table className="w-full text-[12px]">
          <thead className="sticky top-0 bg-surface-2"><tr>{["", "Model", "Category", "Level", "Expected", "Answer", ""].map((h, i) => <th key={i} className={th}>{h}</th>)}</tr></thead>
          <tbody>{(it.data?.rows ?? []).map((r) => {
            const k = r.item + r.lane + r.mode;
            return [
              <tr key={k} className={cx(tr, "cursor-pointer")} onClick={() => setOpen(open === k ? null : k)}>
                <td className={td}>{r.skipped ? <Badge>skipped</Badge> : r.error ? <Badge tone="warn">error</Badge> : <Icon name={r.correct ? "check" : "x"} size={14} className={r.correct ? "text-good-ink" : "text-crit-ink"} />}</td>
                <td className={cx(td, "max-w-[180px] truncate")}>{r.lane}{MODE[r.mode] ? <span className="text-ink-3"> · {MODE[r.mode]}</span> : null}</td>
                <td className={td}>{r.category}</td><td className={cx(td, "font-mono")}>{r.difficulty}</td>
                <td className={cx(td, "max-w-[220px] truncate font-mono")}>{Array.isArray(r.expected) ? (r.expected as string[]).join(", ") : String(r.expected)}</td>
                <td className={cx(td, "max-w-[220px] truncate font-mono", r.correct ? "text-ink" : "text-crit-ink")}>{r.answer ?? "—"}{r.obeyed ? " ⚠ obeyed planted text" : ""}</td>
                <td className={td}><Icon name="chevron" size={12} className="text-ink-3" /></td>
              </tr>,
              open === k && (
                <tr key={k + "x"}><td colSpan={7} className="border-t border-line bg-surface-2 p-3">
                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                    <div className="space-y-2">
                      {r.image && <img src={`/api/bench/runs/${run.id}/images/${r.image}`} alt={`Bench image ${r.item}`} className="max-h-[320px] rounded border border-line bg-white" />}
                      <pre className="max-h-[260px] overflow-auto whitespace-pre-wrap rounded bg-surface p-2 font-mono text-[11px] text-ink-2">{r.prompt}</pre>
                    </div>
                    <div className="space-y-1.5 text-[12px]">
                      <div><span className="text-ink-3">Expected:</span> <b className="font-mono">{JSON.stringify(r.expected)}</b></div>
                      <div><span className="text-ink-3">Model answered:</span> <b className="font-mono">{r.answer ?? "—"}</b></div>
                      {r.coverage != null && <div><span className="text-ink-3">Rubric coverage:</span> {pct(r.coverage)}{r.missing?.length ? <span className="text-ink-3"> · missing: {r.missing.join(", ")}</span> : null}</div>}
                      {r.calls != null && <div><span className="text-ink-3">Tool calls:</span> {r.calls}</div>}
                      {r.format && <div className="text-ink-3">Format: {r.format === "no_json" ? "answered without the JSON format" : r.format}</div>}
                      {r.raw && <pre className="max-h-[220px] overflow-auto whitespace-pre-wrap rounded bg-surface p-2 font-mono text-[11px] text-ink-2">{r.raw}</pre>}
                    </div>
                  </div>
                </td></tr>)];
          })}</tbody>
        </table>
        {!it.data?.rows.length && <div className="p-[var(--pad)] text-[12px] text-ink-3">{wrong ? "No wrong answers recorded (yet)." : "No items yet."}</div>}
      </div>
    </Panel>
  );
}
