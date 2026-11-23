import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { Icon } from "../components/icons";
import { Badge, Button, Empty, ErrorLine, PageHeader, Panel, Segmented, Skeleton, cx } from "../components/ui";
import { Term } from "../lib/glossary";
import { goto, handoff } from "../lib/handoff";
import { useApi } from "../lib/hooks";
import { usePrefs } from "../lib/prefs";
const STAGES = ["collect", "build", "train", "evaluate_dev", "analyze_dev", "seal", "evaluate_test", "analyze_test", "export"];
const KIND = {
    agent: { label: "Agent", icon: "agent" }, docs: { label: "Documents", icon: "layers" }, catalog: { label: "Built-in", icon: "flask" }
};
const pct = (v) => (v == null ? "—" : `${Math.round(v * 100)}%`);
/** Role-based tours: an ordered walk through the pages that matter for that person, and what to look at on each. */
export const TOURS = {
    ops: { label: "Operations / clinical lead", who: "You know the work and decide whether the agent helps your team.", steps: [
            ["agent-studio", "Agent Studio", "Read the agent's job description, its skills and the read-only tools it may use. Nothing here can change real systems."],
            ["playground", "Playground", "Ask it something from your day. Compare the untrained model, the trained one and the teacher side by side; accept or override each answer."],
            ["evaluation", "Evaluation", "Did training help on tasks it never saw? Look per skill, and at the range (confidence interval), not just the average."],
            ["modelmap", "Model Map", "See how the agent's decisions are organised and where it stays consistent or wavers."]
        ] },
    analyst: { label: "Analyst / data owner", who: "You own the tables and examples the agent learns from.", steps: [
            ["agent-studio", "Agent Studio → Tasks", "Review the practice tasks: approve, fix or reject. Every task is checked against the tables before it is used."],
            ["studio", "Experiment Studio", "Run the study stage by stage. Each stage records exactly what it did."],
            ["evaluation", "Evaluation", "Read the per-skill gains and the regressions — what got worse matters as much as what got better."],
            ["lens", "Distillation Lens", "Watch the student's word choices move toward the teacher's over training."]
        ] },
    engineer: { label: "Engineer / data scientist", who: "You tune, compare and package models.", steps: [
            ["observatory", "Model Observatory", "Check which models are present, trainable, and fit the graphics card."],
            ["training", "Training Lab", "Memory plan, integrity gates, learning curve, energy used."],
            ["weightlab", "Weight Lab", "Mix, scale and trim adapters with exact maths; measure each variant."],
            ["modelmap", "Model Map", "Inspect hidden-state geometry and word attributions before and after."],
            ["factory", "Model Factory", "Merge and export — with a post-merge check that it still behaves the same."]
        ] },
    leader: { label: "Leader / governance", who: "You need to know what was tested, by whom, and what FORGE does not claim.", steps: [
            ["evaluation", "Evaluation", "The sealed final test is the only confirmatory result. ‘Candidate for human review’ is the best outcome FORGE gives."],
            ["playground", "Playground decisions", "Every accept/override a reviewer made is logged with their name."],
            ["guide", "Guide → Myths vs facts", "What these numbers do and do not mean."]
        ] },
};
export default function Home() {
    const { prefs, set } = usePrefs();
    const p = useApi("/api/projects", 6000);
    const open = (pr) => {
        if (pr.studies[0])
            set("activeStudy", pr.studies[0].id);
        if (pr.kind === "agent" && pr.ref)
            handoff("agent", pr.ref);
        if (pr.kind === "docs" && pr.ref)
            handoff("pack", pr.ref);
    };
    const tour = prefs.role ? TOURS[prefs.role] : null;
    return (_jsxs("div", { className: "space-y-4", children: [_jsx(PageHeader, { kicker: "Agent generation lab \u00B7 health system", title: "Home", subtitle: _jsxs(_Fragment, { children: ["Build small, local agents for routine work, see exactly what changes when they learn, and keep people in charge of every decision. ", _jsx(Term, { k: "human", children: "Humans review" }), "; FORGE measures."] }), right: _jsx(Segmented, { label: "Interface mode", value: prefs.mode, onChange: (v) => set("mode", v), options: [{ value: "simple", label: "Simple" }, { value: "expert", label: "Expert" }] }) }), _jsx("div", { className: "grid gap-3 md:grid-cols-3", children: [["agent", "Build an agent", "Pick a health-system template (service desk, patient access, pharmacy benefits…), shape its skills and tools.", () => { handoff("new-agent", "1"); goto("agent-studio"); }],
                    ["layers", "Teach from documents", "Point at a folder of policies or guides; the agent learns to answer from them — and to say when it can't.", () => { handoff("new-pack", "1"); goto("knowledge-studio"); }],
                    ["play", "Try and compare", "Ask a question and watch the untrained model, the trained one and the teacher answer side by side.", () => goto("playground")]]
                    .map(([icon, t, d, fn]) => (_jsxs("button", { type: "button", onClick: fn, className: "group flex items-start gap-3 rounded-[var(--radius)] border border-line bg-surface p-4 text-left transition hover:border-accent-line hover:bg-accent-soft/40", children: [_jsx("span", { className: "mt-0.5 rounded-[var(--radius)] bg-accent-soft p-2 text-accent", children: _jsx(Icon, { name: icon, size: 18 }) }), _jsxs("span", { children: [_jsx("span", { className: "block text-[13.5px] font-medium text-ink", children: t }), _jsx("span", { className: "mt-1 block text-[12px] leading-snug text-ink-2", children: d })] })] }, t))) }), _jsxs("div", { className: "grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]", children: [_jsxs(Panel, { title: "Projects", eyebrow: p.data ? `${p.data.counts.agents} agents · ${p.data.counts.docs} doc sets · ${p.data.counts.studies} studies` : undefined, children: [!p.data && !p.error ? _jsxs("div", { className: "grid gap-3 md:grid-cols-2", children: [_jsx(Skeleton, { h: 150 }), _jsx(Skeleton, { h: 150 })] })
                                : p.data && !p.data.projects.length ? _jsx(Empty, { icon: "agent", children: "No projects yet. Start with \u201CBuild an agent\u201D \u2014 the templates come with synthetic data, so nothing sensitive is needed." })
                                    : _jsx("div", { className: "grid gap-3 md:grid-cols-2 3xl:grid-cols-3", children: p.data?.projects.map((pr) => _jsx(ProjectCard, { pr: pr, onOpen: open }, pr.id)) }), _jsx(ErrorLine, { error: p.error, onRetry: p.reload })] }), _jsxs("div", { className: "space-y-4", children: [_jsxs(Panel, { title: "Guided tour", eyebrow: "pick your role", children: [_jsx("div", { className: "flex flex-wrap gap-1.5", children: Object.entries(TOURS).map(([k, t]) => (_jsx("button", { type: "button", onClick: () => set("role", prefs.role === k ? null : k), "aria-pressed": prefs.role === k, className: cx("rounded-full border px-2.5 py-1 text-[11.5px] transition", prefs.role === k ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-2 hover:border-line-strong"), children: t.label }, k))) }), tour ? (_jsxs("ol", { className: "mt-3 space-y-2", children: [_jsx("li", { className: "text-[12px] text-ink-3", children: tour.who }), tour.steps.map(([route, title, what], i) => (_jsx("li", { children: _jsxs("button", { type: "button", onClick: () => goto(route), className: "group flex w-full gap-2.5 rounded-[var(--radius)] p-1.5 text-left hover:bg-surface-2", children: [_jsx("span", { className: "num mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-line-strong font-mono text-[10.5px] text-ink-2 group-hover:border-accent group-hover:text-accent", children: i + 1 }), _jsxs("span", { children: [_jsx("span", { className: "block text-[12.5px] font-medium text-ink", children: title }), _jsx("span", { className: "block text-[12px] leading-snug text-ink-2", children: what })] })] }) }, route + i)))] })) : _jsxs("p", { className: "mt-3 text-[12px] text-ink-2", children: ["Choose a role for a short, ordered walk through the pages that matter to you. Underlined words like ", _jsx(Term, { k: "adapter", children: "adapter" }), " or ", _jsx(Term, { k: "seal", children: "seal" }), " explain themselves on hover."] })] }), _jsx(Panel, { title: "How control works here", children: _jsxs("ul", { className: "space-y-2 text-[12.5px] leading-snug text-ink-2", children: [_jsxs("li", { children: [_jsx("b", { className: "text-ink", children: "Synthetic by default." }), " Templates use made-up data; anything resembling personal information is refused."] }), _jsxs("li", { children: [_jsx("b", { className: "text-ink", children: "Nothing is overwritten." }), " Training makes a separate ", _jsx(Term, { k: "adapter", children: "adapter" }), "; the original model stays untouched."] }), _jsxs("li", { children: [_jsx("b", { className: "text-ink", children: "Measured, not asserted." }), " Improvement is claimed only from ", _jsx(Term, { k: "heldout", children: "held-out" }), " tasks, with a ", _jsx(Term, { k: "ci", children: "confidence range" }), "."] }), _jsxs("li", { children: [_jsx("b", { className: "text-ink", children: "People decide." }), " The best outcome FORGE gives is \u201Ccandidate for human review\u201D."] }), _jsxs("li", { children: [_jsx("b", { className: "text-ink", children: "Gentle on hardware." }), " Jobs pause if the GPU runs hot (", _jsx(Term, { k: "thermal", children: "thermal pause" }), ") and leave CPU cores free."] })] }) })] })] })] }));
}
function ProjectCard({ pr, onOpen }) {
    const s = pr.studies[0];
    const h = pr.headline;
    const k = KIND[pr.kind];
    return (_jsxs("div", { className: cx("flex flex-col rounded-[var(--radius)] border bg-surface p-3.5", pr.running ? "border-accent-line" : "border-line"), children: [_jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { className: "min-w-0", children: [_jsxs("div", { className: "micro flex items-center gap-1.5 text-ink-3", children: [_jsx(Icon, { name: k.icon, size: 12 }), k.label, pr.template && pr.template !== "blank" ? ` · ${pr.template.replace(/_/g, " ")}` : ""] }), _jsx("div", { className: "mt-1 truncate text-[14px] font-medium text-ink", title: pr.name, children: pr.name })] }), pr.running ? _jsxs(Badge, { tone: "accent", children: [_jsx("span", { className: "live-dot mr-1 inline-block h-1.5 w-1.5 rounded-full bg-accent" }), "running"] })
                        : s?.sealed ? _jsx(Badge, { tone: "good", children: "sealed" }) : null] }), _jsxs("div", { className: "mt-2 flex flex-wrap gap-x-3 gap-y-0.5 font-mono text-[11px] text-ink-3", children: [pr.skills != null && _jsxs("span", { children: [pr.skills, " skills"] }), pr.tables != null && _jsxs("span", { children: [pr.tables, " tables"] }), _jsxs("span", { children: [pr.studies.length, " ", pr.studies.length === 1 ? "study" : "studies"] }), pr.variants.length > 0 && _jsxs("span", { children: [pr.variants.length, " ", pr.variants.length === 1 ? "variant" : "variants"] })] }), s && (_jsxs("div", { className: "mt-3", "aria-label": `Latest study ${s.name}: stages`, children: [_jsx("div", { className: "flex gap-0.5", children: STAGES.map((st) => {
                            const v = s.stages[st];
                            return _jsx("span", { title: `${st}: ${v ?? "not started"}`, className: cx("h-1.5 flex-1 rounded-full", v === "completed" ? "bg-accent" : v === "running" ? "live-dot bg-accent" : v === "failed" || v === "interrupted" ? "bg-crit" : "bg-surface-3") }, st);
                        }) }), _jsx("div", { className: "mt-1 truncate text-[11px] text-ink-3", children: s.name })] })), h && (_jsxs("div", { className: "mt-3 grid grid-cols-3 gap-2 border-t border-line pt-2.5 text-center", children: [[["untrained", h.base, "text-ink-2"], ["trained", h.tuned, "text-accent"], ["teacher", h.teacher, "text-ink-2"]].map(([l, v, c]) => (_jsxs("div", { children: [_jsx("div", { className: cx("num font-mono text-[15px] font-medium", c), children: pct(v) }), _jsx("div", { className: "micro !text-[9px] text-ink-3", children: l })] }, l))), _jsxs("div", { className: "col-span-3 text-[10.5px] text-ink-3", children: [h.confirmatory ? "sealed final test" : "practice (dev) tasks — not the final result", " \u00B7 ", _jsx(Term, { k: "strict", children: "strict success" })] })] })), _jsxs("div", { className: "mt-auto pt-3", children: [_jsxs("div", { className: "mb-2 text-[12px] text-ink-2", children: [_jsx("span", { className: "text-ink-3", children: "Next: " }), pr.next.label] }), _jsx(Button, { size: "sm", tone: "primary", icon: "chevron", onClick: () => { onOpen(pr); goto(pr.next.route); }, children: "Open" })] })] }));
}
