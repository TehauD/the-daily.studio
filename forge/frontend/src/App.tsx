import { useEffect, useState } from "react";
import { useApi } from "./lib/hooks";
import { Observatory } from "./pages/Observatory";
import { Overview } from "./pages/Overview";
import { DatasetFactory, ExperimentStudio, ModuleStatus } from "./pages/Registry";
import { SystemSettings } from "./pages/Settings";
import { TrainingLab } from "./pages/TrainingLab";

const NAV = [
  { key: "overview", label: "Overview", glyph: "◎" },
  { key: "observatory", label: "Model Observatory", glyph: "◉" },
  { key: "experiments", label: "Experiment Studio", glyph: "◇" },
  { key: "trajectories", label: "Trajectory Explorer", glyph: "⟿" },
  { key: "datasets", label: "Dataset Factory", glyph: "▤" },
  { key: "training", label: "Training Lab", glyph: "▲" },
  { key: "evaluation", label: "Evaluation Lab", glyph: "◫" },
  { key: "factory", label: "Model Factory", glyph: "⬢" },
  { key: "settings", label: "System Settings", glyph: "⚙" },
] as const;
type Key = (typeof NAV)[number]["key"];

function useHashRoute(): [Key, (k: Key) => void] {
  const read = () => (NAV.find((n) => `#/${n.key}` === window.location.hash)?.key ?? "overview") as Key;
  const [k, setK] = useState<Key>(read);
  useEffect(() => { const h = () => setK(read()); window.addEventListener("hashchange", h); return () => window.removeEventListener("hashchange", h); }, []);
  return [k, (next) => { window.location.hash = `/${next}`; }];
}

export default function App() {
  const [route, go] = useHashRoute();
  const health = useApi<{ status: string; version: string }>("/api/system/health", 15000);
  const page = {
    overview: <Overview />, observatory: <Observatory />, experiments: <ExperimentStudio />,
    trajectories: <ModuleStatus name="Trajectory Explorer" />, datasets: <DatasetFactory />, training: <TrainingLab />,
    evaluation: <ModuleStatus name="Evaluation Lab" />, factory: <ModuleStatus name="Model Factory" />, settings: <SystemSettings />,
  }[route];

  return (
    <div className="grid-bg flex h-full">
      <aside className="flex w-60 shrink-0 flex-col border-r border-edge bg-ink/95">
        <div className="px-5 py-5">
          <div className="font-mono text-lg font-semibold tracking-[0.3em] text-signal">FORGE</div>
          <div className="mt-0.5 text-[11px] leading-tight text-zinc-500">Local Model Intelligence &amp; Agent Distillation Laboratory</div>
        </div>
        <nav className="flex-1 space-y-0.5 px-2">
          {NAV.map((n) => (
            <button key={n.key} type="button" onClick={() => go(n.key)}
              className={`flex w-full items-center gap-3 rounded px-3 py-2 text-left text-sm transition ${route === n.key ? "bg-cyan/10 text-cyan" : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"}`}>
              <span className="w-4 text-center font-mono">{n.glyph}</span>{n.label}
            </button>
          ))}
        </nav>
        <div className="border-t border-edge px-5 py-3 font-mono text-[10px] text-zinc-500">
          <span className={health.data?.status === "ok" ? "text-signal" : "text-alert"}>●</span> API {health.data ? `v${health.data.version}` : health.error ? "offline" : "…"} · localhost
        </div>
      </aside>
      <main className="scroll-thin min-w-0 flex-1 overflow-y-auto px-6 py-6">{page}</main>
    </div>
  );
}
