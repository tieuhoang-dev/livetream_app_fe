import { demoRequest } from "./demo";
import { RealtimeClient } from "./realtime/client";
import { demoCommand, demoSubscribe } from "./realtime/demo";

const configuredURL = (import.meta.env.VITE_PUBLIC_API_URL || "").replace(
  /\/+$/,
  "",
);
const apiOrigin = import.meta.env.DEV ? "" : configuredURL;
const messages = {
  unauthorized: "Phiên đăng nhập chưa hợp lệ. Hãy đăng nhập lại.",
  realtime_timeout: "WebSocket phản hồi quá chậm. Kiểm tra trạng thái thao tác trước khi thử lại.",
  realtime_disconnected: "Mất kết nối realtime. Đang kết nối lại; thao tác vừa gửi có thể đã được xử lý.",
  shipping_station_unavailable: "Chưa tìm được bưu cục có tọa độ và khu vực hợp lệ. Hãy chọn bưu cục hoặc dùng địa chỉ lấy hàng.",
	shipping_provider_not_configured: "Hệ thống báo phí vận chuyển chưa được cấu hình. Vui lòng liên hệ quản trị viên.",
	shipping_unavailable: "Chưa lấy được báo phí vận chuyển. Vui lòng thử lại.",
	shipping_address_required: "Chọn đủ khu vực giao hàng theo danh mục GHN để lấy báo phí.",
	shipping_address_unavailable: "GHN chưa hỗ trợ hoặc chưa nhận diện được khu vực này. Hãy kiểm tra lại địa chỉ giao hàng.",
	shipping_product_incomplete: "Người bán cần bổ sung khối lượng và kích thước kiện của sản phẩm để báo phí.",
	shipping_invalid_parcel: "Khối lượng hoặc kích thước kiện chưa phù hợp để báo phí vận chuyển.",
	shipping_pickup_required: "Người bán chưa lưu địa chỉ lấy hàng.",
	shipping_pickup_area_required: "Người bán cần chọn khu vực lấy hàng theo danh mục GHN trong Cài đặt giao hàng.",
	shipping_station_invalid: "Bưu cục chưa có khu vực báo phí hợp lệ. Hãy tìm và chọn lại bưu cục.",
	shipping_stations_access_required: "Tài khoản GHN chưa có quyền tra bưu cục hoặc đang yêu cầu captcha. Liên hệ GHN để mở quyền; bạn vẫn có thể dùng địa chỉ lấy hàng.",
	invalid_coordinates: "Vị trí chưa hợp lệ. Hãy định vị lại hoặc nhập địa chỉ.",
	geocoding_unavailable: "Chưa tìm được địa chỉ từ bản đồ. Hãy thử lại hoặc chọn Nhập địa chỉ.",
	location_not_supported: "Chưa xác định được tỉnh/thành tại vị trí này ở Việt Nam. Hãy chọn Nhập địa chỉ.",
	invalid_delivery_address: "Kiểm tra họ tên, số điện thoại và địa chỉ nhận hàng (hoặc địa chỉ lấy hàng của shop).",
	invalid_shipping_settings: "Kiểm tra thông tin địa chỉ lấy hàng.",
	shipping_not_configured: "Shop chưa thiết lập địa chỉ lấy hàng. Vui lòng liên hệ người bán.",
	checkout_changed: "Giá hoặc phí ship vừa thay đổi. Hãy kiểm tra tổng tiền mới và xác nhận lại.",
	duplicate_request_conflict: "Yêu cầu đặt hàng đã được dùng với thông tin khác. Hãy mở lại hộp đặt hàng.",
	invalid_checkout_request: "Thông tin đặt hàng chưa hợp lệ.",
	invalid_payment_method: "Phương thức thanh toán chưa hợp lệ.",
  insufficient_stock: "Số lượng còn trong kho không đủ.",
  live_media_unavailable:
    "Backend chưa cấu hình LiveKit. Kiểm tra LIVEKIT_URL, LIVEKIT_API_KEY và LIVEKIT_API_SECRET.",
  invalid_live_comment: "Nhập bình luận từ 1 đến 300 ký tự.",
  livestream_not_active: "Phiên live đã kết thúc.",
  order_not_pending: "Đơn hàng đã đổi trạng thái. Hãy tải lại.",
  order_not_paid: "Đơn chưa ở trạng thái đã thanh toán.",
  cannot_buy_own_product: "Bạn không thể đặt mua sản phẩm của chính mình.",
  invalid_refund_reason: "Hãy nhập lý do hoàn tiền.",
  order_already_processed: "Đơn đã đổi trạng thái. Hãy tải lại.",
  product_in_use: "Sản phẩm đã được dùng trong live hoặc đơn hàng.",
  forbidden: "Bạn không có quyền thực hiện thao tác này.",
  invalid_query: "Bộ lọc chưa hợp lệ.",
  invalid_price: "Mức giá không hợp lệ.",
  product_has_active_orders: "Sản phẩm còn đơn đang xử lý trong live.",
  product_already_in_livestream: "Sản phẩm đã có trong live.",
  "User not verified": "Tài khoản chưa xác thực email.",
  "Invalid password": "Mật khẩu không đúng.",
  "User not found": "Không tìm thấy tài khoản.",
  "Invalid verification code": "Mã xác thực không đúng.",
  "Verification code has expired": "Mã xác thực đã hết hạn.",
  email_delivery_failed: "Gửi email thất bại. Vui lòng thử lại sau.",
};

