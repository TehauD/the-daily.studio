import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAction, useApi } from "../lib/hooks";
import { Button, ErrorLine, Field, Notice, Panel, Prov, Status, Toggle } from "./ui";

interface Guard { enabled: boolean; max_temp_c: number; resume_temp_c: number; cpu_reserve: number; low_priority: boolean; cpu_cores: number }

/** System Settings → Hardware guard. Applies to every engine job started after saving. */
export function GuardSettings() {
  const g = useApi<Guard>("/api/settings/hardware-guard");
  const act = useAction();
  const [f, setF] = useState<Guard | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { if (g.data) setF(g.data); }, [g.data]);
  if (!f) return <Panel title="Hardware guard"><ErrorLine error={g.error} /></Panel>;
  const set = (p: Partial<Guard>) => { setF({ ...f, ...p }); setSaved(false); };
  const bad = f.resume_temp_c >= f.max_temp_c;
  return (
    <Panel title="Hardware guard" eyebrow="every engine job" prov={<Prov kind="declared" source="FORGE database" />}
      right={<Status s={f.enabled ? "pass" : "warn"} label={f.enabled ? "thermal pause on" : "thermal pause off"} />}>
      <div className="space-y-4">
        <p className="text-[12.5px] text-ink-2">Long runs stay cool and the PC stays usable. When the GPU reaches the pause temperature, the job waits at the next safe point (between training steps or episodes) until it cools — nothing is skipped and results are unchanged. Energy, peak temperature and time paused are recorded with each job.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={`Pause at · ${f.max_temp_c} °C`} hint="NVIDIA cards throttle themselves near 83–90 °C; pausing earlier is gentler on fans.">
            <input type="range" min={60} max={92} value={f.max_temp_c} onChange={(e) => set({ max_temp_c: Number(e.target.value) })} className="w-full accent-[var(--accent)]" aria-label="Pause temperature" /></Field>
          <Field label={`Resume at · ${f.resume_temp_c} °C`} hint="Must be below the pause temperature.">
            <input type="range" min={40} max={90} value={f.resume_temp_c} onChange={(e) => set({ resume_temp_c: Number(e.target.value) })} className="w-full accent-[var(--accent)]" aria-label="Resume temperature" /></Field>
          <Field label={`Keep free · ${f.cpu_reserve} of ${f.cpu_cores} CPU cores`} hint={`Jobs use ${Math.max(1, f.cpu_cores - f.cpu_reserve)} threads.`}>
            <input type="range" min={0} max={Math.max(0, f.cpu_cores - 1)} value={f.cpu_reserve} onChange={(e) => set({ cpu_reserve: Number(e.target.value) })} className="w-full accent-[var(--accent)]" aria-label="CPU cores kept free" /></Field>
          <div className="flex flex-col justify-center gap-2">
            <Toggle checked={f.enabled} onChange={(v) => set({ enabled: v })} label="Thermal pause" />
            <Toggle checked={f.low_priority} onChange={(v) => set({ low_priority: v })} label="Run jobs at low priority" />
          </div>
        </div>
        {bad && <Notice tone="warn">Resume temperature must be below the pause temperature.</Notice>}
        <div className="flex flex-wrap items-center gap-2">
          <Button tone="primary" busy={act.busy} disabled={bad} onClick={() => void act.run(async () => { const { cpu_cores: _c, ...body } = f; void _c; await api.put("/api/settings/hardware-guard", body); await g.reload(); setSaved(true); })}>Save</Button>
          <Button tone="ghost" onClick={() => set({ enabled: true, max_temp_c: 83, resume_temp_c: 75, cpu_reserve: Math.min(2, f.cpu_cores - 1), low_priority: true })}>Defaults</Button>
          {saved && <span className="text-[12px] text-good-ink">Saved · applies to jobs started from now on</span>}
        </div>
        <ErrorLine error={act.error} />
      </div>
    </Panel>
  );
}
