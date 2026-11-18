import { useEffect, useState } from "react";
import { Picture } from "./ui";

// Shared by the catalog editor and the create-in-live form.
export async function readProductForm(form, api, product) {
  const body = {
    name: form.get("name").trim(), price: Number(form.get("price")),
    image_url: product?.image_url || "", description: form.get("description").trim(),
    parcel: { weight_grams: Number(form.get("weight_grams")), length_cm: Number(form.get("length_cm")), width_cm: Number(form.get("width_cm")), height_cm: Number(form.get("height_cm")) },
  };
  if (!body.name) throw new Error("Nhập tên sản phẩm.");
  if (!product) body.stock_quantity = Number(form.get("stock_quantity"));
  const file = form.get("image");
  if (file?.size) {
    if (file.size > 10 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Chọn ảnh JPG, PNG hoặc WebP tối đa 10 MB.");
    const upload = new FormData(); upload.append("file", file);
    body.image_url = (await api("/api/products/images", { method: "POST", body: upload })).url;
  }
  return body;
}

export function ProductFields({ product }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!file) { setPreview(""); return; }
    const url = URL.createObjectURL(file); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return <>
    <label>Tên sản phẩm<input name="name" defaultValue={product?.name} required maxLength={255} /></label>
    <label>Giá (₫)<input name="price" type="number" min="0" max="99999999.99" step="0.01" defaultValue={product?.price} required /></label>
    {!product && <label>Tồn kho ban đầu<input name="stock_quantity" type="number" min="0" max="2147483647" step="1" defaultValue="1" required /></label>}
    <fieldset className="delivery-fields">
      <legend>Kiện đóng gói cho 1 sản phẩm</legend>
      <p className="payment-note">Dùng để báo phí GHN theo khối lượng và kích thước kiện hàng.</p>
      <div className="form-columns">
        <label>Khối lượng (gram)<input name="weight_grams" type="number" min="1" max="1000000" step="1" required defaultValue={product?.parcel?.weight_grams || ""} /></label>
        <label>Chiều dài (cm)<input name="length_cm" type="number" min="1" max="300" step="1" required defaultValue={product?.parcel?.length_cm || ""} /></label>
        <label>Chiều rộng (cm)<input name="width_cm" type="number" min="1" max="300" step="1" required defaultValue={product?.parcel?.width_cm || ""} /></label>
        <label>Chiều cao (cm)<input name="height_cm" type="number" min="1" max="300" step="1" required defaultValue={product?.parcel?.height_cm || ""} /></label>
      </div>
    </fieldset>
    <label>Ảnh sản phẩm<input name="image" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
    <p className="payment-note">Chọn ảnh JPG, PNG hoặc WebP tối đa 10 MB.{product?.image_url && " Giữ ảnh hiện tại nếu không chọn ảnh mới."}</p>
    {(preview || product?.image_url) && <div className="product-image-preview">{preview ? <img src={preview} alt="Ảnh sản phẩm đã chọn" /> : <Picture src={product.image_url} />}</div>}
    <label>Mô tả<textarea name="description" defaultValue={product?.description} maxLength={255} rows={3} /></label>
  </>;
}
