// Archive page: group the flat post list by year. Without JS the list stays flat with full dates.
export function initArchive() {
    const list = document.getElementById('gh-archive-posts');
    if (!list) return;

    const frag = document.createDocumentFragment();
    let year;
    let ol;
    for (const li of [...list.children]) {
        if (li.dataset.year !== year) {
            year = li.dataset.year;
            const h = document.createElement('h3');
            h.className = 'gh-pack-year';
            h.textContent = year;
            ol = document.createElement('ol');
            ol.className = 'gh-pack-list';
            frag.append(h, ol);
        }
        const t = li.querySelector('time');
        if (t?.dataset.inYear) t.textContent = t.dataset.inYear;
        ol.appendChild(li);
    }
    list.replaceWith(frag);
}
