import { chooseCarrier, fillDelivery } from "./fixtures/forms";
import { mockAPI, receiver, roomID, sellerID, productID, buyerID } from "./fixtures/api";
import { test, expect } from "@playwright/test";

async function demo(page) {
  await page.addInitScript(() =>
    sessionStorage.setItem("livemart-mode", "demo"),
  );
}


test.beforeEach(async ({ page }) => {
  await page.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({
    contentType: "image/png",
    body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=", "base64"),
  }));
});

function collectErrors(page) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

test("desktop room switches lives, shares a link and enters fullscreen", async ({
  page,
  context,
}) => {
  const errors = collectErrors(page);
  await demo(page);
  await page.goto("/#live/beauty");
  await expect(
    page.getByRole("heading", { name: "Routine chăm da tối giản" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Live tiếp theo", exact: true })
    .click();
  await expect(page).toHaveURL(/#live\/tech$/);
  await page.locator("body").press("ArrowDown");
  await expect(page).toHaveURL(/#live\/coffee$/);
  await page
    .getByRole("button", { name: "Chia sẻ phòng live", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Chia sẻ phòng live" });
  await expect(dialog.getByLabel("Liên kết phòng")).toHaveValue(
    /#live\/coffee$/,
  );
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await dialog.getByRole("button", { name: "Sao chép liên kết" }).click();
  await expect(dialog).not.toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(
    /#live\/coffee$/,
  );
  await page
    .getByRole("button", { name: "Toàn màn hình", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)))
    .toBe(true);
  await page
    .getByRole("button", { name: "Toàn màn hình", exact: true })
    .click();
  await expect
    .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)))
    .toBe(false);
  expect(errors).toEqual([]);
});

test.describe("phone", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  test("comment submission, hiding the feed and swiping preserve room controls", async ({
    page,
    context,
  }) => {
    const errors = collectErrors(page);
    await demo(page);
    await page.goto("/#live/coffee");
    const input = page.getByRole("textbox", { name: "Viết bình luận" });
    await input.fill("Mình muốn hỏi về sản phẩm đang ghim");
    await page
      .getByRole("button", { name: "Gửi bình luận", exact: true })
      .click();
    await expect(
      page.getByText("Mình muốn hỏi về sản phẩm đang ghim", { exact: true }),
    ).toHaveCount(1);
    await expect(input).toHaveValue("");
    await page
      .getByRole("button", { name: "Ẩn bình luận", exact: true })
      .click();
    await expect(
      page.getByRole("log", { name: "Các bình luận" }),
    ).not.toBeVisible();
    await page
      .getByRole("button", { name: "Hiện bình luận", exact: true })
      .click();
    await expect(
      page.getByRole("log", { name: "Các bình luận" }),
    ).toBeVisible();
    const touch = await context.newCDPSession(page);
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x: 150, y: 370 }],
    });
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x: 155, y: 130 }],
    });
    await touch.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect(page).toHaveURL(/#live\/style$/);
    expect(errors).toEqual([]);
  });

  test("shopping checkout records payment and keeps the viewer in the live", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await demo(page);
    await page.goto("/#live/coffee");
    const player = await page.locator(".live-video").elementHandle();
    await page.getByRole("button", { name: /Mở giỏ sản phẩm/ }).click();
    const drawer = page.getByRole("dialog", { name: /Giỏ hàng LIVE/ });
    await expect(drawer).toBeVisible();
    await drawer.getByRole("button", { name: "Chọn mua", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(1);
    const checkout = page.getByRole("dialog", {
      name: "Đặt hàng",
      exact: true,
    });
    await expect(checkout).toBeVisible();
    await checkout.getByLabel("Số lượng").fill("2");
    await checkout.getByLabel("Phương thức thanh toán").selectOption("bank_transfer");
    await fillDelivery(checkout);
    await checkout.getByRole("button", { name: "Xác nhận đặt hàng" }).click();
    await expect(page).toHaveURL(/#live\/coffee$/);
    await expect(checkout).not.toBeVisible();
    expect(await player.evaluate((element) => element.isConnected)).toBe(true);
    await expect(
      page.getByText("Đặt hàng thành công. Bạn vẫn đang ở trong live.", { exact: true }),
    ).toBeVisible();
    await page.getByRole("status").getByRole("button", { name: "Xem đơn", exact: true }).click();
    await expect(page).toHaveURL(/#orders$/);
    const detail = page.getByRole("dialog", { name: "Chi tiết đơn hàng" });
    await expect(detail.getByText("Chuyển khoản ngân hàng", { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("drawer closes on Escape and on desktop resize without locking scrolling", async ({
    page,
  }) => {
    await demo(page);
    await page.goto("/#live/coffee");
    await page.getByRole("button", { name: /Mở giỏ sản phẩm/ }).click();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.getByRole("button", { name: /Mở giỏ sản phẩm/ }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(
      page.getByRole("complementary", { name: "Sản phẩm trong live" }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
      "hidden",
    );
  });
});

test("catalog checkout still opens the new order and shows the COD method", async ({ page }) => {
  await demo(page);
  await page.goto("/#shop");
  await page.getByRole("button", { name: "Mua Tai nghe chụp tai không dây", exact: true }).click();
  const checkout = page.getByRole("dialog", { name: "Đặt hàng", exact: true });
  await expect(checkout.getByLabel("Phương thức thanh toán")).toHaveValue("cod");
  await fillDelivery(checkout);
    await checkout.getByRole("button", { name: "Xác nhận đặt hàng" }).click();
  await expect(page).toHaveURL(/#orders$/);
  const detail = page.getByRole("dialog", { name: "Chi tiết đơn hàng" });
  await expect(detail.getByText("Thanh toán khi nhận hàng (COD)", { exact: true })).toBeVisible();
});

for (const [method, viewport] of [
  ["cod", { width: 1440, height: 1000 }],
  ["bank_transfer", { width: 390, height: 844 }],
]) {
  test(`API live checkout sends ${method} and preserves the video element`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors = collectErrors(page);
    const writes = await mockAPI(page, false, true);
    await page.goto(`/#live/${roomID}`);
    const player = await page.locator(".live-video").elementHandle();
    if (viewport.width < 900) await page.getByRole("button", { name: /Mở giỏ sản phẩm/ }).click();
    await page.getByRole("button", { name: "Chọn mua", exact: true }).click();
    const checkout = page.getByRole("dialog", { name: "Đặt hàng", exact: true });
    await checkout.getByLabel("Số lượng").fill("2");
    await checkout.getByLabel("Phương thức thanh toán").selectOption(method);
    await fillDelivery(checkout);
    await checkout.getByRole("button", { name: "Xác nhận đặt hàng" }).click();
    await expect(checkout).not.toBeVisible();
    await expect(page).toHaveURL(new RegExp(`#live/${roomID}$`));
    await expect(page.getByRole("status").filter({ hasText: "Đặt hàng thành công" })).toBeVisible();
    await expect(page.getByRole("dialog", { name: "Chi tiết đơn hàng" })).toHaveCount(0);
    expect(await player.evaluate((element) => element.isConnected)).toBe(true);
    const orders = writes.filter((entry) => entry.path === "/api/orders");
    expect(orders).toHaveLength(1);
    expect(orders[0].body).toMatchObject({ product_id: productID, livestream_id: roomID, quantity: 2, payment_method: method, delivery: receiver, note: "", expected_total: 185000 });
    expect(orders[0].body.request_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(orders[0].authorization).toContain("Bearer ui-fixture.");
    if (viewport.width < 900) await page.getByRole("button", { name: /Mở giỏ sản phẩm/ }).click();
    await expect(page.getByText("Còn 3 sản phẩm", { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("guest signs in during live checkout and stays in the same room after ordering", async ({ page }) => {
  const errors = collectErrors(page);
  const writes = await mockAPI(page);
  const token = "ui-fixture." + Buffer.from(JSON.stringify({ user_id: buyerID, exp: Date.now() / 1000 + 3600 })).toString("base64url") + ".fixture";
  await page.route("**/api/users/login", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ token }) }));
  await page.goto(`/#live/${roomID}`);
  const player = await page.locator(".live-video").elementHandle();
  await page.getByRole("button", { name: "Chọn mua", exact: true }).click();
  const auth = page.getByRole("dialog", { name: "Đăng nhập", exact: true });
  await auth.getByLabel("Email", { exact: true }).fill("buyer@example.invalid");
  await auth.getByLabel("Mật khẩu", { exact: true }).fill("Fixture-password-123");
  await auth.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  const checkout = page.getByRole("dialog", { name: "Đặt hàng", exact: true });
  await fillDelivery(checkout);
  await checkout.getByRole("button", { name: "Xác nhận đặt hàng", exact: true }).click();
  await expect(checkout).not.toBeVisible();
  await expect(page).toHaveURL(new RegExp(`#live/${roomID}$`));
  await expect(page.getByRole("status").filter({ hasText: "Đặt hàng thành công" })).toBeVisible();
  expect(await player.evaluate((element) => element.isConnected)).toBe(true);
  expect(writes.filter((entry) => entry.path === "/api/orders")[0].body.livestream_id).toBe(roomID);
  expect(errors).toEqual([]);
});

test("failed live order keeps the chosen payment, quantity and room", async ({ page }) => {
  await mockAPI(page, false, true);
  await page.route("**/api/orders", (route) => route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "insufficient_stock" }) }));
  await page.goto(`/#live/${roomID}`);
  await page.getByRole("button", { name: "Chọn mua", exact: true }).click();
  const checkout = page.getByRole("dialog", { name: "Đặt hàng", exact: true });
  await checkout.getByLabel("Số lượng").fill("2");
  await checkout.getByLabel("Phương thức thanh toán").selectOption("bank_transfer");
  await fillDelivery(checkout);
    await checkout.getByRole("button", { name: "Xác nhận đặt hàng" }).click();
  await expect(checkout.getByRole("alert")).toHaveText("Số lượng còn trong kho không đủ.");
  await expect(checkout.getByLabel("Phương thức thanh toán")).toHaveValue("bank_transfer");
  await expect(checkout.getByLabel("Số lượng")).toHaveValue("2");
  await expect(page).toHaveURL(new RegExp(`#live/${roomID}$`));
});

test("API owner can add inventory and media errors retain the live interface", async ({
  page,
}) => {
  const errors = collectErrors(page);
  const writes = await mockAPI(page, true);
  await page.goto(`/#live/${roomID}`);
  await page
    .getByRole("button", { name: "Thêm sản phẩm vào live", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Sản phẩm trong live",
    exact: true,
  });
  await dialog
    .getByRole("combobox", { name: "Sản phẩm", exact: true })
    .selectOption(productID);
  await dialog.getByLabel("Giá trong live", { exact: true }).fill("75000");
  await dialog.getByLabel("Số lượng", { exact: true }).fill("3");
  await dialog
    .getByRole("button", { name: "Thêm vào live", exact: true })
    .click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].body).toEqual({
    product_id: productID,
    discount_price: 75000,
    stock_quantity: 3,
    is_pinned: false,
  });
  expect(writes[0].transport).toBe("websocket");
  expect(writes.frames.find((frame) => frame.type === "authenticate").payload.token).toContain("ui-fixture.");
  await dialog.getByRole("button", { name: "Đóng", exact: true }).click();
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (_success, failure) => failure({ code: 1 });
  });
  await page.evaluate(() => { navigator.geolocation.getCurrentPosition = (_success, failure) => failure({ code: 1 }); });
  await page.getByRole("button", { name: "Bắt đầu phát", exact: true }).click();
  const origin = page.getByRole("dialog", { name: "Nơi lấy hàng của phiên live", exact: true });
  await expect(origin.getByRole("alert")).toContainText("Không lấy được vị trí");
  await origin.getByRole("radio", { name: "Nhập địa chỉ", exact: true }).check();
  await chooseCarrier(origin);
  await origin.getByRole("button", { name: "Dùng địa chỉ và bắt đầu phát", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("LiveKit");
  expect(writes.at(-1).body).toEqual({ role: "publisher" });
  await expect(
    page.getByRole("heading", { name: "Phòng kiểm tra API" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Bắt đầu phát", exact: true }).click();
  await origin.getByRole("radio", { name: "Nhập địa chỉ", exact: true }).check();
  await chooseCarrier(origin);
  await origin.getByRole("button", { name: "Dùng địa chỉ và bắt đầu phát", exact: true }).click();
  await expect.poll(() => writes.filter((entry) => entry.path.endsWith("/media-token")).length).toBe(2);
  expect(errors).toEqual([]);
});

test("guest cannot send a comment or connect media without signing in", async ({
  page,
}) => {
  const writes = await mockAPI(page);
  await page.goto(`/#live/${roomID}`);
  await expect(
    page.getByRole("textbox", { name: "Viết bình luận" }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Đăng nhập để bình luận", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Đăng nhập", exact: true }),
  ).toBeVisible();
  expect(writes).toEqual([]);
});

test("ended live and all viewport sizes keep controls on screen", async ({
  page,
}) => {
  await demo(page);
  await page.goto("/#live/replay");
  await expect(page.locator(".stage-live-badge")).toHaveText("ĐÃ KẾT THÚC");
  await expect(
    page.getByRole("textbox", { name: "Viết bình luận" }),
  ).toHaveCount(0);
  for (const viewport of [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1280, height: 800 },
    { width: 1440, height: 1000 },
  ]) {
    await page.setViewportSize(viewport);
    await expect(
      page.getByRole("button", { name: "Rời phòng live", exact: true }),
    ).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
  }
});

test("seller saves pickup address and a GPS pin without editing carrier fees", async ({ page, context }) => {
  const errors = collectErrors(page);
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 21.028511, longitude: 105.804817 });
  await mockAPI(page, true);
  await page.goto("/#seller");
  await page.getByRole("button", { name: "Giao hàng", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Địa chỉ lấy hàng" })).toBeVisible();
  await page.getByLabel("Người liên hệ", { exact: true }).fill("Chủ shop thử nghiệm");
  await page.getByRole("radio", { name: "Sử dụng vị trí hiện tại", exact: true }).check();
  await chooseCarrier(page, "1", "gps-100");
  await expect(page.getByLabel("Phường / Xã", { exact: true })).toHaveValue("gps-100");
  await expect(page.getByLabel("Địa chỉ cụ thể", { exact: true })).toHaveValue("12 Đinh Tiên Hoàng");
  await expect(page.getByText("Đã xác định vị trí. Bạn có thể mở bản đồ để kiểm tra hoặc chỉnh lại.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Lưu cấu hình giao hàng", exact: true }).click();
  await expect(page.getByText("Đã lưu địa chỉ lấy hàng.", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Giao hàng", exact: true }).click();
  await expect(page.getByLabel("Người liên hệ", { exact: true })).toHaveValue("Chủ shop thử nghiệm");
  await expect(page.getByLabel("Phí ship nội tỉnh (VNĐ)", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Chỉnh vị trí trên bản đồ", exact: true }).click();
  await expect(page.getByText("Vị trí: 21.028511, 105.804817", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("GPS denial does not prevent a typed address and inter-province checkout", async ({ page }) => {
  const errors = collectErrors(page);
  await mockAPI(page, false, true);
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (_success, failure) => failure({ code: 1 });
  });
  await page.goto(`/#live/${roomID}`);
  await page.getByRole("button", { name: "Chọn mua", exact: true }).click();
  const checkout = page.getByRole("dialog", { name: "Đặt hàng", exact: true });
  await fillDelivery(checkout, { ...receiver, province_code: "79" });
  await checkout.getByRole("button", { name: "Chọn vị trí trên bản đồ", exact: true }).click();
  await checkout.getByRole("radio", { name: "Sử dụng vị trí hiện tại", exact: true }).check();
  await expect(checkout.getByRole("alert")).toContainText("Không lấy được vị trí");
  await expect(checkout.getByRole("button", { name: "Xác nhận đặt hàng", exact: true })).toBeDisabled();
  await checkout.getByRole("radio", { name: "Nhập địa chỉ", exact: true }).check();
  await chooseCarrier(checkout, "79");
  await expect(checkout.getByRole("region", { name: "Bản đồ chọn địa chỉ" })).toBeVisible();
  await expect(checkout.getByLabel("Chi tiết thanh toán")).toContainText("40.000");
  await checkout.getByRole("button", { name: "Xác nhận đặt hàng", exact: true }).click();
  await expect(checkout).not.toBeVisible();
  await expect(page).toHaveURL(new RegExp(`#live/${roomID}$`));
  expect(errors).toEqual([]);
});

test("buyer uses current location to fill the address and keeps contact and apartment details", async ({ page, context }) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 21.028511, longitude: 105.804817 });
  const writes = await mockAPI(page, false, true);
  await page.goto(`/#live/${roomID}`);
  await page.getByRole("button", { name: /Mở giỏ sản phẩm/ }).click();
  await page.getByRole("button", { name: "Chọn mua", exact: true }).click();
  const checkout = page.getByRole("dialog", { name: "Đặt hàng", exact: true });
  await checkout.getByLabel("Họ tên người nhận", { exact: true }).fill(receiver.name);
  await checkout.getByLabel("Số điện thoại", { exact: true }).fill(receiver.phone);
  await checkout.getByRole("radio", { name: "Sử dụng vị trí hiện tại", exact: true }).check();
  await expect(checkout.getByLabel("Tỉnh / Thành phố", { exact: true })).toHaveValue("1");
  await chooseCarrier(checkout, "1", "gps-100");
  await expect(checkout.getByLabel("Phường / Xã", { exact: true })).toHaveValue("gps-100");
  await expect(checkout.getByLabel("Địa chỉ cụ thể", { exact: true })).toHaveValue("12 Đinh Tiên Hoàng");
  await checkout.getByLabel("Địa chỉ cụ thể", { exact: true }).fill("12 Đinh Tiên Hoàng, căn hộ 4");
  await checkout.getByRole("button", { name: "Xác nhận đặt hàng", exact: true }).click();
  await expect(checkout).not.toBeVisible();
  const order = writes.find((entry) => entry.path === "/api/orders");
  expect(order.body.delivery).toMatchObject({ name: receiver.name, phone: receiver.phone, province_code: "1", ward: "Phường Hoàn Kiếm", address_line: "12 Đinh Tiên Hoàng, căn hộ 4", latitude: 21.028511, longitude: 105.804817, location_mode: "current", carrier_province_id: 1, carrier_district_id: 100, carrier_ward_code: "gps-100" });
  await expect(page).toHaveURL(new RegExp(`#live/${roomID}$`));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test("seller defaults to the broadcast location and saves it before requesting media", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 21.028511, longitude: 105.804817 });
  const writes = await mockAPI(page, true);
  await page.goto(`/#live/${roomID}`);
  await page.getByRole("button", { name: "Bắt đầu phát", exact: true }).click();
  const origin = page.getByRole("dialog", { name: "Nơi lấy hàng của phiên live", exact: true });
  await expect(origin.getByRole("radio", { name: "Sử dụng vị trí hiện tại", exact: true })).toBeChecked();
  await expect(origin.getByLabel("Địa chỉ cụ thể", { exact: true })).toHaveValue("12 Đinh Tiên Hoàng");
  await chooseCarrier(origin, "1", "gps-100");
  await origin.getByRole("button", { name: "Dùng địa chỉ và bắt đầu phát", exact: true }).click();
  await expect(origin).not.toBeVisible();
  await expect(page.getByRole("alert")).toContainText("LiveKit");
  expect(writes.filter((entry) => entry.command !== "shipping.stations.nearby").map((entry) => entry.path)).toEqual(["/api/delivery/reverse-geocode", `/api/livestreams/${roomID}/pickup`, `/api/livestreams/${roomID}/media-token`]);
  expect(writes.find((entry) => entry.command === "shipping.pickup.save").body.pickup_address).toMatchObject({ name: "Chủ shop", phone: receiver.phone, location_mode: "current", latitude: 21.028511, longitude: 105.804817, address_line: "12 Đinh Tiên Hoàng" });
  expect(writes.some((entry) => entry.path === "/api/sales/shipping-settings")).toBe(false);
});

test("geocoder failure blocks current-location checkout and allows explicit manual fallback", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 21.028511, longitude: 105.804817 });
  const writes = await mockAPI(page, false, true);
  await page.route("**/api/delivery/reverse-geocode", (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "geocoding_unavailable" }) }));
  await page.goto(`/#live/${roomID}`);
  await page.getByRole("button", { name: "Chọn mua", exact: true }).click();
  const checkout = page.getByRole("dialog", { name: "Đặt hàng", exact: true });
  await fillDelivery(checkout);
  await checkout.getByRole("radio", { name: "Sử dụng vị trí hiện tại", exact: true }).check();
  await expect(checkout.getByRole("alert")).toContainText("Chưa tìm được địa chỉ");
  await expect(checkout.getByRole("button", { name: "Xác nhận đặt hàng", exact: true })).toBeDisabled();
  await expect(checkout.getByLabel("Họ tên người nhận", { exact: true })).toHaveValue(receiver.name);
  await checkout.getByRole("radio", { name: "Nhập địa chỉ", exact: true }).check();
  await chooseCarrier(checkout);
  await checkout.getByRole("button", { name: "Xác nhận đặt hàng", exact: true }).click();
  await expect(checkout).not.toBeVisible();
  expect(writes.find((entry) => entry.path === "/api/orders").body.delivery).toMatchObject({ ...receiver, location_mode: "manual" });
});

test("late GPS callbacks cannot replace a manually entered address", async ({ page }) => {
  const writes = await mockAPI(page, false, true);
  await page.addInitScript(() => { navigator.geolocation.getCurrentPosition = (success) => { window.pendingGPS = success; }; });
  await page.goto(`/#live/${roomID}`);
  await page.getByRole("button", { name: "Chọn mua", exact: true }).click();
  const checkout = page.getByRole("dialog", { name: "Đặt hàng", exact: true });
  await fillDelivery(checkout);
  await checkout.getByRole("radio", { name: "Sử dụng vị trí hiện tại", exact: true }).check();
  await checkout.getByRole("radio", { name: "Nhập địa chỉ", exact: true }).check();
  await chooseCarrier(checkout);
  await checkout.getByLabel("Địa chỉ cụ thể", { exact: true }).fill("99 Địa chỉ nhập tay");
  await page.evaluate(() => window.pendingGPS({ coords: { latitude: 21.028511, longitude: 105.804817 } }));
  await checkout.getByRole("button", { name: "Xác nhận đặt hàng", exact: true }).click();
  await expect(checkout).not.toBeVisible();
  expect(writes.some((entry) => entry.path === "/api/delivery/reverse-geocode")).toBe(false);
  expect(writes.find((entry) => entry.path === "/api/orders").body.delivery).toMatchObject({ address_line: "99 Địa chỉ nhập tay", latitude: null, longitude: null, location_mode: "manual" });
});

test("a carrier failure cannot produce a fake zero-fee order", async ({ page }) => {
  const writes = await mockAPI(page, false, true);
  writes.command("shipping.quote", () => ({ status: 502, data: { error: "shipping_unavailable" } }));
  await page.goto(`/#live/${roomID}`);
  await page.getByRole("button", { name: "Chọn mua", exact: true }).click();
  const checkout = page.getByRole("dialog", { name: "Đặt hàng", exact: true });
  await fillDelivery(checkout);
  await expect(checkout.getByRole("alert")).toContainText("Chưa lấy được báo phí");
  await expect(checkout.getByRole("button", { name: "Xác nhận đặt hàng" })).toBeDisabled();
  expect(writes.filter((write) => write.path === "/api/orders")).toHaveLength(0);
});

test("carrier route quotes before contact details and contact edits keep the quote", async ({ page }) => {
  const writes = await mockAPI(page, false, true);
  await page.goto(`/#live/${roomID}`);
  await page.getByRole("button", { name: "Chọn mua", exact: true }).click();
  const checkout = page.getByRole("dialog", { name: "Đặt hàng", exact: true });
  await checkout.getByLabel("Tỉnh / Thành phố", { exact: true }).selectOption("1");
  await chooseCarrier(checkout);
  await expect(checkout.getByLabel("Chi tiết thanh toán")).toContainText("25.000");
  await expect(checkout.getByRole("button", { name: "Xác nhận đặt hàng", exact: true })).toBeDisabled();
  await checkout.getByLabel("Tỉnh / Thành phố", { exact: true }).selectOption("79");
  await chooseCarrier(checkout, "79", "gps-7900");
  await expect(checkout.getByLabel("Chi tiết thanh toán")).toContainText("40.000");
  const before = writes.filter((entry) => entry.path === "/api/orders/quote").length;
  await checkout.getByLabel("Họ tên người nhận", { exact: true }).fill(receiver.name);
  await checkout.getByLabel("Số điện thoại", { exact: true }).fill("123");
  await expect(checkout.getByText("Nhập số điện thoại Việt Nam bắt đầu bằng 0 hoặc +84.", { exact: true })).toBeVisible();
  await checkout.getByLabel("Số điện thoại", { exact: true }).fill(receiver.phone);
  await checkout.getByLabel("Địa chỉ cụ thể", { exact: true }).fill(receiver.address_line);
  await page.waitForTimeout(500);
  expect(writes.filter((entry) => entry.path === "/api/orders/quote")).toHaveLength(before);
  await checkout.getByRole("button", { name: "Xác nhận đặt hàng", exact: true }).click();
  await expect(checkout).not.toBeVisible();
  expect(writes.find((entry) => entry.path === "/api/orders").body).toMatchObject({ expected_total: 120000, delivery: { province_code: "79", ward: "Phường Sài Gòn", carrier_district_id: 7900, carrier_ward_code: "gps-7900" } });
});

test("first-time seller saves a pickup without entering or sending fees", async ({ page }) => {
  const writes = await mockAPI(page, true);
  const saved = [];
  await page.addInitScript(() => { navigator.geolocation.getCurrentPosition = (_success, failure) => failure({ code: 1 }); });
  writes.command("shipping.pickup.get", () => ({ data: { pickup_address: receiver } }));
  writes.command("shipping.pickup.save", (input) => { saved.push({ pickup_address: input.pickup_address }); return { data: { pickup_address: input.pickup_address } }; });
  await page.goto(`/#live/${roomID}`);
  await page.getByRole("button", { name: "Bắt đầu phát", exact: true }).click();
  const origin = page.getByRole("dialog", { name: "Nơi lấy hàng của phiên live", exact: true });
  await origin.getByRole("radio", { name: "Nhập địa chỉ", exact: true }).check();
  await chooseCarrier(origin);
  await expect(origin.getByLabel("Phí ship nội tỉnh (VNĐ)", { exact: true })).toHaveCount(0);
  await origin.getByRole("button", { name: "Dùng địa chỉ và bắt đầu phát", exact: true }).click();
  await expect(origin).not.toBeVisible();
  await expect(page.getByRole("alert")).toContainText("LiveKit");
  expect(saved).toHaveLength(1);
  expect(Object.keys(saved[0])).toEqual(["pickup_address"]);
  expect(writes.some((entry) => /create|shipment|booking/.test(entry.path))).toBe(false);
});

test("seller fixes a pickup inside the room and buyer retrieves a carrier quote", async ({ page, context }) => {
  const sellerWrites = await mockAPI(page, true);
  let configured = false;
  sellerWrites.command("shipping.pickup.get", () => ({ data: { pickup_address: receiver } }));
  sellerWrites.command("shipping.pickup.save", (input) => { configured = true; return { data: { pickup_address: input.pickup_address } }; });
  const buyer = await context.newPage();
  const buyerWrites = await mockAPI(buyer, false, true);
  buyerWrites.command("shipping.quote", () => ({ status: configured ? 200 : 409, data: configured ? { unit_price: 80000, quantity: 1, items_subtotal: 80000, shipping_fee: 25000, total_amount: 105000, currency: "VND", pickup_province: "Thành phố Hà Nội", shipping: {provider:"ghn",environment:"staging",quote_only:true} } : { error: "shipping_pickup_required" } }));
  await buyer.goto(`/#live/${roomID}`);
  await buyer.getByRole("button", { name: "Chọn mua", exact: true }).click();
  const checkout = buyer.getByRole("dialog", { name: "Đặt hàng", exact: true });
  await fillDelivery(checkout);
  await expect(checkout.getByRole("alert")).toContainText("chưa lưu địa chỉ lấy hàng");
  await page.goto(`/#live/${roomID}`);
  const player = await page.locator(".live-video").elementHandle();
  await page.getByRole("button", { name: "Cài đặt giao hàng", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "Nơi lấy hàng của phiên live", exact: true });
  await chooseCarrier(settings);
  await settings.getByRole("button", { name: "Lưu cài đặt giao hàng", exact: true }).click();
  await expect(settings).not.toBeVisible();
  expect(await player.evaluate((element) => element.isConnected)).toBe(true);
  expect(sellerWrites.some((entry) => entry.path.endsWith("/media-token"))).toBe(false);
  await checkout.getByRole("button", { name: "Thử tính lại", exact: true }).click();
  await expect(checkout.getByLabel("Chi tiết thanh toán")).toContainText("25.000");
  await checkout.getByRole("button", { name: "Xác nhận đặt hàng", exact: true }).click();
  await expect(checkout).not.toBeVisible();
  expect(buyerWrites.find((entry) => entry.path === "/api/orders").body.expected_total).toBe(105000);
  await expect(buyer).toHaveURL(new RegExp(`#live/${roomID}$`));
});

test("missing carrier configuration does not allow a local order or invented fee", async ({ page }) => {
  const writes = await mockAPI(page, false, true);
  writes.command("shipping.provinces", () => ({ status: 503, data: { error: "shipping_provider_not_configured" } }));
  await page.goto(`/#live/${roomID}`);
  await page.getByRole("button", { name: "Chọn mua", exact: true }).click();
  const checkout = page.getByRole("dialog", { name: "Đặt hàng", exact: true });
  await checkout.getByLabel("Họ tên người nhận", { exact: true }).fill(receiver.name);
  await checkout.getByLabel("Số điện thoại", { exact: true }).fill(receiver.phone);
  await checkout.getByLabel("Tỉnh / Thành phố", { exact: true }).selectOption("1");
  await checkout.getByLabel("Phường / Xã", { exact: true }).fill(receiver.ward);
  await checkout.getByLabel("Địa chỉ cụ thể", { exact: true }).fill(receiver.address_line);
  await expect(checkout.getByText(/Hệ thống báo phí vận chuyển chưa được cấu hình/)).toBeVisible();
  await expect(checkout.getByRole("button", { name: "Xác nhận đặt hàng", exact: true })).toBeDisabled();
  expect(writes.some((entry) => entry.path === "/api/orders" || entry.path === "/api/orders/quote")).toBe(false);
});

test("seller edits parcel metadata without a shipping-fee input", async ({ page }) => {
  await mockAPI(page, true);
  const edits = [];
  await page.route(`**/api/products/${productID}`, (route) => {
    edits.push(route.request().postDataJSON());
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ id: productID, ...edits.at(-1) }) });
  });
  await page.goto("/#seller");
  await page.getByRole("button", { name: "Sửa", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "Sửa sản phẩm", exact: true });
  await expect(editor.getByLabel("Phí ship nội tỉnh (VNĐ)", { exact: true })).toHaveCount(0);
  await editor.getByLabel("Khối lượng (gram)", { exact: true }).fill("0");
  await editor.getByLabel("Chiều dài (cm)", { exact: true }).fill("20");
  await editor.getByLabel("Chiều rộng (cm)", { exact: true }).fill("15");
  await editor.getByLabel("Chiều cao (cm)", { exact: true }).fill("10");
  await editor.getByRole("button", { name: "Xác nhận", exact: true }).click();
  expect(edits).toHaveLength(0);
  await editor.getByLabel("Khối lượng (gram)", { exact: true }).fill("750");
  await editor.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(editor).not.toBeVisible();
  expect(edits).toHaveLength(1);
  expect(edits[0].parcel).toEqual({ weight_grams: 750, length_cm: 20, width_cm: 15, height_cm: 10 });
});

