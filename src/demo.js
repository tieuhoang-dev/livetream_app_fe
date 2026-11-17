import provinces from "./provinces.json";
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
    comments: Object.fromEntries(
      sampleLives.map((live) => [
        live.id,
        [
          {
            id: "1",
            username: "Minh Anh",
            content: "Chào cả nhà, hôm nay có món gì mới không ạ? 👋",
            created_at: timestamp(3),
          },
          {
            id: "2",
            username: "Thu Phương",
            content: "Món đang ghim nhìn xinh quá!",
            created_at: timestamp(2),
          },
          {
            id: "3",
            username: "Hoàng Nam",
            content: "Shop giới thiệu kỹ hơn giúp mình với nhé.",
            created_at: timestamp(1),
          },
          {
            id: "4",
            username: "Khánh Linh",
            content: "Mình vừa vào, chào mọi người 🫶",
            created_at: timestamp(0),
          },
        ],
      ]),
    ),
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
const store = (state) => {
  sessionStorage.setItem(storage, JSON.stringify(state));
  window.dispatchEvent(new Event("livemart-demo-change"));
};
export function subscribeDemoLives(query, { onData, onError }) {
  const read = () => {
    try { onData(demoRequest("/api/livestreams", { query })); }
    catch (error) { onError(error); }
  };
  window.addEventListener("livemart-demo-change", read);
  read();
  return () => window.removeEventListener("livemart-demo-change", read);
}
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
  if (area === "delivery" && key === "reverse-geocode") throw new Error("Tự điền địa chỉ từ GPS cần kết nối backend. Trong bản mẫu, hãy chọn Nhập địa chỉ.");
  state.shipping ??= Object.fromEntries([...new Set(products.map((product) => product.seller_id))].map((seller) => [seller, {
    pickup_address: { name: "Shop dữ liệu mẫu", phone: "0900000000", province_code: "1", province_name: provinces.find((p) => p.code === "1").name, ward: "Phường mẫu", address_line: "Địa chỉ shop mẫu", latitude: null, longitude: null },
    same_province_fee: 25000, other_province_fee: 40000, free_shipping_from: null,
  }]));
  if (area === "sales" && key === "shipping-settings") {
    if (method === "GET") return { configured: Boolean(state.shipping[host]), settings: state.shipping[host] || null };
    state.shipping[host] = { ...body, pickup_address: { ...body.pickup_address, province_name: provinces.find((p) => p.code === body.pickup_address.province_code)?.name } };
    store(state);
    return { configured: true, settings: state.shipping[host] };
  }
  if (area === "orders" && key === "quote") return demoQuote(state, body);

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
              (p) => p.product_id === query.product_id,
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
        [...items].sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned)),
        query,
      );
    const product = get(products, productId || body.product_id);
    if (method === "DELETE") {
      const item = items.find((entry) => entry.product_id === productId);
      if (!item) throw new Error("Không tìm thấy sản phẩm trong live.");
      if (
        orders.some(
          (order) =>
            order.livestream_id === key &&
            ["pending", "paid"].includes(order.status) &&
            order.items.some((line) => line.product_id === productId),
        )
      )
        throw new Error("Sản phẩm còn đơn đang xử lý.");
      product.stock_quantity += item.stock_quantity;
      allocations[key] = items.filter((entry) => entry !== item);
      store(state);
      return null;
    }
    if (items.some((entry) => entry.product_id === product.id))
      throw new Error("Sản phẩm đã có trong live.");
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
      },
    ];
    store(state);
    return null;
  }
  if (area === "orders" || area === "sales") {
    const rows =
      area === "sales"
        ? orders.filter(
            (o) =>
              o.seller_id === host &&
              (key === "offline" ? !o.livestream_id : o.buyer_id !== host),
          )
        : orders.filter((o) => !o.buyer_id || o.buyer_id === host);
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
    if (area === "orders" && !key) {
      const previous = orders.find((order) => body.request_id && order.request_id === body.request_id);
      if (previous) return { ...previous, order_id: previous.id };
      const quote = demoQuote(state, body);
      if (body.expected_total != null && Math.round(body.expected_total * 100) !== Math.round(quote.total_amount * 100)) {
        const error = new Error("Giá hoặc phí ship vừa thay đổi. Hãy xác nhận lại.");
        error.code = "checkout_changed";
        throw error;
      }
      const product = get(products, body.product_id);
      const live = body.livestream_id ? get(lives, body.livestream_id) : null;
      const item = live ? (allocations[live.id] || []).find((entry) => entry.product_id === product.id) : product;
      const price = quote.unit_price;
      item.stock_quantity -= body.quantity;
      const order = {
        id: id(),
        buyer_id: host,
        seller_id: product.seller_id,
        livestream_id: live?.id ?? null,
        total_amount: quote.total_amount,
        items_subtotal: quote.items_subtotal,
        shipping_fee: quote.shipping_fee,
        request_id: body.request_id,
        delivery: {
          recipient: { ...body.delivery, province_name: provinces.find((p) => p.code === body.delivery.province_code)?.name },
          pickup: { ...state.shipping[product.seller_id].pickup_address }, note: body.note || "",
        },
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
          amount: quote.total_amount,
          payment_method: body.payment_method,
          status: "pending",
        },
      };
      orders.unshift(order);
      store(state);
      return { ...order, order_id: order.id };
    }
    const command = area === "sales" ? productId : action;
    if (
      (area === "orders" && command !== "cancel") ||
      (area === "sales" &&
        (key !== "orders" || !["pay", "refund"].includes(command)))
    )
      throw new Error("Bạn không có quyền thực hiện thao tác này.");
    const order = get(rows, orderId);
    const transitions = {
      pay: ["pending", "paid"],
      cancel: ["pending", "cancelled"],
      refund: ["paid", "refunded"],
    };
    const [from, to] = transitions[command];
    if (order.status !== from) throw new Error("Trạng thái đơn đã thay đổi.");
    if (command === "refund" && !body.refund_reason?.trim())
      throw new Error("Hãy nhập lý do hoàn tiền.");
    order.status = to;
    order.payment.status = to;
    if (command === "pay") order.payment.payment_method = body.payment_method;
    if (command === "refund") order.refund_reason = body.refund_reason.trim();
    if (command !== "pay") {
      const live = lives.find((entry) => entry.id === order.livestream_id);
      for (const line of order.items) {
        const inventory =
          live?.status === "start"
            ? allocations[live.id].find(
                (entry) => entry.product_id === line.product_id,
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
      get(state.products, item.product_id).stock_quantity +=
        item.stock_quantity;
      item.stock_quantity = 0;
    }
    store(state);
  }
  return live;
}


