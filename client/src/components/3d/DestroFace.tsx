import React, { useState, useRef, useEffect } from 'react';

  export type Emotion =
    | 'neutral' | 'smiling' | 'laughing' | 'serious' | 'empathetic'
    | 'thinking' | 'concerned' | 'amused' | 'friendly_stern' | 'cyber' | 'cinema';

  const EYE_COLOR: Record<Emotion, string> = {
    thinking:       '#1a7fff',
    serious:        '#1a7fff',
    concerned:      '#ff3300',
    cyber:          '#ff2200',
    friendly_stern: '#00eedd',
    amused:         '#00eedd',
    laughing:       '#00eedd',
    cinema:         '#00ff44',
    neutral:        '#00cc55',
    smiling:        '#00cc55',
    empathetic:     '#00cc88',
  };

  const EYE_INTENSITY: Record<Emotion, number> = {
    concerned:      1.0,
    cyber:          1.0,
    cinema:         0.9,
    thinking:       0.85,
    serious:        0.75,
    friendly_stern: 0.70,
    amused:         0.70,
    laughing:       0.65,
    smiling:        0.60,
    empathetic:     0.55,
    neutral:        0.50,
  };

  export const DestroFace = ({
    volume = 0,
    emotion = 'neutral',
  }: {
    volume?: number;
    emotion?: Emotion;
  }) => {
    const eyeColor   = EYE_COLOR[emotion] ?? '#00cc55';
    const eyeOpacity = EYE_INTENSITY[emotion] ?? 0.5;

    // ── Phoneme micro-animation — RAF loop only while speaking ────────────────
    const [phoneme, setPhoneme] = useState(0);
    const rafRef     = useRef<number | null>(null);
    const phaseRef   = useRef(0);
    const isSpeaking = volume > 0.02;

    useEffect(() => {
      if (!isSpeaking) {
        if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
        setPhoneme(0);
        return;
      }
      const tick = () => {
        phaseRef.current += 0.11;
        const v =
          Math.sin(phaseRef.current * 2.1) * 0.35 +
          Math.sin(phaseRef.current * 3.9) * 0.20 +
          Math.sin(phaseRef.current * 7.3) * 0.10;
        setPhoneme(v);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
      return () => { if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } };
    }, [isSpeaking]);

    // ── Mouth geometry ─────────────────────────────────────────────────────────
    const baseOpen   = Math.min(Math.max(volume, 0), 1);
    const openFactor = Math.max(0, baseOpen + phoneme * baseOpen * 0.55);
    const lipGap     = openFactor * 16; // max 16 SVG units (viewBox 0 0 100 30)
    const midY       = 15;
    const hy         = lipGap * 0.5;
    const curve      = hy * 0.42;

    const mouthFill = `M 4,${midY - hy} C 28,${midY - hy - curve} 72,${midY - hy - curve} 96,${midY - hy} L 96,${midY + hy} C 72,${midY + hy + curve} 28,${midY + hy + curve} 4,${midY + hy} Z`;
    const upperLip  = `M 4,${midY - hy} C 28,${midY - hy - curve} 72,${midY - hy - curve} 96,${midY - hy}`;
    const lowerLip  = `M 4,${midY + hy} C 28,${midY + hy + curve} 72,${midY + hy + curve} 96,${midY + hy}`;
    const specular  = `M 20,${midY - hy + 0.5} C 40,${midY - hy - curve * 0.3} 60,${midY - hy - curve * 0.3} 80,${midY - hy + 0.5}`;

    const pulsing = emotion === 'smiling' || emotion === 'laughing' || emotion === 'amused';

    return (
      <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
        <style>{`
          @keyframes arcEyePulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.22)} }
          @keyframes arcEyePulse2{ 0%,100%{transform:scale(1)} 50%{transform:scale(1.22)} }
        `}</style>

        <div style={{
          position:'relative', width:'76%', aspectRatio:'1/1',
          animation:'titan-float 3.8s ease-in-out infinite',
          filter:'drop-shadow(0 8px 32px rgba(30,40,80,0.70))',
        }}>
          {/* ── Full face — no clipping ──────────────────────────────── */}
          <img src="/destro-face.png" alt="" style={{
            position:'absolute', inset:0, width:'100%', height:'100%',
            objectFit:'cover', userSelect:'none', pointerEvents:'none',
          }} />

          {/* ── Dark backing at mouth (covers static painted mouth) ── */}
          <div style={{
            position:'absolute', top:'72%', left:'32%', width:'36%', height:'10%',
            background:'radial-gradient(ellipse 88% 70% at 50% 55%, #020209 0%, #060610 60%, transparent 100%)',
            pointerEvents:'none',
          }} />

          {/* ── Animated chrome lip SVG ───────────────────────────── */}
          <div style={{ position:'absolute', top:'70.5%', left:'30%', width:'40%', height:'13%', pointerEvents:'none' }}>
            <svg viewBox="0 0 100 30" preserveAspectRatio="none"
              style={{ width:'100%', height:'100%', overflow:'visible' }}>
              <defs>
                <linearGradient id="arcLipG" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#d8d8e8" stopOpacity="0.97"/>
                  <stop offset="45%"  stopColor="#9898b0" stopOpacity="0.93"/>
                  <stop offset="100%" stopColor="#646478" stopOpacity="0.88"/>
                </linearGradient>
                <linearGradient id="arcMouthBg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#000008"/>
                  <stop offset="100%" stopColor="#010118"/>
                </linearGradient>
                <filter id="arcLipGlow" x="-20%" y="-60%" width="140%" height="220%">
                  <feGaussianBlur stdDeviation="0.65" result="b"/>
                  <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                </filter>
              </defs>
              {lipGap > 0.8 && <path d={mouthFill} fill="url(#arcMouthBg)"/>}
              <path d={upperLip} fill="none" stroke="url(#arcLipG)" strokeWidth="3.6" strokeLinecap="round" filter="url(#arcLipGlow)"/>
              <path d={lowerLip} fill="none" stroke="url(#arcLipG)" strokeWidth="3.6" strokeLinecap="round" filter="url(#arcLipGlow)"/>
              {lipGap > 1.8 && <path d={specular} fill="none" stroke="rgba(255,255,255,0.36)" strokeWidth="1.2" strokeLinecap="round"/>}
            </svg>
          </div>

          {/* ── Left eye — calibrated to face image ─────────────── */}
          <div style={{
            position:'absolute', top:'36%', left:'20%', width:'24%', height:'9%',
            background:`radial-gradient(ellipse 95% 55% at 50% 50%, ${eyeColor} 0%, ${eyeColor}cc 28%, ${eyeColor}44 58%, transparent 82%)`,
            opacity: eyeOpacity,
            mixBlendMode:'screen', pointerEvents:'none',
            transition:'opacity 0.35s ease, background 0.35s ease',
            filter:`blur(2px) drop-shadow(0 0 10px ${eyeColor})`,
            borderRadius:'40% 40% 42% 42% / 55% 55% 45% 45%',
            animation: pulsing ? 'arcEyePulse 1.1s ease-in-out infinite' : 'none',
            transformOrigin:'center center',
          }}/>

          {/* ── Right eye ─────────────────────────────────────────── */}
          <div style={{
            position:'absolute', top:'36%', right:'20%', width:'24%', height:'9%',
            background:`radial-gradient(ellipse 95% 55% at 50% 50%, ${eyeColor} 0%, ${eyeColor}cc 28%, ${eyeColor}44 58%, transparent 82%)`,
            opacity: eyeOpacity,
            mixBlendMode:'screen', pointerEvents:'none',
            transition:'opacity 0.35s ease, background 0.35s ease',
            filter:`blur(2px) drop-shadow(0 0 10px ${eyeColor})`,
            borderRadius:'40% 40% 42% 42% / 55% 55% 45% 45%',
            animation: pulsing ? 'arcEyePulse2 1.1s ease-in-out infinite 0.05s' : 'none',
            transformOrigin:'center center',
          }}/>

          {/* ── Outer chrome rim glow ─────────────────────────────── */}
          <div style={{
            position:'absolute', inset:0, borderRadius:'50%',
            boxShadow:`inset 0 0 24px 4px rgba(255,255,255,0.08), 0 0 40px 6px ${eyeColor}22`,
            pointerEvents:'none', transition:'box-shadow 0.4s ease',
          }}/>
        </div>
      </div>
    );
  };

  export default DestroFace;
  