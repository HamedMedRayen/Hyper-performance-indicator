import { useState, useEffect, createContext, useContext } from "react";
import { getItem, setItem } from "./storage";
import { Capacitor } from "@capacitor/core";

// Web themes
const WEB_THEMES = ["dark", "light", "main", "nature", "fire", "queen", "monochrome", "cyberpunk"];
// Mobile themes
const MOBILE_THEMES = ["dark", "light", "queen", "monochrome"];

// Apply saved theme immediately from localStorage as a fast sync fallback for web
const savedTheme = typeof window !== "undefined"
  ? (localStorage.getItem("aura-theme") || "monochrome")
  : "monochrome";
if (typeof window !== "undefined") {
  document.documentElement.setAttribute("data-theme", savedTheme);
}

export const ThemeContext = createContext({
  theme: "monochrome",
  setTheme: () => { },
  toggle: () => { },
  previewTheme: null,
  setPreviewTheme: () => { }
});

export function useTheme() { return useContext(ThemeContext); }

export function useThemeProvider() {
  const [theme, _setTheme] = useState(savedTheme);
  const [previewTheme, _setPreviewTheme] = useState(null);

  const isNative = typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform();
  const activeThemesList = isNative ? MOBILE_THEMES : WEB_THEMES;

  useEffect(() => {
    async function loadTheme() {
      let stored = await getItem("aura-theme");
      // Fallback if stored theme isn't allowed on mobile
      if (isNative && !MOBILE_THEMES.includes(stored)) {
        stored = "dark";
      }
      if (stored && stored !== theme) {
        document.documentElement.setAttribute("data-theme", stored);
        if (isNative) document.documentElement.setAttribute("data-android-theme", stored);
        _setTheme(stored);
      } else if (isNative) {
        // Enforce native attribute on mount even if theme didn't change
        document.documentElement.setAttribute("data-android-theme", theme);
      }
    }
    loadTheme();
  }, [theme, isNative]);

  const setTheme = (newTheme) => {
    document.documentElement.setAttribute("data-theme", newTheme);
    if (isNative) {
      document.documentElement.setAttribute("data-android-theme", newTheme);
    }
    setItem("aura-theme", newTheme);
    _setTheme(newTheme);
    _setPreviewTheme(null);
  };

  const setPreviewTheme = (preview) => {
    _setPreviewTheme(preview);
    if (preview) {
      document.documentElement.setAttribute("data-theme", preview);
      if (isNative) document.documentElement.setAttribute("data-android-theme", preview);
    } else {
      document.documentElement.setAttribute("data-theme", theme);
      if (isNative) document.documentElement.setAttribute("data-android-theme", theme);
    }
  };

  const toggle = () => {
    const nextTheme = theme === "dark" ? "main" : theme === "main" ? "monochrome" : "dark";
    setTheme(nextTheme);
  };

  return { theme, setTheme, toggle, previewTheme, setPreviewTheme };
}
