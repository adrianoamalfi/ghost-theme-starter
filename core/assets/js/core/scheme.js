// Cycles system -> light -> dark and persists the choice. The no-flash
// bootstrap in default.hbs applies the stored value before first paint.
const KEY = 'gh-scheme';
const NEXT = { system: 'light', light: 'dark', dark: 'system' };
const root = document.documentElement;

const current = () => {
    const v = root.getAttribute('data-scheme');
    return v === 'light' || v === 'dark' ? v : 'system';
};

export function initScheme() {
    const btn = document.getElementById('gh-scheme-toggle');
    if (!btn) return;

    // data-label-<current> holds the text for the action the click performs.
    const sync = () =>
        btn.setAttribute('aria-label', btn.dataset[`label${current()[0].toUpperCase()}${current().slice(1)}`]);
    sync();

    btn.addEventListener('click', () => {
        const next = NEXT[current()];
        if (next === 'system') root.removeAttribute('data-scheme');
        else root.setAttribute('data-scheme', next);
        try {
            if (next === 'system') localStorage.removeItem(KEY);
            else localStorage.setItem(KEY, next);
        } catch {
            /* storage unavailable */
        }
        sync();
    });
}
