import { demoLiveCommand, demoRequest } from "./demo";

const configuredURL = (import.meta.env.VITE_PUBLIC_API_URL || "").replace(
  /\/+$/,
  "",
);
const apiOrigin = import.meta.env.DEV ? "" : configuredURL;
const messages = {
  insufficient_stock: "Số lượng còn trong kho không đủ.",
  live_media_unavailable:
    "Backend chưa cấu hình LiveKit. Kiểm tra LIVEKIT_URL, LIVEKIT_API_KEY và LIVEKIT_API_SECRET.",
  invalid_live_comment: "Nhập bình luận từ 1 đến 300 ký tự.",
  live_comment_failed: "Không lưu được bình luận. Hãy thử lại.",
  live_comment_not_joined: "Chưa kết nối với phòng bình luận.",
  livestream_not_found: "Không tìm thấy phiên live.",
  livestream_not_active: "Phiên live đã kết thúc.",
  order_not_pending: "Đơn hàng đã đổi trạng thái. Hãy tải lại.",
  order_not_paid: "Đơn chưa ở trạng thái đã thanh toán.",
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
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
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
    throw error;
  }
  return payload;
}

export function apiFor(mode, token) {
  return mode === "demo"
    ? async (path, options) => demoRequest(path, options)
    : (path, options) => request(path, { ...options, token });
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

export function liveCommand(mode, token, type, content) {
  if (mode === "demo")
    return Promise.resolve().then(() => demoLiveCommand(type, content));
  return new Promise((resolve, reject) => {
    const ws = openLiveSocket(token);
    let settled = false;
    const timeout = setTimeout(
      () =>
        finish(
          reject,
          new Error(
            "WebSocket không phản hồi. Hãy kiểm tra trạng thái live trước khi thử lại.",
          ),
        ),
      8000,
    );
    function finish(callback, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      ws.close();
      callback(value);
    }
    ws.onopen = () => ws.send(JSON.stringify({ type, content }));
    ws.onmessage = ({ data }) => {
      let message;
      try {
        message = JSON.parse(data);
      } catch {
        return;
      }
      if (message.type === `${type}_success`) finish(resolve, message);
      if (message.type === `${type}_error`)
        finish(reject, new Error(message.error));
    };
    ws.onerror = ws.onclose = () =>
      finish(
        reject,
        new Error(
          "Không mở được kết nối live. Kiểm tra backend và phiên đăng nhập.",
        ),
      );
  });
}

export function openLiveSocket(token, scope) {
  const url = new URL(`${apiOrigin}/api/auth/ws`, location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("token", token);
  if (scope) url.searchParams.set("scope", scope);
  return new WebSocket(url);
}

export function liveCommentError(code) {
  return messages[code] || messages.live_comment_failed;
}

export function mediaURL(value) {
  if (!value) return "";
  if (value.startsWith("/uploads/")) return `${apiOrigin}${value}`;
  if (value.startsWith("/images/") || /^https?:\/\//i.test(value)) return value;
  return "";
}