test("a changed shipping quote requires a second confirmation and preserves the request key", async ({ page }) => {
  const writes = await mockAPI(page, false, true);
  let fee = 25000;
  const attempts = [];
  writes.command("shipping.quote", (input) => ({ data: {
    unit_price: 80000, quantity: input.quantity, items_subtotal: 80000 * input.quantity,
    shipping_fee: fee, total_amount: 80000 * input.quantity + fee, pickup_province: "Thành phố Hà Nội", currency: "VND",
  } }));
  await page.route("**/api/orders", (route) => {
    attempts.push(route.request().postDataJSON());
    if (attempts.length === 1) {
      fee = 30000;
      return route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "checkout_changed" }) });
    }
    return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ order_id: "66666666-6666-4666-8666-666666666666", status: "pending" }) });
  });
  await page.goto(`/#live/${roomID}`);
  await page.getByRole("button", { name: "Chọn mua", exact: true }).click();
  const checkout = page.getByRole("dialog", { name: "Đặt hàng", exact: true });
  await fillDelivery(checkout);
  await checkout.getByLabel("Ghi chú giao hàng (không bắt buộc)", { exact: true }).fill("Gọi trước khi giao");
  await checkout.getByRole("button", { name: "Xác nhận đặt hàng" }).click();
  await expect(checkout.getByRole("alert")).toContainText("vừa thay đổi");
  await expect(checkout.getByLabel("Chi tiết thanh toán")).toContainText("110.000");
  expect(attempts).toHaveLength(1);
  await checkout.getByRole("button", { name: "Xác nhận đặt hàng" }).click();
  await expect(checkout).not.toBeVisible();
  expect(attempts).toHaveLength(2);
  expect(attempts[0].request_id).toEqual(attempts[1].request_id);
  expect(attempts[1].expected_total).toBe(110000);
  expect(attempts[1].note).toBe("Gọi trước khi giao");
});

