import { test, expect } from "@playwright/test";
import { mockAPI, roomID, receiver } from "./fixtures/api";
import { fillDelivery } from "./fixtures/forms";

test("one session socket pushes comments and live state without HTTP polling", async ({ page }) => {
  await page.clock.install();
  const requests = []; page.on("request", (r) => { if (/\/api\/livestreams(?:\/|$)|\/api\/shipping/.test(new URL(r.url()).pathname)) requests.push(r.url()); });
  const backend = await mockAPI(page, false, true);
  await page.goto(`/#live/${roomID}`); await expect(page.getByRole("heading", { name: "Phòng kiểm tra API" })).toBeVisible();
  await expect(page.getByText("Bắt đầu câu chuyện bằng một lời chào nhé!", { exact: false })).toBeVisible();
  expect(backend.peers.size).toBe(1);
  const socket = [...backend.peers][0]; expect(new URL(socket.socket.url()).search).toBe("");
  expect(backend.frames.filter((f) => f.type === "authenticate")).toHaveLength(1);
  expect(backend.frames.map((f) => f.type)).toEqual(expect.arrayContaining(["orders.subscribe", "lives.subscribe", "live.subscribe", "comments.subscribe"]));
  const comment = { id: "9007199254740993", username: "Người xem khác", content: "Tin vừa được đẩy", created_at: new Date().toISOString() };
  backend.publish("comments.subscribe", comment, "comment.created"); backend.publish("comments.subscribe", comment, "comment.created");
  await expect(page.getByText(comment.content, { exact: true })).toHaveCount(1);
  const player = await page.locator(".live-video").elementHandle();
  await page.clock.fastForward(30000);
  expect(requests).toEqual([]);
  backend.publish("live.subscribe", { live: { id: roomID, seller_id: "seller", title: "Phiên vừa kết thúc", status: "end" }, products: { data: [], total: 0, page: 1, page_size: 12 } });
  await expect(page.getByRole("heading", { name: "Phiên vừa kết thúc" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Viết bình luận", exact: true })).toHaveCount(0);
  expect(await player.evaluate((element) => element.isConnected)).toBe(true);
});

test("checkout shows the buyer address and refreshes its quote on a shipping push", async ({ page }) => {
  const backend = await mockAPI(page, false, true); let fee = 25000;
  backend.command("shipping.quote", () => ({ data: { unit_price: 80000, quantity: 1, items_subtotal: 80000, shipping_fee: fee, total_amount: 80000 + fee, currency: "VND", pickup_province: "Hà Nội" } }));
  await page.goto(`/#live/${roomID}`); await page.getByRole("button", { name: "Chọn mua", exact: true }).click();
  const checkout = page.getByRole("dialog", { name: "Đặt hàng", exact: true }); await fillDelivery(checkout);
  const destination = checkout.getByRole("region", { name: "Giao đến", exact: true });
  await expect(destination).toContainText(receiver.name); await expect(destination).toContainText(receiver.phone); await expect(destination).toContainText(receiver.address_line);
  await expect(checkout.getByLabel("Chi tiết thanh toán")).toContainText("105.000");
  fee = 30000; backend.publish("shipping.origin.subscribe", { changed: true });
  await expect(checkout.getByLabel("Chi tiết thanh toán")).toContainText("110.000");
  expect(backend.filter((w) => w.path === "/api/orders")).toHaveLength(0);
  await checkout.getByRole("button", { name: "Xác nhận đặt hàng", exact: true }).click(); await expect(checkout).not.toBeVisible();
  expect(backend.find((w) => w.path === "/api/orders").body.expected_total).toBe(110000);
  await expect(page).toHaveURL(new RegExp(`#live/${roomID}$`));
});

test("disconnect restores subscriptions and never replays an inventory mutation", async ({ page }) => {
  const backend = await mockAPI(page, true);
  backend.command("live.products.add", (_data, _frame, peer) => { peer.socket.close({ code: 1011, reason: "lost acknowledgement" }); return {}; });
  await page.goto(`/#live/${roomID}`);
  const player = await page.locator(".live-video").elementHandle();
  await page.getByRole("button", { name: "Thêm sản phẩm vào live", exact: true }).click();
  const inventory = page.getByRole("dialog", { name: "Sản phẩm trong live", exact: true });
  await inventory.getByRole("combobox", { name: "Sản phẩm", exact: true }).selectOption("33333333-3333-4333-8333-333333333333");
  await inventory.getByLabel("Giá trong live").fill("75000"); await inventory.getByLabel("Số lượng", { exact: true }).fill("2");
  await inventory.getByRole("button", { name: "Thêm vào live", exact: true }).click();
  await expect(inventory.locator("p.form-error[role=alert]")).toContainText("Mất kết nối realtime");
  await expect.poll(() => backend.frames.filter((frame) => frame.type === "authenticate").length).toBe(2);
  await expect.poll(() => backend.frames.filter((f) => f.type === "live.subscribe").length).toBeGreaterThan(2);
  expect(backend.filter((w) => w.command === "live.products.add")).toHaveLength(1);
  expect(await player.evaluate((element) => element.isConnected)).toBe(true);
});
