import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from "react";
import { cx } from "./ui";
const NW = 158, NH = 62, GAP = 34;
function nodeText(n) {
    if (n.kind === "tool_call")
        return JSON.stringify(n.detail).replace(/[{}"]/g, "").replace(/,/g, " ").slice(0, 34);
    if (n.kind === "tool_result") {
        const d = n.detail;
        if (Array.isArray(d?.results))
            return `${d.results.length} passages · ${d.results.map((r) => r.id.split(":")[1]).join(",")}`;
        return d?.error ? String(d.error) : d?.total ? `total ${d.total}` : d?.unit_price ? `${d.name ?? ""} ${d.unit_price}` : "";
    }
    if (n.kind === "prompt")
        return String(n.detail ?? "").slice(0, 34) + (String(n.detail ?? "").length > 34 ? "…" : "");
    if (n.kind === "error")
        return String(n.detail ?? "").slice(0, 34);
    return "";
}
const KIND_LABEL = { prompt: "PROMPT", tool_call: "CALL", tool_result: "RESULT", answer: "ANSWER", error: "ERROR" };
function Node({ n, x, y, accent, selected, onClick }) {
    const stroke = n.status === "fail" ? "var(--crit)" : n.status === "pass" ? "var(--good)" : "var(--line-strong)";
    return (_jsxs("g", { transform: `translate(${x},${y})`, onClick: onClick, className: "cursor-pointer", role: "button", "aria-label": `${n.kind} ${n.label}`, children: [_jsx("rect", { width: NW, height: NH, rx: 5, fill: "var(--surface)", stroke: selected ? "var(--ink)" : stroke, strokeWidth: selected ? 1.75 : 1 }), _jsx("rect", { width: 3, height: NH - 10, x: 0, y: 5, rx: 1.5, fill: n.kind === "prompt" ? "var(--ink-3)" : accent }), _jsx("text", { x: 12, y: 16, className: "fill-[var(--ink-3)] font-mono text-[9px] tracking-[0.08em]", children: KIND_LABEL[n.kind] ?? n.kind }), n.status !== "neutral" && (_jsx("text", { x: NW - 10, y: 16, textAnchor: "end", className: cx("font-mono text-[10px]", n.status === "pass" ? "fill-[var(--good-ink)]" : "fill-[var(--crit-ink)]"), children: n.status === "pass" ? "✓ correct" : "✕ wrong" })), _jsx("text", { x: 12, y: 34, className: "fill-[var(--ink)] font-mono text-[12px] font-medium", children: n.label.slice(0, 18) }), _jsx("text", { x: 12, y: 50, className: "fill-[var(--ink-2)] font-mono text-[10px]", children: nodeText(n) })] }));
}
function Edge({ x1, x2, y }) {
    return (_jsxs("g", { children: [_jsx("path", { d: `M${x1},${y} C${x1 + GAP / 2},${y} ${x2 - GAP / 2},${y} ${x2 - 5},${y}`, fill: "none", stroke: "var(--line-strong)", strokeWidth: 1.25 }), _jsx("path", { d: `M${x2 - 6},${y - 3.5} L${x2},${y} L${x2 - 6},${y + 3.5}`, fill: "var(--line-strong)" })] }));
}
export function PathGraph({ g, accent = "var(--s-tuned)", onSelect, selected }) {
    const W = g.nodes.length * (NW + GAP), H = NH + 8;
    return (_jsx("div", { className: "scroll-thin overflow-x-auto", children: _jsx("svg", { viewBox: `0 0 ${W} ${H}`, style: { width: W }, role: "img", "aria-label": `Path graph for ${g.task_id}`, children: g.nodes.map((n, i) => (_jsxs("g", { children: [i > 0 && _jsx(Edge, { x1: (i - 1) * (NW + GAP) + NW + 2, x2: i * (NW + GAP), y: 4 + NH / 2 }), _jsx(Node, { n: n, x: i * (NW + GAP) + 1, y: 4, accent: accent, selected: selected === n.id, onClick: () => onSelect?.(n) })] }, n.id))) }) }));
}
const LANES = {
    teacher: { color: "var(--s-teacher)", label: "Teacher" }, base: { color: "var(--s-base)", label: "Base student" },
    tuned: { color: "var(--s-tuned)", label: "Tuned student" },
};
/** Index of the node that carries action `k` (tool calls, answer, error are actions). */
function actionNodeIndex(g, k) {
    const idx = g.nodes.map((n, i) => (["tool_call", "answer", "error"].includes(n.kind) ? i : -1)).filter((i) => i >= 0);
    return k < idx.length ? idx[k] : g.nodes.length;
}
export function PathCompare({ c, onSelect }) {
    const [sel, setSel] = useState(null);
    const maxN = Math.max(1, ...c.lanes.map((l) => l.graph?.nodes.length ?? 0));
    const LW = 120, laneH = NH + 30;
    const W = LW + maxN * (NW + GAP), H = c.lanes.length * laneH + 10;
    return (_jsx("div", { className: "scroll-thin overflow-x-auto", children: _jsx("svg", { viewBox: `0 0 ${W} ${H}`, style: { width: W }, role: "img", "aria-label": `Teacher, base, and tuned paths for ${c.task_id}`, children: c.lanes.map((lane, li) => {
                const y0 = li * laneH + 6;
                const meta = LANES[lane.lane];
                const g = lane.graph;
                const div = g && lane.divergence_from_teacher != null ? actionNodeIndex(g, lane.divergence_from_teacher) : null;
                return (_jsxs("g", { children: [_jsx("rect", { x: 0, y: y0 - 2, width: W, height: laneH - 6, rx: 4, fill: li % 2 ? "transparent" : "var(--surface-2)" }), _jsx("rect", { x: 6, y: y0 + 8, width: 3, height: NH - 16, rx: 1.5, fill: meta.color }), _jsx("text", { x: 16, y: y0 + 22, className: "fill-[var(--ink)] text-[12px] font-semibold", children: meta.label }), _jsx("text", { x: 16, y: y0 + 38, className: "fill-[var(--ink-3)] font-mono text-[10px]", children: g ? (g.strict_success ? "✓ strict success" : "✕ not strict") : "not run" }), g && lane.lane !== "teacher" && (_jsx("text", { x: 16, y: y0 + 52, className: "fill-[var(--ink-3)] font-mono text-[10px]", children: lane.divergence_from_teacher == null ? "= teacher path" : `diverges @ action ${lane.divergence_from_teacher + 1}` })), g?.nodes.map((n, i) => (_jsxs("g", { children: [i > 0 && _jsx(Edge, { x1: LW + (i - 1) * (NW + GAP) + NW + 2, x2: LW + i * (NW + GAP), y: y0 + 4 + NH / 2 }), _jsx(Node, { n: n, x: LW + i * (NW + GAP), y: y0 + 4, accent: meta.color, selected: sel === `${lane.lane}:${n.id}`, onClick: () => { setSel(`${lane.lane}:${n.id}`); onSelect?.(lane.lane, n); } })] }, n.id))), div != null && (_jsxs("g", { children: [_jsx("line", { x1: LW + div * (NW + GAP) - GAP / 2, x2: LW + div * (NW + GAP) - GAP / 2, y1: y0, y2: y0 + NH + 10, stroke: "var(--crit)", strokeWidth: 1.5 }), _jsx("text", { x: LW + div * (NW + GAP) - GAP / 2 + 4, y: y0 + NH + 18, className: "fill-[var(--crit-ink)] font-mono text-[9.5px]", children: "first divergence" })] }))] }, lane.lane));
            }) }) }));
}
const LKIND = { base_model: "BASE MODEL", teacher: "TEACHER", plan: "FROZEN PLAN", dataset: "DATASET", config: "CONFIG", adapter: "ADAPTER", report: "REPORT", export: "MERGED EXPORT" };
export function LineageGraph({ g, onOpen }) {
    const BW = 176, BH = 56;
    const pos = new Map(g.nodes.map((n) => [n.id, n]));
    const W = g.width + 20, H = g.height + 10;
    return (_jsx("div", { className: "scroll-thin overflow-x-auto", children: _jsxs("svg", { viewBox: `0 0 ${W} ${H}`, style: { width: Math.max(W, 600) }, role: "img", "aria-label": "Artifact lineage", children: [g.edges.map((e, i) => {
                    const a = pos.get(e.from), b = pos.get(e.to);
                    if (!a || !b)
                        return null;
                    const x1 = a.x + BW + 4, y1 = a.y + BH / 2 + 4, x2 = b.x + 4, y2 = b.y + BH / 2 + 4;
                    return _jsx("path", { d: `M${x1},${y1} C${x1 + 14},${y1} ${x2 - 14},${y2} ${x2},${y2}`, fill: "none", stroke: "var(--line-strong)", strokeWidth: 1.2 }, i);
                }), g.nodes.map((n) => (_jsxs("g", { transform: `translate(${n.x + 4},${n.y + 4})`, onClick: () => onOpen?.(n), className: n.path ? "cursor-pointer" : "", role: "button", "aria-label": `${n.kind} ${n.label}`, children: [_jsx("rect", { width: BW, height: BH, rx: 5, fill: "var(--surface)", stroke: n.exists || n.kind === "teacher" ? "var(--line-strong)" : "var(--line)", strokeDasharray: n.exists || n.kind === "teacher" ? undefined : "3 3" }), _jsx("text", { x: 10, y: 15, className: "fill-[var(--ink-3)] font-mono text-[8.5px] tracking-[0.08em]", children: LKIND[n.kind] ?? n.kind }), _jsx("text", { x: 10, y: 32, className: "fill-[var(--ink)] text-[11.5px] font-medium", children: n.label.slice(0, 24) }), _jsx("text", { x: 10, y: 47, className: "fill-[var(--ink-2)] font-mono text-[9.5px]", children: n.digest ? `sha ${n.digest.slice(0, 14)}` : n.exists ? "" : n.kind === "teacher" ? "external · served by provider" : "not produced yet" })] }, n.id)))] }) }));
}
