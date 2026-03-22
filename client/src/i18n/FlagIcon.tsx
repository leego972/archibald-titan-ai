/**
 * FlagIcon — renders a country flag as an SVG image.
 * Uses country-flag-icons package for proper rendering on all platforms including Windows
 * which does not support flag emoji natively.
 */

import GB from "country-flag-icons/react/3x2/GB";
import ES from "country-flag-icons/react/3x2/ES";
import FR from "country-flag-icons/react/3x2/FR";
import DE from "country-flag-icons/react/3x2/DE";
import IT from "country-flag-icons/react/3x2/IT";
import BR from "country-flag-icons/react/3x2/BR";
import RU from "country-flag-icons/react/3x2/RU";
import CN from "country-flag-icons/react/3x2/CN";
import JP from "country-flag-icons/react/3x2/JP";
import KR from "country-flag-icons/react/3x2/KR";
import IN from "country-flag-icons/react/3x2/IN";
import SA from "country-flag-icons/react/3x2/SA";
import IL from "country-flag-icons/react/3x2/IL";
import type { ComponentType } from "react";

type FlagProps = { className?: string; title?: string };

const FLAG_MAP: Record<string, ComponentType<FlagProps>> = {
  en: GB,
  es: ES,
  fr: FR,
  de: DE,
  it: IT,
  pt: BR,
  ru: RU,
  zh: CN,
  ja: JP,
  ko: KR,
  hi: IN,
  ar: SA,
  he: IL,
};

interface FlagIconProps {
  langCode: string;
  size?: number;
}

export function FlagIcon({ langCode, size = 20 }: FlagIconProps) {
  const FlagComponent = FLAG_MAP[langCode];
  const width = Math.round(size * 1.33);

  if (!FlagComponent) {
    return (
      <span
        style={{ width, height: size, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
      >
        🌐
      </span>
    );
  }

  return (
    <span
      style={{ width, height: size, display: "inline-flex", flexShrink: 0, overflow: "hidden", borderRadius: 2 }}
    >
      <FlagComponent
        className="w-full h-full"
        title={langCode}
      />
    </span>
  );
}
