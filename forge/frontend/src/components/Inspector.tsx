import { useEffect, useRef } from "react";
import { goto } from "../lib/handoff";
import { useApi } from "../lib/hooks";
import { usePrefs } from "../lib/prefs";
import type { StudySummary } from "../lib/types";
import { Icon } from "./icons";
import { Score } from "./results";
import { Badge, Button, cx } from "./ui";

const STAGES = ["collect", "build", "train", "evaluate_dev", "analyze_dev", "seal", "evaluate_test", "analyze_test", "export"];
const LABEL: Record<string, string> = { collect: "Collect", build: "Build", train: "Train", evaluate_dev: "Eval dev", analyze_dev: "Analyse dev", seal: "Seal",
  evaluate_test: "Eval test", analyze_test: "Analyse test", export: "Export" };

/** Context inspector: the active study and model at a glance, with next actions — available from every page. */
export function Inspector({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { prefs } = usePrefs();
  const s = useApi<StudySummary>(open && prefs.activeStudy ? `/api/studies/${prefs.activeStudy}` : null, 5000);
  const adq = useApi<{ overall: string; skills: { skill: string; verdict: string }[] }>(open && prefs.activeStudy ? `/api/studies/${prefs.activeStudy}/adequacy` : null);
  const m = useApi<{ name: string; provider: string; roles: string[] }>(open && prefs.activeModel ? `/api/models/${encodeURIComponent(prefs.activeModel)}` : null);
  const close = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    close.current?.focus();
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  const d = s.data;
  const arm = d?.plan.arms[0];
  const split = d?.reports.test ? "test" : d?.reports.dev ? "dev" : null;
  const sec = split && d ? d.reports[split]?.splits[split] : undefined;
  const c = sec && arm ? sec.arms[arm] : undefined;
  const go = (route: string) => { goto(route); onClose(); };
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} aria-hidden />
      <aside role="dialog" aria-modal="true" aria-label="Context inspector" className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-line bg-surface shadow-[var(--shadow)] sm:w-[440px]">
        <div className="flex h-12 items-center justify-between border-b border-line px-4">
          <span className="text-[13px] font-medium text-ink">Inspector</span>
          <button ref={close} type="button" onClick={onClose} aria-label="Close inspector" className="rounded p-1 text-ink-3 hover:bg-surface-3 hover:text-ink"><Icon name="x" /></button>
        </div>
        <div className="scroll-thin flex-1 space-y-5 overflow-y-auto p-4 text-[12.5px]">
          <section aria-label="Active study">
            <div className="micro mb-1.5 text-ink-3">Active study</div>
            {!d ? <p className="text-ink-3">No study selected — choose one in the top bar.</p> : (
              <div className="space-y-3">
                <div><div className="text-[14px] font-medium text-ink">{d.plan.name}</div>
                  <div className="mt-1 flex flex-wrap gap-1.5"><Badge>{d.plan.profile}</Badge><Badge>{d.plan.device}</Badge>{d.state.sealed ? <Badge tone="good">sealed</Badge> : <Badge>not sealed</Badge>}
                    {adq.data && <Badge tone={adq.data.overall === "adequate" ? "good" : adq.data.overall.startsWith("not yet") ? "default" : "warn"}>test: {adq.data.overall}</Badge>}</div></div>
                <ol className="grid grid-cols-3 gap-1" aria-label="Stages">
                  {STAGES.map((st) => { const v = d.state.stages[st]?.status as string | undefined; return (
                    <li key={st} className={cx("rounded border px-1.5 py-1 text-[10.5px]", v === "completed" ? "border-accent-line bg-accent-soft text-ink" : v === "running" ? "border-accent text-ink" : v === "failed" || v === "interrupted" ? "border-crit/50 text-crit-ink" : "border-line text-ink-3")}>
                      <span className="sr-only">{LABEL[st]}: {v ?? "not started"}. </span><span aria-hidden>{v === "completed" ? "✓ " : v === "failed" || v === "interrupted" ? "✕ " : v === "running" ? "● " : ""}{LABEL[st]}</span></li>); })}
                </ol>
                {sec && c ? (
                  <div className="grid grid-cols-3 gap-3 rounded-[var(--radius)] border border-line p-2.5">
                    <Score size="sm" label="Untrained" rate={sec.base_rate} />
                    <Score size="sm" label="Trained" rate={c.arm_rate} ci={sec.base_rate != null ? [Math.max(0, sec.base_rate + c.ci_low), Math.min(1, sec.base_rate + c.ci_high)] : null} />
                    <Score size="sm" label="Teacher" rate={sec.teacher_rate} />
                    <div className="col-span-3 text-[11px] text-ink-3">{split === "test" ? "Sealed final test" : "Practice (dev) tasks — not the final result"}</div>
                  </div>) : <p className="text-ink-3">No analysed results yet.</p>}
                {adq.data && adq.data.skills.some((x) => x.verdict !== "good") && <p className="text-[11.5px] text-ink-2">Skills that can't show a training effect well: {adq.data.skills.filter((x) => x.verdict !== "good").map((x) => x.skill).join(", ")}.</p>}
                <div className="flex flex-wrap gap-2">
                  {d.next_stage && <Button size="sm" tone="primary" onClick={() => go("studio")}>Next: {LABEL[d.next_stage] ?? d.next_stage}</Button>}
                  <Button size="sm" onClick={() => go("evaluation")}>Results</Button><Button size="sm" onClick={() => go("robustness")}>Limits</Button>
                  <Button size="sm" onClick={() => go("governance")}>Model card</Button>
                </div>
              </div>)}
          </section>
          <section aria-label="Active model" className="border-t border-line pt-4">
            <div className="micro mb-1.5 text-ink-3">Active model</div>
            {!m.data ? <p className="text-ink-3">No model selected — pick one in the Model Hub.</p> : (
              <div className="space-y-2"><div className="text-[14px] font-medium text-ink">{m.data.name}</div>
                <div className="flex flex-wrap gap-1.5"><Badge>{m.data.provider}</Badge>{m.data.roles.map((r) => <Badge key={r}>{r}</Badge>)}</div>
                <div className="flex gap-2"><Button size="sm" onClick={() => go("model")}>Open Model Hub</Button><Button size="sm" onClick={() => go("bench")}>Bench it</Button></div></div>)}
          </section>
          <p className="border-t border-line pt-3 text-[11px] text-ink-3">Shortcut: press <kbd className="rounded border border-line px-1 font-mono">.</kbd> to open or close. Measured results only; nothing here is an approval.</p>
        </div>
      </aside>
    </>
  );
}
