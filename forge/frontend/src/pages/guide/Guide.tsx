import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "../../components/icons";
import { Checklist, PageHeader, Panel, Prov, Skeleton, cx } from "../../components/ui";
import { useApi } from "../../lib/hooks";
import type { Readiness } from "../../lib/types";
import { HONESTY } from "../Trajectories";
import { LoraToy, TokenMask, mcnemarP } from "./demos";

const SECTIONS = [
  { id: "what", label: "What FORGE is" }, { id: "tour", label: "Tour" }, { id: "flow", label: "The 12-step flow" },
  { id: "weights", label: "Inside the weights" }, { id: "signal", label: "The training signal" }, { id: "proof", label: "Proving it worked" },
  { id: "first", label: "First run" }, { id: "myths", label: "Myths vs facts" },
];

function Section({ id, n, title, children }: { id: string; n: number; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <Panel title={title} eyebrow={String(n).padStart(2, "0")}>
        <div className="space-y-3 text-[13px] leading-relaxed text-ink-2 [&_b]:font-medium [&_b]:text-ink">{children}</div>
      </Panel>
    </section>
  );
}

const TOUR: [string, string, string][] = [
  ["knowledge-studio", "Knowledge Studio", "Start here: teach a small model to answer from your own documents, step by step."],
  ["overview", "Overview", "Measured GPU, compute stack, readiness, and live telemetry."],
  ["observatory", "Model Observatory", "Local inventory, Hub search with pre-download inspection, eligibility, pair-check."],
  ["studio", "Experiment Studio", "Create a frozen study and run each stage as a separate process."],
  ["trajectories", "Trajectory Explorer", "Every episode as a path graph; teacher/base/tuned comparison with first divergence."],
  ["datasets", "Dataset Factory", "Per-turn records, exclusions with reasons, provenance, sha256 verification."],
  ["training", "Training Lab", "Memory planning with exact LoRA counts; gates, curves, token exposure per run."],
  ["evaluation", "Evaluation Lab", "Paired effects with CIs, skill map, gains/regressions, the review gate."],
  ["factory", "Model Factory", "Adapter inspector, lineage, merged export with post-merge evaluation."],
];

const FLOW = ["Probe the host (probe-host.ps1) — no installs", "Set up the venv with the pinned stack (setup.ps1 -WithML)", "Verify the GPU (forward/backward, BF16)",
  "Launch FORGE on 127.0.0.1", "Discover models; search the Hub for a student and download it", "Assign the LM Studio teacher and the student; pass the pair-check",
  "Create a smoke study (1 seed) — the plan is frozen and hashed", "Collect: the teacher runs every task through the JSON tool protocol",
  "Build: strict teacher successes → per-turn masked records", "Unload the teacher; Train one LoRA adapter",
  "Evaluate base and tuned on dev; analyze; then SEAL", "Evaluate test / OOD / regression; read the paired gain and every changed path"];

const MYTHS: [string, string][] = [
  ["“The visualization shows how the model reasons.”", "It shows observable actions and measured weight changes. Hidden reasoning is stripped; written reasoning is generated text, not computation."],
  ["“Loss went down, so the student improved.”", "Loss is measured on training-format text. Improvement is claimed only from paired, held-out task success with a confidence interval."],
  ["“If the GGUF loads in LM Studio, I can fine-tune it.”", "Quantized GGUF, Ollama, and endpoint models are never trainable. LoRA needs complete original safetensors."],
  ["“A significant p-value means it's ready to deploy.”", "The review gate's best outcome is ‘candidate for human review’. FORGE never approves deployment."],
  ["“3 seeds with p = 0.25 is a failure.”", "With 3 seeds the smallest attainable exact sign-flip p is 0.25. That is a design limit, not evidence of no effect — use the research profile (6 seeds)."],
  ["“Distillation transfers the teacher's general reasoning.”", "FORGE measures gains on its task families, OOD wording, and a regression split. It makes no claim of broad reasoning transfer."],
  ["“2.03B parameters means the card is wrong.”", "Some checkpoints store lm_head although embeddings are tied, so the header total counts one matrix twice. The Observatory reports stored, unique, and non-embedding counts."],
];

