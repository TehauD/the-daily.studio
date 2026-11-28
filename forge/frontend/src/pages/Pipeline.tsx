import { useEffect, useMemo, useState } from "react";
import { Autopilot, InlineAction } from "../components/Autopilot";
import { Icon, type IconName } from "../components/icons";
import { Limits } from "../components/results";
import { Badge, Button, Empty, ErrorLine, PageHeader, Panel, Skeleton, cx, inputCls } from "../components/ui";
import { goto, handoff } from "../lib/handoff";
import { useApi } from "../lib/hooks";
import { usePrefs } from "../lib/prefs";

interface Phase { key: string; name: string; what: string; status: string; facts: string[]; blockers: string[]; next: { label: string; route: string; handoff?: Record<string, string>; action?: { path: string; body?: unknown } } | null }
interface PipelineT { project: string; study: { id: string; name: string; profile: string; sealed: boolean } | null; studies: { id: string; name: string }[]; phases: Phase[] }
interface ProjectsT { projects: { id: string; name: string; kind: string; studies: { id: string }[] }[] }

export const STATUS: Record<string, { label: string; icon: IconName; cls: string; ring: string }> = {
  done: { label: "done", icon: "check", cls: "text-good-ink", ring: "border-[color:var(--good)] bg-[color:var(--good)]/10" },
  attention: { label: "done — read the warnings", icon: "alert", cls: "text-warn-ink", ring: "border-[color:var(--warn)] bg-[color:var(--warn)]/12" },
  active: { label: "running", icon: "refresh", cls: "text-accent", ring: "border-accent bg-accent-soft" },
  todo: { label: "next up", icon: "chevron", cls: "text-ink", ring: "border-ink-2 bg-surface" },
  blocked: { label: "blocked", icon: "x", cls: "text-crit-ink", ring: "border-[color:var(--crit)] bg-[color:var(--crit)]/10" },
  optional: { label: "optional", icon: "dot", cls: "text-ink-2", ring: "border-line-strong border-dashed bg-surface" },
  locked: { label: "not yet", icon: "lock", cls: "text-ink-3", ring: "border-line bg-surface-2" },
};
const ICON: Record<string, IconName> = { setup: "observatory", define: "agent", data: "dataset", study: "training", inside: "map", measure: "evaluation",
  final: "seal", evidence: "flask", package: "layers", decide: "check" };

