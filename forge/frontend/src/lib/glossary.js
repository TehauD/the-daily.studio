import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useId, useState } from "react";
/** Plain-language definitions shown wherever a technical word appears (hover or keyboard focus). */
export const GLOSSARY = {
    teacher: { term: "Teacher", plain: "A large, capable model (run in LM Studio) whose good answers become the examples the small model learns from." },
    student: { term: "Student", plain: "The small model being trained. It runs on this PC and is never sent anywhere." },
    adapter: { term: "Adapter (LoRA)", plain: "A small add-on file of learned changes. The original model is never modified; remove the adapter and you are back where you started." },
    distillation: { term: "Distillation", plain: "Teaching a small model to imitate a larger one on specific tasks, using the larger model's checked successful work." },
    study: { term: "Study", plain: "One frozen, recorded experiment: which models, which tasks, which settings. Its plan is hashed so nobody can change it afterwards." },
    seal: { term: "Seal", plain: "Locks the final test set until the very end, so decisions made while building can't quietly be tuned to it." },
    split: { term: "Train / dev / test", plain: "Tasks are divided up front: train is learned from, dev guides decisions, test is the sealed final exam." },
    skill: { term: "Skill", plain: "One kind of job the agent does (for example ‘route a ticket’). Results are reported per skill." },
    tool: { term: "Tool", plain: "A read-only action the agent can take, such as looking up a table row or calculating a date. Tools never change data." },
    strict: { term: "Strict success", plain: "The task counts as done only if the final answer is right AND the agent followed the rules (valid tool calls, evidence for its answer)." },
    ci: { term: "Confidence interval", plain: "The range the true effect plausibly lies in given the data. A wide range means ‘not enough evidence yet’." },
    heldout: { term: "Held-out", plain: "Tasks the model never saw during training. Only held-out results say anything about real improvement." },
    notfound: { term: "NOT_FOUND", plain: "The correct answer when the information doesn't exist. Saying ‘I can't find that’ is better than a confident guess." },
    vram: { term: "VRAM", plain: "The graphics card's own memory. Models and training must fit inside it." },
    gguf: { term: "GGUF", plain: "A compressed model file format used by LM Studio and Ollama for running models — not for training." },
    weightlab: { term: "Weight Lab", plain: "Mix, scale and trim trained adapters with exact math, then measure what each change does." },
    thermal: { term: "Thermal pause", plain: "If the graphics card gets too hot, work waits at a safe point until it cools. Results are unchanged." },
    human: { term: "Human review", plain: "People decide. FORGE measures and explains; it never approves a model for use." },
};
/** <Term k="adapter">adapter</Term> — underlined word with a plain-language explanation on hover and focus. */
export function Term({ k, children }) {
    const g = GLOSSARY[k];
    const id = useId();
    const [open, setOpen] = useState(false);
    if (!g)
        return _jsx(_Fragment, { children: children });
    return (_jsxs("span", { className: "relative inline-block", onMouseEnter: () => setOpen(true), onMouseLeave: () => setOpen(false), children: [_jsx("button", { type: "button", "aria-describedby": open ? id : undefined, onFocus: () => setOpen(true), onBlur: () => setOpen(false), className: "cursor-help border-b border-dotted border-ink-3 text-inherit outline-none focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-accent-soft", children: children ?? g.term }), open && (_jsxs("span", { role: "tooltip", id: id, className: "absolute left-0 top-full z-50 mt-1 w-[260px] max-w-[80vw] rounded-[var(--radius)] border border-line-strong bg-surface p-2.5 text-left text-[12px] font-normal normal-case leading-snug tracking-normal text-ink-2 shadow-lg", children: [_jsx("b", { className: "mb-0.5 block text-ink", children: g.term }), g.plain] }))] }));
}
