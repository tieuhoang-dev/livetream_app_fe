import { useEffect, useState } from "react";

export function useSubscription(api, command, payload, enabled = true, refresh = 0) {
  const key = JSON.stringify(payload);
  const [state, setState] = useState({ loading: enabled });
  useEffect(() => {
    if (!enabled) { setState({ loading: false }); return; }
    let active = true;
    setState((old) => ({ key, data: old.key === key ? old.data : undefined, loading: old.key !== key || !old.data }));
    const stop = api.subscribe(command, JSON.parse(key), {
      onData: (data) => { if (active) setState({ key, data, loading: false }); },
      onError: (error) => { if (active) setState((old) => ({ key, data: old.key === key ? old.data : undefined, error, loading: false })); },
    });
    return () => { active = false; stop(); };
  }, [api, command, key, enabled, refresh]);
  return state.key === key || !enabled ? state : { loading: true };
}
