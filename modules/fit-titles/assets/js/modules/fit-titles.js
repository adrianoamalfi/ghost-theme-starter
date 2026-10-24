/* Fit display titles: if one long word (e.g. a domain) would overflow its tile,
   shrink the type just enough. CSS alone cannot know the word's length.
   Targets: elements with [data-fit], hero titles (.gh-sh-title) and article titles. */
const SELECTOR = '[data-fit], .gh-sh-title, .gh-article-title';

function fit(el) {
    el.style.fontSize = '';
    const wrap = el.style.overflowWrap;
    const anim = el.style.animation;
    el.style.overflowWrap = 'normal';
    el.style.animation = 'none';
    if (el.scrollWidth > el.clientWidth + 1) {
        const size = parseFloat(getComputedStyle(el).fontSize);
        el.style.fontSize = `${Math.floor(((size * el.clientWidth) / el.scrollWidth) * 0.97)}px`;
    }
    el.style.overflowWrap = wrap;
    el.style.animation = anim;
}

export function initFitTitles() {
    const titles = document.querySelectorAll(SELECTOR);
    if (!titles.length) return;

    const run = () => titles.forEach(fit);
    (document.fonts?.ready ?? Promise.resolve()).then(run);

    let raf;
    addEventListener(
        'resize',
        () => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(run);
        },
        { passive: true },
    );
}
