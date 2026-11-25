import { useCallback, useEffect, useState } from "react";
import { getErrorMessage } from "../services/api";

/**
 * Load data from the API.  const { data, loading, error, reload } = useFetch(() => api.list(), [deps])
 * Pass `enabled = false` to skip fetching until a condition is met.
 */
export default function useFetch(fetcher, deps = [], enabled = true) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");

  const run = useCallback(() => {
    if (!enabled) {
      setData(null);
      setLoading(false);
      return Promise.resolve();
    }
    setLoading(true);
    setError("");
    return fetcher()
      .then((result) => setData(result))
      .catch((err) => setError(getErrorMessage(err)))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled]);

  useEffect(() => {
    run();
  }, [run]);

  return { data, loading, error, reload: run, setData };
}
