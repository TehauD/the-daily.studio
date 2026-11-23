import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from "react";
import { Icon } from "../components/icons";
import { JobLog, useStudies } from "../components/live";
import { Badge, Button, Empty, ErrorLine, Field, Hash, KV, Notice, PageHeader, Panel, Prov, Segmented, Status, cx, inputCls, td, th, tr } from "../components/ui";
import { api, fmt } from "../lib/api";
import { useAction, useApi } from "../lib/hooks";
import { usePrefs } from "../lib/prefs";
const STAGE_LABEL = { init: "Init", collect: "Collect", build: "Build", train: "Train", evaluate_dev: "Eval · dev", analyze_dev: "Analyze · dev",
    seal: "Seal", evaluate_test: "Eval · test", analyze_test: "Analyze · test", export: "Export" };
const STAGE_HINT = {
    collect: "Teacher runs every task (all splits) through the JSON tool protocol. Oracle trajectories are generated for eligibility.",
    build: "Strict teacher successes on train become per-turn prompt/completion records. Arms share eligible task ids.",
    train: "LoRA per arm × seed. Pre-flight gates; the teacher must be unloaded from the GPU first.",
    evaluate_dev: "Base and tuned students on identical dev tasks, greedy decoding.",
    analyze_dev: "Paired dev statistics for decisions before sealing.",
    seal: "Freezes adapters by sha256. After this, no further training is permitted.",
    evaluate_test: "Base and tuned on test, OOD wording, and regression split.",
    analyze_test: "Confirmatory statistics and the review gate.",
    export: "Merged bf16 copy (new directory) with mandatory post-merge re-evaluation.",
};
export default function Studio() {
    const { prefs, set } = usePrefs();
    const studies = useStudies();
    const [creating, setCreating] = useState(false);
    useEffect(() => { if (sessionStorage.getItem("forge.pair"))
        setCreating(true); }, []);
    const sid = prefs.activeStudy;
    return (_jsxs("div", { className: creating ? "space-y-4" : "space-y-4 fit:flex fit:h-full fit:min-h-0 fit:flex-col fit:gap-3 fit:space-y-0", children: [_jsx(PageHeader, { kicker: "Research", title: "Experiment Studio", subtitle: "A study freezes the pair, profile, seeds, arms, task set, hyperparameters, base-model hash, and engine source hash at creation. Stages run as separate processes, one GPU job at a time.", right: _jsx(Button, { tone: "primary", icon: "plus", onClick: () => setCreating((c) => !c), children: creating ? "Close wizard" : "New study" }) }), creating && _jsx(Wizard, { onCreated: (id) => { set("activeStudy", id); setCreating(false); void studies.reload(); } }), _jsxs("div", { className: "grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)] fit:min-h-0 fit:flex-1 fit:gap-3", children: [_jsx(Panel, { fill: true, flush: true, title: "Studies", right: _jsx("span", { className: "num font-mono text-[10.5px] text-ink-3", children: studies.data?.length ?? 0 }), children: !studies.data?.length ? _jsx(Empty, { icon: "flask", children: "No studies yet. Create one to start the MVP loop." }) : (_jsx("ul", { className: "divide-y divide-line", children: studies.data.map((s) => (_jsx("li", { children: _jsxs("button", { type: "button", onClick: () => set("activeStudy", s.id), className: cx("w-full px-[var(--pad)] py-2.5 text-left transition hover:bg-surface-2", sid === s.id && "bg-accent-soft"), children: [_jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx("span", { className: "truncate text-[12.5px] font-medium text-ink", children: s.name }), _jsx(Badge, { children: s.profile })] }), _jsxs("div", { className: "mt-0.5 truncate font-mono text-[10.5px] text-ink-3", children: [s.teacher, " \u2192 ", s.student] }), _jsxs("div", { className: "mt-1 flex items-center gap-2 font-mono text-[10.5px] text-ink-3", children: [s.sealed && _jsx("span", { className: "text-accent", children: "\u25CF sealed" }), _jsxs("span", { children: ["next: ", s.next_stage ?? "done"] })] })] }) }, s.id))) })) }), sid ? _jsx(StudyView, { sid: sid }, sid) : _jsx(Panel, { children: _jsx(Empty, { icon: "studio", children: "Select or create a study." }) })] })] }));
}
function Wizard({ onCreated }) {
    const models = useApi("/api/models");
    const cat = useApi("/api/studies/catalog");
    const rd = useApi("/api/system/readiness");
    const pre = (() => { try {
        return JSON.parse(sessionStorage.getItem("forge.pair") || "null");
    }
    catch {
        return null;
    } })();
    const ms = models.data?.models ?? [];
    const [f, setF] = useState({ name: "", profile: "smoke", teacher_id: pre?.teacher ?? "", student_id: pre?.student ?? "", arms: ["teacher_filtered"], min_gain: 0.05, max_steps: "", epochs: "", max_seq_len: "", device: "cuda", focus_skills: [] });
    useEffect(() => {
        if (!f.teacher_id && ms.length)
            setF((x) => ({ ...x, teacher_id: ms.find((m) => m.roles.includes("teacher"))?.id ?? "", student_id: x.student_id || (ms.find((m) => m.roles.includes("student"))?.id ?? "") }));
    }, [ms, f.teacher_id]);
    const act = useAction();
    const submit = (e) => {
        e.preventDefault();
        void act.run(async () => {
            const body = { ...f, max_steps: f.max_steps ? Number(f.max_steps) : null, epochs: f.epochs ? Number(f.epochs) : null, max_seq_len: f.max_seq_len ? Number(f.max_seq_len) : null, focus_skills: f.focus_skills.length ? f.focus_skills : null, name: f.name || `${f.profile}-${new Date().toISOString().slice(5, 16).replace("T", "-")}` };
            const s = await api.post("/api/studies", body);
            sessionStorage.removeItem("forge.pair");
            onCreated(s.id);
        });
    };
    const prof = cat.data?.profiles[f.profile];
    const teachers = ms.filter((m) => m.eligibility.teacher.verdict !== "fail" && m.status === "available");
    const students = ms.filter((m) => m.capabilities.lora?.status === "supported" && m.eligibility.student.verdict !== "fail" && m.status === "available");
    return (_jsx(Panel, { title: "New study", eyebrow: "wizard", prov: _jsx(Prov, { kind: "declared", source: "frozen on create" }), children: _jsxs("form", { onSubmit: submit, className: "grid gap-5 lg:grid-cols-3", children: [_jsxs("div", { className: "space-y-3", children: [_jsx(Field, { label: "Name", children: _jsx("input", { className: inputCls, value: f.name, onChange: (e) => setF({ ...f, name: e.target.value }), placeholder: "e.g. qwen3-1.7b \u00B7 catalog tools" }) }), _jsx(Field, { label: "Teacher", children: _jsxs("select", { className: inputCls, value: f.teacher_id, onChange: (e) => setF({ ...f, teacher_id: e.target.value }), children: [_jsx("option", { value: "", children: "\u2014" }), teachers.map((m) => _jsx("option", { value: m.id, children: m.name }, m.id))] }) }), _jsx(Field, { label: "Student", hint: "Local safetensors with supported LoRA only.", children: _jsxs("select", { className: inputCls, value: f.student_id, onChange: (e) => setF({ ...f, student_id: e.target.value }), children: [_jsx("option", { value: "", children: "\u2014" }), students.map((m) => _jsxs("option", { value: m.id, children: [m.name, " \u00B7 ", fmt.params(m.parameter_count)] }, m.id))] }) })] }), _jsxs("div", { className: "space-y-3", children: [_jsx(Field, { label: "Profile", children: _jsx(Segmented, { label: "Profile", value: f.profile, onChange: (v) => setF({ ...f, profile: v }), options: ["smoke", "pilot", "research"].map((p) => ({ value: p, label: p })) }) }), prof && _jsxs("div", { className: "rounded-[var(--radius)] border border-line bg-surface-2 p-2.5 text-[11.5px] leading-relaxed text-ink-2", children: [_jsxs("b", { className: "font-medium text-ink", children: [prof.seeds.length, " seed", prof.seeds.length > 1 ? "s" : ""] }), " \u00B7 ", prof.purpose, _jsxs("div", { className: "mt-1 font-mono text-[10.5px] text-ink-3", children: ["train ", JSON.stringify(prof.train), " \u00B7 tasks ", JSON.stringify(prof.taskset)] })] }), _jsx(Field, { label: "Arms", hint: "First arm is the preregistered primary contrast vs base. Additional arms are ablations (one factor each).", children: _jsx("div", { className: "flex flex-wrap gap-1.5", children: Object.keys(cat.data?.arms ?? {}).map((a) => {
                                    const on = f.arms.includes(a);
                                    return _jsxs("button", { type: "button", onClick: () => setF({ ...f, arms: on ? f.arms.filter((x) => x !== a) : [...f.arms, a] }), "aria-pressed": on, className: cx("rounded-[3px] border px-2 py-1 font-mono text-[11px] transition", on ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-3 hover:text-ink"), children: [a, cat.data?.mvp_arms.includes(a) ? "" : " ·ablation"] }, a);
                                }) }) }), _jsx(Field, { label: "Focus skills (optional)", hint: f.focus_skills.length ? "Training uses only these skills. Every skill is still evaluated, so you see the gain on the focus and any spill-over or regression elsewhere. The focus-skill gain becomes the preregistered primary result." : "None selected: train on every skill.", children: _jsx("div", { className: "flex flex-wrap gap-1.5", children: (cat.data?.skills?.catalog ?? []).map((k) => {
                                    const on = f.focus_skills.includes(k.id);
                                    return _jsx("button", { type: "button", "aria-pressed": on, onClick: () => setF({ ...f, focus_skills: on ? f.focus_skills.filter((x) => x !== k.id) : [...f.focus_skills, k.id] }), className: cx("rounded-[3px] border px-2 py-1 text-[11.5px] transition", on ? "border-accent bg-accent-soft text-ink" : "border-line text-ink-3 hover:text-ink"), children: k.label }, k.id);
                                }) }) })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx(Field, { label: "Min gain (prereg.)", children: _jsx("input", { className: inputCls, type: "number", step: "0.01", min: "0", max: "1", value: f.min_gain, onChange: (e) => setF({ ...f, min_gain: Number(e.target.value) }) }) }), _jsx(Field, { label: "Max steps", children: _jsx("input", { className: inputCls, type: "number", min: "1", placeholder: "profile", value: f.max_steps, onChange: (e) => setF({ ...f, max_steps: e.target.value }) }) }), _jsx(Field, { label: "Epochs", children: _jsx("input", { className: inputCls, type: "number", step: "0.5", placeholder: "profile", value: f.epochs, onChange: (e) => setF({ ...f, epochs: e.target.value }) }) }), _jsx(Field, { label: "Max seq len", children: _jsx("input", { className: inputCls, type: "number", step: "256", placeholder: "2048", value: f.max_seq_len, onChange: (e) => setF({ ...f, max_seq_len: e.target.value }) }) })] }), rd.data?.cpu_wiring_mode && _jsx(Field, { label: "Device", children: _jsx(Segmented, { label: "Device", value: f.device, onChange: (v) => setF({ ...f, device: v }), options: [{ value: "cuda", label: "cuda" }, { value: "cpu", label: "cpu (wiring only)" }] }) }), _jsx("div", { className: "text-[11.5px] leading-relaxed text-ink-3", children: "LoRA r=16, \u03B1=32, all linear, LR 2e-4 cosine, 3% warmup, micro-batch 1 \u00D7 accum 8, bf16, gradient checkpointing, thinking disabled." }), _jsx(Button, { type: "submit", tone: "primary", icon: "seal", busy: act.busy, disabled: !f.teacher_id || !f.student_id || !f.arms.length, children: "Freeze plan & create" }), _jsx(ErrorLine, { error: act.error })] })] }) }));
}
function StageStepper({ s, onRun, blocked, busyStage }) {
    const stages = Object.keys(STAGE_LABEL);
    const st = s.state.stages;
    return (_jsx("ol", { className: "grid grid-cols-2 gap-1.5 sm:grid-cols-5 2xl:grid-cols-10", children: stages.map((k, i) => {
            const status = st[k]?.status ?? (k === s.next_stage ? "ready" : "pending");
            const isNext = k === s.next_stage;
            const gpu = s.gpu_stages.includes(k) || k === "collect";
            const blk = blocked[k];
            return (_jsxs("li", { className: cx("relative flex flex-col rounded-[var(--radius)] border p-2 transition", status === "completed" ? "border-[color:var(--good)]/35 bg-[color:var(--good)]/[0.04]" : status === "failed" ? "border-[color:var(--crit)]/40" :
                    status === "running" ? "border-accent bg-accent-soft" : isNext ? "border-accent-line" : "border-line opacity-70"), children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("span", { className: "num font-mono text-[10px] text-ink-3", children: String(i).padStart(2, "0") }), gpu && _jsx(Icon, { name: "gpu", size: 12, className: "text-ink-3", title: "GPU-exclusive" })] }), _jsx("div", { className: "mt-1 text-[12px] font-medium text-ink", children: STAGE_LABEL[k] }), _jsx("div", { className: "mt-1", children: _jsx(Status, { s: status === "ready" ? "pending" : status, label: status === "ready" ? "ready" : undefined }) }), isNext && k !== "seal" && status !== "running" && (_jsx("div", { className: "mt-2", children: _jsx(Button, { size: "sm", tone: "primary", icon: "play", busy: busyStage === k, disabled: !!blk?.length, title: blk?.length ? `Blocked by: ${blk.join(", ")}` : STAGE_HINT[k], onClick: () => onRun(k), children: "Run" }) })), st[k]?.status === "failed" && _jsx("div", { className: "mt-1 line-clamp-3 font-mono text-[9.5px] text-crit-ink", title: st[k].error, children: st[k].error })] }, k));
        }) }));
}
function StudyView({ sid }) {
    const s = useApi(`/api/studies/${sid}`, 4000);
    const rd = useApi("/api/system/readiness", 20000);
    const act = useAction();
    const [jobId, setJobId] = useState(null);
    const [seal, setSeal] = useState("");
    const [busyStage, setBusyStage] = useState(null);
    const running = s.data?.jobs?.find((j) => j.status === "running");
    // Follow a running job; otherwise show the study's most recent job so the panel is never blank.
    const latest = s.data?.jobs?.[0];
    useEffect(() => { if (!jobId && (running ?? latest))
        setJobId((running ?? latest).id); }, [running, latest, jobId]);
    const reloadStudy = s.reload;
    const onDone = useCallback(() => { void reloadStudy(); }, [reloadStudy]);
    if (!s.data)
        return _jsxs(Panel, { children: [_jsx(ErrorLine, { error: s.error }), !s.error && _jsx("div", { className: "h-40" })] });
    const d = s.data, p = d.plan;
    const run = (stage, confirm) => void act.run(async () => {
        setBusyStage(stage);
        try {
            const j = await api.post(`/api/studies/${sid}/stages/${stage}`, { confirm });
            setJobId(j.id);
            await s.reload();
        }
        finally {
            setBusyStage(null);
        }
    });
    return (_jsxs("div", { className: "min-w-0 space-y-4 fit:flex fit:min-h-0 fit:flex-col fit:gap-3 fit:space-y-0", children: [_jsxs(Panel, { className: "fit:shrink-0", title: p.name, eyebrow: p.profile, prov: _jsx(Prov, { kind: "declared", source: "frozen plan" }), right: _jsxs(_Fragment, { children: [d.state.sealed && _jsxs(Badge, { tone: "accent", children: [_jsx(Icon, { name: "lock", size: 11 }), "sealed"] }), _jsx(Hash, { value: p.study_id, n: 18, label: "study id" })] }), children: [_jsx(StageStepper, { s: d, onRun: (k) => run(k), blocked: rd.data?.blocked_stages ?? {}, busyStage: busyStage }), d.next_stage && STAGE_HINT[d.next_stage] && _jsxs("div", { className: "mt-3 flex items-start gap-2 text-[12px] text-ink-2", children: [_jsx(Icon, { name: "info", size: 14, className: "mt-0.5 text-ink-3" }), _jsxs("span", { children: [_jsxs("b", { className: "font-medium text-ink", children: ["Next \u2014 ", STAGE_LABEL[d.next_stage], "."] }), " ", STAGE_HINT[d.next_stage]] })] }), d.next_stage && ["train", "evaluate_dev", "evaluate_test", "export"].includes(d.next_stage) && _jsx("div", { className: "mt-3", children: _jsx(TeacherGpu, { onFreed: () => { void rd.reload(); } }) }), d.next_stage === "seal" && (_jsxs("div", { className: "mt-3 flex flex-wrap items-end gap-2 rounded-[var(--radius)] border border-accent-line bg-accent-soft p-3", children: [_jsxs("div", { className: "min-w-[260px] flex-1 text-[12px] text-ink-2", children: [_jsx("b", { className: "text-ink", children: "Seal the study." }), " Adapters are frozen by sha256; build, train, and dev evaluation become impossible. Type ", _jsx("span", { className: "font-mono text-ink", children: "SEAL" }), " to confirm."] }), _jsx("input", { className: cx(inputCls, "w-28"), value: seal, onChange: (e) => setSeal(e.target.value), "aria-label": "Type SEAL", placeholder: "SEAL" }), _jsx(Button, { tone: "primary", icon: "seal", disabled: seal !== "SEAL", busy: busyStage === "seal", onClick: () => run("seal", "SEAL"), children: "Seal" })] })), _jsx("div", { className: "mt-3", children: _jsx(ErrorLine, { error: act.error }) })] }), _jsxs("div", { className: "space-y-4 fit:grid fit:min-h-0 fit:flex-1 fit:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] fit:gap-3 fit:space-y-0", children: [jobId ? _jsx(Panel, { fill: true, title: "Live job", eyebrow: "stdout \u00B7 json events", children: _jsx(JobLog, { fill: true, jobId: jobId, onDone: onDone }, jobId) })
                        : _jsx(Panel, { fill: true, title: "Live job", eyebrow: "stdout \u00B7 json events", children: _jsx(Empty, { icon: "play", children: "Run a stage \u2014 its JSON event stream appears here." }) }), _jsxs("div", { className: "grid gap-4 2xl:grid-cols-2 fit:flex fit:min-h-0 fit:flex-col fit:gap-3", children: [_jsx(Panel, { fill: true, title: "Frozen configuration", prov: _jsx(Prov, { kind: "declared" }), children: _jsx(KV, { rows: [
                                        ["teacher", `${p.teacher.model} · ${p.teacher.provider}`], ["endpoint", p.teacher.endpoint], ["student", p.student.name], ["student path", p.student.path],
                                        ["base sha256", _jsx(Hash, { value: p.base_hash, n: 20 }, "b")], ["engine sha256", _jsx(Hash, { value: p.engine_source_sha256, n: 20 }, "e")],
                                        ["taskset", _jsxs("span", { children: [p.taskset.version, " \u00B7 ", _jsx(Hash, { value: p.taskset.sha256, n: 12 })] }, "t")],
                                        ["tasks", Object.entries(p.taskset.counts).map(([k, v]) => `${k} ${v}`).join(" · ")],
                                        ["seeds", p.seeds.join(", ")], ["arms", p.arms.join(", ")], ["primary", p.primary_contrast], ["min gain", fmt.pp(p.min_gain, 0)],
                                        ["device", p.device], ["train", Object.entries(p.train).map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : v}`).join("  ")],
                                        ["environment", Object.entries(p.environment).map(([k, v]) => `${k}=${v}`).join("  ")],
                                    ] }) }), _jsx(Panel, { fill: true, flush: true, title: "Job history", right: _jsx("span", { className: "num font-mono text-[10.5px] text-ink-3", children: d.jobs?.length ?? 0 }), children: !d.jobs?.length ? _jsx(Empty, { children: "No jobs yet." }) : (_jsxs("table", { className: "w-full text-[12px]", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-surface-2", children: [_jsx("th", { className: th, children: "Stage" }), _jsx("th", { className: th, children: "Status" }), _jsx("th", { className: th, children: "Started" }), _jsx("th", { className: th, children: "Exit" })] }) }), _jsx("tbody", { children: d.jobs.map((j) => (_jsxs("tr", { className: cx(tr, "cursor-pointer", jobId === j.id && "!bg-accent-soft"), onClick: () => setJobId(j.id), children: [_jsx("td", { className: cx(td, "font-mono text-[11px]"), children: j.kind.replace("stage:", "") }), _jsx("td", { className: td, children: _jsx(Status, { s: j.status }) }), _jsx("td", { className: cx(td, "font-mono text-[11px] text-ink-3"), children: fmt.ago(j.started_at) }), _jsx("td", { className: cx(td, "num font-mono text-[11px]"), children: j.exit_code ?? "—" })] }, j.id))) })] })) })] })] })] }));
}
/** Student stages need the GPU the teacher occupies. Show LM Studio's live state and offer `lms unload --all`. */
function TeacherGpu({ onFreed }) {
    const st = useApi("/api/lmstudio/status", 5000);
    const act = useAction();
    const [done, setDone] = useState(null);
    const loaded = st.data?.loaded ?? [];
    if (!st.data)
        return null;
    if (!st.data.server_reachable || st.data.loaded === null) {
        return _jsxs(Notice, { tone: "info", children: ["LM Studio's server is not reachable at ", st.data.url, ", so nothing is loaded through it. If LM Studio is open with a model loaded in its chat window, eject it there before training."] });
    }
    if (loaded.length === 0) {
        return (_jsxs("div", { className: "flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-[color:var(--good)]/35 bg-[color:var(--good)]/[0.05] px-3 py-2.5 text-[12.5px] text-ink-2", children: [_jsx(Status, { s: "pass", label: "GPU free" }), _jsx("span", { children: "LM Studio reports no model loaded. Training and student evaluation can use the full GPU." }), done && _jsxs("span", { className: "font-mono text-[11px] text-ink-3", children: ["unloaded in ", (done.duration_ms / 1000).toFixed(1), " s"] })] }));
    }
    return (_jsxs("div", { className: "rounded-[var(--radius)] border border-[color:var(--warn)]/50 bg-[color:var(--warn)]/[0.07] p-3", children: [_jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3", children: [_jsxs("div", { className: "min-w-[260px] flex-1 text-[12.5px] leading-relaxed text-ink-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Status, { s: "warn", label: "teacher loaded" }), _jsx("span", { className: "font-mono text-[11.5px] text-ink", children: loaded.join(", ") })] }), _jsx("div", { className: "mt-1", children: "Teacher and student share one 16 GB GPU, so training refuses to start while this is loaded. Unloading only frees VRAM; nothing is deleted. Before a future Collect, load the teacher again in LM Studio (or let its just-in-time loading do it, if enabled)." })] }), st.data.cli_found ? (_jsx(Button, { tone: "primary", icon: "stop", busy: act.busy, onClick: () => void act.run(async () => { setDone(await api.post("/api/lmstudio/unload")); await st.reload(); onFreed(); }), children: "Unload teacher" })) : _jsxs("span", { className: "max-w-xs text-[11.5px] text-ink-3", children: ["The ", _jsx("span", { className: "font-mono", children: "lms" }), " CLI was not found. Eject the model in LM Studio, or set ", _jsx("span", { className: "font-mono", children: "FORGE_LMS_PATH" }), "."] })] }), st.data.cli_found && _jsxs("div", { className: "mt-2 font-mono text-[10.5px] text-ink-3", children: ["runs: ", st.data.unload_command, " \u00B7 ", st.data.cli_path] }), _jsx("div", { className: "mt-2", children: _jsx(ErrorLine, { error: act.error }) })] }));
}
