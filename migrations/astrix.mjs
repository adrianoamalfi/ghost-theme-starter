#!/usr/bin/env node
// Builds a migrated COPY of Astrix on top of the starter. Never writes to the original.
// Usage: node migrations/astrix.mjs <astrix-dir> <target-dir>
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const [srcArg, dstArg] = process.argv.slice(2);
if (!srcArg || !dstArg) { console.error('Usage: astrix.mjs <astrix-dir> <target-dir>'); process.exit(1); }
const src = resolve(srcArg), dst = resolve(dstArg);
const root = resolve(import.meta.dirname, '..');
if (!existsSync(join(src, 'package.json'))) { console.error(`${src} is not a theme`); process.exit(1); }
if (existsSync(dst)) { console.error(`Refusing to overwrite ${dst}`); process.exit(1); }

const readJSON = (p) => JSON.parse(readFileSync(p, 'utf8'));
const old = readJSON(join(src, 'package.json'));
const aliasesFile = join(root, 'migrations/astrix.aliases.json');

// 1. Generate: astrix skin + the modules that map to Astrix features. Aliases keep Astrix's
//    own setting names/values (Ghost stores Design settings by key; renaming would reset them).
const modules = ['post-hero', 'social-links', 'toc', 'share', 'related-posts', 'membership-cta', 'comments', 'lightbox',
    'code-copy', 'heading-anchors', 'reading-progress', 'tables', 'infinite-scroll', 'post-meta-options', 'subscribe-cta', 'header-styles', 'feed-layouts', 'featured-slider', 'templates-pack'];
const tmp = mkdtempSync(join(tmpdir(), 'astrix-mig-'));
execFileSync('node', [join(root, 'bin/create-theme.mjs'), 'astrix', '--name', 'Astrix', '--skin', 'astrix', '--modules', modules.join(','),
    '--aliases', aliasesFile, '--out', tmp, '--author', old.author.name, '--email', old.author.email, '--description', old.description], { stdio: 'inherit' });
renameSync(join(tmp, 'astrix'), dst);
rmSync(tmp, { recursive: true, force: true });

// 1b. Astrix's header CTA is a Subscribe button for signed-out readers (header-styles defaults to Sign in)
writeFileSync(join(dst, 'partials/header-account.hbs'), `{{!-- Astrix: Subscribe for signed-out readers, Account for members. --}}
{{#if @site.members_enabled}}
    {{#unless @member}}
        <a class="gh-button gh-hdr-account" href="#/portal/signup" data-portal="signup">{{t "Subscribe"}}</a>
    {{else}}
        <a class="gh-button gh-button--ghost gh-hdr-account" href="#/portal/account" data-portal="account">{{t "Account"}}</a>
    {{/unless}}
{{/if}}
`);

writeFileSync(join(dst, 'partials/footer-credits.hbs'), `{{!-- Astrix: theme credit in the footer base line. --}}
<span>{{t "Theme"}} <a href="https://adrianoamalfi.com/astrix/" target="_blank" rel="noopener noreferrer">Astrix <span class="gh-visually-hidden">{{t "Opens in a new tab"}}</span></a></span>
{{!-- @starter:slot --}}
`);

// 2. Carry over what is purely Astrix's: identity, docs, release plumbing, demo, tests, extra locales
const carry = ['LICENSE', 'CHANGELOG.md', 'CODE_OF_CONDUCT.md', 'CONTRIBUTING.md', 'SECURITY.md', 'DESIGN.md', 'PRODUCT.md', 'VISUAL_QA.md', 'AGENTS.md',
    'README.md', 'routes.example.yaml', 'robots.txt', '.gitignore', 'docs', 'demo', '.github', 'test',
    'scripts/check-recommendations.mjs', 'scripts/check-rendered.mjs', 'scripts/check-tables.mjs',
    'scripts/release-summary.mjs', 'scripts/extract-release-notes.mjs', 'scripts/optimize-screenshots.mjs',
    'locales/fr.json', 'locales/de.json', 'locales/es.json', 'locales/nl.json', 'locales/pt.json'];