const stationPickup = { ...receiver, station_id: 1888, station_name: "GHN Điểm gần", location_mode: "manual", latitude: 21.029, longitude: 105.805, ward: "Phường Hoàn Kiếm", carrier_ward_code: "gps-100", address_line: "10 Đường bưu cục" };
const nearbyStationResult = { district: "Khu vực kiểm tra", complete: true, environment: "staging", quote_only: true, data: [
  { id: 1888, name: "GHN Điểm gần", address: stationPickup.address_line, latitude: stationPickup.latitude, longitude: stationPickup.longitude, distance_meters: 60, pickup_address: stationPickup },
  { id: 1889, name: "GHN Điểm xa", address: "Đường xa", latitude: 21.04, longitude: 105.81, distance_meters: 1300, pickup_address: { ...stationPickup, station_id: 1889, station_name: "GHN Điểm xa", address_line: "Đường xa", latitude: 21.04, longitude: 105.81 } },
  { id: 1890, name: "GHN Chưa ánh xạ", address: "Chưa xác định", distance_meters: null },
] };
async function carrierGPS(page) {
  await page.route("**/api/delivery/reverse-geocode", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ address: { ...receiver, ...route.request().postDataJSON(), location_mode: "current", province_name: "Thành phố Hà Nội", carrier_ward_code: "gps-100", ward: "Phường Hoàn Kiếm", address_line: "12 Đinh Tiên Hoàng" } }) }));
}

