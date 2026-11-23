import { useEffect, useState } from "react";
import { api, fmt } from "../lib/api";
import { useAction, useApi } from "../lib/hooks";
import type { StudySummary } from "../lib/types";
import { Badge, Button, ErrorLine, Field, Hash, Notice, Panel, Prov, Segmented, Status, Toggle, cx, inputCls } from "./ui";

interface Tools { ok: boolean; problems: string[]; convert: string | null; quantize: string | null; commit: string | null; dir?: string }
interface GExport { file: string; path: string; sha256: string; bytes: number; outtype: string; quant: string | null; created_at: string;
  header: { tensors: number; architecture: string; file_type: string | number; block_count: number | null; has_chat_template: boolean };
  installed: { path: string; lmstudio_id_hint: string } | null; converter: { commit: string | null };
  lmstudio_check: { model_id: string; tasks: number; success: number; merged_success: number | null; agreement_with_merged: number } | null }
interface Status_ { tools: Tools; merged_export: string | null; lmstudio_dir: string | null; exports: GExport[]; outtypes: string[]; quants: string[] }

/** Model Factory → GGUF for LM Studio: runs YOUR llama.cpp on the verified merged export, then checks the result in LM Studio. */
export function GGUFPanel({ s }: { s: StudySummary }) {
  const g = useApi<Status_>(`/api/studies/${s.id}/gguf`, 5000);
  const llama = useApi<Tools & { path: string }>("/api/settings/llama-cpp");
  const [dir, setDir] = useState("");
  useEffect(() => { if (llama.data) setDir(llama.data.path); }, [llama.data]);
  const [kind, setKind] = useState<string>("q8_0");
  const [install, setInstall] = useState(true);
  const [check, setCheck] = useState<Record<string, string>>({});
  const act = useAction();
  const d = g.data;
  const isQuant = d?.quants.includes(kind);
  return (
    <Panel title="GGUF for LM Studio" eyebrow="after SEAL · uses your llama.cpp" prov={<Prov kind="measured" source="llama.cpp + header read-back" />}
      right={d?.merged_export ? <Status s="pass" label="merged export ready" /> : <Status s="warn" label="needs Export" />}>
      <div className="space-y-4 text-[12.5px]">
        <p className="text-ink-2">Converts the <b className="text-ink">verified merged export</b> with llama.cpp's own converter (and <span className="font-mono">llama-quantize</span> for 4–6-bit), reads the file back, hashes it, and can place it in LM Studio's models folder. Then load it in LM Studio and run the check: quantization changes behaviour, and the check shows by how much on the sealed test.</p>
        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
          <Field label="llama.cpp folder (your checkout)" hint={llama.data?.ok ? `converter found${llama.data.quantize ? " · llama-quantize found" : " · llama-quantize not built (q8_0 / bf16 / f16 only)"}${llama.data.commit ? ` · commit ${llama.data.commit.slice(0, 10)}` : ""}` : "git clone https://github.com/ggml-org/llama.cpp — FORGE runs its convert_hf_to_gguf.py with FORGE's Python."}>
            <input className={inputCls} value={dir} onChange={(e) => setDir(e.target.value)} placeholder="C:\\tools\\llama.cpp" /></Field>
          <Button busy={act.busy} onClick={() => void act.run(async () => { await api.put("/api/settings/llama-cpp", { path: dir }); await llama.reload(); await g.reload(); })}>Save folder</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Segmented label="Format" value={kind} onChange={setKind} options={[...(d?.outtypes ?? ["q8_0", "bf16", "f16"]).map((v) => ({ value: v, label: v })), ...(d?.quants ?? []).map((v) => ({ value: v, label: v }))]} />
          <Toggle checked={install} onChange={setInstall} label={d?.lmstudio_dir ? "Copy into LM Studio's models folder" : "Copy into LM Studio (folder not found)"} />
          <Button tone="primary" icon="download" busy={act.busy} disabled={!d?.merged_export || !llama.data?.ok || (isQuant && !llama.data?.quantize)}
            onClick={() => void act.run(async () => { await api.post(`/api/studies/${s.id}/gguf`, isQuant ? { outtype: "f16", quant: kind, install } : { outtype: kind, install }); await g.reload(); })}>Make GGUF</Button>
        </div>
        <div className="text-[11.5px] text-ink-3">q8_0 ≈ half the size of bf16 with very small changes; Q4_K_M ≈ a quarter, faster, and changes behaviour more. Sizes are for the 1.7B student.</div>
        {!d?.merged_export && <Notice tone="info">Run the study through SEAL, the test analysis and the Export stage first — GGUF is only made from the export that was checked against the adapter.</Notice>}
        {d?.exports.map((x) => (
          <div key={x.file} className="rounded-[var(--radius)] border border-line p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-ink">{x.file}</span>
              <span className="flex gap-1.5"><Badge>{String(x.header.file_type)}</Badge><Badge>{fmt.mb(x.bytes / 2 ** 20)}</Badge>{x.installed ? <Badge tone="good">in LM Studio</Badge> : null}</span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-ink-2">
              <span>{x.header.architecture} · {x.header.tensors} tensors{x.header.block_count ? ` · ${x.header.block_count} layers` : ""}</span>
              <span className={x.header.has_chat_template ? "" : "text-crit-ink"}>{x.header.has_chat_template ? "chat template included" : "no chat template"}</span>
              <span>sha256 <Hash value={x.sha256} /></span>{x.converter.commit && <span>llama.cpp {x.converter.commit.slice(0, 10)}</span>}
            </div>
            {x.installed && <div className="mt-1 break-all font-mono text-[11px] text-ink-3">{x.installed.path}</div>}
            {x.lmstudio_check ? (
              <div className="mt-2 grid grid-cols-3 gap-2 border-t border-line pt-2 text-center">
                <div><div className="num font-mono text-[15px]">{fmt.pct(x.lmstudio_check.success)}</div><div className="micro !text-[9px] text-ink-3">GGUF in LM Studio</div></div>
                <div><div className="num font-mono text-[15px]">{x.lmstudio_check.merged_success == null ? "—" : fmt.pct(x.lmstudio_check.merged_success)}</div><div className="micro !text-[9px] text-ink-3">merged export</div></div>
                <div><div className={cx("num font-mono text-[15px]", x.lmstudio_check.agreement_with_merged < 0.9 ? "text-crit-ink" : "text-good-ink")}>{fmt.pct(x.lmstudio_check.agreement_with_merged)}</div><div className="micro !text-[9px] text-ink-3">same outcome per task</div></div>
              </div>
            ) : (
              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-line pt-2">
                <span className="text-ink-3">Load it in LM Studio, then:</span>
                <input className={cx(inputCls, "!w-64")} placeholder={x.installed?.lmstudio_id_hint ?? "model id shown in LM Studio"} value={check[x.file] ?? ""} onChange={(e) => setCheck({ ...check, [x.file]: e.target.value })} aria-label="LM Studio model id" />
                <Button size="sm" busy={act.busy} disabled={!(check[x.file] ?? "").trim()} onClick={() => void act.run(async () => { await api.post(`/api/studies/${s.id}/gguf/check`, { file: x.file, model_id: check[x.file].trim() }); })}>Run test-set check</Button>
              </div>
            )}
          </div>))}
        <ErrorLine error={act.error ?? g.error} />
      </div>
    </Panel>
  );
}
