const host = "ngocanh";
const now = Date.now();
const timestamp = (minutes) => new Date(now - minutes * 60000).toISOString();

export const sampleLives = [
  ["beauty", "Routine chăm da tối giản", "Ngọc Anh Studio", 12, "Làm đẹp"],
  ["tech", "Góc công nghệ cuối tuần", "Tech cùng Minh", 24, "Công nghệ"],
  ["coffee", "Pha cà phê cùng An", "An Coffee Lab", 35, "Lifestyle"],
  ["style", "Phối đồ cho ngày mới", "Mây Closet", 48, "Thời trang"],
  ["replay", "Chuyện chăm da mùa lạnh", "Ngọc Anh Studio", 1440, "Làm đẹp"],
].map(([id, title, seller_username, minutes, category]) => ({
  id,
  title,
  seller_username,
  category,
  seller_id: id === "beauty" || id === "replay" ? host : id,
  status: id === "replay" ? "end" : "start",
  started_at: timestamp(minutes),
  ended_at: id === "replay" ? timestamp(1380) : null,
  image: `/images/${id === "replay" ? "beauty" : id}.webp`,
}));

export const sampleProducts = [
  [
    "cream",
    "Kem dưỡng ẩm dịu nhẹ",
    189000,
    18,
    "Kem dưỡng kết cấu mỏng nhẹ, phù hợp cho chu trình chăm da hằng ngày.",
    "beauty",
    host,
  ],
  [
    "headphones",
    "Tai nghe chụp tai không dây",
    529000,
    14,
    "Thiết kế gọn nhẹ, đệm tai mềm cho lúc làm việc hoặc thư giãn.",
    "tech",
    "tech",
  ],
  [
    "beans",
    "Cà phê rang mộc 250 g",
    149000,
    32,
    "Hạt cà phê rang vừa, hợp pha phin hoặc pour over.",
    "coffee",
    "coffee",
  ],
  [
    "shirt",
    "Áo sơ mi phom rộng",
    249000,
    11,
    "Phom rộng thoải mái, dễ phối cùng quần jeans hoặc chân váy.",
    "style",
    "style",
  ],
].map(([id, name, price, stock_quantity, description, photo, seller_id]) => ({
  id,
  name,
  price,
  stock_quantity,
  description,
  seller_id,
  image_url: `/images/product-${photo}.webp`,
  created_at: timestamp(180),
}));

export const demoUser = { user_id: host, username: "Ngọc Anh" };
const storage = "livemart-demo-v1";
function data() {
  try {
    return JSON.parse(sessionStorage.getItem(storage)) || freshData();
  } catch {
    return freshData();
  }
}
function freshData() {
  return {
    products: sampleProducts,
    lives: sampleLives,
    orders: [],
    allocations: Object.fromEntries(
      sampleProducts.map((p, i) => [
        sampleLives[i].id,
        [
          {
            id: `live-${p.id}`,
            product_id: p.id,
            name: p.name,
            image_url: p.image_url,
            description: p.description,
            original_price: p.price,
            discount_price: Math.round(p.price * 0.85),
            stock_quantity: 5,
            is_pinned: true,
          },
        ],
      ]),
    ),
  };
}
const store = (state) => sessionStorage.setItem(storage, JSON.stringify(state));
const matches = (text, q) =>
  text
    .toLocaleLowerCase("vi")
    .includes((q || "").trim().toLocaleLowerCase("vi"));
