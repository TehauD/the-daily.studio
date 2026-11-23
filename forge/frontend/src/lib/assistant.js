import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Icon } from "../components/icons";
import { cx } from "../components/ui";
import { useApi } from "./hooks";
import { usePrefs } from "./prefs";
const AssistantCtx = createContext(null);
const STUDY_PAGES = new Set(["studio", "trajectories", "datasets", "training", "evaluation", "knowledge", "lens", "factory"]);
export function AssistantProvider({ route, children }) {
    const st = useApi("/api/assistant/status", 60000);
    const { prefs } = usePrefs();
    const [isOpen, setOpen] = useState(false);
    const [pending, setPending] = useState(null);
    const [reg, setReg] = useState({ agent: { id: null, label: "" }, pack: { id: null, label: "" } });
    const [override, setOverride] = useState(null);
    useEffect(() => setOverride(null), [route]);
    const auto = useMemo(() => {
        if (route === "agent-studio" && reg.agent.id)
            return { kind: "agent", id: reg.agent.id, label: reg.agent.label };
        if (route === "knowledge-studio" && reg.pack.id)
            return { kind: "pack", id: reg.pack.id, label: reg.pack.label };
        if (STUDY_PAGES.has(route) && prefs.activeStudy)
            return { kind: "study", id: prefs.activeStudy, label: "this study" };
        return { kind: "general", id: null, label: "FORGE overall" };
    }, [route, reg, prefs.activeStudy]);
    const register = useCallback((kind, id, label) => setReg((r) => (r[kind].id === id && r[kind].label === label ? r : { ...r, [kind]: { id, label } })), []);
    const value = {
        available: !!st.data?.available, deployment: st.data?.deployment ?? null, policy: st.data?.policy ?? "",
        scope: override ?? auto, isOpen, pending,
        open: (q, content = false) => { setOpen(true); if (q)
            setPending({ q, content }); },
        close: () => setOpen(false), consume: () => setPending(null), register, setOverride, refresh: () => void st.reload(),
    };
    return _jsx(AssistantCtx.Provider, { value: value, children: children });
}
export function useAssistant() {
    const c = useContext(AssistantCtx);
    if (!c)
        throw new Error("useAssistant outside AssistantProvider");
    return c;
}
/** Pages call this with their current selection so the assistant talks about the right thing. */
export function useAssistantScope(kind, id, label) {
    const c = useContext(AssistantCtx);
    useEffect(() => { c?.register(kind, id ?? null, label ?? ""); }, [c, kind, id, label]);
}
/** Inline "Ask AI" entry point. Renders nothing unless Azure OpenAI is configured. */
export function AskAI({ q, content = false, label = "Ask AI", className }) {
    const c = useContext(AssistantCtx);
    if (!c?.available)
        return null;
    return (_jsxs("button", { type: "button", onClick: () => c.open(q, content), title: q, className: cx("inline-flex h-7 items-center gap-1.5 rounded-[calc(var(--radius)-1px)] border border-accent-line bg-accent-soft px-2.5 text-[11.5px] font-medium text-ink transition hover:border-accent", className), children: [_jsx(Icon, { name: "spark", size: 13, className: "text-accent" }), label] }));
}
