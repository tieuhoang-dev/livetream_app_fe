import { useEffect, useRef, useState } from "react";

const distanceText = (meters) => meters == null ? "Chưa có tọa độ" : meters < 1000 ? `${meters} m` : `${(meters / 1000).toFixed(1)} km`;

export function NearbyStations({ api, value, center, disabled, onSelect, onResults, onSearch }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(null);
  useEffect(() => {
    request.current?.abort(); setLoading(false); setResult(null); setError(""); onResults([]);
    return () => request.current?.abort();
  }, [value.carrier_province_id, value.carrier_district_id, center?.latitude, center?.longitude]);
  async function search() {
    if (disabled || loading || !center || !value.carrier_district_id) return;
    request.current?.abort(); const controller = new AbortController(); request.current = controller;
    setLoading(true); setError(""); setResult(null); onResults([]); onSearch();
    try {
      const response = await api("/api/shipping/stations/nearby", { method: "POST", signal: controller.signal, body: {
        latitude: center.latitude, longitude: center.longitude,
        carrier_province_id: value.carrier_province_id, carrier_district_id: value.carrier_district_id,
      } });
      if (controller.signal.aborted) return;
      setResult(response); onResults(response.data || []);
    } catch (err) { if (!controller.signal.aborted) setError(err.message); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }
  return <section className="nearby-stations" aria-label="Bưu cục GHN gần vị trí phát">
    <strong>Gửi hàng tại bưu cục GHN</strong>
    <p className="payment-note">Chọn bưu cục nếu bạn tự mang hàng đến gửi. Báo phí dùng khu vực của bưu cục được chọn.</p>
    <button type="button" className="button secondary" disabled={disabled || loading || !center || !value.carrier_district_id || api.mode === "demo"} onClick={search}>{loading ? "Đang tìm bưu cục…" : "Tìm bưu cục GHN gần vị trí này"}</button>
    {!center && <p className="payment-note">Lấy vị trí hiện tại hoặc đặt ghim trên bản đồ trước.</p>}
    {!value.carrier_district_id && <p className="payment-note">Chọn tỉnh/khu vực và quận/huyện GHN để tìm bưu cục. GPS sẽ tự điền khi nhận diện được.</p>}
    {api.mode === "demo" && <p className="payment-note">Tra bưu cục thật cần kết nối backend có cấu hình GHN.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {result && <>
      <p className="payment-note">{result.district}: xếp theo khoảng cách đường chim bay từ vị trí tìm kiếm. {result.complete ? "" : "Danh sách GHN trả về chưa đầy đủ. "}Kết quả giới hạn theo khu vực tra cứu, không bảo đảm gần nhất ngoài khu vực.{result.environment === "staging" ? " Dữ liệu môi trường thử nghiệm." : ""}</p>
      {!result.data?.length && <p role="status">GHN chưa trả bưu cục cho khu vực này. Bạn có thể chọn quận/huyện lân cận hoặc dùng địa chỉ lấy hàng.</p>}
      <div className="station-results" role="list">
        {(result.data || []).map((station, index) => <div className="station-card" key={station.id} role="listitem">
          <strong>{index + 1}. {station.name}</strong><span>{distanceText(station.distance_meters)}</span>
          <p>{station.address}</p>
          <div className="inline-actions"><button type="button" className="button secondary" disabled={disabled || !station.pickup_address} onClick={() => onSelect(station)} aria-label={`Chọn bưu cục ${station.name}`}>{value.station_id === station.id ? "Đang chọn" : "Chọn bưu cục này"}</button>
            {station.latitude != null && station.longitude != null && <a target="_blank" rel="noopener noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${station.latitude},${station.longitude}`)}&travelmode=driving`}>Chỉ đường</a>}
          </div>
          {!station.pickup_address && <small>Chưa ánh xạ được khu vực bưu cục để báo phí. Hãy chọn bưu cục khác.</small>}
        </div>)}
      </div>
    </>}
    {value.station_id > 0 && <p className="form-feedback" role="status">Điểm gửi đã chọn: {value.station_name}. Bạn tự mang hàng đến đây; ứng dụng chỉ báo phí, chưa tạo vận đơn.</p>}
  </section>;
}
