// ============================================================
// THEME TOGGLE - Light/Dark Mode with localStorage Persistence
// ============================================================

const THEME_KEY = 'restro_theme';
const DARK = 'dark';
const LIGHT = 'light';

/**
 * Get the current theme from localStorage or default to dark
 */
export function getCurrentTheme() {
    return localStorage.getItem(THEME_KEY) || DARK;
}

/**
 * Apply theme to the document
 */
export function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(THEME_KEY, theme);
    updateToggleIcon(theme);
}

/**
 * Toggle between light and dark themes
 */
export function toggleTheme() {
    const current = getCurrentTheme();
    const next = current === DARK ? LIGHT : DARK;
    applyTheme(next);
    return next;
}

/**
 * Update the toggle button icon
 */
function updateToggleIcon(theme) {
    const btn = document.getElementById('theme-toggle-btn');
    if (!btn) return;

    if (theme === LIGHT) {
        btn.innerHTML = '🌙';
        btn.title = 'Switch to Dark Mode';
    } else {
        btn.innerHTML = '☀️';
        btn.title = 'Switch to Light Mode';
    }
}

/**
 * Initialize theme on page load
 * Call this in your main script or inline in HTML
 */
export function initTheme() {
    const saved = getCurrentTheme();
    applyTheme(saved);

    // Attach click handler if button exists
    const btn = document.getElementById('theme-toggle-btn');
    if (btn) {
        btn.addEventListener('click', toggleTheme);
    }
}

// Auto-init if script is loaded directly
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTheme);
} else {
    initTheme();
}
