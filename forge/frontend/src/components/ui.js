import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useState } from "react";
import { Icon } from "./icons";
const cx = (...c) => c.filter(Boolean).join(" ");
export { cx };
const PROV = {
    measured: "text-good-ink border-[color:var(--good)]/40",
    computed: "text-[color:var(--s-teacher)] border-[color:var(--s-teacher)]/40",
    declared: "text-ink-2 border-line-strong",
    estimate: "text-warn-ink border-[color:var(--warn)]/50",
    illustration: "text-ink-3 border-line-strong border-dashed",
    stale: "text-crit-ink border-[color:var(--crit)]/40",
};
/** Every number states where it came from. */
export function Prov({ kind, source }) {
    return (_jsxs("span", { title: source ? `${kind} · ${source}` : kind, className: cx("micro inline-flex items-center gap-1 rounded-[3px] border px-1.5 py-[1px] !text-[9.5px] leading-[14px]", PROV[kind]), children: [kind, source && _jsxs("span", { className: "normal-case tracking-normal opacity-80", children: ["\u00B7 ", source] })] }));
}
/* ---------------------------------------------------------------- frame */
/** `fill`: in fit layouts the panel stretches to its grid cell and its body scrolls internally. */
export function Panel({ title, eyebrow, right, prov, children, className = "", flush = false, id, fill = false, bodyClass = "" }) {
    return (_jsxs("section", { id: id, className: cx("reg min-w-0 rounded-[var(--radius)] border border-line bg-surface shadow-[var(--shadow)]", fill && "fit:flex fit:min-h-0 fit:flex-col", className), children: [(title || right || prov) && (_jsxs("header", { className: "flex min-h-10 shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line px-[var(--pad)] py-2", children: [_jsxs("div", { className: "flex min-w-0 items-baseline gap-2", children: [eyebrow && _jsx("span", { className: "micro text-ink-3", children: eyebrow }), title && _jsx("h2", { className: "truncate text-[13px] font-semibold tracking-tight text-ink", children: title }), prov] }), right && _jsx("div", { className: "flex flex-wrap items-center gap-2", children: right })] })), _jsx("div", { className: cx(flush ? "" : "p-[var(--pad)]", fill && "scroll-thin fit:min-h-0 fit:flex-1 fit:overflow-auto", bodyClass), children: children })] }));
}
export function PageHeader({ title, kicker, subtitle, right }) {
    return (_jsxs("div", { className: "mb-5 flex shrink-0 flex-wrap items-end justify-between gap-4 border-b border-line pb-4 fit:mb-3 fit:items-center fit:pb-3", children: [_jsxs("div", { className: "min-w-0 fit:flex fit:items-baseline fit:gap-4", children: [kicker && _jsx("div", { className: "micro mb-1 text-accent fit:mb-0", children: kicker }), _jsx("h1", { className: "text-[22px] font-semibold leading-tight tracking-[-0.015em] text-ink fit:shrink-0 fit:text-[19px]", children: title }), subtitle && _jsx("p", { title: typeof subtitle === "string" ? subtitle : undefined, className: "mt-1 max-w-3xl text-[13px] leading-relaxed text-ink-2 fit:mt-0 fit:line-clamp-1 fit:max-w-[70ch] fit:text-[12px] fit:text-ink-3", children: subtitle })] }), right && _jsx("div", { className: "flex flex-wrap items-center gap-2", children: right })] }));
}
/* ---------------------------------------------------------------- readouts */
export function Readout({ label, value, unit, sub, tone = "default", size = "md", prov }) {
    const color = { default: "text-ink", accent: "text-accent", good: "text-good-ink", crit: "text-crit-ink", muted: "text-ink-3" }[tone];
    const sz = { sm: "text-[15px]", md: "text-[22px]", lg: "text-[34px]" }[size];
    return (_jsxs("div", { className: "min-w-0", children: [_jsxs("div", { className: "flex items-center gap-1.5", children: [_jsx("span", { className: "micro text-ink-3", children: label }), prov] }), _jsxs("div", { className: cx("num mt-1 flex items-baseline gap-1 font-mono font-medium leading-none tracking-[-0.02em]", sz, color), children: [_jsx("span", { className: "truncate", children: value }), unit && _jsx("span", { className: "text-[11px] font-normal tracking-normal text-ink-3", children: unit })] }), sub && _jsx("div", { className: "mt-1.5 truncate text-[11.5px] text-ink-3", children: sub })] }));
}
const STATUS = {
    pass: { icon: "check", cls: "text-good-ink", label: "pass" },
    supported: { icon: "check", cls: "text-good-ink", label: "supported" },
    completed: { icon: "check", cls: "text-good-ink", label: "completed" },
    warn: { icon: "alert", cls: "text-warn-ink", label: "warn" },
    conditional: { icon: "alert", cls: "text-warn-ink", label: "conditional" },
    fail: { icon: "x", cls: "text-crit-ink", label: "fail" },
    failed: { icon: "x", cls: "text-crit-ink", label: "failed" },
    unsupported: { icon: "x", cls: "text-ink-3", label: "unsupported" },
    info: { icon: "info", cls: "text-ink-2", label: "info" },
    unknown: { icon: "question", cls: "text-ink-3", label: "unknown" },
    skip: { icon: "dot", cls: "text-ink-3", label: "skipped" },
    running: { icon: "refresh", cls: "text-accent", label: "running" },
    pending: { icon: "dot", cls: "text-ink-3", label: "pending" },
    cancelled: { icon: "stop", cls: "text-ink-3", label: "cancelled" },
    cancelling: { icon: "stop", cls: "text-warn-ink", label: "cancelling" },
    interrupted: { icon: "alert", cls: "text-warn-ink", label: "interrupted" },
};
/** Status is never color alone: glyph + word. */
export function Status({ s, label, compact = false }) {
    const st = STATUS[s] ?? STATUS.unknown;
    return (_jsxs("span", { className: cx("inline-flex items-center gap-1 whitespace-nowrap font-mono text-[11px]", st.cls), title: label ?? st.label, children: [_jsx(Icon, { name: st.icon, size: 13, className: s === "running" ? "animate-spin [animation-duration:2s]" : "" }), !compact && _jsx("span", { children: label ?? st.label })] }));
}
export function CapCell({ status, reason }) {
    const m = { supported: "●", conditional: "◐", unsupported: "○", unknown: "?" }[status];
    const cls = { supported: "text-good-ink", conditional: "text-warn-ink", unsupported: "text-ink-3/60", unknown: "text-ink-3" }[status];
    return _jsx("span", { title: `${status}: ${reason}`, "aria-label": `${status}: ${reason}`, className: cx("font-mono text-[13px]", cls), children: m });
}
export function Badge({ children, tone = "default", title }) {
    const t = {
        default: "border-line-strong text-ink-2", accent: "border-accent-line text-accent bg-accent-soft",
        good: "border-[color:var(--good)]/40 text-good-ink", warn: "border-[color:var(--warn)]/60 text-warn-ink",
        crit: "border-[color:var(--crit)]/40 text-crit-ink", teacher: "border-teacher/50 text-teacher",
        base: "border-base/50 text-base", tuned: "border-tuned/60 text-tuned",
    }[tone];
    return _jsx("span", { title: title, className: cx("micro inline-flex items-center gap-1 whitespace-nowrap rounded-[3px] border px-1.5 py-[2px] !text-[9.5px]", t), children: children });
}
/* ---------------------------------------------------------------- controls */
export function Button({ children, onClick, disabled, tone = "default", type = "button", icon, size = "md", title, busy }) {
    const t = {
        default: "border-line-strong bg-surface text-ink hover:border-accent-line hover:bg-accent-soft",
        primary: "border-transparent bg-accent text-accent-ink hover:brightness-110",
        danger: "border-[color:var(--crit)]/40 bg-surface text-crit-ink hover:bg-[color:var(--crit)]/8",
        ghost: "border-transparent text-ink-2 hover:bg-surface-3 hover:text-ink",
    }[tone];
    const s = size === "sm" ? "h-7 px-2.5 text-[11.5px]" : "h-8 px-3 text-[12.5px]";
    return (_jsxs("button", { type: type, onClick: onClick, disabled: disabled || busy, title: title, className: cx("relative inline-flex select-none items-center justify-center gap-1.5 overflow-hidden rounded-[calc(var(--radius)-1px)] border font-medium transition-[background,border,filter] disabled:cursor-not-allowed disabled:opacity-45", s, t), children: [icon && _jsx(Icon, { name: icon, size: 14 }), children, busy && _jsx("span", { className: "absolute inset-x-0 bottom-0 h-[2px] overflow-hidden", children: _jsx("span", { className: "sweep block h-full w-1/3 bg-current opacity-60" }) })] }));
}
export function Segmented({ value, options, onChange, label }) {
    return (_jsx("div", { role: "radiogroup", "aria-label": label, className: "inline-flex rounded-[var(--radius)] border border-line bg-surface-2 p-0.5", children: options.map((o) => (
        // Explicit aria-label: Segmented often sits inside a <label> (Field), which would otherwise name the FIRST option.
        _jsx("button", { type: "button", role: "radio", "aria-checked": value === o.value, onClick: () => onChange(o.value), "aria-label": typeof o.label === "string" ? o.label : o.value, className: cx("h-7 rounded-[calc(var(--radius)-2px)] px-2.5 text-[12px] transition", value === o.value ? "bg-surface text-ink shadow-[var(--shadow)] ring-1 ring-line" : "text-ink-3 hover:text-ink"), children: o.label }, o.value))) }));
}
export const inputCls = "h-8 w-full rounded-[calc(var(--radius)-1px)] border border-line-strong bg-surface px-2.5 font-mono text-[12px] text-ink outline-none transition placeholder:text-ink-3 focus:border-accent focus:ring-2 focus:ring-accent-soft";
/** `math` keeps case: uppercasing would turn α into A and σ into Σ. */
export function Field({ label, hint, children, math = false }) {
    return (_jsxs("label", { className: "block", children: [_jsx("span", { className: cx("micro mb-1 block text-ink-3", math && "!normal-case !tracking-normal"), children: label }), children, hint && _jsx("span", { className: "mt-1 block text-[11px] text-ink-3", children: hint })] }));
}
export function Toggle({ checked, onChange, label }) {
    return (_jsxs("label", { className: "inline-flex cursor-pointer items-center gap-2 text-[12.5px] text-ink-2", children: [_jsx("button", { type: "button", role: "switch", "aria-checked": checked, onClick: () => onChange(!checked), className: cx("relative h-[18px] w-8 rounded-full border transition", checked ? "border-accent bg-accent" : "border-line-strong bg-surface-3"), children: _jsx("span", { className: cx("absolute top-[1px] h-[14px] w-[14px] rounded-full bg-surface shadow transition-all", checked ? "left-[15px]" : "left-[1px]") }) }), label] }));
}
export function Tabs({ value, tabs, onChange }) {
    return (_jsx("div", { role: "tablist", className: "flex gap-0.5 overflow-x-auto border-b border-line", children: tabs.map((t) => (_jsxs("button", { role: "tab", "aria-selected": value === t.value, type: "button", onClick: () => onChange(t.value), className: cx("-mb-px flex h-9 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-[12.5px] transition", value === t.value ? "border-accent font-medium text-ink" : "border-transparent text-ink-3 hover:text-ink"), children: [t.label, t.count != null && _jsx("span", { className: "num rounded bg-surface-3 px-1 font-mono text-[10px] text-ink-2", children: t.count })] }, t.value))) }));
}
/* ---------------------------------------------------------------- feedback */
export function ErrorLine({ error, onRetry }) {
    if (!error)
        return null;
    return (_jsxs("div", { role: "alert", className: "flex items-start gap-2 rounded-[var(--radius)] border border-[color:var(--crit)]/35 bg-[color:var(--crit)]/[0.05] px-3 py-2 text-[12.5px] text-crit-ink", children: [_jsx(Icon, { name: "alert", size: 15, className: "mt-0.5" }), _jsx("span", { className: "min-w-0 flex-1 break-words font-mono text-[11.5px]", children: error }), onRetry && _jsx("button", { type: "button", onClick: onRetry, className: "micro underline", children: "retry" })] }));
}
export function Notice({ children, tone = "info", icon }) {
    const cls = { info: "border-line bg-surface-2 text-ink-2", warn: "border-[color:var(--warn)]/50 bg-[color:var(--warn)]/[0.07] text-ink-2",
        honesty: "border-teacher/30 bg-teacher/[0.05] text-ink-2" }[tone];
    return (_jsxs("div", { className: cx("flex items-start gap-2.5 rounded-[var(--radius)] border px-3 py-2.5 text-[12.5px] leading-relaxed", cls), children: [_jsx(Icon, { name: icon ?? (tone === "warn" ? "alert" : "info"), size: 15, className: "mt-0.5 text-ink-3" }), _jsx("div", { className: "min-w-0", children: children })] }));
}
export function Empty({ children, icon = "dot" }) {
    return (_jsxs("div", { className: "flex flex-col items-center justify-center gap-2 py-9 text-center text-[12.5px] text-ink-3", children: [_jsx(Icon, { name: icon, size: 20, className: "opacity-60" }), _jsx("div", { className: "max-w-md", children: children })] }));
}
export function Skeleton({ h = 16, w = "100%" }) {
    return _jsx("div", { className: "relative overflow-hidden rounded bg-surface-3", style: { height: h, width: w }, children: _jsx("div", { className: "sweep absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-surface/70 to-transparent" }) });
}
export function Meter({ pct, warnAt = 80, critAt = 90, label }) {
    const tone = pct == null ? "bg-line-strong" : pct >= critAt ? "bg-crit" : pct >= warnAt ? "bg-warn" : "bg-accent";
    return (_jsxs("div", { className: "relative h-[5px] w-full rounded-full bg-surface-3", role: "meter", "aria-valuenow": pct ?? undefined, "aria-valuemin": 0, "aria-valuemax": 100, "aria-label": label, children: [pct != null && _jsx("div", { className: cx("h-full rounded-full transition-[width] duration-500", tone), style: { width: `${Math.min(100, Math.max(0, pct))}%` } }), _jsx("span", { className: "absolute top-[-2px] h-[9px] w-px bg-line-strong", style: { left: `${warnAt}%` } }), _jsx("span", { className: "absolute top-[-2px] h-[9px] w-px bg-line-strong", style: { left: `${critAt}%` } })] }));
}
export function Hash({ value, n = 12, label }) {
    const [copied, setCopied] = useState(false);
    if (!value)
        return _jsx("span", { className: "font-mono text-[11px] text-ink-3", children: "\u2014" });
    return (_jsxs("button", { type: "button", title: `${label ? label + ": " : ""}${value} (click to copy)`, onClick: () => { void navigator.clipboard?.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1200); }, className: "num inline-flex items-center gap-1 rounded-[3px] bg-surface-3 px-1.5 py-[1px] font-mono text-[11px] text-ink-2 hover:text-ink", children: [copied ? "copied" : value.slice(0, n), _jsx(Icon, { name: "copy", size: 11, className: "opacity-50" })] }));
}
export function KV({ rows }) {
    return (_jsx("dl", { className: "grid grid-cols-[minmax(92px,auto)_1fr] gap-x-4 gap-y-1.5 text-[12px]", children: rows.map(([k, v], i) => (_jsxs("div", { className: "contents", children: [_jsx("dt", { className: "micro pt-[2px] text-ink-3", children: k }), _jsx("dd", { className: "min-w-0 break-words font-mono text-[11.5px] text-ink", children: v })] }, i))) }));
}
export const th = "micro h-8 whitespace-nowrap px-2 text-left font-normal text-ink-3 first:pl-[var(--pad)] last:pr-[var(--pad)]";
export const td = "h-[var(--row)] px-2 align-middle first:pl-[var(--pad)] last:pr-[var(--pad)]";
export const tr = "border-t border-line transition-colors hover:bg-surface-2";
export function Kbd({ children }) {
    return _jsx("kbd", { className: "rounded-[3px] border border-line-strong bg-surface-2 px-1 font-mono text-[10px] text-ink-3", children: children });
}
export function Checklist({ items }) {
    return (_jsx("ul", { className: "divide-y divide-line", children: items.map((c) => (_jsxs("li", { className: "flex items-start gap-3 py-1.5", children: [_jsx("span", { className: "w-[86px] shrink-0", children: _jsx(Status, { s: c.status }) }), _jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "font-mono text-[11.5px] text-ink", children: c.check }), _jsx("div", { className: "text-[11.5px] leading-snug text-ink-3", children: c.reason ?? c.detail })] })] }, c.check))) }));
}
