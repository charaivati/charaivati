// public/theme.js
(function () {
  try {
    // try to read persisted theme
    var theme = null;
    try {
      theme = localStorage.getItem("theme");
    } catch (e) {
      theme = null;
    }

    // fallback to system preference
    if (!theme) {
      if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
        theme = "dark";
      } else {
        theme = "light";
      }
    }

    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  } catch (e) {
    // don't block rendering on error
    console.warn("theme.js error", e);
  }
})();


