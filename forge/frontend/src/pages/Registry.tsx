import { Badge, Empty, ErrorLine, PageHeader, Panel } from "../components/ui";
import { fmt } from "../lib/api";
import { useApi } from "../lib/hooks";

interface ExperimentRow { id: string; name: string; kind: string; created_at: string; config_hash: string; run_count: number; last_status: string | null }
interface DatasetRow { id: string; name: string; version: number; format: string; record_count: number; created_at: string; sha256: string; manifest: { counts: { train: number; heldout: number } } }

export function ExperimentStudio() {
  const ex = useApi<ExperimentRow[]>("/api/experiments", 10000);
  return (
    <div className="space-y-4">
      <PageHeader title="Experiment Studio" subtitle="Versioned experiment registry. Every run records config hash, state transitions, checkpoints, and artifacts." />
      <ErrorLine error={ex.error} />
      <Panel title="Experiments">
        {!ex.data?.length ? <Empty>No experiments yet. Teacher-agent runs are created here in Phase 2.</Empty> : (
          <table className="w-full text-sm">
            <thead className="font-mono text-[10px] uppercase tracking-wider text-zinc-500"><tr><th className="py-2 text-left">Name</th><th className="text-left">Kind</th><th className="text-left">Runs</th><th className="text-left">Last status</th><th className="text-left">Config</th><th className="text-left">Created</th></tr></thead>
            <tbody>{ex.data.map((e) => (
              <tr key={e.id} className="border-t border-edge/70">
                <td className="py-2">{e.name}</td><td><Badge>{e.kind}</Badge></td><td className="font-mono text-xs">{e.run_count}</td>
                <td>{e.last_status ? <Badge tone={e.last_status === "completed" ? "signal" : e.last_status === "failed" ? "alert" : "cyan"}>{e.last_status}</Badge> : "—"}</td>
                <td className="font-mono text-xs text-zinc-500">{e.config_hash.slice(0, 12)}</td><td className="text-xs text-zinc-500">{fmt.time(e.created_at)}</td>
              </tr>))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}

export function DatasetFactory() {
  const ds = useApi<DatasetRow[]>("/api/datasets", 10000);
  return (
    <div className="space-y-4">
      <PageHeader title="Dataset Factory" subtitle="Immutable JSONL versions with sha256 manifests, provenance sidecars, and task-level held-out splits." />
      <ErrorLine error={ds.error} />
      <Panel title="Dataset versions">
        {!ds.data?.length ? <Empty>No datasets yet. Approved trajectories become chat, tool-calling, instruction, preference, or teacher/student datasets in Phase 2.</Empty> : (
          <table className="w-full text-sm">
            <thead className="font-mono text-[10px] uppercase tracking-wider text-zinc-500"><tr><th className="py-2 text-left">Name</th><th className="text-left">Version</th><th className="text-left">Format</th><th className="text-left">Train / held-out</th><th className="text-left">sha256</th></tr></thead>
            <tbody>{ds.data.map((d) => (
              <tr key={d.id} className="border-t border-edge/70">
                <td className="py-2">{d.name}</td><td className="font-mono text-xs">v{d.version}</td><td><Badge>{d.format}</Badge></td>
                <td className="font-mono text-xs">{d.manifest.counts.train} / {d.manifest.counts.heldout}</td><td className="font-mono text-xs text-zinc-500">{d.sha256.slice(0, 12)}</td>
              </tr>))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}

const MODULES: Record<string, { phase: number; subtitle: string; contracts: string[]; next: string[] }> = {
  "Trajectory Explorer": { phase: 2, subtitle: "Inspect, compare, label, and approve teacher executions.",
    contracts: ["Trajectory schema v1 (events, tool calls, results, usage, timing)", "Hidden-reasoning stripping at ingest", "Review model: label · score · flags · approval rules", "Lossless JSONL serialization + content hash"],
    next: ["Timeline view of events", "Side-by-side attempt comparison", "Bulk labeling and approval"] },
  "Evaluation Lab": { phase: 4, subtitle: "Repeatable suites comparing teacher, base student, and fine-tuned student.",
    contracts: ["Task-hash held-out splits (no train/eval leakage)", "Per-trajectory evaluation payload", "Run metrics persisted per attempt"],
    next: ["Task completion · correctness · tool-argument accuracy", "Latency, tokens, peak VRAM", "Regression deltas across versions"] },
  "Model Factory": { phase: 3, subtitle: "Adapter export, merging, GGUF conversion, and Ollama deployment — originals never modified.",
    contracts: ["Artifact registry with sha256 + parent lineage", "Immutable artifact paths", "Capability flags for GGUF export and Ollama deploy"],
    next: ["PEFT adapter export + versioning", "Merge into new directory", "llama.cpp GGUF conversion · Ollama Modelfile"] },
};

export function ModuleStatus({ name }: { name: keyof typeof MODULES }) {
  const m = MODULES[name];
  return (
    <div className="space-y-4">
      <PageHeader title={name} subtitle={m.subtitle} right={<Badge tone="cyan">Phase {m.phase}</Badge>} />
      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Implemented contracts (tested)"><ul className="space-y-1.5 text-sm text-zinc-300">{m.contracts.map((c) => <li key={c}><span className="text-signal">■</span> {c}</li>)}</ul></Panel>
        <Panel title={`Ships in Phase ${m.phase}`}><ul className="space-y-1.5 text-sm text-zinc-500">{m.next.map((c) => <li key={c}>□ {c}</li>)}</ul></Panel>
      </div>
    </div>
  );
}
