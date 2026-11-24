import { useId, useState, type ReactNode } from "react";

/** Plain-language meaning + precise definition for every symbol FORGE shows. Hover or focus a symbol to read it. */
export const MATH: Record<string, { sym: string; plain: string; exact: string }> = {
  W: { sym: "W", plain: "The original weight matrix of this layer part — fixed; training never changes it.", exact: "Base weight, shape out × in, read from the student's files." },
  dW: { sym: "ΔW", plain: "The change training added to this matrix. The model uses W + ΔW.", exact: "ΔW = s · B · A, shape out × in." },
  Wp: { sym: "W′", plain: "The matrix the trained model effectively uses.", exact: "W′ = W + ΔW. Only computed here for inspection; the base file is untouched." },
  s: { sym: "s", plain: "A fixed multiplier that sets how strongly the learned change is applied.", exact: "s = α / r (or α / √r with rsLoRA)." },
  alpha: { sym: "α", plain: "A training setting (LoRA alpha) that, with r, fixes the scale s.", exact: "lora_alpha from the adapter configuration." },
  r: { sym: "r", plain: "How many independent directions the change is allowed to use (the LoRA rank).", exact: "Inner dimension of B (out × r) and A (r × in)." },
  A: { sym: "A", plain: "One of the two small matrices LoRA actually learns — it reads the input.", exact: "A ∈ ℝ^{r × in}." },
  B: { sym: "B", plain: "The other small learned matrix — it writes the output. It starts at zero, so an untrained adapter changes nothing.", exact: "B ∈ ℝ^{out × r}, initialised to 0." },
  sigma: { sym: "σ", plain: "The strengths of the independent directions in a change, largest first.", exact: "Singular values: ΔW = Σᵢ σᵢ uᵢ vᵢᵀ." },
  qr: { sym: "thin QR", plain: "A shortcut that gets the exact σ of ΔW from small matrices, without building the large one.", exact: "B = Q_B R_B, Aᵀ = Q_A R_A; σ(ΔW) = σ(s · R_B R_Aᵀ), an r × r problem." },
  fro: { sym: "‖ΔW‖_F", plain: "The overall size of the change — one number for the whole matrix.", exact: "Frobenius norm: √(Σ of all squared entries) = √Σσᵢ²." },
  rel: { sym: "‖ΔW‖_F / ‖W‖_F", plain: "The size of the change compared with the size of the original weights.", exact: "Relative change; 0.01 means the change is 1 % of W's size." },
  effrank: { sym: "effective rank", plain: "How many directions the change really uses (1 = one direction does everything; r = all equally).", exact: "exp(H(p)), p = σ / Σσ, H = −Σ p log p (Shannon entropy)." },
  H: { sym: "H", plain: "A measure of how evenly the change is spread across its directions.", exact: "Shannon entropy H(p) = −Σ pᵢ log pᵢ." },
  part: { sym: "σᵢ uᵢ vᵢᵀ", plain: "One building block of the change: a single direction in, a single direction out, with strength σᵢ.", exact: "Rank-1 component i of the SVD of ΔW; its share = σᵢ² / Σσ²." },
  align: { sym: "share in W's top-k", plain: "How much of the change points along directions W already uses most. High = training reinforced existing directions; near the random baseline = new directions.", exact: "‖P_k ΔW‖_F² / ‖ΔW‖_F², P_k = projection onto W's top-k left (output) or right (input) singular vectors." },
  delta: { sym: "Δ = A − B", plain: "How much higher A's success rate is than B's on the same tasks, in percentage points. Negative = B is higher.", exact: "Mean over task groups of (A's rate − B's rate) in that group; a task's rate is the mean over that side's seeds." },
  wilson: { sym: "Wilson 95 %", plain: "The range the true success rate plausibly lies in, given how many tasks were run.", exact: "Wilson score interval for k successes in n tasks, z = 1.96." },
  boot: { sym: "bootstrap", plain: "Re-draw the task groups at random many times and see how much the result moves — the middle 95 % is the range.", exact: "Percentile bootstrap over task groups (paraphrases of one task stay together), 10 000 resamples, fixed seed." },
  mcnemar: { sym: "McNemar", plain: "Looks only at tasks where exactly one side was right, and asks whether that split is more lopsided than chance.", exact: "Exact two-sided binomial test on the discordant counts b (only A right) and c (only B right)." },
  signflip: { sym: "sign-flip p", plain: "How often a difference this large would appear if A and B were really the same and the labels were swapped at random.", exact: "Two-sided sign-flip permutation test on per-group differences (exact for ≤ 16 groups)." },
  cos: { sym: "cosine", plain: "How similar two changes are: 1 = identical direction, 0 = unrelated, −1 = opposite.", exact: "⟨ΔW₁, ΔW₂⟩ / (‖ΔW₁‖_F ‖ΔW₂‖_F), computed from the small factors." },
};

/** A hoverable / focusable symbol with its plain-language and exact meaning. */
export function Sym({ k, children }: { k: keyof typeof MATH | string; children?: ReactNode }) {
  const m = MATH[k];
  const id = useId();
  const [open, setOpen] = useState(false);
  if (!m) return <>{children}</>;
  return (
    <span className="relative inline-block" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-describedby={open ? id : undefined} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        className="inline-block min-w-[24px] cursor-help rounded-sm text-center border-b border-dotted border-accent font-mono text-inherit outline-none focus-visible:ring-2 focus-visible:ring-accent-soft">{children ?? m.sym}</button>
      {open && (
        <span role="tooltip" id={id} className="absolute left-0 top-full z-50 mt-1 w-[300px] max-w-[80vw] rounded-[var(--radius)] border border-line-strong bg-surface p-2.5 text-left font-sans text-[12px] font-normal normal-case leading-snug tracking-normal text-ink-2 shadow-lg">
          <b className="mb-0.5 block font-mono text-ink">{m.sym}</b>{m.plain}<span className="mt-1 block font-mono text-[11px] text-ink-3">{m.exact}</span>
        </span>)}
    </span>
  );
}
