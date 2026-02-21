import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { playToggleOnSound, playToggleOffSound } from "@/lib/wizard-sounds";

const STORAGE_KEY = "archibald-enabled";

interface ArchibaldContextType {
  isEnabled: boolean;
  toggle: () => void;
  setEnabled: (enabled: boolean) => void;
}

const ArchibaldContext = createContext<ArchibaldContextType>({
  isEnabled: true,
  toggle: () => {},
  setEnabled: () => {},
});

export function ArchibaldProvider({ children }: { children: ReactNode }) {
  const [isEnabled, setIsEnabled] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    // Default to enabled if no preference stored
    return stored === null ? true : stored === "true";
  });

  const setEnabled = useCallback((enabled: boolean) => {
    setIsEnabled(enabled);
    localStorage.setItem(STORAGE_KEY, String(enabled));
  }, []);

  const toggle = useCallback(() => {
    if (isEnabled) {
      playToggleOffSound();
    } else {
      playToggleOnSound();
    }
    setEnabled(!isEnabled);
  }, [isEnabled, setEnabled]);

  return (
    <ArchibaldContext.Provider value={{ isEnabled, toggle, setEnabled }}>
      {children}
    </ArchibaldContext.Provider>
  );
}

export function useArchibald() {
  return useContext(ArchibaldContext);
}
