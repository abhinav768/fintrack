import { useCallback, useEffect, useState } from "react";

const KEY = "theme";
const THEME_COLORS = { light: "#F4F1EA", dark: "#0A0A0B" };

export const currentTheme = () =>
  document.documentElement.classList.contains("dark") ? "dark" : "light";

function apply(theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[theme]);
}

export function useTheme() {
  const [theme, setTheme] = useState(currentTheme);

  useEffect(() => {
    const sync = (e) => {
      if (e.key === KEY && e.newValue) {
        apply(e.newValue);
        setTheme(e.newValue);
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const toggle = useCallback(() => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    apply(next);
    localStorage.setItem(KEY, next);
    setTheme(next);
  }, []);

  return { theme, toggle };
}
