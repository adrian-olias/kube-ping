// Light and dark switch in the header. The page opens in light mode; a choice
// is stored in localStorage and set as data-theme on <html>. The saved choice is
// applied by an inline script in <head>, so the page does not flash while it loads.
(() => {
  "use strict";

  const button = document.getElementById("theme-toggle");
  if (!button) return;

  const root = document.documentElement;

  // The theme the page shows now. Light unless the reader chose dark.
  function current() {
    return root.dataset.theme === "dark" ? "dark" : "light";
  }

  // The button offers the other theme: a moon in light mode, a sun in dark mode.
  function label() {
    const next = current() === "dark" ? "light" : "dark";
    button.textContent = next === "dark" ? "☾" : "☀";
    button.setAttribute("aria-label", button.dataset[next]);
    button.title = button.dataset[next];
  }

  button.addEventListener("click", () => {
    const next = current() === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    // Storage can be blocked; the switch still works for this page view.
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Nothing to do: the choice just won't survive a reload.
    }
    label();
  });

  button.hidden = false;
  label();
})();
