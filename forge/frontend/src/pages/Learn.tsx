import { useEffect, useState } from "react";
import { Icon } from "../components/icons";
import { Badge, Button, PageHeader, Panel, cx } from "../components/ui";
import { Term } from "../lib/glossary";
import { goto } from "../lib/handoff";
import { usePrefs } from "../lib/prefs";

interface Lesson { id: string; title: string; min: number; why: string; route: string; doIt: string; notice: string; q: string; options: string[]; answer: number; explain: string }
interface Path { label: string; who: string; outcome: string; lessons: Lesson[] }

/** Learning paths by role: short, hands-on lessons on real FORGE pages, each ending with one question to check understanding. */
export const PATHS: Record<string, Path> = {
  ops: { label: "Operations / clinical lead", who: "You know the work; you decide whether an agent helps your team.", outcome: "Judge an agent's usefulness and limits from evidence, and record your decisions.", lessons: [
    { id: "ops1", title: "What an agent is here", min: 5, route: "agent-studio", why: "A FORGE agent is a small local model with a job description, a few read-only tools over your tables, and named skills.",
      doIt: "Open an agent and read Define → Tools → Skills. Try one tool in the console.", notice: "Tools only look things up or calculate; nothing can change a record.",
      q: "An agent is asked to close a ticket. What should a well-built FORGE agent do?", options: ["Close it with its tools", "Answer HANDOFF so a person does it", "Pretend it closed it"], answer: 1,
      explain: "Tools are read-only by design; changes belong to people and systems of record. The boundary suite measures exactly this." },
    { id: "ops2", title: "Ask it something from your day", min: 10, route: "playground", why: "Seeing untrained, trained and teacher answers side by side is the fastest way to build intuition.",
      doIt: "Type a realistic request (synthetic). Compare the lanes, then accept or override each answer.", notice: "Where the trained model first departs from the teacher; whether its answer is backed by a tool result.",
      q: "A lane's answer is right but marked ‘not backed by a tool result’. How should you treat it?", options: ["As correct", "As a lucky guess — not a success", "As a teacher error"], answer: 1,
      explain: "FORGE counts success only when the answer came from evidence the agent actually looked up." },
    { id: "ops3", title: "Did training help?", min: 10, route: "evaluation", why: "One number can mislead; FORGE shows the paired gain with a range, per skill.",
      doIt: "Read the per-skill gains on practice (dev) tasks, then the sealed final test if available.", notice: "Whether the range (confidence interval) includes zero; any skill that got worse.",
      q: "The gain is +12 points with a range of −3 to +27. What can you say?", options: ["It clearly improved", "It may have improved; the evidence isn't conclusive", "It got worse"], answer: 1,
      explain: "A range that includes zero means the data are compatible with no improvement. More tasks or seeds narrow it." },
    { id: "ops4", title: "Know its limits", min: 10, route: "robustness", why: "A helpful agent hands back what it shouldn't handle — without handing back everything.",
      doIt: "Open Boundaries, then Stress tests.", notice: "Hand-backs held vs over-refusal; whether typos or hidden instructions flip answers.",
      q: "An agent hands back 100 % of boundary cases and 40 % of ordinary tasks. Is it safe to use?", options: ["Yes — it never oversteps", "Not useful — it refuses too much", "Yes, if the teacher agrees"], answer: 1,
      explain: "Over-refusal shifts all the work back to people. Both numbers matter." }] },
  analyst: { label: "Analyst / data owner", who: "You own the tables, examples and practice tasks.", outcome: "Produce a verified, balanced, varied task set and read what the data size tells you.", lessons: [
    { id: "an1", title: "Tables and keys", min: 10, route: "agent-studio", why: "Every answer must trace to a row; the key column is how tasks find rows.",
      doIt: "In Tools, look at a table and its key. Try lookup_ in the console with a real key and a made-up one.", notice: "The made-up key returns found: false — that's how NOT_FOUND tasks work.",
      q: "Why does FORGE include tasks whose correct answer is NOT_FOUND?", options: ["To pad the dataset", "So the agent learns to say it can't find something instead of guessing", "Because the teacher fails"], answer: 1,
      explain: "A confident wrong answer is worse than an honest ‘not found’." },
    { id: "an2", title: "Verified practice tasks", min: 10, route: "agent-studio", why: "FORGE re-runs every tool call and keeps a task only if the answer is exactly what the tools returned.",
      doIt: "Practice tasks → Rejected tab: read the reasons. Then Human review: approve or correct a few.", notice: "Near-duplicates (same calls, same wording) are rejected; your reviews are recorded with your name.",
      q: "A task's answer is correct but isn't a value any tool returned. What happens?", options: ["Accepted", "Rejected — it must come from a tool result", "Sent to the teacher"], answer: 1,
      explain: "Only provable tasks become lessons." },
    { id: "an3", title: "Coverage and balance", min: 5, route: "agent-studio", why: "Gaps and imbalances in practice tasks become gaps in the agent.",
      doIt: "Tasks → Coverage map.", notice: "Skills with few dev/test tasks; tables with untouched rows; one answer dominating a skill.",
      q: "A skill's answer is ‘yes’ in 85 % of tasks. Why is that a problem?", options: ["It isn't", "Always saying ‘yes’ would score 85 % without learning anything", "Yes is a hard word"], answer: 1,
      explain: "Balanced answers make scores meaningful." },
    { id: "an4", title: "How much data do I need?", min: 10, route: "robustness", why: "More examples cost effort; the curve shows whether they pay off.",
      doIt: "Robustness → How much data? → Measure.", notice: "Whether success still climbs from 50 % to 100 % of the tasks, and how wide the bars are.",
      q: "The curve is flat from 25 % to 100 %. What's the best next step?", options: ["Write many more tasks", "Improve skills, tools or examples instead", "Train longer"], answer: 1,
      explain: "More of the same data won't help once the curve is flat." }] },
  engineer: { label: "Engineer / data scientist", who: "You tune, compare and package models.", outcome: "Run a clean study, explain what changed inside the model, and ship a checked GGUF.", lessons: [
    { id: "en1", title: "A frozen study", min: 10, route: "studio", why: "The plan (models, tasks, settings) is hashed at creation, and the final test is sealed until the end.",
      doIt: "Create a smoke study and run Collect → Build → Train.", notice: "Each stage is a separate process with a resumable log; thermal pauses if the GPU runs hot.",
      q: "Why seal the test split?", options: ["To save disk space", "So decisions made while building can't be tuned to the final exam", "LM Studio requires it"], answer: 1,
      explain: "Results on a split you used for decisions are optimistic." },
    { id: "en2", title: "Watch it learn", min: 10, route: "lens", why: "The Distillation Lens measures how expected the teacher's next token becomes, step by step.",
      doIt: "Run the lens on a trained adapter.", notice: "Surprise (nats/token) falling and same-top-guess rising over snapshots; which words moved most.",
      q: "Teacher-forced agreement rose to 90 %. Does that mean 90 % task success?", options: ["Yes", "No — it's next-token agreement on teacher text, not end-to-end success", "Only on test"], answer: 1,
      explain: "Use the Evaluation Lab for task success." },
    { id: "en3", title: "Edit the weights, measure the effect", min: 15, route: "weightlab", why: "Adapters are low-rank matrices; FORGE combines, scales, masks and compresses them exactly.",
      doIt: "Make a variant at strength 0.5 and one with rank 4; evaluate both.", notice: "How success changes with strength and rank; which layers matter.",
      q: "What does strength 0 give you?", options: ["The teacher", "Exactly the untrained student", "A random model"], answer: 1,
      explain: "The adapter's change is scaled to nothing; the original weights were never modified." },
    { id: "en4", title: "Inside the model", min: 15, route: "modelmap", why: "Hidden states at decision points show whether skills separate as training proceeds.",
      doIt: "Compute the representation map; open the word view for one task.", notice: "Skill purity by layer; where the training shift concentrates.",
      q: "Is the word view a picture of the model's reasoning?", options: ["Yes", "No — it's gradient × input attribution for the first action", "Only for the teacher"], answer: 1,
      explain: "FORGE never claims to visualise chain of thought." },
    { id: "en5", title: "Ship a checked GGUF", min: 15, route: "factory", why: "Quantization changes behaviour; FORGE checks the GGUF on the sealed test in LM Studio.",
      doIt: "After Export: make a q8_0 GGUF, load it in LM Studio, run the test-set check.", notice: "Agreement with the merged export; file size vs success.",
      q: "Agreement with the merged export is 78 %. What now?", options: ["Ship it", "Try a less aggressive format (q8_0) and compare", "Ignore it"], answer: 1,
      explain: "The check exists to catch behaviour changes from conversion." }] },
  leader: { label: "Leader / governance", who: "You need to know what was tested, by whom, and what is not claimed.", outcome: "Read results without over-reading them, and know what FORGE never claims.", lessons: [
    { id: "le1", title: "What FORGE measures", min: 5, route: "guide", why: "Observable actions on verified tasks, with paired statistics; nothing about hidden reasoning.",
      doIt: "Read Guide → Myths vs facts.", notice: "The list of claims FORGE never makes.", q: "Which is a claim FORGE never makes?", options: ["Task success on held-out tasks", "Clinical validity or deployment readiness", "Energy used per run"], answer: 1,
      explain: "The best outcome is ‘candidate for human review’." },
    { id: "le2", title: "The confirmatory result", min: 10, route: "evaluation", why: "Only the sealed final test counts as confirmation; practice results guide building.",
      doIt: "Find the test-split result and its review gate.", notice: "Whether a result is labelled practice (dev) or sealed final test.", q: "Which result should a decision rest on?", options: ["Best practice (dev) run", "The sealed final test, with its range", "The teacher's score"], answer: 1,
      explain: "Dev results were used to make choices and are optimistic." },
    { id: "le3", title: "Limits and cost", min: 10, route: "robustness", why: "Usefulness depends on hand-back behaviour, robustness, and running cost.",
      doIt: "Read Boundaries, Stress tests and Efficiency.", notice: "Over-refusal; flips under messy wording; time and energy per task.", q: "The trained student is 6× faster than the teacher here. Did distillation cause that?", options: ["Yes", "No — it's a smaller model; distillation made it better at the task, not faster", "Only on GPU"], answer: 1,
      explain: "Speed comes from size; FORGE doesn't claim causal speed-ups." }] },
};
const KEY = "forge.learn.v1";
const load = (): Record<string, number> => { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; } };

