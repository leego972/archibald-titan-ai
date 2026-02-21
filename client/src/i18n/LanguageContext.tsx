import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { type LanguageCode, type LanguageMeta, SUPPORTED_LANGUAGES, t as translate } from "./translations";

interface LanguageContextValue {
  language: LanguageCode;
  languageMeta: LanguageMeta;
  setLanguage: (code: LanguageCode) => void;
  t: (key: string) => string;
  dir: "ltr" | "rtl";
  supportedLanguages: LanguageMeta[];
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = "archibald-titan-language";

function detectBrowserLanguage(): LanguageCode {
  const browserLang = navigator.language?.split("-")[0]?.toLowerCase();
  const supported = SUPPORTED_LANGUAGES.find((l) => l.code === browserLang);
  return supported ? supported.code : "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && SUPPORTED_LANGUAGES.some((l) => l.code === stored)) {
        return stored as LanguageCode;
      }
    } catch {}
    return detectBrowserLanguage();
  });

  const languageMeta = SUPPORTED_LANGUAGES.find((l) => l.code === language) ?? SUPPORTED_LANGUAGES[0];

  const setLanguage = useCallback((code: LanguageCode) => {
    setLanguageState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {}
  }, []);

  const t = useCallback(
    (key: string) => translate(key, language),
    [language]
  );

  // Update document direction for RTL languages
  useEffect(() => {
    document.documentElement.dir = languageMeta.dir;
    document.documentElement.lang = language;
  }, [language, languageMeta.dir]);

  return (
    <LanguageContext.Provider
      value={{
        language,
        languageMeta,
        setLanguage,
        t,
        dir: languageMeta.dir,
        supportedLanguages: SUPPORTED_LANGUAGES,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return ctx;
}

export { SUPPORTED_LANGUAGES, type LanguageCode, type LanguageMeta };
