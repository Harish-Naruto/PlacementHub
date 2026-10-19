import { useCallback, useState } from "react";
import { applyToJobDetailed, errorMessage } from "../../api/match";

/** Apply to one job; keeps the busy / done / server-error state for the button. */
export function useApply(token: string | null, jobId: string | undefined) {
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback(async () => {
    if (!token || !jobId) return;
    setApplying(true);
    setError(null);
    try {
      await applyToJobDetailed(token, jobId);
      setApplied(true);
    } catch (e) {
      setError(errorMessage(e, "Failed to apply."));
    } finally {
      setApplying(false);
    }
  }, [token, jobId]);

  return { applying, applied, error, apply };
}
