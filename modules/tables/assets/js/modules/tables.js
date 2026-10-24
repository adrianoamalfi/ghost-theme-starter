/* Keep native table semantics; only the surrounding region scrolls. The label for tables
   without a caption comes from the hidden [data-gh-labels="tables"] element (tables-labels partial). */
export function initTables() {
    const defaultLabel = document.querySelector('[data-gh-labels="tables"]')?.dataset.label;
    document.querySelectorAll('.gh-content').forEach((content) => {
        content.querySelectorAll('table').forEach((table) => {
            if (table.closest('.gh-table-scroll')) return;

            const wrapper = document.createElement('div');
            wrapper.className = 'gh-table-scroll';
            // Keep direct-child Koenig breakout classes on the grid item.
            for (const name of ['kg-width-wide', 'kg-width-full']) {
                if (!table.classList.contains(name)) continue;
                wrapper.classList.add(name);
                table.classList.remove(name);
            }
            table.before(wrapper);
            wrapper.appendChild(table);

            const label = table.caption?.textContent.trim() || defaultLabel;
            const update = () => {
                const scrolls = wrapper.scrollWidth > wrapper.clientWidth;
                if (scrolls) {
                    wrapper.tabIndex = 0;
                    if (label) {
                        wrapper.setAttribute('role', 'region');
                        wrapper.setAttribute('aria-label', label);
                    }
                } else {
                    wrapper.removeAttribute('tabindex');
                    wrapper.removeAttribute('role');
                    wrapper.removeAttribute('aria-label');
                }
            };
            // Observe both: fonts/content can change intrinsic table width without
            // changing the wrapper, while viewport changes resize the wrapper.
            const observer = new ResizeObserver(update);
            observer.observe(wrapper);
            observer.observe(table);
            update();
        });
    });
}
