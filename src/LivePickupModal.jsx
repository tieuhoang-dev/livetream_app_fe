import { useEffect, useState } from "react";
import { AddressFields, addressReady, emptyAddress } from "./DeliveryAddress";
import { Modal } from "./ui";
import { ShippingRateFields } from "./ShippingSettings";

export function LivePickupModal({ api, live, close, onReady, startBroadcast = true }) {
  const [address, setAddress] = useState(emptyAddress);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [configured, setConfigured] = useState(false);
  const [sameFee, setSameFee] = useState("");
  const [otherFee, setOtherFee] = useState("");
  const [freeFrom, setFreeFrom] = useState("");
  const ratesReady = sameFee !== "" && otherFee !== "" && Number(sameFee) >= 0 && Number(otherFee) >= 0;
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    api(`/api/livestreams/${live.id}/pickup`, { signal: controller.signal }).then((result) => {
      if (!controller.signal.aborted) {
        setAddress({ ...emptyAddress, name: live.seller_username || "", ...result.pickup_address });
        setConfigured(Boolean(result.shipping_configured));
        setSameFee(result.shipping_rates ? String(result.shipping_rates.same_province_fee) : "");
        setOtherFee(result.shipping_rates ? String(result.shipping_rates.other_province_fee) : "");
        setFreeFrom(result.shipping_rates?.free_shipping_from == null ? "" : String(result.shipping_rates.free_shipping_from));
      }
    }).catch((err) => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [api, live.id, attempt]);
  async function submit(event) {
    event.preventDefault();
    if (saving || !addressReady(address) || !ratesReady) return;
    setSaving(true); setError("");
    try {
      await api(`/api/livestreams/${live.id}/pickup`, { method: "PUT", body: { pickup_address: address,
        shipping_rates: { same_province_fee: Number(sameFee), other_province_fee: Number(otherFee), free_shipping_from: freeFrom === "" ? null : Number(freeFrom) } } });
      onReady();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }
  return <Modal title="Nơi lấy hàng của phiên live" close={saving ? () => {} : close}>
    <p className="payment-note">{startBroadcast ? "Kiểm tra nơi lấy hàng và phí ship trước khi phát để người xem có thể đặt hàng." : "Cập nhật nơi lấy hàng của phiên và phí ship của shop. Video vẫn tiếp tục phát."}</p>
    {loading ? <p role="status">Đang tải thông tin lấy hàng…</p> : <form className="stack-form" onSubmit={submit}>
      <AddressFields api={api} value={address} onChange={setAddress} disabled={saving} pickup autoLocate={startBroadcast} />
      {!configured && <p className="payment-note">Shop chưa có phí giao hàng. Nhập cả hai mức phí bên dưới; nhập 0 nếu bạn muốn miễn phí.</p>}
      <ShippingRateFields {...{ sameFee, otherFee, freeFrom, setSameFee, setOtherFee, setFreeFrom }} disabled={saving} />
      <button className="button primary" disabled={saving || !addressReady(address) || !ratesReady}>{saving ? "Đang lưu…" : startBroadcast ? "Dùng địa chỉ và bắt đầu phát" : "Lưu cài đặt giao hàng"}</button>
    </form>}
    {error && <div><p className="form-error" role="alert">{error}</p><button type="button" className="text-button" onClick={() => setAttempt((value) => value + 1)}>Tải lại thông tin</button></div>}
  </Modal>;
}
