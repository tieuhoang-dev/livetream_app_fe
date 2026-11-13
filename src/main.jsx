import { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowRight,
  Bell,
  CircleUserRound,
  House,
  LayoutGrid,
  Radio,
  ShoppingBag,
  Search,
  Store,
  WifiOff,
} from "lucide-react";
import { apiFor, readSession } from "./api";
import { demoUser } from "./demo";
import { AuthModal, CheckoutModal, ProductModal } from "./modals";
import { Catalog, Discover, LiveRoom, Orders, Seller } from "./views";
import { SearchBox } from "./ui";
import "./style.css";

const links = [
  ["home", "Trang chủ", House],
  ["live", "Livestream", Radio],
  ["shop", "Cửa hàng", LayoutGrid],
  ["orders", "Đơn hàng", ShoppingBag],
];
function route() {
  const [part, id] = location.hash.slice(1).split("/");
  const safeId = id && /^[a-z0-9-]+$/i.test(id) ? id : null;
  return {
    view:
      links.some(([key]) => key === part) || part === "seller" ? part : "home",
    id: part === "live" ? safeId : null,
  };
}
function App() {
  const [current, setCurrent] = useState(route);
  const [mode, setMode] = useState(
    () =>
      sessionStorage.getItem("livemart-mode") ||
      (import.meta.env.DEV || import.meta.env.VITE_PUBLIC_API_URL
        ? "api"
        : "demo"),
  );
  const [session, setSession] = useState(readSession);
  const [q, setQ] = useState("");
  const [modal, setModal] = useState(null);
  const [notice, setNotice] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [mobileSearch, setMobileSearch] = useState(false);
  const activeUser = mode === "demo" ? demoUser : session?.profile;
  const api = useMemo(
    () => apiFor(mode, session?.token),
    [mode, session?.token],
  );
  const reload = useCallback(() => setRefresh((value) => value + 1), []);

  useEffect(() => {
    const update = () => {
      setCurrent(route());
      window.scrollTo(0, 0);
    };
    addEventListener("hashchange", update);
    return () => removeEventListener("hashchange", update);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timeout);
  }, [notice]);

  function navigate(view, id, search = "") {
    setQ(search);
    setMobileSearch(false);
    const hash = `#${view}${id ? `/${id}` : ""}`;
    if (location.hash === hash) {
      setCurrent(route());
      window.scrollTo(0, 0);
    } else location.hash = hash;
  }
  function changeMode(next) {
    sessionStorage.setItem("livemart-mode", next);
    setMode(next);
    setModal(null);
    setSelectedOrder(null);
    navigate("home");
  }
  function withAccount(next) {
    if (activeUser) {
      next(session?.token);
      return;
    }
    setModal({ type: "auth", after: next });
  }
  function buy(product, live) {
    withAccount(() => setModal({ type: "checkout", product, live }));
  }
  function signIn(token) {
    sessionStorage.setItem("livemart-token", token);
    const next = readSession();
    if (!next) throw new Error("Phiên đăng nhập không hợp lệ.");
    setSession(next);
    setModal(null);
    modal?.after?.(next.token);
  }
  function signOut() {
    sessionStorage.removeItem("livemart-token");
    setSession(null);
    setModal(null);
    setSelectedOrder(null);
    navigate("home");
    setNotice("Đã đăng xuất.");
  }
  const close = () => setModal(null);
  const showProduct = (product, live) =>
    setModal({ type: "product", product, live });
  const search = (value) =>
    navigate(current.view === "live" ? "live" : "shop", null, value);
  const shared = {
    api,
    mode,
    refresh,
    reload,
    navigate,
    q,
    setQ,
    buy,
    showProduct,
    activeUser,
    withAccount,
    notice: setNotice,
    session,
    demo: () => changeMode("demo"),
  };

  return (
    <>
      <a
        className="skip"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Đến nội dung
      </a>
      <header className="header">
        <div className="container header-inner">
          <button
            className="logo"
            aria-label="LiveMart trang chủ"
            onClick={() => navigate("home")}
          >
            <span className="logo-icon">
              <ShoppingBag size={22} />
              <i />
            </span>
            <span>
              Live<span>Mart</span>
            </span>
          </button>
          <SearchBox
            className="desktop-search"
            value={q}
            onSearch={search}
            placeholder={
              current.view === "live" ? "Tìm livestream…" : "Tìm sản phẩm…"
            }
          />
          <div className="header-actions">
            <button
              className="icon-button mobile-search-button"
              aria-label="Mở tìm kiếm"
              onClick={() => setMobileSearch((value) => !value)}
            >
              <Search size={21} />
            </button>
            <button
              className="icon-button header-orders"
              aria-label="Đơn hàng"
              onClick={() => navigate("orders")}
            >
              <ShoppingBag size={21} />
            </button>
            <button
              className="button secondary account"
              onClick={() =>
                setModal({ type: activeUser ? "account" : "auth" })
              }
            >
              <CircleUserRound size={19} />
              <span>
                {activeUser ? activeUser.username || "Tài khoản" : "Đăng nhập"}
              </span>
            </button>
          </div>
        </div>
        {mobileSearch && (
          <div className="container search-mobile">
            <SearchBox
              value={q}
              onSearch={search}
              placeholder={
                current.view === "live" ? "Tìm livestream…" : "Tìm sản phẩm…"
              }
            />
          </div>
        )}
      </header>
      <nav className="desktop-nav" aria-label="Điều hướng chính">
        <div className="container nav-inner">
          <div className="nav-links">
            {links.map(([key, label, Icon]) => (
              <button
                key={key}
                aria-current={current.view === key ? "page" : undefined}
                onClick={() => navigate(key)}
              >
                <Icon size={17} />
                {label}
              </button>
            ))}
          </div>
          <button
            className="seller-link"
            aria-current={current.view === "seller" ? "page" : undefined}
            onClick={() => navigate("seller")}
          >
            <Store size={17} /> Kênh người bán <ArrowRight size={15} />
          </button>
        </div>
      </nav>
      <main id="main-content" className="container main-content" tabIndex={-1}>
        {mode === "demo" && (
          <div className="demo-strip">
            <span>
              <WifiOff size={15} /> Đang dùng dữ liệu mẫu
            </span>
            <button onClick={() => changeMode("api")}>
              Kết nối backend <ArrowRight size={15} />
            </button>
          </div>
        )}
        {current.view === "home" && <Discover {...shared} />}
        {current.view === "live" &&
          (current.id ? (
            <LiveRoom {...shared} id={current.id} key={current.id} />
          ) : (
            <Discover {...shared} listing />
          ))}
        {current.view === "shop" && <Catalog {...shared} />}
        {current.view === "orders" && (
          <Orders
            {...shared}
            initialId={selectedOrder}
            signIn={() => withAccount(() => {})}
          />
        )}
        {current.view === "seller" && (
          <Seller {...shared} signIn={() => withAccount(() => {})} />
        )}
      </main>
      <footer className="footer">
        <div className="container">
          <strong>LiveMart</strong>
          <span>Mua sắm qua livestream</span>
          <button
            className="text-button"
            onClick={() => changeMode(mode === "demo" ? "api" : "demo")}
          >
            {mode === "demo" ? "Dùng backend" : "Dùng dữ liệu mẫu"}
          </button>
        </div>
      </footer>
      <nav className="mobile-nav" aria-label="Điều hướng trên điện thoại">
        {links.map(([key, label, Icon]) => (
          <button
            key={key}
            aria-current={current.view === key ? "page" : undefined}
            onClick={() => navigate(key)}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
        <button
          aria-current={current.view === "seller" ? "page" : undefined}
          onClick={() => navigate("seller")}
        >
          <Store size={20} />
          <span>Người bán</span>
        </button>
      </nav>
      {notice && (
        <div className="toast" role="status">
          <Bell size={18} />
          {notice}
        </div>
      )}
      {modal?.type === "auth" && <AuthModal close={close} onLogin={signIn} />}
      {modal?.type === "account" && (
        <AuthModal
          close={close}
          user={activeUser}
          onLogout={mode === "api" ? signOut : null}
        />
      )}
      {modal?.type === "product" && (
        <ProductModal
          product={modal.product}
          live={modal.live}
          close={close}
          onBuy={() => buy(modal.product, modal.live)}
        />
      )}
      {modal?.type === "checkout" && (
        <CheckoutModal
          api={api}
          product={modal.product}
          live={modal.live}
          close={close}
          onOrder={(id) => {
            close();
            reload();
            setSelectedOrder(id);
            navigate("orders");
            setNotice("Đã tạo đơn hàng.");
          }}
        />
      )}
    </>
  );
}

createRoot(document.getElementById("root")).render(<App />);
