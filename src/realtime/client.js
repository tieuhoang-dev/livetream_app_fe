// One transport per API session. Domain code supplies commands/subscriptions;
// it never creates sockets, reconnect loops, or polling timers.
export class RealtimeClient {
  constructor(url, { token, error } = {}) {
    this.url = url; this.token = token; this.error = error || ((code, status) => Object.assign(new Error(code), { code, status }));
    this.pending = new Map(); this.subscriptions = new Map(); this.sequence = 0; this.delay = 500; this.closed = false; this.ready = false;
  }
  nextID(prefix = "r") { return `${prefix}-${++this.sequence}`; }
  request(type, payload = {}, { signal, subscriptionID } = {}) {
    if (signal?.aborted || this.closed) return Promise.reject(new DOMException("Đã hủy yêu cầu", "AbortError"));
    const requestID = this.nextID();
    return new Promise((resolve, reject) => {
      const finish = (err, data) => {
        const item = this.pending.get(requestID); if (!item) return;
        clearTimeout(item.timer); signal?.removeEventListener("abort", item.abort); this.pending.delete(requestID);
        if (err) reject(err); else resolve(data);
      };
      const item = { frame: { type, request_id: requestID, payload, ...(subscriptionID ? { subscription_id: subscriptionID } : {}) }, sent: false, finish,
        abort: () => finish(new DOMException("Đã hủy yêu cầu", "AbortError")) };
      item.timer = setTimeout(() => finish(this.error("realtime_timeout", 504)), 22000);
      signal?.addEventListener("abort", item.abort, { once: true }); this.pending.set(requestID, item);
      this.connect(); this.flush();
    });
  }
  subscribe(type, payload, callbacks) {
    const id = this.nextID("s"); const sub = { id, type, payload, ...callbacks };
    this.subscriptions.set(id, sub); this.connect(); if (this.ready) this.activate(sub);
    return () => {
      this.subscriptions.delete(id);
      if (this.ready) void this.request("unsubscribe", {}, { subscriptionID: id }).catch(() => {});
    };
  }
  activate(sub) {
    if (!this.subscriptions.has(sub.id)) return;
    const payload = typeof sub.payload === "function" ? sub.payload() : sub.payload;
    void this.request(sub.type, payload, { subscriptionID: sub.id }).catch((err) => {
      if (this.subscriptions.has(sub.id) && !this.closed) sub.onError?.(err);
    });
  }
  flush() {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
    for (const item of this.pending.values()) {
      if (!item.sent && (this.ready || item.frame.type === "authenticate")) {
        item.sent = true; this.socket.send(JSON.stringify(item.frame));
      }
    }
  }
  connect() {
    if (this.closed || this.socket || this.reconnectTimer) return;
    let socket;
    try { socket = new WebSocket(this.url); } catch { this.disconnected(); return; }
    this.socket = socket;
    this.connectTimer = setTimeout(() => { if (this.socket === socket) socket.close(); }, 8000);
    socket.onopen = async () => {
      try {
        if (this.token) await this.request("authenticate", { token: this.token });
        if (this.socket !== socket || this.closed) return;
        clearTimeout(this.connectTimer); this.ready = true; this.delay = 500; this.flush();
        for (const sub of this.subscriptions.values()) this.activate(sub);
      } catch (err) {
        if (err.status === 401) {
          for (const sub of this.subscriptions.values()) sub.onError?.(err);
          this.closed = true;
        }
        socket.close();
      }
    };
    socket.onmessage = ({ data }) => {
      if (this.socket !== socket || this.closed) return;
      let packet; try { packet = JSON.parse(data); } catch { return; }
      if (packet.type === "result") {
        this.pending.get(packet.request_id)?.finish(packet.error ? this.error(packet.error, packet.status) : null, packet.data);
      } else if (packet.type === "event") {
        const sub = this.subscriptions.get(packet.subscription_id); if (!sub) return;
        if (packet.error) sub.onError?.(this.error(packet.error, packet.status));
        else if (packet.event === "snapshot") sub.onData?.(packet.data);
        else sub.onEvent?.(packet);
      }
    };
    socket.onerror = () => socket.close();
    socket.onclose = () => { if (this.socket === socket) { this.socket = null; this.disconnected(); } };
  }
  disconnected() {
    clearTimeout(this.connectTimer); this.ready = false;
    const err = this.error("realtime_disconnected", 503);
    // Never replay mutations automatically: the server might have committed them.
    for (const item of [...this.pending.values()]) item.finish(err);
    if (this.closed) return;
    for (const sub of this.subscriptions.values()) sub.onError?.(err);
    if (this.subscriptions.size) {
      this.reconnectTimer = setTimeout(() => { this.reconnectTimer = null; this.connect(); }, this.delay);
      this.delay = Math.min(this.delay * 2, 15000);
    }
  }
  close() {
    this.closed = true; clearTimeout(this.connectTimer); clearTimeout(this.reconnectTimer);
    this.subscriptions.clear(); this.socket?.close(); this.socket = null;
    for (const item of [...this.pending.values()]) item.finish(new DOMException("Phiên đã đóng", "AbortError"));
  }
}
