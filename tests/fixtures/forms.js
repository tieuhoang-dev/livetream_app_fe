import { receiver } from "./api";
export async function chooseCarrier(dialog, province = "1", wardCode = `ward-${Number(province)*100}`) {
  await dialog.getByLabel("Quận / Huyện (GHN)", { exact: true }).selectOption(String(Number(province)*100));
  await dialog.getByLabel("Phường / Xã", { exact: true }).selectOption(wardCode);
}
export async function fillDelivery(dialog, value = receiver) {
  await dialog.getByLabel("Họ tên người nhận", { exact: true }).fill(value.name);
  await dialog.getByLabel("Số điện thoại", { exact: true }).fill(value.phone);
  await dialog.getByLabel("Tỉnh / Thành phố", { exact: true }).selectOption(value.province_code);
  const mode = await dialog.page().evaluate(() => sessionStorage.getItem("livemart-mode"));
  if (mode === "api") await chooseCarrier(dialog, value.province_code);
  else await dialog.getByLabel("Phường / Xã", { exact: true }).fill(value.ward);
  await dialog.getByLabel("Địa chỉ cụ thể", { exact: true }).fill(value.address_line);
}
