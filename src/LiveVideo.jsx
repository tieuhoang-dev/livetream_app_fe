import { useEffect, useRef, useState } from "react";
import {
  CirclePlay,
  Mic,
  MicOff,
  Radio,
  Square,
  Video,
  VideoOff,
  Volume2,
} from "lucide-react";
import { Picture } from "./ui";
import { LivePickupModal } from "./LivePickupModal";

function mediaError(error) {
  switch (error.name) {
    case "NotAllowedError":
      return "Trình duyệt chưa cấp quyền camera hoặc micro.";
    case "NotFoundError":
      return "Không tìm thấy camera hoặc micro.";
    case "NotReadableError":
      return "Không mở được thiết bị. Kiểm tra xem camera hoặc micro có đang được ứng dụng khác sử dụng không.";
    default:
      return error.status
        ? error.message
        : "Không kết nối được video. Kiểm tra LiveKit, camera và kết nối mạng rồi thử lại.";
  }
}

export function LiveVideo({
  api,
  live,
  mode,
  isOwner,
  withAccount,
  onEnded,
  children,
}) {
  const connection = useRef(null);
  const video = useRef(null);
  const audio = useRef(null);
  const [phase, setPhase] = useState("idle");
  const [media, setMedia] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const [pickupOpen, setPickupOpen] = useState(false);
  const [pendingToken, setPendingToken] = useState(null);
  const [pickupFeedback, setPickupFeedback] = useState("");
  const onEndedRef = useRef(onEnded);
  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  function release() {
    const current = connection.current;
    if (!current) return;
    connection.current = null;
    current.abort.abort();
    current.tracks.forEach((track) => track.stop());
    void current.room?.disconnect().catch(() => {});
  }

  useEffect(() => () => release(), []);
  useEffect(() => {
    if (live.status !== "start") {
      setPickupOpen(false);
      release();
      setMedia({});
      setPhase("idle");
    }
  }, [live.status]);

  useEffect(() => {
    const element = video.current;
    if (!element || !media.video) return;
    media.video.attach(element);
    return () => media.video.detach(element);
  }, [media.video]);

  useEffect(() => {
    const element = audio.current;
    if (!element || !media.audio) return;
    media.audio.attach(element);
    return () => media.audio.detach(element);
  }, [media.audio]);

  async function connect(token) {
    if (connection.current || live.status !== "start") return;
    if (token && api.token !== token) { setPendingToken(token); return; }
    if (isOwner && !navigator.mediaDevices?.getUserMedia) {
      setError("Camera và micro cần trang HTTPS hoặc localhost.");
      return;
    }
    const current = { abort: new AbortController(), room: null, tracks: [] };
    connection.current = current;
    const active = () => connection.current === current;
    setError("");
    setPhase("connecting");
    try {
      const [sdk, access] = await Promise.all([
        import("livekit-client"),
        api.command("live.media", { livestream_id: live.id, role: isOwner ? "publisher" : "viewer" }, { signal: current.abort.signal }),
      ]);
      if (!active()) return;
      const { Room, RoomEvent, Track, DisconnectReason, createLocalTracks } =
        sdk;
      const room = new Room({ adaptiveStream: !isOwner, dynacast: isOwner });
      current.room = room;
      function readTracks() {
        if (!active()) return;
        const participant = isOwner
          ? room.localParticipant
          : room.remoteParticipants.get(`seller-${live.seller_id}`);
        const camera = participant?.getTrackPublication(Track.Source.Camera);
        const microphone = participant?.getTrackPublication(
          Track.Source.Microphone,
        );
        setMedia({
          video: camera?.isMuted ? undefined : camera?.track,
          audio: isOwner || microphone?.isMuted ? undefined : microphone?.track,
          micOn: Boolean(microphone?.track && !microphone.isMuted),
          audioBlocked: !room.canPlaybackAudio,
        });
      }
      current.readTracks = readTracks;
      for (const event of [
        RoomEvent.TrackSubscribed,
        RoomEvent.TrackUnsubscribed,
        RoomEvent.TrackMuted,
        RoomEvent.TrackUnmuted,
        RoomEvent.LocalTrackPublished,
        RoomEvent.LocalTrackUnpublished,
        RoomEvent.ParticipantDisconnected,
        RoomEvent.AudioPlaybackStatusChanged,
      ]) {
        room.on(event, readTracks);
      }
      room.on(RoomEvent.Reconnecting, () => {
        if (active()) setPhase("reconnecting");
      });
      room.on(RoomEvent.Reconnected, () => {
        if (active()) {
          setPhase(isOwner ? "publishing" : "watching");
          readTracks();
        }
      });
      room.on(RoomEvent.Disconnected, (reason) => {
        if (!active()) return;
        release();
        setMedia({});
        setPhase("idle");
        if (reason === DisconnectReason.ROOM_DELETED) onEndedRef.current();
        else setError("Kết nối video đã ngắt. Bạn có thể kết nối lại.");
      });
      await room.connect(access.url, access.token);
      if (!active()) {
        await room.disconnect();
        return;
      }
      if (isOwner) {
        current.tracks = await createLocalTracks({ audio: true, video: true });
        if (!active()) {
          current.tracks.forEach((track) => track.stop());
          return;
        }
        await Promise.all(
          current.tracks.map((track) =>
            room.localParticipant.publishTrack(track),
          ),
        );
      }
      if (!active()) {
        await room.disconnect();
        return;
      }
      setPhase(isOwner ? "publishing" : "watching");
      readTracks();
    } catch (err) {
      if (active()) {
        release();
        setMedia({});
        setPhase("idle");
        setError(mediaError(err));
        if (err.status === 409) onEndedRef.current();
      }
    }
  }

  useEffect(() => {
    if (pendingToken && api.token === pendingToken) { setPendingToken(null); void connect(pendingToken); }
  }, [api, pendingToken]);

  async function toggle(kind) {
    const current = connection.current;
    const participant = current?.room?.localParticipant;
    if (!participant || busy) return;
    setBusy(true);
    setError("");
    try {
      if (kind === "camera")
        await participant.setCameraEnabled(!participant.isCameraEnabled);
      else
        await participant.setMicrophoneEnabled(
          !participant.isMicrophoneEnabled,
        );
      current.readTracks();
    } catch (err) {
      if (connection.current === current) setError(mediaError(err));
    } finally {
      setBusy(false);
    }
  }

  async function enableAudio() {
    try {
      await connection.current?.room?.startAudio();
    } catch {
      setError("Trình duyệt chưa bật được âm thanh. Hãy thử lại.");
    }
  }

  async function endLive() {
    setEnding(true);
    setError("");
    try {
      const result = await api.command("live.end", { livestream_id: live.id });
      release();
      setMedia({});
      setPhase("idle");
      setConfirmEnd(false);
      onEndedRef.current(
        result.media_closed
          ? undefined
          : "Phiên đã kết thúc. LiveKit chưa xác nhận đóng phòng video.",
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setEnding(false);
    }
  }

  const ended = live.status === "end";
  const message = ended
    ? "Phiên live đã kết thúc"
    : mode === "demo"
      ? "Bản mẫu dùng để thử phòng và sản phẩm."
      : {
          connecting: "Đang kết nối video…",
          reconnecting: "Đang kết nối lại…",
          publishing: "Camera đang tắt",
          watching: "Đang chờ người bán phát video",
        }[phase] || "Chưa kết nối video";
  return (
    <div className="room-media">
      <div className="room-player">
        {!media.video && <Picture src={live.image} fallback={Video} />}
        <video
          ref={video}
          autoPlay
          playsInline
          muted
          className="live-video"
          aria-label={isOwner ? "Video xem trước" : "Video trực tiếp"}
          hidden={!media.video || ended}
        />
        <audio ref={audio} autoPlay />
        {media.video && !ended && phase !== "reconnecting" && (
          <span className="live-badge media-live">
            <i />
            Đang phát
          </span>
        )}
        {(!media.video || ended || phase === "reconnecting") && (
          <div
            className={`room-overlay ${mode === "demo" && !ended ? "demo-video-overlay" : ""}`}
          >
            <Video size={32} />
            <span role="status">{message}</span>
          </div>
        )}
        {children}
      </div>
      {!ended && mode === "api" && (
        <div className="media-controls">
          {phase === "idle" && (
            <button
              className="button primary"
              onClick={() => isOwner ? setPickupOpen("start") : withAccount(connect)}
            >
              {isOwner ? <Radio size={18} /> : <CirclePlay size={18} />}
              {isOwner ? "Bắt đầu phát" : "Xem trực tiếp"}
            </button>
          )}
          {phase === "publishing" && (
            <>
              <button
                className="button secondary"
                disabled={busy || ending}
                onClick={() => toggle("camera")}
              >
                {media.video ? <VideoOff size={17} /> : <Video size={17} />}
                {media.video ? "Tắt camera" : "Bật camera"}
              </button>
              <button
                className="button secondary"
                disabled={busy || ending}
                onClick={() => toggle("microphone")}
              >
                {media.micOn ? <MicOff size={17} /> : <Mic size={17} />}
                {media.micOn ? "Tắt micro" : "Bật micro"}
              </button>
            </>
          )}
          {phase === "watching" && media.audio && media.audioBlocked && (
            <button className="button secondary" onClick={enableAudio}>
              <Volume2 size={17} />
              Bật âm thanh
            </button>
          )}
          {phase !== "idle" && (
            <button
              className="button secondary"
              disabled={busy || ending}
              onClick={() => {
                release();
                setPhase("idle");
                setMedia({});
                setError("");
              }}
            >
              <Square size={16} />
              {isOwner ? "Dừng phát" : "Rời video"}
            </button>
          )}
          {isOwner && <button className="button secondary" disabled={ending} onClick={() => { setPickupFeedback(""); setPickupOpen("settings"); }}>Cài đặt giao hàng</button>}
          {isOwner && !confirmEnd && (
            <button
              className="button danger"
              disabled={ending}
              onClick={() => setConfirmEnd(true)}
            >
              Kết thúc phiên
            </button>
          )}
          {confirmEnd && (
            <div className="media-confirm">
              <span>Kết thúc phiên và trả hàng chưa bán về kho?</span>
              <button
                className="button danger"
                disabled={ending}
                onClick={endLive}
              >
                {ending ? "Đang kết thúc…" : "Xác nhận kết thúc"}
              </button>
              <button
                className="button secondary"
                disabled={ending}
                onClick={() => setConfirmEnd(false)}
              >
                Quay lại
              </button>
            </div>
          )}
        </div>
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {pickupFeedback && <p className="payment-note" role="status">{pickupFeedback}</p>}
      {pickupOpen && <LivePickupModal api={api} live={live} startBroadcast={pickupOpen === "start"} close={() => setPickupOpen(false)} onReady={() => {
        const start = pickupOpen === "start";
        setPickupOpen(false);
        if (start) withAccount(connect);
        else setPickupFeedback("Đã lưu nơi lấy hàng. Người xem có thể lấy lại báo phí vận chuyển.");
      }} />}
    </div>
  );
}
