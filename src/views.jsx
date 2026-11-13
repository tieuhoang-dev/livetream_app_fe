import { useEffect, useState } from "react";
import {
  ArrowRight,
  CirclePlay,
  ClipboardList,
  LayoutGrid,
  ListFilter,
  Package,
  Plus,
  Radio,
  ShoppingBag,
  Store,
} from "lucide-react";
import { liveCommand, request } from "./api";
import { LiveVideo } from "./LiveVideo";
import { LiveComments } from "./LiveComments";
import {
  Back,
  date,
  Filter,
  LiveCard,
  Modal,
  money,
  orderOptions,
  Pagination,
  Picture,
  ProductCard,
  SearchBox,
  SectionTitle,
  State,
  statuses,
} from "./ui";

const pageSize = 12;
const liveStatuses = [
  ["start", "Đang mở"],
  ["end", "Đã kết thúc"],
  ["all", "Tất cả trạng thái"],
];
const sortOptions = [
  ["newest", "Mới nhất"],
  ["oldest", "Cũ nhất"],
];
const orderStatuses = [["", "Tất cả trạng thái"], ...orderOptions];
const channelOptions = [
  ["", "Tất cả kênh"],
  ["offline", "Ngoài live"],
  ["live", "Trong live"],
];

function useData(api, path, query, refresh, keepData = false, pollMs = 0) {
  const queryKey = JSON.stringify(query || {});
  const [state, setState] = useState({ loading: Boolean(path) });
  useEffect(() => {
    if (!path) {
      setState({ loading: false });
      return;
    }
    const controller = new AbortController();
    let timer;
    setState((previous) =>
      keepData
        ? { data: previous.data, loading: !previous.data }
        : { loading: true },
    );
    async function read() {
      try {
        const data = await api(path, {
          query: JSON.parse(queryKey),
          signal: controller.signal,
        });
        if (!controller.signal.aborted) setState({ data, loading: false });
      } catch (error) {
        if (!controller.signal.aborted) {
          setState((previous) => ({
            data: keepData && error.status !== 404 ? previous.data : undefined,
            error,
            loading: false,
          }));
        }
      } finally {
        if (!controller.signal.aborted && pollMs)
          timer = setTimeout(read, pollMs);
      }
    }
    void read();
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [api, path, queryKey, refresh, keepData, pollMs]);
  return state;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function Discover({
  api,
  q,
  setQ,
  refresh,
  reload,
  navigate,
  showProduct,
  buy,
  listing,
  mode,
  demo,
}) {
  const [filters, setFilters] = useState({
    status: "start",
    sort: "newest",
    seller_id: "",
    product_id: "",
  });
  const [filterDraft, setFilterDraft] = useState({
    seller_id: "",
    product_id: "",
  });
  const [filterError, setFilterError] = useState("");
  const [extra, setExtra] = useState(false);
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [q, listing]);
  const update = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };
  const lives = useData(
    api,
    "/api/livestreams",
    listing ? { ...filters, q, page, page_size: pageSize } : { page_size: 4 },
    refresh,
  );
  const products = useData(
    api,
    listing ? null : "/api/products",
    { page_size: 4, in_stock: true },
    refresh,
  );
  function applyFilters(event) {
    event.preventDefault();
    const seller_id = filterDraft.seller_id.trim(),
      product_id = filterDraft.product_id.trim();
    if (
      mode === "api" &&
      [seller_id, product_id].some((value) => value && !uuid.test(value))
    ) {
      setFilterError("Nhập mã UUID hợp lệ.");
      return;
    }
    setFilterError("");
    setFilters((current) => ({ ...current, seller_id, product_id }));
    setPage(1);
  }
  return (
    <>
      {!listing && (
        <section className="hero">
          <div className="hero-content">
            <span className="hero-label">
              <Radio size={15} /> Mua sắm qua livestream
            </span>
            <h1>
              Mở live.
              <br />
              Chọn món bạn thích.
            </h1>
            <p>
              Khám phá phiên đang phát, xem sản phẩm và mua ngay trong live.
            </p>
            <button
              className="button hero-button"
              onClick={() => navigate("live")}
            >
              <CirclePlay size={20} /> Khám phá live <ArrowRight size={18} />
            </button>
          </div>
        </section>
      )}
      {listing && (
        <div className="page-heading">
          <div className="page-kicker">
            <Radio size={18} /> LIVESTREAM
          </div>
          <h1>Khám phá livestream</h1>
          <p>Tìm phiên live theo tiêu đề, người bán hoặc sản phẩm.</p>
        </div>
      )}
      {listing && (
        <div className="filter-panel">
          <div className="filter-row">
            <SearchBox
              value={q}
              onSearch={(value) => {
                setQ(value);
                setPage(1);
              }}
              placeholder="Tìm theo tiêu đề live…"
            />
            <Filter
              label="Trạng thái"
              value={filters.status}
              options={liveStatuses}
              onChange={(value) => update("status", value)}
            />
            <Filter
              label="Sắp xếp"
              value={filters.sort}
              options={sortOptions}
              onChange={(value) => update("sort", value)}
            />
            <button
              className="button secondary"
              aria-expanded={extra}
              onClick={() => setExtra((value) => !value)}
            >
              <ListFilter size={18} /> Bộ lọc
            </button>
          </div>
          {extra && (
            <form className="advanced-filter" onSubmit={applyFilters}>
              {[
                ["seller_id", "Mã người bán"],
                ["product_id", "Mã sản phẩm"],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    value={filterDraft[key]}
                    onChange={(event) =>
                      setFilterDraft((value) => ({
                        ...value,
                        [key]: event.target.value,
                      }))
                    }
                  />
                </label>
              ))}
              <button className="button primary">Áp dụng</button>
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  setFilterDraft({ seller_id: "", product_id: "" });
                  setFilters((current) => ({
                    ...current,
                    seller_id: "",
                    product_id: "",
                  }));
                  setFilterError("");
                  setPage(1);
                }}
              >
                Xóa lọc
              </button>
              {filterError && (
                <p className="form-error" role="alert">
                  {filterError}
                </p>
              )}
            </form>
          )}
        </div>
      )}
      <section className="content-section">
        {!listing && (
          <SectionTitle
            icon={Radio}
            title="Phiên live đang mở"
            description="Xem phòng và sản phẩm đang bán"
            action="Xem tất cả"
            onAction={() => navigate("live")}
          />
        )}
        <State
          {...lives}
          empty={!lives.data?.data.length && "Chưa có phiên live phù hợp."}
          retry={reload}
        >
          <div className="card-grid">
            {lives.data?.data.map((live) => (
              <LiveCard
                key={live.id}
                live={live}
                onOpen={() => navigate("live", live.id)}
              />
            ))}
          </div>
          {listing && <Pagination result={lives.data} onChange={setPage} />}
        </State>
        {!listing && lives.error && mode === "api" && (
          <button className="text-button demo-link" onClick={demo}>
            Xem giao diện với dữ liệu mẫu <ArrowRight size={16} />
          </button>
        )}
      </section>
      {!listing && (
        <section className="content-section">
          <SectionTitle
            icon={ShoppingBag}
            title="Mua sắm ngoài live"
            description="Đặt hàng trực tiếp từ danh mục sản phẩm"
            action="Vào cửa hàng"
            onAction={() => navigate("shop")}
          />
          <State
            {...products}
            empty={!products.data?.data.length && "Chưa có sản phẩm còn hàng."}
            retry={reload}
          >
            <div className="card-grid">
              {products.data?.data.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  onOpen={() => showProduct(p)}
                  onBuy={() => buy(p)}
                />
              ))}
            </div>
          </State>
        </section>
      )}
    </>
  );
}

