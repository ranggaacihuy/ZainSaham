import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export function useAsync(fn, deps = [], { enabled = true } = {}) {
  const key = JSON.stringify(deps);
  const [state, setState] = useState({ key, enabled, data: undefined, error: null, loading: enabled });
  const callId = useRef(0);
  const fnRef = useRef(fn);

  useLayoutEffect(() => {
    fnRef.current = fn;
  });

  if (state.key !== key || state.enabled !== enabled) {
    setState({ key, enabled, data: undefined, error: null, loading: enabled });
  }

  const load = useCallback((options) => {
    const id = ++callId.current;
    return Promise.resolve()
      .then(() => fnRef.current(options))
      .then(
        (data) => {
          if (id === callId.current) setState((prev) => ({ ...prev, data, error: null, loading: false }));
          return data;
        },
        (error) => {
          if (id === callId.current) setState((prev) => ({ ...prev, data: undefined, error, loading: false }));
          return undefined;
        },
      );
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    load({});
    return () => {
      callId.current += 1;
    };
  }, [load, enabled, key]);

  const reload = useCallback(() => {
    setState((prev) => ({ ...prev, data: undefined, error: null, loading: true }));
    return load({ force: true });
  }, [load]);

  const setData = useCallback((updater) => {
    setState((prev) => ({
      ...prev,
      data: typeof updater === 'function' ? updater(prev.data) : updater,
    }));
  }, []);

  return { data: state.data, error: state.error, loading: state.loading, reload, setData };
}

export default useAsync;
