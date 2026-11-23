import { useState } from "react";

/** The person recording reviews and decisions. Stored only in this browser (FORGE has no user accounts). */
const KEY = "forge.reviewer";
export function useReviewer(): [string, (v: string) => void] {
  const [v, setV] = useState<string>(() => { try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; } });
  return [v, (x: string) => { setV(x); try { localStorage.setItem(KEY, x); } catch { /* private mode: keep in memory */ } }];
}
