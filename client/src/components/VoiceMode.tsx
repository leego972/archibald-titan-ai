/**
 * VoiceMode — Persistent voice interface for Titan
 *
 * Architecture:
 * - VoiceModeContext: global state (enabled, listening, speaking, transcript, conversation)
 * - VoiceModeProvider: wraps the app, manages MediaRecorder + TTS audio pipeline
 * - VoiceModeOverlay: floating UI rendered at root level, visible on all pages
 * - useVoiceMode: hook for components to read/toggle voice mode state
 *
 * Flow:
 * 1. User toggles Voice Mode ON in sidebar
 * 2. Floating overlay appears (bottom-right, draggable)
 * 3. User taps mic → MediaRecorder starts
 * 4. User releases mic (or silence detected) → audio sent to /api/voice/transcribe
 * 5. Transcript sent to chat.send mutation → Titan replies
 * 6. Reply text sent to /api/voice/tts → audio plays back
 * 7. Overlay shows live transcript + Titan's reply + waveform animation
 */

import {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import { trpc } from "@/lib/trpc";
import { Mic, MicOff, Volume2, VolumeX, X, Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface VoiceMessage {
  id: string;
  role: "user" | "titan";
  text: string;
  timestamp: Date;
}

interface VoiceModeContextValue {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
  listening: boolean;
  speaking: boolean;
  muted: boolean;
  setMuted: (v: boolean) => void;
  transcript: string;
  messages: VoiceMessage[];
  conversationId: number | null;
  startListening: () => void;
  stopListening: () => void;
  clearHistory: () => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const VoiceModeContext = createContext<VoiceModeContextValue>({
  enabled: false,
  setEnabled: () => {},
  listening: false,
  speaking: false,
  muted: false,
  setMuted: () => {},
  transcript: "",
  messages: [],
  conversationId: null,
  startListening: () => {},
  stopListening: () => {},
  clearHistory: () => {},
});

export function useVoiceMode() {
  return useContext(VoiceModeContext);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function VoiceModeProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [muted, setMuted] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const sendMessage = trpc.chat.send.useMutation();
  const transcribeMutation = trpc.voice.transcribe.useMutation();

  // ── Enable / Disable ────────────────────────────────────────────────────────
  const setEnabled = useCallback((v: boolean) => {
    setEnabledState(v);
    if (!v) {
      // Clean up on disable
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      setListening(false);
      setSpeaking(false);
      setTranscript("");
    }
  }, []);

  // ── TTS Playback ─────────────────────────────────────────────────────────────
  const speakText = useCallback(async (text: string) => {
    if (muted || !text.trim()) return;
    try {
      setSpeaking(true);
      const res = await fetch("/api/voice/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("TTS failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setSpeaking(false);
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };
      audio.onerror = () => {
        setSpeaking(false);
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };
      await audio.play();
    } catch (err) {
      setSpeaking(false);
      console.error("[VoiceMode] TTS error:", err);
    }
  }, [muted]);

  // ── Send transcript to Titan ─────────────────────────────────────────────────
  const sendToTitan = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const userMsg: VoiceMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setTranscript("");

    try {
      const result = await sendMessage.mutateAsync({
        message: text,
        conversationId: conversationId ?? undefined,
      });

      // Store conversationId for continuity
      if (result?.conversationId && !conversationId) {
        setConversationId(result.conversationId);
      }

      const replyText =
        typeof result?.content === "string"
          ? result.content
          : result?.message ?? "Sorry, I didn't catch that.";

      const titanMsg: VoiceMessage = {
        id: crypto.randomUUID(),
        role: "titan",
        text: replyText,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, titanMsg]);

      // Speak the reply
      await speakText(replyText);
    } catch (err) {
      console.error("[VoiceMode] Chat error:", err);
      toast.error("Titan couldn't respond. Try again.");
    }
  }, [sendMessage, conversationId, speakText]);

  // ── Upload audio blob and transcribe ────────────────────────────────────────
  const transcribeBlob = useCallback(async (blob: Blob) => {
    try {
      // Upload blob as base64 via tRPC transcribe
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );
      const dataUrl = `data:${blob.type};base64,${base64}`;

      // Use the voice transcribe tRPC mutation
      const result = await transcribeMutation.mutateAsync({ audioUrl: dataUrl });
      const text = result?.text?.trim() ?? "";
      if (text) {
        setTranscript(text);
        await sendToTitan(text);
      }
    } catch (err) {
      console.error("[VoiceMode] Transcription error:", err);
      toast.error("Couldn't transcribe audio. Please try again.");
    }
  }, [transcribeMutation, sendToTitan]);

  // ── Start Listening ──────────────────────────────────────────────────────────
  const startListening = useCallback(async () => {
    if (listening || speaking) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Silence detection via AudioContext analyser
      const audioCtx = new AudioContext();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        setListening(false);

        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        audioChunksRef.current = [];

        if (blob.size > 1000) {
          await transcribeBlob(blob);
        }
      };

      recorder.start(100); // collect chunks every 100ms
      setListening(true);

      // Auto-stop after 30s max
      silenceTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      }, 30000);

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Permission") || msg.includes("NotAllowed")) {
        toast.error("Microphone permission denied. Please allow mic access.");
      } else {
        toast.error("Could not access microphone.");
      }
      console.error("[VoiceMode] Mic error:", err);
    }
  }, [listening, speaking, transcribeBlob]);

  // ── Stop Listening ───────────────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // ── Clear History ────────────────────────────────────────────────────────────
  const clearHistory = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setTranscript("");
  }, []);

  return (
    <VoiceModeContext.Provider
      value={{
        enabled,
        setEnabled,
        listening,
        speaking,
        muted,
        setMuted,
        transcript,
        messages,
        conversationId,
        startListening,
        stopListening,
        clearHistory,
      }}
    >
      {children}
      {enabled && <VoiceModeOverlay />}
    </VoiceModeContext.Provider>
  );
}

