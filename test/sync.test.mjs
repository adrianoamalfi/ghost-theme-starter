import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

const bin = (n) => join(import.meta.dirname, '..', 'bin', n);
const sha = (s) => createHash('sha256').update(s).digest('hex');
const manifestPath = (d) => join(d, '.starter.json');

function make(modules = '') {
    const out = mkdtempSync(join(tmpdir(), 'starter-'));
    execFileSync('node', [bin('create-theme.mjs'), 'demo', '--out', out, '--email', 'a@b.it', ...(modules ? ['--modules', modules] : [])], { stdio: 'pipe' });
    return join(out, 'demo');
}
const sync = (dir, ...a) => spawnSync('node', [bin('sync.mjs'), dir, ...a], { encoding: 'utf8' });

test('fresh theme is already in sync', () => {
    const d = make();
    const r = sync(d);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /already up to date/);
});

test('untouched file behind the starter is updated; edited file is a conflict and kept', () => {
    const d = make();
    const m = JSON.parse(readFileSync(manifestPath(d)));

    // simulate an older starter version of partials/pagination.hbs
    writeFileSync(join(d, 'partials/pagination.hbs'), 'OLD');
    m.files['partials/pagination.hbs'] = sha('OLD');
    // simulate a local edit of site-footer on top of an older recorded version
    writeFileSync(join(d, 'partials/site-footer.hbs'), 'MY FOOTER');
    writeFileSync(manifestPath(d), JSON.stringify(m));

    const r = sync(d);
    assert.equal(r.status, 2, 'conflicts exit 2');
    assert.notEqual(readFileSync(join(d, 'partials/pagination.hbs'), 'utf8'), 'OLD');
    assert.equal(readFileSync(join(d, 'partials/site-footer.hbs'), 'utf8'), 'MY FOOTER');
    assert.ok(existsSync(join(d, 'partials/site-footer.hbs.starter-new')));
});

test('dry-run changes nothing', () => {
    const d = make();
    const m = JSON.parse(readFileSync(manifestPath(d)));
    writeFileSync(join(d, 'partials/pagination.hbs'), 'OLD');
    m.files['partials/pagination.hbs'] = sha('OLD');
    writeFileSync(manifestPath(d), JSON.stringify(m));
    sync(d, '--dry-run');
    assert.equal(readFileSync(join(d, 'partials/pagination.hbs'), 'utf8'), 'OLD');
});

test('slots and theme-owned files are never touched by sync', () => {
    const d = make();
    writeFileSync(join(d, 'partials/head-extra.hbs'), 'MY HEAD');
    writeFileSync(join(d, 'assets/css/skin/skin.css'), '/* mine */');
    sync(d);
    assert.equal(readFileSync(join(d, 'partials/head-extra.hbs'), 'utf8'), 'MY HEAD');
    assert.equal(readFileSync(join(d, 'assets/css/skin/skin.css'), 'utf8'), '/* mine */');
});

