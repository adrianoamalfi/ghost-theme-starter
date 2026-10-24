#!/usr/bin/env node
// Usage: node bin/create-theme.mjs <slug> [--name "My Theme"] [--skin neutral]
//        [--modules hero-statement,...] [--out ../] [--author ".."] [--email ".."]
import { parseArgs } from 'node:util';
import { missingRequires, ROOT, STARTER_VERSION, MANIFEST, existsSync, join, readFileSync, resolve, sha, sourceFiles, put, readJSON, walk, writeJSON } from './lib.mjs';
import { installModuleHooks } from './modules.mjs';

const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
        name: { type: 'string' }, skin: { type: 'string', default: 'neutral' }, modules: { type: 'string', default: '' },
        out: { type: 'string', default: '..' }, author: { type: 'string', default: '' }, email: { type: 'string', default: '' },
        description: { type: 'string', default: '' }, aliases: { type: 'string' },
    },
});

const slug = positionals[0];
if (!slug || !/^[a-z][a-z0-9-]*$/.test(slug)) {
    console.error('Usage: create-theme <slug> [--name ..] [--skin ..] [--modules a,b] [--out dir]\n  slug: lowercase letters, digits, dashes');
    process.exit(1);
}

const name = values.name ?? slug.replace(/(^|-)(\w)/g, (_, s, c) => (s ? ' ' : '') + c.toUpperCase());
const requested = values.modules ? values.modules.split(',').map((s) => s.trim()).filter(Boolean) : [];
const orderOf = (m) => { const p = join(ROOT, 'modules', m, 'module.json'); return existsSync(p) ? (readJSON(p).order ?? 50) : 50; };
// Slots are filled in `order` (default 50), so e.g. the paywall panel precedes the share row.
const modules = requested.map((m, i) => [m, i]).sort((a, b) => orderOf(a[0]) - orderOf(b[0]) || a[1] - b[1]).map(([m]) => m);
const target = resolve(process.cwd(), values.out, slug);
const skinDir = join(ROOT, 'skins', values.skin);

const aliases = values.aliases ? readJSON(resolve(process.cwd(), values.aliases)) : null;
const reqs = missingRequires(modules);
if (reqs.length) { console.error(`Missing module dependencies: ${reqs.join('; ')}`); process.exit(1); }
if (!values.email) console.warn('note: no --email given, package.json uses a placeholder (gscan requires one)');
if (existsSync(target)) { console.error(`Refusing to overwrite ${target}`); process.exit(1); }
if (!existsSync(skinDir)) { console.error(`Unknown skin "${values.skin}"`); process.exit(1); }
for (const m of modules) if (!existsSync(join(ROOT, 'modules', m, 'module.json'))) { console.error(`Unknown module "${m}"`); process.exit(1); }

const vars = { __NAME__: name, __SLUG__: slug, __SKIN__: values.skin, __AUTHOR__: values.author, __EMAIL__: values.email || 'you@example.com',
    __DESCRIPTION__: values.description || `${name}, a Ghost theme.` };
const fill = (s) => Object.entries(vars).reduce((t, [k, v]) => t.replaceAll(k, v), s);

// 1. Extension slots (seed): created once, then theme-owned. Skins/modules may
//    overlay them; modules compose into them via markers.
for (const f of walk(join(ROOT, 'seed'))) put(join(target, f), readFileSync(join(ROOT, 'seed', f)));

// 2a. Theme-owned seed: scaffold + skin (never touched by sync). Text files get
//     placeholders filled; binaries (fonts, images) are copied byte for byte.
const BINARY = /\.(woff2?|ttf|otf|png|jpe?g|webp|avif|gif|ico|svg)$/i;
for (const [dir, filter] of [[join(ROOT, 'scaffold'), () => true], [skinDir, (f) => f !== 'skin.json']]) {
    for (const f of walk(dir).filter(filter)) {
        const buf = readFileSync(join(dir, f));
        put(join(target, f), BINARY.test(f) && !f.endsWith('.svg') ? buf : fill(buf.toString('utf8')));
    }
}

// 2b. Starter-owned files (core + modules), recorded by hash for later sync
const files = {};
for (const [rel, data] of sourceFiles(modules, aliases)) {
    put(join(target, rel), data);
    files[rel] = sha(data);
}

// 3. Module hooks: css imports, js init, custom settings
for (const m of modules) for (const w of installModuleHooks(target, m, aliases)) console.warn(`warning (${m}): ${w}`);

writeJSON(join(target, MANIFEST), {
    starter: STARTER_VERSION, skin: values.skin, modules, files, ...(aliases ? { aliases } : {}),
});
console.log(`Created ${target}\n  skin: ${values.skin}\n  modules: ${modules.join(', ') || '(none)'}\n  next: cd ${target} && npm install && npm run check`);
