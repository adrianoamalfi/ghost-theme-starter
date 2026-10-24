// Core entry: a theme's main.js imports this and adds its own modules.
import { initScheme } from './scheme.js';
import { initNav } from './nav.js';
import { initBackToTop } from './back-to-top.js';
import { initSearchShortcut } from './search.js';

export function initCore() {
    initScheme();
    initNav();
    initBackToTop();
    initSearchShortcut();
}
