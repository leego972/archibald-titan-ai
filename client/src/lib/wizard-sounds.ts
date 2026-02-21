/**
 * Archibald Wizard Sound Effects
 * 
 * Uses the Web Audio API to synthesize magical sound effects programmatically.
 * No external audio files needed — all sounds are generated in real-time.
 * 
 * Volume is kept subtle so sounds enhance the experience without being intrusive.
 */

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext || audioContext.state === "closed") {
    audioContext = new AudioContext();
  }
  if (audioContext.state === "suspended") {
    audioContext.resume();
  }
  return audioContext;
}

// Master volume (0.0 - 1.0). Kept low for subtle, non-intrusive effects.
const MASTER_VOLUME = 0.12;

// Check if user has opted out of wizard sounds
function isMuted(): boolean {
  return localStorage.getItem("archibald-sounds-muted") === "true";
}

export function setWizardSoundsMuted(muted: boolean): void {
  localStorage.setItem("archibald-sounds-muted", muted ? "true" : "false");
}

export function isWizardSoundsMuted(): boolean {
  return isMuted();
}

/**
 * Magical appearance — ascending chime with shimmer
 * Used when Archibald pops into view
 */
export function playAppearSound(): void {
  if (isMuted()) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(MASTER_VOLUME * 0.8, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);

    // Ascending magical chime — three quick notes
    const frequencies = [523.25, 659.25, 783.99]; // C5, E5, G5 (major chord)
    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.1);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.02, now + i * 0.1 + 0.3);
      noteGain.gain.setValueAtTime(0, now + i * 0.1);
      noteGain.gain.linearRampToValueAtTime(MASTER_VOLUME * 0.6, now + i * 0.1 + 0.03);
      noteGain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.5);
      osc.connect(noteGain);
      noteGain.connect(ctx.destination);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.6);
    });

    // Shimmer overlay — high-frequency sparkle
    const shimmer = ctx.createOscillator();
    shimmer.type = "sine";
    shimmer.frequency.setValueAtTime(2000, now);
    shimmer.frequency.exponentialRampToValueAtTime(4000, now + 0.4);
    const shimmerGain = ctx.createGain();
    shimmerGain.gain.setValueAtTime(MASTER_VOLUME * 0.15, now);
    shimmerGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    shimmer.connect(shimmerGain);
    shimmerGain.connect(ctx.destination);
    shimmer.start(now);
    shimmer.stop(now + 0.5);
  } catch {
    // Silently fail — audio is non-critical
  }
}

/**
 * Magical disappearance — descending whoosh with fade
 * Used when Archibald vanishes
 */
export function playDisappearSound(): void {
  if (isMuted()) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Descending tone — reverse of appear
    const frequencies = [783.99, 659.25, 523.25]; // G5, E5, C5
    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.7, now + i * 0.08 + 0.3);
      noteGain.gain.setValueAtTime(MASTER_VOLUME * 0.5, now + i * 0.08);
      noteGain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.4);
      osc.connect(noteGain);
      noteGain.connect(ctx.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.5);
    });

    // Whoosh noise
    const bufferSize = ctx.sampleRate * 0.3;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.3;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.setValueAtTime(2000, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(200, now + 0.3);
    noiseFilter.Q.value = 2;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(MASTER_VOLUME * 0.3, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.3);
  } catch {
    // Silently fail
  }
}

/**
 * Soft click/tap — gentle bell ping
 * Used when clicking on Archibald
 */
export function playClickSound(): void {
  if (isMuted()) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, now); // A5
    osc.frequency.exponentialRampToValueAtTime(1760, now + 0.05);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(MASTER_VOLUME * 0.5, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);

    // Tiny harmonic overtone
    const osc2 = ctx.createOscillator();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1320, now); // E6 (fifth harmonic)
    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0, now);
    gain2.gain.linearRampToValueAtTime(MASTER_VOLUME * 0.2, now + 0.01);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now);
    osc2.stop(now + 0.2);
  } catch {
    // Silently fail
  }
}

/**
 * Roaming/walking — soft footstep-like patter
 * Used when Archibald starts moving to a new position
 */
export function playRoamSound(): void {
  if (isMuted()) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Two quick soft taps like tiny footsteps
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(300 + i * 40, now + i * 0.12);
      osc.frequency.exponentialRampToValueAtTime(200, now + i * 0.12 + 0.08);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now + i * 0.12);
      gain.gain.linearRampToValueAtTime(MASTER_VOLUME * 0.3, now + i * 0.12 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.12);
      osc.stop(now + i * 0.12 + 0.12);
    }
  } catch {
    // Silently fail
  }
}

/**
 * Drag pickup — magical lift sound
 * Used when user starts dragging Archibald
 */
export function playDragStartSound(): void {
  if (isMuted()) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.15);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(MASTER_VOLUME * 0.4, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  } catch {
    // Silently fail
  }
}

/**
 * Drag drop — soft landing thud
 * Used when user releases Archibald after dragging
 */
export function playDragEndSound(): void {
  if (isMuted()) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(250, now + 0.12);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(MASTER_VOLUME * 0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);

    // Soft bounce
    const bounce = ctx.createOscillator();
    bounce.type = "sine";
    bounce.frequency.setValueAtTime(350, now + 0.1);
    bounce.frequency.exponentialRampToValueAtTime(200, now + 0.2);
    const bounceGain = ctx.createGain();
    bounceGain.gain.setValueAtTime(MASTER_VOLUME * 0.2, now + 0.1);
    bounceGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    bounce.connect(bounceGain);
    bounceGain.connect(ctx.destination);
    bounce.start(now + 0.1);
    bounce.stop(now + 0.3);
  } catch {
    // Silently fail
  }
}

/**
 * Speech bubble open — soft pop
 * Used when a speech bubble appears
 */
export function playBubbleSound(): void {
  if (isMuted()) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.04);
    osc.frequency.exponentialRampToValueAtTime(700, now + 0.1);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(MASTER_VOLUME * 0.35, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  } catch {
    // Silently fail
  }
}

/**
 * Toggle on — bright magical activation
 * Used when enabling Archibald from the menu
 */
export function playToggleOnSound(): void {
  if (isMuted()) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Quick ascending arpeggio
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.06);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now + i * 0.06);
      gain.gain.linearRampToValueAtTime(MASTER_VOLUME * 0.4, now + i * 0.06 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.35);
    });
  } catch {
    // Silently fail
  }
}

/**
 * Toggle off — descending deactivation
 * Used when disabling Archibald from the menu
 */
export function playToggleOffSound(): void {
  if (isMuted()) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Quick descending notes
    const notes = [783.99, 659.25, 523.25, 392]; // G5, E5, C5, G4
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, now + i * 0.06);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, now + i * 0.06);
      gain.gain.linearRampToValueAtTime(MASTER_VOLUME * 0.35, now + i * 0.06 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.3);
    });
  } catch {
    // Silently fail
  }
}

/**
 * Minimize — quick descending note
 * Used when minimizing Archibald
 */
export function playMinimizeSound(): void {
  if (isMuted()) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(700, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.15);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(MASTER_VOLUME * 0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  } catch {
    // Silently fail
  }
}

/**
 * Restore from minimize — ascending note
 * Used when restoring Archibald from minimized state
 */
export function playRestoreSound(): void {
  if (isMuted()) return;
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(700, now + 0.15);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(MASTER_VOLUME * 0.4, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);
  } catch {
    // Silently fail
  }
}
