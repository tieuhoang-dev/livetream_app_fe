import { test, expect } from "@playwright/test";

async function demo(page) {
  await page.addInitScript(() =>
    sessionStorage.setItem("livemart-mode", "demo"),
  );
}

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

  test("shopping drawer hands off to checkout and creates a demo order", async ({
    page,
  }) => {
    const errors = collectErrors(page);
    await demo(page);
    await page.goto("/#live/coffee");
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
    await checkout.getByRole("button", { name: "Xác nhận đặt hàng" }).click();
    await expect(page).toHaveURL(/#orders$/);
    await expect(
      page.getByText("Đã tạo đơn hàng.", { exact: true }),
    ).toBeVisible();
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

async function mockAPI(page, owner = false) {
  const writes = [];
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
  const profile = {
    user_id: sellerID,
    username: "Chủ shop",
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  const token =
    "ui-fixture." +
    Buffer.from(JSON.stringify(profile)).toString("base64url") +
    ".fixture";
  await page.addInitScript(
    ({ token, owner }) => {
      sessionStorage.setItem("livemart-mode", "api");
      if (owner) sessionStorage.setItem("livemart-token", token);
    },
    { token, owner },
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
    if (path.endsWith("/media-token")) {
      status = 503;
      payload = { error: "live_media_unavailable" };
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
  await page.getByRole("button", { name: "Bắt đầu phát", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("LiveKit");
  expect(writes.at(-1).body).toEqual({ role: "publisher" });
  await expect(
    page.getByRole("heading", { name: "Phòng kiểm tra API" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Bắt đầu phát", exact: true }).click();
  await expect.poll(() => writes.length).toBe(3);
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
