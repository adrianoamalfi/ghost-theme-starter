/*
 * Builds the table of contents from #gh-content h2/h3 into the #gh-toc shell
 * with a reading-line scrollspy. Stays hidden below two headings.
 */
import { slugify, safeDecode } from '../core/utils.js';

export function initToc() {
    const toc = document.getElementById('gh-toc');
    const details = document.getElementById('gh-toc-details');
    const content = document.getElementById('gh-content');
    if (!toc || !details || !content) return;

    // Koenig widget cards embed headings that are UI chrome, not article structure.
    const EXCLUDE = '.kg-signup-card, .kg-product-card, .kg-toggle-card';
    const headings = [...content.querySelectorAll('h2, h3')].filter((h) => !h.closest(EXCLUDE));
    if (headings.length < 2) return; // shell stays [hidden]; core hides the empty aside

    const list = toc.querySelector('.gh-toc-list');
    const seen = new Set();
    let currentH2 = null;

    const uniqueId = (h) => {
        let id = h.id || slugify(h.textContent) || 'section';
        while (seen.has(id) || (document.getElementById(id) && document.getElementById(id) !== h)) id += '-x';
        seen.add(id);
        return id;
    };

    for (const h of headings) {
        h.id = uniqueId(h);
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = `#${h.id}`;
        link.textContent = h.textContent;
        item.appendChild(link);

        if (h.tagName === 'H3' && currentH2) {
            let sub = currentH2.querySelector(':scope > ol');
            if (!sub) {
                sub = document.createElement('ol');
                currentH2.appendChild(sub);
            }
            sub.appendChild(item);
        } else {
            list.appendChild(item);
            if (h.tagName === 'H2') currentH2 = item;
        }
    }

    details.hidden = false;

    // Open in the side gutter (wide screens); closed and toggleable above the article elsewhere.
    // The skin may move the rail breakpoint with --toc-rail-min (default 112rem: the wide gutter)
    const railMin = getComputedStyle(document.documentElement).getPropertyValue('--toc-rail-min').trim() || '112rem';
    const wide = matchMedia(`(min-width: ${railMin})`);
    const syncOpen = () => {
        details.open = wide.matches;
    };
    syncOpen();
    wide.addEventListener('change', syncOpen);
    list.addEventListener('click', (e) => {
        if (e.target.closest('a') && !wide.matches) details.open = false;
    });

    // Scrollspy: active = last heading above a line just under the sticky header.
    const links = new Map([...toc.querySelectorAll('a')].map((a) => [safeDecode(a.hash.slice(1)), a]));
    let active = null;
    const setActive = (link) => {
        if (link === active) return;
        active?.classList.remove('is-active');
        active?.removeAttribute('aria-current');
        link?.classList.add('is-active');
        link?.setAttribute('aria-current', 'location');
        active = link;
    };

    const line = (document.getElementById('gh-header')?.offsetHeight || 64) + 24;
    let ticking = false;
    const update = () => {
        ticking = false;
        let current = null;
        for (const h of headings) {
            if (h.getBoundingClientRect().top <= line) current = h;
            else break;
        }
        setActive(current ? links.get(current.id) : null);
    };
    const onScroll = () => {
        if (!ticking) {
            ticking = true;
            requestAnimationFrame(update);
        }
    };
    addEventListener('scroll', onScroll, { passive: true });
    addEventListener('resize', onScroll, { passive: true });
    update();
}
