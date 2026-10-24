export function initBackToTop() {
    const btn = document.querySelector('.gh-back-to-top');
    if (!btn) return;
    const update = () => {
        btn.hidden = window.scrollY < 600;
    };
    window.addEventListener('scroll', update, { passive: true });
    btn.addEventListener('click', () => {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
    });
    update();
}
