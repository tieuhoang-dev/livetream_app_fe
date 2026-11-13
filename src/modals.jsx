import { useState } from "react";
import { ArrowRight, LockKeyhole, ShoppingBag } from "lucide-react";
import { request } from "./api";
import { Modal, money, Picture } from "./ui";

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

export function ProductModal({ product, live, close, onBuy }) {
  const availability =
    product.status === "removed"
      ? "Đã ngừng bán"
      : live && live.status !== "start"
        ? "Phiên đã kết thúc"
        : null;
  return (
    <Modal title={product.name} close={close}>
      <div className="detail-photo">
        <Picture src={product.image_url} />
      </div>
      <div className="modal-meta">
        <strong>{money(live ? product.discount_price : product.price)}</strong>
        <span>
          {availability ||
            (product.stock_quantity > 0
              ? `Còn ${product.stock_quantity} sản phẩm`
              : "Hết hàng")}
        </span>
      </div>
      {product.description && (
        <p className="detail-description">{product.description}</p>
      )}
      <button
        className="button primary wide"
        disabled={!product.stock_quantity || Boolean(availability)}
        onClick={onBuy}
      >
        <ShoppingBag size={18} /> Đặt mua
      </button>
    </Modal>
  );
}

export function CheckoutModal({ api, product, live, close, onOrder }) {
  const [quantity, setQuantity] = useState("1");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const unitPrice = live ? product.discount_price : product.price;
  async function submit(event) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const result = await api("/api/orders", {
        method: "POST",
        body: {
          product_id: live ? product.product_id : product.id,
          quantity: Number(quantity),
          payment_method: "manual",
          ...(live ? { livestream_id: live.id } : {}),
        },
      });
      onOrder(result.order_id);
    } catch (err) {
      setError(err.message);
    } finally {
      setPending(false);
    }
  }
  return (
    <Modal title="Đặt hàng" close={pending ? () => {} : close}>
      <form className="stack-form" onSubmit={submit}>
        <div className="checkout-product">
          <div className="mini-photo">
            <Picture src={product.image_url} />
          </div>
          <div>
            <strong>{product.name}</strong>
            <span>{money(unitPrice)}</span>
          </div>
        </div>
        <label>
          Số lượng
          <input
            type="number"
            min="1"
            max={product.stock_quantity}
            step="1"
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            required
          />
        </label>
        <div className="checkout-total">
          <span>Tổng tiền</span>
          <strong>{money(unitPrice * Number(quantity))}</strong>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary" disabled={pending}>
          {pending ? "Đang đặt…" : "Xác nhận đặt hàng"}
          <ArrowRight size={17} />
        </button>
      </form>
    </Modal>
  );
}