const carried = [];
for (const f of carry) {
    if (!existsSync(join(src, f))) continue;
    cpSync(join(src, f), join(dst, f), { recursive: true, force: true });
    carried.push(f);
}

// 2b. Astrix's own unit tests, adapted to the starter's markup. The generic suites now ship with the starter
//     (test/starter.templates.test.js); what is left here is Astrix-specific.
const dropBlock = (src, title) => {
    const i = src.indexOf(`describe('${title}`);
    if (i === -1) return src;
    const j = src.indexOf('\ndescribe(', i + 10);
    return src.slice(0, i) + (j === -1 ? '' : src.slice(j + 1));
};
const testFile = join(dst, 'test/templates.test.js');
if (existsSync(testFile)) {
    let t = readFileSync(testFile, 'utf8');
    for (const title of ['head-preload mirrors', 'data-astryx-*', 'Handlebars expressions in CSS/JS comments', 'breadcrumbs SEO coverage',
        'templates render without invoking helpers incorrectly', 'footer recommendations partial', 'site footer credits', 'v0.4.0 page & post templates']) t = dropBlock(t, title);
    t = t.replace(/function readCssTree\(dir, out = \[\]\) \{[\s\S]*?\n\}\n\n?/, '');
    t = t.replace("readFileSync('partials/site-header.hbs', 'utf8')", "readFileSync('partials/header-styles.hbs', 'utf8')");
    t = t.replace("readFileSync('assets/css/theme/prose.css', 'utf8')", "readFileSync('assets/css/modules/code-copy.css', 'utf8')");
    t += `
describe('Astrix footer credit', () => {
    it('separates credit link text from the visually hidden new-tab warning', () => {
        const hbs = makeHandlebars();
        const credit = hbs.compile(readFileSync('partials/footer-credits.hbs', 'utf8'))({});
        expect(credit).toMatch(
            /<a href="https:\\/\\/adrianoamalfi\\.com\\/astrix\\/" target="_blank" rel="noopener noreferrer">Astrix <span class="gh-visually-hidden">Opens in a new tab<\\/span><\\/a>/,
        );
        expect(readFileSync('partials/site-footer.hbs', 'utf8')).toContain('Ghost <span class="gh-visually-hidden">');
    });
});

describe('page & post templates (templates-pack)', () => {
    const src = (name) => readFileSync(name, 'utf8');

    it('Portfolio renders the page and binds a uniform grid to #portfolio/#project', () => {
        const portfolio = src('custom-portfolio.hbs');
        expect(portfolio).toContain('gh-feed--portfolio');
        expect(portfolio).toContain('tag:[portfolio,project]');
        expect(portfolio).toContain('order="published_at desc"');
        expect(portfolio).toContain('{{> "pack-page"}}');
    });

    it('Landing renders page content with no title, breadcrumbs, or article chrome', () => {
        const landing = src('custom-landing.hbs');
        expect(landing).toContain('gh-article--landing');
        expect(landing).not.toContain('gh-article-title');
        expect(landing).not.toContain('breadcrumbs');
    });

    it('Note keeps the title but drops the table-of-contents rail', () => {
        const note = src('custom-note.hbs');
        expect(note).toContain('kind="note"');
        expect(note).toContain('no_aside=true');
    });
});
`;
    writeFileSync(testFile, t);
}
const utilsTest = join(dst, 'test/utils.test.js');
if (existsSync(utilsTest)) writeFileSync(utilsTest, readFileSync(utilsTest, 'utf8').replace('../assets/js/modules/utils.js', '../assets/js/core/utils.js'));

