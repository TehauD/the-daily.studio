import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { Fragment, useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useAssistant } from "../lib/assistant";
import { useApi } from "../lib/hooks";
import { Icon } from "./icons";
import { Badge, Button, ErrorLine, Toggle, cx } from "./ui";
const kb = (n) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} KB`);
/* ------------------------------------------------------------------ minimal, safe Markdown (no HTML injection) */
function inline(text, key) {
    const out = [];
    const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g;
    let last = 0, m, i = 0;
    while ((m = re.exec(text))) {
        if (m.index > last)
            out.push(text.slice(last, m.index));
        const t = m[0];
        out.push(t.startsWith("**") ? _jsx("b", { className: "font-semibold text-ink", children: t.slice(2, -2) }, `${key}b${i}`)
            : t.startsWith("`") ? _jsx("code", { className: "rounded bg-surface-3 px-1 font-mono text-[0.9em]", children: t.slice(1, -1) }, `${key}c${i}`)
                : _jsx("i", { children: t.slice(1, -1) }, `${key}i${i}`));
        last = m.index + t.length;
        i++;
    }
    if (last < text.length)
        out.push(text.slice(last));
    return out;
}
export function Markdown({ text }) {
    const lines = text.replace(/\r/g, "").split("\n");
    const blocks = [];
    let i = 0, k = 0;
    while (i < lines.length) {
        const l = lines[i];
        if (l.startsWith("```")) {
            const body = [];
            for (i++; i < lines.length && !lines[i].startsWith("```"); i++)
                body.push(lines[i]);
            i++;
            blocks.push(_jsx("pre", { className: "scroll-thin overflow-auto rounded bg-surface-3 p-2 font-mono text-[11.5px]", children: body.join("\n") }, k++));
        }
        else if (/^#{1,4}\s/.test(l)) {
            blocks.push(_jsx("div", { className: "mt-1 text-[13px] font-semibold text-ink", children: inline(l.replace(/^#+\s/, ""), `h${k}`) }, k++));
            i++;
        }
        else if (/^\s*([-*]|\d+\.)\s/.test(l)) {
            const ordered = /^\s*\d+\./.test(l);
            const items = [];
            while (i < lines.length && /^\s*([-*]|\d+\.)\s/.test(lines[i])) {
                items.push(lines[i].replace(/^\s*([-*]|\d+\.)\s/, ""));
                i++;
            }
            const L = ordered ? "ol" : "ul";
            blocks.push(_jsx(L, { className: cx("space-y-1 pl-5", ordered ? "list-decimal" : "list-disc"), children: items.map((t, j) => _jsx("li", { children: inline(t, `l${k}${j}`) }, j)) }, k++));
        }
        else if (!l.trim()) {
            i++;
        }
        else {
            const para = [];
            while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|```|\s*([-*]|\d+\.)\s)/.test(lines[i])) {
                para.push(lines[i]);
                i++;
            }
            blocks.push(_jsx("p", { children: inline(para.join(" "), `p${k}`) }, k++));
        }
    }
    return _jsx("div", { className: "space-y-2 text-[12.5px] leading-relaxed text-ink-2", children: blocks });
}
/* ------------------------------------------------------------------ drawer */
export function AssistantDrawer() {
    const a = useAssistant();
    const [turns, setTurns] = useState([]);
    const [q, setQ] = useState("");
    const [content, setContent] = useState(false);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState(null);
    const [review, setReview] = useState(null);
    const end = useRef(null);
    const scope = a.scope;
    const key = `${scope.kind}:${scope.id ?? ""}`;
    const prompts = useApi(a.available ? `/api/assistant/prompts?scope=${scope.kind}` : null);
    const hist = useApi(a.available && a.isOpen ? `/api/assistant/history?scope=${scope.kind}${scope.id ? `&id=${scope.id}` : ""}` : null);
    useEffect(() => { setTurns([]); setErr(null); }, [key]);
    useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [turns, busy]);
    const history = () => turns.filter((t) => !t.local).map((t) => ({ role: t.role, content: t.content }));
    const body = (question, withContent, approved) => ({ scope: scope.kind, id: scope.id, question, include_content: withContent, history: history(), approved_sha256: approved });
    const send = async (question, withContent) => {
        if (!question.trim() || busy)
            return;
        setErr(null);
        if (withContent) { // real text: show the exact payload first
            setBusy(true);
            try {
                setReview({ pv: await api.post("/api/assistant/preview", body(question, true)), q: question });
            }
            catch (e) {
                setErr(e.message);
            }
            finally {
                setBusy(false);
            }
            return;
        }
        await deliver(question, false);
    };
    const deliver = async (question, withContent, approved) => {
        setBusy(true);
        setQ("");
        const before = history();
        setTurns((t) => [...t, { role: "user", content: question }]);
        try {
            const r = await api.post("/api/assistant/ask", { ...body(question, withContent, approved), history: before });
            setTurns((t) => [...t, { role: "assistant", content: r.answer, sent: r.sent }]);
        }
        catch (e) {
            setErr(e.message);
            setTurns((t) => t.slice(0, -1));
            setQ(question);
        }
        finally {
            setBusy(false);
        }
    };
    useEffect(() => {
        if (a.isOpen && a.pending && !busy) {
            const p = a.pending;
            a.consume();
            setContent(p.content);
            void send(p.q, p.content);
        }
    }, [a.isOpen, a.pending]); // eslint-disable-line react-hooks/exhaustive-deps
    if (!a.available)
        return null;
    return (_jsxs(_Fragment, { children: [!a.isOpen && (_jsxs("button", { type: "button", onClick: () => a.open(), className: "fixed bottom-4 right-4 z-40 inline-flex h-10 items-center gap-2 rounded-full border border-accent-line bg-surface px-4 text-[12.5px] font-medium text-ink shadow-[var(--shadow)] transition hover:border-accent", "aria-label": "Open FORGE AI assistant", children: [_jsx(Icon, { name: "spark", size: 16, className: "text-accent" }), "Ask FORGE AI"] })), a.isOpen && (_jsxs("aside", { className: "fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-line bg-surface shadow-[var(--shadow)] sm:w-[480px]", "aria-label": "FORGE AI assistant", children: [_jsxs("header", { className: "flex items-center gap-2 border-b border-line px-4 py-3", children: [_jsx(Icon, { name: "spark", size: 16, className: "text-accent" }), _jsxs("div", { className: "min-w-0 flex-1", children: [_jsx("div", { className: "text-[13px] font-semibold text-ink", children: "FORGE AI" }), _jsxs("div", { className: "truncate font-mono text-[10.5px] text-ink-3", children: ["Azure OpenAI \u00B7 ", a.deployment] })] }), _jsx("button", { type: "button", onClick: a.close, className: "rounded p-1.5 text-ink-3 hover:bg-surface-3 hover:text-ink", "aria-label": "Close assistant", children: _jsx(Icon, { name: "x", size: 16 }) })] }), _jsx(ScopeBar, { scope: scope, onGeneral: () => a.setOverride(scope.kind === "general" ? null : { kind: "general", id: null, label: "FORGE overall" }) }), _jsxs("div", { className: "scroll-thin flex-1 space-y-3 overflow-y-auto px-4 py-3", children: [turns.length === 0 && (_jsxs("div", { className: "space-y-3", children: [_jsxs("p", { className: "text-[12.5px] leading-relaxed text-ink-2", children: ["Ask about ", scope.kind === "general" ? "FORGE and your setup" : scope.label, ". Metrics and settings are shared automatically; ", _jsx("b", { className: "text-ink", children: "real text" }), " (tasks, examples, rows, passages, episodes) is sent only after you review it."] }), _jsx("div", { className: "flex flex-wrap gap-1.5", children: (prompts.data?.prompts ?? []).map((p) => (_jsxs("button", { type: "button", disabled: busy, onClick: () => { setContent(p.content); void send(p.q, p.content); }, className: "inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[12px] text-ink-2 transition hover:border-accent-line hover:text-ink", children: [p.label, p.content && _jsx("span", { className: "font-mono text-[9.5px] text-warn-ink", title: "Needs your approval to send real text", children: "review" })] }, p.label))) }), (hist.data?.history.length ?? 0) > 0 && (_jsxs("details", { className: "text-[12px] text-ink-3", children: [_jsxs("summary", { className: "cursor-pointer", children: ["Earlier answers here (", hist.data.history.length, ", stored on this computer)"] }), _jsx("div", { className: "mt-2 space-y-3", children: hist.data.history.slice(-5).reverse().map((h, i) => (_jsxs("div", { className: "rounded border border-line p-2", children: [_jsx("div", { className: "mb-1 font-medium text-ink", children: h.question }), _jsx(Markdown, { text: h.answer })] }, i))) })] }))] })), turns.map((t, i) => (_jsx(Fragment, { children: t.role === "user" ? (_jsx("div", { className: "ml-8 rounded-[var(--radius)] bg-accent-soft px-3 py-2 text-[12.5px] text-ink", children: t.content })) : (_jsxs("div", { className: "space-y-1.5", children: [_jsx(Markdown, { text: t.content }), t.sent && _jsxs("div", { className: "font-mono text-[10px] text-ink-3", title: t.sent.content_items.join("\n"), children: ["sent: ", t.sent.included_content ? `summary + ${t.sent.content_items.length} content item(s)` : "summary only", " \u00B7 ", kb(t.sent.bytes), " \u00B7 sha256 ", t.sent.sha256.slice(0, 10)] })] })) }, i))), busy && _jsxs("div", { className: "flex items-center gap-2 text-[12px] text-ink-3", children: [_jsx("span", { className: "live-dot h-1.5 w-1.5 rounded-full bg-accent" }), "thinking\u2026"] }), _jsx(ErrorLine, { error: err }), _jsx("div", { ref: end })] }), _jsxs("form", { className: "space-y-2 border-t border-line p-3", onSubmit: (e) => { e.preventDefault(); void send(q, content); }, children: [_jsx("textarea", { className: "h-20 w-full resize-none rounded-[calc(var(--radius)-1px)] border border-line-strong bg-surface px-2.5 py-2 text-[12.5px] text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent-soft", placeholder: "Ask anything about this\u2026", value: q, onChange: (e) => setQ(e.target.value), "aria-label": "Question", onKeyDown: (e) => { if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    void send(q, content);
                                } } }), _jsxs("div", { className: "flex items-center justify-between gap-2", children: [_jsx(Toggle, { checked: content, onChange: setContent, label: "Include real text (review first)" }), _jsx(Button, { type: "submit", tone: "primary", icon: "spark", busy: busy, disabled: !q.trim(), children: content ? "Review & send" : "Send" })] })] })] })), review && _jsx(ReviewDialog, { pv: review.pv, deployment: a.deployment ?? "", onCancel: () => setReview(null), onApprove: () => { const r = review; setReview(null); void deliver(r.q, true, r.pv.sha256); } })] }));
}
function ScopeBar({ scope, onGeneral }) {
    const label = { general: "FORGE overall", study: "Study", agent: "Agent", pack: "Knowledge pack" }[scope.kind];
    return (_jsxs("div", { className: "flex items-center gap-2 border-b border-line bg-surface-2 px-4 py-2 text-[11.5px]", children: [_jsx("span", { className: "micro text-ink-3", children: "talking about" }), _jsxs(Badge, { tone: "accent", children: [label, scope.kind !== "general" && scope.label && scope.label !== "this study" ? ` · ${scope.label}` : ""] }), _jsx("button", { type: "button", className: "micro ml-auto text-accent", onClick: onGeneral, children: scope.kind === "general" ? "back to this page" : "ask generally" })] }));
}
function ReviewDialog({ pv, deployment, onCancel, onApprove }) {
    const data = pv.messages.find((m) => m.content.startsWith("DATA (from FORGE"))?.content.replace(/^DATA \(from FORGE, JSON\):\n/, "") ?? "{}";
    let pretty = data;
    try {
        pretty = JSON.stringify(JSON.parse(data), null, 2);
    }
    catch { /* keep raw */ }
    const question = pv.messages.at(-1)?.content ?? "";
    return (_jsx("div", { className: "fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4", role: "dialog", "aria-modal": "true", "aria-label": "Review what will be sent", children: _jsxs("div", { className: "flex max-h-[90vh] w-full max-w-3xl flex-col rounded-[var(--radius-panel)] border border-line bg-surface shadow-[var(--shadow)]", children: [_jsxs("div", { className: "border-b border-line px-5 py-4", children: [_jsx("div", { className: "text-[14px] font-semibold text-ink", children: "Review what will be sent to Azure OpenAI" }), _jsxs("div", { className: "mt-1 text-[12px] text-ink-3", children: ["Deployment ", _jsx("span", { className: "font-mono", children: deployment }), " \u00B7 ", kb(pv.bytes), " \u00B7 FORGE sends exactly this (sha256 ", _jsx("span", { className: "font-mono", children: pv.sha256.slice(0, 12) }), ", checked on send)."] })] }), _jsxs("div", { className: "scroll-thin flex-1 space-y-3 overflow-y-auto px-5 py-4", children: [_jsxs("div", { children: [_jsx("div", { className: "micro mb-1 text-ink-3", children: "real text included" }), _jsx("ul", { className: "list-disc space-y-0.5 pl-5 text-[12.5px] text-ink", children: pv.content_items.map((c) => _jsx("li", { children: c }, c)) })] }), _jsxs("div", { children: [_jsx("div", { className: "micro mb-1 text-ink-3", children: "your question" }), _jsx("div", { className: "rounded bg-surface-2 p-2 text-[12.5px] text-ink", children: question })] }), _jsxs("div", { children: [_jsx("div", { className: "micro mb-1 text-ink-3", children: "data (paths removed, personal-data patterns blocked)" }), _jsx("pre", { className: "scroll-thin max-h-[40vh] overflow-auto rounded border border-line bg-surface-2 p-2.5 font-mono text-[11px] text-ink-2", children: pretty })] }), _jsxs("details", { className: "text-[12px] text-ink-3", children: [_jsx("summary", { className: "cursor-pointer", children: "FORGE's instructions to the model" }), _jsx("pre", { className: "mt-1 whitespace-pre-wrap font-mono text-[11px]", children: pv.messages[0]?.content })] })] }), _jsxs("div", { className: "flex items-center justify-end gap-2 border-t border-line px-5 py-3", children: [_jsx(Button, { tone: "ghost", onClick: onCancel, children: "Cancel \u2014 send nothing" }), _jsx(Button, { tone: "primary", icon: "spark", onClick: onApprove, children: "Send this to Azure" })] })] }) }));
}