export function Catalog({ api, q, setQ, refresh, reload, buy, showProduct }) {
  const [stock, setStock] = useState(true);
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [q]);
  const items = useData(
    api,
    "/api/products",
    { q, in_stock: stock, page, page_size: pageSize },
    refresh,
  );
  return (
    <>
      <div className="page-heading">
        <div className="page-kicker">
          <LayoutGrid size={18} /> CỬA HÀNG
        </div>
        <h1>Sản phẩm</h1>
        <p>Mua trực tiếp từ kho của người bán.</p>
      </div>
      <div className="filter-panel filter-row">
        <SearchBox
          value={q}
          onSearch={(value) => {
            setQ(value);
            setPage(1);
          }}
          placeholder="Tìm sản phẩm…"
        />
        <label className="checkbox">
          <input
            type="checkbox"
            checked={stock}
            onChange={(event) => {
              setStock(event.target.checked);
              setPage(1);
            }}
          />{" "}
          Chỉ xem hàng còn kho
        </label>
      </div>
      <section className="content-section">
        <State
          {...items}
          empty={!items.data?.data.length && "Chưa có sản phẩm phù hợp."}
          retry={reload}
        >
          <div className="card-grid">
            {items.data?.data.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                onOpen={() => showProduct(p)}
                onBuy={() => buy(p)}
              />
            ))}
          </div>
          <Pagination result={items.data} onChange={setPage} />
        </State>
      </section>
    </>
  );
}

