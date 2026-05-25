import React from 'react';

export type Emotion =
  | 'neutral' | 'smiling' | 'laughing' | 'serious' | 'empathetic'
  | 'thinking' | 'concerned' | 'amused' | 'friendly_stern' | 'cyber' | 'cinema';

const EYE_COLOR: Record<Emotion, string> = {
  neutral:        '#00cc55',
  smiling:        '#00cc55',
  empathetic:     '#00cc88',
  thinking:       '#1a7fff',
  serious:        '#1a7fff',
  concerned:      '#ff3300',
  cyber:          '#ff2200',
  friendly_stern: '#00eedd',
  amused:         '#00eedd',
  laughing:       '#00eedd',
  cinema:         '#00ff44',
};

export const DestroFace = ({
  volume  = 0,
  emotion = 'neutral',
}: {
  volume?:  number;
  emotion?: Emotion;
}) => {
  const eyeColor = EYE_COLOR[emotion] ?? '#00cc55';
  const jawDrop  = volume * 22;
  const eyeBlur  = 5 + volume * 10;
  const eyePulse = 1 + volume * 0.25;
  const jawTransform = 'translate(0,' + jawDrop + ')';
  const eyeLTransform = 'scale(' + eyePulse + ')';
  const eyeRTransform = 'scale(' + eyePulse + ')';

  return (
    <div
      style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <svg
        viewBox="0 0 400 480"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: '100%' }}
      >
        <defs>
          <linearGradient id="df-g1" x1="0.15" y1="0" x2="0.85" y2="1">
            <stop offset="0%"   stopColor="#e2e6f8"/>
            <stop offset="22%"  stopColor="#b0b8d8"/>
            <stop offset="50%"  stopColor="#c8d0ec"/>
            <stop offset="78%"  stopColor="#8890b8"/>
            <stop offset="100%" stopColor="#585e80"/>
          </linearGradient>

          <radialGradient id="df-sheen" cx="32%" cy="26%" r="42%">
            <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.65"/>
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0"/>
          </radialGradient>

          <radialGradient id="df-rim" cx="50%" cy="50%" r="50%">
            <stop offset="70%"  stopColor="#000000" stopOpacity="0"/>
            <stop offset="100%" stopColor="#000000" stopOpacity="0.45"/>
          </radialGradient>

          <linearGradient id="df-jaw" x1="0.2" y1="0" x2="0.8" y2="1">
            <stop offset="0%"   stopColor="#b8c0d8"/>
            <stop offset="100%" stopColor="#585870"/>
          </linearGradient>

          <filter id="df-eg" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={eyeBlur} result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>

          <filter id="df-sh" x="-15%" y="-10%" width="130%" height="130%">
            <feDropShadow dx="0" dy="6" stdDeviation="14" floodColor="#000000" floodOpacity="0.7"/>
          </filter>
        </defs>

        <g style={{ animation: 'df-float 3.2s ease-in-out infinite' }}>
          <ellipse cx="200" cy="210" rx="148" ry="178" fill="url(#df-g1)" filter="url(#df-sh)"/>
          <ellipse cx="200" cy="210" rx="148" ry="178" fill="url(#df-sheen)"/>
          <ellipse cx="200" cy="210" rx="148" ry="178" fill="url(#df-rim)"/>

          <path d="M72 185 Q90 178 125 180" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.18" fill="none" strokeLinecap="round"/>
          <path d="M328 185 Q310 178 275 180" stroke="#ffffff" strokeWidth="1" strokeOpacity="0.18" fill="none" strokeLinecap="round"/>
          <path d="M72 220 Q90 228 125 226" stroke="#000000" strokeWidth="0.8" strokeOpacity="0.12" fill="none" strokeLinecap="round"/>
          <path d="M328 220 Q310 228 275 226" stroke="#000000" strokeWidth="0.8" strokeOpacity="0.12" fill="none" strokeLinecap="round"/>

          <circle cx="148" cy="192" r="22" fill={eyeColor} opacity="0.55"
            filter="url(#df-eg)" transform={eyeLTransform}
            style={{ transformOrigin: '148px 192px', transition: 'fill 0.3s' }}/>
          <circle cx="252" cy="192" r="22" fill={eyeColor} opacity="0.55"
            filter="url(#df-eg)" transform={eyeRTransform}
            style={{ transformOrigin: '252px 192px', transition: 'fill 0.3s' }}/>
          <circle cx="148" cy="192" r="11" fill={eyeColor} style={{ transition: 'fill 0.3s' }}/>
          <circle cx="252" cy="192" r="11" fill={eyeColor} style={{ transition: 'fill 0.3s' }}/>
          <circle cx="143" cy="188" r="3.5" fill="#ffffff" opacity="0.75"/>
          <circle cx="247" cy="188" r="3.5" fill="#ffffff" opacity="0.75"/>

          <g transform={jawTransform}>
            <ellipse cx="200" cy="326" rx="78" ry="7" fill="#000000" opacity="0.35"/>
            <ellipse cx="200" cy="342" rx="90" ry="44" fill="url(#df-jaw)" filter="url(#df-sh)"/>
            <ellipse cx="193" cy="332" rx="55" ry="16" fill="#ffffff" opacity="0.10"/>
            <ellipse cx="200" cy="342" rx="90" ry="44" fill="url(#df-rim)" opacity="0.6"/>
          </g>
        </g>

        <style>{`
          @keyframes df-float {
            0%, 100% { transform: translateY(0px)  rotate(0deg); }
            30%       { transform: translateY(-9px) rotate(-0.4deg); }
            70%       { transform: translateY(-5px) rotate(0.3deg); }
          }
        `}</style>
      </svg>
    </div>
  );
};
