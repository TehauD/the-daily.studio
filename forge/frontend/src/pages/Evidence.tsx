import { useMemo, useState } from "react";
import { Explain } from "../components/Explain";
import { Icon } from "../components/icons";
import { StudySelect } from "../components/live";
import { Figure, Limits, fmtPct } from "../components/results";
import { ForgettingPanel, PowerPanel, PromptingTable, type PowerT } from "../components/Rigor";
import { Badge, Button, Empty, ErrorLine, PageHeader, Panel, Prov, Segmented, Skeleton, cx, td, th, tr } from "../components/ui";
import { goto, handoff } from "../lib/handoff";
import { useApi } from "../lib/hooks";
import { Sym } from "../lib/math";
import { usePrefs } from "../lib/prefs";

interface Part { rate: number | null; ci: number[] | null }
interface Comp { label: string; n: number; [k: string]: Part | string | number }
interface Contrast { gain: number | null; ci: (number | null)[]; arm_rate: number | null; control_rate: number | null; p_groups: number | null; p_seeds: number | null; min_p_seeds: number | null }
interface EvidenceT {
  study: { id: string; name: string; sealed: boolean; seeds: number[]; student: string; arms: string[]; train: Record<string, unknown> };
  splits: string[]; parts: { key: string; label: string }[]; components: Record<string, Record<string, Comp>>; contrasts: Record<string, Record<string, Contrast>>;
  seeds: Record<string, Record<string, Record<string, number>>>; skills: Record<string, Record<string, Record<string, number>>>;
  curves: Record<string, { seed: number; train: [number, number][]; heldout: [number, number][] }[]>;
  fixed: { task_id: string; family: string; seeds_right: number; seeds: number }[]; fixed_total: number; fixed_split: string | null;
  verdict: { status: string; text: string; split?: string; real_arm?: string; control_arm?: string | null; prompting?: { status?: string; text?: string; split: string } | null }; honesty: string;
  vs_prompting: Record<string, Record<string, Contrast>>; fewshot: { k: number; task_ids?: string[]; families?: string[]; sha256?: string } | null; power: PowerT | null;
}

const CTRL = "shuffled_control";
const FS = "fewshot";
const color = (arm: string) => (arm === "base" ? "var(--s-base)" : arm === "teacher" ? "var(--s-teacher)" : arm === CTRL ? "var(--ink-3)" : arm === FS ? "var(--cat-7)" : "var(--s-tuned)");
const name = (arm: string) => (arm === "base" ? "untrained" : arm === "teacher" ? "teacher" : arm === CTRL ? "negative control" : arm === FS ? "prompted" : "trained");
const pp = (v: number | null | undefined) => (v == null ? "—" : `${v >= 0 ? "+" : "−"}${Math.abs(v * 100).toFixed(1)} pts`);
const VERDICT: Record<string, { tone: "good" | "warn" | "crit" | "default"; icon: "check" | "alert" | "info"; title: string }> = {
  learned_and_valid: { tone: "good", icon: "check", title: "Learned — and the measurement passes its control" },
  learned: { tone: "good", icon: "check", title: "Learned" }, control_failed: { tone: "crit", icon: "alert", title: "Gain, but the control also gains" },
  not_shown: { tone: "warn", icon: "info", title: "Not shown on strict success" }, not_measured: { tone: "default", icon: "info", title: "Not measured yet" } };

