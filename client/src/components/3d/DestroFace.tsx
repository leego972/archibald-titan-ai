import React from 'react';

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

  // Jaw split line as % of image height
  const JAW_CUT = 73;

  export const DestroFace = ({
    volume = 0,
    emotion = 'neutral',
  }: {
    volume?: number;
    emotion?: Emotion;
  }) => {
    const eyeColor   = EYE_COLOR[emotion] ?? '#00cc55';
    const eyeOpacity = EYE_INTENSITY[emotion] ?? 0.5;
    const jawDrop    = Math.min(Math.max(volume, 0), 1) * 22;

    return (
      <div
        style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '76%',
            aspectRatio: '1 / 1',
            animation: 'titan-float 3.8s ease-in-out infinite',
            filter: 'drop-shadow(0 8px 32px rgba(30,40,80,0.70))',
          }}
        >
          {/* Dark backing — visible as mouth gap when jaw drops */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse 60% 40% at 50% 76%, #000 0%, #0a0a0f 100%)',
            borderRadius: '50%',
          }} />

          {/* Upper face — fixed, clipped below jaw line */}
          <img
            src="/destro-face.png"
            alt=""
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'cover',
              clipPath: `inset(0 0 ${100 - JAW_CUT}% 0)`,
              userSelect: 'none', pointerEvents: 'none',
            }}
          />

          {/* Lower jaw — translates down on volume */}
          <img
            src="/destro-face.png"
            alt=""
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'cover',
              clipPath: `inset(${JAW_CUT}% 0 0 0)`,
              transform: `translateY(${jawDrop}px)`,
              transition: 'transform 0.07s ease-out',
              userSelect: 'none', pointerEvents: 'none',
            }}
          />

          {/* LEFT eye glow */}
          <div style={{
            position: 'absolute',
            top: '36%', left: '22%',
            width: '22%', height: '10%',
            background: `radial-gradient(ellipse, ${eyeColor} 0%, ${eyeColor}88 30%, transparent 75%)`,
            opacity: eyeOpacity,
            mixBlendMode: 'screen',
            pointerEvents: 'none',
            transition: 'opacity 0.4s ease, background 0.4s ease',
            filter: `blur(3px) drop-shadow(0 0 8px ${eyeColor})`,
          }} />

          {/* RIGHT eye glow */}
          <div style={{
            position: 'absolute',
            top: '36%', right: '22%',
            width: '22%', height: '10%',
            background: `radial-gradient(ellipse, ${eyeColor} 0%, ${eyeColor}88 30%, transparent 75%)`,
            opacity: eyeOpacity,
            mixBlendMode: 'screen',
            pointerEvents: 'none',
            transition: 'opacity 0.4s ease, background 0.4s ease',
            filter: `blur(3px) drop-shadow(0 0 8px ${eyeColor})`,
          }} />

          {/* Outer chrome rim glow */}
          <div style={{
            position: 'absolute', inset: 0,
            borderRadius: '50%',
            boxShadow: `inset 0 0 24px 4px rgba(255,255,255,0.08), 0 0 40px 6px ${eyeColor}22`,
            pointerEvents: 'none',
            transition: 'box-shadow 0.4s ease',
          }} />
        </div>
      </div>
    );
  };

  export default DestroFace;
  