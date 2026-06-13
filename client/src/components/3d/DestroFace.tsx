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

  export const DestroFace = ({
    volume: _volume = 0,
    emotion = 'neutral',
  }: {
    volume?: number;
    emotion?: Emotion;
  }) => {
    const eyeColor   = EYE_COLOR[emotion] ?? '#00cc55';
    const eyeOpacity = EYE_INTENSITY[emotion] ?? 0.5;
    const pulsing    = emotion === 'smiling' || emotion === 'laughing' || emotion === 'amused';

    const eyeStyle = (side: 'left' | 'right'): React.CSSProperties => ({
      position: 'absolute',
      top: '37%',
      ...(side === 'left' ? { left: '23%' } : { right: '23%' }),
      width: '20%',
      height: '6%',
      background: `radial-gradient(ellipse 78% 55% at 50% 50%, ${eyeColor} 0%, ${eyeColor}cc 30%, ${eyeColor}55 60%, transparent 100%)`,
      opacity: eyeOpacity,
      mixBlendMode: 'screen',
      pointerEvents: 'none',
      borderRadius: '50%',
      transition: 'opacity 0.35s ease, background 0.35s ease',
      animation: pulsing
        ? `arcEyePulse${side === 'right' ? '2' : ''} 1.1s ease-in-out infinite${side === 'right' ? ' 0.05s' : ''}`
        : 'none',
    });

    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{`
          @keyframes arcEyePulse  { 0%,100%{ opacity: ${eyeOpacity}; } 50%{ opacity: ${Math.min(eyeOpacity * 1.4, 1)}; } }
          @keyframes arcEyePulse2 { 0%,100%{ opacity: ${eyeOpacity}; } 50%{ opacity: ${Math.min(eyeOpacity * 1.4, 1)}; } }
        `}</style>

        <div style={{
          position: 'relative',
          width: '76%',
          aspectRatio: '1/1',
          animation: 'titan-float 3.8s ease-in-out infinite',
          filter: 'drop-shadow(0 8px 32px rgba(30,40,80,0.70))',
        }}>
          {/* Face image */}
          <img
            src="/destro-face.png"
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', userSelect: 'none', pointerEvents: 'none' }}
          />

          {/* Left eye glow — contained inside socket */}
          <div style={eyeStyle('left')} />

          {/* Right eye glow — contained inside socket */}
          <div style={eyeStyle('right')} />

          {/* Subtle outer rim */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            boxShadow: `0 0 28px 2px ${eyeColor}14`,
            pointerEvents: 'none',
            transition: 'box-shadow 0.4s ease',
          }} />
        </div>
      </div>
    );
  };

  export default DestroFace;
  