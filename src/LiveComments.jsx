import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send } from "lucide-react";

const timestamp = new Intl.DateTimeFormat("vi-VN", { timeStyle: "short" });

function appendComments(previous, incoming) {
  const byId = new Map(previous.map((comment) => [comment.id, comment]));
  for (const comment of incoming) byId.set(comment.id, comment);
  return [...byId.values()]
    .sort((a, b) => a.id.length - b.id.length || a.id.localeCompare(b.id))
    .slice(-100);
}

export function LiveComments({
  api,
  live,
  activeUser,
  withAccount,
  onEnded,
  visible = true,
}) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState("");
  const [sendError, setSendError] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const feed = useRef(null);
  const stickToBottom = useRef(true);


  useEffect(() => {
    if (!activeUser) {
      setComments([]);
      setReadError("");
      return;
    }
    let active = true;
    let checkpoint = "0";
    setComments([]); setLoading(true); setReadError("");
    const stop = api.subscribe("comments.subscribe", () => ({ livestream_id: live.id, after: checkpoint }), {
      onData: (result) => {
        if (!active) return;
        checkpoint = result.next_cursor;
        setReadError(""); setLoading(Boolean(result.has_more));
        setComments((previous) => appendComments(previous, result.data || []));
      },
      onEvent: (event) => {
        if (active && event.event === "comment.created") setComments((previous) => appendComments(previous, [event.data]));
      },
      onError: (error) => { if (active) { setReadError(error.message); setLoading(false); } },
    });
    return () => { active = false; stop(); };
  }, [api, live.id, activeUser]);

  useEffect(() => {
    const element = feed.current;
    if (element && stickToBottom.current)
      element.scrollTop = element.scrollHeight;
  }, [comments]);

  async function send(event) {
    event.preventDefault();
    const content = draft.trim();
    if (!content || sending || live.status !== "start") return;
    setSending(true);
    setSendError("");
    try {
      const comment = await api.command("comments.send", { livestream_id: live.id, content });
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
    <section
      className={`live-comments ${visible ? "" : "comments-hidden"}`}
      aria-label="Bình luận trong live"
    >
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
              <p className="comment-welcome">
                Chào mừng bạn đến với phòng live.
                <br />
                Bắt đầu câu chuyện bằng một lời chào nhé!
              </p>
            )}
            {comments.map((comment) => (
              <div className="live-comment" key={comment.id}>
                <span className="comment-avatar" aria-hidden="true">
                  {Array.from(comment.username || "?")[0].toUpperCase()}
                </span>
                <div className="comment-message">
                  <div>
                    <strong>{comment.username}</strong>
                    <time dateTime={comment.created_at}>
                      {timestamp.format(new Date(comment.created_at))}
                    </time>
                  </div>
                  <p>{comment.content}</p>
                </div>
              </div>
            ))}
          </div>
          {readError && (
            <p className="form-error" role="alert">
              {readError}
            </p>
          )}
          {live.status === "start" ? (
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
                disabled={sending || !draft.trim()}
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
