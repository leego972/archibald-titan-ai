/**
 * VoiceMode — Hands-free voice interface for Titan
 *
 * Phases:
 *   "off"        — voice mode disabled
 *   "active"     — continuous VAD loop; records speech above noise floor, auto-sends
 *   "recording"  — currently capturing a speech utterance
 *   "processing" — transcribing / waiting for Titan reply
 *   "speaking"   — Titan's TTS is playing; mic is paused to prevent echo
 *   "standby"    — 30s inactivity; SpeechRecognition listens for wake-word "TITAN"
 *
 * VAD logic:
 *   - Measures RMS volume every ~80ms via AudioContext analyser
 *   - Speech starts when RMS > SPEECH_THRESHOLD for >= MIN_SPEECH_MS (400ms)
 *   - Speech ends when RMS < SILENCE_THRESHOLD for >= SILENCE_MS (1200ms)
 *   - Minimum blob size 3 KB to discard noise bursts
 *
 * Wake-word:
 *   - Uses browser-native SpeechRecognition (no audio upload)
 *   - Listens for "titan" in transcript
 *   - On detection: plays a short chime, switches back to "active"
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
import { toast } from "sonner";

// ─── Constants ────────────────────────────────────────────────────────────────
const SPEECH_THRESHOLD  = 0.018;   // RMS above this = speech
const SILENCE_THRESHOLD = 0.012;   // RMS below this = silence
const MIN_SPEECH_MS     = 220;     // must be speaking this long before recording starts (was 400)
const SILENCE_MS        = 650;     // silence this long ends the utterance (was 1200)
const MAX_RECORD_MS     = 30000;   // hard cap per utterance
const STANDBY_TIMEOUT   = 30000;   // inactivity before entering standby/wake-word mode

// ─── Types ────────────────────────────────────────────────────────────────────
export type VoicePhase = "off" | "active" | "recording" | "processing" | "speaking" | "standby";

interface VoiceModeContextValue {
  enabled: boolean;
  phase: VoicePhase;
  transcript: string;
  lastReply: string;
  setEnabled: (v: boolean) => void;
  setConversationId: (id: number | null) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────
const VoiceModeContext = createContext<VoiceModeContextValue>({
  enabled: false,
  phase: "off",
  transcript: "",
  lastReply: "",
  setEnabled: () => {},
  setConversationId: () => {},
});

export function useVoiceMode() {
  return useContext(VoiceModeContext);
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export function VoiceModeProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [phase, setPhase] = useState<VoicePhase>("off");
  const [transcript, setTranscript] = useState("");
  const [lastReply, setLastReply] = useState("");

  // tRPC mutations
  const sendMessage   = trpc.chat.send.useMutation();
  const transcribeMut = trpc.voice.transcribe.useMutation();

  // Audio pipeline refs
  const streamRef        = useRef<MediaStream | null>(null);
  const audioCtxRef      = useRef<AudioContext | null>(null);
  const analyserRef      = useRef<AnalyserNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef   = useRef<Blob[]>([]);
  const audioRef         = useRef<HTMLAudioElement | null>(null);
  const vadFrameRef      = useRef<number | null>(null);
  const mimeTypeRef      = useRef<string>("audio/webm");

  // Timing refs
  const phaseRef         = useRef<VoicePhase>("off");
  const speechStartRef   = useRef<number | null>(null);
  const silenceStartRef  = useRef<number | null>(null);
  const maxRecordTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const standbyTimer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conversationIdRef = useRef<number | null>(null);

  // Wake-word ref
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const srRef = useRef<any>(null);

  // Keep phaseRef in sync with state
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // ── Standby timer reset ──────────────────────────────────────────────────────
  const resetStandbyTimer = useCallback(() => {
    if (standbyTimer.current) clearTimeout(standbyTimer.current);
    standbyTimer.current = setTimeout(() => {
      if (phaseRef.current === "active") {
        enterStandby();  
      }
    }, STANDBY_TIMEOUT);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Chime ────────────────────────────────────────────────────────────────────
  const playChime = useCallback(() => {
    try {
      const ctx  = new AudioContext();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
      osc.onended = () => ctx.close();
    } catch { /* ignore */ }
  }, []);

  // ── TTS ──────────────────────────────────────────────────────────────────────
  const speakText = useCallback(async (text: string) => {
    if (!text.trim()) return;
    try {
      setPhase("speaking");
      // Read CSRF token from cookie (required by server CSRF middleware)
      const csrfToken = document.cookie.split("; ").find(c => c.startsWith("csrf_token="))?.split("=")[1] || "";
      const res = await fetch("/api/voice/tts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("TTS failed");
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      await new Promise<void>((resolve) => {
        audio.onended = () => { URL.revokeObjectURL(url); audioRef.current = null; resolve(); };
        audio.onerror = () => { URL.revokeObjectURL(url); audioRef.current = null; resolve(); };
        audio.play().catch(() => resolve());
      });
    } catch (err) {
      console.error("[VoiceMode] TTS error:", err);
    } finally {
      if (phaseRef.current === "speaking") {
        setPhase("active");
        resetStandbyTimer();
      }
    }
  }, [resetStandbyTimer]);

  // ── Send to Titan ─────────────────────────────────────────────────────────────
  // Note: chat.send returns immediately with response="" (the real reply streams via SSE).
  // We subscribe to /api/chat/stream/:conversationId and wait for the "done" event,
  // which contains data.response — that's what we speak.
  const sendToTitan = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setTranscript(text);
    setPhase("processing");
    resetStandbyTimer();

    // Open SSE first IF we already have a conversation id, so we don't miss events.
    // If this is the first message, we'll open it after the mutate resolves (which gives us the id).
    const esRef: { current: EventSource | null } = { current: null };
    let settled = false;
    let watchdog: ReturnType<typeof setTimeout> | null = null;

    const finishWith = async (reply: string) => {
      if (settled) return;
      settled = true;
      if (watchdog) { clearTimeout(watchdog); watchdog = null; }
      if (esRef.current) { try { esRef.current.close(); } catch { /* ignore */ } esRef.current = null; }
      setLastReply(reply);
      setTranscript("");
      if (reply.trim()) {
        await speakText(reply);
      } else {
        setPhase("active");
        resetStandbyTimer();
      }
    };

    const subscribe = (convId: number) => {
      try {
        const ev = new EventSource(`/api/chat/stream/${convId}`, { withCredentials: true });
        esRef.current = ev;
        ev.addEventListener("done", (e: MessageEvent) => {
          let reply = "";
          try { reply = (JSON.parse(e.data)?.response as string) || ""; } catch { /* ignore */ }
          void finishWith(reply || "Sorry, I didn't catch that.");
        });
        ev.addEventListener("aborted", () => { void finishWith("The response was cancelled."); });
        ev.addEventListener("error", () => {
          // Browsers fire "error" on every disconnect; only treat as failure if we never got a "done".
          if (ev.readyState === EventSource.CLOSED && !settled) {
            void finishWith("Connection dropped before Titan finished.");
          }
        });
      } catch (err) {
        console.error("[VoiceMode] SSE subscribe failed:", err);
        void finishWith("Couldn't connect to Titan's response stream.");
      }
    };

    try {
      // Subscribe early if we already know the conversation id
      if (conversationIdRef.current) subscribe(conversationIdRef.current);

      const result = await sendMessage.mutateAsync({
        message: text,
        conversationId: conversationIdRef.current ?? undefined,
      });

      if (result?.conversationId) {
        const cid = typeof result.conversationId === "string"
          ? parseInt(result.conversationId, 10)
          : (result.conversationId as number);
        if (!conversationIdRef.current) {
          conversationIdRef.current = cid;
          subscribe(cid);
        }
      }

      // Some legacy paths return the full reply inline (refusals, errors). If so, short-circuit.
      const inlineReply: string =
        ((result as any)?.response && String((result as any).response).trim()) ||
        ((result as any)?.content && String((result as any).content).trim()) ||
        "";
      if (inlineReply) {
        await finishWith(inlineReply);
        return;
      }

      // 90s watchdog so we never hang forever if SSE never delivers "done"
      watchdog = setTimeout(() => {
        void finishWith("Titan is taking longer than usual. Please try again.");
      }, 90000);
    } catch (err) {
      console.error("[VoiceMode] Chat error:", err);
      if (watchdog) { clearTimeout(watchdog); watchdog = null; }
      if (esRef.current) { try { esRef.current.close(); } catch { /* ignore */ } esRef.current = null; }
      settled = true;
      toast.error("Titan couldn't respond. Try again.");
      setPhase("active");
      resetStandbyTimer();
    }
  }, [sendMessage, speakText, resetStandbyTimer]);

  // ── Transcribe blob ───────────────────────────────────────────────────────────
  const transcribeBlob = useCallback(async (blob: Blob) => {
    if (blob.size < 3000) {
      // Too small — likely noise, skip silently
      setPhase("active");
      return;
    }
    setPhase("processing");
    try {
      const arrayBuffer = await blob.arrayBuffer();
      // Convert binary to base64 in chunks to avoid stack overflow on large audio files
      const uint8 = new Uint8Array(arrayBuffer);
      let binary = "";
      const chunkSize = 8192;
      for (let i = 0; i < uint8.length; i += chunkSize) {
        binary += String.fromCharCode(...uint8.subarray(i, i + chunkSize));
      }
      const base64 = btoa(binary);
      const dataUrl = `data:${blob.type};base64,${base64}`;
      const result  = await transcribeMut.mutateAsync({ audioUrl: dataUrl });
      const text    = result?.text?.trim() ?? "";
      if (text) {
        await sendToTitan(text);
      } else {
        setPhase("active");
        resetStandbyTimer();
      }
    } catch (err) {
      console.error("[VoiceMode] Transcription error:", err);
      setPhase("active");
      resetStandbyTimer();
    }
  }, [transcribeMut, sendToTitan, resetStandbyTimer]);

  // ── Stop recording ────────────────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (maxRecordTimer.current) { clearTimeout(maxRecordTimer.current); maxRecordTimer.current = null; }
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // ── Start recording ───────────────────────────────────────────────────────────
  const startRecording = useCallback(() => {
    if (!streamRef.current) return;
    const mimeType = mimeTypeRef.current;
    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    mediaRecorderRef.current = recorder;
    audioChunksRef.current   = [];

    recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
    recorder.onstop = async () => {
      const blob = new Blob(audioChunksRef.current, { type: mimeType });
      audioChunksRef.current   = [];
      mediaRecorderRef.current = null;
      await transcribeBlob(blob);
    };
    recorder.start(100);
    setPhase("recording");
    maxRecordTimer.current = setTimeout(() => stopRecording(), MAX_RECORD_MS);
  }, [transcribeBlob, stopRecording]);

  // ── VAD loop ──────────────────────────────────────────────────────────────────
  const startVAD = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    const buf = new Float32Array(analyser.fftSize);

    const tick = () => {
      const currentPhase = phaseRef.current;
      // Stop VAD entirely for off/standby; pause (skip frame) during processing/speaking to prevent echo
      if (currentPhase === "off" || currentPhase === "standby") return;
      if (currentPhase === "processing" || currentPhase === "speaking") {
        vadFrameRef.current = requestAnimationFrame(tick);
        return; // don't analyse audio while Titan is responding or speaking
      }
      vadFrameRef.current = requestAnimationFrame(tick);

      analyser.getFloatTimeDomainData(buf);
      let sum = 0;
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
      const rms = Math.sqrt(sum / buf.length);
      const now = Date.now();

      if (currentPhase === "active") {
        if (rms > SPEECH_THRESHOLD) {
          if (!speechStartRef.current) speechStartRef.current = now;
          silenceStartRef.current = null;
          if (now - speechStartRef.current >= MIN_SPEECH_MS) {
            speechStartRef.current = null;
            startRecording();
          }
        } else {
          speechStartRef.current = null;
        }
      } else if (currentPhase === "recording") {
        if (rms < SILENCE_THRESHOLD) {
          if (!silenceStartRef.current) silenceStartRef.current = now;
          if (now - silenceStartRef.current >= SILENCE_MS) {
            silenceStartRef.current = null;
            stopRecording();
          }
        } else {
          silenceStartRef.current = null;
        }
      }
    };
    vadFrameRef.current = requestAnimationFrame(tick);
  }, [startRecording, stopRecording]);

  // ── Enter standby (wake-word mode) ────────────────────────────────────────────
  const enterStandby = useCallback(() => {
    setPhase("standby");
    if (vadFrameRef.current) { cancelAnimationFrame(vadFrameRef.current); vadFrameRef.current = null; }

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      // Browser doesn't support SpeechRecognition — stay active
      setPhase("active");
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sr: any = new SpeechRecognitionAPI();
    sr.continuous     = true;
    sr.interimResults = true;
    sr.lang           = "en-US";
    srRef.current     = sr;

    sr.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript.toLowerCase();
        if (text.includes("titan")) {
          sr.stop();
          srRef.current = null;
          playChime();
          setPhase("active");
          resetStandbyTimer();
          break;
        }
      }
    };
    sr.onerror = () => { srRef.current = null; };
    sr.onend   = () => {
      // Restart if still in standby
      if (phaseRef.current === "standby" && srRef.current === null) {
        setTimeout(() => {
          if (phaseRef.current === "standby") enterStandby();
        }, 500);
      }
    };
    try { sr.start(); } catch { /* ignore */ }
  }, [playChime, resetStandbyTimer]);  

  // ── Enable / Disable ──────────────────────────────────────────────────────────
  const setEnabled = useCallback(async (v: boolean) => {
    setEnabledState(v);
    if (!v) {
      // Tear down everything
      if (vadFrameRef.current)    { cancelAnimationFrame(vadFrameRef.current); vadFrameRef.current = null; }
      if (standbyTimer.current)   { clearTimeout(standbyTimer.current); standbyTimer.current = null; }
      if (maxRecordTimer.current) { clearTimeout(maxRecordTimer.current); maxRecordTimer.current = null; }
      if (srRef.current)          { try { srRef.current.stop(); } catch { /* ignore */ } srRef.current = null; }
      if (mediaRecorderRef.current?.state !== "inactive") {
        try { mediaRecorderRef.current?.stop(); } catch { /* ignore */ }
      }
      if (streamRef.current)      { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
      if (audioCtxRef.current)    { try { audioCtxRef.current.close(); } catch { /* ignore */ } audioCtxRef.current = null; }
      if (audioRef.current)       { audioRef.current.pause(); audioRef.current = null; }
      setPhase("off");
      setTranscript("");
      return;
    }

    // Start up
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source   = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyserRef.current = analyser;

      mimeTypeRef.current = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";

      setPhase("active");
      startVAD();
      resetStandbyTimer();
      toast.success("Voice mode ON — just speak to Titan");
    } catch (err: unknown) {
      setEnabledState(false);
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Permission") || msg.includes("NotAllowed")) {
        toast.error("Microphone permission denied. Please allow mic access in your browser settings.");
      } else {
        toast.error("Could not access microphone.");
      }
    }
  }, [startVAD, resetStandbyTimer]);

  // Restart VAD when phase returns to "active" after speaking/processing
  useEffect(() => {
    if (phase === "active" && enabled && analyserRef.current && !vadFrameRef.current) {
      startVAD();
    }
  }, [phase, enabled, startVAD]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (vadFrameRef.current)    cancelAnimationFrame(vadFrameRef.current);
      if (standbyTimer.current)   clearTimeout(standbyTimer.current);
      if (maxRecordTimer.current) clearTimeout(maxRecordTimer.current);
      if (srRef.current)          { try { srRef.current.stop(); } catch { /* ignore */ } }
      if (streamRef.current)      streamRef.current.getTracks().forEach(t => t.stop());
      if (audioCtxRef.current)    { try { audioCtxRef.current.close(); } catch { /* ignore */ } }
    };
  }, []);

  // Allow external callers (e.g. ChatPage) to pin voice to a specific conversation
  const setConversationId = useCallback((id: number | null) => {
    conversationIdRef.current = id;
  }, []);

  return (
    <VoiceModeContext.Provider value={{ enabled, phase, transcript, lastReply, setEnabled, setConversationId }}>
      {children}
    </VoiceModeContext.Provider>
  );
}
