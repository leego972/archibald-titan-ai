import React from 'react';

export type Emotion =
  | 'neutral' | 'smiling' | 'laughing' | 'serious' | 'empathetic'
  | 'thinking' | 'concerned' | 'amused' | 'friendly_stern' | 'cyber' | 'cinema';

const EYE_COLOR: { [k: string]: string } = {
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

// Positive = brow moves down (furrowed), negative = raises
const BROW_DROP: { [k: string]: number } = {
  concerned:      8,
  thinking:       6,
  cyber:          6,
  serious:        3,
  friendly_stern: 2,
  neutral:        0,
  empathetic:    -1,
  amused:        -2,
  smiling:       -3,
  cinema:         1,
  laughing:      -5,
};

const HEAD =
  'M 200 20 C 258 20 316 56 342 114 C 364 162 368 216 358 270 ' +
  'C 344 328 318 374 292 408 C 266 438 234 462 200 470 ' +
  'C 166 462 134 438 108 408 C 82 374 56 328 42 270 ' +
  'C 32 216 36 162 58 114 C 84 56 142 20 200 20 Z';

export const DestroFace = ({
  volume = 0,
  emotion = 'neutral',
}: {
  volume?: number;
  emotion?: Emotion;
}) => {
  const eyeC  = EYE_COLOR[emotion]  ?? '#00cc55';
  const browDY = BROW_DROP[emotion] ?? 0;
  const jaw   = Math.min(Math.max(volume, 0), 1) * 28;

  return (
    <div
      style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <svg
        viewBox="0 0 400 520"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          width: '80%', maxHeight: '90%',
          animation: 'titan-float 3.8s ease-in-out infinite',
          filter: 'drop-shadow(0 6px 28px rgba(50,60,100,0.60))',
        }}
      >
        <defs>
          {/* Chrome base — pearl-silver radial */}
          <radialGradient id="tg-face" cx="38%" cy="26%" r="70%">
            <stop offset="0%"   stopColor="#eff1f9" />
            <stop offset="20%"  stopColor="#cdd3e6" />
            <stop offset="52%"  stopColor="#9ba2bc" />
            <stop offset="82%"  stopColor="#71798f" />
            <stop offset="100%" stopColor="#575d72" />
          </radialGradient>

          {/* Iridescent shimmer overlay */}
          <linearGradient id="tg-irid" x1="8%" y1="4%" x2="92%" y2="96%">
            <stop offset="0%"   stopColor="#dfc8e2" stopOpacity="0.50" />
            <stop offset="28%"  stopColor="#c8dff8" stopOpacity="0.38" />
            <stop offset="52%"  stopColor="#ffffff" stopOpacity="0.08" />
            <stop offset="76%"  stopColor="#c0f0e6" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#f8e0c4" stopOpacity="0.38" />
          </linearGradient>

          {/* Strong specular on forehead */}
          <radialGradient id="tg-spec" cx="36%" cy="16%" r="30%">
            <stop offset="0%"   stopColor="#ffffff" stopOpacity="0.82" />
            <stop offset="60%"  stopColor="#ffffff" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0.00" />
          </radialGradient>

          {/* Raised-surface chrome (brows, nose, lips, chin) */}
          <linearGradient id="tg-raised" x1="0%" y1="0%" x2="15%" y2="100%">
            <stop offset="0%"   stopColor="#dce2f2" />
            <stop offset="100%" stopColor="#888ea6" />
          </linearGradient>

          {/* Dark groove fill */}
          <radialGradient id="tg-groove" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#1a1e28" />
            <stop offset="100%" stopColor="#3c4252" />
          </radialGradient>

          {/* Left eye glow */}
          <radialGradient id="tg-eyl" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={eyeC} stopOpacity="1.00" />
            <stop offset="48%"  stopColor={eyeC} stopOpacity="0.55" />
            <stop offset="100%" stopColor={eyeC} stopOpacity="0.00" />
          </radialGradient>

          {/* Right eye glow */}
          <radialGradient id="tg-eyr" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor={eyeC} stopOpacity="1.00" />
            <stop offset="48%"  stopColor={eyeC} stopOpacity="0.55" />
            <stop offset="100%" stopColor={eyeC} stopOpacity="0.00" />
          </radialGradient>
        </defs>

        {/* ── EARS ─────────────────────────────────── */}
        <path
          d="M 54 205 C 40 218 30 240 32 260 C 34 280 48 296 62 300
             C 56 286 50 270 50 252 C 50 236 52 218 54 205 Z"
          fill="url(#tg-raised)"
        />
        <path
          d="M 346 205 C 360 218 370 240 368 260 C 366 280 352 296 338 300
             C 344 286 350 270 350 252 C 350 236 348 218 346 205 Z"
          fill="url(#tg-raised)"
        />

        {/* ── HEAD ─────────────────────────────────── */}
        <path d={HEAD} fill="url(#tg-face)" />
        <path d={HEAD} fill="url(#tg-irid)" />
        <path d={HEAD} fill="url(#tg-spec)" />

        {/* ── BROW RIDGES (animate with emotion) ───── */}
        <g
          transform={`translate(0,${browDY})`}
          style={{ transition: 'transform 0.38s ease' }}
        >
          {/* Left brow — slopes steeply inward for permanent scowl */}
          <path
            d="M 90 196 C 102 174 126 164 150 166
               C 166 168 177 178 177 187
               C 168 193 148 194 130 192
               C 112 194 96 198 90 196 Z"
            fill="url(#tg-raised)"
            stroke="#484e60" strokeWidth="0.7"
          />
          {/* Right brow — mirror */}
          <path
            d="M 310 196 C 298 174 274 164 250 166
               C 234 168 223 178 223 187
               C 232 193 252 194 270 192
               C 288 194 304 198 310 196 Z"
            fill="url(#tg-raised)"
            stroke="#484e60" strokeWidth="0.7"
          />
          {/* Glabellar crease — the V between brows */}
          <path
            d="M 177 187 C 183 172 191 165 200 167 C 209 165 217 172 223 187"
            fill="none" stroke="#383e50" strokeWidth="2.2" strokeLinecap="round"
          />
          {/* Brow underside shadow (adds depth above socket) */}
          <path
            d="M 90 196 C 110 200 148 200 177 187 C 168 198 148 202 130 202
               C 112 204 96 202 90 196 Z"
            fill="#383e52" fillOpacity="0.55"
          />
          <path
            d="M 310 196 C 290 200 252 200 223 187 C 232 198 252 202 270 202
               C 288 204 304 202 310 196 Z"
            fill="#383e52" fillOpacity="0.55"
          />
        </g>

        {/* ── EYE SOCKETS (follow brow slightly) ──── */}
        <g
          transform={`translate(0,${browDY * 0.28})`}
          style={{ transition: 'transform 0.38s ease' }}
        >
          {/* Left — almond hollow */}
          <path
            d="M 90 212 C 104 190 130 180 156 188
               C 174 196 182 212 170 226
               C 154 238 112 236 96 224 Z"
            fill="#07090e"
            stroke="url(#tg-raised)" strokeWidth="2.8"
          />
          {/* Left eye glow (inside socket) */}
          <ellipse cx="134" cy="208" rx="28" ry="17" fill="url(#tg-eyl)" opacity="0.92" />

          {/* Right — almond hollow */}
          <path
            d="M 310 212 C 296 190 270 180 244 188
               C 226 196 218 212 230 226
               C 246 238 288 236 304 224 Z"
            fill="#07090e"
            stroke="url(#tg-raised)" strokeWidth="2.8"
          />
          {/* Right eye glow */}
          <ellipse cx="266" cy="208" rx="28" ry="17" fill="url(#tg-eyr)" opacity="0.92" />
        </g>

        {/* ── NOSE ─────────────────────────────────── */}
        {/* Bridge left edge */}
        <path
          d="M 190 188 C 186 216 183 244 184 268 C 185 280 190 290 196 294"
          fill="none" stroke="#586070" strokeWidth="1.5" strokeLinecap="round"
        />
        {/* Bridge right edge */}
        <path
          d="M 210 188 C 214 216 217 244 216 268 C 215 280 210 290 204 294"
          fill="none" stroke="#586070" strokeWidth="1.5" strokeLinecap="round"
        />
        {/* Nose tip */}
        <path
          d="M 180 290 C 180 304 188 312 200 314
             C 212 312 220 304 220 290
             C 216 286 212 288 210 294 C 206 300 200 302 200 302
             C 200 302 194 300 190 294 C 188 288 184 286 180 290 Z"
          fill="url(#tg-raised)" stroke="#484e5e" strokeWidth="0.9"
        />
        {/* Nostrils */}
        <ellipse cx="188" cy="298" rx="5.5" ry="4.2" fill="#0c0e16" transform="rotate(-14,188,298)" />
        <ellipse cx="212" cy="298" rx="5.5" ry="4.2" fill="#0c0e16" transform="rotate(14,212,298)" />

        {/* ── NASOLABIAL FOLDS ──────────────────────── */}
        <path
          d="M 180 292 C 170 314 165 337 168 358"
          fill="none" stroke="#3e4656" strokeWidth="2.0" strokeLinecap="round"
        />
        <path
          d="M 220 292 C 230 314 235 337 232 358"
          fill="none" stroke="#3e4656" strokeWidth="2.0" strokeLinecap="round"
        />

        {/* ── UPPER LIP (fixed) ────────────────────── */}
        <path
          d="M 162 358 C 172 352 184 348 200 350
             C 216 348 228 352 238 358
             C 228 362 216 364 200 364
             C 184 364 172 362 162 358 Z"
          fill="url(#tg-raised)" stroke="#404858" strokeWidth="0.9"
        />
        {/* Philtrum (centre dip of upper lip) */}
        <path
          d="M 196 350 C 198 346 202 346 204 350"
          fill="none" stroke="#505868" strokeWidth="1.3" strokeLinecap="round"
        />

        {/* ── MOUTH GAP — expands with volume ─────── */}
        <ellipse
          cx="200" cy="365"
          rx={8 + jaw * 0.75}
          ry={1.5 + jaw * 0.48}
          fill="#06070c"
        />

        {/* ── JAW GROUP — drops with volume ────────── */}
        <g
          transform={`translate(0,${jaw})`}
          style={{ transition: 'transform 0.04s linear' }}
        >
          {/* Lower lip */}
          <path
            d="M 166 368 C 178 376 190 381 200 383
               C 210 381 222 376 234 368
               C 226 378 214 386 200 388
               C 186 386 174 378 166 368 Z"
            fill="url(#tg-raised)" stroke="#404858" strokeWidth="0.9"
          />
          {/* Chin mass */}
          <path
            d="M 160 396 C 162 420 173 442 200 452
               C 227 442 238 420 240 396
               C 228 408 214 414 200 414
               C 186 414 172 408 160 396 Z"
            fill="url(#tg-raised)"
          />
          {/* Chin highlight */}
          <ellipse cx="200" cy="436" rx="24" ry="11" fill="#c8d4e6" fillOpacity="0.18" />
          {/* Chin underside shadow */}
          <path
            d="M 166 448 C 178 458 192 464 200 466
               C 208 464 222 458 234 448
               C 222 454 210 458 200 458
               C 190 458 178 454 166 448 Z"
            fill="#484e60" fillOpacity="0.35"
          />
        </g>

        {/* ── SURFACE DETAILS & HIGHLIGHTS ─────────── */}
        {/* Main forehead sheen */}
        <ellipse
          cx="168" cy="86" rx="62" ry="48"
          fill="#ffffff" fillOpacity="0.22"
          transform="rotate(-9,168,86)"
        />
        {/* Secondary cheek sheen L */}
        <ellipse
          cx="108" cy="270" rx="30" ry="18"
          fill="#ccd6e8" fillOpacity="0.14"
          transform="rotate(-20,108,270)"
        />
        {/* Secondary cheek sheen R */}
        <ellipse
          cx="292" cy="270" rx="30" ry="18"
          fill="#ccd6e8" fillOpacity="0.14"
          transform="rotate(20,292,270)"
        />
        {/* Nose-bridge glint */}
        <rect x="197" y="200" width="6" height="76" rx="3" fill="#ffffff" fillOpacity="0.13" />
        {/* Lower face / jaw chrome glint */}
        <ellipse cx="200" cy="338" rx="38" ry="16" fill="#ccd4e6" fillOpacity="0.12" />

        <style>{`
          @keyframes titan-float {
            0%,100% { transform: translateY(0px)   rotate(0deg);   }
            33%     { transform: translateY(-10px)  rotate(-0.3deg); }
            66%     { transform: translateY(-5px)   rotate(0.22deg); }
          }
        `}</style>
      </svg>
    </div>
  );
};
