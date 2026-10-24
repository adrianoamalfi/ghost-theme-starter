import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const STARTER_VERSION = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
export const MANIFEST = '.starter.json';

export const sha = (buf) => createHash('sha256').update(buf).digest('hex');

export function walk(dir, base = dir) {
    if (!existsSync(dir)) return [];
    return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        if (e.name === '.DS_Store') return [];
        const p = join(dir, e.name);
        return e.isDirectory() ? walk(p, base) : [relative(base, p)];
    });
}

export const readJSON = (p) => JSON.parse(readFileSync(p, 'utf8'));
export const writeJSON = (p, v) => writeFileSync(p, JSON.stringify(v, null, 2) + '\n');

export function loadManifest(theme) {
    const p = join(theme, MANIFEST);
    if (!existsSync(p)) throw new Error(`${MANIFEST} not found in ${theme}: not a starter-generated theme`);
    return readJSON(p);
}

/** Directories whose files are starter-owned: core plus every installed module. */
export function ownedSources(modules) {
    const dirs = [join(ROOT, 'core')];
    for (const m of modules) dirs.push(join(ROOT, 'modules', m));
    return dirs.filter((d) => existsSync(d));
}

/**
 * A module may ship alternative files for when another module is installed:
 *   "variants": { "post-hero": { "home.hbs": "variants/post-hero/home.hbs" } }
 * Returns dest -> source (relative to the module dir) for the first matching variant.
 */
export function variantFiles(dir, installed) {
    const p = join(dir, 'module.json');
    const map = new Map();
    if (!existsSync(p)) return map;
    const mod = readJSON(p);
    for (const [when, files] of Object.entries(mod.variants ?? {})) {
        if (!installed.includes(when)) continue;
        for (const [dest, srcRel] of Object.entries(files)) map.set(dest, srcRel);
        break;
    }
    return map;
}

/**
 * Map of theme-relative path -> Buffer for every starter-owned file; later
 * sources win. Locale files are merged key-wise so modules can add strings.
 */
export function sourceFiles(modules, aliases = null) {
    const map = new Map();
    for (const dir of ownedSources(modules)) {
        const variants = dir.includes(`${sep}modules${sep}`) ? variantFiles(dir, modules) : new Map();
        for (const f of walk(dir)) {
            if (f === 'module.json' || f.startsWith('variants/')) continue;
            const buf = readFileSync(join(dir, variants.get(f) ?? f));
            if (/^locales\/[^/]+\.json$/.test(f) && map.has(f)) {
                const merged = { ...JSON.parse(map.get(f)), ...JSON.parse(buf) };
                map.set(f, Buffer.from(JSON.stringify(merged, null, 2) + '\n'));
            } else {
                map.set(f, buf);
            }
        }
    }
    if (aliases) for (const [rel, buf] of map) if (rel.endsWith('.hbs')) map.set(rel, Buffer.from(applyAliases(buf.toString('utf8'), aliases)));
    return map;
}

/**
 * Setting aliases keep a theme's existing Design settings working when a module's own
 * names differ (Ghost stores values by key; a rename would reset them).
 *   aliases.settings: { "<module key>": "<theme key>" }
 *   aliases.values:   { "<module key>": { "<module value>": "<theme value>" } }
 * Applied to module/core templates in one pass over the ORIGINAL text, so chains like
 * a->b and b->c do not cascade.
 */
export function applyAliases(text, aliases) {
    const keys = aliases.settings ?? {};
    const values = aliases.values ?? {};
    return text.replace(/@custom\.([A-Za-z0-9_]+)(\s+"([^"]*)")?/g, (m, key, quoted, val) => {
        const k = keys[key] ?? key;
        if (!quoted) return `@custom.${k}`;
        return `@custom.${k}${m.slice(m.indexOf(key) + key.length, m.indexOf('"'))}"${values[key]?.[val] ?? val}"`;
    });
}

/** Copy `src` to `dest`, creating folders. */
export function put(dest, data) {
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, data);
}

export { cpSync, existsSync, readFileSync, rmSync, statSync, writeFileSync, mkdirSync, join, resolve };


/** Module `requires` must be installed alongside; returns the list of problems. */
export function missingRequires(modules) {
    const problems = [];
    for (const m of modules) {
        const p = join(ROOT, 'modules', m, 'module.json');
        if (!existsSync(p)) continue;
        const mod = readJSON(p);
        for (const r of mod.requires ?? []) if (!modules.includes(r)) problems.push(`${m} requires ${r}`);
        if (mod.requiresAny?.length && !mod.requiresAny.some((r) => modules.includes(r))) problems.push(`${m} requires one of: ${mod.requiresAny.join(', ')}`);
    }
    return problems;
}
