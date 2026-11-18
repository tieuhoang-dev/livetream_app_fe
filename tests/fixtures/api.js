// Shared in-memory backend for UI tests. Realtime actions travel only over
// /api/ws. `path` on recorded writes is a domain label retained by assertions;
// `transport` and `command` record what actually traveled on the wire.
export const roomID = "11111111-1111-4111-8111-111111111111";
export const sellerID = "22222222-2222-4222-8222-222222222222";
export const productID = "33333333-3333-4333-8333-333333333333";
export const buyerID = "44444444-4444-4444-8444-444444444444";
export const receiver = { name: "Người nhận thử", phone: "0901234567", province_code: "1", ward: "Phường thử", address_line: "12 Đường thử", latitude: null, longitude: null, carrier_province_id: 1, carrier_district_id: 100, carrier_ward_code: "ward-100" };
const json = (route, data, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
export async function mockSocket(page, dispatch) {
  const peers = new Set(), frames = [];
  await page.routeWebSocket("**/api/ws", (socket) => {
    const peer = { socket, subscriptions: new Map() }; peers.add(peer);
    const send = (data) => { try { socket.send(JSON.stringify(data)); } catch {} };
    peer.send = send;
    socket.onClose?.(() => peers.delete(peer));
    socket.onMessage(async (raw) => {
      const frame = JSON.parse(raw); frames.push(frame);
      if (frame.type === "unsubscribe") { peer.subscriptions.delete(frame.subscription_id); send({ type: "result", request_id: frame.request_id, data: { unsubscribed: true } }); return; }
      if (frame.type.endsWith(".subscribe")) peer.subscriptions.set(frame.subscription_id, frame);
      const out = await dispatch(frame, peer) || { data: {} };
      send({ type: "result", request_id: frame.request_id, ...(out.status >= 400 ? { error: out.data.error, status: out.status } : { data: out.data ?? { subscribed: true } }) });
      if (out.snapshot !== undefined && peer.subscriptions.has(frame.subscription_id)) send({ type: "event", subscription_id: frame.subscription_id, event: "snapshot", data: out.snapshot });
    });
  });
  return { peers, frames, publish(type, data, event = "snapshot") { for (const peer of peers) for (const [id, frame] of peer.subscriptions) if (frame.type === type) peer.send({ type: "event", subscription_id: id, event, data: typeof data === "function" ? data(frame.payload) : data }); } };
}
export async function mockAPI(page, owner = false, signedIn = owner) {
  const writes = [], overrides = new Map();
  let shipping = { pickup_address: { ...receiver, name: "Chủ shop", province_name: "Thành phố Hà Nội" } }, livePickup = null;
  const room = { id: roomID, title: "Phòng kiểm tra API", seller_id: sellerID, seller_username: "Shop kiểm tra", status: "start", started_at: new Date().toISOString() };
  const item = { id: "allocation", product_id: productID, name: "Sản phẩm kiểm tra", stock_quantity: 5, discount_price: 80000, original_price: 100000, is_pinned: true };
  let comments = [];
  const profile = { user_id: owner ? sellerID : buyerID, username: owner ? "Chủ shop" : "Người mua", exp: Math.floor(Date.now() / 1000) + 3600 };
  const token = "ui-fixture." + Buffer.from(JSON.stringify(profile)).toString("base64url") + ".fixture";
  await page.addInitScript(({ token, signedIn }) => { sessionStorage.setItem("livemart-mode", "api"); if (signedIn) sessionStorage.setItem("livemart-token", token); }, { token, signedIn });
  const roomSnapshot = (data) => ({ live: { ...room }, products: { data: [{ ...item }], total: 1, page: data.page || 1, page_size: data.page_size || 12 }, shipping_origin: livePickup?.station_id ? { mode: "station_dropoff", station_name: livePickup.station_name, province_name: "Thành phố Hà Nội" } : { mode: "seller_address", province_name: "Thành phố Hà Nội" } });
  const list = (data) => ({ data: [{ ...room }], total: 1, page: data.page || 1, page_size: data.page_size || 20 });
  const domains = {
    "shipping.pickup.save": [`/api/livestreams/${roomID}/pickup`, "PUT"],
    "shipping.quote": ["/api/orders/quote", "POST"],
    "shipping.stations.nearby": ["/api/shipping/stations/nearby", "POST"],
    "live.media": [`/api/livestreams/${roomID}/media-token`, "POST"],
    "live.logout": ["/api/livestreams/logout", "POST"],
    "live.products.create": [`/api/livestreams/${roomID}/products/new`, "POST"],
    "live.products.add": [`/api/livestreams/${roomID}/products`, "POST"],
    "live.products.remove": [`/api/livestreams/${roomID}/products/${productID}`, "DELETE"],
    "live.end": [`/api/livestreams/${roomID}/end`, "POST"],
    "comments.send": [`/api/livestreams/${roomID}/comments`, "POST"],
  };
  const socket = await mockSocket(page, async (frame, peer) => {
    const data = frame.payload || {}, type = frame.type;
    if (domains[type]) { const { livestream_id, ...body } = data; const [path, method] = domains[type]; writes.push({ path, method, body: type === "shipping.quote" ? data : body, transport: "websocket", command: type }); }
    if (overrides.has(type)) return overrides.get(type)(data, frame, peer);
    switch (type) {
      case "authenticate": return { data: { user_id: profile.user_id } };
      case "orders.subscribe": return { snapshot: { resync: true } };
      case "shipping.origin.subscribe": return { snapshot: { changed: true } };
      case "lives.subscribe": return { snapshot: list(data) };
      case "live.subscribe": return { snapshot: roomSnapshot(data) };
      case "comments.subscribe": return { snapshot: { data: comments.filter((c) => BigInt(c.id) > BigInt(data.after || "0")), next_cursor: comments.at(-1)?.id || "0", has_more: false } };
      case "comments.send": {
        const comment = { id: String(comments.length + 1), username: profile.username, content: data.content.trim(), created_at: new Date().toISOString() }; comments.push(comment);
        socket.publish("comments.subscribe", comment, "comment.created"); return { data: comment };
      }
      case "shipping.provinces": return { data: { data: [{ id: 1, name: "Hà Nội", province_code: "1" }, { id: 79, name: "Hồ Chí Minh", province_code: "79" }] } };
      case "shipping.districts": return { data: { data: [{ id: Number(data.province_id) * 100, name: "Khu vực kiểm tra", support_type: 3 }] } };
      case "shipping.wards": { const d = Number(data.district_id); return { data: { data: [{ code: `ward-${d}`, name: receiver.ward, support_type: 3 }, { code: `gps-${d}`, name: d === 100 ? "Phường Hoàn Kiếm" : "Phường Sài Gòn", support_type: 3 }] } }; }
      case "shipping.stations.nearby": return { data: { data: [], complete: true, district: "Khu vực kiểm tra", quote_only: true, environment: "staging" } };
      case "shipping.pickup.get": return { data: { pickup_address: livePickup || shipping.pickup_address } };
      case "shipping.pickup.save": livePickup = data.pickup_address; socket.publish("live.subscribe", roomSnapshot); socket.publish("shipping.origin.subscribe", { changed: true }); return { data: { pickup_address: livePickup } };
      case "shipping.quote": { const fee = data.delivery.province_code === "1" ? 25000 : 40000; return { data: { unit_price: item.discount_price, quantity: data.quantity, items_subtotal: data.quantity * item.discount_price, shipping_fee: fee, total_amount: data.quantity * item.discount_price + fee, currency: "VND", shipping_zone: "carrier", pickup_province: "Thành phố Hà Nội", shipping: { provider: "ghn", environment: "staging", quote_only: true } } }; }
      case "live.media": return { status: 503, data: { error: "live_media_unavailable" } };
      case "live.products.create": return { data: { added: true, product_id: "new-product" } };
      case "live.logout": room.status = "end"; socket.publish("lives.subscribe", list); return { data: { ended: [roomID], media_closed: true } };
      case "live.products.add": socket.publish("live.subscribe", roomSnapshot); return { data: { added: true } };
      case "live.products.remove": socket.publish("live.subscribe", roomSnapshot); return { data: { removed: true } };
      case "live.end": room.status = "end"; socket.publish("live.subscribe", roomSnapshot); socket.publish("lives.subscribe", list); return { data: { ...room, media_closed: true } };
      case "live.create": return { data: { ...room, title: data.title } };
      default: return { status: 400, data: { error: "unknown_command" } };
    }
  });
  Object.defineProperties(writes, { command: { value: (type, handler) => overrides.set(type, handler) }, publish: { value: socket.publish }, frames: { value: socket.frames }, peers: { value: socket.peers } });
  await page.route("**/api/**", async (route) => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    if (request.method() !== "GET") writes.push({ path, method: request.method(), body: request.headers()["content-type"]?.startsWith("multipart/") ? request.postData() : request.postDataJSON(), authorization: request.headers().authorization, transport: "http" });
    if (path === "/api/delivery/reverse-geocode") return json(route, { address: { ...request.postDataJSON(), location_mode: "current", province_code: "1", province_name: "Thành phố Hà Nội", ward: "Phường Hoàn Kiếm", address_line: "12 Đinh Tiên Hoàng" } });
    if (path === "/api/sales/shipping-settings") { if (request.method() === "PUT") shipping = request.postDataJSON(); return json(route, { configured: true, settings: shipping }); }
    if (path === "/api/orders" && request.method() === "POST") { const input = request.postDataJSON(); item.stock_quantity -= input.quantity; socket.publish("live.subscribe", roomSnapshot); return json(route, { order_id: "55555555-5555-4555-8555-555555555555", status: "pending", total_amount: input.quantity * item.discount_price }, 201); }
    if (path === "/api/products/images") return json(route, { url: "/uploads/products/fixture.png" }, 201);
    if (path === "/api/products" && request.method() === "POST") return json(route, { id: "new-product", ...request.postDataJSON() }, 201);
    if (path === "/api/products") return json(route, { data: [{ id: productID, seller_id: sellerID, name: item.name, stock_quantity: 20, price: 100000 }], total: 1, page: 1, page_size: 100 });
    return json(route, { error: `Unexpected HTTP endpoint: ${path}` }, 404);
  });
  return writes;
}
