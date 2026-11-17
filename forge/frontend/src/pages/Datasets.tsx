import { useState } from "react";
import { StudySelect } from "../components/live";
import { Badge, Button, Empty, ErrorLine, Hash, KV, PageHeader, Panel, Prov, Readout, Status, cx } from "../components/ui";
import { api, fmt, qs } from "../lib/api";
import { useAction, useApi } from "../lib/hooks";
import { usePrefs } from "../lib/prefs";

interface Manifest { arm: string; data_policy: string; records: number; episodes_used: number; exclusions: Record<string, number>; eligible_task_ids: number; eligible_task_ids_sha256: string; records_sha256: string; created_at: string }
interface Rec { prompt_messages: { role: string; content: string }[]; completion: string; task_id: string; group_id: string; family: string; turn: number; trajectory_hash: string; source_model: string; record_sha256: string }

export default function Datasets() {
  const { prefs } = usePrefs();
  const sid = prefs.activeStudy;
  const ds = useApi<Manifest[]>(sid ? `/api/studies/${sid}/datasets` : null);
  const [arm, setArm] = useState<string | null>(null);
  const cur = ds.data?.find((d) => d.arm === arm) ?? ds.data?.[0] ?? null;
  return (
    <div className="space-y-4">
      <PageHeader kicker="Research" title="Dataset Factory" subtitle="One supervised record per assistant turn, with the loss restricted to the completion, an exact token-prefix check, and no truncation — an over-length record blocks the run. Every record links back to the trajectory that produced it."
        right={<StudySelect />} />
      <ErrorLine error={ds.error} />
      {!sid || !ds.data?.length ? <Panel><Empty icon="dataset">No dataset built yet. Run collect → build in Experiment Studio.</Empty></Panel> : (
        <>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {ds.data.map((d) => (
              <button key={d.arm} type="button" onClick={() => setArm(d.arm)} className={cx("reg rounded-[var(--radius)] border bg-surface p-[var(--pad)] text-left transition", cur?.arm === d.arm ? "border-accent" : "border-line hover:border-accent-line")}>
                <div className="flex items-center justify-between"><span className="font-mono text-[12px] font-medium text-ink">{d.arm}</span><Badge>{d.data_policy}</Badge></div>
                <div className="mt-3 grid grid-cols-2 gap-3"><Readout label="records" value={fmt.exact(d.records)} size="sm" /><Readout label="episodes" value={fmt.exact(d.episodes_used)} size="sm" /></div>
                <div className="mt-2 font-mono text-[10.5px] text-ink-3">sha {d.records_sha256.slice(0, 16)}</div>
              </button>
            ))}
          </div>
          {cur && <ArmDetail key={cur.arm} sid={sid} m={cur} />}
        </>
      )}
    </div>
  );
}