// 2c. Carried scripts that read Astrix's class names or storage key: point them at the starter's
const retarget = (file, pairs) => {
    const p = join(dst, file);
    if (!existsSync(p)) return;
    let t = readFileSync(p, 'utf8');
    for (const [from, to] of pairs) t = t.replaceAll(from, to);
    writeFileSync(p, t);
};
const common = [["'astrix-scheme'", "'gh-scheme'"]];
retarget('scripts/check-recommendations.mjs', [...common, ['gh-footer-recommendations-title', 'gh-recs-title'], ['gh-footer-recommendations', 'gh-recs'], ['gh-recommendations-list', 'gh-recs-list'], ['gh-recommendation-link', 'gh-rec'], ['gh-recommendation-favicon', 'gh-rec-icon'], ['gh-recommendation-title', 'gh-rec-title'], ['gh-recommendation-url', 'gh-rec-url']]);
retarget('scripts/check-rendered.mjs', common);
retarget('scripts/check-tables.mjs', common);

// 3. package.json: identity from Astrix, build/runtime from the starter
const pkg = readJSON(join(dst, 'package.json'));
for (const k of ['version', 'license', 'homepage', 'repository', 'bugs', 'author', 'keywords']) if (old[k]) pkg[k] = old[k];
pkg.config.image_sizes = old.config.image_sizes;
pkg.config.posts_per_page = old.config.posts_per_page;
pkg.engines = old.engines ?? pkg.engines;
// Astryx (the design system) is replaced by the skin's tokens: drop its packages and the token extraction step
pkg.devDependencies = { ...pkg.devDependencies, ...Object.fromEntries(Object.entries(old.devDependencies).filter(([k]) => !k.startsWith('@astryxdesign/') && !['postcss-custom-media'].includes(k))) };
const keep = ['screenshots', 'smoke:recommendations', 'check:rendered', 'check:tables', 'release'];
for (const k of keep) if (old.scripts[k]) pkg.scripts[k] = old.scripts[k];
// check, check:a11y, test:unit, lint, format and smoke come from the starter (scaffold + core scripts)
pkg.scripts.release = 'npm run zip && node scripts/release-summary.mjs';

// Design settings: Astrix's definitions win for shared names; secondary accent and default scheme go through head-extra
const headExtra = join(dst, 'partials/head-extra.hbs');
let head = readFileSync(headExtra, 'utf8');
head = head.replace('{{!-- @starter:slot --}}', `{{!-- Astrix: default colour scheme (only when the reader has not chosen one) and secondary (gold) accent --}}
<script>(function () { var r = document.documentElement; if (!r.hasAttribute('data-scheme')) { var d = '{{@custom.color_scheme_default}}'.toLowerCase(); if (d === 'light' || d === 'dark') r.setAttribute('data-scheme', d); } })();</script>
{{#if @custom.secondary_accent}}<style>:root { --accent-2: {{@custom.secondary_accent}}; --accent-2-ink: color-mix(in oklab, {{@custom.secondary_accent}} 55%, var(--color-text)); }</style>{{/if}}
{{!-- @starter:slot --}}`);
writeFileSync(headExtra, head);

const used = (name) => {
    const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? (['node_modules', 'docs', 'assets', '.github', 'demo', 'test'].includes(e.name) ? [] : walk(join(d, e.name))) : e.name.endsWith('.hbs') ? [join(d, e.name)] : []);
    return walk(dst).some((f) => readFileSync(f, 'utf8').includes(`@custom.${name}`));
};
const merged = { ...pkg.config.custom, ...old.config.custom };
const dropped = [], kept = [];
for (const k of Object.keys(merged)) { if (used(k)) kept.push(k); else { dropped.push(k); delete merged[k]; } }
pkg.config.custom = merged;
writeFileSync(join(dst, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');

writeFileSync(join(dst, '.migration.json'), JSON.stringify({ from: src, modules, carried, settingsKept: kept, settingsDropped: dropped }, null, 2) + '\n');
console.log(`\nNext: cd ${dst} && npm install && npm run format && npm run check   (format restyles the carried Astrix scripts/tests to the starter's Prettier config; starter files are already formatted)\nMigrated copy: ${dst}\n  carried: ${carried.length} paths\n  settings kept: ${kept.length}, dropped (no template uses them yet): ${dropped.join(', ') || '-'}`);
