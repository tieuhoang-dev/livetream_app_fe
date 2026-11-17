import { useEffect, useState } from "react";
import { AddressFields, addressReady, emptyAddress } from "./DeliveryAddress";

export function ShippingSettingsPanel({ api, notice, reload }) {
  const [pickup, setPickup] = useState(emptyAddress);
  const [sameFee, setSameFee] = useState("");
  const [otherFee, setOtherFee] = useState("");
  const [freeFrom, setFreeFrom] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    api("/api/sales/shipping-settings", { signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return;
      if (result.settings) {
        setPickup(result.settings.pickup_address);
        setSameFee(String(result.settings.same_province_fee));
        setOtherFee(String(result.settings.other_province_fee));
        setFreeFrom(result.settings.free_shipping_from == null ? "" : String(result.settings.free_shipping_from));
      }
    }).catch((err) => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [api, attempt]);
  async function submit(event) {
    event.preventDefault();
    if (saving || loading || !addressReady(pickup)) return;
    setSaving(true); setError("");
    try {
      const result = await api("/api/sales/shipping-settings", { method: "PUT", body: {
        pickup_address: pickup, same_province_fee: Number(sameFee), other_province_fee: Number(otherFee),
        free_shipping_from: freeFrom === "" ? null : Number(freeFrom),
      } });
      setPickup(result.settings.pickup_address);
      notice("Đã lưu địa chỉ lấy hàng và phí vận chuyển.");
      reload();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }
  return <section className="shipping-settings content-section">
    <h2>Địa chỉ lấy hàng và phí giao hàng</h2>
    <p className="payment-note">Phí nội tỉnh áp dụng khi nơi lấy và nơi nhận cùng tỉnh/thành. Đây là mức shop tự cấu hình, chưa phải báo giá từ hãng vận chuyển.</p>
    {loading ? <p role="status">Đang tải cấu hình giao hàng…</p> : <form className="stack-form" onSubmit={submit}>
      <AddressFields api={api} value={pickup} onChange={setPickup} disabled={saving} pickup />
      <div className="form-columns">
        <label>Phí ship nội tỉnh (VNĐ)<input type="number" min="0" max="1000000000000" step="1" required value={sameFee} disabled={saving} onChange={(event) => setSameFee(event.target.value)} /></label>
        <label>Phí ship liên tỉnh (VNĐ)<input type="number" min="0" max="1000000000000" step="1" required value={otherFee} disabled={saving} onChange={(event) => setOtherFee(event.target.value)} /></label>
      </div>
      <label>Miễn phí ship từ (VNĐ, không bắt buộc)<input type="number" min="1" max="1000000000000" step="1" value={freeFrom} disabled={saving} onChange={(event) => setFreeFrom(event.target.value)} placeholder="Bỏ trống nếu không áp dụng" /></label>
      <button className="button primary" disabled={saving || !addressReady(pickup)}>{saving ? "Đang lưu…" : "Lưu cấu hình giao hàng"}</button>
    </form>}
    {error && <div><p className="form-error" role="alert">{error}</p><button className="button secondary" type="button" onClick={() => setAttempt((value) => value + 1)}>Tải lại cấu hình</button></div>}
  </section>;
}
