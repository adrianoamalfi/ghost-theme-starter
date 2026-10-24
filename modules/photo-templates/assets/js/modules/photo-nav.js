// Photo page: ← and → follow the previous / next photograph, and both are prefetched so the jump is instant.
// Ignored while typing, with modifier keys, and while the lightbox is open (it has its own arrows).
export function initPhotoNav() {
    const prev = document.querySelector('.gh-photo-nav a[rel="prev"]');
    const next = document.querySelector('.gh-photo-nav a[rel="next"]');
    if (!prev && !next) return;

    for (const link of [prev, next]) {
        if (!link) continue;
        const hint = document.createElement('link');
        hint.rel = 'prefetch';
        hint.href = link.href;
        document.head.append(hint);
    }

    document.addEventListener('keydown', (e) => {
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
        if (document.body.classList.contains('has-lightbox-open')) return;
        if (e.target.closest?.('input, textarea, select, [contenteditable], [role="textbox"]')) return;
        if (e.key === 'ArrowLeft' && prev) location.href = prev.href;
        else if (e.key === 'ArrowRight' && next) location.href = next.href;
    });
}
