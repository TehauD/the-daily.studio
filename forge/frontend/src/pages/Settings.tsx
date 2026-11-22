import { AzureSettings } from "../components/AzureSettings";
import { useState, type FormEvent } from "react";
import { Badge, Button, ErrorLine, Field, KV, PageHeader, Panel, Prov, Segmented, Status, Toggle, cx, inputCls } from "../components/ui";
import { api } from "../lib/api";
import { useAction, useApi } from "../lib/hooks";
import { DEFAULT_PREFS, usePrefs, type Prefs } from "../lib/prefs";
import type { Hardware } from "../lib/types";

interface SettingsT {
  home: string; bind: { host: string; port: number; remote_allowed: boolean }; hf_hub_cache: string; ollama_url: string;
  lmstudio_url: string; lmstudio_model_dirs: string[]; model_dirs: string[]; runtime_overrides: Record<string, string>;
  endpoints: { label: string; base_url: string; api_key_env: string | null; allow_remote: boolean }[];
}
const ACCENTS: { v: Prefs["accent"]; light: string; dark: string }[] = [
  { v: "teal", light: "#0f8f84", dark: "#2bb3a6" }, { v: "cyan", light: "#0e7fa6", dark: "#38bdf8" }, { v: "green", light: "#1f8a4c", dark: "#3ecf7a" },
  { v: "blue", light: "#2f5fd0", dark: "#6d94f5" }, { v: "graphite", light: "#3f4650", dark: "#c4cad1" }];

function download(name: string, data: unknown) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  a.click();
  URL.revokeObjectURL(url);
}

export default function Settings() {
  return (
    <div className="space-y-4">
      <PageHeader kicker="System" title="System Settings" subtitle="Appearance is stored in this browser (localStorage forge.ui.v1). Runtime configuration is stored server-side and layered over environment variables; only loopback URLs are accepted." />
      <div className="grid gap-4 xl:grid-cols-2">
        <Appearance />
        <div className="space-y-4"><Runtime /><AzureSettings /><Environment /></div>
      </div>
    </div>
  );
}

