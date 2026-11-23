import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "./icons";
import { Kbd, cx } from "./ui";
export function CommandPalette({ commands, onClose }) {
    const [q, setQ] = useState("");
    const [i, setI] = useState(0);
    const input = useRef(null);
    const list = useMemo(() => {
        const t = q.trim().toLowerCase();
        return t ? commands.filter((c) => `${c.group} ${c.label}`.toLowerCase().includes(t)) : commands;
    }, [q, commands]);
    useEffect(() => { input.current?.focus(); }, []);
    useEffect(() => setI(0), [q]);
    const exec = (c) => { if (c) {
        c.run();
        onClose();
    } };
    return (_jsx("div", { className: "fixed inset-0 z-[70] flex items-start justify-center bg-black/25 px-4 pt-[12vh] backdrop-blur-[2px]", onClick: onClose, role: "presentation", children: _jsxs("div", { role: "dialog", "aria-modal": "true", "aria-label": "Command palette", onClick: (e) => e.stopPropagation(), className: "fade-in w-full max-w-[560px] overflow-hidden rounded-[calc(var(--radius)+2px)] border border-line-strong bg-surface shadow-2xl", children: [_jsxs("div", { className: "flex items-center gap-2 border-b border-line px-3", children: [_jsx(Icon, { name: "search", className: "text-ink-3" }), _jsx("input", { ref: input, value: q, onChange: (e) => setQ(e.target.value), placeholder: "Type a command or page\u2026", className: "h-11 flex-1 bg-transparent text-[13.5px] text-ink outline-none placeholder:text-ink-3", onKeyDown: (e) => {
                                if (e.key === "Escape")
                                    onClose();
                                else if (e.key === "ArrowDown") {
                                    e.preventDefault();
                                    setI((x) => Math.min(list.length - 1, x + 1));
                                }
                                else if (e.key === "ArrowUp") {
                                    e.preventDefault();
                                    setI((x) => Math.max(0, x - 1));
                                }
                                else if (e.key === "Enter")
                                    exec(list[i]);
                            }, "aria-controls": "cmd-list", "aria-activedescendant": list[i] ? `cmd-${list[i].id}` : undefined }), _jsx(Kbd, { children: "Esc" })] }), _jsxs("ul", { id: "cmd-list", role: "listbox", className: "scroll-thin max-h-[360px] overflow-y-auto p-1.5", children: [list.length === 0 && _jsx("li", { className: "px-3 py-6 text-center text-[12.5px] text-ink-3", children: "No matching command" }), list.map((c, n) => (_jsxs("li", { id: `cmd-${c.id}`, role: "option", "aria-selected": n === i, onMouseEnter: () => setI(n), onClick: () => exec(c), className: cx("flex cursor-pointer items-center justify-between rounded px-3 py-2 text-[13px]", n === i ? "bg-accent-soft text-ink" : "text-ink-2"), children: [_jsx("span", { children: c.label }), _jsx("span", { className: "micro !text-[9px] text-ink-3", children: c.group })] }, c.id)))] })] }) }));
}