export function LiveRoom({
  api,
  id,
  refresh,
  reload,
  buy,
  showProduct,
  navigate,
  mode,
  activeUser,
  withAccount,
  notice,
}) {
  const [page, setPage] = useState(1);
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const live = useData(
    mode === "api" ? request : api,
    `/api/livestreams/${id}`,
    null,
    refresh,
    true,
    mode === "api" ? 5000 : 0,
  );
  const roomOpen = live.data?.status === "start";
  const items = useData(
    api,
    `/api/livestreams/${id}/products`,
    { page, page_size: pageSize },
    refresh,
    true,
    mode === "api" && roomOpen ? 5000 : 0,
  );
  const isOwner = activeUser?.user_id === live.data?.seller_id;
  return (
    <>
      <Back onClick={() => navigate("live")}>Danh sách live</Back>
      {live.data ? (
        <>
          <div className="room-layout">
            <LiveVideo
              api={api}
              live={live.data}
              mode={mode}
              isOwner={isOwner}
              withAccount={withAccount}
              onEnded={(message) => {
                if (message) notice(message);
                reload();
              }}
            />
            <div className="room-sidebar">
              <div className="room-details">
                <span
                  className={`live-badge ${live.data.status === "end" ? "ended" : ""}`}
                >
                  {live.data.status === "start" && <i />}
                  {live.data.status === "start" ? "Đang mở" : "Đã kết thúc"}
                </span>
                <h1>{live.data.title}</h1>
                <p>{live.data.seller_username || "Người bán"}</p>
                <span>Bắt đầu lúc {date(live.data.started_at)}</span>
                {isOwner && roomOpen && (
                  <button
                    className="button secondary"
                    onClick={() => setInventoryOpen(true)}
                  >
                    <Plus size={18} /> Thêm hàng
                  </button>
                )}
              </div>
              <LiveComments
                api={api}
                live={live.data}
                activeUser={activeUser}
                withAccount={withAccount}
                onEnded={reload}
              />
            </div>
          </div>
          <section className="content-section">
            <SectionTitle icon={ShoppingBag} title="Sản phẩm trong phiên" />
            <State
              {...items}
              empty={!items.data?.data.length && "Phiên này chưa có sản phẩm."}
              retry={reload}
            >
              <div className="card-grid">
                {items.data?.data.map((p) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    live
                    onOpen={() => showProduct(p, live.data)}
                    onBuy={
                      live.data.status === "start"
                        ? () => buy(p, live.data)
                        : undefined
                    }
                  />
                ))}
              </div>
              <Pagination result={items.data} onChange={setPage} />
            </State>
          </section>
          {inventoryOpen && isOwner && (
            <LiveInventory
              api={api}
              live={live.data}
              activeUser={activeUser}
              refresh={refresh}
              reload={() => {
                setPage(1);
                reload();
              }}
              notice={notice}
              close={() => setInventoryOpen(false)}
            />
          )}
        </>
      ) : (
        <State {...live} retry={reload} />
      )}
    </>
  );
}

function LoginPrompt({ signIn }) {
  return (
    <div className="empty">
      <ShoppingBag size={28} />
      <strong>Đăng nhập để tiếp tục</strong>
      <button className="button primary" onClick={signIn}>
        Đăng nhập
      </button>
    </div>
  );
}

