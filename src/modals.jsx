import { DeliverySummary } from "./DeliverySummary";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, LockKeyhole, ShoppingBag } from "lucide-react";
import { request } from "./api";
import { AddressFields, addressReady, addressMissingFields, shippingAreaReady, emptyAddress } from "./DeliveryAddress";
import { Modal, money, paymentMethods, Picture } from "./ui";

const authActions = {
  login: ["Đăng nhập", "/api/users/login"],
  register: ["Tạo tài khoản", "/api/users/register"],
  verify: ["Xác thực email", "/api/users/verify"],
  resetRequest: ["Gửi mã đặt lại", "/api/users/password/reset-request"],
  reset: ["Đặt lại mật khẩu", "/api/users/password/reset"],
};

export function AuthModal({ close, onLogin, user, onLogout }) {
  const [stage, setStage] = useState("login");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState("");
  const [label, path] = authActions[stage];
  function switchStage(next) {
    setStage(next);
    setError("");
    setFeedback("");
  }
  async function submit(event) {
    event.preventDefault();
    setPending(true);
    setError("");
    setFeedback("");
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const result = await request(path, { method: "POST", body });
      if (stage === "login") {
        onLogin(result.token);
        return;
      }
      if (stage === "register") {
        setStage("verify");
        setFeedback("Nhập mã OTP gửi đến email đăng ký.");
      } else if (stage === "resetRequest") {
        setStage("reset");
        setFeedback("Nhập mã OTP và mật khẩu mới.");
      } else {
        setStage("login");
        setFeedback(
          stage === "verify"
            ? "Đã xác thực. Bạn có thể đăng nhập."
            : "Đã đổi mật khẩu. Hãy đăng nhập lại.",
        );
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }
  if (user)
    return (
      <Modal title="Tài khoản" close={close}>
        <div className="account-panel">
          <div className="section-icon">
            <LockKeyhole size={24} />
          </div>
          <strong>{user.username}</strong>
          {onLogout ? (
            <button className="button secondary" onClick={onLogout}>
              Đăng xuất
            </button>
          ) : (
            <p>Tài khoản dùng thử</p>
          )}
        </div>
      </Modal>
    );
  return (
    <Modal title={label} close={close}>
      <form key={stage} className="stack-form" onSubmit={submit}>
        <label>
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        {stage === "register" && (
          <label>
            Tên người dùng
            <input
              name="username"
              autoComplete="username"
              maxLength={255}
              required
            />
          </label>
        )}
        {["login", "register"].includes(stage) && (
          <label>
            Mật khẩu
            <input
              name="password"
              type="password"
              autoComplete={
                stage === "login" ? "current-password" : "new-password"
              }
              maxLength={72}
              required
            />
          </label>
        )}
        {["verify", "reset"].includes(stage) && (
          <label>
            Mã OTP
            <input
              name="code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoComplete="one-time-code"
              required
            />
          </label>
        )}
        {stage === "reset" && (
          <label>
            Mật khẩu mới
            <input
              name="new_password"
              type="password"
              autoComplete="new-password"
              maxLength={72}
              required
            />
          </label>
        )}
        {feedback && (
          <p className="form-feedback" role="status">
            {feedback}
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary" disabled={pending}>
          {pending ? "Đang xử lý…" : label}
          <ArrowRight size={17} />
        </button>
        <div className="form-links">
          {stage === "login" ? (
            <>
              <button type="button" onClick={() => switchStage("register")}>
                Đăng ký
              </button>
              <button type="button" onClick={() => switchStage("verify")}>
                Nhập OTP
              </button>
              <button type="button" onClick={() => switchStage("resetRequest")}>
                Quên mật khẩu
              </button>
            </>
          ) : (
            <button type="button" onClick={() => switchStage("login")}>
              Về đăng nhập
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}

export function ProductModal({ product, live, close, onBuy, isOwnProduct }) {
  return (
    <Modal title={product.name} close={close}>
      <div className="detail-photo">
        <Picture src={product.image_url} />
      </div>
      <div className="modal-meta">
        <strong>{money(live ? product.discount_price : product.price)}</strong>
        <span>
          {product.stock_quantity > 0
            ? `Còn ${product.stock_quantity} sản phẩm`
            : "Hết hàng"}
        </span>
      </div>
      {product.description && (
        <p className="detail-description">{product.description}</p>
      )}
      <button
        className="button primary wide"
        disabled={
          isOwnProduct || !product.stock_quantity || (live && live.status !== "start")
        }
        onClick={onBuy}
      >
        <ShoppingBag size={18} /> Đặt mua
      </button>
    </Modal>
  );
}

function newCheckoutID() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  return [hex.slice(0,8), hex.slice(8,12), hex.slice(12,16), hex.slice(16,20), hex.slice(20)].join("-");
}

export function CheckoutModal({ api, product, live, close, onOrder, initialDelivery }) {
  const [quantity, setQuantity] = useState("1");
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [delivery, setDelivery] = useState(() => ({ ...emptyAddress, ...initialDelivery }));
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [quote, setQuote] = useState(null);
  const [quoteError, setQuoteError] = useState("");
  const [quoting, setQuoting] = useState(false);
  const [quoteAttempt, setQuoteAttempt] = useState(0);
  useEffect(() => {
    if (!live?.id) return;
    return api.subscribe("shipping.origin.subscribe", { livestream_id: live.id }, { onData: () => setQuoteAttempt((value) => value + 1) });
  }, [api, live?.id]);
  const base = {
    product_id: live ? product.product_id : product.id,
    quantity: Number(quantity),
    payment_method: paymentMethod,
    delivery,
    ...(live ? { livestream_id: live.id } : {}),
  };
  const quoteKey = JSON.stringify({ product_id: base.product_id, quantity: base.quantity, payment_method: paymentMethod,
    ...(live ? { livestream_id: live.id } : {}), delivery: { province_code: delivery.province_code,
      carrier_province_id: delivery.carrier_province_id, carrier_district_id: delivery.carrier_district_id, carrier_ward_code: delivery.carrier_ward_code } });
  const canQuote = shippingAreaReady(delivery, api.mode !== "demo");
  const requestKey = JSON.stringify({ ...base, note });
  const requestID = useMemo(newCheckoutID, [requestKey]);
  useEffect(() => {
    setQuote(null);
    setQuoteError("");
    setQuoting(false);
    if (!canQuote || !Number.isInteger(Number(quantity)) || Number(quantity) <= 0) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setQuoting(true);
      try {
        const value = await api.command("shipping.quote", JSON.parse(quoteKey), { signal: controller.signal });
        if (!controller.signal.aborted) setQuote(value);
      } catch (err) {
        if (!controller.signal.aborted) setQuoteError(err.message);
      } finally {
        if (!controller.signal.aborted) setQuoting(false);
      }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [api, quoteKey, canQuote, quoteAttempt]);
  async function submit(event) {
    event.preventDefault();
    if (pending || quoting || !quote || !addressReady(delivery)) return;
    setPending(true);
    setError("");
    try {
      const result = await api("/api/orders", {
        method: "POST",
        body: { ...base, note, request_id: requestID, expected_total: quote.total_amount },
      });
      onOrder(result.order_id, delivery);
    } catch (err) {
      setError(err.message);
      if (err.code === "checkout_changed") { setQuote(null); setQuoteAttempt((value) => value + 1); }
    } finally { setPending(false); }
  }
  const unitPrice = quote?.unit_price ?? (live ? product.discount_price : product.price);
  return (
    <Modal title="Đặt hàng" close={pending ? () => {} : close}>
      <form className="stack-form checkout-form" onSubmit={submit}>
        <div className="checkout-product">
          <div className="mini-photo"><Picture src={product.image_url} /></div>
          <div><strong>{product.name}</strong><span>{money(unitPrice)}</span></div>
        </div>
        <label>Số lượng
          <input type="number" min="1" max={product.stock_quantity} step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} disabled={pending} required />
        </label>
        <AddressFields api={api} value={delivery} onChange={setDelivery} disabled={pending} />
        <label>Ghi chú giao hàng (không bắt buộc)
          <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={500} rows={2} disabled={pending} placeholder="Ví dụ: gọi trước khi giao…" />
        </label>
        <DeliverySummary address={delivery} note={note} />
        <label>Phương thức thanh toán
          <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} disabled={pending} aria-describedby="checkout-payment-note" required>
            {paymentMethods.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <p className="payment-note" id="checkout-payment-note">{paymentMethod === "bank_transfer" ? "Liên hệ người bán để nhận thông tin chuyển khoản cho đơn hàng." : "Thanh toán khi bạn nhận được hàng."}</p>
        {quote && <p className="payment-note">Lấy hàng tại {quote.pickup_province}. {quote.shipping?.provider === "ghn" ? `Báo phí GHN${quote.shipping.environment === "staging" ? " · môi trường thử nghiệm" : ""}.` : "Phí vận chuyển minh họa trong bản mẫu."}</p>}
        {quote?.shipping?.parcel && <p className="payment-note">Kiện dự tính: {quote.shipping.parcel.weight_grams} g · {quote.shipping.parcel.length_cm} × {quote.shipping.parcel.width_cm} × {quote.shipping.parcel.height_cm} cm.</p>}
        {quote?.shipping?.origin_type === "station_dropoff" && <p className="payment-note">Phí tính từ {quote.shipping.station_name}; người bán tự mang hàng ra bưu cục.</p>}
        <div className="checkout-breakdown" aria-label="Chi tiết thanh toán">
          <div><span>Tiền hàng</span><strong>{quote ? money(quote.items_subtotal) : "Chưa tính"}</strong></div>
          <div><span>Phí vận chuyển</span><strong>{quote ? (quote.shipping_fee === 0 ? "Miễn phí" : money(quote.shipping_fee)) : "Chưa tính"}</strong></div>
          <div className="checkout-total"><span>Tổng phải trả</span><strong>{quote ? money(quote.total_amount) : "Chưa tính"}</strong></div>
        </div>
        {quoting && <p className="payment-note" role="status">Đang tính phí vận chuyển…</p>}
        {!quote && !quoteError && !quoting && <p className="payment-note">Chọn đủ khu vực nhận hàng để lấy báo phí vận chuyển.</p>}
        {quote && !addressReady(delivery) && <p className="payment-note">Đã tính phí ship. Bổ sung {addressMissingFields(delivery).join(", ")} để đặt hàng.</p>}
        {quoteError && <div><p className="form-error" role="alert">{quoteError}</p><button type="button" className="text-button" onClick={() => setQuoteAttempt((value) => value + 1)}>Thử tính lại</button></div>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button primary" disabled={pending || quoting || !quote || !addressReady(delivery)}>
          {pending ? "Đang đặt…" : "Xác nhận đặt hàng"}<ArrowRight size={17} />
        </button>
      </form>
    </Modal>
  );
}
