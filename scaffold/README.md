# __NAME__

Ghost theme generated with ghost-theme-starter (skin: `__SKIN__`).

```bash
npm install
npm run dev     # watch CSS/JS
npm run check   # build + gscan + i18n
npm run zip     # dist/__SLUG__.zip
```

## Who owns what

| Path | Owner | Notes |
| --- | --- | --- |
| `core/`-derived files (templates, `partials/`, `locales/`, `assets/*/core/`, `scripts/`) | starter | update with `npm run starter:sync` (set `STARTER=/path/to/ghost-theme-starter` if it is not a sibling folder; add `-- --dry-run` to preview) |
| `assets/css/skin/`, `assets/css/screen.css`, `assets/js/main.js` | this theme | edit freely |
| `partials/head-extra.hbs`, `home-before.hbs`, `header-actions.hbs`, `footer-extra.hbs`, `post-card-media.hbs`, `post-after-content.hbs` | this theme | extension slots, create to override |

If you edit a starter-owned file, sync will keep your version and write the new one next to it as `*.starter-new`.
