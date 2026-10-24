#!/usr/bin/env node
// Regenerates the module and skin tables in README.md from modules/*/module.json and skins/*/skin.json.
// Usage: node bin/docs.mjs [--check]   (--check exits 1 when README.md is out of date)
import { readFileSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, readJSON } from './lib.mjs';

const dirs = (d) => readdirSync(join(ROOT, d), { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name).sort();

const modules = dirs('modules').map((name) => {
    const m = readJSON(join(ROOT, 'modules', name, 'module.json'));
    const slots = [...Object.keys(m.slots ?? {}), ...Object.keys(m.replaces ?? {}).map((k) => `${k} (replaces)`)];
    const hasTemplates = readdirSync(join(ROOT, 'modules', name)).some((f) => /^custom-.*\.hbs$/.test(f));
    const where = slots.length ? slots.map((s) => `\`${s}\``).join(', ') : hasTemplates ? 'templates' : '-';
    const needs = [...(m.requires ?? []), ...(m.requiresAny?.length ? [`one of ${m.requiresAny.join('/')}`] : [])];
    return `| \`${name}\` | ${where} | ${Object.keys(m.settings ?? {}).length} | ${m.description}${needs.length ? ` Needs ${needs.join(', ')}.` : ''} |`;
});
const skins = dirs('skins').map((name) => `| \`${name}\` | ${readJSON(join(ROOT, 'skins', name, 'skin.json')).description} |`);

const table = (head, rows) => [head, head.replace(/[^|]/g, '-'), ...rows].join('\n');
const blocks = {
    modules: table('| Module | Slot | Settings | What it adds |', modules),
    skins: table('| Skin | Look |', skins),
};

const file = join(ROOT, 'README.md');
let readme = readFileSync(file, 'utf8');
for (const [key, body] of Object.entries(blocks)) {
    const re = new RegExp(`(<!-- ${key}:start -->\\n)[\\s\\S]*?(<!-- ${key}:end -->)`);
    if (!re.test(readme)) { console.error(`README.md is missing the <!-- ${key}:start/end --> markers`); process.exit(1); }
    readme = readme.replace(re, `$1${body}\n$2`);
}
if (process.argv.includes('--check')) {
    if (readFileSync(file, 'utf8') !== readme) { console.error('README.md is out of date: run `npm run docs`'); process.exit(1); }
    console.log('README.md is up to date');
} else {
    writeFileSync(file, readme);
    console.log(`README.md updated: ${modules.length} modules, ${skins.length} skins`);
}