// ─── Floating Overlay ─────────────────────────────────────────────────────────

function VoiceModeOverlay() {
  const {
    listening,
    speaking,
    muted,
    setMuted,
    transcript,
    messages,
    startListening,
    stopListening,
    clearHistory,
    setEnabled,
  } = useVoiceMode();

  const [minimised, setMinimised] = useState(false);
  const [pos, setPos] = useState({ x: 24, y: 24 }); // distance from bottom-right
  const dragRef = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number } | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, transcript]);

  // Drag handlers
  const onDragStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    dragRef.current = { startX: clientX, startY: clientY, startPosX: pos.x, startPosY: pos.y };
  }, [pos]);

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      if (!dragRef.current) return;
      const clientX = "touches" in e ? (e as TouchEvent).touches[0].clientX : (e as MouseEvent).clientX;
      const clientY = "touches" in e ? (e as TouchEvent).touches[0].clientY : (e as MouseEvent).clientY;
      const dx = dragRef.current.startX - clientX;
      const dy = dragRef.current.startY - clientY;
      setPos({
        x: Math.max(8, dragRef.current.startPosX + dx),
        y: Math.max(8, dragRef.current.startPosY + dy),
      });
    };
    const onEnd = () => { dragRef.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onEnd);
    window.addEventListener("touchmove", onMove);
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onEnd);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, []);

  const recentMessages = messages.slice(-6);
  const isProcessing = speaking || (transcript.length > 0 && !listening);

  return (
    <div
      ref={overlayRef}
      style={{ bottom: pos.y, right: pos.x }}
      className="fixed z-[9999] flex flex-col gap-0 select-none"
    >
      {/* Expanded panel */}
      {!minimised && (
        <div className="mb-2 w-80 rounded-2xl border border-white/10 bg-zinc-950/95 shadow-2xl backdrop-blur-xl overflow-hidden">
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b border-white/10 cursor-grab active:cursor-grabbing bg-zinc-900/80"
            onMouseDown={onDragStart}
            onTouchStart={onDragStart}
          >
            <div className="flex items-center gap-2">
              <div className={cn(
                "h-2 w-2 rounded-full transition-colors",
                listening ? "bg-red-400 animate-pulse" :
                speaking ? "bg-emerald-400 animate-pulse" :
                "bg-zinc-500"
              )} />
              <span className="text-sm font-semibold text-white">
                {listening ? "Listening..." : speaking ? "Titan is speaking..." : "Voice Mode"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setMuted(!muted)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                title={muted ? "Unmute Titan" : "Mute Titan"}
              >
                {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={clearHistory}
                className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                title="Clear conversation"
              >
                <MessageSquare className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setMinimised(true)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                title="Minimise"
              >
                <span className="text-xs font-bold leading-none">—</span>
              </button>
              <button
                onClick={() => setEnabled(false)}
                className="p-1.5 rounded-lg hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
                title="Close voice mode"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="max-h-56 overflow-y-auto px-4 py-3 space-y-2 scrollbar-thin scrollbar-thumb-zinc-700">
            {recentMessages.length === 0 && !transcript && (
              <p className="text-xs text-zinc-500 text-center py-4">
                Hold the mic button and speak to Titan
              </p>
            )}
            {recentMessages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "rounded-xl px-3 py-2 text-xs max-w-[90%]",
                  msg.role === "user"
                    ? "ml-auto bg-blue-600/30 text-blue-100 text-right"
                    : "bg-zinc-800/80 text-zinc-100"
                )}
              >
                <p className="leading-relaxed">{msg.text}</p>
              </div>
            ))}
            {/* Live transcript */}
            {transcript && (
              <div className="ml-auto rounded-xl px-3 py-2 text-xs max-w-[90%] bg-blue-600/20 text-blue-200 text-right border border-blue-500/20">
                <p className="leading-relaxed italic">{transcript}</p>
              </div>
            )}
            {/* Processing indicator */}
            {isProcessing && !transcript && (
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Titan is thinking...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Waveform / status bar */}
          {listening && (
            <div className="px-4 pb-3 flex items-center gap-1 justify-center">
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-red-400 rounded-full animate-pulse"
                  style={{
                    height: `${8 + Math.random() * 16}px`,
                    animationDelay: `${i * 60}ms`,
                    animationDuration: `${400 + Math.random() * 300}ms`,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mic button + minimised restore */}
      <div className="flex items-center justify-end gap-2">
        {minimised && (
          <button
            onClick={() => setMinimised(false)}
            className="h-10 px-3 rounded-full bg-zinc-800 border border-white/10 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors shadow-lg"
          >
            Voice Mode
          </button>
        )}

        {/* Main mic button — hold to speak */}
        <button
          onMouseDown={startListening}
          onMouseUp={stopListening}
          onMouseLeave={stopListening}
          onTouchStart={startListening}
          onTouchEnd={stopListening}
          disabled={speaking}
          className={cn(
            "h-14 w-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-200 border-2",
            listening
              ? "bg-red-500 border-red-400 scale-110 shadow-red-500/40"
              : speaking
              ? "bg-emerald-600 border-emerald-400 cursor-not-allowed"
              : "bg-zinc-800 border-zinc-600 hover:bg-zinc-700 hover:border-zinc-500 active:scale-95"
          )}
          title={listening ? "Release to send" : speaking ? "Titan is speaking..." : "Hold to speak"}
        >
          {speaking ? (
            <Volume2 className="h-6 w-6 text-emerald-300 animate-pulse" />
          ) : listening ? (
            <MicOff className="h-6 w-6 text-white" />
          ) : (
            <Mic className="h-6 w-6 text-zinc-300" />
          )}
        </button>
      </div>
    </div>
  );
}
