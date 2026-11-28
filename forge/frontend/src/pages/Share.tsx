import { useState } from "react";
import { Limits } from "../components/results";
import { BundlePanel, PackInstall } from "../components/Share";
import { Button, Notice, PageHeader } from "../components/ui";
import { goto } from "../lib/handoff";
import { usePrefs } from "../lib/prefs";

/** Everything that leaves FORGE on purpose: use cases as task packs, results as reproducibility bundles. */
export default function Share() {
  const { prefs } = usePrefs();
  const [installed, setInstalled] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <PageHeader kicker="Share & decide" title="Share"
        subtitle="Send a use case as a task pack (data only, re-verified on arrival) or a study's results as a reproducibility bundle anyone can recompute." />
      <section aria-label="Results" className="space-y-2">
        <h2 className="text-[15px] font-semibold text-ink">Results — reproducibility bundles <span className="font-normal text-ink-3">for the study chosen in the top bar</span></h2>
        <BundlePanel sid={prefs.activeStudy ?? null} />
      </section>
      <section aria-label="Use cases" className="space-y-2">
        <h2 className="text-[15px] font-semibold text-ink">Use cases — task packs</h2>
        <p className="text-[12.5px] text-ink-2">To share one of your agents, open it in Agent Studio once its practice tasks are written and choose <b>Share as a task pack</b>.</p>
        <PackInstall onInstalled={(id) => setInstalled(id)} />
        {installed && <Notice tone="info">Installed as a new agent. <Button size="sm" onClick={() => goto("agent-studio")}>Open Agent Studio</Button></Notice>}
      </section>
      <Limits>Packs and bundles hold synthetic data only. Nothing is uploaded: you choose where the files go.</Limits>
    </div>
  );
}
