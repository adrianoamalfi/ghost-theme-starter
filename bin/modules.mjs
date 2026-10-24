import { join, readFileSync, writeFileSync, existsSync, ROOT, readJSON, writeJSON } from './lib.mjs';

export const SLOT_MARKER = '{{!-- @starter:slot --}}';

const inject = (file, marker, lines) => {
    let txt = readFileSync(file, 'utf8');
    const fresh = lines.filter((l) => !txt.includes(l));
    if (fresh.length) {
        if (!txt.includes(marker)) return fresh; // caller warns
        txt = txt.replace(marker, fresh.join('\n') + '\n' + marker);
        writeFileSync(file, txt);
    }
    return [];
};

/**
 * Wire a module into a theme: css/js entries, slot partials, custom settings.
 * Idempotent. Returns a list of warnings (hooks it could not place).
 */
export function installModuleHooks(theme, name, aliases = null) {
    const mod = readJSON(join(ROOT, 'modules', name, 'module.json'));
    const warn = [];

    const cssTargets = [['css', 'screen.css'], ['postCss', 'post.css']];
    for (const [key, file] of cssTargets) {
        if (!mod[key]?.length) continue;
        const missed = inject(join(theme, 'assets/css', file), '/* @starter:components */',
            mod[key].map((f) => `@import '${f}' layer(components);`));
        warn.push(...missed.map((l) => `${file}: could not add "${l}" (marker removed); add it manually`));
    }

    const jsTargets = [['js', 'main.js'], ['postJs', 'post.js']];
    for (const [key, file] of jsTargets) {
        if (!mod[key]) continue;
        const p = join(theme, 'assets/js', file);
        const m1 = inject(p, '// @starter:imports', [mod[key].import]);
        const m2 = inject(p, '// @starter:init', [mod[key].init]);
        warn.push(...[...m1, ...m2].map((l) => `${file}: could not add "${l}" (marker removed); add it manually`));
    }

    for (const [slot, partial] of Object.entries(mod.slots ?? {})) {
        const p = join(theme, 'partials', `${slot}.hbs`);
        if (!existsSync(p)) { warn.push(`slot partials/${slot}.hbs missing; add {{> "${partial}"}} where you want it`); continue; }
        const missed = inject(p, SLOT_MARKER, [`{{> "${partial}"}}`]);
        warn.push(...missed.map((l) => `partials/${slot}.hbs: slot marker removed; add ${l} manually`));
    }

    // `replaces`: swap a seed slot that holds a default (e.g. footer-layout) for a dispatcher partial.
    // Only done while the slot is still pristine, otherwise the theme's own edit wins.
    for (const [slot, partial] of Object.entries(mod.replaces ?? {})) {
        const p = join(theme, 'partials', `${slot}.hbs`);
        const line = `{{> "${partial}"}}`;
        const seed = readFileSync(join(ROOT, 'seed', 'partials', `${slot}.hbs`), 'utf8');
        const cur = existsSync(p) ? readFileSync(p, 'utf8') : null;
        if (cur === seed) writeFileSync(p, `{{!-- Slot replaced by module "${name}": delete the line below to fall back to the core default. --}}\n${line}\n`);
        else if (!cur?.includes(line)) warn.push(`partials/${slot}.hbs was edited; add ${line} manually to use module "${name}"`);
    }

    if (mod.settings) {
        const p = join(theme, 'package.json');
        const pkg = readJSON(p);
        const named = Object.entries(mod.settings).map(([k, v]) => [aliases?.settings?.[k] ?? k, v]);
        pkg.config.custom = { ...pkg.config.custom, ...Object.fromEntries(named.filter(([k]) => !(k in pkg.config.custom))) };
        writeJSON(p, pkg);
    }
    return warn;
}
