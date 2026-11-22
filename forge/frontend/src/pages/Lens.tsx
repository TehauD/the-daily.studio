import { useEffect, useMemo, useState } from "react";
import { LegendKey } from "../components/charts";
import { JobLog, StudySelect } from "../components/live";
import { Badge, Button, Empty, ErrorLine, Notice, PageHeader, Panel, Prov, Readout, Segmented, Skeleton, cx, inputCls } from "../components/ui";
import { api, fmt, qs } from "../lib/api";
import { useAction, useApi } from "../lib/hooks";
import { AskAI } from "../lib/assistant";
import { usePrefs } from "../lib/prefs";
import type { Job, StudySummary } from "../lib/types";

/* ------------------------------------------------------------------ types */
interface Rate { rate: number; n: number }
interface SkillSpaceT { split: string; skills: string[]; teacher: Record<string, Rate>; base: Record<string, Rate>; runs: { arm: string; seed: number; rates: Record<string, Rate> }[]; focus: string[] | null; basis: string }
interface Tok { t: string; b: number; f: number; a: boolean }
interface LensEp { task_id: string; family: string; prompt: string; turns: { turn: number; tokens: Tok[] }[]; mean_delta: number; nll_base: number; nll_final: number }
interface LensPoint { label: string; step: number | null; nll: number; agreement: number; tokens: number; families: Record<string, number> }
interface LensT {
  available: boolean; stale?: boolean; snapshots: number; trained: boolean; curve: LensPoint[]; tokens_gained: { token: string; n: number; mean_delta: number }[];
  tokens_lost: { token: string; n: number; mean_delta: number }[]; episodes: LensEp[]; honesty: string; basis: string; episodes_used: number; records: number; tokens: number;
  generated_at: string; device: string; skipped: Record<string, number>;
}

export const SKILL: Record<string, string> = {
  catalog_lookup: "Catalog lookup", multi_step_quote: "Multi-step quote", missing_item: "Missing-item detection", extraction: "SKU extraction (regression check)",
  doc_answerable: "Answer from your documents", doc_unanswerable: "Say NOT_FOUND when absent",
};
// Agent studies name their own skills (frozen in the plan); set per render by the page before children read it.
let AGENT_SKILLS: Record<string, string> = {};
const skill = (f: string) => AGENT_SKILLS[f] ?? SKILL[f] ?? f;

