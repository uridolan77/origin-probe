"use client";

type Theme = "light" | "dark" | "system";

function readStored(): Theme {
  try {
    const v = localStorage.getItem("origin-theme");
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* ignore */
  }
  return "system";
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  if (theme === "system") {
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.setAttribute("data-resolved-theme", dark ? "dark" : "light");
  } else {
    root.setAttribute("data-resolved-theme", theme);
  }
}

function glyphFor(theme: Theme): string {
  return theme === "dark" ? "☾" : theme === "light" ? "☀" : "◐";
}

function labelFor(theme: Theme): string {
  return theme === "light" ? "Light theme" : theme === "dark" ? "Dark theme" : "System theme";
}

/**
 * Theme control. Persistence is applied by the layout boot script and on click;
 * we read storage only in the event handler to avoid hydration/effect lint issues.
 */
export function ThemeToggle() {
  function cycle() {
    const base = readStored();
    const next: Theme =
      base === "system" ? "light" : base === "light" ? "dark" : "system";
    try {
      localStorage.setItem("origin-theme", next);
    } catch {
      /* ignore */
    }
    applyTheme(next);
    const btn = document.activeElement;
    if (btn instanceof HTMLButtonElement) {
      btn.setAttribute("aria-label", `Theme: ${labelFor(next)}. Click to change.`);
      btn.title = labelFor(next);
      const icon = btn.querySelector("[data-theme-icon]");
      if (icon) icon.textContent = glyphFor(next);
    }
  }

  return (
    <button
      type="button"
      className="icon-btn theme-toggle"
      onClick={cycle}
      aria-label="Theme: System theme. Click to change."
      title="System theme"
    >
      <span aria-hidden="true" data-theme-icon>
        ◐
      </span>
    </button>
  );
}
