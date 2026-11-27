import { useMemo, useState } from "react";
import { Explain } from "../components/Explain";
import { Icon, type IconName } from "../components/icons";
import { Figure, Limits, RangeBar, fmtPct } from "../components/results";
import { Badge, Button, Empty, ErrorLine, PageHeader, Panel, Prov, Segmented, Skeleton, cx, inputCls, td, th, tr } from "../components/ui";
import { goto, handoff } from "../lib/handoff";
import { useApi } from "../lib/hooks";
import { Sym } from "../lib/math";
import { usePrefs } from "../lib/prefs";
import { CheckpointTimeline } from "../components/Lineage";

interface Point { t: string; kind: string; series: string; label: string; rate: number; ci: number[]; n: number; seeds: number; taskset: string; ref?: string; role: string; study?: string; split?: string }
interface Ev { t: string; kind: string; label: string; detail?: string; study?: string }
interface HistoryT { points: Point[]; events: Ev[]; tasksets: Record<string, { label: string; studies: string[] }>; honesty: string }
interface ProjectsT { projects: { id: string; name: string; kind: string }[] }

const KINDS: Record<string, { label: string; shape: "circle" | "square" | "diamond" | "triangle" | "ring" }> = {
  practice: { label: "practice (dev)", shape: "circle" }, final: { label: "sealed final test", shape: "square" }, variant: { label: "Weight Lab variant", shape: "diamond" },
  reference: { label: "teacher reference", shape: "triangle" }, bench: { label: "bench", shape: "ring" } };
