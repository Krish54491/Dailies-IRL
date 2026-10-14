// loaded in <head> so the saved theme applies before the page draws (no flash of the wrong colours)
// "system" follows the OS setting, "light" and "dark" override it
const THEME_KEY = "theme";

function getTheme() {
  try {
    return localStorage.getItem(THEME_KEY) || "system";
  } catch {
    return "system";
  }
}

function applyTheme(theme) {
  if (theme === "light" || theme === "dark") {
    document.documentElement.dataset.theme = theme;
  } else {
    delete document.documentElement.dataset.theme;
  }
}

function setTheme(theme) {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    // storage blocked, the choice just won't be remembered
  }
  applyTheme(theme);
}

applyTheme(getTheme());

// keeps an open settings tab in step when the theme is changed from the popup
window.addEventListener("storage", (e) => {
  if (e.key === THEME_KEY) applyTheme(e.newValue || "system");
});
