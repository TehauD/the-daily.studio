/** One-shot hand-off between pages (e.g. Home → "open this agent"). Read once, then cleared. */
const K = "forge.handoff.";

export function handoff(key: string, value: string): void {
  try { sessionStorage.setItem(K + key, value); } catch { /* storage blocked: the page opens on its default */ }
}

export function takeHandoff(key: string): string | null {
  // Cleared on the next tick, so React's double-invoked state initialisers (StrictMode) both see the value.
  try { const v = sessionStorage.getItem(K + key); if (v !== null) setTimeout(() => { try { sessionStorage.removeItem(K + key); } catch { /* ignore */ } }, 0); return v; } catch { return null; }
}

export function goto(route: string): void { window.location.hash = `/${route}`; }