export default function Learn() {
  const { prefs, set } = usePrefs();
  const role = prefs.role && PATHS[prefs.role] ? prefs.role : "ops";
  const path = PATHS[role];
  const [done, setDone] = useState<Record<string, number>>(load);
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(done)); } catch { /* progress stays in memory */ } }, [done]);
  const n = path.lessons.filter((l) => done[l.id] != null).length;
  return (
    <div className="space-y-4">
      <PageHeader kicker="Learn" title="Learning paths" subtitle={<>Short, hands-on lessons on the real pages, each ending with one question. Progress is kept in this browser only. Words like <Term k="adapter">adapter</Term> explain themselves on hover.</>} />
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Role">
        {Object.entries(PATHS).map(([k, p]) => {
          const c = p.lessons.filter((l) => done[l.id] != null).length;
          return <button key={k} type="button" role="tab" aria-selected={role === k} onClick={() => set("role", k)}
            className={cx("rounded-[var(--radius)] border px-3 py-2 text-left text-[12.5px]", role === k ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-2 hover:border-line-strong")}>
            <span className="block font-medium">{p.label}</span><span className="text-[11px] text-ink-3">{c}/{p.lessons.length} done · {p.lessons.reduce((a, l) => a + l.min, 0)} min</span></button>;
        })}
      </div>
      <Panel title={path.label} eyebrow={`${n} of ${path.lessons.length} lessons`} right={n === path.lessons.length ? <Badge tone="good">path complete</Badge> : undefined}>
        <p className="mb-1 text-[12.5px] text-ink-2">{path.who}</p>
        <p className="mb-4 text-[12.5px] text-ink"><b>You'll be able to:</b> {path.outcome}</p>
        <div className="mb-4 h-1.5 rounded-full bg-surface-3"><div className="h-1.5 rounded-full bg-accent transition-all" style={{ width: `${(n / path.lessons.length) * 100}%` }} /></div>
        <ol className="space-y-3">{path.lessons.map((l, i) => <LessonCard key={l.id} n={i + 1} l={l} picked={done[l.id]} onPick={(v) => setDone({ ...done, [l.id]: v })} onReset={() => { const d = { ...done }; delete d[l.id]; setDone(d); }} />)}</ol>
      </Panel>
    </div>
  );
}

function LessonCard({ n, l, picked, onPick, onReset }: { n: number; l: Lesson; picked?: number; onPick: (v: number) => void; onReset: () => void }) {
  const [open, setOpen] = useState(picked == null && n === 1);
  const answered = picked != null;
  return (
    <li className={cx("rounded-[var(--radius)] border", answered ? (picked === l.answer ? "border-good/40" : "border-warn/50") : "border-line")}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-3 p-3 text-left">
        <span className={cx("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[11px]", answered ? "border-accent bg-accent text-white" : "border-line-strong text-ink-2")}>
          {answered ? <Icon name="check" size={13} /> : n}</span>
        <span className="min-w-0 flex-1"><span className="block text-[13px] font-medium text-ink">{l.title}</span><span className="block truncate text-[11.5px] text-ink-3">{l.why}</span></span>
        <span className="shrink-0 font-mono text-[11px] text-ink-3">{l.min} min</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-line p-3 text-[12.5px]">
          <p className="text-ink-2">{l.why}</p>
          <div className="grid gap-3 md:grid-cols-2">
            <div><div className="micro mb-1 text-ink-3">Do it</div><p className="text-ink">{l.doIt}</p>
              <div className="mt-2"><Button size="sm" icon="chevron" onClick={() => goto(l.route)}>Open the page</Button></div></div>
            <div><div className="micro mb-1 text-ink-3">Notice</div><p className="text-ink">{l.notice}</p></div>
          </div>
          <fieldset className="rounded-[var(--radius)] bg-surface-2 p-3">
            <legend className="micro px-1 text-ink-3">Check yourself</legend>
            <p className="mb-2 text-ink">{l.q}</p>
            <div className="space-y-1.5">{l.options.map((o, i) => (
              <label key={o} className={cx("flex cursor-pointer items-start gap-2 rounded px-2 py-1", answered && i === l.answer && "bg-good/10", answered && picked === i && i !== l.answer && "bg-warn/10")}>
                <input type="radio" name={l.id} className="mt-0.5 accent-[var(--accent)]" checked={picked === i} onChange={() => onPick(i)} />{o}</label>))}</div>
            {answered && <p className={cx("mt-2", picked === l.answer ? "text-good-ink" : "text-ink")}>{picked === l.answer ? "Right. " : "Not quite. "}{l.explain}
              <button type="button" className="ml-2 text-[11.5px] text-ink-3 underline" onClick={onReset}>reset</button></p>}
          </fieldset>
        </div>
      )}
    </li>
  );
}
