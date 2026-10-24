// ⌘K / Ctrl+K opens Ghost's native search (sodo-search) via its data attribute.
export function initSearchShortcut() {
    // The hint reads ⌘K on Apple platforms and Ctrl K elsewhere
    const hint = document.querySelector('.gh-search-kbd');
    if (hint && !/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) hint.textContent = 'Ctrl K';

    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
            const trigger = document.querySelector('[data-ghost-search]');
            if (trigger) {
                e.preventDefault();
                trigger.click();
            }
        }
    });
}
