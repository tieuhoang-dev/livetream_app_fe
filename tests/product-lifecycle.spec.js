import { test, expect } from "@playwright/test";
import { mockAPI, roomID, productID } from "./fixtures/api";

const photo = { name: "photo.png", mimeType: "image/png", buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=", "base64") };
async function fillProduct(form) {
  await form.getByLabel("Tên sản phẩm", { exact: true }).fill("Ảnh từ thiết bị");
  await form.getByLabel("Giá (₫)", { exact: true }).fill("100000");
  await form.getByLabel("Tồn kho ban đầu", { exact: true }).fill("5");
  await form.getByLabel("Khối lượng (gram)", { exact: true }).fill("500");
  await form.getByLabel("Chiều dài (cm)", { exact: true }).fill("20");
  await form.getByLabel("Chiều rộng (cm)", { exact: true }).fill("15");
  await form.getByLabel("Chiều cao (cm)", { exact: true }).fill("10");
  await form.getByLabel("Ảnh sản phẩm", { exact: true }).setInputFiles(photo);
  await expect(form.getByAltText("Ảnh sản phẩm đã chọn")).toBeVisible();
  await expect(form.getByLabel("Đường dẫn ảnh", { exact: true })).toHaveCount(0);
}

test("catalog creation uploads a file as multipart before saving product metadata", async ({ page }) => {
  const backend = await mockAPI(page, true);
  await page.goto("/#seller");
  await page.getByRole("button", { name: "Thêm sản phẩm", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Thêm sản phẩm", exact: true });
  await fillProduct(form);
  await form.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(form).not.toBeVisible();
  const upload = backend.find((w) => w.path === "/api/products/images");
  expect(upload.transport).toBe("http"); expect(upload.body).toContain('name="file"; filename="photo.png"');
  expect(upload.authorization).toContain("Bearer ui-fixture.");
  const create = backend.find((w) => w.path === "/api/products");
  expect(create.body).toMatchObject({ name: "Ảnh từ thiết bị", image_url: "/uploads/products/fixture.png", stock_quantity: 5, parcel: { weight_grams: 500, length_cm: 20, width_cm: 15, height_cm: 10 } });
  expect(backend.indexOf(upload)).toBeLessThan(backend.indexOf(create));
});

test("create-in-live uploads an image and sends one atomic websocket mutation", async ({ page }) => {
  const backend = await mockAPI(page, true);
  await page.goto(`/#live/${roomID}`);
  const player = await page.locator(".live-video").elementHandle();
  await page.getByRole("button", { name: "Thêm sản phẩm vào live", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Sản phẩm trong live", exact: true });
  await form.getByRole("button", { name: "Tạo sản phẩm mới", exact: true }).click();
  await fillProduct(form);
  await form.getByLabel("Giá trong live", { exact: true }).fill("80000");
  await form.getByLabel("Số lượng đưa lên live", { exact: true }).fill("2");
  await form.getByRole("button", { name: "Tạo và thêm vào live", exact: true }).click();
  await expect.poll(() => backend.filter((w) => w.command === "live.products.create").length).toBe(1);
  await expect(form.getByRole("combobox", { name: "Sản phẩm", exact: true })).toBeVisible();
  const create = backend.filter((w) => w.command === "live.products.create");
  expect(create).toHaveLength(1); expect(create[0].transport).toBe("websocket");
  expect(create[0].body).toMatchObject({ product: { image_url: "/uploads/products/fixture.png", stock_quantity: 5 }, stock_quantity: 2, discount_price: 80000 });
  expect(backend.some((w) => w.path === "/api/products")).toBe(false);
  expect(await player.evaluate((element) => element.isConnected)).toBe(true);
  await expect(page).toHaveURL(new RegExp(`#live/${roomID}$`));
});

test("upload failure keeps the product form and never creates a product", async ({ page }) => {
  const backend = await mockAPI(page, true);
  await page.route("**/api/products/images", (route) => route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ error: "Ảnh không hợp lệ" }) }));
  await page.goto("/#seller"); await page.getByRole("button", { name: "Thêm sản phẩm", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Thêm sản phẩm", exact: true }); await fillProduct(form);
  await form.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(form.getByRole("alert")).toHaveText("Ảnh không hợp lệ");
  await expect(form.getByLabel("Tên sản phẩm", { exact: true })).toHaveValue("Ảnh từ thiết bị");
  expect(backend.some((w) => w.path === "/api/products")).toBe(false);
});

test("seller logout ends owned lives over websocket before clearing session", async ({ page }) => {
  const backend = await mockAPI(page, true);
  await page.goto(`/#live/${roomID}`);
  await page.getByRole("button", { name: "Chủ shop", exact: true }).click();
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await expect.poll(() => backend.frames.filter((f) => f.type === "live.logout").length).toBe(1);
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem("livemart-token"))).toBeNull();
  await expect(page).not.toHaveURL(new RegExp(`#live/${roomID}$`));
});


test("editing a product keeps its saved parcel and image when only the name changes", async ({ page }) => {
  await mockAPI(page, true);
  const parcel = { weight_grams: 500, length_cm: 20, width_cm: 15, height_cm: 10 };
  await page.route("**/api/products?**", (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: [{ id: productID, name: "Sản phẩm cũ", price: 100000, stock_quantity: 20, image_url: "/uploads/existing.png", parcel }], total: 1, page: 1, page_size: 100 }) }));
  let saved;
  await page.route(`**/api/products/${productID}`, (route) => { saved = route.request().postDataJSON(); return route.fulfill({ contentType: "application/json", body: JSON.stringify({ id: productID, ...saved }) }); });
  await page.goto("/#seller"); await page.getByRole("button", { name: "Sửa", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Sửa sản phẩm", exact: true });
  await expect(form.getByLabel("Khối lượng (gram)", { exact: true })).toHaveValue("500");
  await expect(form.getByLabel("Chiều dài (cm)", { exact: true })).toHaveValue("20");
  await form.getByLabel("Tên sản phẩm", { exact: true }).fill("Tên mới");
  await form.getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(form).not.toBeVisible();
  expect(saved).toMatchObject({ name: "Tên mới", image_url: "/uploads/existing.png", parcel });
});
