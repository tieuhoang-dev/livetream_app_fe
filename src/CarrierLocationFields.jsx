import { useEffect, useRef, useState } from "react";

const fold = (text) => String(text || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/^(phuong|xa|thi tran)\s+/, "").trim();

export function CarrierLocationFields({ api, value, onChange, provinces, disabled, pickup }) {
  const [districts, setDistricts] = useState([]);
  const [wards, setWards] = useState([]);
  const [error, setError] = useState("");
  const latest = useRef({ value, onChange }); latest.current = { value, onChange };
  const key = provinces.map((p) => p.id).join(",");
  const supports = (row) => row.support_type === 3 || row.support_type === (pickup ? 1 : 2);
  useEffect(() => {
    if (provinces.length === 1 && value.carrier_province_id !== provinces[0].id) {
      onChange({ ...value, carrier_province_id: provinces[0].id, carrier_district_id: 0, carrier_ward_code: "" });
    }
  }, [key, value.carrier_province_id]);
  useEffect(() => {
    setDistricts([]); setWards([]); setError("");
    if (!value.carrier_province_id) return;
    const controller = new AbortController();
    api("/api/shipping/districts", { query: { province_id: value.carrier_province_id }, signal: controller.signal })
      .then((result) => { if (!controller.signal.aborted) setDistricts(result.data || []); })
      .catch((err) => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [api, value.carrier_province_id]);
  useEffect(() => {
    setWards([]); setError("");
    if (!value.carrier_district_id) return;
    const controller = new AbortController();
    api("/api/shipping/wards", { query: { district_id: value.carrier_district_id }, signal: controller.signal })
      .then((result) => {
        if (controller.signal.aborted) return;
        const rows = result.data || []; setWards(rows);
        const current = latest.current;
        const matches = rows.filter((row) => supports(row) && fold(row.name) === fold(current.value.ward));
        if (matches.length === 1 && current.value.carrier_ward_code !== matches[0].code)
          current.onChange({ ...current.value, carrier_ward_code: matches[0].code, ward: matches[0].name });
      }).catch((err) => { if (!controller.signal.aborted) setError(err.message); });
    return () => controller.abort();
  }, [api, value.carrier_district_id]);
  return <div className="carrier-location-fields">
    <p className="payment-note">Chọn khu vực theo danh mục GHN để lấy báo phí. Tên khu vực có thể theo địa giới trước sáp nhập.</p>
    {provinces.length > 1 && <label>Khu vực {pickup ? "lấy" : "nhận"} hàng
      <select aria-label="Khu vực GHN" value={value.carrier_province_id || ""} disabled={disabled} required onChange={(event) => onChange({ ...value, carrier_province_id: Number(event.target.value), carrier_district_id: 0, carrier_ward_code: "", ward: "" })}>
        <option value="">Chọn khu vực</option>{provinces.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
    </label>}
    <div className="form-columns">
      <label>Quận / Huyện (GHN)<select aria-label="Quận / Huyện (GHN)" value={value.carrier_district_id || ""} disabled={disabled || !districts.length} required onChange={(event) => onChange({ ...value, carrier_district_id: Number(event.target.value), carrier_ward_code: "", ward: "" })}>
        <option value="">Chọn quận/huyện</option>{districts.filter(supports).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
      </select></label>
      <label>Phường / Xã<select aria-label="Phường / Xã" value={value.carrier_ward_code || ""} disabled={disabled || !wards.length} required onChange={(event) => {
        const row = wards.find((w) => w.code === event.target.value);
        onChange({ ...value, carrier_ward_code: row?.code || "", ward: row?.name || "" });
      }}><option value="">Chọn phường/xã</option>{wards.filter(supports).map((row) => <option key={row.code} value={row.code}>{row.name}</option>)}</select></label>
    </div>
    {error && <p className="form-error" role="alert">{error}</p>}
  </div>;
}