function GainCard({ title, c, tone, sub }: { title: string; c?: Contrast; tone: string; sub: string }) {
  const lo = c?.ci[0] ?? null, hi = c?.ci[1] ?? null, g = c?.gain ?? null;
  const x = (v: number) => 50 + Math.max(-1, Math.min(1, v)) * 50;
  return (
    <div className="rounded-[var(--radius)] border border-line p-3">
      <div className="flex items-center gap-2"><span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: tone }} /><span className="text-[12.5px] font-medium text-ink">{title}</span></div>
      <div className={cx("num mt-1 font-mono text-[26px] font-medium leading-none", lo != null && lo > 0 ? "text-good-ink" : "text-ink")}>{pp(g)}</div>
      <div className="mt-2 relative h-3 w-full" role="img" aria-label={`${title}: gain ${pp(g)}, 95% range ${pp(lo)} to ${pp(hi)}`}>
        <span className="absolute inset-x-0 top-1.5 h-px bg-line-strong" /><span className="absolute top-0 h-3 w-px bg-ink-3" style={{ left: "50%" }} />
        {lo != null && hi != null && <span className="absolute top-[3px] h-1.5 rounded-full" style={{ left: `${x(lo)}%`, width: `${Math.max(0.8, x(hi) - x(lo))}%`, background: `color-mix(in oklab, ${tone} 45%, transparent)` }} />}
        {g != null && <span className="absolute top-0 h-3 w-[3px] rounded" style={{ left: `calc(${x(g)}% - 1.5px)`, background: tone }} />}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10.5px] text-ink-3"><span>−100</span><span>95% {pp(lo)} … {pp(hi)}</span><span>+100</span></div>
      <div className="mt-1.5 text-[11.5px] text-ink-3">{sub}{c?.p_groups != null ? ` · sign-flip p (groups) ${c.p_groups < 0.001 ? "< 0.001" : c.p_groups.toFixed(3)}` : ""}{c?.p_seeds != null ? ` · p (seeds) ${c.p_seeds.toFixed(2)}${c.min_p_seeds != null && c.p_seeds <= c.min_p_seeds ? ` (smallest possible with these seeds — add seeds to go lower)` : ""}` : ""}</div>
    </div>
  );
}

/** What the model learned: strict success and its parts, per model, with ranges. */
function Parts({ comp, parts, order }: { comp: Record<string, Comp>; parts: EvidenceT["parts"]; order: string[] }) {
  return (
    <Figure title="What changed: the score, part by part" x="share of tasks (95 % range where the part is right / wrong)"
      legend={order.map((a) => ({ label: a === "base" || a === "teacher" || a === CTRL || a === FS ? (comp[a] as Comp).label : `trained (${a})`, color: color(a) }))}
      caption={<>Strict success needs every part right. Parts moving while strict success lags is real but incomplete learning — usually arguments (copying the exact ID) are last to come.</>}>
      <div className="space-y-3.5">
        {parts.map((p) => (
          <div key={p.key}>
            <div className="mb-1 text-[12px] text-ink-2">{p.label}</div>
            <div className="space-y-1">
              {order.map((a) => { const v = comp[a][p.key] as Part | undefined; if (!v) return null; return (
                <div key={a} className="flex items-center gap-2">
                  <span className="w-[86px] shrink-0 text-right text-[11px] text-ink-3">{name(a)}</span>
                  <span className="relative block h-3.5 flex-1 rounded-sm bg-surface-3" role="img" aria-label={`${name(a)} ${p.label}: ${fmtPct(v.rate)}${v.ci ? `, 95% ${fmtPct(v.ci[0])}–${fmtPct(v.ci[1])}` : ""}`}>
                    <span className="absolute inset-y-0 left-0 rounded-sm" style={{ width: `${(v.rate ?? 0) * 100}%`, background: color(a), opacity: a === CTRL ? 0.55 : 0.9 }} />
                    {v.ci && <span className="absolute top-1/2 h-px bg-ink" style={{ left: `${v.ci[0] * 100}%`, width: `${Math.max(0.3, (v.ci[1] - v.ci[0]) * 100)}%` }} />}
                  </span>
                  <span className="num w-12 shrink-0 text-right font-mono text-[11.5px] text-ink">{fmtPct(v.rate)}</span>
                </div>); })}
            </div>
          </div>))}
      </div>
    </Figure>
  );
}

