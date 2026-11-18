import { useSubscription } from "./realtime/useSubscription";

export function useLiveList(api, query, refresh, enabled = true) {
  return useSubscription(api, "lives.subscribe", query || {}, enabled, refresh);
}
