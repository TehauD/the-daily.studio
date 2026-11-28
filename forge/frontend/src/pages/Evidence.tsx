import { useMemo, useState } from "react";
import { Explain } from "../components/Explain";
import { Icon } from "../components/icons";
import { StudySelect } from "../components/live";
import { Figure, Limits, fmtPct } from "../components/results";
import { ForgettingPanel, PowerPanel, PromptingTable, type ForgettingT, type PowerT } from "../components/Rigor";
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
  vs_prompting: Record<string, Record<string, Contrast>>; fewshot: { k: number; task_ids?: string[]; families?: string[]; sha256?: string } | null; power: PowerT | null; forgetting: ForgettingT | null;
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

function GainCard({ title, c, tone, sub, expert = true }: { title: string; c?: Contrast; tone: string; sub: string; expert?: boolean }) {
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
      <div className="mt-1.5 text-[11.5px] text-ink-3">{sub}{!expert ? "" : c?.p_groups != null ? ` · sign-flip p (groups) ${c.p_groups < 0.001 ? "< 0.001" : c.p_groups.toFixed(3)}` : ""}{expert && c?.p_seeds != null ? ` · p (seeds) ${c.p_seeds.toFixed(2)}${c.min_p_seeds != null && c.p_seeds <= c.min_p_seeds ? ` (smallest possible with these seeds — add seeds to go lower)` : ""}` : ""}</div>
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

type Tone = "good" | "warn" | "crit" | "default";
interface Tile { q: string; a: string; tone: Tone; num?: string; line: string; to: string }
const TONE: Record<Tone, string> = { good: "border-[color:var(--good)]/50 bg-[color:var(--good)]/[0.06]", warn: "border-[color:var(--warn)]/60 bg-[color:var(--warn)]/[0.07]",
  crit: "border-[color:var(--crit)]/50 bg-[color:var(--crit)]/[0.05]", default: "border-line bg-surface-2" };
const INK: Record<Tone, string> = { good: "text-good-ink", warn: "text-warn-ink", crit: "text-crit-ink", default: "text-ink-2" };

/** The four questions a reviewer asks, each answered in plain words first. */
function tiles(d: EvidenceT, split: string): Tile[] {
  const where = split === "test" ? "final test" : "practice tasks";
  const real = d.study.arms.find((a) => a !== CTRL);
  const c = real ? d.contrasts[split]?.[real] : undefined;
  const ctl = d.contrasts[split]?.[CTRL];
  const st = d.verdict.split === split ? d.verdict.status : c?.ci[0] != null && c.ci[0] > 0 ? "learned" : c ? "not_shown" : "not_measured";
  const learned: Tile = st === "not_measured" || !c ? { q: "Did it learn?", a: "Not measured yet", tone: "default", line: "Run Evaluate and Analyze.", to: "ev-learned" }
    : st === "control_failed" ? { q: "Did it learn?", a: "Can't trust it yet", tone: "crit", num: pp(c.gain), line: `The shuffled-answer control also gained (${pp(ctl?.gain)}): the score may reward format.`, to: "ev-learned" }
    : c.ci[0] != null && c.ci[0] > 0 ? { q: "Did it learn?", a: d.study.arms.includes(CTRL) ? "Yes — and the control confirms it" : "Yes", tone: "good", num: pp(c.gain),
      line: `${fmtPct(c.control_rate)} → ${fmtPct(c.arm_rate)} on the ${where}; at least ${pp(c.ci[0])} even in the worst plausible case.`, to: "ev-learned" }
    : { q: "Did it learn?", a: "Not shown", tone: "warn", num: pp(c.gain), line: `${fmtPct(c.control_rate)} → ${fmtPct(c.arm_rate)} on the ${where}; the gain could be zero.`, to: "ev-learned" };
  const vp = real ? d.vs_prompting?.[split]?.[real] : undefined;
  const prompting: Tile = !d.fewshot ? { q: "Better than just prompting?", a: "Not measured", tone: "default", line: "Studies created before v0.30 have no prompting baseline.", to: "ev-prompting" }
    : !vp ? { q: "Better than just prompting?", a: "Not measured yet", tone: "default", line: "Analyse the study to compare.", to: "ev-prompting" }
    : vp.ci[0] != null && vp.ci[0] > 0 ? { q: "Better than just prompting?", a: "Yes — training adds value", tone: "good", num: pp(vp.gain), line: `Beats the untrained model shown ${d.fewshot.k} worked examples (${fmtPct(vp.control_rate)} → ${fmtPct(vp.arm_rate)}).`, to: "ev-prompting" }
    : vp.ci[1] != null && vp.ci[1] < 0 ? { q: "Better than just prompting?", a: "No — prompting does better", tone: "crit", num: pp(vp.gain), line: `${d.fewshot.k} worked examples in the prompt beat training on these tasks.`, to: "ev-prompting" }
    : { q: "Better than just prompting?", a: "No difference shown", tone: "warn", num: pp(vp.gain), line: `Showing ${d.fewshot.k} worked examples may be enough — training isn't justified yet.`, to: "ev-prompting" };
  const p = d.power;
  const power: Tile = !p ? { q: "Could this study tell?", a: "Not planned", tone: "default", line: "No power analysis was frozen with this study (created before v0.30).", to: "ev-power" }
    : p.mde_groups == null ? { q: "Could this study tell?", a: "Too small to tell", tone: "warn", line: "Even a +60 pt gain would often be missed. Add task groups or seeds.", to: "ev-power" }
    : (c?.gain ?? -1) >= p.mde_groups ? { q: "Could this study tell?", a: "Yes", tone: "good", num: `≥ ${(p.mde_groups * 100).toFixed(0)} pts`, line: `Sensitive to gains of ${(p.mde_groups * 100).toFixed(0)} pts or more; the observed gain is above that.${p.seed_floor_p >= 0.05 ? " Seed test needs ≥ 6 seeds." : ""}`, to: "ev-power" }
    : { q: "Could this study tell?", a: c ? "Not for a gain this small" : `Detects ≥ ${(p.mde_groups * 100).toFixed(0)} pts`, tone: "warn", num: `≥ ${(p.mde_groups * 100).toFixed(0)} pts`,
      line: `It reliably detects only gains of ${(p.mde_groups * 100).toFixed(0)} pts or more${p.seed_floor_p >= 0.05 ? `, and ${d.study.seeds.length} seeds can't pass the seed test` : ""}. More seeds or tasks would help.`, to: "ev-power" };
  const f = d.forgetting && d.forgetting.computed !== false ? d.forgetting : null;
  const fa = f && real ? f.arms[real] : null;
  const cost: Tile = !fa ? { q: "What did it cost?", a: "Not checked yet", tone: "default", line: "Run the forgetting check: does it still handle everyday English?", to: "ev-forgetting" }
    : fa.status === "forgetting" ? { q: "What did it cost?", a: "Some general language lost", tone: "crit", num: `${fa.pooled.change >= 0 ? "+" : "−"}${Math.abs(fa.pooled.change * 100).toFixed(0)} %`, line: "Everyday English got harder for it to predict after training.", to: "ev-forgetting" }
    : fa.status === "inconclusive" ? { q: "What did it cost?", a: "Unclear", tone: "warn", line: "The forgetting check can't tell; try a larger general-text file.", to: "ev-forgetting" }
    : { q: "What did it cost?", a: "No forgetting seen", tone: "good", num: `${fa.pooled.change >= 0 ? "+" : "−"}${Math.abs(fa.pooled.change * 100).toFixed(0)} %`, line: "Everyday English is predicted as well as (or better than) before training.", to: "ev-forgetting" };
  return [learned, prompting, power, cost];
}

function Scorecard({ items }: { items: Tile[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" role="list" aria-label="Answers">
      {items.map((t) => (
        <a key={t.q} role="listitem" href={`#${t.to}`} onClick={(e) => { e.preventDefault(); document.getElementById(t.to)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
          className={cx("block rounded-[var(--radius)] border p-3 transition hover:shadow-[var(--shadow)] focus-visible:outline-2", TONE[t.tone])}>
          <div className="text-[12px] text-ink-2">{t.q}</div>
          <div className={cx("mt-0.5 text-[15px] font-semibold leading-snug", INK[t.tone])}>{t.a}</div>
          {t.num && <div className="num mt-1 font-mono text-[20px] leading-none text-ink">{t.num}</div>}
          <div className="mt-1.5 text-[12px] leading-snug text-ink-2">{t.line}</div>
          <div className="mt-1.5 text-[11px] text-accent">See the evidence ↓</div>
        </a>))}
    </div>
  );
}

/** Evidence: did the student learn, where, how reliably — and does the measurement pass its negative control? */
export default function Evidence() {
  const { prefs } = usePrefs();
  const expert = prefs.mode === "expert";
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
  const toCompare = () => { if (d && real) { handoff("compare.a", `arm:${d.study.id}:${real}`); handoff("compare.b", `arm:${d.study.id}:base`); } goto("compare"); };
  return (
    <div className="space-y-4">
      <PageHeader kicker="Measure" title="Evidence"
        subtitle="Did it learn, is training better than just prompting, could this study tell — and what did it cost?"
        right={<div className="flex flex-wrap items-center gap-2"><StudySelect />{d && d.splits.length > 1 && <Segmented label="Split" value={split ?? ""} onChange={setSp} options={d.splits.map((x) => ({ value: x, label: x === "test" ? "final test" : "practice (dev)" }))} />}</div>} />
      <ErrorLine error={e.error} />
      {!sid ? <Panel><Empty icon="evaluation">Choose a study in the top bar.</Empty></Panel> : !d ? <div className="space-y-3" aria-busy="true"><Skeleton h={160} /><Skeleton h={320} /></div> : !split ? (
        <Panel><Empty icon="evaluation">No evaluated results yet — run the study through Evaluate and Analyze (Pipeline shows the next step).</Empty></Panel>) : (
        <>
          <Panel title="The answer" prov={<Prov kind="measured" source={`${split === "test" ? "sealed final test" : "practice tasks — the final test is the real answer"} · ${d.study.seeds.length} seed(s)`} />}
            right={<Explain title="Evidence" what={<>Four questions a reviewer asks, answered from this study's own measurements: the untrained student, the trained student, a <b>negative control</b> (same examples, answers shuffled), the untrained student <b>prompted</b> with worked examples, and the teacher — all on the same {split === "test" ? "sealed final-test" : "practice"} tasks.</>}
              read={<ul className="list-disc space-y-1 pl-4"><li><b>Did it learn?</b> Yes only when the whole 95 % range of the gain is above zero — and, with a control, the control did not gain.</li><li><b>Better than prompting?</b> If showing a few examples works as well, training is not justified.</li><li><b>Could this study tell?</b> The smallest gain this design detects reliably, frozen before training.</li><li><b>What did it cost?</b> Whether everyday English got harder for the model after training.</li></ul>}
              math={<><p>Gain <Sym k="delta" />: crossed <Sym k="boot" /> over seeds × task groups; <Sym k="signflip" /> over groups and seeds.</p><p>Part rates: <Sym k="wilson" /> ranges.</p></>} />}>
            <div className="mb-3 flex items-start gap-2">
              <Icon name={v!.icon} className={cx("mt-0.5", v!.tone === "good" ? "text-good-ink" : v!.tone === "crit" ? "text-crit-ink" : "text-ink-3")} />
              <p className="text-[13px] text-ink-2">{d.verdict.text}</p>
            </div>
            <Scorecard items={tiles(d, split)} />
            {split === "dev" && d.splits.includes("test") && <p className="mt-2 text-[12px] text-ink-3">Showing practice tasks. The sealed final test is the result to report.</p>}
          </Panel>

          <section id="ev-learned" className="scroll-mt-4 space-y-4" aria-label="Did it learn — the evidence">
            <h2 className="pt-2 text-[15px] font-semibold text-ink">Did it learn? <span className="font-normal text-ink-3">— the evidence</span></h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {real && <GainCard expert={expert} title="Trained vs untrained" c={con[real]} tone={color(real)} sub={`trained ${fmtPct(con[real]?.arm_rate)} vs untrained ${fmtPct(con[real]?.control_rate)}`} />}
              {d.study.arms.includes(CTRL) && <GainCard expert={expert} title="Negative control (answers shuffled)" c={con[CTRL]} tone={color(CTRL)} sub="should stay at or near zero" />}
              <div className="rounded-[var(--radius)] border border-line p-3 text-[12px] text-ink-2">
                <div className="text-[12.5px] font-medium text-ink">This study</div>
                <div className="mt-1 font-mono text-[11.5px] leading-relaxed">student {d.study.student}<br />seeds {d.study.seeds.join(", ")} · {d.study.sealed ? "sealed" : "not sealed"}<br />
                  {Object.entries(d.study.train).filter(([, x]) => x != null).map(([k, x]) => `${k} ${String(x)}`).join(" · ")}</div>
                <Button size="sm" icon="compare" onClick={toCompare}>Open in Compare</Button>
              </div>
            </div>
            <details className="group rounded-[var(--radius)] border border-line bg-surface" open={expert}>
              <summary className="cursor-pointer select-none px-4 py-2.5 text-[13px] font-medium text-ink">What changed, how it learned, whether it repeats, skill by skill <span className="font-normal text-ink-3">({d.fixed_total} task(s) fixed)</span></summary>
              <div className="space-y-4 p-4 pt-1">
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
                      <><p className="mb-2 text-[12px] text-ink-2">{d.fixed_total} task(s) the untrained student gets wrong and the trained student gets right in most seeds.</p>
                        <ul className="space-y-1">{d.fixed.map((x) => <li key={x.task_id} className="flex items-center justify-between gap-2 text-[12px]"><span className="font-mono text-ink-2">{x.family} · {x.task_id}</span><Badge tone="good">{x.seeds_right}/{x.seeds} seeds</Badge></li>)}</ul>
                        <div className="mt-2"><Button size="sm" icon="compare" onClick={toCompare}>Read both transcripts in Compare</Button></div></>)}
                  </Panel>
                </div>
              </div>
            </details>
          </section>

          <div className="grid gap-4 xl:grid-cols-2 [&>*]:min-w-0">
            <section id="ev-prompting" className="scroll-mt-4" aria-label="Better than just prompting">
              <Panel title="Better than just prompting?" prov={<Prov kind="measured" source={d.fewshot ? `${d.fewshot.k} training examples in the prompt` : "not measured"} />}>
                {!d.fewshot ? <Empty icon="dot">This study has no prompting baseline (created before v0.30). New studies include one: the untrained student shown 3 worked examples.</Empty> : (<>
                  <p className="mb-2 text-[12.5px] text-ink-2">The cheapest alternative to training: the untrained student shown {d.fewshot.k} worked training conversations ({(d.fewshot.families ?? []).join(", ")}) in its prompt. Training is worth it only if it beats this.</p>
                  {real && vp[real] && <div className="mb-3"><GainCard expert={expert} title={`Trained vs prompted (${d.fewshot.k} examples)`} c={vp[real]} tone={color(FS)} sub={`trained ${fmtPct(vp[real]?.arm_rate)} vs prompted ${fmtPct(vp[real]?.control_rate)}`} /></div>}
                  {expert && Object.keys(vp).length > 0 && <PromptingTable rows={[
                    ...(vp[FS] ? [{ label: "prompting − untrained", gain: vp[FS].gain, ci: vp[FS].ci, p: vp[FS].p_groups }] : []),
                    ...d.study.arms.filter((a) => vp[a]).map((a) => ({ label: `${a === CTRL ? "negative control" : `trained (${a})`} − prompting`, gain: vp[a].gain, ci: vp[a].ci, p: vp[a].p_groups }))]} />}
                  {!Object.keys(vp).length && <Empty icon="dot">Analyse the study to compare training with prompting.</Empty>}
                  {expert && <p className="mt-2 text-[11px] text-ink-3">Examples from the training split only, frozen (sha256 {d.fewshot.sha256?.slice(0, 12) ?? "—"}…).</p>}</>)}
              </Panel>
            </section>
            <section id="ev-forgetting" className="scroll-mt-4" aria-label="What did it cost">
              <ForgettingPanel sid={d.study.id} arms={d.study.arms} name={(a) => (a === CTRL ? "negative control" : `trained · ${a}`)} />
            </section>
          </div>
          <section id="ev-power" className="scroll-mt-4" aria-label="Could this study tell"><PowerPanel p={d.power} /></section>
          <Limits>{d.honesty}</Limits>
        </>)}
    </div>
  );
}