export default function Lens() {
  const { prefs } = usePrefs();
  const sid = prefs.activeStudy;
  const s = useApi<StudySummary>(sid ? `/api/studies/${sid}` : null, 5000);
  const plan = s.data?.plan;
  AGENT_SKILLS = Object.fromEntries(((plan?.taskset as { agent?: { skills?: { id: string; name: string }[] } } | undefined)?.agent?.skills ?? []).map((k) => [k.id, k.name]));
  const runs = useMemo(() => (plan ? plan.arms.flatMap((a) => plan.seeds.map((sd) => `${a}|${sd}`)) : []), [plan]);
  const [run, setRun] = useState("");
  useEffect(() => { if (runs.length && !runs.includes(run)) setRun(runs[0]); }, [runs, run]);
  const [arm, seed] = run ? [run.split("|")[0], Number(run.split("|")[1])] : ["", 0];
  const heldout = s.data?.state.stages.evaluate_test?.status === "completed";
  const [split, setSplit] = useState<"dev" | "test">("dev");
  const lens = useApi<LensT>(sid && run ? `/api/studies/${sid}/lens${qs({ arm, seed })}` : null);
  const running = s.data?.jobs?.find((j) => j.status === "running" && j.kind === "lens");
  return (
    <div className="space-y-4 fit:flex fit:h-full fit:min-h-0 fit:flex-col fit:gap-3 fit:space-y-0">
      <PageHeader kicker="Research" title="Distillation Lens"
        subtitle="What distillation changed, three ways: which skills moved toward the teacher, how close the student's predictions came to the teacher's over training, and which words it now expects."
        right={<>
          <AskAI q="Interpret the Distillation Lens: the skill space, the surprise / agreement curve and the tokens gained or lost. Is training still helping? What did the student actually learn?" content label="Interpret with AI" />
          <StudySelect />
          {runs.length > 0 && <select className={cx(inputCls, "h-8 !w-auto font-sans")} value={run} onChange={(e) => setRun(e.target.value)} aria-label="Trained run">
            {runs.map((r) => <option key={r} value={r}>{r.replace("|", " · seed ")}</option>)}</select>}
        </>} />
      <ErrorLine error={s.error} />
      {!sid ? <Panel><Empty icon="lens">Select or create a study.</Empty></Panel> : !s.data ? <Skeleton h={480} /> : (
        <div className="grid gap-4 fit:min-h-0 fit:flex-1 fit:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] fit:gap-3">
          <div className="scroll-thin flex min-w-0 flex-col gap-4 fit:min-h-0 fit:gap-3 fit:overflow-auto fit:pr-1">
            <SkillSpace sid={sid} split={split} right={heldout ? <Segmented label="Split" value={split} onChange={setSplit} options={[{ value: "dev", label: "dev" }, { value: "test", label: "test" }]} /> : null} />
            <Curve lens={lens.data} />
          </div>
          <div className="flex min-w-0 flex-col gap-4 fit:min-h-0 fit:gap-3">
            {(running || !lens.data?.available || lens.data?.stale) && (
              <ComputePanel sid={sid} arm={arm} seed={seed} lens={lens.data} running={running} onDone={() => { void lens.reload(); void s.reload(); }} />
            )}
            <Words lens={lens.data} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ compute */
function ComputePanel({ sid, arm, seed, lens, running, onDone }: { sid: string; arm: string; seed: number; lens: LensT | null; running?: Job; onDone: () => void }) {
  const act = useAction();
  const [job, setJob] = useState<string | null>(null);
  const id = running?.id ?? job;
  return (
    <Panel title="Measure this run" eyebrow={`${arm} · seed ${seed}`}>
      {id ? <JobLog key={id} jobId={id} height={170} onDone={() => { setJob(null); onDone(); }} /> : lens && !lens.trained ? (
        <Empty>Train this run first (Experiment Studio → Train).</Empty>
      ) : (
        <div className="space-y-3 text-[12.5px] text-ink-2">
          <p>FORGE feeds the teacher's answers on <b className="font-medium text-ink">dev tasks the student never trained on</b> through the student — before training, at {lens?.snapshots ?? 0} saved
            point{lens?.snapshots === 1 ? "" : "s"} during training, and after — and reads how likely the student found each of the teacher's tokens. No text is generated; it takes seconds to minutes on the GPU.</p>
          {lens?.stale && <Notice tone="warn">The adapter changed since this was measured. Measure again.</Notice>}
          {lens && lens.snapshots === 0 && <Notice tone="info">This run was trained before FORGE kept training snapshots, so the curve will have two points (before and after). New runs keep about five.</Notice>}
          <Notice tone="info">Uses the GPU like training: unload the teacher in LM Studio first.</Notice>
          <div className="flex items-center gap-3">
            <Button tone="primary" icon="play" busy={act.busy} onClick={() => void act.run(async () => setJob((await api.post<Job>(`/api/studies/${sid}/lens`, { arm, seed })).id))}>Measure</Button>
          </div>
          <ErrorLine error={act.error} />
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ skill space */
const SW = 640, ROW = 46, LX = 190, RX = 92;
function SkillSpace({ sid, split, right }: { sid: string; split: string; right: React.ReactNode }) {
  const d = useApi<SkillSpaceT>(`/api/studies/${sid}/skillspace${qs({ split })}`, 15000);
  const [hover, setHover] = useState<string | null>(null);
  const data = d.data;
  const skills = useMemo(() => {
    if (!data) return [];
    const f = new Set(data.focus ?? []);
    return [...data.skills].sort((a, b) => Number(f.has(b)) - Number(f.has(a)));
  }, [data]);
  const x = (v: number) => LX + v * (SW - LX - RX);
  return (
    <Panel title="Skill space" eyebrow={`strict success · ${split}`} prov={<Prov kind="measured" source="episode files" />} right={right}>
      <ErrorLine error={d.error} />
      {!data ? <Skeleton h={200} /> : !data.runs.length && !Object.keys(data.base).length ? <Empty>Evaluate the base and tuned students on {split} to fill this in.</Empty> : (
        <div className="space-y-2">
          <p className="text-[12px] leading-relaxed text-ink-2">Each row is a skill. The arrow runs from the <b className="font-medium text-ink">untrained student</b> to the <b className="font-medium text-ink">trained student</b> (mean over seeds; each seed is a dot); the <b className="font-medium text-ink">teacher</b> is the target. On the right: how much of the gap to the teacher training closed.</p>
          <svg viewBox={`0 0 ${SW} ${skills.length * ROW + 34}`} className="block h-auto w-full" role="img" aria-label="Skill space: base, tuned and teacher strict success per skill">
            <defs>
              {["up", "down", "flat"].map((k) => (
                <marker key={k} id={`arr-${k}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0 0L10 5L0 10z" fill={k === "up" ? "var(--div-pos)" : k === "down" ? "var(--div-neg)" : "var(--div-mid)"} />
                </marker>
              ))}
            </defs>
            {[0, 0.25, 0.5, 0.75, 1].map((t) => (
              <g key={t}>
                <line x1={x(t)} x2={x(t)} y1={6} y2={skills.length * ROW + 10} stroke="var(--line)" />
                <text x={x(t)} y={skills.length * ROW + 26} textAnchor="middle" fontSize={10.5} fill="var(--ink-3)" fontFamily="var(--font-mono)">{t * 100}%</text>
              </g>
            ))}
            <text x={SW - RX + 12} y={14} fontSize={9.5} fill="var(--ink-3)" fontFamily="var(--font-mono)">GAP CLOSED</text>
            {skills.map((f, i) => {
              const y = 26 + i * ROW;
              const b = data.base[f]?.rate, t = data.teacher[f]?.rate;
              const seeds = data.runs.map((r) => r.rates[f]?.rate).filter((v): v is number => v != null);
              const m = seeds.length ? seeds.reduce((a, c) => a + c, 0) / seeds.length : null;
              const dir = m == null || b == null ? "flat" : m - b > 1e-9 ? "up" : m - b < -1e-9 ? "down" : "flat";
              const closed = m != null && b != null && t != null && t - b > 1e-9 ? (m - b) / (t - b) : null;
              const focus = data.focus?.includes(f);
              const on = hover === f;
              return (
                <g key={f} onMouseEnter={() => setHover(f)} onMouseLeave={() => setHover(null)}>
                  <rect x={0} y={y - 18} width={SW} height={ROW - 6} fill={on ? "var(--surface-2)" : "transparent"} rx={4} />
                  <text x={8} y={y - 2} fontSize={12} fill="var(--ink)" fontWeight={500}>{skill(f).length > 26 ? skill(f).slice(0, 25) + "…" : skill(f)}</text>
                  <text x={8} y={y + 12} fontSize={10} fill="var(--ink-3)" fontFamily="var(--font-mono)">{focus ? "FOCUS · " : ""}n={data.base[f]?.n ?? data.teacher[f]?.n ?? "—"}</text>
                  {b != null && m != null && Math.abs(m - b) > 1e-9 && (
                    <line x1={x(b)} y1={y} x2={x(m)} y2={y} stroke={dir === "up" ? "var(--div-pos)" : "var(--div-neg)"} strokeWidth={2.5} markerEnd={`url(#arr-${dir})`} />
                  )}
                  {seeds.map((v, k) => <circle key={k} cx={x(v)} cy={y + 9} r={3} fill="var(--s-tuned)" stroke="var(--surface)" strokeWidth={1.5}><title>{`seed run: ${fmt.pct(v, 0)}`}</title></circle>)}
                  {t != null && <rect x={x(t) - 5} y={y - 5} width={10} height={10} transform={`rotate(45 ${x(t)} ${y})`} fill="var(--s-teacher)" stroke="var(--surface)" strokeWidth={2}><title>{`teacher: ${fmt.pct(t, 0)}`}</title></rect>}
                  {b != null && <circle cx={x(b)} cy={y} r={5.5} fill="var(--s-base)" stroke="var(--surface)" strokeWidth={2}><title>{`untrained student: ${fmt.pct(b, 0)}`}</title></circle>}
                  {m != null && <circle cx={x(m)} cy={y} r={8} fill="none" stroke="var(--s-tuned)" strokeWidth={2.5}><title>{`trained (mean of ${seeds.length}): ${fmt.pct(m, 0)}`}</title></circle>}
                  <text x={SW - RX + 12} y={y + 4} fontSize={12} fontFamily="var(--font-mono)" fill={closed == null ? "var(--ink-3)" : closed < 0 ? "var(--crit-ink)" : "var(--ink)"}>
                    {closed == null ? (t != null && b != null && t - b <= 1e-9 ? "no gap" : "—") : `${Math.round(closed * 100)}%`}</text>
                  {on && <text x={x(0.5)} y={y - 8} textAnchor="middle" fontSize={10.5} fontFamily="var(--font-mono)" fill="var(--ink-2)">
                    {`base ${fmt.pct(b, 0)} → trained ${fmt.pct(m, 0)} · teacher ${fmt.pct(t, 0)}`}</text>}
                </g>
              );
            })}
          </svg>
          <LegendKey items={[{ label: "untrained student", color: "var(--s-base)" }, { label: "trained (ring = mean · dots = seeds)", color: "var(--s-tuned)" }, { label: "teacher", color: "var(--s-teacher)" }]} />
          <div className="text-[11px] text-ink-3">{data.basis}. Statistical intervals and tests live in the Evaluation Lab.</div>
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ distance to teacher */
function MiniLine({ pts, value, label, fmtV, better }: { pts: LensPoint[]; value: (p: LensPoint) => number; label: string; fmtV: (v: number) => string; better: "lower" | "higher" }) {
  const W = 300, H = 150, L = 44, R = 22, T = 14, B = 28;
  const [hi, setHi] = useState<number | null>(null);
  const vs = pts.map(value);
  const lo = Math.min(...vs), hiV = Math.max(...vs);
  const pad = (hiV - lo) * 0.12 || Math.abs(hiV) * 0.1 || 0.1;
  // Agreement is a share: its axis starts at 0. Surprise is zoomed to the measured range (labelled).
  const y0 = better === "higher" ? 0 : Math.max(0, lo - pad), y1 = better === "higher" ? Math.min(1, Math.max(0.1, hiV * 1.25)) : hiV + pad;
  const xs = (i: number) => L + (pts.length > 1 ? (i / (pts.length - 1)) * (W - L - R) : (W - L - R) / 2);
  const ys = (v: number) => T + (1 - (v - y0) / (y1 - y0 || 1)) * (H - T - B);
  const path = vs.map((v, i) => `${i ? "L" : "M"}${xs(i)} ${ys(v)}`).join("");
  return (
    <div className="min-w-0">
      <div className="micro mb-1 text-ink-3">{label} <span className="normal-case tracking-normal">({better} is closer to the teacher)</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={label} onMouseLeave={() => setHi(null)}>
        {[y0, (y0 + y1) / 2, y1].map((t) => (
          <g key={t}><line x1={L} x2={W - R} y1={ys(t)} y2={ys(t)} stroke="var(--line)" />
            <text x={L - 6} y={ys(t) + 3} textAnchor="end" fontSize={10} fill="var(--ink-3)" fontFamily="var(--font-mono)">{fmtV(t)}</text></g>
        ))}
        <path d={path} fill="none" stroke="var(--s-tuned)" strokeWidth={2} />
        {pts.map((p, i) => (
          <g key={i} onMouseEnter={() => setHi(i)}>
            <rect x={xs(i) - 14} y={T} width={28} height={H - T - B} fill="transparent" />
            <circle cx={xs(i)} cy={ys(vs[i])} r={i === 0 ? 5 : 4} fill={i === 0 ? "var(--s-base)" : "var(--s-tuned)"} stroke="var(--surface)" strokeWidth={2} />
            <text x={xs(i)} y={H - 10} textAnchor="middle" fontSize={9.5} fill="var(--ink-3)" fontFamily="var(--font-mono)">{i === 0 ? "base" : p.label === "final" ? "final" : p.step}</text>
          </g>
        ))}
        {hi != null && <g>
          <line x1={xs(hi)} x2={xs(hi)} y1={T} y2={H - B} stroke="var(--ink-3)" strokeDasharray="3 3" />
          <text x={Math.min(Math.max(xs(hi), L + 40), W - R - 40)} y={T - 3} textAnchor="middle" fontSize={10.5} fill="var(--ink)" fontFamily="var(--font-mono)">{pts[hi].label}: {fmtV(vs[hi])}</text>
        </g>}
      </svg>
    </div>
  );
}

function Curve({ lens }: { lens: LensT | null }) {
  const ok = lens?.available && lens.curve?.length;
  const c = ok ? lens.curve : [];
  const first = c[0], last = c.at(-1);
  return (
    <Panel title="Distance to the teacher" eyebrow="over training · dev" prov={ok ? <Prov kind="measured" source={`teacher-forced · ${lens!.tokens} tokens`} /> : undefined}>
      {!ok ? <Empty>Measure a run to see how its predictions approached the teacher's during training.</Empty> : (
        <div className="space-y-3">
          <p className="text-[12px] leading-relaxed text-ink-2">How surprised the student is by the teacher's next token (lower = closer), and how often its single best guess <i>is</i> the teacher's token — before training, at each saved point, and at the end.</p>
          <div className="grid grid-cols-3 gap-3">
            <Readout size="sm" label="surprise · before → after" value={`${first!.nll.toFixed(2)} → ${last!.nll.toFixed(2)}`} unit="nats" />
            <Readout size="sm" label="same top guess · after" value={fmt.pct(last!.agreement, 0)} sub={`before ${fmt.pct(first!.agreement, 0)}`} />
            <Readout size="sm" label="measured on" value={lens!.episodes_used} sub={`dev episodes · ${lens!.records} turns`} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <MiniLine pts={c} value={(p) => p.nll} label="Surprise (NLL per token)" fmtV={(v) => v.toFixed(2)} better="lower" />
            <MiniLine pts={c} value={(p) => p.agreement} label="Same top guess as teacher" fmtV={(v) => fmt.pct(v, 0)} better="higher" />
          </div>
          <details className="text-[11.5px] text-ink-2"><summary className="cursor-pointer text-ink-3">Table · per skill</summary>
            <table className="mt-2 w-full font-mono text-[11px]"><thead><tr className="text-ink-3"><th className="text-left font-normal">point</th><th className="text-right font-normal">NLL</th><th className="text-right font-normal">top-1</th>
              {Object.keys(first!.families).map((f) => <th key={f} className="text-right font-normal">{skill(f).split(" ")[0]}</th>)}</tr></thead>
              <tbody>{c.map((p) => <tr key={p.label} className="border-t border-line"><td>{p.label}</td><td className="text-right">{p.nll.toFixed(3)}</td><td className="text-right">{fmt.pct(p.agreement, 1)}</td>
                {Object.keys(first!.families).map((f) => <td key={f} className="text-right">{p.families[f]?.toFixed(3)}</td>)}</tr>)}</tbody></table>
          </details>
          <div className="text-[11px] text-ink-3">{lens!.honesty}</div>
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ word heatmap */
/** Colour saturates at ±clip nats, clip = 95th percentile of |Δ| over every measured token (min 0.25), shown in the legend. */
function deltaClip(eps: LensEp[]): number {
  const v = eps.flatMap((e) => e.turns.flatMap((t) => t.tokens.map((k) => Math.abs(k.f - k.b)))).sort((a, b) => a - b);
  return Math.max(0.25, v[Math.floor(v.length * 0.95)] ?? 0.25);
}
function tokBg(t: Tok, mode: "delta" | "before" | "after", clip: number): string {
  if (mode === "delta") {
    const d = Math.max(-clip, Math.min(clip, t.f - t.b));
    const pct = Math.round((Math.abs(d) / clip) * 70);
    return pct < 3 ? "transparent" : `color-mix(in oklab, ${d > 0 ? "var(--div-pos)" : "var(--div-neg)"} ${pct}%, transparent)`;
  }
  const p = Math.exp(mode === "before" ? t.b : t.f);
  const pct = Math.round((1 - p) * 65); // highlight what the model found unlikely
  return pct < 4 ? "transparent" : `color-mix(in oklab, var(--warn) ${pct}%, transparent)`;
}
const show = (s: string) => s.replace(/\n/g, "↵\n");
const Sw = ({ c }: { c: string }) => <span className="inline-block h-2.5 w-2.5 rounded-[2px] align-baseline" style={{ background: c }} />;

function Words({ lens }: { lens: LensT | null }) {
  const [mode, setMode] = useState<"delta" | "before" | "after">("delta");
  const [sel, setSel] = useState<string | null>(null);
  const [hov, setHov] = useState<Tok | null>(null);
  const eps = useMemo(() => [...(lens?.episodes ?? [])].sort((a, b) => b.mean_delta - a.mean_delta), [lens]);
  const clip = useMemo(() => deltaClip(eps), [eps]);
  const ep = eps.find((e) => e.task_id === sel) ?? eps[0];
  const ok = lens?.available && eps.length;
  const maxG = Math.max(0.01, ...(lens?.tokens_gained ?? []).map((r) => Math.abs(r.mean_delta)), ...(lens?.tokens_lost ?? []).map((r) => Math.abs(r.mean_delta)));
  return (
    <Panel fill title="Word heatmap" eyebrow="teacher's answers, read by the student" className="fit:min-h-0 fit:flex-1" prov={ok ? <Prov kind="measured" source="log p, base vs final adapter" /> : undefined}
      right={ok ? <Segmented label="Colour by" value={mode} onChange={setMode} options={[{ value: "delta", label: "change" }, { value: "before", label: "before" }, { value: "after", label: "after" }]} /> : undefined}>
      {!ok ? <Empty>Measure a run to see which of the teacher's words the student learned to expect.</Empty> : (
        <div className="grid gap-3 fit:h-full fit:min-h-0 xl:grid-cols-[220px_minmax(0,1fr)]">
          <div className="scroll-thin max-h-[420px] overflow-auto rounded-[var(--radius)] border border-line fit:max-h-none">
            {eps.map((e) => (
              <button key={e.task_id} type="button" onClick={() => setSel(e.task_id)} className={cx("block w-full border-b border-line px-2.5 py-1.5 text-left last:border-0 hover:bg-surface-2", e === ep && "!bg-accent-soft")}>
                <div className="flex items-center justify-between gap-2"><span className="truncate font-mono text-[11px] text-ink">{e.task_id}</span>
                  <span className={cx("num font-mono text-[10.5px]", e.mean_delta >= 0 ? "text-good-ink" : "text-crit-ink")}>{e.mean_delta >= 0 ? "+" : "−"}{Math.abs(e.mean_delta).toFixed(2)}</span></div>
                <div className="truncate text-[10.5px] text-ink-3">{skill(e.family)}</div>
              </button>
            ))}
          </div>
          <div className="scroll-thin min-w-0 space-y-3 fit:min-h-0 fit:overflow-auto fit:pr-1">
            <p className="text-[12px] leading-relaxed text-ink-2">
              {mode === "delta" ? <>Each word of the teacher's answer, coloured by how much <b className="font-medium text-ink">more <Sw c="var(--div-pos)" /></b> or <b className="font-medium text-ink">less <Sw c="var(--div-neg)" /></b> the trained student expected it than the untrained one (full colour = ±{clip.toFixed(2)} nats).</>
                : <>Highlighted words were <b className="font-medium text-ink">unlikely</b> for the {mode === "before" ? "untrained" : "trained"} student — the darker, the more it would have said something else.</>}
              {" "}Hover a word for exact numbers.</p>
            {ep && <>
              <div className="rounded-[var(--radius)] border border-line bg-surface-2 p-2.5">
                <div className="micro text-ink-3">task · {skill(ep.family)}</div>
                <div className="mt-1 text-[12.5px] text-ink">{ep.prompt}</div>
              </div>
              {ep.turns.map((tr) => (
                <div key={tr.turn}>
                  <div className="micro mb-1 text-ink-3">teacher action {tr.turn + 1}</div>
                  <div className="whitespace-pre-wrap break-words rounded-[var(--radius)] border border-line p-2.5 font-mono text-[12.5px] leading-[1.9] text-ink [font-variant-ligatures:none]">
                    {tr.tokens.map((t, i) => (
                      <span key={i} onMouseEnter={() => setHov(t)} onMouseLeave={() => setHov(null)} className={cx("rounded-[2px] px-[1px]", !t.a && "underline decoration-dotted decoration-ink-3 underline-offset-4")} style={{ background: tokBg(t, mode, clip) }}>{show(t.t)}</span>
                    ))}
                  </div>
                </div>
              ))}
              <div className="num h-5 font-mono text-[11px] text-ink-2">
                {hov ? <>“{hov.t.replace(/\n/g, "↵")}” · before p={Math.exp(hov.b).toFixed(3)} · after p={Math.exp(hov.f).toFixed(3)} · Δ log p {(hov.f - hov.b >= 0 ? "+" : "−") + Math.abs(hov.f - hov.b).toFixed(2)} · {hov.a ? "trained student's top guess" : "not its top guess"}</>
                  : <span className="text-ink-3">dotted underline = the trained student's top guess was a different token</span>}
              </div>
            </>}
            <div className="grid gap-3 md:grid-cols-2">
              {([["Words it now expects most", lens!.tokens_gained.slice(0, 12), "var(--div-pos)"], ["Words it expects less", lens!.tokens_lost.slice(0, 8), "var(--div-neg)"]] as const).map(([title, rows, col]) => (
                <div key={title}>
                  <div className="micro mb-1.5 text-ink-3">{title} <span className="normal-case tracking-normal">(mean Δ log p · count)</span></div>
                  {rows.length === 0 ? <div className="text-[11.5px] text-ink-3">none</div> : rows.map((r) => (
                    <div key={r.token} className="grid grid-cols-[minmax(0,120px)_1fr_74px] items-center gap-2 py-0.5">
                      <span className="truncate font-mono text-[11.5px] text-ink [font-variant-ligatures:none]">{r.token}</span>
                      <span className="h-[6px] rounded-full" style={{ width: `${(Math.abs(r.mean_delta) / maxG) * 100}%`, background: col }} />
                      <span className="num text-right font-mono text-[10.5px] text-ink-2">{r.mean_delta >= 0 ? "+" : "−"}{Math.abs(r.mean_delta).toFixed(2)} · {r.n}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-3 text-[11px] text-ink-3">
              <Badge>{lens!.device}</Badge><span>{lens!.basis}.</span>{Object.keys(lens!.skipped).length > 0 && <span>Skipped (too long): {Object.values(lens!.skipped).reduce((a, b) => a + b, 0)}.</span>}
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
