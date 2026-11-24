import { Adequacy } from "../components/Adequacy";
import { AskAI } from "../lib/assistant";
import { useMemo, useState, type FormEvent } from "react";
import { ForestPlot, SkillMap, type ForestRow, type SkillFamily } from "../components/charts";
import { PathCompare } from "../components/graphs";
import { StudySelect } from "../components/live";
import { Badge, Button, Checklist, Empty, ErrorLine, Field, Notice, PageHeader, Panel, Prov, Readout, Segmented, Status, cx, inputCls, td, th, tr } from "../components/ui";
import { api, fmt, qs } from "../lib/api";
import { useAction, useApi } from "../lib/hooks";
import { usePrefs } from "../lib/prefs";
import type { AnalysisReport, CompareT, Contrast, StudySummary } from "../lib/types";

interface Changes { arm: string; seed: number; split: string; counts: Record<string, number>; rows: { task_id: string; family: string; group_id: string; outcome: string; base: boolean | null; tuned: boolean; teacher: boolean | null }[] }

export default function Evaluation() {
  const { prefs } = usePrefs();
  const sid = prefs.activeStudy;
  const s = useApi<StudySummary>(sid ? `/api/studies/${sid}` : null, 10000);
  const reports = s.data?.reports ?? {};
  const splitsAvail = useMemo(() => Object.values(reports).flatMap((r) => Object.keys(r.splits)), [reports]);
  const [split, setSplit] = useState<string | null>(null);
  const sp = split && splitsAvail.includes(split) ? split : splitsAvail.includes("test") ? "test" : splitsAvail[0];
  const rep: AnalysisReport | undefined = sp ? (sp === "dev" ? reports.dev : reports.test) : undefined;
  const sec = sp && rep ? rep.splits[sp] : undefined;
  const primary = s.data?.plan.arms[0];
  const c: Contrast | undefined = primary && sec ? sec.arms[primary] : undefined;
  return (
    <div className="space-y-4 fit:flex fit:h-full fit:min-h-0 fit:flex-col fit:gap-3 fit:space-y-0">
      <PageHeader kicker="Research" title="Evaluation Lab" subtitle="Did the student improve, by how much, with what uncertainty, and where? Effects are paired per scenario group (paraphrases averaged), with a crossed seed × group bootstrap and exact sign-flip tests."
        right={<><AskAI q="Explain this study's results in plain language: what improved, by how much, how certain, and what did not. Then say whether the gain is trustworthy." label="Explain with AI" /><StudySelect />{splitsAvail.length > 0 && <Segmented label="Split" value={sp ?? ""} onChange={setSplit} options={splitsAvail.map((x) => ({ value: x, label: x }))} />}</>} />
      <ErrorLine error={s.error} />
      {!sid || !sec ? <><Panel><Empty icon="evaluation">No analysis yet. Run evaluate_dev → analyze_dev (and, after SEAL, the test stages) in Experiment Studio.</Empty></Panel><Calculators /></> : (
        <>
          {sp === "dev" && <Notice tone="warn">Development split: used for decisions before SEAL. Confirmatory evidence comes only from the sealed test split.</Notice>}
          {c && primary && <Headline c={c} sec={sec} arm={primary} profile={s.data!.plan.profile} />}
          <Adequacy sid={sid} />
          {/* Wide screens: three instrument columns that fill the viewport; narrow screens: the same panels stacked. */}
          <div className="space-y-4 fit:grid fit:min-h-0 fit:flex-1 fit:grid-cols-12 fit:gap-3 fit:space-y-0">
            <div className="space-y-4 fit:col-span-5 fit:flex fit:min-h-0 fit:flex-col fit:gap-3 fit:space-y-0">
              <Panel fill className="fit:flex-1" title="Paired effects" eyebrow={sp} prov={<Prov kind="computed" source={c?.method ?? ""} />}>
                <ForestPlot minGain={s.data?.plan.min_gain} rows={forestRows(rep!, sp!, s.data!.plan.arms)} />
                <div className="mt-2 text-[11px] text-ink-3">Diamond = mean paired Δ; whiskers = 95% percentile CI from a crossed bootstrap over seeds and groups (not BCa). Blue: CI above zero · red: below · gray: crosses zero.</div>
              </Panel>
              <ChangesTable sid={sid} split={sp!} arm={primary!} seeds={s.data!.plan.seeds} />
            </div>
            <div className="space-y-4 fit:col-span-4 fit:flex fit:min-h-0 fit:flex-col fit:gap-3 fit:space-y-0">
              {c && <Panel fill className="fit:flex-1" title="Skill map" eyebrow="per task family" prov={<Prov kind="computed" source="Wilson 95% CI" />}><SkillMap families={Object.entries(c.families).map(([family, v]) => ({ family, teacher: v.teacher, base: v.base, tuned: v[primary!] } as SkillFamily))} /></Panel>}
              <Panel fill className="fit:flex-1" title="Review gate" prov={<Prov kind="computed" />} right={rep?.gate && <Badge tone={rep.gate.verdict === "candidate_for_human_review" ? "good" : "default"}>{rep.gate.verdict.replace(/_/g, " ")}</Badge>}>
                {rep?.gate ? <><Checklist items={rep.gate.checks} /><div className="mt-2 text-[11.5px] text-ink-3">{rep.gate.disclaimer}</div></> : <div className="text-[12px] text-ink-3">The gate is evaluated only on the sealed test analysis.</div>}
                {rep?.holm_secondary && Object.keys(rep.holm_secondary).length > 0 && (
                  <div className="mt-3"><div className="micro mb-1 text-ink-3">Secondary contrasts · Holm-adjusted p</div>
                    {Object.entries(rep.holm_secondary).map(([k, p]) => <div key={k} className="flex justify-between font-mono text-[11.5px]"><span className="text-ink-2">{k}</span><span className="num text-ink">{fmt.p(p)}</span></div>)}</div>
                )}
              </Panel>
            </div>
            <div className="scroll-thin space-y-4 fit:col-span-3 fit:min-h-0 fit:space-y-3 fit:overflow-auto fit:pr-1">
              {c && <Panel flush title="McNemar · diagnostic" prov={<Prov kind="computed" source="exact binomial" />}>
                <table className="w-full text-[12px]"><thead><tr className="bg-surface-2"><th className={th}>Seed</th><th className={cx(th, "text-right")}>b</th><th className={cx(th, "text-right")}>c</th><th className={cx(th, "text-right")}>exact p</th></tr></thead>
                  <tbody>{Object.entries(c.mcnemar_diagnostic).map(([seed, m]) => <tr key={seed} className={tr}><td className={cx(td, "font-mono")}>{seed}</td><td className={cx(td, "num text-right font-mono")}>{m.b}</td><td className={cx(td, "num text-right font-mono")}>{m.c}</td><td className={cx(td, "num text-right font-mono")}>{fmt.p(m.p)}</td></tr>)}</tbody></table>
                <div className="px-[var(--pad)] py-2 text-[11px] text-ink-3">b = tuned-only successes, c = base-only, on one fixed paraphrase (p0) per group, per seed. Diagnostic only; inference uses the group-level sign-flip tests.</div>
              </Panel>}
              <Calculators stacked />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function forestRows(rep: AnalysisReport, split: string, arms: string[]): ForestRow[] {
  const out: ForestRow[] = [];
  for (const sp of Object.keys(rep.splits)) {
    for (const a of arms) {
      const c = rep.splits[sp].arms[a];
      if (!c) continue;
      if (sp !== split && a !== arms[0]) continue;
      out.push({ key: `${sp}:${a}`, label: `${a}${sp !== split ? ` · ${sp}` : ""}`, sub: `${c.seeds} seed · ${c.groups} groups · p_g ${fmt.p(c.sign_flip_groups.p)}`, mean: c.mean, lo: c.ci_low, hi: c.ci_high });
    }
  }
  return out.sort((a, b) => (a.key.startsWith(split) ? -1 : 1) - (b.key.startsWith(split) ? -1 : 1));
}

function Headline({ c, sec, arm, profile }: { c: Contrast; sec: AnalysisReport["splits"][string]; arm: string; profile: string }) {
  return (
    <Panel title={`${arm} vs base`} eyebrow="primary contrast" prov={<Prov kind="computed" />}>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4 2xl:grid-cols-7">
        <Readout label="Δ strict success" value={fmt.pp(c.mean)} size="lg" tone={c.ci_low > 0 ? "accent" : c.ci_high < 0 ? "crit" : "default"} sub={`95% CI ${fmt.pp(c.ci_low)} … ${fmt.pp(c.ci_high)}`} />
        <Readout label={<><span className="mr-1 inline-block h-2 w-2 rounded-full bg-base align-middle" />base</>} value={fmt.pct(c.control_rate)} />
        <Readout label={<><span className="mr-1 inline-block h-2 w-2 rounded-full bg-tuned align-middle" />tuned</>} value={fmt.pct(c.arm_rate)} />
        <Readout label={<><span className="mr-1 inline-block h-2 w-2 rounded-full bg-teacher align-middle" />teacher</>} value={fmt.pct(sec.teacher_rate)} />
        <Readout label="sign-flip · groups" value={fmt.p(c.sign_flip_groups.p)} sub={`${c.sign_flip_groups.method} · n=${c.sign_flip_groups.n_units}`} size="sm" />
        <Readout label="sign-flip · seeds" value={fmt.p(c.sign_flip_seeds.p)} sub={`min attainable ${fmt.p(c.sign_flip_seeds.min_attainable_p)}`} size="sm" />
        <Readout label="teacher gap closed" value={c.teacher_gap_closed == null ? "—" : fmt.pct(c.teacher_gap_closed, 0)} sub="descriptive · only if teacher > base" size="sm" />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] text-ink-3">
        <span>invalid-call rate {fmt.pct(c.invalid_rate_control)} → {fmt.pct(c.invalid_rate_arm)}</span>
        <span>{c.seeds} seed(s) × {c.groups} groups</span>
        {profile !== "research" && <span className="text-warn-ink">{profile} profile — exploratory, not confirmatory</span>}
      </div>
    </Panel>
  );
}

function ChangesTable({ sid, split, arm, seeds }: { sid: string; split: string; arm: string; seeds: number[] }) {
  const [seed, setSeed] = useState(seeds[0]);
  const [f, setF] = useState<"all" | "fixed" | "regressed" | "unchanged">("fixed");
  const ch = useApi<Changes>(`/api/studies/${sid}/changes${qs({ split, arm, seed })}`);
  const [task, setTask] = useState<string | null>(null);
  const cmp = useApi<CompareT>(task ? `/api/studies/${sid}/compare${qs({ split, task_id: task, arm, seed })}` : null);
  const rows = (ch.data?.rows ?? []).filter((r) => f === "all" || r.outcome === f);
  return (
    <Panel fill flush className="fit:flex-1" title="Gains & regressions" eyebrow="per task" prov={<Prov kind="computed" />}
      right={<div className="flex items-center gap-2">{seeds.length > 1 && <select className={cx(inputCls, "h-7 w-auto")} value={seed} onChange={(e) => setSeed(Number(e.target.value))} aria-label="Seed">{seeds.map((s) => <option key={s} value={s}>seed {s}</option>)}</select>}
        <Segmented label="Outcome" value={f} onChange={setF} options={(["fixed", "regressed", "unchanged", "all"] as const).map((k) => ({ value: k, label: <>{k} <span className="num font-mono text-[10px] text-ink-3">{k === "all" ? ch.data?.rows.length ?? 0 : ch.data?.counts[k] ?? 0}</span></> }))} /></div>}>
      <ErrorLine error={ch.error} />
      {rows.length === 0 ? <Empty>No {f} tasks.</Empty> : (
        <div className="scroll-thin max-h-[300px] overflow-y-auto fit:max-h-none fit:overflow-visible">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-surface-2"><tr><th className={th}>Task</th><th className={th}>Family</th><th className={th}>Teacher</th><th className={th}>Base</th><th className={th}>Tuned</th><th className={th}>Outcome</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.task_id} onClick={() => setTask(r.task_id)} className={cx(tr, "cursor-pointer", task === r.task_id && "!bg-accent-soft")}>
                <td className={cx(td, "font-mono text-[11px]")}>{r.task_id}</td><td className={cx(td, "text-[11px] text-ink-3")}>{r.family}</td>
                <td className={td}>{r.teacher == null ? "—" : <Status s={r.teacher ? "pass" : "fail"} compact />}</td>
                <td className={td}>{r.base == null ? "—" : <Status s={r.base ? "pass" : "fail"} compact />}</td>
                <td className={td}><Status s={r.tuned ? "pass" : "fail"} compact /></td>
                <td className={td}><Badge tone={r.outcome === "fixed" ? "good" : r.outcome === "regressed" ? "crit" : "default"}>{r.outcome}</Badge></td>
              </tr>))}
            </tbody>
          </table>
        </div>
      )}
      {cmp.data && <div className="border-t border-line p-3"><PathCompare c={cmp.data} /></div>}
    </Panel>
  );
}