test("seller selects a nearby GHN station and buyer keeps the live after a station quote", async ({ page, context }, testInfo) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await context.grantPermissions(["geolocation"]); await context.setGeolocation({ latitude: 21.028511, longitude: 105.804817 });
  const writes = await mockAPI(page, true); await carrierGPS(page);
  const searches = [];
  writes.command("shipping.stations.nearby", (data) => { searches.push(data); return { data: { ...nearbyStationResult, selected: nearbyStationResult.data[0] } }; });
  await page.goto(`/#live/${roomID}`);
  const player = await page.locator(".live-video").elementHandle();
  await page.getByRole("button", { name: "Cài đặt giao hàng", exact: true }).click();
  const origin = page.getByRole("dialog", { name: "Nơi lấy hàng của phiên live", exact: true });
  await origin.getByRole("radio", { name: "Sử dụng vị trí hiện tại", exact: true }).check();
  const search = origin.getByRole("button", { name: "Tìm bưu cục GHN gần vị trí này", exact: true });
  await expect(origin.getByLabel("Địa chỉ cụ thể", { exact: true })).toHaveValue(stationPickup.address_line);
  await expect(origin.getByRole("region", { name: "Bản đồ chọn địa chỉ" })).toBeVisible();
  await expect(origin.locator(".station-pin")).toHaveCount(2);
  await expect(origin.getByRole("button", { name: "Chọn bưu cục GHN Chưa ánh xạ", exact: true })).toBeDisabled();
  expect(searches).toEqual([{ latitude: 21.028511, longitude: 105.804817, carrier_province_id: 1, carrier_district_id: 100 }]);
  expect(writes.some((entry) => entry.path.endsWith("/pickup") && entry.method === "PUT")).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("station-picker.png"), fullPage: true });
  await origin.getByRole("button", { name: "Chọn bưu cục GHN Điểm gần", exact: true }).click();
  await expect(origin.getByLabel("Người liên hệ", { exact: true })).toHaveValue("Chủ shop");
  await expect(origin.getByLabel("Địa chỉ cụ thể", { exact: true })).toHaveValue(stationPickup.address_line);
  await expect(origin.getByRole("status")).toContainText("Điểm gửi đã chọn: GHN Điểm gần");
  await origin.getByRole("button", { name: "Lưu cài đặt giao hàng", exact: true }).click();
  await expect(origin).not.toBeVisible();
  expect(writes.find((entry) => entry.path.endsWith("/pickup") && entry.method === "PUT").body.pickup_address).toMatchObject({ station_id: 1888, station_name: "GHN Điểm gần", latitude: stationPickup.latitude, longitude: stationPickup.longitude, name: "Chủ shop", phone: receiver.phone });
  expect(await player.evaluate((element) => element.isConnected)).toBe(true);
  expect(writes.some((entry) => entry.path.endsWith("/media-token"))).toBe(false);
  const buyer = await context.newPage();
  const buyerWrites = await mockAPI(buyer, false, true);
  buyerWrites.command("shipping.quote", () => ({ data: { unit_price: 80000, quantity: 1, items_subtotal: 80000, shipping_fee: 19000, total_amount: 99000, currency: "VND", pickup_province: "Thành phố Hà Nội", shipping: { provider: "ghn", environment: "staging", origin_type: "station_dropoff", station_id: 1888, station_name: "GHN Điểm gần", quote_only: true } } }));
  await buyer.goto(`/#live/${roomID}`); await buyer.getByRole("button", { name: "Chọn mua", exact: true }).click();
  const checkout = buyer.getByRole("dialog", { name: "Đặt hàng", exact: true }); await fillDelivery(checkout);
  await expect(checkout.getByText("Phí tính từ GHN Điểm gần; người bán tự mang hàng ra bưu cục.", { exact: true })).toBeVisible();
  await checkout.getByRole("button", { name: "Xác nhận đặt hàng", exact: true }).click(); await expect(checkout).not.toBeVisible();
  expect(buyerWrites.find((entry) => entry.path === "/api/orders").body.expected_total).toBe(99000);
  await expect(buyer).toHaveURL(new RegExp(`#live/${roomID}$`));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); expect(errors).toEqual([]);
});

