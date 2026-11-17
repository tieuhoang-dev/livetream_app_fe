import { useEffect, useState } from "react";

export function useLiveList(api, query, refresh, enabled = true) {
  const queryKey = JSON.stringify(query || {});
  const [state, setState] = useState({ loading: enabled });
  useEffect(() => {
    if (!enabled) {
      setState({ loading: false });
      return;
    }
    let active = true;
    setState((previous) => ({ data: previous.data, loading: !previous.data }));
    const unsubscribe = api.subscribeLives(JSON.parse(queryKey), {
      onData: (data) => { if (active) setState({ data, loading: false }); },
      onError: (error) => { if (active) setState((previous) => ({ data: previous.data, error, loading: false })); },
    });
    return () => { active = false; unsubscribe(); };
  }, [api, queryKey, refresh, enabled]);
  return state;
}