export default function Guide() {
  const rd = useApi<Readiness>("/api/system/readiness");
  const [active, setActive] = useState("what");
  const [b, setB] = useState(18), [c, setC] = useState(6);
  useEffect(() => {
    const obs = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && setActive(e.target.id)), { rootMargin: "-30% 0px -60% 0px" });
    SECTIONS.forEach((s) => { const el = document.getElementById(s.id); if (el) obs.observe(el); });
    return () => obs.disconnect();
  }, []);
  return (
    <div>
      <PageHeader kicker="Operate" title="Guide" subtitle="How FORGE turns a large local teacher into a measured improvement in a small, purpose-built student — and what it will and will not claim." />
      <div className="grid gap-6 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav className="min-w-0 lg:sticky lg:top-16 lg:self-start" aria-label="Guide sections">
          <ol className="flex gap-1 overflow-x-auto lg:flex-col lg:gap-0.5">
            {SECTIONS.map((s, i) => (
              <li key={s.id}><a href={`#${s.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior: "smooth" }); }}
                className={cx("flex items-center gap-2 whitespace-nowrap rounded px-2.5 py-1.5 text-[12.5px] transition", active === s.id ? "bg-accent-soft text-ink" : "text-ink-3 hover:text-ink")}>
                <span className="num font-mono text-[10px] text-ink-3">{String(i + 1).padStart(2, "0")}</span>{s.label}</a></li>
            ))}
          </ol>
        </nav>
        <div className="min-w-0 space-y-4">
          <Section id="what" n={1} title="What FORGE is">
            <p><b>FORGE is a local research instrument for teacher → student distillation on one consumer GPU.</b> A large model you already run in LM Studio (the teacher) solves tool-use tasks. Its verified trajectories become supervised data for a small Hugging Face model (the student), which is fine-tuned with LoRA and then measured against its untrained self on identical held-out tasks.</p>
            <p>The goal is a <b>purpose-built</b> local model: a 1–3B student that reliably does one job — here, a deterministic catalog-tool workflow — that previously needed a 14–27B model. FORGE's job is to tell you, with uncertainty attached, whether that happened, where, and at what cost.</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {[["Measured", "Every number comes from hardware, files, provider APIs, or computation — and says which."], ["Reproducible", "Plans are frozen and content-hashed; artifacts are immutable; stages resume from verified JSONL."], ["Honest", "Illustrations are labeled. Hidden reasoning is never visualized. Passing the gate means review, not deploy."]].map(([t, d]) => (
                <div key={t} className="rounded-[var(--radius)] border border-line bg-surface-2 p-3"><div className="text-[12.5px] font-medium text-ink">{t}</div><div className="mt-1 text-[12px] text-ink-3">{d}</div></div>))}
            </div>
          </Section>
          <Section id="tour" n={2} title="Tour">
            <ul className="grid gap-2 sm:grid-cols-2">{TOUR.map(([k, t, d]) => (
              <li key={k}><a href={`#/${k}`} className="group flex h-full gap-2 rounded-[var(--radius)] border border-line p-3 transition hover:border-accent-line hover:bg-accent-soft">
                <Icon name="chevron" size={14} className="mt-0.5 text-ink-3 group-hover:text-accent" /><span><span className="block text-[12.5px] font-medium text-ink">{t}</span><span className="text-[12px] text-ink-3">{d}</span></span></a></li>))}</ul>
          </Section>
          <Section id="flow" n={3} title="The 12-step flow">
            <ol className="grid gap-x-6 gap-y-2 md:grid-cols-2">{FLOW.map((s, i) => (
              <li key={i} className="flex gap-3"><span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line-strong font-mono text-[11px] text-ink-2">{i + 1}</span><span className="pt-0.5 text-[12.5px]">{s}</span></li>))}</ol>
          </Section>
          <Section id="weights" n={4} title="Inside the weights">
            <p>LoRA freezes the original weight W and learns a low-rank update <span className="font-mono text-ink">ΔW = (α/r)·B·A</span>, with B (out×r) initialised to zero so the adapter starts as an exact no-op — FORGE verifies that with a logit-equality check before the first step.</p>
            <LoraToy />
          </Section>
          <Section id="signal" n={5} title="The training signal">
            <p>Each assistant turn of a verified teacher trajectory becomes one record. The model sees everything before that turn and is trained only to produce that turn.</p>
            <TokenMask />
          </Section>
          <Section id="proof" n={6} title="Proving it worked">
            <p><b>Unit of evidence:</b> the scenario group. Paraphrases of one scenario are averaged, so a model cannot look better by solving the same thing three times. Deltas form a seed × group matrix; the CI comes from resampling seeds and groups jointly.</p>
            <p><b>Power:</b> to detect a gain δ when a fraction q of pairs disagree, you need about n = ⌈(z₀.₉₇₅ + z₀.₈)²·(q − δ²)/δ²⌉ groups — δ = 0.10, q = 0.30 needs 228. Small studies are exploratory by construction.</p>
            <div className="rounded-[var(--radius)] border border-line p-3">
              <div className="mb-2 flex items-center justify-between"><span className="text-[12.5px] font-medium text-ink">McNemar on discordant pairs</span><Prov kind="computed" source="exact binomial, in-browser" /></div>
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-[12px]">b (only tuned correct)<input type="number" min={0} value={b} onChange={(e) => setB(Math.max(0, Number(e.target.value)))} className="ml-2 h-7 w-20 rounded border border-line-strong bg-surface px-2 font-mono text-[12px]" /></label>
                <label className="text-[12px]">c (only base correct)<input type="number" min={0} value={c} onChange={(e) => setC(Math.max(0, Number(e.target.value)))} className="ml-2 h-7 w-20 rounded border border-line-strong bg-surface px-2 font-mono text-[12px]" /></label>
                <span className="num font-mono text-[14px] text-ink">p = {mcnemarP(b, c).toFixed(4)}</span>
              </div>
              <p className="mt-2 text-[12px] text-ink-3">Only disagreements carry information: tasks both models solve (or both fail) don't move the test. In FORGE this is a per-seed diagnostic; inference uses group-level sign-flip tests.</p>
            </div>
          </Section>
          <Section id="first" n={7} title="First run">
            <p>Live checks from this machine:</p>
            {rd.data ? <Checklist items={rd.data.checks.map((x) => ({ check: x.label, status: x.status, detail: x.detail }))} /> : <Skeleton h={160} />}
            <pre className="scroll-thin overflow-x-auto rounded-[var(--radius)] bg-surface-2 p-3 font-mono text-[11.5px] text-ink">{`.\\scripts\\probe-host.ps1
.\\scripts\\setup.ps1 -WithML
.\\scripts\\verify-gpu.ps1
.\\scripts\\get-student.ps1 -Repo allenai/Olmo-3-7B-Instruct   # optional; the Hub tab does the same
.\\scripts\\launch.ps1`}</pre>
          </Section>
          <Section id="myths" n={8} title="Myths vs facts">
            <div className="rounded-[var(--radius)] border border-teacher/30 bg-teacher/[0.05] p-3 text-[12.5px]">{HONESTY}</div>
            <dl className="divide-y divide-line">{MYTHS.map(([m, f]) => (
              <div key={m} className="grid gap-1 py-2.5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:gap-4"><dt className="text-[12.5px] text-ink-3 line-through decoration-ink-3/40">{m}</dt><dd className="text-[12.5px] text-ink">{f}</dd></div>))}</dl>
          </Section>
        </div>
      </div>
    </div>
  );
}
