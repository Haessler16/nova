import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

export interface AsyncData<T> {
  data: T | null;
  loading: boolean;
  error: unknown;
  reload: () => void;
}

/**
 * Small loader hook for client pages. `key` must encode every input that
 * should trigger a refetch (tenant, filters). `reload` re-runs the loader.
 */
export function useAsyncData<T>(loader: () => Promise<T>, key: string): AsyncData<T> {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const [state, setState] = useState<{ data: T | null; loading: boolean; error: unknown }>({
    data: null,
    loading: true,
    error: null,
  });
  const [version, refresh] = useReducer((current: number) => current + 1, 0);

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({ data: current.data, loading: true, error: null }));

    loaderRef
      .current()
      .then((data) => {
        if (!cancelled) {
          setState({ data, loading: false, error: null });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({ data: null, loading: false, error });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [key, version]);

  const reload = useCallback(() => {
    refresh();
  }, []);

  return { ...state, reload };
}