export function Orders({
  api,
  refresh,
  reload,
  activeUser,
  signIn,
  initialId,
  seller = false,
  notice,
}) {
  const [channel, setChannel] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(initialId || null);
  const path = seller ? "/api/sales/offline" : "/api/orders";
  useEffect(() => {
    setSelected(initialId || null);
  }, [initialId]);
  const orders = useData(
    api,
    activeUser ? path : null,
    { channel, status, page, page_size: pageSize },
    refresh,
  );
  return (
    <>
      {!seller && (
        <div className="page-heading">
          <div className="page-kicker">
            <ClipboardList size={18} /> ĐƠN HÀNG
          </div>
          <h1>Đơn hàng của bạn</h1>
          <p>Theo dõi các đơn trong live và đơn mua từ cửa hàng.</p>
        </div>
      )}
      {!activeUser ? (
        <LoginPrompt signIn={signIn} />
      ) : (
        <>
          <div className="filter-panel filter-row order-filters">
            {!seller && (
              <Filter
                label="Kênh mua"
                value={channel}
                options={channelOptions}
                onChange={(value) => {
                  setChannel(value);
                  setPage(1);
                }}
              />
            )}
            <Filter
              label="Trạng thái"
              value={status}
              options={orderStatuses}
              onChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
            />
          </div>
          <section className="content-section">
            <State
              {...orders}
              empty={!orders.data?.data.length && "Chưa có đơn hàng phù hợp."}
              retry={reload}
            >
              <div className="rows">
                {orders.data?.data.map((order) => (
                  <button
                    className="order-row"
                    key={order.id}
                    onClick={() => setSelected(order.id)}
                  >
                    <div className="section-icon">
                      <Package size={20} />
                    </div>
                    <div className="row-main">
                      <strong>#{order.id.slice(0, 8).toUpperCase()}</strong>
                      <span>
                        {order.livestream_id ? "Trong live" : "Ngoài live"} ·{" "}
                        {date(order.created_at)}
                      </span>
                    </div>
                    <span className={`status-tag ${order.status}`}>
                      {statuses[order.status] || order.status}
                    </span>
                    <strong className="row-price">
                      {money(order.total_amount)}
                    </strong>
                    <ArrowRight size={17} />
                  </button>
                ))}
              </div>
              <Pagination result={orders.data} onChange={setPage} />
            </State>
          </section>
        </>
      )}
      {selected && activeUser && (
        <OrderDetail
          key={selected}
          {...{ api, reload, refresh, notice, seller }}
          path={`${path}/${selected}`}
          close={() => setSelected(null)}
        />
      )}
    </>
  );
}

