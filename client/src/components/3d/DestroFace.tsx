import React from 'react';

export type Emotion =
  | 'neutral' | 'smiling' | 'laughing' | 'serious' | 'empathetic'
  | 'thinking' | 'concerned' | 'amused' | 'friendly_stern' | 'cyber' | 'cinema';

const EYE_COLORS: Record<string, string> = {
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

export const DestroFace = ({
  volume = 0,
  emotion = 'neutral',
}: {
  volume?: number;
  emotion?: Emotion;
}) => {
  const c = EYE_COLORS[emotion as string] ?? '#00cc55';
  const jawY = 265 + volume * 22;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <svg
        viewBox="0 0 300 400"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: '100%' }}
      >
        <defs>
          <radialGradient id="fg" cx="35%" cy="28%" r="55%">
            <stop offset="0%" stopColor="#e8ecff" stopOpacity="1" />
            <stop offset="60%" stopColor="#a8aec8" stopOpacity="1" />
            <stop offset="100%" stopColor="#585e80" stopOpacity="1" />
          </radialGradient>
          <radialGradient id="jg" cx="40%" cy="30%" r="60%">
            <stop offset="0%" stopColor="#c0c8e0" stopOpacity="1" />
            <stop offset="100%" stopColor="#505870" stopOpacity="1" />
          </radialGradient>
        </defs>

        <g style={{ animation: 'destro-float 3s ease-in-out infinite' }}>
          {/* Face */}
          <ellipse cx="150" cy="168" rx="118" ry="142" fill="url(#fg)" />
          {/* Sheen */}
          <ellipse cx="120" cy="110" rx="50" ry="40" fill="#ffffff" fillOpacity="0.18" />

          {/* Left eye glow */}
          <circle cx="108" cy="155" r="20" fill={c} fillOpacity="0.25" />
          {/* Left eye */}
          <circle cx="108" cy="155" r="10" fill={c} />
          {/* Left glint */}
          <circle cx="104" cy="151" r="3" fill="#ffffff" fillOpacity="0.8" />

          {/* Right eye glow */}
          <circle cx="192" cy="155" r="20" fill={c} fillOpacity="0.25" />
          {/* Right eye */}
          <circle cx="192" cy="155" r="10" fill={c} />
          {/* Right glint */}
          <circle cx="188" cy="151" r="3" fill="#ffffff" fillOpacity="0.8" />

          {/* Jaw */}
          <ellipse cx="150" cy={jawY} rx="76" ry="40" fill="url(#jg)" />
          <ellipse cx="138" cy={jawY - 10} rx="38" ry="14" fill="#ffffff" fillOpacity="0.08" />
        </g>

        <style>{`
          @keyframes destro-float {
            0%, 100% { transform: translateY(0px); }
            50%       { transform: translateY(-10px); }
          }
        `}</style>
      </svg>
    </div>
  );
};
