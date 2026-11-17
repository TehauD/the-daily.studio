import { useState, type FormEvent } from "react";
import { Badge, Button, ErrorLine, PageHeader, Panel } from "../components/ui";
import { api } from "../lib/api";
import { useApi } from "../lib/hooks";
import type { Hardware } from "../lib/types";

interface SettingsT {
  home: string; bind: { host: string; port: number; remote_allowed: boolean }; hf_hub_cache: string; ollama_url: string;
  lmstudio_url: string; lmstudio_model_dirs: string[]; model_dirs: string[];
  endpoints: { label: string; base_url: string; api_key_env: string | null; allow_remote: boolean }[];
}

export function SystemSettings() {
  const s = useApi<SettingsT>("/api/settings");
  const hw = useApi<Hardware>("/api/system/hardware");
  const [dir, setDir] = useState("");
  const [ep, setEp] = useState({ label: "", base_url: "http://127.0.0.1:8080/v1", api_key_env: "", allow_remote: false });
  const [err, setErr] = useState<string | null>(null);
  const input = "rounded border border-edge bg-ink px-2 py-1.5 font-mono text-xs text-zinc-200 outline-none focus:border-cyan/50";

  const run = async (fn: () => Promise<unknown>) => { setErr(null); try { await fn(); await s.reload(); } catch (e) { setErr((e as Error).message); } };
  const addDir = (e: FormEvent) => { e.preventDefault(); void run(async () => { await api.post("/api/settings/model-dirs", { path: dir }); setDir(""); }); };
  const addEp = (e: FormEvent) => { e.preventDefault(); void run(() => api.post("/api/settings/endpoints", { ...ep, api_key_env: ep.api_key_env || null })); };

  return (
    <div className="space-y-4">
      <PageHeader title="System Settings" subtitle="Model sources, endpoints, and runtime environment. Changes apply on the next discovery run." />
      <ErrorLine error={err ?? s.error} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Model directories">
          <form onSubmit={addDir} className="mb-3 flex gap-2">
            <input className={`${input} flex-1`} placeholder="D:\\models  (absolute, local path)" value={dir} onChange={(e) => setDir(e.target.value)} />
            <Button type="submit" tone="primary" disabled={!dir}>Add</Button>
          </form>
          <ul className="space-y-1">
            {s.data?.model_dirs.map((d) => (
              <li key={d} className="flex items-center justify-between gap-2 font-mono text-xs"><span className="break-all text-zinc-300">{d}</span>
                <Button tone="danger" onClick={() => void run(() => api.del("/api/settings/model-dirs", { path: d }))}>Remove</Button></li>
            ))}
            {s.data && !s.data.model_dirs.length && <li className="text-xs text-zinc-500">None. HF cache, Ollama, and LM Studio are scanned automatically.</li>}
          </ul>
        </Panel>
        <Panel title="OpenAI-compatible endpoints">
          <form onSubmit={addEp} className="mb-3 grid grid-cols-2 gap-2">
            <input className={input} placeholder="label" value={ep.label} onChange={(e) => setEp({ ...ep, label: e.target.value })} />
            <input className={input} placeholder="base URL" value={ep.base_url} onChange={(e) => setEp({ ...ep, base_url: e.target.value })} />
            <input className={input} placeholder="API key env var name (optional)" value={ep.api_key_env} onChange={(e) => setEp({ ...ep, api_key_env: e.target.value })} />
            <label className="flex items-center gap-2 text-xs text-zinc-400"><input type="checkbox" checked={ep.allow_remote} onChange={(e) => setEp({ ...ep, allow_remote: e.target.checked })} />allow non-loopback</label>
            <div className="col-span-2"><Button type="submit" tone="primary" disabled={!ep.label || !ep.base_url}>Add endpoint</Button></div>
          </form>
          <ul className="space-y-1">
            {s.data?.endpoints.map((e) => (
              <li key={e.label} className="flex items-center justify-between gap-2 font-mono text-xs">
                <span className="text-zinc-300">{e.label} <span className="text-zinc-500">{e.base_url}</span> {e.allow_remote && <Badge tone="amber">remote</Badge>}</span>
                <Button tone="danger" onClick={() => void run(() => api.del(`/api/settings/endpoints/${e.label}`))}>Remove</Button></li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-zinc-500">Keys are never stored — only the name of an environment variable.</p>
        </Panel>
        <Panel title="Runtime">
          <dl className="grid grid-cols-[140px_1fr] gap-y-1.5 font-mono text-xs">
            <dt className="text-zinc-500">FORGE home</dt><dd className="break-all">{s.data?.home}</dd>
            <dt className="text-zinc-500">bind</dt><dd>{s.data?.bind.host}:{s.data?.bind.port} {s.data && !s.data.bind.remote_allowed && <Badge tone="signal">loopback only</Badge>}</dd>
            <dt className="text-zinc-500">HF cache</dt><dd className="break-all">{s.data?.hf_hub_cache}</dd>
            <dt className="text-zinc-500">Ollama</dt><dd>{s.data?.ollama_url}</dd>
            <dt className="text-zinc-500">LM Studio</dt><dd>{s.data?.lmstudio_url}</dd>
            <dt className="text-zinc-500">LM Studio dirs</dt><dd className="break-all">{s.data?.lmstudio_model_dirs.join(" · ")}</dd>
          </dl>
        </Panel>
        <Panel title="Python environment">
          <div className="mb-2 font-mono text-xs text-zinc-400">{hw.data?.os} · Python {hw.data?.python} {hw.data?.wsl && <Badge tone="cyan">WSL</Badge>}</div>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(hw.data?.optional_packages ?? {}).map(([p, ok]) => <Badge key={p} tone={ok ? "signal" : "default"}>{ok ? "✓" : "✗"} {p}</Badge>)}
          </div>
        </Panel>
      </div>
    </div>
  );
}
