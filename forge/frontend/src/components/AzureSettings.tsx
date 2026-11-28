import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAssistant } from "../lib/assistant";
import { useAction, useApi } from "../lib/hooks";
import { Badge, Button, ErrorLine, Field, Notice, Panel, Prov, Status, Toggle, inputCls } from "./ui";

interface Cfg { endpoint: string; deployment: string; api_version: string; key_env: string; enabled: boolean; use_system_proxy: boolean;
  source: string; key_present: boolean; available: boolean; endpoint_host: string | null }

/** System Settings → Integrations. The only visible trace of Azure OpenAI until it is configured. */
export function AzureSettings() {
  const a = useAssistant();
  const cfg = useApi<Cfg>("/api/assistant/config");
  const [f, setF] = useState({ endpoint: "", deployment: "", api_version: "2024-10-21", key_env: "AZURE_OPENAI_API_KEY", enabled: true, use_system_proxy: false });
  const [open, setOpen] = useState(false);
  useEffect(() => { if (cfg.data?.endpoint) { setF({ endpoint: cfg.data.endpoint, deployment: cfg.data.deployment, api_version: cfg.data.api_version, key_env: cfg.data.key_env, enabled: cfg.data.enabled, use_system_proxy: cfg.data.use_system_proxy }); setOpen(true); } }, [cfg.data]);
  const act = useAction();
  const [test, setTest] = useState<string | null>(null);
  const save = (body: typeof f | { endpoint: "" }) => void act.run(async () => { await api.put("/api/assistant/config", body); await cfg.reload(); a.refresh(); setTest(null); });
  const c = cfg.data;
  return (
    <Panel title="Integrations" eyebrow="optional · off by default" prov={<Prov kind="declared" source="FORGE database" />}
      right={c?.available ? <Status s="pass" label="AI assistant on" /> : c?.endpoint ? <Status s="warn" label={c.key_present ? "disabled" : "key not set"} /> : undefined}>
      {!open && !c?.endpoint ? (
        <div className="flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-ink-2">
          <span>Azure OpenAI can power an in-app assistant that explains results and suggests improvements. Nothing is sent anywhere unless you set it up.</span>
          <Button size="sm" onClick={() => setOpen(true)}>Set up Azure OpenAI</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label="Endpoint" hint="Your resource URL, e.g. https://my-resource.openai.azure.com"><input className={inputCls} value={f.endpoint} onChange={(e) => setF({ ...f, endpoint: e.target.value })} /></Field>
            <Field label="Deployment name" hint="The chat deployment you created in Azure (e.g. gpt-4.1)."><input className={inputCls} value={f.deployment} onChange={(e) => setF({ ...f, deployment: e.target.value })} /></Field>
            <Field label="API version"><input className={inputCls} value={f.api_version} onChange={(e) => setF({ ...f, api_version: e.target.value })} /></Field>
            <Field label="Key environment variable (its NAME, never the key)" hint={c?.endpoint ? (c.key_present ? "found in FORGE's environment" : "not set in FORGE's environment — see below") : undefined}>
              <input className={inputCls} value={f.key_env} onChange={(e) => setF({ ...f, key_env: e.target.value.toUpperCase() })} /></Field>
          </div>
          <div className="flex flex-wrap gap-4"><Toggle checked={f.enabled} onChange={(v) => setF({ ...f, enabled: v })} label="Enabled" />
            <Toggle checked={f.use_system_proxy} onChange={(v) => setF({ ...f, use_system_proxy: v })} label="Use system proxy (corporate networks)" /></div>
          {c?.endpoint && !c.key_present && (
            <Notice tone="warn">Set the key for your Windows user, then restart FORGE so it can read it:
              <pre className="mt-1.5 rounded bg-surface-2 p-2 font-mono text-[11px]">setx {f.key_env} "&lt;your key from Azure portal → Keys and Endpoint&gt;"</pre></Notice>
          )}
          <Notice tone="honesty">What is shared: metrics, settings, statistics, skill and tool names are sent when you ask a question. <b>Real text</b> — tasks, your examples, table rows, document passages, episodes — is sent only after you review the exact payload and approve it. File paths are removed; anything resembling personal data is refused. A local audit log records what was sent (size and hash). Use synthetic or non-sensitive data only.</Notice>
          <div className="flex flex-wrap items-center gap-2">
            <Button tone="primary" busy={act.busy} disabled={!f.endpoint || !f.deployment} onClick={() => save(f)}>Save</Button>
            {c?.available && <Button busy={act.busy} onClick={() => void act.run(async () => { const r = await api.post<{ reply: string; latency_ms: number; model: string }>("/api/assistant/test"); setTest(`Connected · ${r.model ?? f.deployment} replied “${r.reply}” in ${r.latency_ms} ms`); })}>Test connection</Button>}
            {c?.endpoint && <Button tone="ghost" onClick={() => { save({ endpoint: "" }); setOpen(false); }}>Remove integration</Button>}
            {c?.source === "env" && <Badge>from environment variables</Badge>}
          </div>
          {test && <div className="text-[12px] text-good-ink">{test}</div>}
          <ErrorLine error={act.error ?? cfg.error} />
        </div>
      )}
    </Panel>
  );
}
