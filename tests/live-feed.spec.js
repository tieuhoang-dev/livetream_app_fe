import { test, expect } from "@playwright/test";

const sellerID = "22222222-2222-4222-8222-222222222222";
const live = (id, title, status = "start") => ({ id, title, seller_id: sellerID,
  seller_username: "Shop WebSocket", status, started_at: new Date().toISOString() });

async function setup(page, signedIn = false) {
  await page.addInitScript(({ signedIn, sellerID }) => {
    sessionStorage.setItem("livemart-mode", "api");
    if (signedIn) sessionStorage.setItem("livemart-token", "fixture." + btoa(JSON.stringify({ user_id: sellerID, exp: Date.now() / 1000 + 3600 })) + ".fixture");
  }, { signedIn, sellerID });
  const restLists = [];
  await page.route("**/api/**", (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === "/api/livestreams") restLists.push(url.toString());
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: [], total: 0, page: 1, page_size: 12 }) });
  });
  return restLists;
}

test("guest live catalog subscribes, receives pushes and sends filters/pages over WebSocket", async ({ page }) => {
  const rest = await setup(page);
  const messages = [];
  let current;
  let rows = Array.from({ length: 13 }, (_, n) => live(`live-${n}`, `Phiên WS ${n + 1}`));
  const respond = () => {
    const { socket, message } = current;
    const query = message.query;
    const selected = rows.filter((row) => (!query.status || query.status === "all" || row.status === query.status) && (!query.q || row.title.includes(query.q)));
    const page = query.page || 1, size = query.page_size || 20;
    socket.send(JSON.stringify({ type: "list_lives_success", request_id: message.request_id, data: selected.slice((page - 1) * size, page * size), total: selected.length, page, page_size: size }));
  };
  await page.routeWebSocket("**/api/livestreams/ws", (socket) => {
    expect(new URL(socket.url()).search).toBe("");
    socket.onMessage((raw) => { const message = JSON.parse(raw); messages.push(message); current = { socket, message }; respond(); });
  });
  await page.goto("/#live");
  await expect(page.getByText("Phiên WS 1", { exact: true })).toBeVisible();
  expect(messages[0]).toMatchObject({ type: "list_lives", query: { status: "start", page_size: 12, page: 1 } });
  await page.getByRole("button", { name: "Trang tiếp", exact: true }).click();
  await expect(page.getByText("Phiên WS 13", { exact: true })).toBeVisible();
  expect(messages.at(-1).query.page).toBe(2);
  await page.getByLabel("Trạng thái", { exact: true }).selectOption("end");
  await expect(page.getByText("Chưa có phiên live phù hợp.", { exact: true })).toBeVisible();
  expect(messages.at(-1).query).toMatchObject({ status: "end", page: 1 });
  rows.push(live("ended", "Phiên vừa kết thúc", "end"));
  respond(); // Server push, with no click or refresh.
  await expect(page.getByText("Phiên vừa kết thúc", { exact: true })).toBeVisible();
  await page.getByPlaceholder("Tìm theo tiêu đề live…").fill("không tồn tại");
  await page.getByRole("button", { name: "Tìm kiếm", exact: true }).last().click();
  await expect(page.getByText("Chưa có phiên live phù hợp.", { exact: true })).toBeVisible();
  expect(messages.at(-1).query.q).toBe("không tồn tại");
  expect(rest).toEqual([]);
});

test("live catalog reconnects after a dropped socket and does not fall back to REST", async ({ page }) => {
  const rest = await setup(page);
  let connections = 0;
  await page.routeWebSocket("**/api/livestreams/ws", (socket) => {
    connections += 1;
    const attempt = connections;
    socket.onMessage((raw) => {
      const message = JSON.parse(raw);
      if (attempt === 1) { socket.close({ code: 1011, reason: "test disconnect" }); return; }
      socket.send(JSON.stringify({ type: "list_lives_success", request_id: message.request_id, data: [live("back", "Live sau kết nối lại")], total: 1, page: 1, page_size: message.query.page_size }));
    });
  });
  await page.goto("/#live");
  await expect(page.getByText("Live sau kết nối lại", { exact: true })).toBeVisible();
  expect(connections).toBe(2);
  expect(rest).toEqual([]);
});

test("home and seller live lists use the socket with the seller scope", async ({ page }) => {
  const rest = await setup(page, true);
  const queries = [];
  await page.routeWebSocket("**/api/livestreams/ws", (socket) => socket.onMessage((raw) => {
    const message = JSON.parse(raw); queries.push(message.query);
    socket.send(JSON.stringify({ type: "list_lives_success", request_id: message.request_id, data: [live("seller", "Phiên của shop WS")], total: 1, page: 1, page_size: message.query.page_size }));
  }));
  await page.goto("/#home");
  await expect(page.getByText("Phiên của shop WS", { exact: true })).toBeVisible();
  expect(queries.at(-1).page_size).toBe(4);
  await page.getByRole("button", { name: "Kênh người bán", exact: false }).click();
  await page.getByRole("button", { name: "Phiên live", exact: true }).click();
  await expect(page.getByText("Phiên của shop WS", { exact: true })).toBeVisible();
  expect(queries.at(-1)).toMatchObject({ seller_id: sellerID, status: "all", page: 1, page_size: 12 });
  expect(rest).toEqual([]);
});