function ArmDetail({ sid, m }: { sid: string; m: Manifest }) {
  const [offset, setOffset] = useState(0);
  const recs = useApi<{ total: number; records: Rec[] }>(`/api/studies/${sid}/datasets/${m.arm}/records${qs({ offset, limit: 25 })}`);
  const [sel, setSel] = useState<Rec | null>(null);
  const verify = useAction();
  const [ver, setVer] = useState<{ ok: boolean; actual: string; expected: string } | null>(null);
  const excl = Object.entries(m.exclusions).sort((a, b) => b[1] - a[1]);
  const maxEx = Math.max(1, ...excl.map(([, v]) => v));
  return (
    <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <div className="space-y-4">
        <Panel title="Manifest" prov={<Prov kind="computed" source="manifest.json" />}>
          <KV rows={[["arm", m.arm], ["policy", m.data_policy], ["records", fmt.exact(m.records)], ["eligible tasks", `${m.eligible_task_ids} · shared by all arms`],
            ["eligible-ids sha", <Hash key="e" value={m.eligible_task_ids_sha256} />], ["records sha256", <Hash key="r" value={m.records_sha256} n={20} />], ["created", fmt.time(m.created_at)]]} />
          <div className="mt-3 flex items-center gap-3">
            <Button icon="check" busy={verify.busy} onClick={() => void verify.run(async () => setVer(await api.post(`/api/studies/${sid}/datasets/${m.arm}/verify`)))}>Verify sha256</Button>
            {ver && <Status s={ver.ok ? "pass" : "fail"} label={ver.ok ? "bytes match manifest" : "MISMATCH"} />}
          </div>
          <ErrorLine error={verify.error} />
        </Panel>
        <Panel title="Exclusions" prov={<Prov kind="computed" />}>
          {excl.length === 0 ? <div className="text-[12px] text-ink-3">Nothing excluded.</div> : (
            <ul className="space-y-2">{excl.map(([k, v]) => (
              <li key={k}><div className="flex justify-between text-[11.5px]"><span className="font-mono text-ink-2">{k.replace(/_/g, " ")}</span><span className="num font-mono text-ink">{v}</span></div>
                <div className="mt-1 h-[5px] rounded-full bg-surface-3"><div className="h-full rounded-full bg-[color:var(--ink-3)]" style={{ width: `${(v / maxEx) * 100}%` }} /></div></li>))}
            </ul>
          )}
        </Panel>
      </div>
      <div className="min-w-0 space-y-4">
        <Panel flush title="Records" prov={<Prov kind="measured" source="records.jsonl" />}
          right={recs.data && <div className="flex items-center gap-2"><span className="num font-mono text-[10.5px] text-ink-3">{offset + 1}–{Math.min(offset + 25, recs.data.total)} of {recs.data.total}</span>
            <Button size="sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 25))}>Prev</Button><Button size="sm" disabled={offset + 25 >= recs.data.total} onClick={() => setOffset(offset + 25)}>Next</Button></div>}>
          <ul className="divide-y divide-line">
            {recs.data?.records.map((r) => (
              <li key={r.record_sha256}>
                <button type="button" onClick={() => setSel(r)} className={cx("grid w-full grid-cols-[150px_60px_minmax(0,1fr)] items-center gap-3 px-[var(--pad)] py-2 text-left hover:bg-surface-2", sel?.record_sha256 === r.record_sha256 && "bg-accent-soft")}>
                  <span className="truncate font-mono text-[11px] text-ink">{r.task_id}</span><span className="font-mono text-[10.5px] text-ink-3">turn {r.turn}</span>
                  <span className="truncate font-mono text-[11px] text-ink-2">{r.completion}</span>
                </button>
              </li>
            ))}
          </ul>
        </Panel>
        {sel && (
          <Panel title="Provenance" eyebrow={sel.task_id} prov={<Prov kind="measured" />}>
            <KV rows={[["family / group", `${sel.family} · ${sel.group_id}`], ["turn", String(sel.turn)], ["source model", sel.source_model], ["trajectory", <Hash key="t" value={sel.trajectory_hash} n={20} label="trajectory hash" />], ["record", <Hash key="r" value={sel.record_sha256} n={20} />]]} />
            <div className="mt-3 space-y-1.5">
              <div className="micro text-ink-3">Prompt (masked from loss: label = −100)</div>
              {sel.prompt_messages.map((pm, i) => (
                <div key={i} className="rounded border border-line bg-surface-2 px-2.5 py-1.5"><span className="micro mr-2 text-ink-3">{pm.role}</span><span className="whitespace-pre-wrap break-words font-mono text-[11px] text-ink-3">{pm.content.length > 420 ? pm.content.slice(0, 420) + " …" : pm.content}</span></div>
              ))}
              <div className="micro pt-1 text-accent">Completion (supervised)</div>
              <div className="rounded border border-accent-line bg-accent-soft px-2.5 py-1.5 font-mono text-[11.5px] text-ink">{sel.completion}</div>
            </div>
          </Panel>
        )}
      </div>
    </div>
  );
}
