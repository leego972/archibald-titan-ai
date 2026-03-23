/**
 * FlagIcon — renders a country flag emoji.
 * Emoji flags are natively supported on iOS/macOS/Android.
 * For Windows compatibility, falls back to a globe emoji.
 */

const FLAG_EMOJI_MAP: Record<string, string> = {
  en: "🇬🇧",
  es: "🇪🇸",
  fr: "🇫🇷",
  de: "🇩🇪",
  it: "🇮🇹",
  pt: "🇧🇷",
  ru: "🇷🇺",
  zh: "🇨🇳",
  ja: "🇯🇵",
  ko: "🇰🇷",
  hi: "🇮🇳",
  ar: "🇸🇦",
  he: "🇮🇱",
};

interface FlagIconProps {
  langCode: string;
  size?: number;
}

export function FlagIcon({ langCode, size = 20 }: FlagIconProps) {
  const emoji = FLAG_EMOJI_MAP[langCode] ?? "🌐";

  return (
    <span
      style={{
        fontSize: size,
        lineHeight: 1,
        display: "inline-flex",
        alignItems: "center",
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      {emoji}
    </span>
  );
}
