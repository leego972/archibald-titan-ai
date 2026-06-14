import React, { useEffect, useState } from 'react';

    export type Emotion =
      | 'neutral' | 'smiling' | 'laughing' | 'serious' | 'empathetic'
      | 'thinking' | 'concerned' | 'amused' | 'friendly_stern' | 'cyber' | 'cinema';

    export type VoiceState = 'idle' | 'listening' | 'speaking';

    const VOICE_COLOR: Record<VoiceState, string> = {
      idle:      '#FFD700',
      listening: '#3B82F6',
      speaking:  '#22C55E',
    };

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

    // Pixel coords of eye socket centres in the 1254×1254 source image.
    // Used both for canvas punching and CSS alignment.
    const EYE_L = { cx: 430, cy: 488, rx: 82, ry: 28 };
    const EYE_R = { cx: 824, cy: 488, rx: 77, ry: 28 };
    const IMG_SIZE = 1254;

    /** Cut transparent eye-socket holes via canvas destination-out compositing. */
    function useTransparentFace(src: string): string {
      const [dataUrl, setDataUrl] = useState(src);
      useEffect(() => {
        const img = new Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width  = img.naturalWidth  || IMG_SIZE;
            canvas.height = img.naturalHeight || IMG_SIZE;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            ctx.drawImage(img, 0, 0);
            // Soft feathered punch-out
            ctx.filter = 'blur(7px)';
            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath();
            ctx.ellipse(EYE_L.cx, EYE_L.cy, EYE_L.rx, EYE_L.ry, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(EYE_R.cx, EYE_R.cy, EYE_R.rx, EYE_R.ry, 0, 0, Math.PI * 2);
            ctx.fill();
            setDataUrl(canvas.toDataURL('image/png'));
          } catch {
            // Fallback: show original if canvas fails
          }
        };
        img.src = src;
      }, [src]);
      return dataUrl;
    }

    export const DestroFace = ({
      volume: _volume = 0,
      emotion = 'neutral',
      voiceState,
    }: {
      volume?: number;
      emotion?: Emotion;
      voiceState?: VoiceState;
    }) => {
      const faceSrc = useTransparentFace('/destro-face.png');

      const eyeColor   = voiceState ? VOICE_COLOR[voiceState] : (EYE_COLOR[emotion]     ?? '#00cc55');
      const eyeOpacity = voiceState ? 1.0                     : (EYE_INTENSITY[emotion] ?? 0.5);
      const pulsing    = voiceState === 'listening'
        || emotion === 'smiling' || emotion === 'laughing' || emotion === 'amused';

      // CSS positions derived from pixel coords so glow aligns with the canvas holes.
      // left/right = center% minus half-width%; top = center% minus half-height%.
      // Shifted ~2% up and ~2% closer together per user feedback.
      const haloW = 27; // % width of halo div
      const coreW = 19; // % width of core div
      const eyeLPct  = (EYE_L.cx / IMG_SIZE) * 100; // 34.3%
      const eyeRPct  = ((IMG_SIZE - EYE_R.cx) / IMG_SIZE) * 100; // 34.3% from right
      const eyeYPct  = (EYE_L.cy / IMG_SIZE) * 100; // 38.9%

      // Halo
      const haloStyle = (side: 'left' | 'right'): React.CSSProperties => ({
        position:      'absolute',
        zIndex:        0,
        top:           `${eyeYPct - 7}%`,   // slightly above center
        ...(side === 'left'
          ? { left: `${eyeLPct - haloW / 2 + 2}%` }   // +2 = closer together
          : { right: `${eyeRPct - haloW / 2 + 2}%` }),
        width:         `${haloW}%`,
        height:        '11%',
        background:    eyeColor,
        borderRadius:  '50%',
        filter:        'blur(16px)',
        opacity:       eyeOpacity * 0.95,
        pointerEvents: 'none',
        transition:    'opacity 0.3s ease, background 0.3s ease',
        animation:     pulsing
          ? `dfHalo${side === 'right' ? 'R' : 'L'} 1.1s ease-in-out infinite${side === 'right' ? ' 0.06s' : ''}`
          : 'none',
      });

      // Core
      const coreStyle = (side: 'left' | 'right'): React.CSSProperties => ({
        position:      'absolute',
        zIndex:        0,
        top:           `${eyeYPct - 3}%`,
        ...(side === 'left'
          ? { left: `${eyeLPct - coreW / 2 + 2}%` }
          : { right: `${eyeRPct - coreW / 2 + 2}%` }),
        width:         `${coreW}%`,
        height:        '6%',
        background:    `radial-gradient(ellipse 85% 65% at 50% 50%, ${eyeColor} 0%, ${eyeColor}ee 25%, ${eyeColor}88 55%, transparent 100%)`,
        borderRadius:  '50%',
        filter:        'blur(2px)',
        opacity:       eyeOpacity,
        pointerEvents: 'none',
        transition:    'opacity 0.3s ease, background 0.3s ease',
        animation:     pulsing
          ? `dfCore${side === 'right' ? 'R' : 'L'} 1.1s ease-in-out infinite${side === 'right' ? ' 0.06s' : ''}`
          : 'none',
      });

      const hOp  = eyeOpacity * 0.95;
      const hMax = Math.min(eyeOpacity * 1.15, 1);
      const cMax = Math.min(eyeOpacity * 1.4,  1);

      return (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <style>{`
            @keyframes dfHaloL { 0%,100%{ opacity:${hOp};         } 50%{ opacity:${hMax}; } }
            @keyframes dfHaloR { 0%,100%{ opacity:${hOp};         } 50%{ opacity:${hMax}; } }
            @keyframes dfCoreL { 0%,100%{ opacity:${eyeOpacity};  } 50%{ opacity:${cMax}; } }
            @keyframes dfCoreR { 0%,100%{ opacity:${eyeOpacity};  } 50%{ opacity:${cMax}; } }
          `}</style>

          <div style={{
            position:    'relative',
            width:       '76%',
            aspectRatio: '1/1',
            animation:   'titan-float 3.8s ease-in-out infinite',
          }}>
            {/* Glow layers — zIndex 0, sit BEHIND the face */}
            <div style={haloStyle('left')}  />
            <div style={coreStyle('left')}  />
            <div style={haloStyle('right')} />
            <div style={coreStyle('right')} />

            {/* Face — zIndex 1, canvas-punched eye socket holes let the glow through */}
            <img
              src={faceSrc}
              alt=""
              style={{
                position:     'absolute',
                inset:        0,
                zIndex:       1,
                width:        '100%',
                height:       '100%',
                objectFit:    'cover',
                userSelect:   'none',
                pointerEvents:'none',
              }}
            />

            {/* Ambient outer rim glow */}
            <div style={{
              position:     'absolute',
              inset:        0,
              zIndex:       2,
              borderRadius: '50%',
              boxShadow:    `0 0 40px 6px ${eyeColor}22`,
              pointerEvents:'none',
              transition:   'box-shadow 0.4s ease',
            }} />
          </div>
        </div>
      );
    };

    export default DestroFace;
  