/** The whole project on one page: nine phases from set-up to a human decision, each with its evidence and next step. */
export default function Pipeline() {
  const { prefs, set } = usePrefs();
  const projects = useApi<ProjectsT>("/api/projects", 15000);
  const list = projects.data?.projects ?? [];
  const [pid, setPid] = useState<string | null>(null);
  const project = pid ?? list.find((p) => p.studies.some((s) => s.id === prefs.activeStudy))?.id ?? list[0]?.id ?? null;
  const [sid, setSid] = useState<string | null>(null);
  const q = useMemo(() => (project ? `/api/pipeline?project=${encodeURIComponent(project)}${sid ? `&study_id=${sid}` : prefs.activeStudy ? `&study_id=${prefs.activeStudy}` : ""}` : null), [project, sid, prefs.activeStudy]);
  const pl = useApi<PipelineT>(q, 8000);
  const d = pl.data;
  useEffect(() => { if (d?.study && d.study.id !== prefs.activeStudy && sid) set("activeStudy", d.study.id); }, [d, sid, prefs.activeStudy, set]);
  const act = (p: Phase) => {
    if (!p.next) return;
    if (d?.study) set("activeStudy", d.study.id);
    Object.entries(p.next.handoff ?? {}).forEach(([k, v]) => handoff(k, v));
    goto(p.next.route);
  };
  const nextUp = d?.phases.find((p) => ["todo", "blocked", "active"].includes(p.status));
  return (
    <div className="space-y-4">
      <PageHeader kicker="Pipeline" title="Pipeline"
        subtitle="One project from set-up to a human decision — ten phases, what each has produced, what is blocking it, and the next step. Or run everything that's left in one go."
        right={<div className="flex flex-wrap gap-2">
          <select className={cx(inputCls, "!w-auto max-w-[280px] font-sans")} value={project ?? ""} onChange={(e) => { setPid(e.target.value); setSid(null); }} aria-label="Project">
            {list.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          {d && d.studies.length > 1 && <select className={cx(inputCls, "!w-auto max-w-[280px] font-sans")} value={d.study?.id ?? ""} onChange={(e) => setSid(e.target.value)} aria-label="Study">
            {d.studies.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
        </div>} />
      <ErrorLine error={projects.error ?? pl.error} />
      {!list.length && projects.data ? <Panel><Empty icon="agent">No projects yet — start one from Home (build an agent, or teach from documents).</Empty></Panel> : !d ? (!pl.error && <div className="space-y-3" aria-busy="true" aria-label="Loading pipeline"><Skeleton h={96} /><Skeleton h={64} /><div className="grid gap-3 md:grid-cols-3"><Skeleton h={160} /><Skeleton h={160} /><Skeleton h={160} /></div></div>) : (
        <>
          <nav aria-label="Pipeline phases" className="overflow-x-auto rounded-[var(--radius)] border border-line bg-surface p-3">
            <ol className="flex min-w-[860px] items-start">
              {d.phases.map((p, i) => { const st = STATUS[p.status] ?? STATUS.locked; return (
                <li key={p.key} className="flex flex-1 items-start">
                  <a href={`#phase-${p.key}`} onClick={(e) => { e.preventDefault(); document.getElementById(`phase-${p.key}`)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
                    className="group flex w-full flex-col items-center gap-1.5 text-center" aria-label={`Phase ${i + 1}, ${p.name}: ${st.label}`}>
                    <span className={cx("flex h-9 w-9 items-center justify-center rounded-full border-2 transition group-hover:scale-105", st.ring)}>
                      <Icon name={p.status === "done" || p.status === "locked" ? ICON[p.key] : st.icon} size={16} className={st.cls} /></span>
                    <span className="text-[11.5px] font-medium leading-tight text-ink">{i + 1}. {p.name}</span>
                    <span className={cx("text-[10.5px]", st.cls)}>{st.label}</span>
                  </a>
                  {i < d.phases.length - 1 && <span aria-hidden className={cx("mt-[18px] h-0.5 w-6 shrink-0", ["done", "attention"].includes(p.status) ? "bg-[color:var(--good)]" : "bg-line")} />}
                </li>); })}
            </ol>
          </nav>
          {nextUp && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius)] border border-accent-line bg-accent-soft px-4 py-3">
              <div className="text-[13px] text-ink"><b>Next:</b> {nextUp.name} — {nextUp.next?.label ?? nextUp.what}{d.study && <span className="text-ink-2"> · study {d.study.name}</span>}</div>
              {nextUp.next && <Button tone="primary" icon="chevron" onClick={() => act(nextUp)}>{nextUp.next.label}</Button>}
            </div>)}
          {d.study && <Autopilot sid={d.study.id} sealed={d.study.sealed} onChange={() => void pl.reload()} />}
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {d.phases.map((p, i) => { const st = STATUS[p.status] ?? STATUS.locked; return (
              <section key={p.key} id={`phase-${p.key}`} aria-labelledby={`h-${p.key}`} className={cx("scroll-mt-20 rounded-[var(--radius)] border bg-surface p-4", p.status === "locked" ? "border-line opacity-[.92]" : "border-line")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <span className={cx("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 font-mono text-[12px]", st.ring, st.cls)}>{i + 1}</span>
                    <div><h2 id={`h-${p.key}`} className="text-[14px] font-semibold text-ink">{p.name}</h2><p className="text-[11.5px] text-ink-3">{p.what}</p></div>
                  </div>
                  <span className={cx("flex shrink-0 items-center gap-1 text-[11.5px]", st.cls)}><Icon name={st.icon} size={13} />{st.label}</span>
                </div>
                <ul className="mt-3 space-y-1 text-[12px] text-ink-2">{p.facts.map((f) => <li key={f} className="flex gap-2"><span aria-hidden className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink-3" />{f}</li>)}</ul>
                {p.blockers.length > 0 && <ul className="mt-2 space-y-1 rounded border border-[color:var(--warn)]/50 bg-[color:var(--warn)]/8 p-2 text-[11.5px] text-warn-ink">
                  {p.blockers.slice(0, 3).map((b) => <li key={b} className="flex gap-1.5"><Icon name="alert" size={12} className="mt-0.5 shrink-0" />{b}</li>)}</ul>}
                {p.next && p.status !== "locked" && <div className="mt-3">{p.next.action
                  ? <InlineAction label={p.next.label} path={p.next.action.path} body={p.next.action.body} onDone={() => void pl.reload()} />
                  : <Button size="sm" tone={["todo", "blocked"].includes(p.status) ? "primary" : "default"} icon="chevron" onClick={() => act(p)}>{p.next.label}</Button>}</div>}
              </section>); })}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-3" aria-label="Status legend">
            {Object.entries(STATUS).map(([k, v]) => <span key={k} className={cx("flex items-center gap-1", v.cls)}><Icon name={v.icon} size={12} />{v.label}</span>)}
            {d.study && <Badge>{d.study.sealed ? "sealed" : "not sealed"}</Badge>}
          </div>
          <Limits>Statuses are computed from what exists on disk (tasks, runs, analyses, exports, recorded decisions). "Done" means the step has produced its evidence — not that the result is good. A human decision is required at the end; FORGE never approves a model.</Limits>
        </>)}
    </div>
  );
}