function Curves({ curves }: { curves: EvidenceT["curves"] }) {
  const [kind, setKind] = useState<"heldout" | "train">("heldout");
  const series = Object.entries(curves).flatMap(([arm, runs]) => runs.map((r) => ({ arm, seed: r.seed, pts: (kind === "train" ? r.train : r.heldout) })));
  const all = series.flatMap((s) => s.pts);
  if (!all.length) return <Empty icon="training">No training log yet.</Empty>;
  const maxX = Math.max(...all.map((p) => p[0])), maxY = Math.max(...all.map((p) => p[1])), minY = Math.min(0, ...all.map((p) => p[1]));
  const W = 640, H = 230, L = 44, R = 12, T = 10, B = 28;
  const x = (v: number) => L + (v / maxX) * (W - L - R), y = (v: number) => T + (1 - (v - minY) / (maxY - minY || 1)) * (H - T - B);
  const smooth = (pts: [number, number][]) => kind === "train" && pts.length > 60 ? pts.filter((_, i) => i % Math.ceil(pts.length / 120) === 0) : pts;
  return (
    <Figure title={kind === "heldout" ? "Loss on held-out practice examples" : "Training loss"} y="loss (nats per token)" x="training step"
      legend={[...new Set(series.map((s) => s.arm))].map((a) => ({ label: `${name(a)} · one line per seed`, color: color(a) }))}
      caption={kind === "heldout" ? "Held-out loss is measured on examples the student never trained on. Falling for the real arm but not (or less) for the shuffled control is learning that generalises." : "Training loss falls for both arms: the control can memorise its shuffled pairs. That is why held-out loss and task success, not training loss, are the evidence."}>
      <div className="mb-2"><Segmented label="Curve" value={kind} onChange={setKind} options={[{ value: "heldout", label: "held-out loss" }, { value: "train", label: "training loss" }]} /></div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full max-w-[820px]" role="img" aria-label={`${kind === "heldout" ? "Held-out" : "Training"} loss over steps per arm and seed`}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => { const v = minY + f * (maxY - minY); return <g key={f}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--line)" /><text x={L - 5} y={y(v) + 3} fontSize={9.5} textAnchor="end" fill="var(--ink-3)">{v.toFixed(1)}</text></g>; })}
        {[0, 0.5, 1].map((f) => <text key={f} x={x(f * maxX)} y={H - 10} fontSize={9.5} textAnchor="middle" fill="var(--ink-3)">{Math.round(f * maxX)}</text>)}
        {series.map((s) => <polyline key={`${s.arm}${s.seed}`} fill="none" stroke={color(s.arm)} strokeWidth={kind === "train" ? 1 : 1.8} strokeOpacity={0.85} strokeDasharray={s.arm === CTRL ? "4 3" : undefined}
          points={smooth(s.pts).map(([a, b]) => `${x(a)},${y(b)}`).join(" ")}><title>{`${name(s.arm)} seed ${s.seed}`}</title></polyline>)}
      </svg>
    </Figure>
  );
}

