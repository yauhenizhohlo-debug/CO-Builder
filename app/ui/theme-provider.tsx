"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type ProductTheme = "classic" | "enterprise-light";

type ThemeContextValue = {
  theme: ProductTheme;
  setTheme: (theme: ProductTheme) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const STORAGE_KEY = "cosmos-builder-theme";

export function ThemeProvider({
  children,
  defaultTheme = "classic",
}: {
  children: ReactNode;
  defaultTheme?: ProductTheme;
}) {
  const [theme, setTheme] = useState<ProductTheme>(defaultTheme);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(STORAGE_KEY);
    if (savedTheme === "classic" || savedTheme === "enterprise-light") {
      const frame = window.requestAnimationFrame(() => setTheme(savedTheme));
      return () => window.cancelAnimationFrame(frame);
    }
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    setTheme: (nextTheme) => {
      setTheme(nextTheme);
      window.localStorage.setItem(STORAGE_KEY, nextTheme);
    },
  }), [theme]);

  return (
    <ThemeContext.Provider value={value}>
      <div className="product-theme min-h-screen" data-theme={theme}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useProductTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useProductTheme must be used inside ThemeProvider");
  return context;
}