function Calculators({ stacked = false }: { stacked?: boolean }) {
  const [pw, setPw] = useState({ delta: 0.1, discordant: 0.3, alpha: 0.05, power: 0.8 });
  const [mc, setMc] = useState({ b: 18, c: 6 });
  const [pwr, setPwr] = useState<{ n_pairs: number; assumptions: string } | null>(null);
  const [mcr, setMcr] = useState<{ p: number; n_discordant: number } | null>(null);
  const a1 = useAction(), a2 = useAction();
  const runPw = (e: FormEvent) => { e.preventDefault(); void a1.run(async () => setPwr(await api.post("/api/stats/power", pw))); };
  const runMc = (e: FormEvent) => { e.preventDefault(); void a2.run(async () => setMcr(await api.post("/api/stats/mcnemar", mc))); };
  return (
    <div className={cx("grid gap-4", stacked ? "lg:grid-cols-2 fit:grid-cols-1 fit:gap-3" : "lg:grid-cols-2")}>
      <Panel title="Power planner" prov={<Prov kind="computed" source="paired-binary approximation" />}>
        <form onSubmit={runPw} className="space-y-3">
          <div className="grid grid-cols-4 gap-2">
            {(["delta", "discordant", "alpha", "power"] as const).map((k) => <Field key={k} math label={k === "delta" ? "δ gain" : k === "discordant" ? "q discordant" : k}><input className={inputCls} type="number" step="0.01" value={pw[k]} onChange={(e) => setPw({ ...pw, [k]: Number(e.target.value) })} /></Field>)}
          </div>
          <div className="flex items-center gap-4"><Button type="submit" tone="primary">Compute n</Button>{pwr && <Readout label="groups needed" value={fmt.exact(pwr.n_pairs)} size="sm" />}</div>
          <div className="font-mono text-[11px] text-ink-3">n = ⌈(z₁₋α/₂ + z_power)² · (q − δ²) / δ²⌉</div>
          {pwr && <div className="text-[11px] text-ink-3">{pwr.assumptions}</div>}
          <ErrorLine error={a1.error} />
        </form>
      </Panel>
      <Panel title="McNemar calculator" prov={<Prov kind="computed" source="exact two-sided" />}>
        <form onSubmit={runMc} className="space-y-3">
          <div className="grid grid-cols-2 gap-2"><Field label="b · arm-only successes"><input className={inputCls} type="number" min="0" value={mc.b} onChange={(e) => setMc({ ...mc, b: Number(e.target.value) })} /></Field>
            <Field label="c · control-only successes"><input className={inputCls} type="number" min="0" value={mc.c} onChange={(e) => setMc({ ...mc, c: Number(e.target.value) })} /></Field></div>
          <div className="flex items-center gap-4"><Button type="submit" tone="primary">Compute p</Button>{mcr && <Readout label="exact p" value={fmt.p(mcr.p)} size="sm" sub={`${mcr.n_discordant} discordant pairs`} />}</div>
          <div className="text-[11px] text-ink-3">Reference: b=18, c=6 → p = 0.0227.</div>
          <ErrorLine error={a2.error} />
        </form>
      </Panel>
    </div>
  );
}
