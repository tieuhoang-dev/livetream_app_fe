import { demoRequest, demoLiveCommand, demoCreateLiveProduct } from "../demo";

export async function demoCommand(type, data = {}) {
  switch (type) {
    case "lives.list": return demoRequest("/api/livestreams", { query: data });
    case "live.create": return demoLiveCommand("create_live", data.title);
    case "live.end": return demoLiveCommand("end_live", data.livestream_id);
    case "live.products.create": return demoCreateLiveProduct(data);
    case "live.products.add": return demoRequest(`/api/livestreams/${data.livestream_id}/products`, { method: "POST", body: data });
    case "live.products.remove": return demoRequest(`/api/livestreams/${data.livestream_id}/products/${data.product_id}`, { method: "DELETE" });
    case "comments.send": return demoRequest(`/api/livestreams/${data.livestream_id}/comments`, { method: "POST", body: data });
    case "shipping.quote": return demoRequest("/api/orders/quote", { method: "POST", body: data });
    default: throw new Error("Tính năng này cần backend đang hoạt động.");
  }
}
export function demoSubscribe(type, payload, { onData, onError }) {
  const read = () => {
    const data = typeof payload === "function" ? payload() : payload;
    try {
      if (type === "shipping.origin.subscribe") return;
      if (type === "lives.subscribe") onData(demoRequest("/api/livestreams", { query: data }));
      else if (type === "live.subscribe") onData({ live: demoRequest(`/api/livestreams/${data.livestream_id}`), products: demoRequest(`/api/livestreams/${data.livestream_id}/products`, { query: data }) });
      else if (type === "comments.subscribe") onData(demoRequest(`/api/livestreams/${data.livestream_id}/comments`, { query: { after: data.after || "0" } }));
    } catch (err) { onError?.(err); }
  };
  window.addEventListener("livemart-demo-change", read); read();
  return () => window.removeEventListener("livemart-demo-change", read);
}
