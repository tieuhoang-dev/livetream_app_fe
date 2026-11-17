import { test, expect } from "@playwright/test";

async function demo(page) {
  await page.addInitScript(() =>
    sessionStorage.setItem("livemart-mode", "demo"),
  );
}

const receiver = { name: "Người nhận thử", phone: "0901234567", province_code: "1", ward: "Phường thử", address_line: "12 Đường thử", latitude: null, longitude: null };
async function fillDelivery(dialog, value = receiver) {
  await dialog.getByLabel("Họ tên người nhận", { exact: true }).fill(value.name);
  await dialog.getByLabel("Số điện thoại", { exact: true }).fill(value.phone);
  await dialog.getByLabel("Tỉnh / Thành phố", { exact: true }).selectOption(value.province_code);
  await dialog.getByLabel("Phường / Xã", { exact: true }).fill(value.ward);
  await dialog.getByLabel("Địa chỉ cụ thể", { exact: true }).fill(value.address_line);
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

const roomID = "11111111-1111-4111-8111-111111111111";
const sellerID = "22222222-2222-4222-8222-222222222222";
const productID = "33333333-3333-4333-8333-333333333333";
const buyerID = "44444444-4444-4444-8444-444444444444";

async function mockAPI(page, owner = false, signedIn = owner) {
  const writes = [];
  let shipping = { pickup_address: { ...receiver, name: "Chủ shop", province_name: "Thành phố Hà Nội" }, same_province_fee: 25000, other_province_fee: 40000, free_shipping_from: null };
  let livePickup = null;
  const room = {
    id: roomID,
    title: "Phòng kiểm tra API",
    seller_id: sellerID,
    seller_username: "Shop kiểm tra",
    status: "start",
    started_at: new Date().toISOString(),
  };
  const item = {
    id: "allocation",
    product_id: productID,
    name: "Sản phẩm kiểm tra",
    stock_quantity: 5,
    discount_price: 80000,
    original_price: 100000,
    is_pinned: true,
  };
  await page.routeWebSocket("**/api/livestreams/ws", (socket) => {
    socket.onMessage((raw) => {
      const message = JSON.parse(raw);
      socket.send(JSON.stringify({ type: "list_lives_success", request_id: message.request_id,
        data: [room], total: 1, page: message.query.page || 1, page_size: message.query.page_size || 20 }));
    });
  });
  const profile = {
    user_id: owner ? sellerID : buyerID,
    username: owner ? "Chủ shop" : "Người mua",
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const token =
    "ui-fixture." +
    Buffer.from(JSON.stringify(profile)).toString("base64url") +
    ".fixture";
  await page.addInitScript(
    ({ token, signedIn }) => {
      sessionStorage.setItem("livemart-mode", "api");
      if (signedIn) sessionStorage.setItem("livemart-token", token);
    },
    { token, signedIn },
  );
  await page.route("**/api/**", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    const path = url.pathname;
    let status = 200,
      payload;
    if (request.method() !== "GET")
      writes.push({
        path,
        method: request.method(),
        body: request.postDataJSON(),
        authorization: request.headers().authorization,
      });
    if (path === "/api/delivery/reverse-geocode") {
      const point = request.postDataJSON();
      payload = { address: { ...point, location_mode: "current", province_code: "1", province_name: "Thành phố Hà Nội", ward: "Phường Hoàn Kiếm", address_line: "12 Đinh Tiên Hoàng" }, attribution: "© OpenStreetMap contributors" };
    } else if (path === "/api/sales/shipping-settings") {
      if (request.method() === "PUT") shipping = request.postDataJSON();
      payload = { configured: true, settings: shipping };
    } else if (path === `/api/livestreams/${roomID}/pickup`) {
      if (request.method() === "PUT") {
        const input = request.postDataJSON();
        livePickup = input.pickup_address;
        if (input.shipping_rates) shipping = { ...shipping, ...input.shipping_rates };
      }
      payload = { pickup_address: livePickup || shipping.pickup_address, shipping_configured: true,
        shipping_rates: { same_province_fee: shipping.same_province_fee, other_province_fee: shipping.other_province_fee, free_shipping_from: shipping.free_shipping_from } };
    } else if (path === "/api/orders/quote") {
      const input = request.postDataJSON();
      const fee = input.delivery.province_code === "1" ? 25000 : 40000;
      payload = { unit_price: item.discount_price, quantity: input.quantity, items_subtotal: input.quantity * item.discount_price, shipping_fee: fee, total_amount: input.quantity * item.discount_price + fee, currency: "VND", shipping_zone: input.delivery.province_code === "1" ? "same_province" : "other_province", pickup_province: "Thành phố Hà Nội" };
    } else if (path.endsWith("/media-token")) {
      status = 503;
      payload = { error: "live_media_unavailable" };
    } else if (path === "/api/orders" && request.method() === "POST") {
      const input = request.postDataJSON();
      item.stock_quantity -= input.quantity;
      status = 201;
      payload = { order_id: "55555555-5555-4555-8555-555555555555", status: "pending", total_amount: input.quantity * item.discount_price };
    } else if (path.endsWith("/comments"))
      payload = { data: [], next_cursor: "0", has_more: false };
    else if (path === `/api/livestreams/${roomID}`) payload = room;
    else if (path === "/api/livestreams")
      payload = { data: [room], total: 1, page: 1, page_size: 20 };
    else if (path === "/api/products")
      payload = {
        data: [
          {
            id: productID,
            seller_id: sellerID,
            name: item.name,
            stock_quantity: 20,
            price: 100000,
          },
        ],
        total: 1,
        page: 1,
        page_size: 100,
      };
    else if (path.endsWith("/products")) {
      status = request.method() === "POST" ? 201 : 200;
      payload =
        request.method() === "POST"
          ? { message: "Product added to livestream" }
          : { data: [item], total: 1, page: 1, page_size: 12 };
    } else {
      status = 404;
      payload = { error: "fixture endpoint not found" };
    }
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(payload),
    });
  });
  return writes;
}

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
  expect(writes[0].authorization).toContain("Bearer ui-fixture.");
  await dialog.getByRole("button", { name: "Đóng", exact: true }).click();
  await page.addInitScript(() => {
    navigator.geolocation.getCurrentPosition = (_success, failure) => failure({ code: 1 });
  });
  await page.evaluate(() => { navigator.geolocation.getCurrentPosition = (_success, failure) => failure({ code: 1 }); });
  await page.getByRole("button", { name: "Bắt đầu phát", exact: true }).click();
  const origin = page.getByRole("dialog", { name: "Nơi lấy hàng của phiên live", exact: true });
  await expect(origin.getByRole("alert")).toContainText("Không lấy được vị trí");
  await origin.getByRole("radio", { name: "Nhập địa chỉ", exact: true }).check();
  await origin.getByRole("button", { name: "Dùng địa chỉ và bắt đầu phát", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("LiveKit");
  expect(writes.at(-1).body).toEqual({ role: "publisher" });
  await expect(
    page.getByRole("heading", { name: "Phòng kiểm tra API" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Bắt đầu phát", exact: true }).click();
  await origin.getByRole("radio", { name: "Nhập địa chỉ", exact: true }).check();
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

test("seller saves pickup address, shipping fees and a GPS pin", async ({ page, context }) => {
  const errors = collectErrors(page);
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 21.028511, longitude: 105.804817 });
  await mockAPI(page, true);
  await page.goto("/#seller");
  await page.getByRole("button", { name: "Giao hàng", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Địa chỉ lấy hàng và phí giao hàng" })).toBeVisible();
  await page.getByLabel("Người liên hệ", { exact: true }).fill("Chủ shop thử nghiệm");
  await page.getByLabel("Phí ship nội tỉnh (VNĐ)", { exact: true }).fill("28000");
  await page.getByLabel("Phí ship liên tỉnh (VNĐ)", { exact: true }).fill("45000");
  await page.getByRole("radio", { name: "Sử dụng vị trí hiện tại", exact: true }).check();
  await expect(page.getByLabel("Phường / Xã", { exact: true })).toHaveValue("Phường Hoàn Kiếm");
  await expect(page.getByLabel("Địa chỉ cụ thể", { exact: true })).toHaveValue("12 Đinh Tiên Hoàng");
  await expect(page.getByText("Đã xác định vị trí. Bạn có thể mở bản đồ để kiểm tra hoặc chỉnh lại.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Lưu cấu hình giao hàng", exact: true }).click();
  await expect(page.getByText("Đã lưu địa chỉ lấy hàng và phí vận chuyển.", { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Giao hàng", exact: true }).click();
  await expect(page.getByLabel("Người liên hệ", { exact: true })).toHaveValue("Chủ shop thử nghiệm");
  await expect(page.getByLabel("Phí ship nội tỉnh (VNĐ)", { exact: true })).toHaveValue("28000");
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
  await expect(checkout.getByLabel("Phường / Xã", { exact: true })).toHaveValue("Phường Hoàn Kiếm");
  await expect(checkout.getByLabel("Địa chỉ cụ thể", { exact: true })).toHaveValue("12 Đinh Tiên Hoàng");
  await checkout.getByLabel("Địa chỉ cụ thể", { exact: true }).fill("12 Đinh Tiên Hoàng, căn hộ 4");
  await checkout.getByRole("button", { name: "Xác nhận đặt hàng", exact: true }).click();
  await expect(checkout).not.toBeVisible();
  const order = writes.find((entry) => entry.path === "/api/orders");
  expect(order.body.delivery).toMatchObject({ name: receiver.name, phone: receiver.phone, province_code: "1", ward: "Phường Hoàn Kiếm", address_line: "12 Đinh Tiên Hoàng, căn hộ 4", latitude: 21.028511, longitude: 105.804817, location_mode: "current" });
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
  await origin.getByRole("button", { name: "Dùng địa chỉ và bắt đầu phát", exact: true }).click();
  await expect(origin).not.toBeVisible();
  await expect(page.getByRole("alert")).toContainText("LiveKit");
  expect(writes.map((entry) => entry.path)).toEqual(["/api/delivery/reverse-geocode", `/api/livestreams/${roomID}/pickup`, `/api/livestreams/${roomID}/media-token`]);
  expect(writes[1].body.pickup_address).toMatchObject({ name: "Chủ shop", phone: receiver.phone, location_mode: "current", latitude: 21.028511, longitude: 105.804817, address_line: "12 Đinh Tiên Hoàng" });
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
  await checkout.getByLabel("Địa chỉ cụ thể", { exact: true }).fill("99 Địa chỉ nhập tay");
  await page.evaluate(() => window.pendingGPS({ coords: { latitude: 21.028511, longitude: 105.804817 } }));
  await checkout.getByRole("button", { name: "Xác nhận đặt hàng", exact: true }).click();
  await expect(checkout).not.toBeVisible();
  expect(writes.some((entry) => entry.path === "/api/delivery/reverse-geocode")).toBe(false);
  expect(writes.find((entry) => entry.path === "/api/orders").body.delivery).toMatchObject({ address_line: "99 Địa chỉ nhập tay", latitude: null, longitude: null, location_mode: "manual" });
});

test("a shop without shipping setup cannot produce a fake zero-fee order", async ({ page }) => {
  const writes = await mockAPI(page, false, true);
  await page.route("**/api/orders/quote", (route) => route.fulfill({
    status: 409, contentType: "application/json", body: JSON.stringify({ error: "shipping_not_configured" }),
  }));
  await page.goto(`/#live/${roomID}`);
  await page.getByRole("button", { name: "Chọn mua", exact: true }).click();
  const checkout = page.getByRole("dialog", { name: "Đặt hàng", exact: true });
  await fillDelivery(checkout);
  await expect(checkout.getByRole("alert")).toContainText("Shop chưa thiết lập");
  await expect(checkout.getByRole("button", { name: "Xác nhận đặt hàng" })).toBeDisabled();
  expect(writes.filter((write) => write.path === "/api/orders")).toHaveLength(0);
});

test("province quotes shipping before contact details and offers local ward suggestions", async ({ page }) => {
  const writes = await mockAPI(page, false, true);
  await page.goto(`/#live/${roomID}`);
  await page.getByRole("button", { name: "Chọn mua", exact: true }).click();
  const checkout = page.getByRole("dialog", { name: "Đặt hàng", exact: true });
  await expect(checkout.getByLabel("Phường / Xã", { exact: true })).toBeDisabled();
  await checkout.getByLabel("Tỉnh / Thành phố", { exact: true }).selectOption("1");
  await expect(checkout.getByLabel("Chi tiết thanh toán")).toContainText("25.000");
  await expect(checkout.locator('datalist option[value="Phường Ba Đình"]')).toHaveCount(1);
  await expect(checkout.getByRole("button", { name: "Xác nhận đặt hàng", exact: true })).toBeDisabled();
  await checkout.getByLabel("Phường / Xã", { exact: true }).fill("Phường Ba Đình");
  await checkout.getByLabel("Tỉnh / Thành phố", { exact: true }).selectOption("79");
  await expect(checkout.getByLabel("Phường / Xã", { exact: true })).toHaveValue("");
  await expect(checkout.locator('datalist option[value="Phường Sài Gòn"]')).toHaveCount(1);
  await expect(checkout.getByLabel("Chi tiết thanh toán")).toContainText("40.000");
  const before = writes.filter((entry) => entry.path === "/api/orders/quote").length;
  await checkout.getByLabel("Họ tên người nhận", { exact: true }).fill(receiver.name);
  await checkout.getByLabel("Số điện thoại", { exact: true }).fill("123");
  await expect(checkout.getByText("Nhập số điện thoại Việt Nam bắt đầu bằng 0 hoặc +84.", { exact: true })).toBeVisible();
  await checkout.getByLabel("Số điện thoại", { exact: true }).fill(receiver.phone);
  await checkout.getByLabel("Phường / Xã", { exact: true }).fill("Phường Sài Gòn");
  await checkout.getByLabel("Địa chỉ cụ thể", { exact: true }).fill(receiver.address_line);
  await page.waitForTimeout(500);
  expect(writes.filter((entry) => entry.path === "/api/orders/quote")).toHaveLength(before);
  await checkout.getByRole("button", { name: "Xác nhận đặt hàng", exact: true }).click();
  await expect(checkout).not.toBeVisible();
  expect(writes.find((entry) => entry.path === "/api/orders").body).toMatchObject({ expected_total: 120000, delivery: { province_code: "79", ward: "Phường Sài Gòn" } });
});

test("first-time seller must enter both shipping fees before starting media", async ({ page }) => {
  const writes = await mockAPI(page, true);
  const saved = [];
  await page.addInitScript(() => { navigator.geolocation.getCurrentPosition = (_success, failure) => failure({ code: 1 }); });
  await page.route(`**/api/livestreams/${roomID}/pickup`, (route) => {
    if (route.request().method() === "GET") return route.fulfill({ contentType: "application/json", body: JSON.stringify({ pickup_address: receiver, shipping_configured: false, shipping_rates: null }) });
    saved.push(route.request().postDataJSON());
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ pickup_address: saved.at(-1).pickup_address }) });
  });
  await page.goto(`/#live/${roomID}`);
  await page.getByRole("button", { name: "Bắt đầu phát", exact: true }).click();
  const origin = page.getByRole("dialog", { name: "Nơi lấy hàng của phiên live", exact: true });
  await origin.getByRole("radio", { name: "Nhập địa chỉ", exact: true }).check();
  const submit = origin.getByRole("button", { name: "Dùng địa chỉ và bắt đầu phát", exact: true });
  await expect(submit).toBeDisabled();
  await origin.getByLabel("Phí ship nội tỉnh (VNĐ)", { exact: true }).fill("25000");
  await expect(submit).toBeDisabled();
  expect(writes.some((entry) => entry.path.endsWith("/media-token"))).toBe(false);
  await origin.getByLabel("Phí ship liên tỉnh (VNĐ)", { exact: true }).fill("40000");
  await submit.click();
  await expect(origin).not.toBeVisible();
  await expect(page.getByRole("alert")).toContainText("LiveKit");
  expect(saved).toHaveLength(1);
  expect(saved[0].shipping_rates).toEqual({ same_province_fee: 25000, other_province_fee: 40000, free_shipping_from: null });
});

test("seller fixes missing shipping inside an existing room and buyer retries successfully", async ({ page, context }) => {
  const sellerWrites = await mockAPI(page, true);
  let rates = null;
  await page.route(`**/api/livestreams/${roomID}/pickup`, (route) => {
    if (route.request().method() === "GET") return route.fulfill({ contentType: "application/json", body: JSON.stringify({ pickup_address: receiver, shipping_configured: Boolean(rates), shipping_rates: rates }) });
    const input = route.request().postDataJSON(); rates = input.shipping_rates;
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ pickup_address: input.pickup_address }) });
  });
  const buyer = await context.newPage();
  const buyerWrites = await mockAPI(buyer, false, true);
  await buyer.route("**/api/orders/quote", (route) => route.fulfill({ status: rates ? 200 : 409, contentType: "application/json", body: JSON.stringify(rates ? { unit_price: 80000, quantity: 1, items_subtotal: 80000, shipping_fee: rates.same_province_fee, total_amount: 80000 + rates.same_province_fee, currency: "VND", pickup_province: "Thành phố Hà Nội" } : { error: "shipping_not_configured" }) }));
  await buyer.goto(`/#live/${roomID}`);
  await buyer.getByRole("button", { name: "Chọn mua", exact: true }).click();
  const checkout = buyer.getByRole("dialog", { name: "Đặt hàng", exact: true });
  await fillDelivery(checkout);
  await expect(checkout.getByRole("alert")).toContainText("Shop chưa thiết lập");
  await page.goto(`/#live/${roomID}`);
  const player = await page.locator(".live-video").elementHandle();
  await page.getByRole("button", { name: "Cài đặt giao hàng", exact: true }).click();
  const settings = page.getByRole("dialog", { name: "Nơi lấy hàng của phiên live", exact: true });
  await settings.getByLabel("Phí ship nội tỉnh (VNĐ)", { exact: true }).fill("25000");
  await settings.getByLabel("Phí ship liên tỉnh (VNĐ)", { exact: true }).fill("40000");
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

test("a changed shipping quote requires a second confirmation and preserves the request key", async ({ page }) => {
  await mockAPI(page, false, true);
  let fee = 25000;
  const attempts = [];
  await page.route("**/api/orders/quote", (route) => {
    const input = route.request().postDataJSON();
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      unit_price: 80000, quantity: input.quantity, items_subtotal: 80000 * input.quantity,
      shipping_fee: fee, total_amount: 80000 * input.quantity + fee, pickup_province: "Thành phố Hà Nội", currency: "VND",
    }) });
  });
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