function Appearance() {
  const { prefs, set, replace } = usePrefs();
  const dark = document.documentElement.dataset.theme === "dark";
  const [imp, setImp] = useState<string | null>(null);
  return (
    <Panel title="Appearance" prov={<Prov kind="declared" source="this browser" />}>
      <div className="space-y-5">
        <Field label="Theme"><Segmented label="Theme" value={prefs.theme} onChange={(v) => set("theme", v)} options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }, { value: "system", label: "System" }]} /></Field>
        <Field label="Accent" hint="Chrome only — focus, selection, primary actions. Data colors are fixed and colorblind-validated.">
          <div className="flex flex-wrap gap-2">
            {ACCENTS.map((a) => (
              <button key={a.v} type="button" onClick={() => set("accent", a.v)} aria-pressed={prefs.accent === a.v}
                className={cx("flex items-center gap-2 rounded-[var(--radius)] border px-2.5 py-1.5 text-[12px] transition", prefs.accent === a.v ? "border-ink text-ink" : "border-line text-ink-2 hover:border-line-strong")}>
                <span className="h-3.5 w-3.5 rounded-full" style={{ background: dark ? a.dark : a.light }} />{a.v}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Density"><Segmented label="Density" value={prefs.density} onChange={(v) => set("density", v)} options={[{ value: "compact", label: "Compact" }, { value: "standard", label: "Standard" }, { value: "comfortable", label: "Roomy" }]} /></Field>
          <Field label="Contrast"><Segmented label="Contrast" value={prefs.contrast} onChange={(v) => set("contrast", v)} options={[{ value: "standard", label: "Standard" }, { value: "high", label: "High" }]} /></Field>
          <Field label={`Text scale · ${Math.round(prefs.textScale * 100)}%`}><input type="range" min={0.85} max={1.3} step={0.05} value={prefs.textScale} onChange={(e) => set("textScale", Number(e.target.value))} className="w-full accent-[var(--accent)]" /></Field>
          <Field label={`Corner radius · ${prefs.radius}px`}><input type="range" min={0} max={12} step={1} value={prefs.radius} onChange={(e) => set("radius", Number(e.target.value))} className="w-full accent-[var(--accent)]" /></Field>
          <Field label="Motion"><Segmented label="Motion" value={prefs.motion} onChange={(v) => set("motion", v)} options={[{ value: "system", label: "System" }, { value: "full", label: "Full" }, { value: "reduced", label: "Reduced" }]} /></Field>
          <Field label="Telemetry poll"><Segmented label="Poll" value={String(prefs.telemetryPollMs)} onChange={(v) => set("telemetryPollMs", Number(v))} options={[{ value: "1000", label: "1s" }, { value: "2000", label: "2s" }, { value: "5000", label: "5s" }]} /></Field>
          <Field label="Telemetry window"><Segmented label="Window" value={String(prefs.telemetryWindow)} onChange={(v) => set("telemetryWindow", Number(v))} options={[{ value: "60", label: "60" }, { value: "120", label: "120" }, { value: "300", label: "300 samples" }]} /></Field>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Toggle checked={prefs.grid} onChange={(v) => set("grid", v)} label="Measurement grid" />
          <Toggle checked={prefs.chartAnimation} onChange={(v) => set("chartAnimation", v)} label="Chart animation" />
          <Toggle checked={prefs.sidebarCollapsed} onChange={(v) => set("sidebarCollapsed", v)} label="Collapse sidebar" />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <Button icon="download" onClick={() => download("forge-ui-prefs.json", prefs)}>Export preferences</Button>
          <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[calc(var(--radius)-1px)] border border-line-strong px-3 text-[12.5px] text-ink hover:bg-accent-soft">
            Import…<input type="file" accept="application/json" className="sr-only" onChange={async (e) => {
              const f = e.target.files?.[0]; if (!f) return;
              try { const p = JSON.parse(await f.text()) as Partial<Prefs>; replace(Object.fromEntries(Object.entries(p).filter(([k]) => k in DEFAULT_PREFS))); setImp("imported"); }
              catch { setImp("not a valid preferences file"); }
            }} />
          </label>
          <Button tone="ghost" onClick={() => replace({ ...DEFAULT_PREFS, activeStudy: prefs.activeStudy })}>Reset</Button>
          {imp && <span className="text-[11.5px] text-ink-3">{imp}</span>}
        </div>
      </div>
    </Panel>
  );
}

function Runtime() {
  const s = useApi<SettingsT>("/api/settings");
  const act = useAction();
  const [rt, setRt] = useState<{ lmstudio_url: string; ollama_url: string } | null>(null);
  const [dir, setDir] = useState("");
  const [ep, setEp] = useState({ label: "", base_url: "http://127.0.0.1:8080/v1", api_key_env: "", allow_remote: false });
  const cur = rt ?? (s.data ? { lmstudio_url: s.data.lmstudio_url, ollama_url: s.data.ollama_url } : null);
  const run = (fn: () => Promise<unknown>) => void act.run(async () => { await fn(); await s.reload(); });
  const addDir = (e: FormEvent) => { e.preventDefault(); run(async () => { await api.post("/api/settings/model-dirs", { path: dir }); setDir(""); }); };
  const addEp = (e: FormEvent) => { e.preventDefault(); run(() => api.post("/api/settings/endpoints", { ...ep, api_key_env: ep.api_key_env || null })); };
  return (
    <>
      <Panel title="Runtime configuration" prov={<Prov kind="declared" source="env → DB overrides" />}>
        {cur && (
          <form onSubmit={(e) => { e.preventDefault(); run(() => api.put("/api/settings/runtime", cur)); }} className="space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="LM Studio (teacher) URL" hint={s.data?.runtime_overrides.lmstudio_url ? "overridden" : "from environment"}><input className={inputCls} value={cur.lmstudio_url} onChange={(e) => setRt({ ...cur, lmstudio_url: e.target.value })} /></Field>
              <Field label="Ollama URL" hint={s.data?.runtime_overrides.ollama_url ? "overridden" : "from environment"}><input className={inputCls} value={cur.ollama_url} onChange={(e) => setRt({ ...cur, ollama_url: e.target.value })} /></Field>
            </div>
            <div className="flex flex-wrap gap-2"><Button type="submit" tone="primary">Save</Button><Button tone="ghost" onClick={() => run(() => api.put("/api/settings/runtime", { lmstudio_url: "", ollama_url: "" }))}>Revert to environment</Button>
              <Button icon="download" onClick={() => void api.get("/api/settings/export").then((d) => download("forge-config.json", d))}>Export config</Button></div>
          </form>
        )}
        <div className="mt-4 border-t border-line pt-4">
          <div className="micro mb-2 text-ink-3">Model directories</div>
          <form onSubmit={addDir} className="mb-2 flex gap-2"><input className={inputCls} placeholder="D:\\models (absolute, local)" value={dir} onChange={(e) => setDir(e.target.value)} /><Button type="submit" disabled={!dir}>Add</Button></form>
          <ul className="space-y-1">{s.data?.model_dirs.map((d) => <li key={d} className="flex items-center justify-between gap-2 font-mono text-[11.5px]"><span className="break-all text-ink-2">{d}</span><Button size="sm" tone="danger" onClick={() => run(() => api.del("/api/settings/model-dirs", { path: d }))}>Remove</Button></li>)}
            {s.data && !s.data.model_dirs.length && <li className="text-[11.5px] text-ink-3">None. The HF cache, Ollama, and LM Studio are scanned automatically.</li>}</ul>
        </div>
        <div className="mt-4 border-t border-line pt-4">
          <div className="micro mb-2 text-ink-3">OpenAI-compatible endpoints</div>
          <form onSubmit={addEp} className="grid gap-2 sm:grid-cols-2">
            <input className={inputCls} placeholder="label" value={ep.label} onChange={(e) => setEp({ ...ep, label: e.target.value })} aria-label="Endpoint label" />
            <input className={inputCls} placeholder="base URL" value={ep.base_url} onChange={(e) => setEp({ ...ep, base_url: e.target.value })} aria-label="Endpoint URL" />
            <input className={inputCls} placeholder="API key env var NAME (never the key)" value={ep.api_key_env} onChange={(e) => setEp({ ...ep, api_key_env: e.target.value })} aria-label="API key env var" />
            <div className="flex items-center justify-between gap-2"><Toggle checked={ep.allow_remote} onChange={(v) => setEp({ ...ep, allow_remote: v })} label="Allow non-loopback" /><Button type="submit" disabled={!ep.label}>Add</Button></div>
          </form>
          <ul className="mt-2 space-y-1">{s.data?.endpoints.map((e) => <li key={e.label} className="flex items-center justify-between gap-2 font-mono text-[11.5px]"><span className="text-ink-2">{e.label} <span className="text-ink-3">{e.base_url}</span> {e.allow_remote && <Badge tone="warn">remote</Badge>}</span><Button size="sm" tone="danger" onClick={() => run(() => api.del(`/api/settings/endpoints/${e.label}`))}>Remove</Button></li>)}</ul>
        </div>
        <div className="mt-3"><ErrorLine error={act.error ?? s.error} /></div>
      </Panel>
      <Panel title="Paths & binding" prov={<Prov kind="measured" />}>
        <KV rows={[["FORGE home", s.data?.home ?? "—"], ["bind", <span key="b">{s.data?.bind.host}:{s.data?.bind.port} {s.data && !s.data.bind.remote_allowed && <Badge tone="good">loopback only</Badge>}</span>],
          ["HF cache", s.data?.hf_hub_cache ?? "—"], ["LM Studio dirs", s.data?.lmstudio_model_dirs.join(" · ") ?? "—"]]} />
      </Panel>
    </>
  );
}

function Environment() {
  const hw = useApi<Hardware>("/api/system/hardware");
  return (
    <Panel title="Python environment" prov={<Prov kind="measured" source="importlib + probe" />}>
      <div className="mb-2 break-all font-mono text-[11px] text-ink-2">{hw.data?.python_executable} · Python {hw.data?.python}</div>
      <div className="flex flex-wrap gap-x-4 gap-y-1.5">{Object.entries(hw.data?.optional_packages ?? {}).map(([p, ok]) => <Status key={p} s={ok ? "pass" : "fail"} label={p} />)}</div>
    </Panel>
  );
}