function demoQuote(state, body) {
  if (!body.delivery?.name || !body.delivery.phone || !body.delivery.province_code || !body.delivery.ward || !body.delivery.address_line)
    throw new Error("Điền đầy đủ thông tin nhận hàng.");
  const product = get(state.products, body.product_id);
  const live = body.livestream_id ? get(state.lives, body.livestream_id) : null;
  if (live && live.status !== "start") throw new Error("Live đã kết thúc.");
  if (product.seller_id === host) throw new Error("Bạn không thể đặt mua sản phẩm của chính mình.");
  const item = live ? (state.allocations[live.id] || []).find((entry) => entry.product_id === product.id) : product;
  if (!item || item.stock_quantity < body.quantity) throw new Error("Kho không đủ hàng.");
  const settings = state.shipping[product.seller_id];
  if (!settings) throw new Error("Shop chưa thiết lập địa chỉ lấy hàng và phí giao hàng.");
  const unit = live ? item.discount_price : product.price;
  const subtotal = Math.round(unit * body.quantity * 100) / 100;
  const local = settings.pickup_address.province_code === body.delivery.province_code;
  let fee = local ? settings.same_province_fee : settings.other_province_fee;
  let zone = local ? "same_province" : "other_province";
  if (settings.free_shipping_from != null && subtotal >= settings.free_shipping_from) { fee = 0; zone = "free"; }
  return { unit_price: unit, quantity: body.quantity, items_subtotal: subtotal, shipping_fee: fee, total_amount: subtotal + fee, currency: "VND", shipping_zone: zone, pickup_province: settings.pickup_address.province_name };
}
