import { useState } from "react";
/** The person recording reviews and decisions. Stored only in this browser (FORGE has no user accounts). */
const KEY = "forge.reviewer";
export function useReviewer() {
    const [v, setV] = useState(() => { try {
        return localStorage.getItem(KEY) ?? "";
    }
    catch {
        return "";
    } });
    return [v, (x) => { setV(x); try {
            localStorage.setItem(KEY, x);
        }
        catch { /* private mode: keep in memory */ } }];
}
