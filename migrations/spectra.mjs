#!/usr/bin/env node
// Builds a migrated COPY of Spectra on top of the starter. Never writes to the original.
// Usage: node migrations/spectra.mjs <spectra-dir> <target-dir>
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const [srcArg, dstArg] = process.argv.slice(2);
if (!srcArg || !dstArg) { console.error('Usage: spectra.mjs <spectra-dir> <target-dir>'); process.exit(1); }
const src = resolve(srcArg), dst = resolve(dstArg);
const root = resolve(import.meta.dirname, '..');
if (!existsSync(join(src, 'package.json'))) { console.error(`${src} is not a theme`); process.exit(1); }
if (existsSync(dst)) { console.error(`Refusing to overwrite ${dst}`); process.exit(1); }

const readJSON = (p) => JSON.parse(readFileSync(p, 'utf8'));
const old = readJSON(join(src, 'package.json'));

// 1. Generate from the starter: spectra skin + the modules that map to Spectra features
const modules = ['site-hero', 'footer-variants', 'header-styles', 'scheme-switch', 'feed-styles', 'templates-pack', 'post-meta-options', 'subscribe-cta', 'code-copy', 'lightbox', 'heading-anchors', 'infinite-scroll', 'fit-titles', 'tables', 'featured-slider', 'toc', 'share', 'related-posts', 'membership-cta', 'comments', 'reading-progress'];
const tmp = mkdtempSync(join(tmpdir(), 'spectra-mig-'));
execFileSync('node', [join(root, 'bin/create-theme.mjs'), 'spectra', '--name', 'Spectra', '--skin', 'spectra',
    '--modules', modules.join(','), '--out', tmp, '--author', old.author.name, '--email', old.author.email, '--description', old.description], { stdio: 'inherit' });
renameSync(join(tmp, 'spectra'), dst);
rmSync(tmp, { recursive: true, force: true });

// 1b. Spectra hides the homepage subscribe band when the Signoff footer already has one
const homeAfter = join(dst, 'partials/home-after.hbs');
writeFileSync(homeAfter, readFileSync(homeAfter, 'utf8').replace('{{> "subscribe-form"}}', '{{#match @custom.footer_style "Signoff"}}{{else}}{{> "subscribe-form"}}{{/match}}'));

// 2. Carry over what is purely Spectra's: identity, docs, release plumbing, extra locales
const carry = ['LICENSE', 'CHANGELOG.md', 'CODE_OF_CONDUCT.md', 'CONTRIBUTING.md', 'SECURITY.md', 'DESIGN.md', 'README.md',
    'routes.example.yaml', '.gitignore', 'docs', '.github',
    'scripts/check-a11y.js', 'scripts/docs-settings.mjs', 'scripts/screenshots.mjs',
    'locales/fr.json', 'locales/de.json', 'locales/es.json', 'locales/nl.json', 'locales/pt.json'];
const carried = [];
for (const f of carry) {
    if (!existsSync(join(src, f))) continue;
    cpSync(join(src, f), join(dst, f), { recursive: true, force: true });
    carried.push(f);
}

// 3. package.json: identity from Spectra, build/runtime from the starter
const pkg = readJSON(join(dst, 'package.json'));
for (const k of ['version', 'license', 'homepage', 'repository', 'bugs', 'author', 'keywords', 'overrides']) if (old[k]) pkg[k] = old[k];
pkg.config.image_sizes = old.config.image_sizes;
pkg.config.posts_per_page = old.config.posts_per_page;
pkg.devDependencies = { ...pkg.devDependencies, ...old.devDependencies };
pkg.scripts['check:a11y'] = 'node scripts/check-a11y.js';
pkg.scripts.check = 'npm run build && npm test && npm run check:i18n && npm run check:a11y';
pkg.scripts.docs = old.scripts.docs;
pkg.scripts.screenshots = old.scripts.screenshots;

// settings: Spectra's definitions win for shared names; keep only those a template (or head-extra) uses
const headExtra = join(dst, 'partials/head-extra.hbs');
let head = readFileSync(headExtra, 'utf8');
head = head.replace('{{!-- @starter:slot --}}', `{{!-- Spectra: default colour scheme (only when the reader has not chosen one) and secondary accent --}}
<script>(function () { var r = document.documentElement; if (!r.hasAttribute('data-scheme')) { var d = '{{@custom.color_scheme}}'.toLowerCase(); if (d === 'light' || d === 'dark') r.setAttribute('data-scheme', d); } })();</script>
<style>:root { --accent-2: {{@custom.secondary_accent}}; }</style>
{{!-- @starter:slot --}}`);
writeFileSync(headExtra, head);

const used = (name) => {
    const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? (['node_modules', 'docs', 'assets', '.github'].includes(e.name) ? [] : walk(join(d, e.name))) : e.name.endsWith('.hbs') ? [join(d, e.name)] : []);
    return walk(dst).some((f) => readFileSync(f, 'utf8').includes(`@custom.${name}`));
};
const merged = { ...pkg.config.custom, ...old.config.custom };
const dropped = [], kept = [];
for (const [k, v] of Object.entries(merged)) {
    if (used(k)) { kept.push(k); continue; }
    dropped.push(k); delete merged[k];
}
pkg.config.custom = merged;
writeFileSync(join(dst, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');

writeFileSync(join(dst, '.migration.json'), JSON.stringify({ from: src, modules, carried, settingsKept: kept, settingsDropped: dropped }, null, 2) + '\n');
console.log(`\nMigrated copy: ${dst}\n  carried: ${carried.length} paths\n  settings kept: ${kept.length}, dropped (no template uses them yet): ${dropped.join(', ') || '-'}`);
