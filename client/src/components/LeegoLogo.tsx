/**
   * LeegoLogo — Animated "Made by Leego" logo
   *
   * Tap/click to trigger:
   * - Smooth grow to 60vmin, hold briefly, then shrink back
   * - Total animation: 1.2s grow → 2.6s hold → 1.2s shrink
   */
  import { useRef, useState, useEffect, useCallback } from "react";

  const ANIM_GROW_MS   = 1200;
  const ANIM_HOLD_MS   = 2600;
  const ANIM_SHRINK_MS = 1200;

  type Phase = "idle" | "growing" | "holding" | "shrinking";

  interface LeegoLogoProps {
    idleClassName?: string;
  }

  export default function LeegoLogo({ idleClassName = "h-20 w-20" }: LeegoLogoProps) {
    const [phase, setPhase] = useState<Phase>("idle");
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleTap = useCallback(() => {
      if (phase !== "idle") return;
      if (timerRef.current) clearTimeout(timerRef.current);

      setPhase("growing");

      timerRef.current = setTimeout(() => {
        setPhase("holding");

        timerRef.current = setTimeout(() => {
          setPhase("shrinking");

          timerRef.current = setTimeout(() => {
            setPhase("idle");
            timerRef.current = null;
          }, ANIM_SHRINK_MS);
        }, ANIM_HOLD_MS);
      }, ANIM_GROW_MS);
    }, [phase]);

    useEffect(() => {
      return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }, []);

    const isExpanded = phase === "growing" || phase === "holding";

    const transitionDuration =
      phase === "growing"  ? `${ANIM_GROW_MS}ms` :
      phase === "shrinking"? `${ANIM_SHRINK_MS}ms` :
      "0ms";

    const transitionEasing =
      phase === "growing"  ? "cubic-bezier(0.22, 1, 0.36, 1)" :
      phase === "shrinking"? "cubic-bezier(0.64, 0, 0.78, 0)" :
      "linear";

    return (
      <div className="relative flex items-center justify-center" style={{ isolation: "isolate" }}>
        <img
          src="/Madebyleego.png"
          alt="Created by Leego"
          onClick={handleTap}
          draggable={false}
          className={["object-contain cursor-pointer select-none", phase === "idle" ? idleClassName : ""].join(" ")}
          style={{
            position: "relative",
            zIndex: 50,
            width:     isExpanded ? "60vmin" : phase === "shrinking" ? "60vmin" : undefined,
            height:    isExpanded ? "60vmin" : phase === "shrinking" ? "60vmin" : undefined,
            maxWidth:  isExpanded || phase === "shrinking" ? "60vmin" : undefined,
            maxHeight: isExpanded || phase === "shrinking" ? "60vmin" : undefined,
            transition: `width ${transitionDuration} ${transitionEasing}, height ${transitionDuration} ${transitionEasing}, filter ${transitionDuration} ${transitionEasing}`,
            filter: isExpanded
              ? "drop-shadow(0 0 20px rgba(0,255,50,1)) drop-shadow(0 0 50px rgba(0,255,50,0.85)) drop-shadow(0 0 100px rgba(0,255,50,0.5))"
              : "drop-shadow(0 0 8px rgba(0,255,50,0.6)) drop-shadow(0 0 18px rgba(0,255,50,0.3))",
            transformOrigin: (isExpanded || phase === "shrinking") ? undefined : "bottom center",
            ...(isExpanded || phase === "shrinking"
              ? { position: "fixed", bottom: "6vh", left: "50%", top: "auto", transform: "translateX(-50%)" }
              : {}),
          }}
          loading="lazy"
        />
      </div>
    );
  }
  