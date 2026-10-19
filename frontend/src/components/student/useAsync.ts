import { useEffect, useRef, useState } from "react";

/**
 * Runs `fn` whenever `key` changes (or `reload()` is called) and exposes loading / data / error.
 * `fn` may read the latest props and state; only `key` decides when it runs again.
 */
export function useAsync<T>(fn: () => Promise<T>, key: string) {
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });
  const [tick, setTick] = useState(0);
  const [res, setRes] = useState<{ key: string; data?: T; error?: unknown } | null>(null);
  const full = `${key}#${tick}`;

  useEffect(() => {
    let live = true;
    fnRef.current().then(
      (data) => live && setRes({ key: full, data }),
      (error: unknown) => live && setRes({ key: full, error }),
    );
    return () => {
      live = false;
    };
  }, [full]);

  const current = res?.key === full ? res : null;
  return {
    loading: current === null,
    data: current?.data,
    error: current?.error,
    reload: () => setTick((t) => t + 1),
  };
}
