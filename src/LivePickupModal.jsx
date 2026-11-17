import { useEffect, useState } from "react";
import { AddressFields, addressReady, emptyAddress } from "./DeliveryAddress";
import { Modal } from "./ui";

export function LivePickupModal({ api, live, close, onReady }) {
  const [address, setAddress] = useState(emptyAddress);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    api(`/api/livestreams/${live.id}/pickup`, { signal: controller.signal }).then((result) => {
      if (!controller.signal.aborted) setAddress({ ...emptyAddress, name: live.seller_username || "", ...result.pickup_address });
    }).catch((err) => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [api, live.id, attempt]);
  async function submit(event) {
    event.preventDefault();
    if (saving || !addressReady(address)) return;
    setSaving(true); setError("");
    try {
      await api(`/api/livestreams/${live.id}/pickup`, { method: "PUT", body: { pickup_address: address } });
      onReady();
    } catch (err) { setError(err.message); } finally { setSaving(false); }
  }
  return <Modal title="Nơi lấy hàng của phiên live" close={saving ? () => {} : close}>
    <p className="payment-note">Mặc định lấy vị trí hiện tại khi bắt đầu phát. Địa chỉ này áp dụng cho phiên live đang mở; bạn có thể chọn nhập tay.</p>
    {loading ? <p role="status">Đang tải thông tin lấy hàng…</p> : <form className="stack-form" onSubmit={submit}>
      <AddressFields api={api} value={address} onChange={setAddress} disabled={saving} pickup autoLocate />
      <button className="button primary" disabled={saving || !addressReady(address)}>{saving ? "Đang lưu…" : "Dùng địa chỉ và bắt đầu phát"}</button>
    </form>}
    {error && <div><p className="form-error" role="alert">{error}</p><button type="button" className="text-button" onClick={() => setAttempt((value) => value + 1)}>Tải lại thông tin</button></div>}
  </Modal>;
}