test("GHN station access failure preserves the manual pickup fallback", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]); await context.setGeolocation({ latitude: 21.028511, longitude: 105.804817 });
  const writes = await mockAPI(page, true); await carrierGPS(page);
  writes.command("shipping.stations.nearby", () => ({ status: 503, data: { error: "shipping_stations_access_required" } }));
  await page.goto(`/#live/${roomID}`); await page.getByRole("button", { name: "Cài đặt giao hàng", exact: true }).click();
  const origin = page.getByRole("dialog", { name: "Nơi lấy hàng của phiên live", exact: true });
  await origin.getByRole("radio", { name: "Sử dụng vị trí hiện tại", exact: true }).check();
  const search = origin.getByRole("button", { name: "Tìm bưu cục GHN gần vị trí này", exact: true }); await expect(search).toBeEnabled(); await search.click();
  await expect(origin.getByRole("alert")).toContainText("Tài khoản GHN chưa có quyền tra bưu cục");
  await origin.getByRole("radio", { name: "Nhập địa chỉ", exact: true }).check();
  await origin.getByLabel("Địa chỉ cụ thể", { exact: true }).fill("Địa chỉ lấy hàng trực tiếp");
  await origin.getByRole("button", { name: "Lưu cài đặt giao hàng", exact: true }).click(); await expect(origin).not.toBeVisible();
  const saved = writes.find((entry) => entry.path.endsWith("/pickup") && entry.method === "PUT").body.pickup_address;
  expect(saved.station_id || 0).toBe(0); expect(saved.address_line).toBe("Địa chỉ lấy hàng trực tiếp");
});

