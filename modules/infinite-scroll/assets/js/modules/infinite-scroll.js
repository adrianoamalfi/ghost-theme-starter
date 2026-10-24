/* Automatic infinite loading on paginated feeds: when the pagination nav
   approaches the viewport, fetch the next page and append its cards.
   No-JS, crawlers, Save-Data users and fetch failures keep (or get back)
   the classic prev/next pagination. Works with any feed whose cards are the
   direct children of .gh-feed and contain a link (core cards, feed-styles tiles). */
export function initInfiniteScroll() {
    const nav = document.querySelector('.gh-pagination[data-loading]');
    const feed = document.querySelector('.gh-feed');
    if (!nav || !feed) return;

    const link = nav.querySelector('a[rel="next"]');
    if (!link) return;

    // Auto-fetching pages against the user's wish to save data is rude
    if (navigator.connection?.saveData) return;

    const label = nav.querySelector('.gh-pagination-label');
    const loadingText = nav.dataset.loading;
    const errorText = nav.dataset.error;
    let nextUrl = link.href;
    let busy = false;

    // Links become a status row; classic pagination returns on fetch failure
    nav.classList.add('gh-pagination--infinite');

    const restoreClassic = () => {
        observer.disconnect();
        nav.classList.remove('gh-pagination--infinite');
    };

    const loadNext = async () => {
        if (busy || !nextUrl) return;
        busy = true;

        const idleText = label?.textContent;
        if (label && loadingText) label.textContent = loadingText;
        feed.setAttribute('aria-busy', 'true');

        try {
            const response = await fetch(nextUrl, { credentials: 'same-origin' });
            if (!response.ok) throw new Error(String(response.status));
            const doc = new DOMParser().parseFromString(await response.text(), 'text/html');

            // Skip cards already on the page (e.g. posts a hero already shows)
            const seen = new Set([...feed.children].map((c) => c.querySelector('a[href]')?.href));
            for (const card of doc.querySelectorAll('.gh-feed > *')) {
                const url = card.querySelector('a[href]')?.href;
                if (url && seen.has(url)) continue;
                feed.append(document.importNode(card, true));
            }

            if (label) {
                const nextLabel = doc.querySelector('.gh-pagination-label');
                label.textContent = nextLabel ? nextLabel.textContent : idleText;
            }

            const next = doc.querySelector('.gh-pagination a[rel="next"]');
            nextUrl = next ? next.href : null;
            link.href = nextUrl || link.href;

            if (!nextUrl) {
                observer.disconnect();
            } else {
                // Re-observing always reports current state: chains another load
                // when a short page leaves the sentinel still inside the margin
                observer.unobserve(nav);
                observer.observe(nav);
            }
        } catch {
            // Stop at once so a failing URL isn't retried on every scroll, tell the
            // reader why (aria-live announces it), then fall back to classic pagination.
            observer.disconnect();
            if (label) label.textContent = errorText || idleText || '';
            setTimeout(restoreClassic, 3000);
        } finally {
            feed.removeAttribute('aria-busy');
            busy = false;
        }
    };

    const observer = new IntersectionObserver(
        (entries) => {
            if (entries.some((e) => e.isIntersecting)) loadNext();
        },
        { rootMargin: '900px 0px' },
    );

    observer.observe(nav);
}
