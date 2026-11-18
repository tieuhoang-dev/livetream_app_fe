import { test, expect } from "@playwright/test";
import { mockSocket } from "./fixtures/api";
const sellerID = "22222222-2222-4222-8222-222222222222";
const live = (id, title, status = "start") => ({ id, title, seller_id: sellerID, seller_username: "Shop WebSocket", status, started_at: new Date().toISOString() });
async function setup(page, signedIn = false) {
  await page.addInitScript(({ signedIn, sellerID }) => {
    sessionStorage.setItem("livemart-mode", "api");
    if (signedIn) sessionStorage.setItem("livemart-token", "fixture." + btoa(JSON.stringify({ user_id: sellerID, exp: Date.now() / 1000 + 3600 })) + ".fixture");
  }, { signedIn, sellerID });
  const rest = [];
  await page.route("**/api/**", (route) => {
    if (new URL(route.request().url()).pathname === "/api/livestreams") rest.push(route.request().url());
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: [], total: 0, page: 1, page_size: 12 }) });
  });
  return rest;
}
test("guest live catalog subscribes, receives pushes and sends filters/pages over WebSocket", async ({ page }) => {
  const rest = await setup(page), messages = [];
  let current, rows = Array.from({ length: 13 }, (_, n) => live(`live-${n}`, `Phiên WS ${n + 1}`));
  const snapshot = (query) => {
    const selected = rows.filter((row) => (!query.status || query.status === "all" || row.status === query.status) && (!query.q || row.title.includes(query.q)));
    const number = query.page || 1, size = query.page_size || 20;
    return { data: selected.slice((number - 1) * size, number * size), total: selected.length, page: number, page_size: size };
  };
  await mockSocket(page, (frame, peer) => {
    if (frame.type !== "lives.subscribe") return { data: {} };
    expect(new URL(peer.socket.url()).search).toBe(""); messages.push(frame); current = { frame, peer }; return { snapshot: snapshot(frame.payload) };
  });
  await page.goto("/#live"); await expect(page.getByText("Phiên WS 1", { exact: true })).toBeVisible();
  expect(messages[0]).toMatchObject({ type: "lives.subscribe", payload: { status: "start", page_size: 12, page: 1 } });
  await page.getByRole("button", { name: "Trang tiếp", exact: true }).click(); await expect(page.getByText("Phiên WS 13", { exact: true })).toBeVisible(); expect(messages.at(-1).payload.page).toBe(2);
  await page.getByLabel("Trạng thái", { exact: true }).selectOption("end"); await expect(page.getByText("Chưa có phiên live phù hợp.", { exact: true })).toBeVisible(); expect(messages.at(-1).payload).toMatchObject({ status: "end", page: 1 });
  rows.push(live("ended", "Phiên vừa kết thúc", "end"));
  current.peer.send({ type: "event", subscription_id: current.frame.subscription_id, event: "snapshot", data: snapshot(current.frame.payload) });
  await expect(page.getByText("Phiên vừa kết thúc", { exact: true })).toBeVisible();
  await page.getByPlaceholder("Tìm theo tiêu đề live…").fill("không tồn tại"); await page.getByRole("button", { name: "Tìm kiếm", exact: true }).last().click(); await expect(page.getByText("Chưa có phiên live phù hợp.", { exact: true })).toBeVisible(); expect(messages.at(-1).payload.q).toBe("không tồn tại"); expect(rest).toEqual([]);
});
test("live catalog reconnects after a dropped socket and does not fall back to REST", async ({ page }) => {
  const rest = await setup(page); const connections = new Set();
  await mockSocket(page, (frame, peer) => {
    connections.add(peer);
    if (frame.type === "lives.subscribe" && connections.size === 1) { peer.socket.close({ code: 1011, reason: "test disconnect" }); return {}; }
    return { snapshot: { data: [live("back", "Live sau kết nối lại")], total: 1, page: 1, page_size: frame.payload.page_size } };
  });
  await page.goto("/#live"); await expect(page.getByText("Live sau kết nối lại", { exact: true })).toBeVisible(); expect(connections.size).toBe(2); expect(rest).toEqual([]);
});
test("home and seller live lists use one authenticated socket with the seller scope", async ({ page }) => {
  const rest = await setup(page, true), queries = [];
  const socket = await mockSocket(page, (frame) => {
    if (frame.type === "authenticate") return { data: { user_id: sellerID } };
    if (frame.type !== "lives.subscribe") return { data: {} };
    queries.push(frame.payload); return { snapshot: { data: [live("seller", "Phiên của shop WS")], total: 1, page: 1, page_size: frame.payload.page_size } };
  });
  await page.goto("/#home"); await expect(page.getByText("Phiên của shop WS", { exact: true })).toBeVisible(); expect(queries.at(-1).page_size).toBe(4);
  await page.getByRole("button", { name: "Kênh người bán", exact: false }).click(); await page.getByRole("button", { name: "Phiên live", exact: true }).click(); await expect(page.getByText("Phiên của shop WS", { exact: true })).toBeVisible(); expect(queries.at(-1)).toMatchObject({ seller_id: sellerID, status: "all", page: 1, page_size: 12 }); expect(socket.peers.size).toBe(1); expect(rest).toEqual([]);
});
