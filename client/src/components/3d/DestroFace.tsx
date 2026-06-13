import React from 'react';

  export type Emotion =
    | 'neutral' | 'smiling' | 'laughing' | 'serious' | 'empathetic'
    | 'thinking' | 'concerned' | 'amused' | 'friendly_stern' | 'cyber' | 'cinema';

  export type VoiceState = 'idle' | 'listening' | 'speaking';

  const VOICE_COLOR: Record<VoiceState, string> = {
    idle:      '#FFD700',
    listening: '#3B82F6',
    speaking:  '#22C55E',
  };

  const VOICE_INTENSITY: Record<VoiceState, number> = {
    idle:      0.85,
    listening: 0.95,
    speaking:  0.95,
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

  export const DestroFace = ({
    volume: _volume = 0,
    emotion = 'neutral',
    voiceState,
  }: {
    volume?: number;
    emotion?: Emotion;
    voiceState?: VoiceState;
  }) => {
    const eyeColor   = voiceState ? VOICE_COLOR[voiceState]     : (EYE_COLOR[emotion]     ?? '#00cc55');
    const eyeOpacity = voiceState ? VOICE_INTENSITY[voiceState] : (EYE_INTENSITY[emotion] ?? 0.5);
    const pulsing    = voiceState === 'listening'
      || emotion === 'smiling' || emotion === 'laughing' || emotion === 'amused';

    // Outer blurred halo — light spills outward from the socket
    const eyeHalo = (side: 'left' | 'right'): React.CSSProperties => ({
      position:   'absolute',
      top:        '35%',
      ...(side === 'left' ? { left: '20%' } : { right: '20%' }),
      width:      '26%',
      height:     '12%',
      background: eyeColor,
      borderRadius: '50%',
      filter:     'blur(11px)',
      opacity:    eyeOpacity * 0.55,
      mixBlendMode: 'screen',
      pointerEvents: 'none',
      transition: 'opacity 0.35s ease, background 0.35s ease',
      animation:  pulsing
        ? `arcEyeHalo${side === 'right' ? '2' : ''} 1.1s ease-in-out infinite${side === 'right' ? ' 0.05s' : ''}`
        : 'none',
    });

    // Inner bright core — sits exactly inside the socket
    const eyeCore = (side: 'left' | 'right'): React.CSSProperties => ({
      position:   'absolute',
      top:        '37%',
      ...(side === 'left' ? { left: '23%' } : { right: '23%' }),
      width:      '19%',
      height:     '5.5%',
      background: `radial-gradient(ellipse 78% 55% at 50% 50%, ${eyeColor} 0%, ${eyeColor}cc 35%, ${eyeColor}55 65%, transparent 100%)`,
      borderRadius: '50%',
      opacity:    eyeOpacity,
      mixBlendMode: 'screen',
      pointerEvents: 'none',
      transition: 'opacity 0.35s ease, background 0.35s ease',
      animation:  pulsing
        ? `arcEyePulse${side === 'right' ? '2' : ''} 1.1s ease-in-out infinite${side === 'right' ? ' 0.05s' : ''}`
        : 'none',
    });

    const haloOp  = eyeOpacity * 0.55;
    const haloMax = Math.min(eyeOpacity * 0.8, 1);
    const coreMax = Math.min(eyeOpacity * 1.4, 1);

    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <style>{`
          @keyframes arcEyeHalo  { 0%,100%{ opacity: ${haloOp}; } 50%{ opacity: ${haloMax}; } }
          @keyframes arcEyeHalo2 { 0%,100%{ opacity: ${haloOp}; } 50%{ opacity: ${haloMax}; } }
          @keyframes arcEyePulse  { 0%,100%{ opacity: ${eyeOpacity}; } 50%{ opacity: ${coreMax}; } }
          @keyframes arcEyePulse2 { 0%,100%{ opacity: ${eyeOpacity}; } 50%{ opacity: ${coreMax}; } }
        `}</style>

        <div style={{
          position:    'relative',
          width:       '76%',
          aspectRatio: '1/1',
          animation:   'titan-float 3.8s ease-in-out infinite',
          filter:      'drop-shadow(0 8px 32px rgba(30,40,80,0.70))',
        }}>
          <img
            src="/destro-face.png"
            alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', userSelect: 'none', pointerEvents: 'none' }}
          />

          {/* Left eye: blurred outer halo + sharp inner core */}
          <div style={eyeHalo('left')} />
          <div style={eyeCore('left')} />

          {/* Right eye: blurred outer halo + sharp inner core */}
          <div style={eyeHalo('right')} />
          <div style={eyeCore('right')} />

          {/* Subtle rim tint matching eye colour */}
          <div style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            boxShadow: `0 0 28px 2px ${eyeColor}18`,
            pointerEvents: 'none',
            transition: 'box-shadow 0.4s ease',
          }} />
        </div>
      </div>
    );
  };

  export default DestroFace;
  