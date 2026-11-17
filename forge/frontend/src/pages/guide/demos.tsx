import { useMemo, useState } from "react";
import { Field, Prov } from "../../components/ui";

/* Deterministic PRNG so the illustration is stable between renders. */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return (s / 2 ** 32) * 2 - 1; };
}

function svdValues(M: number[][]): number[] {
  // Eigenvalues of MᵀM via Jacobi rotation (tiny matrices only) → singular values.
  const n = M[0].length;
  const A = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => M.reduce((s, row) => s + row[i] * row[j], 0)));
  for (let sweep = 0; sweep < 60; sweep++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      off += A[p][q] ** 2;
      if (Math.abs(A[p][q]) < 1e-12) continue;
      const th = (A[q][q] - A[p][p]) / (2 * A[p][q]);
      const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq; }
      for (let k = 0; k < n; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk; }
    }
    if (off < 1e-18) break;
  }
  return A.map((r, i) => Math.sqrt(Math.max(0, r[i]))).sort((a, b) => b - a);
}

export function LoraToy() {
  const [r, setR] = useState(4);
  const [alpha, setAlpha] = useState(8);
  const [decay, setDecay] = useState(0.6);
  const N = 12;
  const { dW, sigma } = useMemo(() => {
    const g = rng(7);
    const B = Array.from({ length: N }, () => Array.from({ length: r }, () => g()));
    const A = Array.from({ length: r }, (_, k) => Array.from({ length: N }, () => g() * decay ** k));
    const s = alpha / r;
    const dW = B.map((row) => Array.from({ length: N }, (_, j) => s * row.reduce((acc, b, k) => acc + b * A[k][j], 0)));
    return { dW, sigma: svdValues(dW).slice(0, N) };
  }, [r, alpha, decay]);
  const max = Math.max(1e-9, ...dW.flat().map(Math.abs));
  const fro = Math.sqrt(sigma.reduce((a, x) => a + x * x, 0));
  const sum = sigma.reduce((a, b) => a + b, 0);
  const eff = Math.exp(-sigma.filter((x) => x > 1e-9).reduce((a, x) => a + (x / sum) * Math.log(x / sum), 0));
  return (
    <div className="rounded-[var(--radius)] border border-dashed border-line-strong p-4">
      <div className="mb-3 flex items-center justify-between"><span className="text-[12.5px] font-medium text-ink">Interactive LoRA toy · 12×12 layer</span><Prov kind="illustration" source="random toy matrices, not your model" /></div>
      <div className="grid gap-5 md:grid-cols-[220px_1fr_220px]">
        <div className="space-y-3">
          <Field label={`rank r = ${r}`}><input type="range" min={1} max={8} value={r} onChange={(e) => setR(Number(e.target.value))} className="w-full accent-[var(--accent)]" /></Field>
          <Field label={`alpha α = ${alpha}  (scale s = α/r = ${(alpha / r).toFixed(2)})`}><input type="range" min={1} max={32} value={alpha} onChange={(e) => setAlpha(Number(e.target.value))} className="w-full accent-[var(--accent)]" /></Field>
          <Field label={`direction decay = ${decay.toFixed(2)}`} hint="Lower = energy concentrates in fewer directions."><input type="range" min={0.1} max={1} step={0.05} value={decay} onChange={(e) => setDecay(Number(e.target.value))} className="w-full accent-[var(--accent)]" /></Field>
        </div>
        <div>
          <div className="micro mb-1 text-ink-3">ΔW = s · B · A (blue +, red −)</div>
          <svg viewBox={`0 0 ${N * 14} ${N * 14}`} className="mx-auto h-44 w-44" role="img" aria-label="Toy weight-update matrix">
            {dW.map((row, i) => row.map((v, j) => (
              <rect key={`${i}-${j}`} x={j * 14} y={i * 14} width={13} height={13} rx={1.5}
                fill={v >= 0 ? "var(--div-pos)" : "var(--div-neg)"} opacity={0.12 + 0.88 * (Math.abs(v) / max)} />)))}
          </svg>
        </div>
        <div>
          <div className="micro mb-1 text-ink-3">singular values σ</div>
          <svg viewBox="0 0 200 90" className="w-full" role="img" aria-label="Singular values">
            <line x1={0} x2={200} y1={80} y2={80} stroke="var(--line-strong)" />
            {sigma.map((s, i) => <rect key={i} x={i * (200 / N) + 1} y={80 - (s / (sigma[0] || 1)) * 74} width={200 / N - 3} height={(s / (sigma[0] || 1)) * 74} rx={2} fill={i < r ? "var(--seq-2)" : "var(--surface-3)"} />)}
          </svg>
          <div className="num mt-1 space-y-0.5 font-mono text-[11px] text-ink-2"><div>‖ΔW‖_F = {fro.toFixed(3)}</div><div>effective rank = {eff.toFixed(2)} (≤ r = {r})</div><div>nonzero σ = {sigma.filter((x) => x > 1e-6).length}</div></div>
        </div>
      </div>
      <p className="mt-3 text-[12px] leading-relaxed text-ink-2">However large the layer, a rank-r adapter can only move it along r directions: σ beyond r are exactly zero. The Adapter Inspector computes these same quantities for real adapters — from an r×r core, without forming ΔW.</p>
    </div>
  );
}