const EV_ICON: Record<string, IconName> = { study: "plus", train: "training", seal: "lock", analyze_dev: "evaluation", analyze_test: "seal", export: "factory", decision: "check", release: "download" };
const color = (i: number) => `var(--cat-${(i % 8) + 1})`;
const when = (t: string) => new Date(t).toLocaleString(undefined, { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

function Mark({ shape, x, y, c, r = 5 }: { shape: string; x: number; y: number; c: string; r?: number }) {
  if (shape === "square") return <rect x={x - r} y={y - r} width={2 * r} height={2 * r} fill={c} />;
  if (shape === "diamond") return <path d={`M${x} ${y - r - 1}L${x + r + 1} ${y}L${x} ${y + r + 1}L${x - r - 1} ${y}Z`} fill={c} />;
  if (shape === "triangle") return <path d={`M${x} ${y - r - 1}L${x + r + 1} ${y + r}L${x - r - 1} ${y + r}Z`} fill={c} />;
  if (shape === "ring") return <circle cx={x} cy={y} r={r} fill="var(--surface)" stroke={c} strokeWidth={2.2} />;
  return <circle cx={x} cy={y} r={r} fill={c} />;
}

function LegendShape({ shape }: { shape: string }) {
  return <svg width={14} height={14} aria-hidden><Mark shape={shape} x={7} y={7} c="var(--ink-2)" r={4.5} /></svg>;
}

function TimeChart({ pts, tsIndex, onPick, picked, order }: { pts: Point[]; tsIndex: Record<string, number>; onPick: (p: Point) => void; picked: Point | null; order: boolean }) {
  const [hi, setHi] = useState<Point | null>(null);
  const W = 1000, H = 330, L = 46, R = 16, T = 12, B = 34;
  const ts = pts.map((p) => +new Date(p.t));
  let lo = Math.min(...ts), hi2 = Math.max(...ts);
  if (hi2 - lo < 3600e3) { lo -= 1800e3; hi2 += 1800e3; }
  const pad = (hi2 - lo) * 0.04;
  const idx = new Map(pts.map((p, i) => [p, i]));
  const xt = (t: string) => L + ((+new Date(t) - lo + pad) / (hi2 - lo + 2 * pad)) * (W - L - R);
  const xo = (p: Point) => L + ((idx.get(p)! + 0.5) / pts.length) * (W - L - R);
  const xp = (p: Point) => (order ? xo(p) : xt(p.t));
  const day = (t: string) => new Date(t).toDateString();
  const dayStarts = order ? pts.filter((p, i) => i === 0 || day(p.t) !== day(pts[i - 1].t)) : [];
  const y = (v: number) => T + (1 - v) * (H - T - B);
  const series = useMemo(() => {
    const m = new Map<string, Point[]>();
    pts.forEach((p) => m.set(p.series + "|" + p.taskset, [...(m.get(p.series + "|" + p.taskset) ?? []), p]));
    return [...m.values()].filter((v) => v.length > 1);
  }, [pts]);
  const ticks = Array.from({ length: 6 }, (_, i) => lo - pad + ((hi2 - lo + 2 * pad) * (i + 0.5)) / 6);
  const show = hi ?? picked;
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`Measured success rates over time: ${pts.length} points; the table below lists every point.`} onMouseLeave={() => setHi(null)}>
        {[0, 0.25, 0.5, 0.75, 1].map((v) => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={1} />
          <text x={L - 6} y={y(v) + 4} fontSize={11} textAnchor="end" fill="var(--ink-3)" className="num">{v * 100}%</text></g>)}
        {order && dayStarts.map((p, i) => <g key={p.t + i}>{i > 0 && <line x1={xo(p) - (W - L - R) / pts.length / 2} x2={xo(p) - (W - L - R) / pts.length / 2} y1={T} y2={H - B} stroke="var(--line-strong)" strokeDasharray="3 4" />}
          {(i === 0 || xo(p) - xo(dayStarts[i - 1]) > 70) && <text x={xo(p) - (W - L - R) / pts.length / 2 + 4} y={H - 12} fontSize={11} fill="var(--ink-3)">{new Date(p.t).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</text>}</g>)}
        {!order && ticks.map((t) => <text key={t} x={L + ((t - lo + pad) / (hi2 - lo + 2 * pad)) * (W - L - R)} y={H - 12} fontSize={11} textAnchor="middle" fill="var(--ink-3)">
          {new Date(t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</text>)}
        {series.map((s) => <polyline key={s[0].series + s[0].taskset} fill="none" stroke={color(tsIndex[s[0].taskset])} strokeOpacity={0.45} strokeWidth={1.4}
          points={s.map((p) => `${xp(p)},${y(p.rate)}`).join(" ")} />)}
        {pts.map((p, i) => { const c = color(tsIndex[p.taskset]); const cx_ = order ? xp(p) : xp(p) + ((i % 5) - 2) * 2.2; return (
          <g key={i} onMouseEnter={() => setHi(p)} onClick={() => onPick(p)} style={{ cursor: "pointer" }} opacity={show && show !== p ? 0.55 : 1}>
            <line x1={cx_} x2={cx_} y1={y(p.ci[1])} y2={y(p.ci[0])} stroke={c} strokeWidth={1.6} strokeOpacity={0.7} />
            <line x1={cx_ - 4} x2={cx_ + 4} y1={y(p.ci[1])} y2={y(p.ci[1])} stroke={c} strokeWidth={1.2} strokeOpacity={0.7} />
            <line x1={cx_ - 4} x2={cx_ + 4} y1={y(p.ci[0])} y2={y(p.ci[0])} stroke={c} strokeWidth={1.2} strokeOpacity={0.7} />
            <Mark shape={KINDS[p.kind]?.shape ?? "circle"} x={cx_} y={y(p.rate)} c={c} r={show === p ? 6.5 : 5} />
            <title>{`${p.label}\n${when(p.t)}\n${fmtPct(p.rate)} (95% ${fmtPct(p.ci[0])}–${fmtPct(p.ci[1])}), n=${p.n}`}</title>
          </g>); })}
      </svg>
      <div className="mt-1 min-h-[38px] rounded-[var(--radius)] border border-line bg-surface-2 px-3 py-1.5 text-[12px]" aria-live="polite">
        {show ? <span><b className="text-ink">{show.label}</b> · {when(show.t)} · <span className="num font-mono">{fmtPct(show.rate, 1)}</span> <span className="font-mono text-ink-3">95% {fmtPct(show.ci[0])}–{fmtPct(show.ci[1])} · n={show.n}{show.seeds > 1 ? ` · ${show.seeds} seeds` : ""}</span></span>
          : <span className="text-ink-3">Hover a point for its numbers; click it to compare it with something else.</span>}
      </div>
    </div>
  );
}

/** Every measured result for a project — or the whole lab — over time, with ranges, task sets made explicit, and the events
 *  (training, sealing, decisions, releases) that explain the moves. */
export default function History() {
  const { prefs } = usePrefs();
  const [view, setView] = useState<"time" | "lineage">("time");
  return (
    <div className="space-y-4">
      <PageHeader kicker="Measure" title="History"
        subtitle="Every measured result over time — and, for the active study, the skill through the base model's own training checkpoints."
        right={<Segmented label="View" value={view} onChange={setView} options={[{ value: "time", label: "Over time" }, { value: "lineage", label: "Checkpoint timeline" }]} />} />
      {view === "time" ? <OverTime /> : <CheckpointTimeline sid={prefs.activeStudy ?? null} />}
    </div>
  );
}

function OverTime() {
  const projects = useApi<ProjectsT>("/api/projects", 30000);
  const [project, setProject] = useState("");
  const h = useApi<HistoryT>(`/api/history${project ? `?project=${encodeURIComponent(project)}` : ""}`, 30000);
  const [kinds, setKinds] = useState<Set<string>>(new Set(Object.keys(KINDS)));
  const [picked, setPicked] = useState<Point | null>(null);
  const [order, setOrder] = useState<"order" | "time">("order");
  const d = h.data;
  const tsIndex = useMemo(() => Object.fromEntries(Object.keys(d?.tasksets ?? {}).map((k, i) => [k, i])), [d]);
  const pts = useMemo(() => (d?.points ?? []).filter((p) => kinds.has(p.kind)), [d, kinds]);
  const toggle = (k: string) => setKinds((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const compare = (p: Point) => { if (!p.ref) return; handoff("compare.a", p.ref); goto("compare"); };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12.5px] text-ink-2">Practice, sealed final tests, Weight Lab variants and benches — each with its range, the task set it was measured on, and what happened in between.</p>
        <select className={cx(inputCls, "!w-auto max-w-[320px] font-sans")} value={project} onChange={(e) => setProject(e.target.value)} aria-label="Project">
          <option value="">All projects</option>{(projects.data?.projects ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      </div>
      <ErrorLine error={h.error} />
      {!d ? <div className="space-y-3" aria-busy="true" aria-label="Loading history"><Skeleton h={360} /><Skeleton h={200} /></div> : !d.points.length ? (
        <Panel><Empty icon="clock">Nothing measured yet for this scope — results appear here once a study is evaluated, a variant is measured or a bench is run.</Empty></Panel>) : (
        <>
          <Panel title="Results over time" prov={<Prov kind="measured" source={`${d.points.length} results`} />}
            right={<Explain title="Results over time"
              what={<>Each mark is one measured success rate: a study arm on practice or sealed-test tasks, a Weight Lab variant, a teacher reference or a bench run. It is placed when its last task finished.</>}
              read={<ul className="list-disc space-y-1 pl-4"><li><b>Shape</b> = what kind of result (legend). <b>Colour</b> = which task set it was measured on.</li><li>The vertical whisker is the 95 % range (<Sym k="wilson" />). Overlapping whiskers mean the two results are not clearly different.</li><li>Lines join results of the same series on the same task set. <b>Never read a move between colours as progress</b>: the tasks changed, not necessarily the model.</li><li>To test whether two points really differ, click one and compare it on paired tasks.</li></ul>} />}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Segmented label="Spacing" value={order} onChange={setOrder} options={[{ value: "order", label: "in order" }, { value: "time", label: "real time" }]} />
              {Object.entries(KINDS).map(([k, v]) => { const n = d.points.filter((p) => p.kind === k).length; return (
                <button key={k} type="button" disabled={!n} onClick={() => toggle(k)} aria-pressed={kinds.has(k)}
                  className={cx("inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[11.5px]", kinds.has(k) && n ? "border-accent-line bg-accent-soft text-ink" : "border-line text-ink-3", !n && "opacity-50")}>
                  <LegendShape shape={v.shape} />{v.label} <span className="font-mono text-ink-3">{n}</span></button>); })}
            </div>
            <Figure title="Success rate (strict) over time" y="success rate (95 % range)" x={order === "order" ? "results in the order they were measured (evenly spaced; dashed lines = a new day)" : "when the result was measured (local time)"}
              caption={<>Task sets: {Object.entries(d.tasksets).map(([k, v], i) => <span key={k} className="mr-3 inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color(i) }} />{v.label}</span>)}</>}>
              {pts.length ? <TimeChart pts={pts} tsIndex={tsIndex} onPick={(p) => setPicked(p)} picked={picked} order={order === "order"} /> : <Empty icon="dot">All result kinds are hidden.</Empty>}
            </Figure>
            {picked && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-[var(--radius)] border border-accent-line bg-accent-soft px-3 py-2 text-[12px]">
                <span className="text-ink"><b>{picked.label}</b> · {fmtPct(picked.rate, 1)} on {d.tasksets[picked.taskset]?.label ?? picked.taskset}</span>
                {picked.ref && <Button size="sm" tone="primary" icon="compare" onClick={() => compare(picked)}>Compare it with…</Button>}
                <Button size="sm" onClick={() => setPicked(null)}>Clear</Button>
              </div>)}
          </Panel>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] [&>*]:min-w-0">
            <Panel title="Every result" prov={<Prov kind="measured" />} flush>
              <div className="max-h-[520px] overflow-auto" tabIndex={0} aria-label="All results, scrollable">
                <table className="w-full min-w-[660px] text-[12px]">
                  <thead className="sticky top-0 bg-surface"><tr><th className={th}>when</th><th className={th}>what</th><th className={th}>kind</th><th className={cx(th, "w-[22%]")}>rate · 95 % range</th><th className={cx(th, "text-right")}>n</th><th className={th}>task set</th><th className={th}><span className="sr-only">actions</span></th></tr></thead>
                  <tbody>{[...pts].reverse().map((p, i) => (
                    <tr key={i} className={cx(tr, picked === p && "bg-accent-soft")}>
                      <td className={cx(td, "whitespace-nowrap font-mono text-[11px] text-ink-3")}>{when(p.t)}</td>
                      <td className={td}><div className="max-w-[230px] truncate" title={p.label}>{p.label}</div></td>
                      <td className={cx(td, "whitespace-nowrap")}><span className="inline-flex items-center gap-1"><LegendShape shape={KINDS[p.kind]?.shape ?? "circle"} />{KINDS[p.kind]?.label ?? p.kind}</span></td>
                      <td className={td}><div className="flex items-center gap-2"><span className="num w-10 font-mono">{fmtPct(p.rate)}</span><RangeBar rate={p.rate} ci={p.ci} className="flex-1" /></div></td>
                      <td className={cx(td, "num text-right font-mono text-ink-3")}>{p.n}</td>
                      <td className={cx(td, "whitespace-nowrap")}><span className="inline-flex items-center gap-1 font-mono text-[11px]"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color(tsIndex[p.taskset] ?? 0) }} />{p.taskset}</span></td>
                      <td className={cx(td, "text-right")}>{p.ref && <Button size="sm" onClick={() => compare(p)}>Compare</Button>}</td>
                    </tr>))}</tbody>
                </table>
              </div>
            </Panel>
            <Panel title="What happened" prov={<Prov kind="declared" source="study state, decisions, releases" />}>
              {!d.events.length ? <Empty icon="dot">No events.</Empty> : (
                <ol className="max-h-[520px] overflow-y-auto pr-1" tabIndex={0} aria-label="Events, newest first">
                  {d.events.map((e, i) => (
                    <li key={i} className="relative pb-3 pl-7">
                      {i < d.events.length - 1 && <span className="absolute bottom-0 left-[9px] top-5 w-px bg-line" aria-hidden />}
                      <span className="absolute left-0 top-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-line bg-surface text-ink-2"><Icon name={EV_ICON[e.kind] ?? "dot"} size={11} /></span>
                      <div className="font-mono text-[10.5px] text-ink-3">{when(e.t)}</div>
                      <div className="text-[12.5px] text-ink">{e.label}</div>
                      {e.detail && <div className="text-[11.5px] text-ink-3">{e.detail}</div>}
                      {e.kind === "decision" && <Badge tone="accent">human decision</Badge>}
                    </li>))}
                </ol>)}
            </Panel>
          </div>
          <Limits>{d.honesty}</Limits>
        </>)}
    </div>
  );
}
