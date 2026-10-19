import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { errMsg } from "./ui";

interface Settled<T> {
  fetcher: unknown;
  nonce: number;
  data: T | null;
  error: string | null;
}

/**
 * Runs `fetcher(token)` whenever its identity changes (wrap it in useCallback with the filters as dependencies).
 * Stale answers are dropped, the last data stays visible while a new request runs, and `reload()` refetches.
 */
export function useQuery<T>(fetcher: (token: string) => Promise<T>) {
  const { accessToken } = useAuth();
  const [nonce, setNonce] = useState(0);
  const [settled, setSettled] = useState<Settled<T> | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let live = true;
    fetcher(accessToken)
      .then((data) => live && setSettled({ fetcher, nonce, data, error: null }))
      .catch((e) => live && setSettled((prev) => ({ fetcher, nonce, data: prev?.data ?? null, error: errMsg(e) })));
    return () => {
      live = false;
    };
  }, [accessToken, fetcher, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const loading = settled === null || settled.fetcher !== fetcher || settled.nonce !== nonce;
  return { data: settled?.data ?? null, error: loading ? null : (settled?.error ?? null), loading, reload };
}
