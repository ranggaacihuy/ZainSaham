import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Jalankan fungsi async dan kelola state-nya.
 * `fn` dipanggil ulang setiap `deps` berubah. Hasil dari panggilan lama diabaikan.
 * Bila `enabled` false, fungsi tidak dipanggil dan state direset.
 *
 * @returns {{ data, error, loading, reload, setData }}
 */
export function useAsync(fn, deps = [], { enabled = true } = {}) {
  const [state, setState] = useState({ data: undefined, error: null, loading: enabled });
  const callId = useRef(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(
    (options = {}) => {
      const id = ++callId.current;
      if (!enabled) {
        setState({ data: undefined, error: null, loading: false });
        return Promise.resolve(undefined);
      }
      setState((prev) => ({ data: options.keepData ? prev.data : undefined, error: null, loading: true }));
      return Promise.resolve()
        .then(() => fnRef.current(options))
        .then(
          (data) => {
            if (id === callId.current) setState({ data, error: null, loading: false });
            return data;
          },
          (error) => {
            if (id === callId.current) setState({ data: undefined, error, loading: false });
            return undefined;
          },
        );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [enabled, ...deps],
  );

  useEffect(() => {
    run();
    return () => {
      callId.current += 1;
    };
  }, [run]);

  // reload() memaksa fetch ulang (melewati cache) bila fungsi mendukung opsi { force }.
  const reload = useCallback(() => run({ force: true }), [run]);
  const setData = useCallback((updater) => {
    setState((prev) => ({
      ...prev,
      data: typeof updater === 'function' ? updater(prev.data) : updater,
    }));
  }, []);

  return { data: state.data, error: state.error, loading: state.loading, reload, setData };
}

export default useAsync;

