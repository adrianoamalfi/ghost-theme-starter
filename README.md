# ghost-theme-starter

Scaffolding for Ghost themes that look nothing alike but share the same plumbing: templates, accessibility, i18n, build, tests, and a library of optional features. Distilled from the Astrix and Spectra themes; Ghost 6.x.

A generated theme is a normal, self-contained Ghost theme (a zip, no runtime dependency on this repo). The repo is only used to generate it and to keep it up to date.

## Quick start

```bash
node bin/create-theme.mjs my-theme --name "My Theme" --skin neutral \
  --modules post-hero,social-links,lightbox,subscribe-cta --email me@example.com
cd ../my-theme
npm install
npm run format        # once, if you carried over foreign sources
npm run check         # build + gscan + i18n + a11y + unit tests + lint + prettier
npm run zip           # dist/my-theme.zip, a whitelist: no dev files can leak into a release
```

Options: `--out <dir>` (default `..`), `--author`, `--description`, `--aliases <file.json>` (see below). Add a module later with `node bin/add-module.mjs ../my-theme <module>`; take one out with `node bin/remove-module.mjs ../my-theme <module>` (it deletes the module's files, restores a core file it overrode, unhooks imports and slots, gives replaced slots their default back and drops its settings; anything you edited is kept and reported).

## How it is organised

| Layer | Lives in | Owner after generation | Updated by |
| --- | --- | --- | --- |
| **core**: templates, partials, locales, icons, core CSS/JS, quality scripts and tests | `core/` | starter | `starter:sync` |
| **modules**: optional features with their partials, CSS, JS, settings and translations | `modules/<name>/` | starter | `starter:sync` |
| **skin**: the look (tokens, rules, fonts) | `skins/<name>/` | the theme | you |
| **slots**: empty hook partials the theme fills (`head-extra`, `home-before`, `footer-extra`…) | `seed/` | the theme | you |
| **scaffold**: `package.json`, build config, entry CSS/JS, lint/format config | `scaffold/` | the theme | you |

**The rule that keeps themes different and robust:** core and modules carry structure and behaviour and read only CSS variables (`core/assets/css/core/tokens.css`). A skin changes the look by redefining those variables and adding rules in the `skin` cascade layer. Layer order is declared once in the theme's `screen.css`: `reset, tokens, base, layout, components, prose, skin, utilities, print`. `koenig.css` is unlayered and last because Ghost injects unlayered card CSS. A skin rule beats a module rule, so a skin must not restyle selectors a module sizes itself.

### Extension points

- **Slots**: modules add a partial above the `{{!-- @starter:slot --}}` marker of a slot file (so several modules share one slot); reorder lines freely, keep the marker.
- **Replaceable slots** (`footer-layout`, `header-layout`, `header-scheme`, `feed-layout`, `feed-item`, `meta-layout`, `subscribe-headline`, `subscribe-text`): the core ships a default through `{{> @partial-block}}`; a module `replaces` the slot while it is still pristine, otherwise your edit wins and you get a warning.
- **Tokens a skin usually sets**: colours (`--color-*`, `--accent*`), `--font-*`, `--radius*`, `--wrap`, `--gutter`, `--measure`, `--header-h`, `--surface-dark`, the display scale `--display-1..3` (fluid, with a mobile scale), `--toc-rail-min`. Colours are `light-dark()` pairs, so one override covers both schemes. Use `--accent-fill`/`--on-accent` for solid fills and `--accent-ink` for accent text: that is what lets a skin guarantee contrast for any accent.

## Keeping themes up to date

Fix something in `core/` or a module, then in each theme:

```bash
npm run starter:sync -- --dry-run     # preview (set STARTER=/path if the repo is not a sibling folder)
npm run starter:sync
```

Per starter-owned file, using the hashes in the theme's `.starter.json`: untouched locally → overwritten; edited locally → kept, the new version is written as `*.starter-new` (exit code 2); deleted locally → stays deleted. `sync` also creates slots introduced by newer starter versions and re-applies module hooks.

## Skins

<!-- skins:start -->
| Skin | Look |
|------|------|
| `astrix` | Astrix look: Figtree, flat surfaces (no shadows, hairline borders), image-led cards, gold as the second voice. Tokens mapped from Astrix's Astryx neutral theme. |
| `neutral` | Clean system-font baseline. Starting point for a custom look. |
| `phantasma` | A photographer's light table: neutral grey ground (dark by default), a safelight-red accent for what is selected, condensed Archivo titles, JetBrains Mono for frame data, contact-sheet numbering, no rounded corners. |
| `spectra` | Spectra look: Bricolage Grotesque + Instrument Sans, pill controls, large tiles, and a full colour system generated in OKLCH from the single Ghost accent colour. |
<!-- skins:end -->

A skin is `tokens.css` + `skin.css` (+ fonts, + optionally `partials/head-extra.hbs` to declare and preload fonts through the asset helper).

## Modules

<!-- modules:start -->
| Module | Slot | Settings | What it adds |
|--------|------|----------|--------------|
| `code-copy` | `post-after-content` | 0 | Copy button and language badge on code blocks. |
| `comments` | `post-comments` | 0 | Ghost native comments, lazy-mounted when the reader scrolls near. |
| `custom-fonts` | `head-extra` | 2 | Typography choices in Ghost Admin (heading and body font). Ghost injects --gh-font-heading/--gh-font-body, which the core tokens already use. Costs 2 of the 20 settings. |
| `featured-slider` | `home-before` | 1 | Swipeable row of featured posts under the hero (show_featured_slider). Works with site-hero or post-hero (variants: its own home.hbs keeps the hero and the row out of the feed). Needs one of site-hero/post-hero. |
| `feed-layouts` | `feed-layout (replaces)` | 1 | Post feed layouts from Astrix: Bold grid, Mosaic, List, over the core image cards. Replaces the core feed via the feed-layout slot; an alternative to feed-styles. |
| `feed-styles` | `feed-layout (replaces)`, `feed-item (replaces)` | 1 | Post feed as tiles in three styles from Spectra: Bento, Grid, List; replaces the core feed via the feed-layout slot. |
| `fit-titles` | - | 0 | Shrinks a display title just enough when one long word would overflow its container. |
| `footer-variants` | `footer-layout (replaces)` | 2 | Two footer layouts from Spectra: Colophon (ruled columns) and Signoff (closing tile with subscribe). Replaces the core footer via the footer-layout slot. |
| `header-styles` | `header-layout (replaces)` | 1 | Header with Inline, Stacked, Centered and Sidebar (fixed left rail) layouts and a Sign in / Account button; replaces the core header via the header-layout slot. Skins style it. |
| `heading-anchors` | `post-after-content` | 0 | Hover permalink on h2/h3 that copies the section URL. |
| `hero-statement` | `home-before` | 2 | Large headline + intro on the homepage (fills the home-before slot). |
| `infinite-scroll` | - | 0 | Loads the next page of the feed when the pagination nears the viewport; classic prev/next stays as the fallback (no JS, Save-Data, errors). |
| `lightbox` | `post-after-content` | 0 | Zoomable images and galleries with keyboard, swipe and focus trap. |
| `membership-cta` | `post-after-content` | 0 | Upgrade/sign-in panel shown where gated content is cut off (members-only and paid posts). |
| `photo-grid` | `feed-layout (replaces)`, `feed-item (replaces)` | 1 | A photograph-first feed: Rows (justified, in order), Masonry, Uniform or Single column; each photo keeps its proportions, caption on hover. Replaces the core feed (an alternative to feed-styles and feed-layouts). |
| `photo-templates` | `header-rail-foot`, `home-before` | 2 | Templates for a photographer's site: Series (tags as cover tiles), Photo (one large uncropped photograph, thumbnail navigation, print request, lightbox), About (portrait beside text) and Contact. |
| `post-hero` | `home-before` | 4 | Homepage hero from the latest featured post (Poster, Editorial, Split), a quiet photograph (Cover), a slideshow of up to five featured photographs, or the author (Personal); falls back to a site intro. |
| `post-meta-options` | `meta-layout (replaces)` | 2 | Author (name and photo / name only / hidden) and reading-time options for post and card meta; replaces the core meta row via the meta-layout slot. |
| `reading-progress` | `post-after-content` | 1 | Thin reading-progress bar at the top of the viewport on posts. |
| `related-posts` | `post-after-content` | 1 | Three related posts (same primary tag, else latest) after the article. |
| `scheme-switch` | `header-scheme (replaces)` | 0 | Three-state colour control (System / Light / Dark) in the header; replaces the core one-button toggle via the header-scheme slot. |
| `share` | `post-after-content` | 0 | Share row under the article: X, Facebook, LinkedIn, copy link, native share sheet, optional support link. |
| `site-hero` | `home-before` | 5 | Homepage hero in four styles from Spectra: Featured, Masthead, Statement, Index (real topics and counts). Fills home-before. |
| `social-links` | `footer-extra`, `personal-hero-extra`, `contact-extra`, `header-rail-foot` | 4 | Social icon row (Ghost social accounts + GitHub, Hugging Face, email, free URL, RSS) in the footer-extra slot. |
| `subscribe-cta` | `home-after`, `subscribe-headline (replaces)`, `subscribe-text (replaces)` | 2 | Subscribe band under the homepage feed with a custom headline and supporting line (cta_headline, cta_text). Delete the line from partials/home-after.hbs to drop the band. |
| `tables` | `post-after-content` | 0 | Wide tables scroll inside a focusable, labelled region instead of widening the page. |
| `templates-pack` | templates | 0 | Seven custom templates: Archive, Essay, Landing, Membership, Newsletter, Note (from Spectra and Astrix, which agree) and Portfolio (Astrix). Assign them in Ghost Admin (Essay and Note on posts, the rest on pages). |
| `toc` | `post-aside` | 1 | Table of contents with scrollspy: sticky in the left gutter on wide screens, collapsible above the article otherwise. |
<!-- modules:end -->

Notes:

- `hero-statement`, `post-hero` and `site-hero` all fill `home-before`: install one. `feed-layouts` and `feed-styles` both replace `feed-layout`: install one.
- A module may set `"order"` (default 50) to be placed earlier or later when several modules fill a slot (`membership-cta` 10, `share` 20, `related-posts` 30).
- **Limit:** gscan rejects themes with more than 20 `config.custom` settings. The scaffold declares none; every module's settings count (see the table). Installing everything exceeds it, so pick the set you need.

### Writing a module

`modules/<name>/` mirrors the theme tree, plus `module.json`:

```json
{
  "name": "my-module", "description": "…", "order": 50,
  "css": ["modules/my-module.css"], "postCss": [],
  "js": { "import": "import { a } from './modules/a.js';", "init": "a();" },
  "postJs": { "import": "…", "init": "…" },
  "slots": { "post-after-content": "my-partial" },
  "replaces": { "feed-layout": "my-layout" },
  "requires": ["other-module"], "requiresAny": ["a", "b"],
  "variants": { "post-hero": { "home.hbs": "variants/post-hero/home.hbs" } },
  "settings": { "my_setting": { "type": "boolean", "default": true } }
}
```

`css`/`js` go to `screen.css`/`main.js` (every page); `postCss`/`postJs` to `post.css`/`post.js` (posts and pages). CSS lands in the `components` layer and must use only tokens. `locales/<lang>.json` fragments are merged into the theme's locales. A module can override a core file (e.g. `home.hbs`) only while the theme has not edited it. `variants` swap files when another module is installed. After changing modules or skins run `npm run docs` to refresh the tables above.

### Aliases: keep a site's existing configuration

Ghost stores Design settings by key, so renaming a setting resets a site's configuration. `--aliases file.json` (kept in `.starter.json`, applied by create, add-module and sync) maps module names and values to the theme's:

```json
{ "settings": { "post_hero_style": "header_style" },
  "values": { "show_author_meta": { "Name and photo": "Name and avatar" } } }
```

## Migrating an existing theme

`migrations/spectra.mjs` and `migrations/astrix.mjs` build a migrated **copy** of those themes (never touching the original), carry over their docs and release plumbing, keep their setting names through aliases, and print what is left. Use them as a template for migrating another theme: generate a copy, run it in a local Ghost next to the original, compare, close the gaps as modules.

## Quality tooling in generated themes

`npm run check` = build + gscan + i18n + static a11y + vitest (`test/starter.templates.test.js`: Handlebars-in-comments guard, helper invocation smoke test, SEO breadcrumbs, recommendations) + eslint + prettier. Prettier covers JS only (CSS and templates ignored; `locales/` stays byte-identical so sync works). With a running Ghost: `GHOST_URL=http://localhost:2368 npm run smoke`. The a11y script and the smoke test expect the skip-link target `#gh-main-content`.

## Development of the starter

```bash
npm test          # generate / sync / conflicts / dry-run / modules / aliases / variants / README up to date
npm run docs      # regenerate the module and skin tables
```

## Licence

MIT, see [LICENSE](LICENSE). Themes generated from this starter are MIT too.
