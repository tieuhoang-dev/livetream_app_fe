import { useEffect, useId, useRef, useState } from "react";
import provinces from "./provinces.json";
import "leaflet/dist/leaflet.css";
import { CarrierLocationFields } from "./CarrierLocationFields";
import { NearbyStations } from "./NearbyStations";

export const emptyAddress = {
  name: "", phone: "", province_code: "", ward: "", address_line: "",
  latitude: null, longitude: null,
};
function phoneReady(phone) {
  return /^(0[0-9]{9,10}|\+84[0-9]{9,10})$/.test(String(phone || "").replace(/[ .-]/g, ""));
}
export function shippingAreaReady(value, carrier = false) {
  return provinces.some((province) => province.code === value.province_code) &&
    (!carrier || (value.carrier_province_id > 0 && value.carrier_district_id > 0 && Boolean(value.carrier_ward_code))) &&
    (value.location_mode !== "current" || (value.latitude != null && value.longitude != null));
}
export function addressMissingFields(value) {
  return [
    !String(value.name || "").trim() && "họ tên",
    !phoneReady(value.phone) && "số điện thoại hợp lệ",
    !value.province_code && "tỉnh/thành",
    !String(value.ward || "").trim() && "phường/xã",
    !String(value.address_line || "").trim() && "số nhà, tên đường",
    value.location_mode === "current" && (value.latitude == null || value.longitude == null) && "vị trí GPS hoặc chọn nhập tay",
  ].filter(Boolean);
}
export function addressReady(value) {
  return shippingAreaReady(value) && addressMissingFields(value).length === 0;
}
export function addressText(address) {
  return [address?.address_line, address?.ward, address?.province_name || provinces.find((p) => p.code === address?.province_code)?.name].filter(Boolean).join(", ");
}
export function AddressFields({ api, value, onChange, disabled, pickup = false, autoLocate = false }) {
  const [showMap, setShowMap] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState(autoLocate ? "current" : value.location_mode || "manual");
  const [wards, setWards] = useState([]);
  const [carrierProvinces, setCarrierProvinces] = useState([]);
  const [carrierError, setCarrierError] = useState("");
  const [locationPoint, setLocationPoint] = useState(null);
  const [stations, setStations] = useState([]);
  useEffect(() => { if (stations.some((station) => station.latitude != null)) setShowMap(true); }, [stations]);
  const searchCenter = locationPoint || (value.latitude != null && value.longitude != null ? { latitude: value.latitude, longitude: value.longitude } : null);
  const matchedCarrierProvinces = carrierProvinces.filter((p) => p.province_code === value.province_code);
  const latest = useRef({ value, onChange, disabled });
  latest.current = { value, onChange, disabled };
  const generation = useRef(0);
  const controller = useRef(null);
  const id = useId();
  useEffect(() => {
    if (api.mode === "demo") return;
    const controller = new AbortController();
    api.command("shipping.provinces", {}, { signal: controller.signal }).then((result) => {
      if (!controller.signal.aborted) setCarrierProvinces(result.data || []);
    }).catch((err) => { if (!controller.signal.aborted) setCarrierError(err.message); });
    return () => controller.abort();
  }, [api]);
  useEffect(() => {
    let active = true;
    setWards([]);
    if (value.province_code) import("./wards.json").then((data) => {
      if (active) setWards((data.default || data)[value.province_code] || []);
    }).catch(() => {});
    return () => { active = false; };
  }, [value.province_code]);
  useEffect(() => {
    if (autoLocate) locate();
    return () => { generation.current += 1; controller.current?.abort(); };
  }, [autoLocate]);
  function beginLocation() {
    const attempt = ++generation.current;
    controller.current?.abort();
    controller.current = new AbortController();
    setMode("current"); setLocating(true); setError(""); setLocationPoint(null);
    const current = latest.current;
    current.onChange({ ...current.value, location_mode: "current", latitude: null, longitude: null, station_id: 0, station_name: "", carrier_province_id: 0, carrier_district_id: 0, carrier_ward_code: "" });
    return { attempt, signal: controller.current.signal };
  }
  async function resolvePoint(latitude, longitude, request) {
    if (request.attempt !== generation.current || request.signal.aborted) return;
    setLocationPoint({ latitude, longitude });
    try {
      const result = await api("/api/delivery/reverse-geocode", {
        method: "POST", body: { latitude, longitude }, signal: request.signal,
      });
      if (request.attempt !== generation.current || request.signal.aborted || latest.current.disabled) return;
      const current = latest.current;
      current.onChange({ ...current.value, ...result.address, station_id: 0, station_name: "", name: current.value.name, phone: current.value.phone, location_mode: "current" });
      if (!result.address.ward || !result.address.address_line) setError("Bản đồ chưa có đủ địa chỉ. Kiểm tra và bổ sung phường/xã, số nhà bên dưới.");
    } catch (err) {
      if (request.attempt === generation.current && !request.signal.aborted) setError(err.message);
    } finally {
      if (request.attempt === generation.current) setLocating(false);
    }
  }
  function locate() {
    const request = beginLocation();
    if (!navigator.geolocation) { setLocating(false); setError("Trình duyệt chưa hỗ trợ định vị. Hãy chọn Nhập địa chỉ."); return; }
    navigator.geolocation.getCurrentPosition((position) => {
      void resolvePoint(Number(position.coords.latitude.toFixed(6)), Number(position.coords.longitude.toFixed(6)), request);
    }, () => {
      if (request.attempt === generation.current) {
        setLocating(false);
        setError("Không lấy được vị trí. Hãy cấp quyền định vị trên HTTPS/localhost, thử lại hoặc chọn Nhập địa chỉ.");
      }
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  }
  const update = (field) => (event) => { setError(""); onChange({ ...value, ...(field === "address_line" || field === "ward" ? { station_id: 0, station_name: "" } : {}), [field]: event.target.value }); };
  function selectStation(station) {
    if (latest.current.disabled || !station.pickup_address) return;
    generation.current += 1; controller.current?.abort(); setLocating(false); setMode("manual"); setError(""); setShowMap(true);
    const current = latest.current;
    current.onChange({ ...emptyAddress, ...station.pickup_address, name: current.value.name, phone: current.value.phone });
  }
  return (
    <fieldset className="delivery-fields" disabled={disabled}>
      <legend>{pickup ? "Địa chỉ lấy hàng" : "Thông tin nhận hàng"}</legend>
      <div className="address-options" role="group" aria-label="Cách chọn địa chỉ">
        <label><input type="radio" name={`address-${id}`} checked={mode === "manual"} onChange={() => {
          generation.current += 1; controller.current?.abort(); setLocating(false); setError(""); setMode("manual");
          onChange({ ...value, location_mode: "manual", station_id: 0, station_name: "" });
        }} />Nhập địa chỉ</label>
        <label><input type="radio" name={`address-${id}`} checked={mode === "current"} onChange={locate} />Sử dụng vị trí hiện tại</label>
      </div>
      {mode === "current" && <div>
        <p className="payment-note">{pickup ? "Dùng nơi bạn đang ở làm địa chỉ lấy hàng." : "Lấy vị trí và tự điền địa chỉ nhận hàng. Bạn có thể sửa số nhà/căn hộ sau khi định vị."}</p>
        <button type="button" className="button secondary" disabled={locating} onClick={locate}>{locating ? "Đang định vị…" : "Lấy lại vị trí hiện tại"}</button>
        <p className="payment-note">Dữ liệu địa chỉ © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>.</p>
      </div>}
      {locating && <p className="payment-note" role="status">Đang lấy vị trí và tìm địa chỉ…</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="form-columns">
        <label>{pickup ? "Người liên hệ" : "Họ tên người nhận"}
          <input autoComplete={pickup ? "off" : "shipping name"} value={value.name || ""} onChange={update("name")} maxLength={100} required />
        </label>
        <label>Số điện thoại
          <input type="tel" aria-label="Số điện thoại" autoComplete={pickup ? "off" : "shipping tel"} value={value.phone || ""} onChange={update("phone")} maxLength={20} placeholder="Ví dụ: 0901234567" aria-invalid={Boolean(value.phone && !phoneReady(value.phone))} required />
          {value.phone && !phoneReady(value.phone) && <small className="form-error">Nhập số điện thoại Việt Nam bắt đầu bằng 0 hoặc +84.</small>}
        </label>
      </div>
      <div className="form-columns">
        <label>Tỉnh / Thành phố
          <select aria-label="Tỉnh / Thành phố" value={value.province_code || ""} onChange={(event) => {
            setMode("manual");
            setError("");
            const code = event.target.value;
            onChange({ ...value, province_code: code, province_name: provinces.find((p) => p.code === code)?.name || "", ward: code === value.province_code ? value.ward : "", location_mode: "manual", latitude: null, longitude: null, station_id: 0, station_name: "", carrier_province_id: 0, carrier_district_id: 0, carrier_ward_code: "" });
          }} disabled={locating} required>
            <option value="">Chọn tỉnh / thành phố</option>
            {provinces.map((province) => <option key={province.code} value={province.code}>{province.name}</option>)}
          </select>
        </label>
        {!matchedCarrierProvinces.length && <label>Phường / Xã
          <input aria-label="Phường / Xã" list={`${id}-wards`} autoComplete="off" value={value.ward || ""} onChange={update("ward")} disabled={locating || !value.province_code} placeholder={value.province_code ? "Gõ tên để chọn phường/xã" : "Chọn tỉnh/thành trước"} maxLength={100} required />
          <datalist id={`${id}-wards`}>{wards.map((name) => <option key={name} value={name} />)}</datalist>
        </label>}
      </div>
      {matchedCarrierProvinces.length > 0 && <CarrierLocationFields {...{ api, value, onChange, pickup }} provinces={matchedCarrierProvinces} disabled={disabled || locating} />}
      {carrierError && <p className="payment-note">{carrierError}</p>}
      {pickup && <NearbyStations api={api} value={value} center={searchCenter} disabled={disabled || locating} onSelect={selectStation} onResults={setStations} onSearch={() => setLocationPoint(searchCenter)} />}
      <label>Địa chỉ cụ thể
        <input autoComplete="shipping street-address" placeholder="Số nhà, tên đường, tòa nhà…" value={value.address_line || ""} onChange={update("address_line")} disabled={locating} maxLength={255} required />
      </label>
      <button type="button" className="button secondary" aria-expanded={showMap} aria-controls={id} onClick={() => setShowMap((open) => !open)}>
        {showMap ? "Ẩn bản đồ" : value.latitude != null ? "Chỉnh vị trí trên bản đồ" : "Chọn vị trí trên bản đồ"}
      </button>
      {showMap && <div id={id}><DeliveryMap value={value} stations={stations} onStationSelect={selectStation} center={searchCenter} onChange={(address) => {
        if (address.latitude != null) setLocationPoint({ latitude: address.latitude, longitude: address.longitude });
        if (mode === "current" && address.latitude != null) void resolvePoint(address.latitude, address.longitude, beginLocation());
        else onChange({ ...address, station_id: 0, station_name: "" });
      }} disabled={disabled || locating} /></div>}
      {!showMap && value.latitude != null && <p className="payment-note">Đã xác định vị trí. Bạn có thể mở bản đồ để kiểm tra hoặc chỉnh lại.</p>}
    </fieldset>
  );
}

function DeliveryMap({ value, onChange, disabled, stations = [], center, onStationSelect }) {
  const container = useRef(null);
  const map = useRef(null);
  const marker = useRef(null);
  const stationLayer = useRef(null);
  const leaflet = useRef(null);
  const latest = useRef({ value, onChange, disabled, onStationSelect });
  latest.current = { value, onChange, disabled, onStationSelect };
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    let instance;
    let observer;
    import("leaflet").then((module) => {
      if (!active) return;
      const L = module.default || module;
      leaflet.current = L;
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
    return () => { active = false; observer?.disconnect(); instance?.stop(); instance?.remove(); map.current = null; marker.current = null; stationLayer.current = null; leaflet.current = null; };
  }, []);
  useEffect(() => {
    if (!ready || !map.current || !leaflet.current) return;
    const L = leaflet.current;
    stationLayer.current?.remove();
    stationLayer.current = L.layerGroup().addTo(map.current);
    const points = [];
    for (const [index, station] of stations.entries()) {
      if (station.latitude == null || station.longitude == null) continue;
      const point = [station.latitude, station.longitude]; points.push(point);
      const title = document.createElement("span"); title.textContent = station.name;
      L.marker(point, { title: station.name, icon: L.divIcon({ className: "station-pin", html: `<span>${index + 1}</span>`, iconSize: [28, 28], iconAnchor: [14, 14] }) })
        .bindTooltip(title).on("click", () => { if (!latest.current.disabled) latest.current.onStationSelect?.(station); }).addTo(stationLayer.current);
    }
    if (points.length) {
      if (center) points.push([center.latitude, center.longitude]);
      map.current.fitBounds(points, { padding: [24, 24], maxZoom: 16, animate: false });
    }
  }, [stations, ready, center?.latitude, center?.longitude]);
  useEffect(() => {
    if (!map.current || !marker.current) return;
    if (value.latitude == null) marker.current.remove();
    else { marker.current.setLatLng([value.latitude, value.longitude]).addTo(map.current); map.current.panTo([value.latitude, value.longitude], { animate: false }); }
    if (disabled) marker.current.dragging?.disable(); else marker.current.dragging?.enable();
  }, [value.latitude, value.longitude, disabled]);
  return <div className="delivery-map-panel">
    <p className="payment-note">Bấm trên bản đồ hoặc kéo ghim. Kiểm tra lại tỉnh/thành và địa chỉ đã nhập.</p>
    <div className="delivery-map" ref={container} role="region" aria-label="Bản đồ chọn địa chỉ" />
    <div className="inline-actions">
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
