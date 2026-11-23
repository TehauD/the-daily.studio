import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmt } from "../lib/api";
import { useChartVars, usePrefs } from "../lib/prefs";
import { cx } from "./ui";
/* ------------------------------------------------------------- shared */
export function useTooltipStyle() {
    const v = useChartVars();
    return {
        contentStyle: { background: v.surface, border: `1px solid ${v["line-strong"]}`, borderRadius: 4, fontSize: 11.5,
            fontFamily: "var(--font-mono)", boxShadow: "0 4px 16px rgb(0 0 0 / .08)", padding: "6px 9px" },
        labelStyle: { color: v["ink-3"], marginBottom: 2 }, itemStyle: { color: v.ink, padding: 0 },
        cursor: { stroke: v["line-strong"], strokeWidth: 1 },
    };
}
export function LegendKey({ items }) {
    return (_jsx("div", { className: "flex flex-wrap items-center gap-x-4 gap-y-1", children: items.map((i) => (_jsxs("span", { className: "inline-flex items-center gap-1.5 text-[11.5px] text-ink-2", children: [_jsx("svg", { width: "16", height: "8", "aria-hidden": true, children: _jsx("line", { x1: "0", x2: "16", y1: "4", y2: "4", stroke: i.color, strokeWidth: "2", strokeDasharray: i.dashed ? "3 2" : undefined, strokeLinecap: "round" }) }), i.label] }, i.label))) }));
}
/* ------------------------------------------------------------- telemetry small multiple */
export function TraceStrip({ title, unit, values, times, max = 100, current, sub }) {
    const [hover, setHover] = useState(null);
    const W = 320, H = 64;
    const n = values.length;
    const x = (i) => (n <= 1 ? W : (i / (n - 1)) * W);
    const y = (v) => H - 2 - (Math.min(v, max) / max) * (H - 6);
    let d = "", area = "";
    values.forEach((v, i) => {
        if (v == null)
            return;
        const seg = values[i - 1] == null ? "M" : "L";
        d += `${seg}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    });
    const firstIdx = values.findIndex((v) => v != null);
    const lastIdx = n - 1 - [...values].reverse().findIndex((v) => v != null);
    if (firstIdx >= 0 && values.every((v, i) => i < firstIdx || i > lastIdx || v != null))
        area = `${d}L${x(lastIdx)},${H}L${x(firstIdx)},${H}Z`;
    const hv = hover != null ? values[hover] : null;
    return (_jsxs("div", { className: "min-w-0", children: [_jsxs("div", { className: "mb-1.5 flex items-baseline justify-between gap-2", children: [_jsx("span", { className: "micro text-ink-3", children: title }), _jsxs("span", { className: "num font-mono text-[15px] font-medium text-ink", children: [hover != null ? (hv == null ? "—" : hv.toFixed(0)) : current, _jsx("span", { className: "ml-0.5 text-[10.5px] text-ink-3", children: unit })] })] }), _jsxs("svg", { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: "none", className: "h-16 w-full touch-none", role: "img", "aria-label": `${title} trace`, onPointerMove: (e) => { const r = e.currentTarget.getBoundingClientRect(); setHover(Math.round(((e.clientX - r.left) / r.width) * (n - 1))); }, onPointerLeave: () => setHover(null), children: [[0.25, 0.5, 0.75].map((f) => _jsx("line", { x1: 0, x2: W, y1: y(max * f), y2: y(max * f), stroke: "var(--line)", strokeWidth: 1, vectorEffect: "non-scaling-stroke" }, f)), area && _jsx("path", { d: area, fill: "var(--accent)", opacity: 0.08 }), _jsx("path", { d: d, fill: "none", stroke: "var(--accent)", strokeWidth: 1.6, vectorEffect: "non-scaling-stroke", strokeLinejoin: "round" }), hover != null && _jsx("line", { x1: x(hover), x2: x(hover), y1: 0, y2: H, stroke: "var(--line-strong)", vectorEffect: "non-scaling-stroke" })] }), _jsxs("div", { className: "mt-1 flex justify-between font-mono text-[10px] text-ink-3", children: [_jsx("span", { children: hover != null && times[hover] ? new Date(times[hover] * 1000).toLocaleTimeString() : times[0] ? `−${Math.round((times[n - 1] - times[0]))}s` : "" }), _jsx("span", { children: sub })] })] }));
}
/* ------------------------------------------------------------- learning curves */
export function LearningCurve({ rows }) {
    const v = useChartVars();
    const tt = useTooltipStyle();
    const { prefs } = usePrefs();
    const data = rows.filter((r) => r.loss != null || r.eval_loss != null).map((r) => ({
        step: r.step, train: r.loss ?? null, eval: r.eval_loss ?? null
    }));
    const objective = rows.find((r) => r.objective)?.objective ?? "completion_ce";
    const hasEval = data.some((d) => d.eval != null);
    return (_jsxs("div", { children: [_jsxs("div", { className: "mb-2 flex flex-wrap items-center justify-between gap-2", children: [_jsx(LegendKey, { items: [{ label: "train loss", color: v["s-teacher"] }, ...(hasEval ? [{ label: "dev loss (teacher successes)", color: v["s-tuned"] }] : [])] }), _jsxs("span", { className: "micro text-ink-3", children: ["objective \u00B7 ", objective === "all_token_ce" ? "all-token CE (not comparable to completion-only)" : "completion-only CE"] })] }), _jsx("div", { className: "h-56", children: _jsx(ResponsiveContainer, { children: _jsxs(LineChart, { data: data, margin: { top: 6, right: 12, left: -6, bottom: 0 }, children: [_jsx(CartesianGrid, { stroke: v.line, vertical: false }), _jsx(XAxis, { dataKey: "step", tick: { fill: v["ink-3"], fontSize: 10.5, fontFamily: "var(--font-mono)" }, stroke: v["line-strong"], tickLine: false }), _jsx(YAxis, { tick: { fill: v["ink-3"], fontSize: 10.5, fontFamily: "var(--font-mono)" }, stroke: v["line-strong"], tickLine: false, width: 48, tickFormatter: (x) => x.toFixed(2) }), _jsx(Tooltip, { ...tt, formatter: (x) => x?.toFixed(4), labelFormatter: (s) => `step ${s}` }), _jsx(Legend, { content: () => null }), _jsx(Line, { type: "monotone", dataKey: "train", stroke: v["s-teacher"], strokeWidth: 2, dot: false, connectNulls: true, isAnimationActive: prefs.chartAnimation }), hasEval && _jsx(Line, { type: "monotone", dataKey: "eval", stroke: v["s-tuned"], strokeWidth: 2, dot: { r: 3.5, strokeWidth: 0, fill: v["s-tuned"] }, connectNulls: true, isAnimationActive: prefs.chartAnimation })] }) }) })] }));
}
export function ForestPlot({ rows, minGain, domain }) {
    const [hover, setHover] = useState(null);
    const ext = Math.max(0.1, ...rows.flatMap((r) => [Math.abs(r.lo), Math.abs(r.hi)]), minGain ?? 0);
    const [d0, d1] = domain ?? [-Math.min(1, ext * 1.15), Math.min(1, ext * 1.15)];
    const L = 210, R = 150, W = 760, rowH = 34, top = 26;
    const H = top + rows.length * rowH + 22;
    const x = (val) => L + ((val - d0) / (d1 - d0)) * (W - L - R);
    const ticks = niceTicks(d0, d1, 5);
    const color = (r) => (r.lo > 0 ? "var(--div-pos)" : r.hi < 0 ? "var(--div-neg)" : "var(--ink-3)");
    return (_jsx("div", { className: "scroll-thin overflow-x-auto", children: _jsxs("svg", { viewBox: `0 0 ${W} ${H}`, className: "w-full min-w-[560px] max-w-[1040px]", role: "img", "aria-label": "Paired effect estimates with 95% confidence intervals", children: [_jsx("text", { x: L, y: 12, className: "fill-[var(--ink-3)] font-mono text-[10px]", children: "\u0394 strict success (arm \u2212 base), 95% CI" }), _jsx("text", { x: W - R + 12, y: 12, className: "fill-[var(--ink-3)] font-mono text-[10px]", children: "mean [CI]" }), ticks.map((t) => (_jsxs("g", { children: [_jsx("line", { x1: x(t), x2: x(t), y1: top - 6, y2: H - 18, stroke: "var(--line)" }), _jsxs("text", { x: x(t), y: H - 4, textAnchor: "middle", className: "num fill-[var(--ink-3)] font-mono text-[10px]", children: [t > 0 ? "+" : "", (t * 100).toFixed(0)] })] }, t))), _jsx("line", { x1: x(0), x2: x(0), y1: top - 8, y2: H - 18, stroke: "var(--div-mid)", strokeWidth: 1.5 }), minGain != null && minGain > 0 && minGain < d1 && (_jsxs("g", { children: [_jsx("line", { x1: x(minGain), x2: x(minGain), y1: top - 8, y2: H - 18, stroke: "var(--accent)", strokeWidth: 1 }), _jsxs("text", { x: x(minGain) + 4, y: top - 1, className: "fill-[var(--accent)] font-mono text-[9.5px]", children: ["min gain ", (minGain * 100).toFixed(0), "pp"] })] })), rows.map((r, i) => {
                    const cy = top + i * rowH + rowH / 2;
                    const on = hover === r.key;
                    return (_jsxs("g", { onPointerEnter: () => setHover(r.key), onPointerLeave: () => setHover(null), children: [_jsx("rect", { x: 0, y: cy - rowH / 2, width: W, height: rowH, fill: on ? "var(--surface-2)" : "transparent" }), _jsx("text", { x: 8, y: cy - 2, className: "fill-[var(--ink)] text-[12px]", children: r.label }), r.sub && _jsx("text", { x: 8, y: cy + 11, className: "fill-[var(--ink-3)] font-mono text-[9.5px]", children: r.sub }), _jsx("line", { x1: x(r.lo), x2: x(r.hi), y1: cy, y2: cy, stroke: color(r), strokeWidth: 2, strokeLinecap: "round" }), _jsx("line", { x1: x(r.lo), x2: x(r.lo), y1: cy - 5, y2: cy + 5, stroke: color(r), strokeWidth: 1.5 }), _jsx("line", { x1: x(r.hi), x2: x(r.hi), y1: cy - 5, y2: cy + 5, stroke: color(r), strokeWidth: 1.5 }), _jsx("rect", { x: x(r.mean) - 5, y: cy - 5, width: 10, height: 10, transform: `rotate(45 ${x(r.mean)} ${cy})`, fill: color(r), stroke: "var(--surface)", strokeWidth: 2 }), _jsxs("text", { x: W - R + 12, y: cy + 4, className: "num fill-[var(--ink)] font-mono text-[11px]", children: [fmt.pp(r.mean), " ", _jsxs("tspan", { className: "fill-[var(--ink-3)]", children: ["[", (r.lo * 100).toFixed(1), ", ", (r.hi * 100).toFixed(1), "]"] })] })] }, r.key));
                })] }) }));
}
export function niceTicks(a, b, n) {
    const span = b - a;
    const step0 = span / n;
    const mag = 10 ** Math.floor(Math.log10(step0));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0) ?? step0;
    const out = [];
    for (let t = Math.ceil(a / step) * step; t <= b + 1e-9; t += step)
        out.push(Math.round(t * 1e6) / 1e6);
    return out;
}
export function SkillMap({ families }) {
    const [hover, setHover] = useState(null);
    const rings = [
        { key: "teacher", r: 40, color: "var(--s-teacher)" }, { key: "base", r: 31, color: "var(--s-base)" }, { key: "tuned", r: 22, color: "var(--s-tuned)" }
    ];
    const arc = (r, frac) => {
        if (frac <= 0)
            return "";
        if (frac >= 0.9999)
            return `M 0 ${-r} A ${r} ${r} 0 1 1 -0.01 ${-r}`;
        const a = frac * Math.PI * 2;
        return `M 0 ${-r} A ${r} ${r} 0 ${frac > 0.5 ? 1 : 0} 1 ${(r * Math.sin(a)).toFixed(2)} ${(-r * Math.cos(a)).toFixed(2)}`;
    };
    return (_jsxs("div", { children: [_jsx(LegendKey, { items: [{ label: "teacher (outer)", color: "var(--s-teacher)" }, { label: "base student", color: "var(--s-base)" }, { label: "tuned student (inner)", color: "var(--s-tuned)" }] }), _jsx("div", { className: "mt-3 grid grid-cols-[repeat(auto-fill,minmax(176px,1fr))] gap-3", children: families.map((f) => {
                    const delta = f.tuned && f.base ? f.tuned.rate - f.base.rate : null;
                    return (_jsxs("div", { onPointerEnter: () => setHover(f.family), onPointerLeave: () => setHover(null), className: cx("rounded-[var(--radius)] border p-3 transition", hover === f.family ? "border-accent-line bg-surface-2" : "border-line"), children: [_jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsx("span", { className: "font-mono text-[11.5px] text-ink", children: f.family }), delta != null && _jsx("span", { className: cx("num font-mono text-[11.5px]", delta > 0 ? "text-[color:var(--div-pos)]" : delta < 0 ? "text-[color:var(--div-neg)]" : "text-ink-3"), children: fmt.pp(delta, 0) })] }), _jsxs("div", { className: "mt-1 flex items-center gap-3", children: [_jsx("svg", { viewBox: "-48 -48 96 96", className: "h-24 w-24 shrink-0", role: "img", "aria-label": `${f.family} success rates`, children: rings.map((g) => (_jsxs("g", { children: [_jsx("circle", { r: g.r, fill: "none", stroke: "var(--surface-3)", strokeWidth: 6 }), f[g.key] && _jsx("path", { d: arc(g.r, f[g.key].rate), fill: "none", stroke: g.color, strokeWidth: 6, strokeLinecap: "round" })] }, g.key))) }), _jsx("dl", { className: "num space-y-1 font-mono text-[10.5px]", children: rings.map((g) => (_jsxs("div", { className: "flex items-center gap-1.5", title: f[g.key] ? `Wilson 95% CI ${fmt.pct(f[g.key].ci[0], 0)}–${fmt.pct(f[g.key].ci[1], 0)} · n=${f[g.key].n}` : "not measured", children: [_jsx("span", { className: "inline-block h-1.5 w-1.5 rounded-full", style: { background: g.color } }), _jsx("dt", { className: "w-12 text-ink-3", children: g.key }), _jsx("dd", { className: "text-ink", children: f[g.key] ? fmt.pct(f[g.key].rate, 0) : "—" })] }, g.key))) })] })] }, f.family));
                }) })] }));
}
/* ------------------------------------------------------------- weight-change heat strip */
export function HeatStrip({ cells, layers, kinds, metric, onSelect, selected }) {
    const [hover, setHover] = useState(null);
    const vals = cells.map((c) => c.value).filter((v) => v != null);
    const max = Math.max(1e-12, ...vals);
    const ramp = ["var(--seq-0)", "var(--seq-1)", "var(--seq-2)", "var(--seq-3)", "var(--seq-4)"];
    const color = (v) => (v == null ? "var(--surface-3)" : ramp[Math.min(4, Math.floor((v / max) * 4.999))]);
    const map = useMemo(() => new Map(cells.map((c) => [`${c.layer}|${c.kind}`, c])), [cells]);
    const cw = Math.max(10, Math.min(26, 720 / Math.max(1, layers.length)));
    const W = 92 + layers.length * cw, H = 18 + kinds.length * 22;
    return (_jsxs("div", { children: [_jsx("div", { className: "scroll-thin overflow-x-auto", children: _jsxs("svg", { viewBox: `0 0 ${W} ${H}`, style: { width: W, maxWidth: "none" }, role: "img", "aria-label": `Per-layer ${metric}`, children: [kinds.map((k, ki) => (_jsxs("g", { children: [_jsx("text", { x: 84, y: 14 + ki * 22 + 13, textAnchor: "end", className: "fill-[var(--ink-2)] font-mono text-[10px]", children: k }), layers.map((l, li) => {
                                    const c = map.get(`${l}|${k}`);
                                    return (_jsx("rect", { x: 92 + li * cw, y: 14 + ki * 22, width: cw - 2, height: 20, rx: 2, fill: color(c?.value ?? null), stroke: c && selected === c.module ? "var(--ink)" : "none", strokeWidth: 1.5, className: c ? "cursor-pointer" : "", onPointerEnter: () => c && setHover({ module: c.module, value: c.value, layer: l, kind: k }), onPointerLeave: () => setHover(null), onClick: () => c && onSelect?.(c.module) }, l));
                                })] }, k))), layers.map((l, li) => (li % Math.ceil(layers.length / 14) === 0 ? (_jsx("text", { x: 92 + li * cw + (cw - 2) / 2, y: 10, textAnchor: "middle", className: "num fill-[var(--ink-3)] font-mono text-[9px]", children: l }, l)) : null))] }) }), _jsxs("div", { className: "mt-2 flex flex-wrap items-center justify-between gap-2", children: [_jsxs("div", { className: "flex items-center gap-2 font-mono text-[10px] text-ink-3", children: [_jsx("span", { children: "0" }), _jsx("span", { className: "flex h-2 w-28 overflow-hidden rounded-sm", children: ramp.map((c) => _jsx("span", { className: "flex-1", style: { background: c } }, c)) }), _jsx("span", { children: max.toExponential(2) }), _jsxs("span", { children: ["\u00B7 ", metric] })] }), _jsx("span", { className: "num font-mono text-[11px] text-ink-2", children: hover ? `L${hover.layer} ${hover.kind} · ${hover.value == null ? "—" : hover.value.toExponential(3)}` : "hover a cell · click to inspect" })] })] }));
}
/* ------------------------------------------------------------- singular spectrum */
export function Spectrum({ sigma, effRank }) {
    const max = Math.max(1e-12, ...sigma);
    const W = 320, H = 120, bw = W / Math.max(1, sigma.length);
    const total = sigma.reduce((a, b) => a + b * b, 0);
    let cum = 0;
    const cumPts = sigma.map((s, i) => { cum += s * s; return `${i ? "L" : "M"}${(i + 0.5) * bw},${H - (cum / total) * (H - 8)}`; }).join("");
    return (_jsx("div", { children: _jsxs("svg", { viewBox: `0 0 ${W} ${H + 16}`, className: "w-full", role: "img", "aria-label": "Singular value spectrum", children: [_jsx("line", { x1: 0, x2: W, y1: H, y2: H, stroke: "var(--line-strong)" }), sigma.map((s, i) => _jsx("rect", { x: i * bw + 1, y: H - (s / max) * (H - 8), width: Math.max(1, bw - 2), height: (s / max) * (H - 8), rx: Math.min(3, bw / 4), fill: "var(--seq-2)" }, i)), _jsx("path", { d: cumPts, fill: "none", stroke: "var(--ink-2)", strokeWidth: 1.25 }), _jsx("line", { x1: (effRank) * bw, x2: effRank * bw, y1: 4, y2: H, stroke: "var(--accent)" }), _jsxs("text", { x: effRank * bw > W * 0.6 ? effRank * bw - 4 : effRank * bw + 4, y: H - 6, textAnchor: effRank * bw > W * 0.6 ? "end" : "start", className: "fill-[var(--accent)] font-mono text-[9.5px]", paintOrder: "stroke", stroke: "var(--surface)", strokeWidth: 3, children: ["eff. rank ", effRank.toFixed(2)] }), _jsx("text", { x: 0, y: H + 12, className: "fill-[var(--ink-3)] font-mono text-[9.5px]", children: "\u03C3\u2081 \u2026 \u03C3\u1D63 (bars) \u00B7 cumulative energy \u03A3\u03C3\u00B2 (line)" })] }) }));
}
