"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type SignalPayload =
  | { type: "offer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: "answer"; from: string; to: string; sdp: RTCSessionDescriptionInit }
  | { type: "ice"; from: string; to: string; candidate: RTCIceCandidateInit };

interface VoiceRoomProps {
  roomId: string;
  label?: string;
}

const rtcConfig: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302"] }],
};

export function VoiceRoom({ roomId, label }: VoiceRoomProps) {
  const supabase = useMemo(() => createClient(), []);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreamsRef = useRef<Map<string, MediaStream>>(new Map());
  const localAudioRef = useRef<HTMLAudioElement | null>(null);
  const remoteAudioHostRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(true);
  const selfIdRef = useRef<string>("");

  const [selfId, setSelfId] = useState<string>("");
  const [selfName, setSelfName] = useState<string>("Operator");
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remotePeers, setRemotePeers] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    async function boot() {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();
        if (error || !user) {
          setError("Login required for voice room");
          return;
        }

        const profileRes = await fetch("/api/profile");
        const profileJson = await profileRes.json();
        const name =
          (profileRes.ok ? profileJson?.display_name : null) ||
          user.user_metadata?.display_name ||
          user.email?.split("@")[0] ||
          "Operator";

        if (!mountedRef.current) return;
        selfIdRef.current = user.id;
        setSelfId(user.id);
        setSelfName(name);

        const channel = supabase.channel(`voice-room:${roomId}`, {
          config: { presence: { key: user.id }, broadcast: { self: false } },
        });
        channelRef.current = channel;

        channel
          .on("broadcast", { event: "signal" }, async ({ payload }) => {
            await onSignal(payload as SignalPayload);
          })
          .on("presence", { event: "sync" }, () => {
            const state = channel.presenceState<Record<string, unknown>>();
            const peers = Object.entries(state)
              .map(([id, presences]) => {
                const first = Array.isArray(presences) ? presences[0] : null;
                const name = (first?.name as string | undefined) || "Operator";
                return { id, name };
              })
              .filter((p) => p.id !== user.id);

            setRemotePeers(peers);

            for (const peer of peers) {
              // Deterministic initiator to avoid glare:
              // lower user id starts the offer.
              if (user.id < peer.id && !peersRef.current.has(peer.id)) {
                void createPeer(peer.id, true);
              }
            }
          })
          .subscribe(async (status) => {
            if (status !== "SUBSCRIBED") return;
            const trackStatus = await channel.track({ userId: user.id, name });
            if (trackStatus === "ok") {
              setIsConnected(true);
            }
            try {
              await startLocalAudio(user.id);
            } catch (mediaErr) {
              setError(mediaErr instanceof Error ? mediaErr.message : "Mic unavailable");
            }
          });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to start voice chat");
      }
    }

    void boot();

    return () => {
      void cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  async function cleanup() {
    for (const pc of peersRef.current.values()) {
      pc.close();
    }
    peersRef.current.clear();
    remoteStreamsRef.current.clear();

    const channel = channelRef.current;
    channelRef.current = null;
    if (channel) {
      await supabase.removeChannel(channel);
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setIsConnected(false);
    setRemotePeers([]);
    selfIdRef.current = "";
  }

  async function startLocalAudio(userId: string) {
    if (localStreamRef.current) return;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStreamRef.current = stream;
    if (localAudioRef.current) {
      localAudioRef.current.srcObject = stream;
    }

    // Connect with peers already present in the room.
    const channel = channelRef.current;
    if (!channel) return;
    const state = channel.presenceState<Record<string, unknown>>();
    const peerIds = Object.keys(state).filter((id) => id !== userId);
    for (const peerId of peerIds) {
      if (userId < peerId && !peersRef.current.has(peerId)) {
        await createPeer(peerId, true);
      }
    }
  }

  async function createPeer(remoteId: string, initiator: boolean) {
    if (peersRef.current.has(remoteId)) return peersRef.current.get(remoteId)!;

    const pc = new RTCPeerConnection(rtcConfig);
    peersRef.current.set(remoteId, pc);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.onicecandidate = async (event) => {
      if (!event.candidate || !channelRef.current) return;
      const payload: SignalPayload = {
        type: "ice",
        from: selfIdRef.current,
        to: remoteId,
        candidate: event.candidate.toJSON(),
      };
      await channelRef.current.send({ type: "broadcast", event: "signal", payload });
    };

    pc.ontrack = (event) => {
      const [stream] = event.streams;
      if (!stream) return;
      remoteStreamsRef.current.set(remoteId, stream);
      renderRemoteAudio();
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected" || pc.connectionState === "closed") {
        peersRef.current.delete(remoteId);
        remoteStreamsRef.current.delete(remoteId);
        renderRemoteAudio();
      }
    };

    if (initiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (channelRef.current) {
        const payload: SignalPayload = {
          type: "offer",
          from: selfIdRef.current,
          to: remoteId,
          sdp: offer,
        };
        await channelRef.current.send({ type: "broadcast", event: "signal", payload });
      }
    }

    return pc;
  }

  async function onSignal(signal: SignalPayload) {
    if (!selfIdRef.current) return;
    if (signal.to !== selfIdRef.current) return;

    if (signal.type === "offer") {
      const pc = (await createPeer(signal.from, false))!;
      await pc.setRemoteDescription(signal.sdp);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      if (channelRef.current) {
        const payload: SignalPayload = {
          type: "answer",
          from: selfIdRef.current,
          to: signal.from,
          sdp: answer,
        };
        await channelRef.current.send({ type: "broadcast", event: "signal", payload });
      }
      return;
    }

    const pc = peersRef.current.get(signal.from);
    if (!pc) return;

    if (signal.type === "answer") {
      await pc.setRemoteDescription(signal.sdp);
      return;
    }

    if (signal.type === "ice") {
      try {
        await pc.addIceCandidate(signal.candidate);
      } catch {
        // Ignore transient race when remote description isn't set yet.
      }
    }
  }

  function renderRemoteAudio() {
    const host = remoteAudioHostRef.current;
    if (!host) return;
    host.innerHTML = "";
    for (const [id, stream] of remoteStreamsRef.current.entries()) {
      const el = document.createElement("audio");
      el.autoplay = true;
      el.setAttribute("playsinline", "true");
      el.dataset.peer = id;
      el.srcObject = stream;
      host.appendChild(el);
    }
  }

  function toggleMute() {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextMuted = !isMuted;
    stream.getAudioTracks().forEach((t) => {
      t.enabled = !nextMuted;
    });
    setIsMuted(nextMuted);
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>VOICE ROOM {label ? `· ${label}` : ""}</h2>
      </div>
      <div className="panel-body" style={{ display: "grid", gap: "0.6rem" }}>
        <div className="muted">
          {isConnected ? "Connected" : "Connecting..."} · You: <strong>{selfName}</strong>
        </div>
        {error ? <p style={{ color: "var(--danger)" }}>{error}</p> : null}

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-ghost" onClick={toggleMute} disabled={!isConnected}>
            {isMuted ? "Unmute Mic" : "Mute Mic"}
          </button>
          <span className="muted">Peers in room: {remotePeers.length}</span>
        </div>

        <div className="player-list">
          {remotePeers.length === 0 ? (
            <div className="muted">No other players connected to voice yet.</div>
          ) : (
            remotePeers.map((p) => (
              <div key={p.id} className="player-item">
                <span style={{ flex: 1 }}>{p.name}</span>
                <small className="muted">{p.id.slice(0, 8)}</small>
              </div>
            ))
          )}
        </div>

        <audio ref={localAudioRef} autoPlay muted playsInline />
        <div ref={remoteAudioHostRef} />
      </div>
    </section>
  );
}
