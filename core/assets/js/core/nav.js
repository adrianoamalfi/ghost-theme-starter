// Mobile menu: toggles .is-open on the nav, closes on Escape and link click.
export function initNav() {
    // A hairline under the header once the page has scrolled (skins decide whether to show it)
    const header = document.getElementById('gh-header');
    if (header) {
        const mark = () => header.classList.toggle('is-scrolled', scrollY > 0);
        addEventListener('scroll', mark, { passive: true });
        mark();
    }

    const burger = document.getElementById('gh-burger');
    const nav = document.getElementById('gh-nav');
    if (!burger || !nav) return;

    const openLabel = burger.getAttribute('aria-label');
    const closeLabel = burger.dataset.labelClose;

    const set = (open) => {
        nav.classList.toggle('is-open', open);
        burger.setAttribute('aria-expanded', String(open));
        burger.setAttribute('aria-label', open ? closeLabel : openLabel);
    };

    burger.addEventListener('click', () => set(burger.getAttribute('aria-expanded') !== 'true'));
    nav.addEventListener('click', (e) => {
        if (e.target.closest('a')) set(false);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') {
            set(false);
            burger.focus();
        }
    });
}
