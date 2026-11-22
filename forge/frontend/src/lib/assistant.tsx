import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { Icon } from "../components/icons";
import { cx } from "../components/ui";
import { useApi } from "./hooks";
import { usePrefs } from "./prefs";

/** What the assistant is looking at. Pages that own a selection (an agent, a knowledge pack) register it. */
export type ScopeKind = "general" | "study" | "agent" | "pack";
export interface Scope { kind: ScopeKind; id: string | null; label: string }
interface Status { available: boolean; configured: boolean; deployment: string | null; policy: string }

interface Ctx {
  available: boolean; deployment: string | null; policy: string;
  scope: Scope; isOpen: boolean; pending: { q: string; content: boolean } | null;
  open: (q?: string, content?: boolean) => void; close: () => void; consume: () => void;
  register: (kind: "agent" | "pack", id: string | null, label: string) => void;
  setOverride: (s: Scope | null) => void; refresh: () => void;
}
const AssistantCtx = createContext<Ctx | null>(null);

const STUDY_PAGES = new Set(["studio", "trajectories", "datasets", "training", "evaluation", "knowledge", "lens", "factory"]);

export function AssistantProvider({ route, children }: { route: string; children: ReactNode }) {
  const st = useApi<Status>("/api/assistant/status", 60000);
  const { prefs } = usePrefs();
  const [isOpen, setOpen] = useState(false);
  const [pending, setPending] = useState<{ q: string; content: boolean } | null>(null);
  const [reg, setReg] = useState<Record<"agent" | "pack", { id: string | null; label: string }>>({ agent: { id: null, label: "" }, pack: { id: null, label: "" } });
  const [override, setOverride] = useState<Scope | null>(null);
  useEffect(() => setOverride(null), [route]);
  const auto: Scope = useMemo(() => {
    if (route === "agent-studio" && reg.agent.id) return { kind: "agent", id: reg.agent.id, label: reg.agent.label };
    if (route === "knowledge-studio" && reg.pack.id) return { kind: "pack", id: reg.pack.id, label: reg.pack.label };
    if (STUDY_PAGES.has(route) && prefs.activeStudy) return { kind: "study", id: prefs.activeStudy, label: "this study" };
    return { kind: "general", id: null, label: "FORGE overall" };
  }, [route, reg, prefs.activeStudy]);
  const register = useCallback((kind: "agent" | "pack", id: string | null, label: string) => setReg((r) => (r[kind].id === id && r[kind].label === label ? r : { ...r, [kind]: { id, label } })), []);
  const value: Ctx = {
    available: !!st.data?.available, deployment: st.data?.deployment ?? null, policy: st.data?.policy ?? "",
    scope: override ?? auto, isOpen, pending,
    open: (q, content = false) => { setOpen(true); if (q) setPending({ q, content }); },
    close: () => setOpen(false), consume: () => setPending(null), register, setOverride, refresh: () => void st.reload(),
  };
  return <AssistantCtx.Provider value={value}>{children}</AssistantCtx.Provider>;
}

export function useAssistant(): Ctx {
  const c = useContext(AssistantCtx);
  if (!c) throw new Error("useAssistant outside AssistantProvider");
  return c;
}

/** Pages call this with their current selection so the assistant talks about the right thing. */
export function useAssistantScope(kind: "agent" | "pack", id: string | null | undefined, label: string | undefined) {
  const c = useContext(AssistantCtx);
  useEffect(() => { c?.register(kind, id ?? null, label ?? ""); }, [c, kind, id, label]);
}

/** Inline "Ask AI" entry point. Renders nothing unless Azure OpenAI is configured. */
export function AskAI({ q, content = false, label = "Ask AI", className }: { q: string; content?: boolean; label?: string; className?: string }) {
  const c = useContext(AssistantCtx);
  if (!c?.available) return null;
  return (
    <button type="button" onClick={() => c.open(q, content)} title={q}
      className={cx("inline-flex h-7 items-center gap-1.5 rounded-[calc(var(--radius)-1px)] border border-accent-line bg-accent-soft px-2.5 text-[11.5px] font-medium text-ink transition hover:border-accent", className)}>
      <Icon name="spark" size={13} className="text-accent" />{label}
    </button>
  );
}
