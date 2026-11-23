import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useRef, useState } from "react";
import { Icon } from "../components/icons";
import { StudySelect } from "../components/live";
import { Badge, Button, Empty, ErrorLine, Hash, KV, Notice, PageHeader, Panel, Prov, Segmented, Skeleton, Toggle, cx, inputCls, td, th, tr } from "../components/ui";
import { fmt, qs } from "../lib/api";
import { useApi } from "../lib/hooks";
import { usePrefs } from "../lib/prefs";
const METRIC_LABEL = {
    strict_success: "Strict success", answer_correct: "Answer correct", tool_selection_correct: "Tool selection",
    argument_accuracy: "Argument accuracy", invalid_rate: "Invalid-call rate (lower is better)",
};
const KIND = {
    teacher: { color: "var(--s-teacher)", tag: "TEACHER" }, reference: { color: "var(--ink-3)", tag: "REFERENCE" },
    base: { color: "var(--s-base)", tag: "BASE STUDENT" }, tuned: { color: "var(--s-tuned)", tag: "TUNED STUDENT" },
    dataset: { color: "var(--seq-3)", tag: "DATASET" }, skill: { color: "var(--accent)", tag: "SKILL" }, tool: { color: "var(--ink-2)", tag: "TOOL" },
};
// Concrete font stacks (not CSS variables) so an exported SVG renders identically outside FORGE.
const MONO = "'JetBrains Mono','Cascadia Mono',Consolas,ui-monospace,monospace";
const SANS = "Inter,'Segoe UI Variable Text','Segoe UI',system-ui,sans-serif";
const NW = 200, NH = 58, COLW = 270, ROWH = 74, PADX = 20, PADY = 34;
const COL_TITLE = ["Sources", "Training data", "Tuned students", "Skills (measured)", "Tools"];
function sub(n) {
    switch (n.kind) {
        case "teacher": return [n.provider, n.params ? fmt.params(n.params) : null, n.quant].filter(Boolean).join(" · ");
        case "base": return [n.params ? fmt.params((n.unique_params ?? n.params)) : null, n.base_hash ? `sha ${String(n.base_hash).slice(0, 8)}` : null].filter(Boolean).join(" · ");
        case "tuned": return `${n.seeds_trained}/${n.seeds_planned} seeds · r=${n.rank}`;
        case "dataset": return n.built ? `${n.records} records · ${n.episodes} episodes` : "not built yet";
        case "skill": return n.ood ? "held-out wording" : String(n.family ?? "");
        case "tool": return "read-only";
        default: return "";
    }
}
function edgeStroke(e, nodes, metric, delta) {
    if (!e.measured)
        return { color: "var(--line-strong)", width: 1.2, dash: "4 4", opacity: 0.9 };
    if (e.kind === "requires")
        return { color: "var(--line-strong)", width: 1.2, opacity: 0.9 };
    if (e.kind !== "performs")
        return { color: "var(--ink-2)", width: 1.6, opacity: 0.85 };
    const src = nodes.get(e.from);
    if (delta) {
        const d = e.delta_vs_base?.[metric];
        if (d == null)
            return { color: KIND[src.kind].color, width: 1, opacity: 0.18 };
        const good = metric === "invalid_rate" ? d < 0 : d > 0;
        return { color: Math.abs(d) < 1e-9 ? "var(--div-mid)" : good ? "var(--div-pos)" : "var(--div-neg)", width: 1.2 + 9 * Math.abs(d), opacity: 0.85 };
    }
    const v = e.metrics?.[metric] ?? 0;
    return { color: KIND[src.kind].color, width: 0.8 + 7 * v, opacity: 0.25 + 0.6 * v };
}
function resolveVars(svg) {
    const cs = getComputedStyle(document.documentElement);
    const clone = svg.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("style", `background:${cs.getPropertyValue("--surface").trim()}`);
    return new XMLSerializer().serializeToString(clone).replace(/var\(--([\w-]+)\)/g, (_, v) => cs.getPropertyValue(`--${v}`).trim());
}
function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    Object.assign(document.createElement("a"), { href: url, download: name }).click();
    URL.revokeObjectURL(url);
}
export default function Knowledge() {
    const { prefs } = usePrefs();
    const sid = prefs.activeStudy;
    const [view, setView] = useState("auto");
    const [metric, setMetric] = useState("strict_success");
    const [delta, setDelta] = useState(false);
    const [showProv, setShowProv] = useState(true);
    const [showCap, setShowCap] = useState(true);
    const [sel, setSel] = useState(null);
    const g = useApi(sid ? `/api/studies/${sid}/knowledge${qs({ view })}` : null, 15000);
    const svgRef = useRef(null);
    const node = g.data?.nodes.find((n) => n.id === sel) ?? null;
    return (_jsxs("div", { className: "space-y-4 fit:flex fit:h-full fit:min-h-0 fit:flex-col fit:space-y-0", children: [_jsx(PageHeader, { kicker: "Research", title: "Knowledge Graph", subtitle: "Teacher, data, base and tuned students, skills, and tools \u2014 with measured capability on every edge. Built from the study's own files; nothing is inferred about concepts inside the weights.", right: _jsxs(_Fragment, { children: [_jsx(StudySelect, {}), _jsx(Segmented, { label: "Evaluation view", value: view, onChange: setView, options: [{ value: "auto", label: "auto" }, { value: "dev", label: "dev" }, { value: "heldout", label: "held-out" }] }), _jsx("select", { className: cx(inputCls, "h-8 !w-auto max-w-[260px] font-sans"), value: metric, onChange: (e) => setMetric(e.target.value), "aria-label": "Metric", children: Object.keys(METRIC_LABEL).map((m) => _jsx("option", { value: m, children: METRIC_LABEL[m] }, m)) }), _jsx(Toggle, { checked: delta, onChange: setDelta, label: "\u0394 vs base" })] }) }), _jsx(ErrorLine, { error: g.error }), !sid ? _jsx(Panel, { children: _jsx(Empty, { icon: "graph", children: "Select or create a study." }) }) : !g.data ? _jsx(Skeleton, { h: 480 }) : (_jsxs("div", { className: "grid gap-4 fit:min-h-0 fit:flex-1 fit:grid-cols-[minmax(0,1fr)_400px] 3xl:fit:grid-cols-[minmax(0,1fr)_460px]", children: [_jsxs("div", { className: "flex min-w-0 flex-col gap-4 fit:min-h-0 fit:gap-3", children: [_jsx(Panel, { fill: true, flush: true, className: "fit:flex-[3]", title: "Graph", prov: _jsx(Prov, { kind: "measured", source: `${g.data.view} · ${g.data.splits.join(" + ")}` }), right: _jsxs(_Fragment, { children: [_jsx(Toggle, { checked: showProv, onChange: setShowProv, label: "Lineage" }), _jsx(Toggle, { checked: showCap, onChange: setShowCap, label: "Capability" }), _jsx(Button, { size: "sm", icon: "download", onClick: () => svgRef.current && download(`forge-${g.data.study_id}-graph.svg`, resolveVars(svgRef.current), "image/svg+xml"), children: "SVG" }), _jsx(Button, { size: "sm", icon: "download", onClick: () => download(`forge-${g.data.study_id}-graph.json`, JSON.stringify(g.data, null, 2), "application/json"), children: "JSON" }), _jsxs("a", { className: "inline-flex h-7 items-center gap-1.5 rounded-[calc(var(--radius)-1px)] border border-line-strong px-2.5 text-[11.5px] font-medium text-ink hover:bg-accent-soft", href: `/api/studies/${sid}/knowledge${qs({ view, format: "graphml" })}`, download: true, children: [_jsx(Icon, { name: "download", size: 14 }), "GraphML"] })] }), children: _jsx(GraphCanvas, { g: g.data, metric: metric, delta: delta, showProv: showProv, showCap: showCap, sel: sel, onSelect: setSel, svgRef: svgRef }) }), _jsx(Panel, { fill: true, flush: true, className: "fit:flex-[2]", title: "Capability matrix", eyebrow: METRIC_LABEL[metric], prov: _jsx(Prov, { kind: "computed", source: "episodes pooled across seeds \u00B7 Wilson 95%" }), children: _jsx(Matrix, { g: g.data, metric: metric, onSelect: setSel, sel: sel }) })] }), _jsx(Panel, { fill: true, title: node ? node.label : "Inspector", eyebrow: node ? KIND[node.kind].tag : undefined, className: "fit:min-h-0", children: node ? _jsx(Inspector, { n: node, g: g.data, sid: sid, metric: metric }) : (_jsxs("div", { className: "space-y-3 text-[12.5px] text-ink-2", children: [_jsx("p", { children: "Click any node. Tuned students show what training changed: measured gains and regressions against the base, adapter statistics, and a token projection of the update directions." }), _jsx(Notice, { tone: "honesty", children: g.data.honesty }), _jsxs("div", { className: "text-[11.5px] text-ink-3", children: [g.data.provenance, "."] })] })) })] }))] }));
}
function GraphCanvas({ g, metric, delta, showProv, showCap, sel, onSelect, svgRef }) {
    const [hover, setHover] = useState(null);
    const [hoverEdge, setHoverEdge] = useState(null);
    const nodes = useMemo(() => new Map(g.nodes.map((n) => [n.id, n])), [g]);
    const W = PADX * 2 + (g.cols - 1) * COLW + NW, H = PADY + g.rows * ROWH + 8;
    const pos = (n) => ({ x: PADX + n.col * COLW, y: PADY + n.y * ROWH });
    const focus = hover ?? sel;
    const linked = useMemo(() => {
        if (!focus)
            return null;
        const s = new Set([focus]);
        g.edges.forEach((e) => { if (e.from === focus || e.to === focus) {
            s.add(e.from);
            s.add(e.to);
        } });
        return s;
    }, [focus, g]);
    const edges = g.edges.filter((e) => (e.kind === "performs" ? showCap : showProv));
    return (_jsxs("div", { className: "relative h-full min-h-[420px]", children: [_jsxs("svg", { ref: svgRef, viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "xMidYMid meet", className: "block h-full w-full", role: "img", "aria-label": "Study knowledge graph", onClick: () => onSelect(null), children: [COL_TITLE.slice(0, g.cols).map((t, i) => (_jsx("text", { x: PADX + i * COLW, y: 16, fontFamily: MONO, fontSize: 9.5, letterSpacing: "0.08em", fill: "var(--ink-3)", children: t.toUpperCase() }, t))), edges.map((e, i) => {
                        const a = nodes.get(e.from), b = nodes.get(e.to);
                        if (!a || !b)
                            return null;
                        const pa = pos(a), pb = pos(b);
                        const back = b.col <= a.col;
                        const x1 = pa.x + NW, y1 = pa.y + NH / 2, x2 = pb.x, y2 = pb.y + NH / 2;
                        const d = back ? `M${pa.x + NW / 2},${pa.y + NH} C${pa.x + NW / 2},${pa.y + NH + 40} ${pb.x + NW / 2},${pb.y - 40} ${pb.x + NW / 2},${pb.y}`
                            : `M${x1},${y1} C${x1 + (x2 - x1) * 0.45},${y1} ${x2 - (x2 - x1) * 0.45},${y2} ${x2},${y2}`;
                        const s = edgeStroke(e, nodes, metric, delta);
                        const dim = linked && !(linked.has(e.from) && linked.has(e.to)) ? 0.07 : s.opacity;
                        return (_jsxs("g", { onPointerEnter: () => setHoverEdge(e), onPointerLeave: () => setHoverEdge(null), children: [_jsx("path", { d: d, fill: "none", stroke: "transparent", strokeWidth: 12 }), _jsx("path", { d: d, fill: "none", stroke: s.color, strokeWidth: s.width, strokeDasharray: s.dash, opacity: dim, strokeLinecap: "round" })] }, i));
                    }), g.nodes.map((n) => {
                        const p = pos(n);
                        const k = KIND[n.kind];
                        const dim = linked && !linked.has(n.id);
                        const selected = sel === n.id;
                        return (_jsxs("g", { transform: `translate(${p.x},${p.y})`, opacity: dim ? 0.3 : 1, className: "cursor-pointer", onPointerEnter: () => setHover(n.id), onPointerLeave: () => setHover(null), onClick: (ev) => { ev.stopPropagation(); onSelect(n.id); }, role: "button", "aria-label": `${k.tag} ${n.label}`, children: [_jsx("rect", { width: NW, height: NH, rx: 6, fill: "var(--surface)", stroke: selected ? "var(--ink)" : "var(--line-strong)", strokeWidth: selected ? 1.8 : 1, strokeDasharray: n.kind === "reference" ? "4 3" : undefined }), _jsx("rect", { x: 0, y: 6, width: 3.5, height: NH - 12, rx: 1.75, fill: k.color }), _jsx("text", { x: 13, y: 16, fontFamily: MONO, fontSize: 8.5, letterSpacing: "0.08em", fill: "var(--ink-3)", children: k.tag }), _jsx("text", { x: 13, y: 33, fontFamily: SANS, fontSize: 12, fontWeight: 600, fill: "var(--ink)", children: n.label.length > 26 ? n.label.slice(0, 25) + "…" : n.label }), _jsx("text", { x: 13, y: 48, fontFamily: MONO, fontSize: 9.5, fill: "var(--ink-2)", children: sub(n).slice(0, 34) })] }, n.id));
                    })] }), _jsxs("div", { className: "pointer-events-none absolute bottom-2 left-3 right-3 flex flex-wrap items-end justify-between gap-2", children: [_jsxs("div", { className: "flex flex-wrap gap-x-3 gap-y-1 rounded bg-surface/90 px-2 py-1 text-[10.5px] text-ink-2 backdrop-blur", children: [["teacher", "base", "tuned"].map((k) => _jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx("span", { className: "h-[3px] w-4 rounded", style: { background: KIND[k].color } }), k] }, k)), delta ? _jsxs(_Fragment, { children: [_jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx("span", { className: "h-[3px] w-4 rounded bg-[color:var(--div-pos)]" }), "better than base"] }), _jsxs("span", { className: "inline-flex items-center gap-1", children: [_jsx("span", { className: "h-[3px] w-4 rounded bg-[color:var(--div-neg)]" }), "worse"] })] })
                                : _jsxs("span", { className: "text-ink-3", children: ["edge width = ", METRIC_LABEL[metric].toLowerCase()] }), _jsx("span", { className: "text-ink-3", children: "dashed = not produced / not measured yet" })] }), hoverEdge && (_jsxs("div", { className: "rounded border border-line-strong bg-surface px-2.5 py-1.5 font-mono text-[11px] text-ink shadow", children: [_jsxs("div", { className: "text-ink-3", children: [nodes.get(hoverEdge.from)?.label, " \u2192 ", nodes.get(hoverEdge.to)?.label] }), hoverEdge.kind === "performs" && hoverEdge.metrics ? (_jsxs("div", { className: "num", children: [METRIC_LABEL[metric].split(" (")[0], " ", fmt.pct(hoverEdge.metrics[metric], 1), hoverEdge.ci?.[metric] && ` [${fmt.pct(hoverEdge.ci[metric][0], 0)}–${fmt.pct(hoverEdge.ci[metric][1], 0)}]`, " \u00B7 n=", hoverEdge.n, hoverEdge.delta_vs_base && _jsxs(_Fragment, { children: [" \u00B7 \u0394 ", fmt.pp(hoverEdge.delta_vs_base[metric])] })] })) : _jsxs("div", { children: [hoverEdge.kind, " \u00B7 ", hoverEdge.label] })] }))] })] }));
}
function Matrix({ g, metric, onSelect, sel }) {
    const skills = g.nodes.filter((n) => n.kind === "skill");
    const models = g.nodes.filter((n) => ["teacher", "base", "tuned"].includes(n.kind));
    const cell = new Map(g.edges.filter((e) => e.kind === "performs").map((e) => [`${e.from}|${e.to}`, e]));
    return (_jsx("div", { className: "scroll-thin overflow-auto", children: _jsxs("table", { className: "w-full text-[12px]", children: [_jsx("thead", { className: "sticky top-0 z-10 bg-surface-2", children: _jsxs("tr", { children: [_jsx("th", { className: th, children: "Model" }), skills.map((s) => _jsx("th", { className: cx(th, "text-right"), title: s.label, children: s.label }, s.id))] }) }), _jsx("tbody", { children: models.map((m) => (_jsxs("tr", { onClick: () => onSelect(m.id), className: cx(tr, "cursor-pointer", sel === m.id && "!bg-accent-soft"), children: [_jsxs("td", { className: cx(td, "whitespace-nowrap"), children: [_jsx("span", { className: "mr-2 inline-block h-2 w-2 rounded-full align-middle", style: { background: KIND[m.kind].color } }), m.label] }), skills.map((s) => {
                                const e = cell.get(`${m.id}|${s.id}`);
                                const v = e?.metrics?.[metric];
                                const d = e?.delta_vs_base?.[metric];
                                return (_jsxs("td", { className: cx(td, "text-right"), title: e?.ci?.[metric] ? `Wilson 95% ${fmt.pct(e.ci[metric][0], 0)}–${fmt.pct(e.ci[metric][1], 0)} · n=${e.n}` : undefined, children: [v == null ? _jsx("span", { className: "text-ink-3", children: "\u2014" }) : (_jsxs("div", { className: "ml-auto flex w-[118px] items-center justify-end gap-2", children: [_jsx("span", { className: "h-[5px] flex-1 rounded-full bg-surface-3", children: _jsx("span", { className: "block h-full rounded-full", style: { width: `${v * 100}%`, background: KIND[m.kind].color } }) }), _jsx("span", { className: "num w-10 font-mono text-[11px] text-ink", children: fmt.pct(v, 0) })] })), d != null && Math.abs(d) > 1e-9 && _jsxs("div", { className: cx("num font-mono text-[10px]", (metric === "invalid_rate" ? d < 0 : d > 0) ? "text-[color:var(--div-pos)]" : "text-[color:var(--div-neg)]"), children: [fmt.pp(d, 0), " vs base"] })] }, s.id));
                            })] }, m.id))) })] }) }));
}
function Inspector({ n, g, sid, metric }) {
    const rows = [];
    const add = (k, v) => { if (v != null && v !== "")
        rows.push([k, typeof v === "number" ? (Number.isInteger(v) ? fmt.exact(v) : v.toExponential(3)) : String(v)]); };
    if (n.kind === "teacher") {
        add("provider", n.provider);
        add("endpoint", n.endpoint);
        add("parameters", n.params ? fmt.params(n.params) : null);
        add("quantization", n.quant);
        add("architecture", n.arch);
        add("context", n.context);
    }
    if (n.kind === "base") {
        add("stored params", n.params);
        add("unique params", n.unique_params);
        add("architecture", n.arch);
        rows.push(["base sha256", _jsx(Hash, { value: n.base_hash, n: 18 }, "h")]);
        add("path", n.path);
    }
    if (n.kind === "dataset") {
        add("policy", n.policy);
        add("records", n.records);
        add("episodes", n.episodes);
        rows.push(["sha256", _jsx(Hash, { value: n.sha256, n: 18 }, "h")]);
    }
    if (n.kind === "reference" || n.kind === "tool")
        add("note", n.note);
    const perf = g.edges.filter((e) => e.kind === "performs" && (e.from === n.id || e.to === n.id));
    return (_jsxs("div", { className: "space-y-4", children: [rows.length > 0 && _jsx(KV, { rows: rows }), n.kind === "tuned" && _jsx(TunedProfile, { n: n, sid: sid, measured: g.edges.some((e) => e.from === n.id && e.delta_vs_base) }), perf.length > 0 && (_jsxs("div", { children: [_jsxs("div", { className: "micro mb-1.5 text-ink-3", children: [n.kind === "skill" ? "Who performs this skill" : "Measured capability", " \u00B7 ", METRIC_LABEL[metric].split(" (")[0]] }), _jsx("ul", { className: "space-y-1.5", children: perf.map((e) => {
                            const other = g.nodes.find((x) => x.id === (n.kind === "skill" ? e.from : e.to));
                            const v = e.metrics[metric];
                            return (_jsxs("li", { className: "grid grid-cols-[minmax(0,1fr)_96px_52px] items-center gap-2 text-[11.5px]", children: [_jsx("span", { className: "truncate text-ink-2", title: other.label, children: other.label }), _jsx("span", { className: "h-[5px] rounded-full bg-surface-3", children: _jsx("span", { className: "block h-full rounded-full", style: { width: `${v * 100}%`, background: KIND[(n.kind === "skill" ? other : n).kind].color } }) }), _jsx("span", { className: "num text-right font-mono text-ink", children: fmt.pct(v, 0) })] }, e.from + e.to));
                        }) })] }))] }));
}
function TunedProfile({ n, sid, measured }) {
    const trained = n.trained_seeds ?? [];
    const seedsDone = trained.length;
    const [seed, setSeed] = useState(trained[0] ?? 0);
    const proj = useApi(seedsDone ? `/api/studies/${sid}/projection${qs({ arm: n.arm, seed, layers: 4, k: 10 })}` : null);
    const gains = n.gains ?? [];
    const regs = n.regressions ?? [];
    return (_jsxs("div", { className: "space-y-4", children: [_jsx("div", { children: _jsx(KV, { rows: [["arm", String(n.arm)], ["factor vs primary", Object.entries(n.factor).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`).join(" · ")], ["seeds trained", `${n.seeds_trained} / ${n.seeds_planned}`],
                        ["trainable params", fmt.exact(n.trainable_params)], [`tokens seen (s${trained[0] ?? 0})`, fmt.exact(n.tokens_seen)],
                        ["mean ‖ΔW‖/‖W‖", n.mean_relative_change != null ? n.mean_relative_change.toExponential(2) : "—"],
                        ["mean eff. rank", n.mean_effective_rank != null ? `${n.mean_effective_rank.toFixed(2)} / ${n.rank}` : "—"],
                        ["peak VRAM", n.peak_vram_mb ? fmt.mb(n.peak_vram_mb) : "—"]] }) }), _jsxs("div", { children: [_jsx("div", { className: "micro mb-1.5 text-ink-3", children: "After training \u00B7 strict success vs base" }), gains.length + regs.length === 0 ? _jsx("div", { className: "text-[12px] text-ink-3", children: measured ? "Measured: no difference from the base student on any skill in this view." : "Not evaluated on this view yet." }) : (_jsx("ul", { className: "space-y-1", children: [...gains, ...regs].map((x) => (_jsxs("li", { className: "flex items-center justify-between text-[12px]", children: [_jsx("span", { className: "text-ink-2", children: x.skill }), _jsx("span", { className: cx("num font-mono", x.delta > 0 ? "text-[color:var(--div-pos)]" : "text-[color:var(--div-neg)]"), children: fmt.pp(x.delta, 0) })] }, x.skill))) }))] }), _jsxs("div", { className: "border-t border-line pt-3", children: [_jsxs("div", { className: "mb-2 flex items-center justify-between gap-2", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "micro text-ink-3", children: "Token projection" }), _jsx(Prov, { kind: "computed", source: "heuristic \u00B7 from weights" })] }), seedsDone > 1 && _jsx("select", { className: cx(inputCls, "h-7 w-auto"), value: seed, onChange: (e) => setSeed(Number(e.target.value)), "aria-label": "Seed", children: trained.map((s) => _jsxs("option", { value: s, children: ["seed ", s] }, s)) })] }), !seedsDone ? _jsx("div", { className: "text-[12px] text-ink-3", children: "Train this arm to project its adapter." }) : proj.error ? _jsx(ErrorLine, { error: proj.error }) : !proj.data ? _jsx(Skeleton, { h: 160 }) : (_jsxs("div", { className: "space-y-3", children: [proj.data.modules.slice().reverse().map((m) => (_jsxs("div", { className: "rounded-[var(--radius)] border border-line p-2.5", children: [_jsxs("div", { className: "mb-1.5 flex items-baseline justify-between font-mono text-[10.5px]", children: [_jsxs("span", { className: "text-ink", children: ["L", m.layer, " \u00B7 ", m.kind] }), _jsxs("span", { className: "text-ink-3", children: ["\u03C3\u2081 ", m.sigma1.toExponential(2), " \u00B7 ", fmt.pct(m.energy_share, 0), " of energy"] })] }), ["plus", "minus"].map((end) => (_jsxs("div", { className: "mb-1 flex flex-wrap items-center gap-1", children: [_jsx("span", { className: "w-8 font-mono text-[10px] text-ink-3", children: end === "plus" ? "+u₁" : "−u₁" }), m[end].slice(0, 8).map((t) => (_jsxs("span", { title: `token id ${t.id} · z ${t.z.toFixed(1)}`, className: cx("rounded-[3px] border px-1.5 py-[1px] font-mono text-[10.5px]", t.special ? "border-accent-line text-accent" : "border-line-strong text-ink"), children: [t.token, _jsxs("span", { className: "ml-1 text-[9px] text-ink-3", children: [Math.abs(t.z).toFixed(0), "\u03C3"] })] }, t.id)))] }, end)))] }, m.module))), _jsx("ul", { className: "list-inside list-disc space-y-0.5 text-[11px] leading-snug text-ink-3", children: proj.data.caveats.map((c) => _jsx("li", { children: c }, c)) }), _jsxs("div", { className: "font-mono text-[10px] text-ink-3", children: [proj.data.method, " \u00B7 ", proj.data.unembedding, " \u00B7 vocab ", fmt.exact(proj.data.vocab_size)] }), _jsx(Badge, { children: proj.data.adapter_sha256.slice(0, 12) })] }))] })] }));
}
