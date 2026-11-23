import { Icon, type IconName } from "../components/icons";
import { Badge, Button, Empty, ErrorLine, PageHeader, Panel, Segmented, Skeleton, cx } from "../components/ui";
import { Term } from "../lib/glossary";
import { goto, handoff } from "../lib/handoff";
import { useApi } from "../lib/hooks";
import { usePrefs } from "../lib/prefs";

interface Headline { split: string; base: number | null; teacher: number | null; tuned: number | null; arm: string | null; ci: [number | null, number | null] | null; confirmatory: boolean }
interface PStudy { id: string; name: string; profile: string; created_at: string; next_stage: string | null; sealed: boolean; stages: Record<string, string>; running: boolean; headline: Headline | null }
interface Project {
  id: string; kind: "agent" | "docs" | "catalog"; ref: string | null; name: string; template?: string; created_at: string; updated_at: string;
  skills?: number; tables?: number; tasks?: string | null; steps?: Record<string, string>;
  studies: PStudy[]; variants: { id: string; name: string; built: boolean }[]; running: boolean; headline: Headline | null; next: { label: string; route: string };
}
interface ProjectsT { projects: Project[]; counts: { agents: number; docs: number; studies: number; variants: number } }

const STAGES = ["collect", "build", "train", "evaluate_dev", "analyze_dev", "seal", "evaluate_test", "analyze_test", "export"];
const KIND: Record<Project["kind"], { label: string; icon: IconName }> = {
  agent: { label: "Agent", icon: "agent" }, docs: { label: "Documents", icon: "layers" }, catalog: { label: "Built-in", icon: "flask" } };
const pct = (v: number | null | undefined) => (v == null ? "—" : `${Math.round(v * 100)}%`);

/** Role-based tours: an ordered walk through the pages that matter for that person, and what to look at on each. */
export const TOURS: Record<string, { label: string; who: string; steps: [string, string, string][] }> = {
  ops: { label: "Operations / clinical lead", who: "You know the work and decide whether the agent helps your team.", steps: [
    ["agent-studio", "Agent Studio", "Read the agent's job description, its skills and the read-only tools it may use. Nothing here can change real systems."],
    ["playground", "Playground", "Ask it something from your day. Compare the untrained model, the trained one and the teacher side by side; accept or override each answer."],
    ["evaluation", "Evaluation", "Did training help on tasks it never saw? Look per skill, and at the range (confidence interval), not just the average."],
    ["modelmap", "Model Map", "See how the agent's decisions are organised and where it stays consistent or wavers."]] },
  analyst: { label: "Analyst / data owner", who: "You own the tables and examples the agent learns from.", steps: [
    ["agent-studio", "Agent Studio → Tasks", "Review the practice tasks: approve, fix or reject. Every task is checked against the tables before it is used."],
    ["studio", "Experiment Studio", "Run the study stage by stage. Each stage records exactly what it did."],
    ["evaluation", "Evaluation", "Read the per-skill gains and the regressions — what got worse matters as much as what got better."],
    ["lens", "Distillation Lens", "Watch the student's word choices move toward the teacher's over training."]] },
  engineer: { label: "Engineer / data scientist", who: "You tune, compare and package models.", steps: [
    ["observatory", "Model Observatory", "Check which models are present, trainable, and fit the graphics card."],
    ["training", "Training Lab", "Memory plan, integrity gates, learning curve, energy used."],
    ["weightlab", "Weight Lab", "Mix, scale and trim adapters with exact maths; measure each variant."],
    ["modelmap", "Model Map", "Inspect hidden-state geometry and word attributions before and after."],
    ["factory", "Model Factory", "Merge and export — with a post-merge check that it still behaves the same."]] },
  leader: { label: "Leader / governance", who: "You need to know what was tested, by whom, and what FORGE does not claim.", steps: [
    ["evaluation", "Evaluation", "The sealed final test is the only confirmatory result. ‘Candidate for human review’ is the best outcome FORGE gives."],
    ["playground", "Playground decisions", "Every accept/override a reviewer made is logged with their name."],
    ["guide", "Guide → Myths vs facts", "What these numbers do and do not mean."]] },
};

