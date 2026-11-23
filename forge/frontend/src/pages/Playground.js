import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from "react";
import { PathGraph } from "../components/graphs";
import { JobLog, StudySelect } from "../components/live";
import { Badge, Button, Empty, ErrorLine, Field, Notice, PageHeader, Panel, Prov, Segmented, Skeleton, Status, cx, inputCls, td, th, tr } from "../components/ui";
import { api, fmt } from "../lib/api";
import { useAction, useApi } from "../lib/hooks";
import { usePrefs } from "../lib/prefs";
import { useReviewer } from "../lib/reviewer";
const ACCENT = { teacher: "var(--s-teacher)", base: "var(--s-base)", adapter: "var(--s-tuned)", variant: "var(--cat-7)" };
export default function Playground() {
    const { prefs } = usePrefs();
    const sid = prefs.activeStudy;
    const s = useApi(sid ? `/api/studies/${sid}` : null, 4000);
    const plan = s.data?.plan;
    const variants = useApi("/api/weightlab", 10000);
    const tasks = useApi(sid ? `/api/studies/${sid}/playground/tasks` : null);
    const runs = useApi(sid ? `/api/studies/${sid}/playground` : null, 6000);
    const [mode, setMode] = useState("message");
    const [msg, setMsg] = useState("");
    const [taskId, setTaskId] = useState("");
    const [runId, setRunId] = useState(null);
    const [jobId, setJobId] = useState(null);
    const preVariant = (() => { try {
        return sessionStorage.getItem("forge.playground.variant");
    }
    catch {
        return null;
    } })();
    const options = useMemo(() => {
        if (!plan)
            return [];
        const isTrained = s.data?.state.stages.train?.status === "completed";
        const trained = isTrained ? plan.arms.flatMap((a) => plan.seeds.map((sd) => ({ kind: "adapter", arm: a, seed: sd, label: `${a} · seed ${sd}` }))) : [];
        const vs = (variants.data ?? []).filter((v) => v.status === "built" && (!v.base_hash || !plan.base_hash || v.base_hash === plan.base_hash))
            .map((v) => ({ kind: "variant", variant: v.id, label: `variant · ${v.name}` }));
        return [{ kind: "teacher", label: "teacher" }, { kind: "base", label: "untrained student" }, ...trained, ...vs];
    }, [plan, variants.data, s.data]);
    const [sel, setSel] = useState([]);
    useEffect(() => {
        if (!options.length)
            return;
        setSel((cur) => (cur.length ? cur.filter((x) => options.some((o) => o.label === x)) : ["teacher", "untrained student", options[2]?.label, ...(preVariant ? options.filter((o) => o.variant === preVariant).map((o) => o.label) : [])].filter(Boolean)));
    }, [options]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { setRunId(null); setJobId(null); }, [sid]);
    useEffect(() => { if (!runId && runs.data?.length)
        setRunId(runs.data[0].id); }, [runs.data, runId]);
    const running = s.data?.jobs?.find((j) => j.status === "running" && j.kind === "playground");
    const act = useAction();
    const start = () => void act.run(async () => {
        const lanes = options.filter((o) => sel.includes(o.label)).map(({ kind, arm, seed, variant, label }) => ({ kind, arm, seed, variant, label }));
        const j = await api.post(`/api/studies/${sid}/playground`, { prompt: mode === "message" ? msg : null, task_id: mode === "task" ? taskId : null, lanes });
        setJobId(j.id);
        setRunId(null);
    });
    const run = useApi(sid && runId ? `/api/studies/${sid}/playground/${runId}` : null);
    const isAgent = plan?.taskset.kind === "agent";
    const example = isAgent ? "e.g. Night shift says the barcode scanner keeps failing on 5 East. Which assignment group should it go to?" : "Ask the agent something its tools can answer…";
    return (_jsxs("div", { className: "space-y-4 fit:flex fit:h-full fit:min-h-0 fit:flex-col fit:gap-3 fit:space-y-0", children: [_jsx(PageHeader, { kicker: "See it yourself", title: "Agent Playground", subtitle: "One message, several models, side by side \u2014 the untrained student, trained students, Weight Lab variants and the teacher \u2014 with every tool call they make. A person decides whether to accept each recommendation.", right: _jsx(StudySelect, {}) }), _jsx(ErrorLine, { error: s.error }), !sid ? _jsx(Panel, { children: _jsx(Empty, { icon: "play", children: "Select a study (an agent study shows the most)." }) }) : !plan ? _jsx(Skeleton, { h: 400 }) : (_jsxs("div", { className: "grid gap-4 fit:min-h-0 fit:flex-1 fit:grid-cols-[400px_minmax(0,1fr)] fit:gap-3", children: [_jsxs("div", { className: "scroll-thin flex min-w-0 flex-col gap-4 fit:min-h-0 fit:gap-3 fit:overflow-auto fit:pr-1", children: [_jsx(Panel, { title: "Ask", eyebrow: plan.name, children: _jsxs("div", { className: "space-y-3", children: [_jsx(Segmented, { label: "Input", value: mode, onChange: setMode, options: [{ value: "message", label: "your message" }, { value: "task", label: "a practice task" }] }), mode === "message" ? (_jsx("textarea", { className: cx(inputCls, "h-28 py-2 font-sans text-[13px] leading-relaxed"), placeholder: example, value: msg, onChange: (e) => setMsg(e.target.value), "aria-label": "Message" })) : (_jsx(Field, { label: "Task", hint: tasks.data?.sealed ? "All splits available (sealed)." : "Train and dev only — the final test stays untouched until you seal.", children: _jsxs("select", { className: inputCls, value: taskId, onChange: (e) => setTaskId(e.target.value), children: [_jsx("option", { value: "", children: "\u2014 choose \u2014" }), (tasks.data?.tasks ?? []).map((t) => _jsxs("option", { value: t.task_id, children: ["[", t.split, "] ", t.prompt.slice(0, 90)] }, t.task_id))] }) })), _jsxs("div", { children: [_jsx("div", { className: "micro mb-1.5 text-ink-3", children: "models to compare (up to 6)" }), _jsx("div", { className: "flex flex-wrap gap-1.5", children: options.map((o) => {
                                                        const on = sel.includes(o.label);
                                                        return _jsxs("button", { type: "button", "aria-pressed": on, onClick: () => setSel(on ? sel.filter((x) => x !== o.label) : sel.length < 6 ? [...sel, o.label] : sel), className: cx("inline-flex items-center gap-1.5 rounded-[3px] border px-2 py-1 text-[11.5px] transition", on ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-3 hover:text-ink"), children: [_jsx("span", { className: "h-2 w-2 rounded-full", style: { background: ACCENT[o.kind] } }), o.label] }, o.label);
                                                    }) })] }), _jsx(Notice, { tone: "info", children: "Students run on your GPU; the teacher runs in LM Studio. A 1.7B student usually fits next to the teacher \u2014 if VRAM is tight, compare students without the teacher." }), _jsx(Button, { tone: "primary", icon: "play", busy: act.busy, disabled: !sel.length || (mode === "message" ? !msg.trim() : !taskId) || !!running, onClick: start, children: "Run side by side" }), _jsx(ErrorLine, { error: act.error })] }) }), (jobId || running) && _jsx(Panel, { title: "Working\u2026", eyebrow: "live", children: _jsx(JobLog, { jobId: jobId ?? running.id, height: 150, onDone: () => { setJobId(null); void runs.reload().then(() => setRunId(null)); } }, jobId ?? running.id) }), _jsx(Panel, { flush: true, title: "Recent runs", children: !(runs.data ?? []).length ? _jsx(Empty, { children: "No runs yet." }) : (runs.data ?? []).map((r) => (_jsxs("button", { type: "button", onClick: () => setRunId(r.id), className: cx("block w-full border-b border-line px-[var(--pad)] py-2 text-left last:border-0 hover:bg-surface-2", r.id === runId && "!bg-accent-soft"), children: [_jsx("div", { className: "line-clamp-2 text-[12px] text-ink", children: r.prompt }), _jsxs("div", { className: "mt-0.5 font-mono text-[10px] text-ink-3", children: [fmt.ago(r.created_at), " \u00B7 ", r.lanes.join(" · ")] })] }, r.id))) })] }), _jsxs("div", { className: "scroll-thin min-w-0 space-y-4 fit:min-h-0 fit:space-y-3 fit:overflow-auto fit:pr-1", children: [!run.data ? _jsx(Panel, { children: _jsx(Empty, { icon: "play", children: "Run a message to see the models side by side." }) }) : _jsx(Results, { r: run.data, sid: sid, agentId: plan.taskset.agent?.id ?? null }), _jsx(Decisions, { sid: sid, agentId: plan.taskset.agent?.id ?? null })] })] }))] }));
}
function Results({ r, sid, agentId }) {
    return (_jsxs(_Fragment, { children: [_jsxs(Panel, { title: "The message", eyebrow: r.task.task_id === "playground" ? "your message" : `${r.task.split} task · ${r.task.family}`, prov: _jsx(Prov, { kind: "measured", source: "playground run" }), children: [_jsx("div", { className: "text-[13.5px] text-ink", children: r.prompt }), r.task.reference_answer && _jsxs("div", { className: "mt-1.5 text-[12px] text-ink-3", children: ["Verified answer: ", _jsx("span", { className: "font-mono text-ink", children: r.task.reference_answer })] })] }), _jsx("div", { className: cx("grid gap-3", r.lanes.length > 1 && "xl:grid-cols-2", r.lanes.length > 2 && "3xl:grid-cols-3"), children: r.lanes.map((l) => _jsx(LaneCard, { l: l, run: r, sid: sid, agentId: agentId }, l.label)) }), _jsx("div", { className: "text-[11px] text-ink-3", children: r.honesty })] }));
}
function LaneCard({ l, run, sid, agentId }) {
    const [reviewer, setReviewer] = useReviewer();
    const [ov, setOv] = useState(null);
    const [done, setDone] = useState(null);
    const act = useAction();
    const decide = (decision) => void act.run(async () => {
        await api.post("/api/decisions", { study_id: sid, run_id: run.id, lane: l.label, decision, correct_answer: decision === "override" ? ov : null, reviewer });
        setDone(decision === "accept" ? "Accepted" : `Overridden → ${ov}`);
        setOv(null);
    });
    const color = ACCENT[l.lane.kind] ?? "var(--s-tuned)";
    return (_jsx(Panel, { title: l.label, eyebrow: l.model, right: _jsxs("span", { className: "num font-mono text-[10.5px] text-ink-3", children: [(l.usage.latency_ms / 1000).toFixed(1), " s \u00B7 ", l.usage.completion_tokens, " tok"] }), children: _jsxs("div", { className: "space-y-3", children: [_jsx("div", { className: "h-1 rounded-full", style: { background: color } }), _jsxs("div", { className: "rounded-[var(--radius)] border border-line bg-surface-2 p-2.5", children: [_jsx("div", { className: "micro mb-1 text-ink-3", children: "recommendation" }), _jsx("div", { className: "font-mono text-[13px] text-ink", children: l.answer ?? _jsxs("span", { className: "text-crit-ink", children: ["no answer (", l.termination, ")"] }) }), _jsxs("div", { className: "mt-2 flex flex-wrap gap-1.5", children: [l.score && _jsx(Status, { s: l.score.strict_success ? "pass" : "fail", label: l.score.strict_success ? "strict ✓" : l.score.answer_correct ? "answer right, path wrong" : "wrong" }), l.evidence !== null && _jsx(Badge, { tone: l.evidence ? "good" : "warn", title: "Is the answer a value a tool returned in this run?", children: l.evidence ? "backed by a tool result" : "not backed by a tool result" }), l.lane.kind !== "teacher" && l.diverges_at !== null && _jsxs(Badge, { tone: "warn", children: ["differs from teacher at step ", l.diverges_at + 1] }), l.lane.kind !== "teacher" && l.diverges_at === null && run.lanes.some((x) => x.lane.kind === "teacher") && _jsx(Badge, { tone: "good", children: "same steps as teacher" }), l.errors.length > 0 && _jsx(Badge, { tone: "crit", children: l.errors.join(", ") })] })] }), _jsx(PathGraph, { g: l.graph, accent: color }), _jsxs("div", { className: "border-t border-line pt-2.5", children: [done ? _jsxs("div", { className: "text-[12px] text-good-ink", children: [done, " \u00B7 recorded for ", reviewer] }) : (_jsxs("div", { className: "flex flex-wrap items-center gap-2", children: [_jsx("input", { className: cx(inputCls, "!w-32 font-sans"), placeholder: "your initials", value: reviewer, onChange: (e) => setReviewer(e.target.value), "aria-label": "Reviewer" }), _jsx(Button, { size: "sm", icon: "check", disabled: !reviewer.trim() || l.answer == null, busy: act.busy, onClick: () => decide("accept"), children: "Accept" }), ov === null ? _jsx(Button, { size: "sm", tone: "ghost", disabled: !reviewer.trim(), onClick: () => setOv(""), children: "Override\u2026" }) : (_jsxs(_Fragment, { children: [_jsx("input", { className: cx(inputCls, "!w-40"), placeholder: "correct answer", value: ov, onChange: (e) => setOv(e.target.value), "aria-label": "Correct answer", autoFocus: true }), _jsx(Button, { size: "sm", tone: "primary", disabled: !ov.trim(), busy: act.busy, onClick: () => decide("override"), children: "Save" })] }))] })), agentId && _jsx("div", { className: "mt-1 text-[10.5px] text-ink-3", children: "Overrides appear below and can become new examples for the agent." }), _jsx(ErrorLine, { error: act.error })] })] }) }));
}
function Decisions({ sid, agentId }) {
    const d = useApi(`/api/decisions?study_id=${sid}`, 5000);
    const agent = useApi(agentId ? `/api/agents/${agentId}` : null);
    const [added, setAdded] = useState({});
    const act = useAction();
    const rows = d.data?.decisions ?? [];
    const addExample = (i, r, skillId) => void act.run(async () => {
        const skills = (agent.data?.skills ?? []).map((k) => (k.id === skillId ? { ...k, examples: [...k.examples, { prompt: r.prompt, answer: r.correct_answer, calls: [] }] } : k));
        await api.put(`/api/agents/${agentId}`, { skills });
        setAdded({ ...added, [i]: skillId });
    });
    return (_jsxs(Panel, { flush: true, title: "Human decisions", eyebrow: "accept / override", prov: _jsx(Prov, { kind: "declared", source: "decisions.jsonl" }), right: _jsx("div", { className: "flex gap-2", children: Object.entries(d.data?.by_lane ?? {}).map(([k, v]) => _jsxs(Badge, { children: [k, ": ", v.accept, "\u2713 ", v.override, "\u270E"] }, k)) }), children: [!rows.length ? _jsx(Empty, { children: "No decisions yet. Accept or override a recommendation above." }) : (_jsxs("table", { className: "w-full text-[12px]", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { className: th, children: "Message" }), _jsx("th", { className: th, children: "Model" }), _jsx("th", { className: th, children: "Agent said" }), _jsx("th", { className: th, children: "Decision" }), _jsx("th", { className: th, children: "By" }), agentId && _jsx("th", { className: th })] }) }), _jsx("tbody", { children: rows.slice(0, 30).map((r, i) => (_jsxs("tr", { className: tr, children: [_jsx("td", { className: cx(td, "max-w-[280px]"), children: _jsx("div", { className: "line-clamp-2 text-ink-2", children: r.prompt }) }), _jsx("td", { className: cx(td, "text-ink-3"), children: r.lane }), _jsx("td", { className: cx(td, "font-mono"), children: r.agent_answer ?? "—" }), _jsx("td", { className: td, children: r.decision === "accept" ? _jsx(Badge, { tone: "good", children: "accepted" }) : _jsxs("span", { children: [_jsx(Badge, { tone: "warn", children: "override" }), " ", _jsx("span", { className: "font-mono text-ink", children: r.correct_answer })] }) }), _jsx("td", { className: cx(td, "text-ink-3"), children: r.reviewer }), agentId && _jsx("td", { className: td, children: r.decision === "override" && (added[i] ? _jsxs("span", { className: "text-[11px] text-good-ink", children: ["added to ", added[i]] }) : (_jsxs("select", { className: cx(inputCls, "h-7 !w-auto font-sans text-[11px]"), defaultValue: "", "aria-label": "Add as example to skill", onChange: (e) => e.target.value && addExample(i, r, e.target.value), children: [_jsx("option", { value: "", children: "add as example to\u2026" }), (agent.data?.skills ?? []).map((k) => _jsx("option", { value: k.id, children: k.name }, k.id))] }))) })] }, i))) })] })), _jsx("div", { className: "px-[var(--pad)] pb-2", children: _jsx(ErrorLine, { error: act.error }) })] }));
}
