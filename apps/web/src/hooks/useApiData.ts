import { useEffect, useState } from 'react';

export interface ApiData<T> {
  data: T;
  /** true when the API could not be reached and `data` is the demo fixture. */
  demo: boolean;
  loading: boolean;
}

/**
 * Loads real data; if the API is unreachable, falls back to a demo fixture and says so,
 * so the panel never passes demo numbers off as real (spec: demo state must be identified).
 */
export function useApiData<T>(load: () => Promise<T>, demoData: T): ApiData<T> {
  const [state, setState] = useState<ApiData<T>>({ data: demoData, demo: false, loading: true });

  useEffect(() => {
    let cancelled = false;
    load()
      .then(data => { if (!cancelled) setState({ data, demo: false, loading: false }); })
      .catch(() => { if (!cancelled) setState({ data: demoData, demo: true, loading: false }); });
    return () => { cancelled = true; };
    // load/demoData are stable module-level values at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return state;
}
