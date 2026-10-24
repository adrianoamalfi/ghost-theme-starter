// Three-button colour scheme control. Same storage key and attribute as core/scheme.js
// ('gh-scheme', data-scheme="light|dark"); "system" removes both and follows the OS.
const KEY = 'gh-scheme';
const root = document.documentElement;

const current = () => {
    const v = root.getAttribute('data-scheme');
    return v === 'light' || v === 'dark' ? v : 'system';
};

export function initSchemeSwitch() {
    const buttons = document.querySelectorAll('[data-scheme-set]');
    if (!buttons.length) return;

    const show = () => {
        const now = current();
        buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.schemeSet === now)));
    };

    buttons.forEach((b) =>
        b.addEventListener('click', () => {
            const v = b.dataset.schemeSet;
            if (v === 'system') root.removeAttribute('data-scheme');
            else root.setAttribute('data-scheme', v);
            try {
                if (v === 'system') localStorage.removeItem(KEY);
                else localStorage.setItem(KEY, v);
            } catch {
                /* storage unavailable */
            }
            show();
        }),
    );
    show();
}
