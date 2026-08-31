"use client";

type Density = "comfortable" | "compact";

function readStored(): Density {
  try {
    const v = localStorage.getItem("origin-density");
    if (v === "compact" || v === "comfortable") return v;
  } catch {
    /* ignore */
  }
  return "comfortable";
}

/**
 * Density toggle. Boot script may set data-density; click updates storage + DOM.
 */
export function DensityToggle() {
  function toggle() {
    const current = readStored();
    const next: Density = current === "comfortable" ? "compact" : "comfortable";
    document.documentElement.setAttribute("data-density", next);
    try {
      localStorage.setItem("origin-density", next);
    } catch {
      /* ignore */
    }
    const btn = document.activeElement;
    if (btn instanceof HTMLButtonElement) {
      btn.setAttribute("aria-pressed", next === "compact" ? "true" : "false");
      btn.textContent = next === "compact" ? "Compact" : "Comfortable";
    }
  }

  return (
    <button
      type="button"
      className="facet-chip density-toggle"
      onClick={toggle}
      aria-pressed="false"
    >
      Comfortable
    </button>
  );
}
