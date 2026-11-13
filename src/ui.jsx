import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Package,
  Radio,
  Search,
  X,
} from "lucide-react";
import { mediaURL } from "./api";

export const money = (value) =>
  `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(Number(value) || 0)} ₫`;
export const date = (value) =>
  value
    ? new Intl.DateTimeFormat("vi-VN", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";
export const statuses = {
  pending: "Chờ thanh toán",
  paid: "Đã thanh toán",
  cancelled: "Đã hủy",
  refunded: "Đã hoàn",
};
export const orderOptions = Object.entries(statuses);

export function Picture({ src, alt = "", fallback: Icon = Package }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const url = mediaURL(src);
  return url && !failed ? (
    <img src={url} alt={alt} loading="lazy" onError={() => setFailed(true)} />
  ) : (
    <div className="photo-fallback" aria-hidden="true">
      <Icon size={36} strokeWidth={1.35} />
    </div>
  );
}

export function SectionTitle({
  icon: Icon,
  title,
  description,
  action,
  onAction,
}) {
  return (
    <div className="section-heading">
      <div className="section-label">
        <div className="section-icon">
          <Icon size={22} />
        </div>
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
      </div>
      {action && (
        <button className="text-button" onClick={onAction}>
          {action}
          <ArrowRight size={17} />
        </button>
      )}
    </div>
  );
}

export function LiveCard({ live, onOpen }) {
  return (
    <button className="live-card" onClick={onOpen}>
      <div className="live-image">
        <Picture src={live.image} fallback={Radio} />
        <span className={`live-badge ${live.status === "end" ? "ended" : ""}`}>
          {live.status === "start" && <i />}
          {live.status === "start" ? "Đang mở" : "Đã kết thúc"}
        </span>
        {live.category && (
          <span className="card-category">{live.category}</span>
        )}
      </div>
      <div className="live-info">
        <strong>{live.title}</strong>
        <div className="host">
          <span className="host-avatar">
            {live.seller_avatar ? (
              <Picture src={live.seller_avatar} fallback={Radio} />
            ) : (
              (live.seller_username || "L").slice(0, 1).toUpperCase()
            )}
          </span>
          <span>{live.seller_username || "Người bán"}</span>
          <ChevronRight className="card-arrow" size={17} />
        </div>
      </div>
    </button>
  );
}

export function ProductCard({ product, onOpen, onBuy, live = false }) {
  return (
    <article className="product-card">
      <button
        className="product-image"
        aria-label={`Xem ${product.name}`}
        onClick={onOpen}
      >
        <Picture src={product.image_url} />
        <span className="stock-badge">
          {product.is_pinned
            ? "Đã ghim"
            : product.stock_quantity > 0
              ? `Còn ${product.stock_quantity}`
              : "Hết hàng"}
        </span>
      </button>
      <div className="product-info">
        <button className="product-name" onClick={onOpen}>
          {product.name}
        </button>
        <div className="product-bottom">
          <div>
            <strong>
              {money(live ? product.discount_price : product.price)}
            </strong>
            {live && product.original_price > product.discount_price && (
              <del>{money(product.original_price)}</del>
            )}
          </div>
          <button
            className="quick-buy"
            aria-label={`Mua ${product.name}`}
            onClick={onBuy}
            disabled={!product.stock_quantity || !onBuy}
          >
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </article>
  );
}

export function Filter({ label, value, options, onChange }) {
  return (
    <label className="filter">
      <span>{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map(([key, text]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

export function SearchBox({ value, onSearch, placeholder, className = "" }) {
  const [draft, setDraft] = useState(value || "");
  useEffect(() => setDraft(value || ""), [value]);
  return (
    <form
      className={`search ${className}`}
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        onSearch(draft.trim());
      }}
    >
      <Search size={19} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        maxLength={100}
      />
      <button type="submit">Tìm kiếm</button>
    </form>
  );
}

export function State({ loading, error, empty, retry, children }) {
  if (loading)
    return (
      <div className="empty" role="status">
        <span className="spinner" />
        Đang tải…
      </div>
    );
  if (error)
    return (
      <div className="empty" role="alert">
        <strong>{error.message}</strong>
        {retry && (
          <button className="button secondary" onClick={retry}>
            Thử lại
          </button>
        )}
      </div>
    );
  if (empty)
    return (
      <div className="empty">
        <Package size={29} strokeWidth={1.4} />
        {empty}
      </div>
    );
  return children;
}

export function Pagination({ result, onChange }) {
  const totalPages = Math.ceil((result?.total || 0) / (result?.page_size || 1));
  if (totalPages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Phân trang">
      <button
        className="icon-button"
        aria-label="Trang trước"
        disabled={result.page <= 1}
        onClick={() => onChange(result.page - 1)}
      >
        <ChevronLeft size={18} />
      </button>
      <span>
        Trang {result.page} / {totalPages}
      </span>
      <button
        className="icon-button"
        aria-label="Trang tiếp"
        disabled={result.page >= totalPages}
        onClick={() => onChange(result.page + 1)}
      >
        <ChevronRight size={18} />
      </button>
    </nav>
  );
}

export function Modal({ title, close, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target === ref.current) close();
      }}
    >
      <div className="dialog-body">
        <div className="dialog-heading">
          <h2>{title}</h2>
          <button
            className="icon-button"
            type="button"
            onClick={close}
            aria-label="Đóng"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export function Back({ onClick, children }) {
  return (
    <button className="text-button back" onClick={onClick}>
      <ArrowLeft size={18} />
      {children}
    </button>
  );
}
