import { useEffect, useState } from "react";

function applyTheme(theme) {
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => localStorage.getItem("acse_theme") || "light");

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("acse_theme", theme);
  }, [theme]);

  return (
    <button
      type="button"
      onClick={() => setTheme((prev) => (prev === "light" ? "dark" : "light"))}
      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      aria-label="Toggle dark mode"
    >
      {theme === "light" ? "Dark" : "Light"} Mode
    </button>
  );
}
