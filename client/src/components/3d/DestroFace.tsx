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
      const eyeColor   = voiceState ? VOICE_COLOR[voiceState] : (EYE_COLOR[emotion]     ?? '#00cc55');
      const eyeOpacity = voiceState ? 1.0                     : (EYE_INTENSITY[emotion] ?? 0.5);
      const pulsing    = voiceState === 'listening'
        || emotion === 'smiling' || emotion === 'laughing' || emotion === 'amused';

      // Glow sits ON TOP of the face image (zIndex 2) with mix-blend-mode:screen.
      // Screen blend: bright silver areas of the mask wash out the glow (looks hidden),
      // dark eye-socket areas let the glow show through brightly — giving a
      // "glowing from within the sockets" effect without needing image transparency.

      // Wide diffuse halo — soft spill around the socket
      const haloStyle = (side: 'left' | 'right'): React.CSSProperties => ({
        position:      'absolute',
        zIndex:        2,
        top:           '29%',
        ...(side === 'left' ? { left: '20%' } : { right: '20%' }),
        width:         '26%',
        height:        '10%',
        background:    eyeColor,
        borderRadius:  '50%',
        filter:        'blur(14px)',
        opacity:       eyeOpacity * 0.7,
        mixBlendMode:  'screen',
        pointerEvents: 'none',
        transition:    'opacity 0.3s ease, background 0.3s ease',
        animation:     pulsing
          ? `dfHalo${side === 'right' ? 'R' : 'L'} 1.1s ease-in-out infinite${side === 'right' ? ' 0.06s' : ''}`
          : 'none',
      });

      // Tight bright core — concentrated inside the socket
      const coreStyle = (side: 'left' | 'right'): React.CSSProperties => ({
        position:      'absolute',
        zIndex:        2,
        top:           '31%',
        ...(side === 'left' ? { left: '23%' } : { right: '23%' }),
        width:         '18%',
        height:        '6%',
        background:    `radial-gradient(ellipse 80% 60% at 50% 50%, ${eyeColor} 0%, ${eyeColor}dd 30%, ${eyeColor}66 65%, transparent 100%)`,
        borderRadius:  '50%',
        filter:        'blur(2px)',
        opacity:       eyeOpacity,
        mixBlendMode:  'screen',
        pointerEvents: 'none',
        transition:    'opacity 0.3s ease, background 0.3s ease',
        animation:     pulsing
          ? `dfCore${side === 'right' ? 'R' : 'L'} 1.1s ease-in-out infinite${side === 'right' ? ' 0.06s' : ''}`
          : 'none',
      });

      const hOp  = eyeOpacity * 0.7;
      const hMax = Math.min(eyeOpacity * 0.95, 1);
      const cMax = Math.min(eyeOpacity * 1.3, 1);

      return (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <style>{`
            @keyframes dfHaloL { 0%,100%{ opacity:${hOp}; } 50%{ opacity:${hMax}; } }
            @keyframes dfHaloR { 0%,100%{ opacity:${hOp}; } 50%{ opacity:${hMax}; } }
            @keyframes dfCoreL { 0%,100%{ opacity:${eyeOpacity}; } 50%{ opacity:${cMax}; } }
            @keyframes dfCoreR { 0%,100%{ opacity:${eyeOpacity}; } 50%{ opacity:${cMax}; } }
          `}</style>

          <div style={{
            position:    'relative',
            width:       '76%',
            aspectRatio: '1/1',
            animation:   'titan-float 3.8s ease-in-out infinite',
          }}>
            {/* Face image — z-index 1, solid on top of background */}
            <img
              src="/destro-face.png"
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

            {/* Glow layers — z-index 2, mix-blend-mode:screen over the face.
                Bright silver areas wash the glow out; dark eye sockets let it bleed through. */}
            <div style={haloStyle('left')}  />
            <div style={coreStyle('left')}  />
            <div style={haloStyle('right')} />
            <div style={coreStyle('right')} />

            {/* Ambient outer glow rim */}
            <div style={{
              position:     'absolute',
              inset:        0,
              zIndex:       3,
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
  