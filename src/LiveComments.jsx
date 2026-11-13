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

export function LiveComments({ api, live, activeUser, withAccount, onEnded }) {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [readError, setReadError] = useState("");
  const [sendError, setSendError] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const feed = useRef(null);
  const stickToBottom = useRef(true);
  const path = `/api/livestreams/${live.id}/comments`;

  useEffect(() => {
    if (!activeUser) {
      setComments([]);
      setReadError("");
      return;
    }
    const controller = new AbortController();
    let timer;
    let cursor = "0";
    setLoading(true);
    setReadError("");
    async function read() {
      let nextDelay = 2500;
      try {
        const result = await api(path, {
          query: { after: cursor },
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        cursor = result.next_cursor;
        setReadError("");
        if (result.data.length)
          setComments((previous) => appendComments(previous, result.data));
        if (result.has_more) nextDelay = 0;
      } catch (error) {
        if (controller.signal.aborted) return;
        setReadError(error.message);
        nextDelay = 5000;
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          if (live.status === "start") timer = setTimeout(read, nextDelay);
        }
      }
    }
    void read();
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [api, path, activeUser, live.status]);

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
