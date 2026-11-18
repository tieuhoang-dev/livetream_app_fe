import { addressText } from "./DeliveryAddress";

// Shared by checkout and order detail; buyer addresses never enter public live data.
export function DeliverySummary({ address, title = "Giao đến", note }) {
  return <section className="order-delivery" aria-label={title}>
    <h3>{title}</h3>
    <strong>{address.name || "Chưa nhập tên người nhận"}</strong>
    <span>{address.phone || "Chưa nhập số điện thoại"}</span>
    <p>{addressText(address) || "Chưa chọn địa chỉ nhận hàng"}</p>
    {address.latitude != null && address.longitude != null && <a target="_blank" rel="noopener noreferrer" href={`https://www.openstreetmap.org/?mlat=${address.latitude}&mlon=${address.longitude}#map=17/${address.latitude}/${address.longitude}`}>Xem vị trí giao hàng trên bản đồ</a>}
    {note && <p>Ghi chú: {note}</p>}
  </section>;
}
