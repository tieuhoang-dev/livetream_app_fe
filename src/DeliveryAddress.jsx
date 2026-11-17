import { useEffect, useId, useRef, useState } from "react";
import provinces from "./provinces.json";
import "leaflet/dist/leaflet.css";

export const emptyAddress = {
  name: "", phone: "", province_code: "", ward: "", address_line: "",
  latitude: null, longitude: null,
};
export function addressReady(value) {
  return [value.name, value.phone, value.province_code, value.ward, value.address_line].every((field) => String(field || "").trim());
}
export function addressText(address) {
  return [address?.address_line, address?.ward, address?.province_name || provinces.find((p) => p.code === address?.province_code)?.name].filter(Boolean).join(", ");
}
export function AddressFields({ value, onChange, disabled, pickup = false }) {
  const [showMap, setShowMap] = useState(false);
  const id = useId();
  const update = (field) => (event) => onChange({ ...value, [field]: event.target.value });
  return (
    <fieldset className="delivery-fields" disabled={disabled}>
      <legend>{pickup ? "Địa chỉ lấy hàng của shop" : "Thông tin nhận hàng"}</legend>
      <div className="form-columns">
        <label>{pickup ? "Người liên hệ" : "Họ tên người nhận"}
          <input autoComplete={pickup ? "off" : "shipping name"} value={value.name || ""} onChange={update("name")} maxLength={100} required />
        </label>
        <label>Số điện thoại
          <input type="tel" autoComplete={pickup ? "off" : "shipping tel"} value={value.phone || ""} onChange={update("phone")} maxLength={20} required />
        </label>
      </div>
      <div className="form-columns">
        <label>Tỉnh / Thành phố
          <select aria-label="Tỉnh / Thành phố" value={value.province_code || ""} onChange={update("province_code")} required>
            <option value="">Chọn tỉnh / thành phố</option>
            {provinces.map((province) => <option key={province.code} value={province.code}>{province.name}</option>)}
          </select>
        </label>
        <label>Phường / Xã
          <input autoComplete="shipping address-level3" value={value.ward || ""} onChange={update("ward")} maxLength={100} required />
        </label>
      </div>
      <label>Địa chỉ cụ thể
        <input autoComplete="shipping street-address" placeholder="Số nhà, tên đường, tòa nhà…" value={value.address_line || ""} onChange={update("address_line")} maxLength={255} required />
      </label>
      <button type="button" className="button secondary" aria-expanded={showMap} aria-controls={id} onClick={() => setShowMap((open) => !open)}>
        {showMap ? "Ẩn bản đồ" : value.latitude != null ? "Chỉnh vị trí trên bản đồ" : "Chọn vị trí trên bản đồ"}
      </button>
      {showMap && <div id={id}><DeliveryMap value={value} onChange={onChange} disabled={disabled} /></div>}
      {!showMap && value.latitude != null && <p className="payment-note">Đã ghim vị trí giao hàng.</p>}
    </fieldset>
  );
}

function DeliveryMap({ value, onChange, disabled }) {
  const container = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const latest = useRef({ value, onChange, disabled });
  latest.current = { value, onChange, disabled };
  const [error, setError] = useState("");
  const [locating, setLocating] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    let instance;
    let observer;
    import("leaflet").then((module) => {
      if (!active) return;
      const L = module.default || module;
      const point = latest.current.value;
      instance = L.map(container.current, { scrollWheelZoom: false }).setView(point.latitude != null ? [point.latitude, point.longitude] : [16.2, 107.5], point.latitude != null ? 16 : 5);
      map.current = instance;
      setReady(true);
      observer = new ResizeObserver(() => instance.invalidateSize({ animate: false }));
      observer.observe(container.current);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
      }).on("tileerror", () => { if (active) setError("Không tải được nền bản đồ. Bạn vẫn có thể nhập địa chỉ để đặt hàng."); }).addTo(instance);
      function select(latlng) {
        if (latest.current.disabled) return;
        latest.current.onChange({ ...latest.current.value, latitude: Number(latlng.lat.toFixed(6)), longitude: Number(latlng.lng.toFixed(6)) });
      }
      const pin = L.divIcon({ className: "delivery-pin", html: '<span aria-hidden="true">●</span>', iconSize: [24, 24], iconAnchor: [12, 12] });
      marker.current = L.marker(point.latitude != null ? [point.latitude, point.longitude] : [16.2, 107.5], { draggable: !latest.current.disabled, icon: pin });
      if (point.latitude != null) marker.current.addTo(instance);
      marker.current.on("dragend", () => select(marker.current.getLatLng()));
      instance.on("click", (event) => { if (!latest.current.disabled) { marker.current.setLatLng(event.latlng).addTo(instance); select(event.latlng); } });
    }).catch(() => { if (active) setError("Không mở được bản đồ. Bạn vẫn có thể nhập địa chỉ."); });
    return () => { active = false; observer?.disconnect(); instance?.remove(); map.current = null; marker.current = null; };
  }, []);
  useEffect(() => {
    if (!map.current || !marker.current) return;
    if (value.latitude == null) marker.current.remove();
    else { marker.current.setLatLng([value.latitude, value.longitude]).addTo(map.current); map.current.panTo([value.latitude, value.longitude]); }
    if (disabled) marker.current.dragging?.disable(); else marker.current.dragging?.enable();
  }, [value.latitude, value.longitude, disabled]);
  function locate() {
    if (!navigator.geolocation) { setError("Trình duyệt chưa hỗ trợ định vị. Hãy chọn trên bản đồ hoặc nhập địa chỉ."); return; }
    setLocating(true); setError("");
    navigator.geolocation.getCurrentPosition((position) => {
      const current = latest.current;
      if (map.current) setLocating(false);
      if (current.disabled || !map.current) return;
      const latitude = Number(position.coords.latitude.toFixed(6));
      const longitude = Number(position.coords.longitude.toFixed(6));
      current.onChange({ ...current.value, latitude, longitude });
      map.current.setView([latitude, longitude], 16);
    }, () => { if (map.current) { setLocating(false); setError("Không lấy được vị trí. Hãy cấp quyền định vị trên HTTPS hoặc tự chọn điểm/nhập địa chỉ."); } }, { timeout: 10000, maximumAge: 60000 });
  }
  return <div className="delivery-map-panel">
    <p className="payment-note">Bấm trên bản đồ hoặc kéo ghim. Kiểm tra lại tỉnh/thành và địa chỉ đã nhập.</p>
    <div className="delivery-map" ref={container} role="region" aria-label="Bản đồ chọn địa chỉ" />
    <div className="inline-actions">
      <button type="button" className="button secondary" disabled={disabled || locating || !ready} onClick={locate}>{locating ? "Đang định vị…" : "Dùng vị trí hiện tại"}</button>
      <button type="button" className="button secondary" disabled={disabled || !ready} onClick={() => {
        const point = map.current.getCenter();
        onChange({ ...value, latitude: Number(point.lat.toFixed(6)), longitude: Number(point.lng.toFixed(6)) });
      }}>Đặt ghim ở giữa bản đồ</button>
      {value.latitude != null && <button type="button" className="text-button" disabled={disabled} onClick={() => onChange({ ...value, latitude: null, longitude: null })}>Bỏ ghim</button>}
    </div>
    {value.latitude != null && <p className="payment-note">Vị trí: {Number(value.latitude).toFixed(6)}, {Number(value.longitude).toFixed(6)}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