function OrderDetail({ api, path, refresh, reload, close, seller, notice }) {
  const detail = useData(api, path, null, refresh);
  const [action, setAction] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setWorking(true);
    setError("");
    const body =
      action === "refund"
        ? {
            refund_reason: new FormData(event.currentTarget)
              .get("reason")
              .trim(),
          }
        : action === "pay"
          ? { payment_method: detail.data.payment?.payment_method || "manual" }
          : undefined;
    try {
      await api(`${path}/${action}`, { method: "POST", body });
      setAction("");
      reload();
      notice("Đã cập nhật đơn hàng.");
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  }
  const order = detail.data;
  return (
    <Modal title="Chi tiết đơn hàng" close={close}>
      <State {...detail} retry={reload}>
        {order && (
          <>
            <div className="order-summary">
              <span>
                #{order.id.slice(0, 8).toUpperCase()} · {date(order.created_at)}
              </span>
              <span className={`status-tag ${order.status}`}>
                {statuses[order.status] || order.status}
              </span>
            </div>
            <div className="line-items">
              {order.items.map((item, index) => (
                <div
                  className="checkout-product"
                  key={`${item.product_id}-${index}`}
                >
                  <div className="mini-photo">
                    <Picture src={item.image_url} />
                  </div>
                  <div>
                    <strong>{item.name || "Sản phẩm"}</strong>
                    <span>
                      {item.quantity} × {money(item.price_at_purchase)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="checkout-total">
              <span>Tổng tiền</span>
              <strong>{money(order.total_amount)}</strong>
            </div>
            {order.refund_reason && (
              <p>Lý do hoàn đơn: {order.refund_reason}</p>
            )}
            {!seller && !action && (
              <div className="inline-actions">
                {order.status === "pending" && (
                  <>
                    <button
                      className="button primary"
                      onClick={() => setAction("pay")}
                    >
                      Ghi nhận thanh toán
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => setAction("cancel")}
                    >
                      Hủy đơn
                    </button>
                  </>
                )}
                {order.status === "paid" && (
                  <button
                    className="button secondary"
                    onClick={() => setAction("refund")}
                  >
                    Hoàn đơn
                  </button>
                )}
              </div>
            )}
            {action && (
              <form className="stack-form" onSubmit={submit}>
                {action === "refund" ? (
                  <label>
                    Lý do hoàn đơn
                    <input name="reason" required maxLength={255} />
                  </label>
                ) : (
                  <p>
                    {action === "pay"
                      ? "Thao tác này ghi nhận thanh toán trong hệ thống."
                      : "Xác nhận hủy đơn và trả hàng về kho?"}
                  </p>
                )}
                {error && (
                  <p className="form-error" role="alert">
                    {error}
                  </p>
                )}
                <div className="inline-actions">
                  <button className="button primary" disabled={working}>
                    Xác nhận
                  </button>
                  <button
                    className="button secondary"
                    type="button"
                    disabled={working}
                    onClick={() => setAction("")}
                  >
                    Quay lại
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </State>
    </Modal>
  );
}

export function Seller(props) {
  const {
    api,
    activeUser,
    signIn,
    mode,
    session,
    refresh,
    reload,
    notice,
    navigate,
  } = props;
  const [tab, setTab] = useState("products");
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState(null);
  const [selectedLive, setSelectedLive] = useState(null);
  const products = useData(
    api,
    activeUser && tab === "products" ? "/api/products" : null,
    { seller_id: activeUser?.user_id, page, page_size: pageSize },
    refresh,
  );
  const lives = useData(
    api,
    activeUser && tab === "lives" ? "/api/livestreams" : null,
    {
      seller_id: activeUser?.user_id,
      status: "all",
      page,
      page_size: pageSize,
    },
    refresh,
  );
  const done = (message, liveId) => {
    setEditor(null);
    notice(message);
    reload();
    if (liveId) navigate("live", liveId);
  };
  function switchTab(next) {
    setTab(next);
    setPage(1);
    setSelectedLive(null);
  }
  return (
    <>
      <div className="page-heading">
        <div className="page-kicker">
          <Store size={18} /> KÊNH NGƯỜI BÁN
        </div>
        <h1>Quản lý cửa hàng</h1>
        <p>Quản lý sản phẩm, kho, phiên live và đơn bán ngoài live.</p>
      </div>
      {!activeUser ? (
        <LoginPrompt signIn={signIn} />
      ) : (
        <>
          <div className="seller-tabs">
            <div className="tabs" aria-label="Khu vực người bán">
              {[
                ["products", "Sản phẩm"],
                ["lives", "Phiên live"],
                ["sales", "Đơn ngoài live"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  aria-pressed={tab === key}
                  onClick={() => switchTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>
            {tab !== "sales" && (
              <button
                className="button primary"
                onClick={() =>
                  setEditor({
                    kind: tab === "products" ? "product" : "create_live",
                  })
                }
              >
                <Plus size={18} />
                {tab === "products" ? "Thêm sản phẩm" : "Tạo phiên live"}
              </button>
            )}
          </div>
          {tab === "products" && (
            <section className="content-section">
              <State
                {...products}
                empty={!products.data?.data.length && "Bạn chưa có sản phẩm."}
                retry={reload}
              >
                <div className="rows">
                  {products.data?.data.map((p) => (
                    <article className="seller-row" key={p.id}>
                      <div className="mini-photo">
                        <Picture src={p.image_url} />
                      </div>
                      <div className="row-main">
                        <strong>{p.name}</strong>
                        <span>
                          {money(p.price)} · Kho {p.stock_quantity}
                        </span>
                      </div>
                      <div className="inline-actions">
                        <button
                          className="button secondary"
                          onClick={() =>
                            setEditor({ kind: "stock", product: p })
                          }
                        >
                          Điều chỉnh kho
                        </button>
                        <button
                          className="button secondary"
                          onClick={() =>
                            setEditor({ kind: "product", product: p })
                          }
                        >
                          Sửa
                        </button>
                        <button
                          className="button danger"
                          onClick={() =>
                            setEditor({ kind: "delete", product: p })
                          }
                        >
                          Xóa
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
                <Pagination result={products.data} onChange={setPage} />
              </State>
            </section>
          )}
          {tab === "lives" && (
            <section className="content-section">
              <State
                {...lives}
                empty={!lives.data?.data.length && "Bạn chưa có phiên live."}
                retry={reload}
              >
                <div className="rows">
                  {lives.data?.data.map((live) => (
                    <article className="seller-row" key={live.id}>
                      <div className="section-icon">
                        <Radio size={20} />
                      </div>
                      <div className="row-main">
                        <strong>{live.title}</strong>
                        <span>
                          {live.status === "start" ? "Đang mở" : "Đã kết thúc"}{" "}
                          · {date(live.started_at)}
                        </span>
                      </div>
                      <div className="inline-actions">
                        <button
                          className="button secondary"
                          onClick={() => navigate("live", live.id)}
                        >
                          Xem
                        </button>
                        <button
                          className="button secondary"
                          onClick={() => setSelectedLive(live)}
                        >
                          Sản phẩm
                        </button>
                        {live.status === "start" && (
                          <button
                            className="button danger"
                            onClick={() =>
                              setEditor({ kind: "end_live", live })
                            }
                          >
                            Kết thúc
                          </button>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
                <Pagination result={lives.data} onChange={setPage} />
              </State>
            </section>
          )}
          {tab === "sales" && <Orders {...props} seller />}
        </>
      )}
      {editor && (
        <SellerEditor
          {...{ editor, api, mode, session, done }}
          close={() => setEditor(null)}
        />
      )}
      {selectedLive && (
        <LiveInventory
          {...{ api, refresh, reload, activeUser, notice }}
          live={selectedLive}
          close={() => setSelectedLive(null)}
        />
      )}
    </>
  );
}

function SellerEditor({ editor, api, mode, session, close, done }) {
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const { kind, product, live } = editor;
  const path = `/api/products${product ? `/${product.id}` : ""}`;
  const title = {
    product: product ? "Sửa sản phẩm" : "Thêm sản phẩm",
    stock: "Điều chỉnh kho",
    delete: "Xóa sản phẩm",
    create_live: "Tạo phiên live",
    end_live: "Kết thúc phiên live",
  }[kind];
  async function submit(event) {
    event.preventDefault();
    setError("");
    setWorking(true);
    const form = new FormData(event.currentTarget);
    try {
      let openedLiveId;
      let mediaClosed = true;
      if (kind === "product") {
        const body = {
          name: form.get("name").trim(),
          price: Number(form.get("price")),
          image_url: form.get("image_url").trim(),
          description: form.get("description").trim(),
        };
        if (!body.name) throw new Error("Nhập tên sản phẩm.");
        if (!product) body.stock_quantity = Number(form.get("stock_quantity"));
        await api(path, { method: product ? "PATCH" : "POST", body });
      } else if (kind === "stock") {
        const delta = Number(form.get("delta"));
        if (!delta) throw new Error("Nhập số lượng khác 0.");
        await api(`${path}/stock`, {
          method: "POST",
          body: { quantity_delta: delta },
        });
      } else if (kind === "delete") await api(path, { method: "DELETE" });
      else if (kind === "end_live" && mode === "api") {
        const result = await api(`/api/livestreams/${live.id}/end`, {
          method: "POST",
        });
        mediaClosed = result.media_closed;
      } else {
        const content = live?.id || form.get("title").trim();
        if (!content) throw new Error("Nhập tiêu đề live.");
        const result = await liveCommand(mode, session?.token, kind, content);
        if (kind === "create_live") openedLiveId = result.id;
      }
      done(
        {
          product: "Đã lưu sản phẩm.",
          stock: "Đã cập nhật tồn kho.",
          delete: "Đã xóa sản phẩm.",
          create_live: "Đã tạo phiên live.",
          end_live: mediaClosed
            ? "Đã kết thúc phiên live."
            : "Phiên đã kết thúc. LiveKit chưa xác nhận đóng phòng video.",
        }[kind],
        openedLiveId,
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  }
  return (
    <Modal title={title} close={working ? () => {} : close}>
      <form className="stack-form" onSubmit={submit}>
        {kind === "product" && (
          <>
            <label>
              Tên sản phẩm
              <input
                name="name"
                defaultValue={product?.name}
                required
                maxLength={255}
              />
            </label>
            <label>
              Giá (₫)
              <input
                name="price"
                type="number"
                min="0"
                max="99999999.99"
                step="0.01"
                defaultValue={product?.price}
                required
              />
            </label>
            {!product && (
              <label>
                Tồn kho ban đầu
                <input
                  name="stock_quantity"
                  type="number"
                  min="0"
                  max="2147483647"
                  defaultValue="0"
                  required
                />
              </label>
            )}
            <label>
              Đường dẫn ảnh
              <input
                name="image_url"
                defaultValue={product?.image_url}
                maxLength={255}
                placeholder="https://…"
              />
            </label>
            <label>
              Mô tả
              <textarea
                name="description"
                defaultValue={product?.description}
                maxLength={255}
                rows={3}
              />
            </label>
          </>
        )}
        {kind === "stock" && (
          <label>
            Số lượng cộng hoặc trừ
            <input
              type="number"
              name="delta"
              step="1"
              min={-product.stock_quantity}
              max="2147483647"
              placeholder="Ví dụ 5 hoặc -2"
              required
            />
          </label>
        )}
        {kind === "delete" && <p>Xác nhận xóa {product.name}?</p>}
        {kind === "create_live" && (
          <label>
            Tiêu đề live
            <input name="title" maxLength={255} required />
          </label>
        )}
        {kind === "end_live" && (
          <p>
            Kết thúc phiên “{live.title}” và trả hàng chưa bán về kho thường?
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary" disabled={working}>
          {working ? "Đang xử lý…" : "Xác nhận"}
        </button>
      </form>
    </Modal>
  );
}

function LiveInventory({
  api,
  live,
  activeUser,
  refresh,
  reload,
  close,
  notice,
}) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [productSearch, setProductSearch] = useState("");
  const [productId, setProductId] = useState("");
  const path = `/api/livestreams/${live.id}/products`;
  const items = useData(api, path, { page, page_size: pageSize }, refresh);
  const stock = useData(
    api,
    live.status === "start" ? "/api/products" : null,
    {
      seller_id: activeUser.user_id,
      in_stock: true,
      q: productSearch,
      page_size: 100,
    },
    refresh,
  );
  const selected = stock.data?.data.find((product) => product.id === productId);
  async function update(method, item, body) {
    setWorking(true);
    setError("");
    try {
      await api(item ? `${path}/${item.product_id}` : path, { method, body });
      reload();
      notice(
        method === "POST"
          ? "Đã thêm sản phẩm vào live."
          : "Đã gỡ sản phẩm khỏi live.",
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  }
  return (
    <Modal title="Sản phẩm trong live" close={working ? () => {} : close}>
      <State
        {...items}
        empty={!items.data?.data.length && "Chưa có sản phẩm trong phiên."}
        retry={reload}
      >
        <div className="line-items">
          {items.data?.data.map((item) => (
            <div className="inventory-item" key={item.id}>
              <div className="checkout-product">
                <div className="mini-photo">
                  <Picture src={item.image_url} />
                </div>
                <div>
                  <strong>{item.name}</strong>
                  <span>
                    {money(item.discount_price)} · Kho {item.stock_quantity}
                  </span>
                </div>
              </div>
              <button
                className="button danger"
                disabled={working}
                onClick={() => update("DELETE", item)}
              >
                Gỡ
              </button>
            </div>
          ))}
        </div>
        <Pagination result={items.data} onChange={setPage} />
      </State>
      {live.status === "start" && (
        <>
          <SearchBox
            placeholder="Tìm trong kho của bạn…"
            value={productSearch}
            onSearch={(value) => {
              setProductSearch(value);
              setProductId("");
            }}
          />
          <form
            className="stack-form inventory-form"
            onSubmit={(event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              update("POST", null, {
                product_id: productId,
                discount_price: Number(form.get("price")),
                stock_quantity: Number(form.get("stock")),
                is_pinned: form.has("pin"),
              });
            }}
          >
            <label>
              Sản phẩm
              <select
                required
                value={productId}
                onChange={(event) => setProductId(event.target.value)}
              >
                <option value="">
                  {stock.loading ? "Đang tải…" : "Chọn sản phẩm"}
                </option>
                {stock.data?.data.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · còn {p.stock_quantity}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-columns">
              <label>
                Giá trong live
                <input
                  type="number"
                  name="price"
                  min="0"
                  max="99999999.99"
                  step="0.01"
                  required
                />
              </label>
              <label>
                Số lượng
                <input
                  type="number"
                  name="stock"
                  min="1"
                  max={selected?.stock_quantity}
                  required
                />
              </label>
            </div>
            <label className="checkbox">
              <input name="pin" type="checkbox" /> Ghim sản phẩm
            </label>
            <button className="button primary" disabled={working || !selected}>
              Thêm vào live
            </button>
          </form>
          {stock.error && (
            <p className="form-error" role="alert">
              {stock.error.message}
            </p>
          )}
        </>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