test("late station results cannot replace a new search district", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]); await context.setGeolocation({ latitude: 21.028511, longitude: 105.804817 });
  const writes = await mockAPI(page, true); await carrierGPS(page);
  let finish, started = false; const pending = new Promise((resolve) => { finish = resolve; });
  writes.command("shipping.stations.nearby", async (query) => { if (query.carrier_district_id !== 100) return { data: { data: [], complete: true, district: "Khu vực mới" } }; started = true; await pending; return { data: nearbyStationResult }; });
  await page.goto(`/#live/${roomID}`); await page.getByRole("button", { name: "Cài đặt giao hàng", exact: true }).click();
  const origin = page.getByRole("dialog", { name: "Nơi lấy hàng của phiên live", exact: true });
  await origin.getByRole("radio", { name: "Sử dụng vị trí hiện tại", exact: true }).check();
  const search = origin.getByRole("button", { name: "Tìm bưu cục GHN gần vị trí này", exact: true });
  await expect.poll(() => started).toBe(true);
  await origin.getByLabel("Tỉnh / Thành phố", { exact: true }).selectOption("79");
  await origin.getByLabel("Quận / Huyện (GHN)", { exact: true }).selectOption("7900"); finish();
  await expect(search).toBeEnabled();
  await expect(origin.getByRole("button", { name: "Chọn bưu cục GHN Điểm gần", exact: true })).toHaveCount(0);
  await expect(origin.getByLabel("Tỉnh / Thành phố", { exact: true })).toHaveValue("79");
  await expect(origin.getByLabel("Quận / Huyện (GHN)", { exact: true })).toHaveValue("7900");
});
