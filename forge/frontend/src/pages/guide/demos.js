import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from "react";
import { Field, Prov } from "../../components/ui";
/* Deterministic PRNG so the illustration is stable between renders. */
function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return (s / 2 ** 32) * 2 - 1; };
}
function svdValues(M) {
    // Eigenvalues of MᵀM via Jacobi rotation (tiny matrices only) → singular values.
    const n = M[0].length;
    const A = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => M.reduce((s, row) => s + row[i] * row[j], 0)));
    for (let sweep = 0; sweep < 60; sweep++) {
        let off = 0;
        for (let p = 0; p < n; p++)
            for (let q = p + 1; q < n; q++) {
                off += A[p][q] ** 2;
                if (Math.abs(A[p][q]) < 1e-12)
                    continue;
                const th = (A[q][q] - A[p][p]) / (2 * A[p][q]);
                const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
                const c = 1 / Math.sqrt(t * t + 1), s = t * c;
                for (let k = 0; k < n; k++) {
                    const akp = A[k][p], akq = A[k][q];
                    A[k][p] = c * akp - s * akq;
                    A[k][q] = s * akp + c * akq;
                }
                for (let k = 0; k < n; k++) {
                    const apk = A[p][k], aqk = A[q][k];
                    A[p][k] = c * apk - s * aqk;
                    A[q][k] = s * apk + c * aqk;
                }
            }
        if (off < 1e-18)
            break;
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
    return (_jsxs("div", { className: "rounded-[var(--radius)] border border-dashed border-line-strong p-4", children: [_jsxs("div", { className: "mb-3 flex items-center justify-between", children: [_jsx("span", { className: "text-[12.5px] font-medium text-ink", children: "Interactive LoRA toy \u00B7 12\u00D712 layer" }), _jsx(Prov, { kind: "illustration", source: "random toy matrices, not your model" })] }), _jsxs("div", { className: "grid gap-5 md:grid-cols-[220px_1fr_220px]", children: [_jsxs("div", { className: "space-y-3", children: [_jsx(Field, { math: true, label: `rank r = ${r}`, children: _jsx("input", { type: "range", min: 1, max: 8, value: r, onChange: (e) => setR(Number(e.target.value)), className: "w-full accent-[var(--accent)]" }) }), _jsx(Field, { math: true, label: `alpha α = ${alpha}  (scale s = α/r = ${(alpha / r).toFixed(2)})`, children: _jsx("input", { type: "range", min: 1, max: 32, value: alpha, onChange: (e) => setAlpha(Number(e.target.value)), className: "w-full accent-[var(--accent)]" }) }), _jsx(Field, { math: true, label: `direction decay = ${decay.toFixed(2)}`, hint: "Lower = energy concentrates in fewer directions.", children: _jsx("input", { type: "range", min: 0.1, max: 1, step: 0.05, value: decay, onChange: (e) => setDecay(Number(e.target.value)), className: "w-full accent-[var(--accent)]" }) })] }), _jsxs("div", { children: [_jsx("div", { className: "micro mb-1 !normal-case !tracking-normal text-ink-3", children: "\u0394W = s \u00B7 B \u00B7 A (blue +, red \u2212)" }), _jsx("svg", { viewBox: `0 0 ${N * 14} ${N * 14}`, className: "mx-auto h-44 w-44", role: "img", "aria-label": "Toy weight-update matrix", children: dW.map((row, i) => row.map((v, j) => (_jsx("rect", { x: j * 14, y: i * 14, width: 13, height: 13, rx: 1.5, fill: v >= 0 ? "var(--div-pos)" : "var(--div-neg)", opacity: 0.12 + 0.88 * (Math.abs(v) / max) }, `${i}-${j}`)))) })] }), _jsxs("div", { children: [_jsx("div", { className: "micro mb-1 !normal-case !tracking-normal text-ink-3", children: "singular values \u03C3" }), _jsxs("svg", { viewBox: "0 0 200 90", className: "w-full", role: "img", "aria-label": "Singular values", children: [_jsx("line", { x1: 0, x2: 200, y1: 80, y2: 80, stroke: "var(--line-strong)" }), sigma.map((s, i) => _jsx("rect", { x: i * (200 / N) + 1, y: 80 - (s / (sigma[0] || 1)) * 74, width: 200 / N - 3, height: (s / (sigma[0] || 1)) * 74, rx: 2, fill: i < r ? "var(--seq-2)" : "var(--surface-3)" }, i))] }), _jsxs("div", { className: "num mt-1 space-y-0.5 font-mono text-[11px] text-ink-2", children: [_jsxs("div", { children: ["\u2016\u0394W\u2016_F = ", fro.toFixed(3)] }), _jsxs("div", { children: ["effective rank = ", eff.toFixed(2), " (\u2264 r = ", r, ")"] }), _jsxs("div", { children: ["nonzero \u03C3 = ", sigma.filter((x) => x > 1e-6).length] })] })] })] }), _jsx("p", { className: "mt-3 text-[12px] leading-relaxed text-ink-2", children: "However large the layer, a rank-r adapter can only move it along r directions: \u03C3 beyond r are exactly zero. The Adapter Inspector computes these same quantities for real adapters \u2014 from an r\u00D7r core, without forming \u0394W." })] }));
}
const TOKENS = [
    ..."<|im_start|>system ⏎ You are a catalog assistant… <|im_end|> <|im_start|>user ⏎ What is the unit price of SKU-4821? <|im_end|> <|im_start|>assistant ⏎".split(" ").map((t) => ({ t, mask: true })),
    ...'{"tool": "lookup", "arguments": {"sku": "SKU-4821"}} <|im_end|>'.split(" ").map((t) => ({ t, mask: false })),
];
export function TokenMask() {
    const [T, setT] = useState(1);
    const logits = [3.1, 2.2, 1.4, 0.3, -0.8];
    const labels = ['"lookup"', '"quote"', '"answer"', '"lookups"', '"Lookup"'];
    const ex = logits.map((l) => Math.exp(l / T));
    const Z = ex.reduce((a, b) => a + b, 0);
    return (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "rounded-[var(--radius)] border border-dashed border-line-strong p-4", children: [_jsxs("div", { className: "mb-3 flex items-center justify-between", children: [_jsx("span", { className: "text-[12.5px] font-medium text-ink", children: "Which tokens produce loss" }), _jsx(Prov, { kind: "illustration", source: "schematic tokens" })] }), _jsx("div", { className: "flex flex-wrap gap-1 font-mono text-[11px]", children: TOKENS.map((x, i) => (_jsx("span", { className: x.mask ? "rounded bg-surface-3 px-1.5 py-0.5 text-ink-3 line-through decoration-ink-3/40" : "rounded border border-accent-line bg-accent-soft px-1.5 py-0.5 text-ink", children: x.t }, i))) }), _jsxs("div", { className: "mt-3 flex flex-wrap gap-4 text-[11.5px] text-ink-2", children: [_jsxs("span", { children: [_jsx("span", { className: "mr-1 inline-block h-2.5 w-2.5 rounded-sm bg-surface-3 align-middle" }), "prompt \u00B7 label \u2212100 \u00B7 no gradient"] }), _jsxs("span", { children: [_jsx("span", { className: "mr-1 inline-block h-2.5 w-2.5 rounded-sm border border-accent-line bg-accent-soft align-middle" }), "completion \u00B7 cross-entropy"] })] }), _jsxs("p", { className: "mt-2 text-[12px] leading-relaxed text-ink-2", children: ["FORGE asserts the prompt's tokens are an exact prefix of the full conversation's tokens before training. If a chat template breaks that, the record is rejected \u2014 never silently re-aligned. The ", _jsx("span", { className: "font-mono", children: "all_token_loss" }), " ablation removes the mask; its loss curve is labeled non-comparable."] })] }), _jsxs("div", { className: "rounded-[var(--radius)] border border-dashed border-line-strong p-4", children: [_jsxs("div", { className: "mb-3 flex items-center justify-between", children: [_jsx("span", { className: "text-[12.5px] font-medium text-ink", children: "Temperature softens a distribution (logit KD, post-MVP)" }), _jsx(Prov, { kind: "illustration", source: "5 made-up logits" })] }), _jsx(Field, { math: true, label: `temperature T = ${T.toFixed(1)}`, children: _jsx("input", { type: "range", min: 0.3, max: 4, step: 0.1, value: T, onChange: (e) => setT(Number(e.target.value)), className: "w-full max-w-sm accent-[var(--accent)]" }) }), _jsx("ul", { className: "mt-3 space-y-1", children: labels.map((l, i) => (_jsxs("li", { className: "grid grid-cols-[90px_1fr_52px] items-center gap-2 font-mono text-[11px]", children: [_jsx("span", { className: "text-ink-2", children: l }), _jsx("span", { className: "h-2 rounded-full bg-surface-3", children: _jsx("span", { className: "block h-full rounded-full bg-[color:var(--seq-2)]", style: { width: `${(ex[i] / Z) * 100}%` } }) }), _jsxs("span", { className: "num text-right text-ink", children: [((ex[i] / Z) * 100).toFixed(1), "%"] })] }, l))) }), _jsxs("p", { className: "mt-2 text-[12px] leading-relaxed text-ink-2", children: ["Logit distillation matches these softened distributions token by token. It needs identical vocabularies and full logits from both models \u2014 LM Studio GGUF teachers expose neither, so FORGE's MVP distills ", _jsx("em", { children: "behavior" }), " (the teacher's verified actions) instead."] })] })] }));
}
export function mcnemarP(b, c) {
    const n = b + c;
    if (!n)
        return 1;
    const k = Math.min(b, c);
    let lgam = 0;
    const lf = [0];
    for (let i = 1; i <= n; i++) {
        lgam += Math.log(i);
        lf.push(lgam);
    }
    let tail = 0;
    for (let i = 0; i <= k; i++)
        tail += Math.exp(lf[n] - lf[i] - lf[n - i] - n * Math.LN2);
    return Math.min(1, 2 * tail);
}