export async function request(
  path,
  { query, token, body, method = "GET", signal } = {},
) {
  const url = new URL(`${apiOrigin}${path}`, location.origin);
  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== "" && value != null && value !== false)
      url.searchParams.set(key, value);
  });
  const headers = { Accept: "application/json" };
  const multipart = body instanceof FormData;
  if (body !== undefined && !multipart) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: multipart ? body : body === undefined ? undefined : JSON.stringify(body),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(12000)])
        : AbortSignal.timeout(12000),
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;
    throw new Error(
      "Không kết nối được backend. Kiểm tra địa chỉ API và thử lại.",
    );
  }
  if (response.status === 204) return null;
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload) {
    const error = new Error(
      messages[payload?.error] ||
        payload?.error ||
        `Backend trả lỗi ${response.status}.`,
    );
    error.status = response.status;
    error.code = payload?.error;
    throw error;
  }
  return payload;
}

export function apiFor(mode, token) {
  const api = mode === "demo" ? async (path, options) => {
    if (path === "/api/products/images" && options?.body instanceof FormData) {
      const file = options.body.get("file");
      const url = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); });
      return { url };
    }
    return demoRequest(path, options);
  } : (path, options) => request(path, { ...options, token });
  const url = new URL(`${apiOrigin}/api/ws`, location.origin); url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  const realtime = mode === "api" ? new RealtimeClient(url, { token, error: (code, status) => Object.assign(new Error(messages[code] || code), { code, status }) }) : null;
  api.command = mode === "demo" ? demoCommand : (type, payload, options) => realtime.request(type, payload, options);
  api.subscribe = mode === "demo" ? demoSubscribe : (type, payload, callbacks) => realtime.subscribe(type, payload, callbacks);
  api.close = () => realtime?.close(); api.mode = mode; api.token = token;
  return api;
}

export function readSession() {
  const token = sessionStorage.getItem("livemart-token");
  if (!token) return null;
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const profile = JSON.parse(
      new TextDecoder().decode(
        Uint8Array.from(atob(part), (char) => char.charCodeAt(0)),
      ),
    );
    if (profile.exp * 1000 > Date.now() && profile.user_id)
      return { token, profile };
  } catch {
    /* Discard malformed tokens. */
  }
  sessionStorage.removeItem("livemart-token");
  return null;
}

export function mediaURL(value) {
  if (!value) return "";
  if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) return value;
  if (value.startsWith("/uploads/")) return `${apiOrigin}${value}`;
  if (value.startsWith("/images/") || /^https?:\/\//i.test(value)) return value;
  return "";
}
