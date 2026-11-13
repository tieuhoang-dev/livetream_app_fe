import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send } from "lucide-react";
import { liveCommentError, openLiveSocket } from "./api";

const timestamp = new Intl.DateTimeFormat("vi-VN", { timeStyle: "short" });
const compareIds = (a, b) => a.length - b.length || a.localeCompare(b);
const sendInterrupted =
  "Chưa nhận được xác nhận gửi. Kiểm tra bình luận trước khi gửi lại.";

function appendComments(previous, incoming) {
  const byId = new Map(previous.map((comment) => [comment.id, comment]));
  for (const comment of incoming) byId.set(comment.id, comment);
  return [...byId.values()]
    .sort((a, b) => compareIds(a.id, b.id))
    .slice(-100);
}

export function LiveComments({
  api,
  live,
  mode,
  token,
  activeUser,
  withAccount,
  onEnded,
}) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState("");
  const [sendError, setSendError] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [connected, setConnected] = useState(false);
  const feed = useRef(null);
  const stickToBottom = useRef(true);
  const socket = useRef(null);
  const pending = useRef(null);
  const cursor = useRef("0");
  const liveId = live.id;
  const isOpen = live.status === "start";
  const path = `/api/livestreams/${live.id}/comments`;

  useEffect(() => {
    if (!activeUser) return;
    let disposed = false;
    let retryTimer;
    let joinTimer;
    let history;
    let retryDelay = 1000;
    setConnected(false);
    setReadError("");

    function clearPending() {
      if (!pending.current) return;
      clearTimeout(pending.current.timer);
      pending.current = null;
      setSending(false);
    }

    async function readHistory(signal) {
      let result;
      do {
        result = await api(path, { query: { after: cursor.current }, signal });
        if (signal.aborted) return;
        cursor.current = result.next_cursor;
        if (result.data.length)
          setComments((previous) => appendComments(previous, result.data));
      } while (result.has_more);
      setLoading(false);
    }

    function retry() {
      setConnected(false);
      setReadError("Mất kết nối bình luận. Đang kết nối lại…");
      if (pending.current) {
        clearPending();
        setSendError(sendInterrupted);
      }
      retryTimer = setTimeout(connect, retryDelay);
      retryDelay = Math.min(retryDelay * 2, 10000);
    }

    function connect() {
      let ws;
      try {
        ws = openLiveSocket(token, "live_comments");
      } catch {
        retry();
        return;
      }
      socket.current = ws;
      let caughtUp = false;
      let latest = cursor.current;
      let joinRejected = false;
      joinTimer = setTimeout(() => ws.close(), 8000);
      ws.onopen = () =>
        ws.send(JSON.stringify({ type: "join_live", content: liveId }));
      ws.onmessage = async ({ data }) => {
        if (disposed || socket.current !== ws) return;
        let message;
        try {
          message = JSON.parse(data);
        } catch {
          return;
        }
        if (message.type === "join_live_success" && message.id === liveId) {
          clearTimeout(joinTimer);
          // Subscribe first so a comment sent during the history fetch arrives too.
          history = new AbortController();
          const { signal } = history;
          try {
            await readHistory(signal);
            if (signal.aborted) return;
            if (compareIds(latest, cursor.current) > 0) cursor.current = latest;
            caughtUp = true;
            retryDelay = 1000;
            setConnected(true);
            setReadError("");
          } catch {
            if (!signal.aborted) ws.close();
          }
        } else if (message.type === "join_live_error") {
          joinRejected = true;
          setReadError(message.error);
          setLoading(false);
          ws.close();
          onEnded();
        } else if (
          message.type === "live_comment" &&
          message.livestream_id === liveId
        ) {
          const { comment } = message;
          if (compareIds(comment.id, latest) > 0) latest = comment.id;
          if (caughtUp && compareIds(latest, cursor.current) > 0)
            cursor.current = latest;
          if (pending.current && message.temp_id === pending.current.id) {
            clearPending();
            stickToBottom.current = true;
            setDraft("");
            setSendError("");
          }
          setComments((previous) => appendComments(previous, [comment]));
        } else if (
          message.type === "live_comment_error" &&
          pending.current &&
          message.temp_id === pending.current.id
        ) {
          clearPending();
          setSendError(liveCommentError(message.error));
          if (message.error === "livestream_not_active") onEnded();
        }
      };
      ws.onclose = () => {
        if (disposed || socket.current !== ws) return;
        clearTimeout(joinTimer);
        history?.abort();
        socket.current = null;
        if (!joinRejected) retry();
      };
    }

    if (mode === "api" && isOpen) {
      connect();
    } else {
      history = new AbortController();
      const { signal } = history;
      readHistory(signal).catch((error) => {
        if (signal.aborted) return;
        setReadError(error.message);
        setLoading(false);
      });
    }
    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      clearTimeout(joinTimer);
      history?.abort();
      const ws = socket.current;
      socket.current = null;
      ws?.close();
      if (pending.current) {
        clearPending();
        setSendError(sendInterrupted);
      }
    };
  }, [api, path, activeUser, isOpen, liveId, mode, onEnded, token]);

  useEffect(() => {
    const element = feed.current;
    if (element && stickToBottom.current)
      element.scrollTop = element.scrollHeight;
  }, [comments]);

  async function send(event) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending || !isOpen) return;
    if (mode === "api") {
      const ws = socket.current;
      if (!connected || ws?.readyState !== WebSocket.OPEN || pending.current)
        return;
      const id = String(performance.now());
      ws.send(JSON.stringify({ type: "live_comment", content, temp_id: id }));
      pending.current = { id, timer: setTimeout(() => ws.close(), 8000) };
      setSending(true);
      setSendError("");
      return;
    }
    setSending(true);
    setSendError("");
    try {
      const comment = await api(path, { method: "POST", body: { content } });
      stickToBottom.current = true;
      setComments((previous) => appendComments(previous, [comment]));
      setDraft("");
    } catch (error) {
      setSendError(error.message);
      if (error.status === 409) onEnded();
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="live-comments" aria-label="Bình luận trong live">
      <h2>
        <MessageCircle size={19} /> Bình luận
      </h2>
      {activeUser ? (
        <>
          <div
            className="comment-feed"
            ref={feed}
            role="log"
            aria-label="Các bình luận"
            onScroll={(event) => {
              const element = event.currentTarget;
              stickToBottom.current =
                element.scrollHeight -
                  element.scrollTop -
                  element.clientHeight <
                32;
            }}
          >
            {loading && !comments.length && <p>Đang tải bình luận…</p>}
            {!loading && !comments.length && !readError && (
              <p>Chưa có bình luận.</p>
            )}
            {comments.map((comment) => (
              <div className="live-comment" key={comment.id}>
                <div>
                  <strong>{comment.username}</strong>
                  <time dateTime={comment.created_at}>
                    {timestamp.format(new Date(comment.created_at))}
                  </time>
                </div>
                <p>{comment.content}</p>
              </div>
            ))}
          </div>
          {readError && (
            <p className="form-error" role="alert">
              {readError}
            </p>
          )}
          {isOpen ? (
            <form className="comment-form" onSubmit={send}>
              <input
                aria-label="Viết bình luận"
                placeholder="Viết bình luận…"
                maxLength={300}
                value={draft}
                disabled={sending}
                onChange={(event) => setDraft(event.target.value)}
              />
              <button
                className="button primary"
                aria-label="Gửi bình luận"
                disabled={
                  sending || !draft.trim() || (mode === "api" && !connected)
                }
              >
                <Send size={17} />
              </button>
            </form>
          ) : (
            <p className="comment-closed">Phiên đã kết thúc.</p>
          )}
          {sendError && (
            <p className="form-error" role="alert">
              {sendError}
            </p>
          )}
        </>
      ) : (
        <button
          className="button secondary"
          onClick={() => withAccount(() => {})}
        >
          Đăng nhập để bình luận
        </button>
      )}
    </section>
  );
}
