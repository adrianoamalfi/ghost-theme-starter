/*
 * Image lightbox for content images, Koenig galleries and any [data-lightbox] container.
 * No dependencies. Images in the same gallery card (or the same [data-lightbox] element) form a
 * group with prev/next and a counter; standalone images open on their own. Keyboard: Esc closes,
 * arrows navigate; focus returns to the trigger on close.
 * It shows the already-loaded image at once, then swaps in the largest size the srcset offers
 * (or data-full) and preloads the neighbours, so browsing a series feels instant.
 * Labels come from the hidden [data-gh-labels="lightbox"] element the lightbox-labels partial renders.
 */
const icon = (path, width = 2) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"/></svg>`;
const CLOSE_ICON = icon('M18 6 6 18M6 6l12 12');
const PREV_ICON = icon('m15 18-6-6 6-6');
const NEXT_ICON = icon('m9 18 6-6-6-6');

const SELECTOR =
    '.gh-content .kg-image-card img, .gh-content .kg-gallery-image img, .gh-content figure.kg-card img, [data-lightbox] img';

/** The largest candidate of a srcset (by w descriptor), else data-full, else the current source. */
export function fullSrc(img) {
    if (img.dataset.full) return img.dataset.full;
    const candidates = (img.getAttribute('srcset') || '')
        .split(',')
        .map((part) => part.trim().split(/\s+/))
        .filter(([url, size]) => url && /^\d+w$/.test(size || ''))
        .map(([url, size]) => ({ url, width: parseInt(size, 10) }))
        .sort((a, b) => b.width - a.width);
    return candidates[0]?.url || img.currentSrc || img.src;
}

export function initLightbox() {
    const images = [...new Set(document.querySelectorAll(SELECTOR))].filter((img) => !img.closest('a'));
    if (!images.length) return;

    const labels = document.querySelector('[data-gh-labels="lightbox"]')?.dataset ?? {};
    const zoomLabel = labels.zoomLabel || 'Zoom image';
    const closeLabel = labels.closeLabel || 'Close';
    const prevLabel = labels.prevLabel || 'Previous';
    const nextLabel = labels.nextLabel || 'Next';

    // Group by nearest gallery card or [data-lightbox] container; standalone images are their own group.
    const groups = new Map();
    images.forEach((img) => {
        const owner = img.closest('.kg-gallery-card, [data-lightbox]') || img;
        if (!groups.has(owner)) groups.set(owner, []);
        img.dataset.lbGroup = [...groups.keys()].indexOf(owner);
        groups.get(owner).push(img);
    });

    images.forEach((img) => {
        img.classList.add('gh-zoomable');
        img.setAttribute('role', 'button');
        img.setAttribute('tabindex', '0');
        img.setAttribute('aria-label', zoomLabel);
        img.addEventListener('click', () => open(img));
        img.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                open(img);
            }
        });
    });

    // Overlay, built once.
    const overlay = document.createElement('div');
    overlay.className = 'gh-lightbox';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.hidden = true;
    overlay.innerHTML = `
    <button type="button" class="gh-lightbox-close" aria-label="${closeLabel}">${CLOSE_ICON}</button>
    <button type="button" class="gh-lightbox-nav gh-lightbox-prev" aria-label="${prevLabel}">${PREV_ICON}</button>
    <figure class="gh-lightbox-figure"><img alt=""><figcaption></figcaption><p class="gh-lightbox-count" aria-live="polite"></p></figure>
    <button type="button" class="gh-lightbox-nav gh-lightbox-next" aria-label="${nextLabel}">${NEXT_ICON}</button>`;
    document.body.appendChild(overlay);

    const bigImg = overlay.querySelector('img');
    const caption = overlay.querySelector('figcaption');
    const counter = overlay.querySelector('.gh-lightbox-count');
    const closeBtn = overlay.querySelector('.gh-lightbox-close');
    const prevBtn = overlay.querySelector('.gh-lightbox-prev');
    const nextBtn = overlay.querySelector('.gh-lightbox-next');

    let group = [];
    let index = 0;
    let trigger = null;

    const captionOf = (img) =>
        img.closest('figure')?.querySelector('figcaption')?.innerText.trim() || img.getAttribute('alt') || '';

    function preload(img) {
        if (!img) return;
        const pre = new Image();
        pre.src = fullSrc(img);
    }

    function render() {
        const img = group[index];
        const full = fullSrc(img);
        const shown = img.currentSrc || img.src;

        // The image already on the page appears at once; the large one replaces it when ready.
        bigImg.src = shown;
        if (full !== shown) {
            overlay.classList.add('is-loading');
            const large = new Image();
            large.onload = () => {
                if (group[index] === img) bigImg.src = full;
                overlay.classList.remove('is-loading');
            };
            large.onerror = () => overlay.classList.remove('is-loading');
            large.src = full;
        } else {
            overlay.classList.remove('is-loading');
        }

        const cap = captionOf(img);
        caption.textContent = cap;
        caption.hidden = !cap;
        const many = group.length > 1;
        prevBtn.hidden = !many;
        nextBtn.hidden = !many;
        counter.hidden = !many;
        counter.textContent = many ? `${index + 1} / ${group.length}` : '';
        if (many) {
            preload(group[(index + 1) % group.length]);
            preload(group[(index - 1 + group.length) % group.length]);
        }
    }

    function open(img) {
        const groupId = img.dataset.lbGroup;
        group = images.filter((i) => i.dataset.lbGroup === groupId);
        index = group.indexOf(img);
        trigger = img;
        render();
        overlay.hidden = false;
        document.body.classList.add('has-lightbox-open');
        closeBtn.focus();
    }

    function close() {
        overlay.hidden = true;
        document.body.classList.remove('has-lightbox-open');
        if (trigger) trigger.focus();
    }

    function step(delta) {
        if (group.length < 2) return;
        index = (index + delta + group.length) % group.length;
        render();
    }

    closeBtn.addEventListener('click', close);
    prevBtn.addEventListener('click', () => step(-1));
    nextBtn.addEventListener('click', () => step(1));
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close();
    });

    // Horizontal swipe navigates the group on touch devices.
    let touchStartX = 0;
    let touchStartY = 0;
    overlay.addEventListener(
        'touchstart',
        (e) => {
            touchStartX = e.changedTouches[0].screenX;
            touchStartY = e.changedTouches[0].screenY;
        },
        { passive: true },
    );
    overlay.addEventListener(
        'touchend',
        (e) => {
            const dx = e.changedTouches[0].screenX - touchStartX;
            const dy = e.changedTouches[0].screenY - touchStartY;
            // Only mostly-horizontal moves past a threshold count as swipes, so vertical
            // scrolls and taps (which close via the click handler) are left alone.
            if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1);
        },
        { passive: true },
    );

    document.addEventListener('keydown', (e) => {
        if (overlay.hidden) return;
        if (e.key === 'Escape') close();
        else if (e.key === 'ArrowLeft') step(-1);
        else if (e.key === 'ArrowRight') step(1);
        else if (e.key === 'Tab') {
            // Focus trap across the visible overlay buttons.
            const focusables = [closeBtn, prevBtn, nextBtn].filter((b) => !b.hidden);
            const first = focusables[0];
            const last = focusables[focusables.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    });
}
