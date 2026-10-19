import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";

interface Result<T> {
  load: unknown;
  nonce: number;
  data?: T;
  error?: unknown;
}

/**
 * Loads data with the signed-in token. `load` must be stable (wrap it in useCallback); when it changes
 * (for example a filter changed) the data is fetched again and the previous data stays visible meanwhile.
 */
export function useApi<T>(load: (token: string) => Promise<T>) {
  const { accessToken } = useAuth();
  const [nonce, setNonce] = useState(0);
  const [res, setRes] = useState<Result<T> | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    load(accessToken)
      .then((data) => {
        if (!cancelled) setRes({ load, nonce, data });
      })
      .catch((error: unknown) => {
        if (!cancelled) setRes({ load, nonce, error });
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, load, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const current = res !== null && res.load === load && res.nonce === nonce;
  return {
    data: res?.data,
    error: current ? res.error : undefined,
    loading: !current,
    reload,
  };
}
