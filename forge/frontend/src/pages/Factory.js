import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { HeatStrip, Spectrum } from "../components/charts";
import { LineageGraph } from "../components/graphs";
import { StudySelect } from "../components/live";
import { Badge, Button, Empty, ErrorLine, Field, KV, Notice, PageHeader, Panel, Prov, Readout, Segmented, Status, cx, inputCls, td, th, tr } from "../components/ui";
import { api, fmt, qs } from "../lib/api";
import { useAction, useApi } from "../lib/hooks";
import { usePrefs } from "../lib/prefs";
export default function Factory() {
    const { prefs } = usePrefs();
    const sid = prefs.activeStudy;
    const s = useApi(sid ? `/api/studies/${sid}` : null);
    return (_jsxs("div", { className: "space-y-4", children: [_jsx(PageHeader, { kicker: "Research", title: "Model Factory", subtitle: "What the adapter actually changed, measured from its weights; the provenance of every artifact; and merged exports. Original weights are never modified \u2014 every derivative is a new hashed artifact.", right: _jsx(StudySelect, {}) }), !sid ? _jsx(Panel, { children: _jsx(Empty, { icon: "factory", children: "No study selected." }) }) : (_jsxs(_Fragment, { children: [s.data && _jsx(Inspector, { sid: sid, s: s.data }), s.data && _jsx(Lineage, { sid: sid }), s.data && _jsx(ExportPanel, { s: s.data })] })), _jsx(ManualInspect, {})] }));
}
function Inspector({ sid, s }) {
    const [arm, setArm] = useState(s.plan.arms[0]);
    const [seed, setSeed] = useState(s.plan.seeds[0]);
    const insp = useApi(`/api/studies/${sid}/inspection${qs({ arm, seed })}`);
    return (_jsx(Panel, { title: "Adapter inspector", prov: _jsx(Prov, { kind: "computed", source: "safetensors \u00B7 QR-core SVD" }), right: _jsxs("div", { className: "flex gap-2", children: [_jsx("select", { className: cx(inputCls, "h-7 w-auto"), value: arm, onChange: (e) => setArm(e.target.value), "aria-label": "Arm", children: s.plan.arms.map((a) => _jsx("option", { children: a }, a)) }), _jsx("select", { className: cx(inputCls, "h-7 w-auto"), value: seed, onChange: (e) => setSeed(Number(e.target.value)), "aria-label": "Seed", children: s.plan.seeds.map((x) => _jsxs("option", { value: x, children: ["seed ", x] }, x)) })] }), children: insp.error ? _jsx(Empty, { icon: "factory", children: insp.error }) : insp.data ? _jsx(InspectionView, { d: insp.data }) : _jsx("div", { className: "h-40" }) }));
}
export function InspectionView({ d }) {
    const [metric, setMetric] = useState(d.base_available ? "relative" : "fro");
    const [sel, setSel] = useState(null);
    const layers = useMemo(() => [...new Set(d.modules.map((m) => m.layer).filter((x) => x != null))].sort((a, b) => a - b), [d]);
    const kinds = useMemo(() => [...new Set(d.modules.map((m) => m.kind))], [d]);
    const cells = d.modules.filter((m) => m.layer != null).map((m) => ({ layer: m.layer, kind: m.kind, module: m.module, value: metric === "relative" ? m.relative_change : m.delta_fro }));
    const cur = d.modules.find((m) => m.module === sel) ?? [...d.modules].sort((a, b) => b.delta_fro - a.delta_fro)[0];
    const top = [...d.modules].sort((a, b) => (b.relative_change ?? b.delta_fro) - (a.relative_change ?? a.delta_fro)).slice(0, 8);
    return (_jsxs("div", { className: "space-y-5", children: [_jsxs("div", { className: "grid grid-cols-2 gap-4 md:grid-cols-5", children: [_jsx(Readout, { label: "rank r", value: d.r, size: "sm" }), _jsx(Readout, { label: "\u03B1 \u00B7 scale", value: `${d.alpha}`, unit: `s=${d.scale.toFixed(2)}${d.use_rslora ? " (rsLoRA)" : ""}`, size: "sm" }), _jsx(Readout, { label: "adapted modules", value: d.modules.length, size: "sm" }), _jsx(Readout, { label: "trainable params", value: fmt.exact(d.total_trainable_params), size: "sm" }), _jsx(Readout, { label: "mean eff. rank", value: (d.modules.reduce((a, m) => a + m.effective_rank, 0) / d.modules.length).toFixed(2), unit: `/ ${d.r}`, size: "sm" })] }), _jsxs("div", { children: [_jsxs("div", { className: "mb-2 flex flex-wrap items-center justify-between gap-2", children: [_jsx("span", { className: "micro text-ink-3", children: "Per-layer weight change \u00B7 layer \u00D7 module" }), _jsx(Segmented, { label: "Metric", value: metric, onChange: setMetric, options: [{ value: "relative", label: "‖ΔW‖/‖W‖" }, { value: "fro", label: "‖ΔW‖_F" }] })] }), metric === "relative" && !d.base_available && _jsx("div", { className: "mb-2 text-[11.5px] text-warn-ink", children: "Base weights unavailable \u2014 relative change cannot be computed." }), _jsx(HeatStrip, { cells: cells, layers: layers, kinds: kinds, metric: metric === "relative" ? "‖ΔW‖_F / ‖W‖_F" : "‖ΔW‖_F", onSelect: setSel, selected: cur?.module })] }), _jsxs("div", { className: "grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "micro mb-2 text-ink-3", children: "Largest changes" }), _jsx("div", { className: "scroll-thin overflow-x-auto", children: _jsxs("table", { className: "w-full text-[11.5px]", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { className: th, children: "Module" }), _jsx("th", { className: cx(th, "text-right"), children: "\u2016\u0394W\u2016_F" }), _jsx("th", { className: cx(th, "text-right"), children: "relative" }), _jsx("th", { className: cx(th, "text-right"), children: "eff. rank" })] }) }), _jsx("tbody", { children: top.map((m) => (_jsxs("tr", { onClick: () => setSel(m.module), className: cx(tr, "cursor-pointer", cur?.module === m.module && "!bg-accent-soft"), children: [_jsx("td", { className: cx(td, "font-mono text-[10.5px]"), children: m.module.replace(/^model\./, "") }), _jsx("td", { className: cx(td, "num text-right font-mono"), children: m.delta_fro.toExponential(3) }), _jsx("td", { className: cx(td, "num text-right font-mono"), children: m.relative_change == null ? "—" : m.relative_change.toExponential(2) }), _jsx("td", { className: cx(td, "num text-right font-mono"), children: m.effective_rank.toFixed(2) })] }, m.module))) })] }) })] }), cur && (_jsxs("div", { children: [_jsxs("div", { className: "micro mb-1 !normal-case !tracking-normal text-ink-3", children: ["Singular spectrum \u00B7 ", cur.module.replace(/^model\./, "")] }), _jsxs("div", { className: "mb-2 font-mono text-[10.5px] text-ink-3", children: ["shape ", cur.shape.join(" × "), " \u00B7 \u2016\u0394W\u2016_F ", cur.delta_fro.toExponential(3)] }), _jsx(Spectrum, { sigma: cur.singular_values, effRank: cur.effective_rank })] }))] }), _jsx("div", { className: "text-[11px] leading-relaxed text-ink-3", children: "\u0394W = s\u00B7B\u00B7A. \u03C3(\u0394W) is computed from the r\u00D7r core after thin QR of B and A\u1D40 \u2014 the full matrix is never materialized. \u2016\u0394W\u2016_F = \u221A\u03A3\u03C3\u00B2; effective rank = exp(H(\u03C3/\u03A3\u03C3)). These are measured weight changes, not explanations of behavior." })] }));
}
function Lineage({ sid }) {
    const g = useApi(`/api/studies/${sid}/lineage`, 15000);
    const [open, setOpen] = useState(null);
    const [text, setText] = useState(null);
    const act = useAction();
    const openNode = (n) => {
        setOpen(n);
        setText(null);
        if (!n.path)
            return;
        void act.run(async () => setText(await api.get(`/api/studies/${sid}/file${qs({ path: n.path.endsWith("adapter") ? n.path.replace(/adapter$/, "run.json") : n.path })}`)));
    };
    return (_jsxs(Panel, { title: "Lineage", prov: _jsx(Prov, { kind: "measured", source: "manifests on disk" }), right: _jsx("span", { className: "text-[11px] text-ink-3", children: "click a node to open its evidence" }), children: [g.data ? _jsx(LineageGraph, { g: g.data, onOpen: openNode }) : _jsx(ErrorLine, { error: g.error }), open && (_jsxs("div", { className: "mt-3 rounded-[var(--radius)] border border-line", children: [_jsxs("div", { className: "flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-1.5", children: [_jsx("span", { className: "font-mono text-[11px] text-ink-2", children: open.path ?? open.label }), open.digest && _jsxs("span", { className: "font-mono text-[10.5px] text-ink-3", children: ["sha ", open.digest] })] }), _jsx(ErrorLine, { error: act.error }), _jsx("pre", { className: "scroll-thin max-h-80 overflow-auto p-3 font-mono text-[10.5px] text-ink-2", children: open.path ? (text ?? "loading…") : "No file: this node is an external reference." })] }))] }));
}
function ExportPanel({ s }) {
    const st = s.state.stages.export;
    return (_jsx(Panel, { title: "Export", prov: _jsx(Prov, { kind: "declared" }), right: _jsx(Status, { s: st?.status ?? "pending" }), children: _jsxs("div", { className: "grid gap-4 md:grid-cols-[1fr_auto]", children: [_jsxs("div", { className: "space-y-2 text-[12px] text-ink-2", children: [_jsxs("p", { children: ["Export merges the primary arm's seed-0 adapter into a ", _jsx("b", { className: "text-ink", children: "new" }), " bf16 directory and immediately re-evaluates it on the test split. An export is only usable if its post-merge behaviour agrees with the adapter run."] }), st?.summary ? _jsx(KV, { rows: Object.entries(st.summary).map(([k, v]) => [k, typeof v === "number" ? (k.includes("agreement") ? fmt.pct(v) : String(v)) : String(v)]) }) : null, _jsx(Notice, { tone: "warn", children: "GGUF conversion and Ollama deployment are deferred until after the MVP. A merged export is not deployment approval." })] }), _jsxs("div", { className: "flex flex-col items-start gap-2", children: [_jsx(Badge, { children: s.state.sealed ? "sealed" : "requires SEAL + test analysis" }), _jsx(Button, { icon: "studio", onClick: () => { window.location.hash = "/studio"; }, children: "Run from Studio" })] })] }) }));
}
function ManualInspect() {
    const [path, setPath] = useState("");
    const [base, setBase] = useState("");
    const [d, setD] = useState(null);
    const act = useAction();
    const submit = (e) => { e.preventDefault(); void act.run(async () => setD(await api.get(`/api/analysis/adapter${qs({ path, base: base || undefined })}`))); };
    return (_jsxs(Panel, { title: "Inspect any adapter", eyebrow: "manual", prov: _jsx(Prov, { kind: "computed" }), children: [_jsxs("form", { onSubmit: submit, className: "grid gap-2 md:grid-cols-[1fr_1fr_auto] md:items-end", children: [_jsx(Field, { label: "Adapter directory", hint: "Under FORGE home or a registered model directory. safetensors only.", children: _jsx("input", { className: inputCls, value: path, onChange: (e) => setPath(e.target.value), placeholder: "C:\\\\\u2026\\\\adapter" }) }), _jsx(Field, { label: "Base model directory (optional)", children: _jsx("input", { className: inputCls, value: base, onChange: (e) => setBase(e.target.value), placeholder: "for \u2016\u0394W\u2016/\u2016W\u2016" }) }), _jsx(Button, { type: "submit", tone: "primary", disabled: !path, busy: act.busy, children: "Inspect" })] }), _jsx("div", { className: "mt-2", children: _jsx(ErrorLine, { error: act.error }) }), d && _jsx("div", { className: "mt-4", children: _jsx(InspectionView, { d: d }) })] }));
}