const TOKENS: { t: string; mask: boolean }[] = [
  ..."<|im_start|>system ⏎ You are a catalog assistant… <|im_end|> <|im_start|>user ⏎ What is the unit price of SKU-4821? <|im_end|> <|im_start|>assistant ⏎".split(" ").map((t) => ({ t, mask: true })),
  ...'{"tool": "lookup", "arguments": {"sku": "SKU-4821"}} <|im_end|>'.split(" ").map((t) => ({ t, mask: false })),
];

export function TokenMask() {
  const [T, setT] = useState(1);
  const logits = [3.1, 2.2, 1.4, 0.3, -0.8];
  const labels = ['"lookup"', '"quote"', '"answer"', '"lookups"', '"Lookup"'];
  const ex = logits.map((l) => Math.exp(l / T));
  const Z = ex.reduce((a, b) => a + b, 0);
  return (
    <div className="space-y-4">
      <div className="rounded-[var(--radius)] border border-dashed border-line-strong p-4">
        <div className="mb-3 flex items-center justify-between"><span className="text-[12.5px] font-medium text-ink">Which tokens produce loss</span><Prov kind="illustration" source="schematic tokens" /></div>
        <div className="flex flex-wrap gap-1 font-mono text-[11px]">
          {TOKENS.map((x, i) => (
            <span key={i} className={x.mask ? "rounded bg-surface-3 px-1.5 py-0.5 text-ink-3 line-through decoration-ink-3/40" : "rounded border border-accent-line bg-accent-soft px-1.5 py-0.5 text-ink"}>{x.t}</span>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-[11.5px] text-ink-2">
          <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-surface-3 align-middle" />prompt · label −100 · no gradient</span>
          <span><span className="mr-1 inline-block h-2.5 w-2.5 rounded-sm border border-accent-line bg-accent-soft align-middle" />completion · cross-entropy</span>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-ink-2">FORGE asserts the prompt's tokens are an exact prefix of the full conversation's tokens before training. If a chat template breaks that, the record is rejected — never silently re-aligned. The <span className="font-mono">all_token_loss</span> ablation removes the mask; its loss curve is labeled non-comparable.</p>
      </div>
      <div className="rounded-[var(--radius)] border border-dashed border-line-strong p-4">
        <div className="mb-3 flex items-center justify-between"><span className="text-[12.5px] font-medium text-ink">Temperature softens a distribution (logit KD, post-MVP)</span><Prov kind="illustration" source="5 made-up logits" /></div>
        <Field label={`temperature T = ${T.toFixed(1)}`}><input type="range" min={0.3} max={4} step={0.1} value={T} onChange={(e) => setT(Number(e.target.value))} className="w-full max-w-sm accent-[var(--accent)]" /></Field>
        <ul className="mt-3 space-y-1">{labels.map((l, i) => (
          <li key={l} className="grid grid-cols-[90px_1fr_52px] items-center gap-2 font-mono text-[11px]"><span className="text-ink-2">{l}</span>
            <span className="h-2 rounded-full bg-surface-3"><span className="block h-full rounded-full bg-[color:var(--seq-2)]" style={{ width: `${(ex[i] / Z) * 100}%` }} /></span>
            <span className="num text-right text-ink">{((ex[i] / Z) * 100).toFixed(1)}%</span></li>))}
        </ul>
        <p className="mt-2 text-[12px] leading-relaxed text-ink-2">Logit distillation matches these softened distributions token by token. It needs identical vocabularies and full logits from both models — LM Studio GGUF teachers expose neither, so FORGE's MVP distills <em>behavior</em> (the teacher's verified actions) instead.</p>
      </div>
    </div>
  );
}

export function mcnemarP(b: number, c: number): number {
  const n = b + c;
  if (!n) return 1;
  const k = Math.min(b, c);
  let lgam = 0; const lf: number[] = [0];
  for (let i = 1; i <= n; i++) { lgam += Math.log(i); lf.push(lgam); }
  let tail = 0;
  for (let i = 0; i <= k; i++) tail += Math.exp(lf[n] - lf[i] - lf[n - i] - n * Math.LN2);
  return Math.min(1, 2 * tail);
}
