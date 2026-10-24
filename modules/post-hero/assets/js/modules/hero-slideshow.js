// Hero slideshow: fades between the featured photographs, with dots to jump. Pauses on hover, focus and when the
// tab is hidden; does not auto-advance for readers who prefer reduced motion. Without JS the first slide stays.
const DELAY = 6500;

export function initHeroSlideshow() {
    const root = document.querySelector('[data-cover-slideshow]');
    if (!root) return;
    const slides = [...root.querySelectorAll('.gh-cover-slide')];
    if (slides.length < 2) return;

    const labels = root.querySelector('[data-gh-labels="hero-slideshow"]')?.dataset || {};
    const label = labels.photograph || 'Photograph';
    const dots = document.createElement('div');
    dots.className = 'gh-cover-dots';
    dots.setAttribute('role', 'group');
    const buttons = slides.map((_, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'gh-cover-dot';
        b.setAttribute('aria-label', `${label} ${i + 1} / ${slides.length}`);
        b.addEventListener('click', () => show(i, true));
        dots.append(b);
        return b;
    });
    // WCAG 2.2.2: anything that moves by itself for more than five seconds needs a pause control
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'gh-cover-pause';
    dots.append(toggle);
    root.append(dots);
    slides.forEach((slide, n) => {
        slide.setAttribute('role', 'group');
        slide.setAttribute('aria-roledescription', 'slide');
        slide.setAttribute('aria-label', `${n + 1} / ${slides.length}`);
    });
    root.classList.add('is-ready');

    let current = 0;
    let timer = null;
    let paused = false;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

    function show(i, user = false) {
        current = (i + slides.length) % slides.length;
        slides.forEach((slide, n) => {
            const on = n === current;
            slide.classList.toggle('is-active', on);
            slide.toggleAttribute('inert', !on);
            slide.setAttribute('aria-hidden', String(!on));
            buttons[n].setAttribute('aria-current', String(on));
        });
        if (user) restart();
    }
    const stop = () => {
        clearInterval(timer);
        timer = null;
    };
    const start = () => {
        if (!reduce && !paused && !timer && !document.hidden) timer = setInterval(() => show(current + 1), DELAY);
    };
    const sync = () => {
        const playing = !reduce && !paused;
        toggle.setAttribute('aria-label', (playing ? labels.pause : labels.play) || 'Slideshow');
        toggle.dataset.state = playing ? 'playing' : 'paused';
        root.setAttribute('aria-live', playing ? 'off' : 'polite');
    };
    toggle.addEventListener('click', () => {
        paused = !paused;
        if (paused) stop();
        else start();
        sync();
    });
    const restart = () => {
        stop();
        start();
    };

    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', start);
    root.addEventListener('focusin', stop);
    root.addEventListener('focusout', start);
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

    show(0);
    sync();
    start();
}