function page(rows, query) {
  const number = Number(query.page || 1),
    size = Number(query.page_size || 20);
  return {
    data: rows.slice((number - 1) * size, number * size),
    total: rows.length,
    page: number,
    page_size: size,
  };
}
function get(rows, id) {
  const item = rows.find((entry) => entry.id === id);
  if (!item) throw new Error("Không tìm thấy dữ liệu.");
  return item;
}
function id() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `sample-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

export function demoRequest(
  path,
  { query = {}, method = "GET", body = {} } = {},
) {
  const state = data();
  const [, , area, key, action, productId] = path.split("/");
  const { products, lives, orders, allocations } = state;
  if (area === "products") {
    if (method === "GET" && key) return get(products, key);
    if (method === "GET")
      return page(
        products.filter(
          (p) =>
            matches(p.name, query.q) &&
            (!query.seller_id || p.seller_id === query.seller_id) &&
            (!query.in_stock || p.stock_quantity > 0),
        ),
        query,
      );
    if (method === "POST" && !key) {
      const product = {
        ...body,
        id: id(),
        seller_id: host,
        created_at: timestamp(0),
      };
      products.unshift(product);
      store(state);
      return product;
    }
    const product = get(products, key);
    if (method === "DELETE") {
      if (
        orders.some((order) =>
          order.items.some((line) => line.product_id === key),
        ) ||
        Object.values(allocations).some((items) =>
          items.some((item) => item.product_id === key),
        )
      )
        throw new Error("Sản phẩm đang được sử dụng.");
      state.products = products.filter((p) => p.id !== key);
      store(state);
      return null;
    }
    if (action === "stock") {
      if (product.stock_quantity + body.quantity_delta < 0)
        throw new Error("Kho không đủ hàng.");
      product.stock_quantity += body.quantity_delta;
    } else Object.assign(product, body);
    store(state);
    return product;
  }
  if (area === "livestreams") {
    if (!key) {
      const status = query.status || "start";
      const rows = lives.filter(
        (live) =>
          (status === "all" || live.status === status) &&
          matches(live.title, query.q) &&
          (!query.seller_id || live.seller_id === query.seller_id) &&
            (!query.product_id ||
              allocations[live.id]?.some(
                (p) =>
                  p.product_id === query.product_id &&
                  (live.status !== "start" || p.status !== "removed"),
              )),
      );
      if (query.sort === "oldest") rows.reverse();
      return page(rows, query);
    }
    const live = get(lives, key);
    if (!action) return live;
    if (action === "comments") {
      state.comments ??= {};
      const comments = (state.comments[key] ??= []);
      if (method === "GET") {
        const after = Number(query.after || 0);
        const unread = after
          ? comments.filter((comment) => Number(comment.id) > after)
          : comments.slice(-50);
        const result = unread.slice(0, 50);
        return {
          data: result,
          next_cursor: result.at(-1)?.id ?? String(after),
          has_more: unread.length > 50,
        };
      }
      if (live.status !== "start") throw new Error("Phiên live đã kết thúc.");
      const content = body.content.trim();
      if (!content || [...content].length > 300)
        throw new Error("Nhập bình luận từ 1 đến 300 ký tự.");
      const comment = {
        id: String(comments.length + 1),
        username: demoUser.username,
        content,
        created_at: new Date().toISOString(),
      };
      comments.push(comment);
      store(state);
      return comment;
    }
    const items = allocations[key] ?? [];
    if (method === "GET")
      return page(
        [...items].sort(
          (a, b) =>
            Number(a.status === "removed") - Number(b.status === "removed") ||
            Number(b.is_pinned) - Number(a.is_pinned),
        ),
        query,
      );
    if (live.status !== "start")
      throw Object.assign(new Error("Phiên live đã kết thúc."), { status: 409 });
    const product = get(products, productId || body.product_id);
    const selling = items.find(
      (entry) => entry.product_id === product.id && entry.status !== "removed",
    );
    if (method === "DELETE") {
      if (!selling) throw new Error("Không tìm thấy sản phẩm trong live.");
      if (
        orders.some(
          (order) =>
            order.livestream_id === key &&
            ["pending", "paid"].includes(order.status) &&
            order.items.some((line) => line.product_id === productId),
        )
      )
        throw new Error("Sản phẩm còn đơn đang xử lý.");
      product.stock_quantity += selling.stock_quantity;
      selling.stock_quantity = 0;
      selling.status = "removed";
      store(state);
      return null;
    }
    if (selling) throw new Error("Sản phẩm đã có trong live.");
    if (product.stock_quantity < body.stock_quantity)
      throw new Error("Kho không đủ hàng.");
    product.stock_quantity -= body.stock_quantity;
    allocations[key] = [
      ...items,
      {
        ...body,
        id: id(),
        name: product.name,
        image_url: product.image_url,
        description: product.description,
        original_price: product.price,
        status: "active",
      },
    ];
    store(state);
    return null;
  }
  if (area === "orders" || area === "sales") {
    const rows =
      area === "sales"
        ? orders.filter((o) => !o.livestream_id && o.seller_id === host)
        : orders;
    const orderId = area === "sales" ? action : key;
    if (method === "GET" && orderId) return get(rows, orderId);
    if (method === "GET")
      return page(
        rows.filter(
          (o) =>
            (!query.status || o.status === query.status) &&
            (!query.channel ||
              query.channel === (o.livestream_id ? "live" : "offline")),
        ),
        query,
      );
    if (!key) {
      const product = get(products, body.product_id);
      const live = body.livestream_id ? get(lives, body.livestream_id) : null;
      if (live && live.status !== "start") throw new Error("Live đã kết thúc.");
      const item = live
        ? (allocations[live.id] || []).find(
            (entry) =>
              entry.product_id === product.id && entry.status !== "removed",
          )
        : product;
      if (!item || item.stock_quantity < body.quantity)
        throw new Error("Kho không đủ hàng.");
      item.stock_quantity -= body.quantity;
      const price = live ? item.discount_price : product.price;
      const order = {
        id: id(),
        seller_id: product.seller_id,
        livestream_id: live?.id ?? null,
        total_amount: price * body.quantity,
        status: "pending",
        created_at: timestamp(0),
        items: [
          {
            product_id: product.id,
            name: product.name,
            image_url: product.image_url,
            quantity: body.quantity,
            price_at_purchase: price,
          },
        ],
        payment: {
          amount: price * body.quantity,
          payment_method: body.payment_method,
          status: "pending",
        },
      };
      orders.unshift(order);
      store(state);
      return { ...order, order_id: order.id };
    }
    const order = get(orders, key);
    const transitions = {
      pay: ["pending", "paid"],
      cancel: ["pending", "cancelled"],
      refund: ["paid", "refunded"],
    };
    const [from, to] = transitions[action];
    if (order.status !== from) throw new Error("Trạng thái đơn đã thay đổi.");
    order.status = to;
    order.payment.status = to;
    if (action === "refund") order.refund_reason = body.refund_reason;
    if (action !== "pay") {
      const live = lives.find((entry) => entry.id === order.livestream_id);
      for (const line of order.items) {
        const inventory =
          live?.status === "start"
            ? allocations[live.id].find(
                (entry) =>
                  entry.product_id === line.product_id && entry.status !== "removed",
              )
            : get(products, line.product_id);
        inventory.stock_quantity += line.quantity;
      }
    }
    store(state);
    return order;
  }
  return { status: "success" };
}

export function demoLiveCommand(type, content) {
  const state = data();
  if (type === "create_live") {
    const live = {
      id: id(),
      title: content,
      seller_id: host,
      seller_username: demoUser.username,
      status: "start",
      started_at: timestamp(0),
      ended_at: null,
    };
    state.lives.unshift(live);
    store(state);
    return live;
  }
  const live = get(state.lives, content);
  if (type === "join_live" && live.status !== "start")
    throw new Error("Live đã kết thúc.");
  if (type === "end_live" && live.status === "start") {
    live.status = "end";
    live.ended_at = timestamp(0);
    for (const item of state.allocations[live.id] || []) {
      if (item.status === "removed") continue;
      get(state.products, item.product_id).stock_quantity +=
        item.stock_quantity;
      item.stock_quantity = 0;
      item.status = "closed";
    }
    store(state);
  }
  return live;
}