test('module installs hooks and add-module works on an existing theme', () => {
    const d = make();
    const r = spawnSync('node', [bin('add-module.mjs'), d, 'hero-statement'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.match(readFileSync(join(d, 'assets/css/screen.css'), 'utf8'), /hero-statement\.css/);
    assert.ok('hero_headline' in JSON.parse(readFileSync(join(d, 'package.json'))).config.custom);
    assert.match(readFileSync(join(d, 'partials/hero-statement.hbs'), 'utf8'), /gh-hero/);
    assert.match(readFileSync(join(d, 'partials/home-before.hbs'), 'utf8'), /\{\{> "hero-statement"\}\}/);
    assert.deepEqual(JSON.parse(readFileSync(manifestPath(d))).modules, ['hero-statement']);
});

test('refuses to overwrite an existing target', () => {
    const d = make();
    const r = spawnSync('node', [bin('create-theme.mjs'), 'demo', '--out', join(d, '..')], { encoding: 'utf8' });
    assert.notEqual(r.status, 0);
});

test('all modules together: slots compose in order, locales merged, no duplicates on re-run', () => {
    const all = ['hero-statement', 'social-links', 'toc', 'share', 'related-posts', 'membership-cta', 'post-hero', 'comments', 'lightbox', 'code-copy', 'heading-anchors', 'reading-progress'];
    const d = make(all.join(','));
    const slot = readFileSync(join(d, 'partials/post-after-content.hbs'), 'utf8');
    assert.ok(slot.indexOf('"membership-cta"') < slot.indexOf('"share"') && slot.indexOf('"share"') < slot.indexOf('"related-posts"'));
    assert.match(readFileSync(join(d, 'partials/footer-extra.hbs'), 'utf8'), /"social-links"/);
    assert.match(readFileSync(join(d, 'partials/post-aside.hbs'), 'utf8'), /"toc"/);
    assert.match(readFileSync(join(d, 'assets/js/post.js'), 'utf8'), /initToc\(\);[\s\S]*initShare\(\)|initShare\(\);[\s\S]*initToc\(\)/);
    const it = JSON.parse(readFileSync(join(d, 'locales/it.json')));
    assert.equal(it['On this page'], 'In questa pagina');
    assert.equal(it['Keep reading'], 'Continua a leggere');
    const r = sync(d);
    assert.equal(r.status, 0, r.stdout);
    assert.match(r.stdout, /already up to date/);
});

test('add-module merges locales into an unmodified theme and keeps it sync-clean', () => {
    const d = make();
    assert.equal(spawnSync('node', [bin('add-module.mjs'), d, 'toc'], { encoding: 'utf8' }).status, 0);
    assert.equal(JSON.parse(readFileSync(join(d, 'locales/en.json')))['On this page'], 'On this page');
    assert.match(sync(d).stdout, /already up to date/);
});

test('generation orders slot contents by module order, comments get their own slot', () => {
    const d = make('related-posts,share,membership-cta,comments');
    const slot = readFileSync(join(d, 'partials/post-after-content.hbs'), 'utf8');
    assert.ok(slot.indexOf('"membership-cta"') < slot.indexOf('"share"') && slot.indexOf('"share"') < slot.indexOf('"related-posts"'));
    assert.match(readFileSync(join(d, 'partials/post-comments.hbs'), 'utf8'), /"comments"/);
    assert.doesNotMatch(slot, /"comments"/);
});

test('spectra skin: binary fonts copied intact, head-extra keeps slot marker', () => {
    const out = mkdtempSync(join(tmpdir(), 'starter-'));
    execFileSync('node', [bin('create-theme.mjs'), 'sp', '--out', out, '--email', 'a@b.it', '--skin', 'spectra'], { stdio: 'pipe' });
    const font = 'assets/fonts/bricolage-grotesque-latin-var.woff2';
    const src = readFileSync(join(import.meta.dirname, '..', 'skins/spectra', font));
    assert.ok(readFileSync(join(out, 'sp', font)).equals(src));
    assert.match(readFileSync(join(out, 'sp/partials/head-extra.hbs'), 'utf8'), /@starter:slot/);
});

test('footer-variants replaces the pristine footer-layout slot, keeps an edited one', () => {
    const d = make('footer-variants');
    assert.match(readFileSync(join(d, 'partials/footer-layout.hbs'), 'utf8'), /"footer-dispatch"/);

    const e = make();
    writeFileSync(join(e, 'partials/footer-layout.hbs'), 'MY FOOTER {{> @partial-block}}');
    const r = spawnSync('node', [bin('add-module.mjs'), e, 'footer-variants'], { encoding: 'utf8' });
    assert.equal(r.status, 0);
    assert.match(r.stderr, /was edited/);
    assert.match(readFileSync(join(e, 'partials/footer-layout.hbs'), 'utf8'), /MY FOOTER/);
});

test('appearance modules replace header, scheme control and feed slots; core defaults stay when absent', () => {
    const none = make();
    assert.match(readFileSync(join(none, 'partials/header-layout.hbs'), 'utf8'), /@partial-block/);
    assert.match(readFileSync(join(none, 'partials/feed-layout.hbs'), 'utf8'), /@partial-block/);
    const d = make('header-styles,scheme-switch,feed-styles');
    assert.match(readFileSync(join(d, 'partials/header-layout.hbs'), 'utf8'), /"header-styles"/);
    assert.match(readFileSync(join(d, 'partials/header-scheme.hbs'), 'utf8'), /"scheme-switch"/);
    assert.match(readFileSync(join(d, 'partials/feed-layout.hbs'), 'utf8'), /"feed-styles-layout"/);
    const pkg = JSON.parse(readFileSync(join(d, 'package.json')));
    assert.ok('header_style' in pkg.config.custom && 'post_feed_style' in pkg.config.custom);
    assert.match(readFileSync(join(d, 'assets/js/main.js'), 'utf8'), /initSchemeSwitch\(\);/);
});

test('sync creates slots introduced by a newer starter, keeps existing ones', () => {
    const d = make();
    rmSync(join(d, 'partials/feed-layout.hbs'));
    writeFileSync(join(d, 'partials/head-extra.hbs'), 'MINE');
    const r = sync(d);
    assert.match(r.stdout, /new slots/);
    assert.ok(existsSync(join(d, 'partials/feed-layout.hbs')));
    assert.equal(readFileSync(join(d, 'partials/head-extra.hbs'), 'utf8'), 'MINE');
});

test('templates-pack ships seven custom templates and wires the archive script', () => {
    const d = make('templates-pack');
    for (const t of ['archive', 'essay', 'landing', 'membership', 'newsletter', 'note', 'portfolio']) assert.ok(existsSync(join(d, `custom-${t}.hbs`)), t);
    assert.match(readFileSync(join(d, 'assets/js/post.js'), 'utf8'), /initArchive\(\);/);
    assert.match(readFileSync(join(d, 'assets/css/post.css'), 'utf8'), /templates-pack\.css/);
    assert.equal(JSON.parse(readFileSync(join(d, 'locales/it.json')))['Essay'], 'Saggio');
});

test('meta, subscribe copy and hero-skip modules: slots replaced, core file overridden, sync stays clean', () => {
    const d = make();
    for (const m of ['post-meta-options', 'subscribe-cta', 'site-hero']) {
        const r = spawnSync('node', [bin('add-module.mjs'), d, m], { encoding: 'utf8' });
        assert.equal(r.status, 0, r.stderr);
    }
    assert.match(readFileSync(join(d, 'partials/meta-layout.hbs'), 'utf8'), /"post-meta-options"/);
    assert.match(readFileSync(join(d, 'partials/subscribe-headline.hbs'), 'utf8'), /"cta-headline"/);
    assert.match(readFileSync(join(d, 'partials/home-after.hbs'), 'utf8'), /"subscribe-form"/);
    assert.match(readFileSync(join(d, 'home.hbs'), 'utf8'), /skip_from="5"/);
    assert.match(sync(d).stdout, /already up to date/);
});

test('a module refuses to override a core file that was edited locally', () => {
    const d = make();
    writeFileSync(join(d, 'home.hbs'), '{{!< default}} MINE');
    const r = spawnSync('node', [bin('add-module.mjs'), d, 'site-hero'], { encoding: 'utf8' });
    assert.equal(r.status, 2);
    assert.match(readFileSync(join(d, 'home.hbs'), 'utf8'), /MINE/);
});

test('behaviour modules wire main.js / post.js and tables adds its label slot', () => {
    const d = make('infinite-scroll,fit-titles,tables,code-copy,lightbox,heading-anchors');
    const main = readFileSync(join(d, 'assets/js/main.js'), 'utf8');
    assert.match(main, /initInfiniteScroll\(\);/); assert.match(main, /initFitTitles\(\);/);
    const post = readFileSync(join(d, 'assets/js/post.js'), 'utf8');
    for (const f of ['initTables', 'initCodeCopy', 'initLightbox', 'initHeadingAnchors']) assert.match(post, new RegExp(f + '\\(\\);'));
    assert.match(readFileSync(join(d, 'partials/post-after-content.hbs'), 'utf8'), /"tables-labels"/);
    assert.equal(JSON.parse(readFileSync(join(d, 'locales/it.json')))['Scrollable table'], 'Tabella scorrevole');
    assert.match(readFileSync(join(d, 'partials/pagination.hbs'), 'utf8'), /data-loading/);
});

test('featured-slider requires site-hero and overrides its home.hbs; fonts are an optional module', () => {
    const bad = spawnSync('node', [bin('create-theme.mjs'), 'x', '--out', mkdtempSync(join(tmpdir(), 'starter-')), '--email', 'a@b.it', '--modules', 'featured-slider'], { encoding: 'utf8' });
    assert.notEqual(bad.status, 0);
    assert.match(bad.stderr, /requires one of: site-hero, post-hero/);

    const d = make('site-hero,featured-slider,feed-styles,custom-fonts');
    assert.match(readFileSync(join(d, 'home.hbs'), 'utf8'), /skip_featured/);
    assert.match(readFileSync(join(d, 'partials/home-before.hbs'), 'utf8'), /"featured-slider"/);
    assert.match(readFileSync(join(d, 'partials/feed-item.hbs'), 'utf8'), /"feed-card"/);
    const custom = JSON.parse(readFileSync(join(d, 'package.json'))).config.custom;
    assert.ok('show_featured_slider' in custom && 'heading_font' in custom);
    assert.ok(!('heading_font' in JSON.parse(readFileSync(join(make(), 'package.json'))).config.custom));
    assert.match(sync(d).stdout, /already up to date/);
});

test('sync re-applies module hooks for slots a newer starter replaces', () => {
    const d = make('feed-styles');
    // simulate a theme generated before feed-styles replaced the feed-item slot
    writeFileSync(join(d, 'partials/feed-item.hbs'), readFileSync(join(import.meta.dirname, '..', 'seed/partials/feed-item.hbs')));
    sync(d);
    assert.match(readFileSync(join(d, 'partials/feed-item.hbs'), 'utf8'), /"feed-card"/);
});

test('setting aliases rename keys and values in module templates, settings and stay sync-clean', () => {
    const out = mkdtempSync(join(tmpdir(), 'starter-'));
    const aliases = join(out, 'aliases.json');
    writeFileSync(aliases, JSON.stringify({ settings: { post_hero_style: 'header_style', show_author_meta: 'show_author_meta' }, values: { show_author_meta: { 'Name and photo': 'Name and avatar' } } }));
    execFileSync('node', [bin('create-theme.mjs'), 'al', '--out', out, '--email', 'a@b.it', '--modules', 'post-hero,post-meta-options', '--aliases', aliases], { stdio: 'pipe' });
    const d = join(out, 'al');
    assert.match(readFileSync(join(d, 'partials/post-hero.hbs'), 'utf8'), /@custom\.header_style/);
    assert.doesNotMatch(readFileSync(join(d, 'partials/post-hero.hbs'), 'utf8'), /post_hero_style/);
    assert.match(readFileSync(join(d, 'partials/post-meta-options.hbs'), 'utf8'), /"Name and avatar"/);
    const custom = JSON.parse(readFileSync(join(d, 'package.json'))).config.custom;
    assert.ok('header_style' in custom && !('post_hero_style' in custom));
    assert.match(sync(d).stdout, /already up to date/);
});

test('aliases never cascade (a->b and b->c apply once)', async () => {
    const { applyAliases } = await import('../bin/lib.mjs');
    const out = applyAliases('{{@custom.a}} {{#match @custom.b "x"}}', { settings: { a: 'b', b: 'c' }, values: { b: { x: 'y' } } });
    assert.equal(out, '{{@custom.b}} {{#match @custom.c "y"}}');
});

test('featured-slider picks the post-hero variant and feed-layouts replaces the feed slot', () => {
    const d = make('post-hero,featured-slider,feed-layouts,header-styles');
    assert.match(readFileSync(join(d, 'home.hbs'), 'utf8'), /skip_id=first/);
    assert.match(readFileSync(join(d, 'partials/featured-slider.hbs'), 'utf8'), /post_hero_style/);
    assert.match(readFileSync(join(d, 'partials/feed-layout.hbs'), 'utf8'), /"feed-layouts-layout"/);
    assert.match(readFileSync(join(d, 'partials/home-before.hbs'), 'utf8'), /"post-hero"[\s\S]*"featured-slider"/);
    const e = make('site-hero,featured-slider');
    assert.match(readFileSync(join(e, 'home.hbs'), 'utf8'), /skip_from="5"/);
    assert.match(sync(d).stdout, /already up to date/);
    assert.match(sync(e).stdout, /already up to date/);
});

test('generated themes ship the quality scripts and generic tests, and the tests pass', () => {
    const d = make('post-hero,toc,heading-anchors');
    for (const f of ['scripts/check-a11y.mjs', 'scripts/smoke-routes.mjs', 'test/starter.templates.test.js', 'assets/js/core/utils.js']) assert.ok(existsSync(join(d, f)), f);
    const pkg = JSON.parse(readFileSync(join(d, 'package.json')));
    assert.match(pkg.scripts.check, /check:a11y/);
    assert.match(pkg.scripts.check, /test:unit/);
    assert.match(readFileSync(join(d, 'default.hbs'), 'utf8'), /id="gh-main-content"/);
    assert.match(readFileSync(join(d, 'partials/breadcrumbs.hbs'), 'utf8'), /BreadcrumbList/);
});

test('README module and skin tables are generated and up to date', () => {
    const r = spawnSync('node', [bin('docs.mjs'), '--check'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
});

test('a photographer theme: phantasma skin + photo modules generate cleanly', () => {
    const out = mkdtempSync(join(tmpdir(), 'starter-'));
    execFileSync('node', [bin('create-theme.mjs'), 'ph', '--out', out, '--email', 'a@b.it', '--skin', 'phantasma',
        '--modules', 'header-styles,post-hero,featured-slider,photo-grid,photo-templates,lightbox,social-links,membership-cta,related-posts'], { stdio: 'pipe' });
    const d = join(out, 'ph');
    for (const f of ['custom-series.hbs', 'custom-photo.hbs', 'custom-about.hbs', 'partials/photo-card.hbs', 'assets/fonts/archivo-latin-wdth-normal.woff2']) assert.ok(existsSync(join(d, f)), f);
    assert.match(readFileSync(join(d, 'partials/feed-item.hbs'), 'utf8'), /"photo-card"/);
    assert.match(readFileSync(join(d, 'partials/feed-layout.hbs'), 'utf8'), /"photo-grid-layout"/);
    assert.match(readFileSync(join(d, 'partials/head-extra.hbs'), 'utf8'), /Archivo/);
    // gated photographs ship a 30px stand-in, never the full-size file; Ghost's own upgrade box is replaced
    for (const f of ['partials/photo-card.hbs', 'custom-photo.hbs']) assert.match(readFileSync(join(d, f), 'utf8'), /size="xxs"/, f);
    assert.match(readFileSync(join(d, 'package.json'), 'utf8'), /"xxs"/);
    assert.ok(existsSync(join(d, 'partials/content-cta.hbs')));
    assert.match(readFileSync(join(d, 'partials/related-posts.hbs'), 'utf8'), /"feed-item"/);
    assert.match(readFileSync(join(d, 'partials/header-rail-foot.hbs'), 'utf8'), /"photo-rail"/);
    assert.match(readFileSync(join(d, 'partials/header-rail-foot.hbs'), 'utf8'), /"social-links"/);
    assert.match(sync(d).stdout, /already up to date/);
});

test('every module setting fits gscan: description under 100 characters, group post or homepage', () => {
    const root = join(import.meta.dirname, '..', 'modules');
    for (const m of readdirSync(root)) {
        const mod = JSON.parse(readFileSync(join(root, m, 'module.json')));
        for (const [k, v] of Object.entries(mod.settings ?? {})) {
            assert.ok((v.description ?? '').length < 100, `${m}.${k} description`);
            assert.ok(!v.group || ['post', 'homepage'].includes(v.group), `${m}.${k} group (gscan allows only post, homepage)`);
        }
    }
});

test('remove-module undoes add-module: files, hooks, replaced slot, settings; sync stays clean', () => {
    const d = make('header-styles,scheme-switch,site-hero');
    const slotBefore = readFileSync(join(d, 'partials/header-scheme.hbs'), 'utf8');
    assert.match(slotBefore, /"scheme-switch"/);

    let r = spawnSync('node', [bin('remove-module.mjs'), d, 'scheme-switch'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.ok(!existsSync(join(d, 'partials/scheme-switch.hbs')));
    assert.ok(!existsSync(join(d, 'assets/js/modules/scheme-switch.js')));
    assert.doesNotMatch(readFileSync(join(d, 'assets/js/main.js'), 'utf8'), /SchemeSwitch/);
    assert.doesNotMatch(readFileSync(join(d, 'assets/css/screen.css'), 'utf8'), /scheme-switch/);
    assert.match(readFileSync(join(d, 'partials/header-scheme.hbs'), 'utf8'), /@partial-block/);
    assert.deepEqual(JSON.parse(readFileSync(manifestPath(d))).modules, ['header-styles', 'site-hero']);
    assert.match(sync(d).stdout, /already up to date/);

    // removing a module that overrode a core file restores the core version
    r = spawnSync('node', [bin('remove-module.mjs'), d, 'site-hero'], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.doesNotMatch(readFileSync(join(d, 'home.hbs'), 'utf8'), /skip_from/);
    const custom = JSON.parse(readFileSync(join(d, 'package.json'))).config.custom;
    assert.ok(!('hero_style' in custom) && 'header_style' in custom);
    assert.match(sync(d).stdout, /already up to date/);
});

test('remove-module keeps what you edited and refuses to remove a dependency', () => {
    const d = make('site-hero,featured-slider');
    let r = spawnSync('node', [bin('remove-module.mjs'), d, 'site-hero'], { encoding: 'utf8' });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /required by featured-slider/);

    const e = make('scheme-switch');
    writeFileSync(join(e, 'partials/scheme-switch.hbs'), 'MINE');
    r = spawnSync('node', [bin('remove-module.mjs'), e, 'scheme-switch'], { encoding: 'utf8' });
    assert.equal(r.status, 2);
    assert.match(r.stdout, /kept, edited locally/);
    assert.equal(readFileSync(join(e, 'partials/scheme-switch.hbs'), 'utf8'), 'MINE');
});
