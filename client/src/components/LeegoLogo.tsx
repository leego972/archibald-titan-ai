/**
 * LeegoLogo — Animated "Made by Leego" logo
 *
 * Tap/click to trigger:
 * - Smooth grow to 3/5 of the viewport (60vmin), hold briefly, then shrink back
 * - Total animation duration: 5 seconds (1.2s grow → 2.6s hold → 1.2s shrink)
 * - Matrix rain canvas rendered around the logo while expanded
 * - Green radioactive glow effect
 */
import { useRef, useState, useEffect, useCallback } from "react";

const ANIM_GROW_MS = 1200;   // time to grow to full size
const ANIM_HOLD_MS = 2600;   // time to hold at full size
const ANIM_SHRINK_MS = 1200; // time to shrink back
const TOTAL_MS = ANIM_GROW_MS + ANIM_HOLD_MS + ANIM_SHRINK_MS; // 5000ms

type Phase = "idle" | "growing" | "holding" | "shrinking";

interface LeegoLogoProps {
  /** Base size when idle — defaults to "h-14 w-14" on mobile, "h-24 w-24" on desktop */
  idleClassName?: string;
}

export default function LeegoLogo({ idleClassName = "h-20 w-20" }: LeegoLogoProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Matrix rain on canvas ──────────────────────────────────────────────────
  const startMatrix = useCallback((el: HTMLCanvasElement) => {
    el.width = el.offsetWidth;
    el.height = el.offsetHeight;
    const ctx = el.getContext("2d")!;
    const cols = Math.floor(el.width / 14);
    const drops: number[] = Array(cols).fill(1);
    const chars = "01アイウエオカキクケコサシスセソタチツテトナニヌネノ";

    const draw = () => {
      ctx.fillStyle = "rgba(0,0,0,0.07)";
      ctx.fillRect(0, 0, el.width, el.height);
      ctx.font = "13px monospace";
      for (let i = 0; i < drops.length; i++) {
        const ch = chars[Math.floor(Math.random() * chars.length)];
        const y = drops[i] * 14;
        ctx.fillStyle = y < 28 ? "#afffaf" : "#00ff32";
        ctx.fillText(ch, i * 14, y);
        if (y > el.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
  }, []);

  const stopMatrix = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  // ── Trigger animation ──────────────────────────────────────────────────────
  const handleTap = useCallback(() => {
    if (phase !== "idle") return; // ignore taps during animation

    // Clear any stale timers
    if (timerRef.current) clearTimeout(timerRef.current);
    stopMatrix();

    setPhase("growing");

    // After grow completes → hold
    timerRef.current = setTimeout(() => {
      setPhase("holding");

      // After hold → shrink
      timerRef.current = setTimeout(() => {
        setPhase("shrinking");
        stopMatrix();

        // After shrink → idle
        timerRef.current = setTimeout(() => {
          setPhase("idle");
          timerRef.current = null;
        }, ANIM_SHRINK_MS);
      }, ANIM_HOLD_MS);
    }, ANIM_GROW_MS);
  }, [phase, stopMatrix]);

  // ── Cleanup on unmount ─────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      stopMatrix();
    };
  }, [stopMatrix]);

  const isExpanded = phase === "growing" || phase === "holding";
  const isVisible = phase !== "idle";

  // ── Compute CSS transition timing ──────────────────────────────────────────
  // grow: ease-out over ANIM_GROW_MS
  // hold: no transition
  // shrink: ease-in over ANIM_SHRINK_MS
  const transitionDuration =
    phase === "growing" ? `${ANIM_GROW_MS}ms` :
    phase === "shrinking" ? `${ANIM_SHRINK_MS}ms` :
    "0ms";

  const transitionEasing =
    phase === "growing" ? "cubic-bezier(0.22, 1, 0.36, 1)" :
    phase === "shrinking" ? "cubic-bezier(0.64, 0, 0.78, 0)" :
    "linear";

  return (
    <div className="relative flex items-center justify-center" style={{ isolation: "isolate" }}>
      {/* Matrix rain canvas — rendered as a box around the logo when expanded */}
      {isVisible && (
        <canvas
          ref={(el) => {
            canvasRef.current = el;
            if (!el) {
              stopMatrix();
              return;
            }
            if (isExpanded) {
              startMatrix(el);
            }
          }}
          className="pointer-events-none rounded-2xl"
          style={{
            position: "fixed",
            // Centre on screen, sized to 70vmin × 70vmin (slightly larger than logo)
            width: "70vmin",
            height: "70vmin",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 49,
            opacity: isExpanded ? 0.9 : 0,
            transition: `opacity ${transitionDuration} ${transitionEasing}`,
            borderRadius: "1.5rem",
            background: "transparent",
          }}
        />
      )}

      {/* The logo itself */}
      <img
        src="/Madebyleego.png"
        alt="Created by Leego"
        onClick={handleTap}
        draggable={false}
        className={[
          "object-contain cursor-pointer select-none",
          phase === "idle" ? idleClassName : "",
        ].join(" ")}
        style={{
          position: "relative",
          zIndex: 50,
          // When expanded → 60vmin (3/5 of the smaller viewport dimension)
          // When idle → controlled by idleClassName
          width: isExpanded ? "60vmin" : phase === "shrinking" ? "60vmin" : undefined,
          height: isExpanded ? "60vmin" : phase === "shrinking" ? "60vmin" : undefined,
          maxWidth: isExpanded || phase === "shrinking" ? "60vmin" : undefined,
          maxHeight: isExpanded || phase === "shrinking" ? "60vmin" : undefined,
          // Smooth size transition
          transition: `width ${transitionDuration} ${transitionEasing}, height ${transitionDuration} ${transitionEasing}, filter ${transitionDuration} ${transitionEasing}`,
          // Glow
          filter: isExpanded
            ? "drop-shadow(0 0 20px rgba(0,255,50,1)) drop-shadow(0 0 50px rgba(0,255,50,0.85)) drop-shadow(0 0 100px rgba(0,255,50,0.5))"
            : "drop-shadow(0 0 8px rgba(0,255,50,0.6)) drop-shadow(0 0 18px rgba(0,255,50,0.3))",
          // Keep it centred on screen when expanded
          ...(isExpanded || phase === "shrinking"
            ? {
                position: "fixed",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
              }
            : {}),
        }}
        loading="lazy"
      />
    </div>
  );
}
