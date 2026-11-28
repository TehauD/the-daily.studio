import { useState } from "react";

/** Tab state kept in this page's memory (the hash route stays the page key). */
export function useHashParamless<T extends string>(initial: T): [T, (v: T) => void] {
  const [v, setV] = useState<T>(initial);
  return [v, setV];
}