export default function Home() {
  const { prefs, set } = usePrefs();
  const p = useApi<ProjectsT>("/api/projects", 6000);
  const open = (pr: Project) => {
    if (pr.studies[0]) set("activeStudy", pr.studies[0].id);
    if (pr.kind === "agent" && pr.ref) handoff("agent", pr.ref);
    if (pr.kind === "docs" && pr.ref) handoff("pack", pr.ref);
  };
  const tour = prefs.role ? TOURS[prefs.role] : null;
  return (
    <div className="space-y-4">
      <PageHeader kicker="Agent generation lab · health system" title="Home"
        subtitle={<>Build small, local agents for routine work, see exactly what changes when they learn, and keep people in charge of every decision. <Term k="human">Humans review</Term>; FORGE measures.</>}
        right={<Segmented label="Interface mode" value={prefs.mode} onChange={(v) => set("mode", v)} options={[{ value: "simple", label: "Simple" }, { value: "expert", label: "Expert" }]} />} />

      <div className="grid gap-3 md:grid-cols-3">
        {([["agent", "Build an agent", "Pick a health-system template (service desk, patient access, pharmacy benefits…), shape its skills and tools.", () => { handoff("new-agent", "1"); goto("agent-studio"); }],
          ["layers", "Teach from documents", "Point at a folder of policies or guides; the agent learns to answer from them — and to say when it can't.", () => { handoff("new-pack", "1"); goto("knowledge-studio"); }],
          ["play", "Try and compare", "Ask a question and watch the untrained model, the trained one and the teacher answer side by side.", () => goto("playground")]] as [IconName, string, string, () => void][])
          .map(([icon, t, d, fn]) => (
            <button key={t} type="button" onClick={fn} className="group flex items-start gap-3 rounded-[var(--radius)] border border-line bg-surface p-4 text-left transition hover:border-accent-line hover:bg-accent-soft/40">
              <span className="mt-0.5 rounded-[var(--radius)] bg-accent-soft p-2 text-accent"><Icon name={icon} size={18} /></span>
              <span><span className="block text-[13.5px] font-medium text-ink">{t}</span><span className="mt-1 block text-[12px] leading-snug text-ink-2">{d}</span></span>
            </button>))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel title="Projects" eyebrow={p.data ? `${p.data.counts.agents} agents · ${p.data.counts.docs} doc sets · ${p.data.counts.studies} studies` : undefined}>
          {!p.data && !p.error ? <div className="grid gap-3 md:grid-cols-2"><Skeleton h={150} /><Skeleton h={150} /></div>
            : p.data && !p.data.projects.length ? <Empty icon="agent">No projects yet. Start with “Build an agent” — the templates come with synthetic data, so nothing sensitive is needed.</Empty>
            : <div className="grid gap-3 md:grid-cols-2 3xl:grid-cols-3">{p.data?.projects.map((pr) => <ProjectCard key={pr.id} pr={pr} onOpen={open} />)}</div>}
          <ErrorLine error={p.error} onRetry={p.reload} />
        </Panel>

        <div className="space-y-4">
          <Panel title="Guided tour" eyebrow="pick your role">
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(TOURS).map(([k, t]) => (
                <button key={k} type="button" onClick={() => set("role", prefs.role === k ? null : k)} aria-pressed={prefs.role === k}
                  className={cx("rounded-full border px-2.5 py-1 text-[11.5px] transition", prefs.role === k ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-2 hover:border-line-strong")}>{t.label}</button>))}
            </div>
            {tour ? (
              <ol className="mt-3 space-y-2">
                <li className="text-[12px] text-ink-3">{tour.who}</li>
                {tour.steps.map(([route, title, what], i) => (
                  <li key={route + i}>
                    <button type="button" onClick={() => goto(route)} className="group flex w-full gap-2.5 rounded-[var(--radius)] p-1.5 text-left hover:bg-surface-2">
                      <span className="num mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line-strong font-mono text-[10.5px] text-ink-2 group-hover:border-accent group-hover:text-accent">{i + 1}</span>
                      <span><span className="block text-[12.5px] font-medium text-ink">{title}</span><span className="block text-[12px] leading-snug text-ink-2">{what}</span></span>
                    </button>
                  </li>))}
                <li><Button size="sm" onClick={() => goto("learn")}>Full learning path with checks →</Button></li>
              </ol>
            ) : <p className="mt-3 text-[12px] text-ink-2">Choose a role for a short, ordered walk through the pages that matter to you. Underlined words like <Term k="adapter">adapter</Term> or <Term k="seal">seal</Term> explain themselves on hover.</p>}
          </Panel>
          <Panel title="How control works here">
            <ul className="space-y-2 text-[12.5px] leading-snug text-ink-2">
              <li><b className="text-ink">Synthetic by default.</b> Templates use made-up data; anything resembling personal information is refused.</li>
              <li><b className="text-ink">Nothing is overwritten.</b> Training makes a separate <Term k="adapter">adapter</Term>; the original model stays untouched.</li>
              <li><b className="text-ink">Measured, not asserted.</b> Improvement is claimed only from <Term k="heldout">held-out</Term> tasks, with a <Term k="ci">confidence range</Term>.</li>
              <li><b className="text-ink">People decide.</b> The best outcome FORGE gives is “candidate for human review”.</li>
              <li><b className="text-ink">Gentle on hardware.</b> Jobs pause if the GPU runs hot (<Term k="thermal">thermal pause</Term>) and leave CPU cores free.</li>
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function ProjectCard({ pr, onOpen }: { pr: Project; onOpen: (p: Project) => void }) {
  const s = pr.studies[0];
  const h = pr.headline;
  const k = KIND[pr.kind];
  return (
    <div className={cx("flex flex-col rounded-[var(--radius)] border bg-surface p-3.5", pr.running ? "border-accent-line" : "border-line")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="micro flex items-center gap-1.5 text-ink-3"><Icon name={k.icon} size={12} />{k.label}{pr.template && pr.template !== "blank" ? ` · ${pr.template.replace(/_/g, " ")}` : ""}</div>
          <div className="mt-1 truncate text-[14px] font-medium text-ink" title={pr.name}>{pr.name}</div>
        </div>
        {pr.running ? <Badge tone="accent"><span className="live-dot mr-1 inline-block h-1.5 w-1.5 rounded-full bg-accent" />running</Badge>
          : s?.sealed ? <Badge tone="good">sealed</Badge> : null}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[11px] text-ink-3">
        {pr.skills != null && <span>{pr.skills} skills</span>}{pr.tables != null && <span>{pr.tables} tables</span>}
        <span>{pr.studies.length} {pr.studies.length === 1 ? "study" : "studies"}</span>{pr.variants.length > 0 && <span>{pr.variants.length} {pr.variants.length === 1 ? "variant" : "variants"}</span>}
      </div>
      {s && (
        <div className="mt-3" aria-label={`Latest study ${s.name}: stages`}>
          <div className="flex gap-0.5">{STAGES.map((st) => {
            const v = s.stages[st];
            return <span key={st} title={`${st}: ${v ?? "not started"}`} className={cx("h-1.5 flex-1 rounded-full", v === "completed" ? "bg-accent" : v === "running" ? "live-dot bg-accent" : v === "failed" || v === "interrupted" ? "bg-crit" : "bg-surface-3")} />;
          })}</div>
          <div className="mt-1 truncate text-[11px] text-ink-3">{s.name}</div>
        </div>
      )}
      {h && (
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-2.5 text-center">
          {([["untrained", h.base, "text-ink-2"], ["trained", h.tuned, "text-accent"], ["teacher", h.teacher, "text-ink-2"]] as [string, number | null, string][]).map(([l, v, c]) => (
            <div key={l}><div className={cx("num font-mono text-[15px] font-medium", c)}>{pct(v)}</div><div className="micro !text-[9px] text-ink-3">{l}</div></div>))}
          <div className="col-span-3 text-[10.5px] text-ink-3">{h.confirmatory ? "sealed final test" : "practice (dev) tasks — not the final result"} · <Term k="strict">strict success</Term></div>
        </div>
      )}
      <div className="mt-auto pt-3">
        <div className="mb-2 text-[12px] text-ink-2"><span className="text-ink-3">Next: </span>{pr.next.label}</div>
        <Button size="sm" tone="primary" icon="chevron" onClick={() => { onOpen(pr); goto(pr.next.route); }}>Open</Button>
      </div>
    </div>
  );
}