function Seeds({ seeds, order }: { seeds: Record<string, Record<string, number>>; order: string[] }) {
  return (
    <Figure title="Does it repeat? Each seed's strict success" x="strict success" caption="One dot per training seed (the untrained student and teacher run once). Gains that appear in every seed are not luck.">
      <div className="space-y-2">{order.filter((a) => seeds[a]).map((a) => (
        <div key={a} className="flex items-center gap-2"><span className="w-[110px] shrink-0 text-right text-[11.5px] text-ink-2">{name(a)}</span>
          <span className="relative block h-5 flex-1 rounded bg-surface-2" role="img" aria-label={`${name(a)} per seed: ${Object.entries(seeds[a]).map(([s, v]) => `seed ${s} ${fmtPct(v)}`).join(", ")}`}>
            {[0.25, 0.5, 0.75].map((f) => <span key={f} className="absolute inset-y-0 w-px bg-line" style={{ left: `${f * 100}%` }} />)}
            {Object.entries(seeds[a]).map(([s, v]) => <span key={s} title={`seed ${s}: ${fmtPct(v, 1)}`} className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface" style={{ left: `${v * 100}%`, background: color(a) }} />)}
          </span>
          <span className="num w-24 shrink-0 font-mono text-[11px] text-ink-3">{Object.values(seeds[a]).map((v) => fmtPct(v)).join(" · ")}</span></div>))}
        <div className="flex justify-between pl-[118px] pr-[104px] font-mono text-[10px] text-ink-3"><span>0%</span><span>50%</span><span>100%</span></div>
      </div>
    </Figure>
  );
}

/** Evidence: did the student learn, where, how reliably — and does the measurement pass its negative control? */
export default function Evidence() {
  const { prefs } = usePrefs();
  const sid = prefs.activeStudy ?? null;
  const e = useApi<EvidenceT>(sid ? `/api/studies/${sid}/evidence` : null);
  const d = e.data && e.data.study.id === sid ? e.data : null;
  const [sp, setSp] = useState<string | null>(null);
  const split = sp && d?.splits.includes(sp) ? sp : d?.splits[0] ?? null;
  const order = useMemo(() => (d && split ? ["base", FS, ...d.study.arms.filter((a) => a !== CTRL), ...d.study.arms.filter((a) => a === CTRL), "teacher"].filter((a) => d.components[split]?.[a]) : []), [d, split]);
  const real = d?.study.arms.find((a) => a !== CTRL);
  const v = d ? VERDICT[d.verdict.status] ?? VERDICT.not_measured : null;
  const con = d && split ? d.contrasts[split] ?? {} : {};
  const vp = d && split ? d.vs_prompting?.[split] ?? {} : {};
  return (
    <div className="space-y-4">
      <PageHeader kicker="Measure" title="Evidence"
        subtitle="Did the student learn, what exactly changed, does it repeat across seeds — and does the measurement pass a negative control?"
        right={<div className="flex flex-wrap items-center gap-2"><StudySelect />{d && d.splits.length > 1 && <Segmented label="Split" value={split ?? ""} onChange={setSp} options={d.splits.map((x) => ({ value: x, label: x === "test" ? "final test" : "practice (dev)" }))} />}</div>} />
      <ErrorLine error={e.error} />
      {!sid ? <Panel><Empty icon="evaluation">Choose a study in the top bar.</Empty></Panel> : !d ? <div className="space-y-3" aria-busy="true"><Skeleton h={160} /><Skeleton h={320} /></div> : !split ? (
        <Panel><Empty icon="evaluation">No evaluated results yet — run Evaluate · dev in Experiment Studio (or the skill check).</Empty></Panel>) : (
        <>
          <Panel title="Verdict" prov={<Prov kind="measured" source={`${split === "test" ? "sealed final test" : "practice tasks"} · ${d.study.seeds.length} seed(s)`} />}
            right={<Explain title="Evidence" what={<>The untrained student, the student after training on the teacher's verified examples, an optional <b>negative control</b> trained on the same examples with answers shuffled across tasks, and the teacher — all on the same {split === "test" ? "sealed final-test" : "practice"} tasks.</>}
              read={<ul className="list-disc space-y-1 pl-4"><li><b>Gain</b> = trained − untrained strict success, with its 95 % range over seeds and task groups. A range above zero is learning these tasks can detect.</li><li>The <b>negative control</b> sees perfect format and real tool names but the wrong pairings. If it also gained, the measurement would be rewarding format, not skill.</li><li>The parts, curves and seeds show <i>what</i> was learned and whether it repeats.</li></ul>}
              math={<><p>Gain <Sym k="delta" />: crossed <Sym k="boot" /> over seeds × task groups; <Sym k="signflip" /> over groups and seeds.</p><p>Part rates: <Sym k="wilson" /> ranges (argument accuracy is an average, shown without a range).</p></>} />}>
            <div className={cx("mb-3 flex items-start gap-2 rounded-[var(--radius)] border px-3 py-2.5", v!.tone === "good" ? "border-[color:var(--good)]/50 bg-[color:var(--good)]/[0.06]" : v!.tone === "crit" ? "border-[color:var(--crit)]/50 bg-[color:var(--crit)]/[0.05]" : "border-line bg-surface-2")}>
              <Icon name={v!.icon} className={v!.tone === "good" ? "text-good-ink" : v!.tone === "crit" ? "text-crit-ink" : "text-ink-3"} />
              <div><div className="text-[13.5px] font-semibold text-ink">{v!.title}</div><div className="text-[12.5px] text-ink-2">{d.verdict.text}</div>
                {d.verdict.prompting?.text && <div className="mt-1 text-[12.5px] text-ink-2"><b className="text-ink">Versus prompting:</b> {d.verdict.prompting.text}</div>}</div>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {real && <GainCard title="Trained on verified examples" c={con[real]} tone={color(real)} sub={`trained ${fmtPct(con[real]?.arm_rate)} vs untrained ${fmtPct(con[real]?.control_rate)}`} />}
              {d.study.arms.includes(CTRL) && <GainCard title="Negative control (answers shuffled)" c={con[CTRL]} tone={color(CTRL)} sub="should stay at or near zero" />}
              {real && vp[real] && <GainCard title={`Training beyond prompting (${d.fewshot?.k ?? "k"} examples)`} c={vp[real]} tone={color(FS)} sub={`trained ${fmtPct(vp[real]?.arm_rate)} vs prompted ${fmtPct(vp[real]?.control_rate)}`} />}
              <div className="rounded-[var(--radius)] border border-line p-3 text-[12px] text-ink-2">
                <div className="text-[12.5px] font-medium text-ink">This study</div>
                <div className="mt-1 font-mono text-[11.5px] leading-relaxed">student {d.study.student}<br />seeds {d.study.seeds.join(", ")} · {d.study.sealed ? "sealed" : "not sealed"}<br />
                  {Object.entries(d.study.train).filter(([, x]) => x != null).map(([k, x]) => `${k} ${String(x)}`).join(" · ")}</div>
                <Button size="sm" icon="compare" onClick={() => { if (real) { handoff("compare.a", `arm:${d.study.id}:${real}`); handoff("compare.b", `arm:${d.study.id}:base`); } goto("compare"); }}>Open in Compare</Button>
              </div>
            </div>
          </Panel>
          <div className="grid gap-4 xl:grid-cols-2 [&>*]:min-w-0">
            <Panel title="What it learned" prov={<Prov kind="measured" />}><Parts comp={d.components[split]} parts={d.parts} order={order} /></Panel>
            <div className="space-y-4">
              <Panel title="How it learned" prov={<Prov kind="measured" source="training logs" />}><Curves curves={d.curves} /></Panel>
              <Panel title="Seeds" prov={<Prov kind="measured" />}><Seeds seeds={d.seeds[split] ?? {}} order={order} /></Panel>
            </div>
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] [&>*]:min-w-0">
            <Panel title="By skill" prov={<Prov kind="measured" />}>
              <div className="overflow-x-auto" tabIndex={0} aria-label="Skills, scrollable"><table className="w-full min-w-[520px] text-[12px]">
                <thead><tr><th className={th}>skill</th>{order.map((a) => <th key={a} className={cx(th, "text-right")}><span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ background: color(a) }} />{name(a)}</span></th>)}</tr></thead>
                <tbody>{Object.entries(d.skills[split] ?? {}).map(([f, r]) => (
                  <tr key={f} className={tr}><td className={cx(td, "font-mono")}>{f}</td>{order.map((a) => <td key={a} className={cx(td, "num text-right font-mono", a === real && (r[a] ?? 0) > (r.base ?? 0) && "font-semibold text-good-ink")}>{fmtPct(r[a])}</td>)}</tr>))}</tbody></table></div>
            </Panel>
            <Panel title="Tasks it now gets right" prov={<Prov kind="measured" source={d.fixed_split ?? ""} />}>
              {!d.fixed.length ? <Empty icon="dot">None yet: no task is right for most seeds and wrong untrained.</Empty> : (
                <><p className="mb-2 text-[12px] text-ink-2">{d.fixed_total} task(s) the untrained student gets wrong and the trained student gets right in most seeds. Open them in Compare to read both transcripts.</p>
                  <ul className="space-y-1">{d.fixed.map((x) => <li key={x.task_id} className="flex items-center justify-between gap-2 text-[12px]"><span className="font-mono text-ink-2">{x.family} · {x.task_id}</span><Badge tone="good">{x.seeds_right}/{x.seeds} seeds</Badge></li>)}</ul>
                  <div className="mt-2"><Button size="sm" icon="compare" onClick={() => { if (real) { handoff("compare.a", `arm:${d.study.id}:${real}`); handoff("compare.b", `arm:${d.study.id}:base`); } goto("compare"); }}>Compare trained vs untrained</Button></div></>)}
            </Panel>
          </div>
          <div className="grid gap-4 xl:grid-cols-2 [&>*]:min-w-0">
            <PowerPanel p={d.power} />
            <div className="space-y-4">
              <ForgettingPanel sid={d.study.id} arms={d.study.arms} name={(a) => (a === CTRL ? "negative control" : `trained · ${a}`)} />
              {d.fewshot && (
                <Panel title="Training versus prompting" prov={<Prov kind="measured" source={`${d.fewshot.k} training examples in the prompt`} />}>
                  <p className="mb-2 text-[12.5px] text-ink-2">The untrained student given {d.fewshot.k} worked training conversations ({(d.fewshot.families ?? []).join(", ")}) in its prompt — the cheapest alternative to training. Examples are from the training split only and frozen (sha256 {d.fewshot.sha256?.slice(0, 12) ?? "—"}…).</p>
                  {Object.keys(vp).length ? <PromptingTable rows={[
                    ...(vp[FS] ? [{ label: "prompting − untrained", gain: vp[FS].gain, ci: vp[FS].ci, p: vp[FS].p_groups }] : []),
                    ...d.study.arms.filter((a) => vp[a]).map((a) => ({ label: `${a === CTRL ? "negative control" : `trained (${a})`} − prompting`, gain: vp[a].gain, ci: vp[a].ci, p: vp[a].p_groups }))]} />
                    : <Empty icon="dot">Analyse the study to compare training with prompting.</Empty>}
                </Panel>)}
            </div>
          </div>
          <Limits>{d.honesty}</Limits>
        </>)}
    </div>
  );
}
