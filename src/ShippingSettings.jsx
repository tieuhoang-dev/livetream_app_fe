import { useEffect, useState } from "react";
import { AddressFields, addressReady, emptyAddress } from "./DeliveryAddress";

export function ShippingSettingsPanel({ api, notice, reload }) {
  const [pickup, setPickup] = useState(emptyAddress);
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
        pickup_address: pickup,
      } });
      setPickup(result.settings.pickup_address);
      notice("Đã lưu địa chỉ lấy hàng.");
      reload();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }
  return <section className="shipping-settings content-section">
    <h2>Địa chỉ lấy hàng</h2>
    <p className="payment-note">Phí được lấy từ GHN dựa trên nơi lấy/nhận và thông tin kiện hàng. Ứng dụng chỉ lấy báo giá, không tạo vận đơn.</p>
    {loading ? <p role="status">Đang tải cấu hình giao hàng…</p> : <form className="stack-form" onSubmit={submit}>
      <AddressFields api={api} value={pickup} onChange={setPickup} disabled={saving} pickup />
      <button className="button primary" disabled={saving || !addressReady(pickup)}>{saving ? "Đang lưu…" : "Lưu cấu hình giao hàng"}</button>
    </form>}
    {error && <div><p className="form-error" role="alert">{error}</p><button className="button secondary" type="button" onClick={() => setAttempt((value) => value + 1)}>Tải lại cấu hình</button></div>}
  </section>;
}
