import { useState, useRef, useEffect } from "react";
import { useLanguage } from "./LanguageContext";

/**
 * Compact language selector dropdown.
 * Shows current language flag + code, expands to show all 12 languages.
 */
export function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { language, languageMeta, setLanguage, supportedLanguages, t } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1.5 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-600"
        title={t("common.language")}
        aria-label={t("common.language")}
      >
        <span className="text-base">{languageMeta.flag}</span>
        {!compact && (
          <span className="text-gray-700 dark:text-gray-300 font-medium">
            {language.toUpperCase()}
          </span>
        )}
        <svg
          className={`w-3 h-3 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute bottom-full mb-1 left-0 z-50 w-56 max-h-80 overflow-y-auto rounded-lg shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 py-1"
          role="listbox"
          aria-label={t("common.language")}
        >
          {supportedLanguages.map((lang) => (
            <button
              key={lang.code}
              role="option"
              aria-selected={lang.code === language}
              onClick={() => {
                setLanguage(lang.code);
                setOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors ${
                lang.code === language
                  ? "bg-blue-50 dark:bg-gray-700 text-blue-700 dark:text-blue-400 font-semibold"
                  : "text-gray-700 dark:text-gray-300"
              }`}
            >
              <span className="text-lg">{lang.flag}</span>
              <span className="flex-1 text-left">{lang.nativeName}</span>
              <span className="text-xs text-gray-400 uppercase">{lang.code}</span>
              {lang.code === language && (
                <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
