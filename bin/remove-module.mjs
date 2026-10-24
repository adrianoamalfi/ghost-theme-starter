#!/usr/bin/env node
// Usage: node bin/remove-module.mjs <theme-dir> <module> [--keep-settings]
// The inverse of add-module: deletes the module's files (restoring a core file it overrode), unhooks its
// css/js imports and slot lines, gives replaced slots back their default, and drops its settings.
// Files and slots you edited are kept and reported.
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import {
    ROOT, MANIFEST, existsSync, join, resolve, sha, put, loadManifest, readJSON, writeJSON, sourceFiles, missingRequires,
} from './lib.mjs';

const args = process.argv.slice(2);
const keepSettings = args.includes('--keep-settings');
const [dir, name] = args.filter((a) => !a.startsWith('--'));
if (!dir || !name) { console.error('Usage: remove-module <theme-dir> <module> [--keep-settings]'); process.exit(1); }

const theme = resolve(process.cwd(), dir);
const manifest = loadManifest(theme);
if (!manifest.modules.includes(name)) { console.error(`${name} is not installed`); process.exit(1); }

const remaining = manifest.modules.filter((m) => m !== name);
const dependents = manifest.modules.filter((m) => m !== name && missingRequires(remaining).some((p) => p.startsWith(`${m} requires`)));
if (dependents.length) { console.error(`Cannot remove ${name}: required by ${dependents.join(', ')}`); process.exit(1); }

const mod = readJSON(join(ROOT, 'modules', name, 'module.json'));
const report = { removed: [], restored: [], kept: [], unhooked: [], warnings: [] };

// 1. Files: whatever the remaining modules no longer produce (or produce differently) goes or reverts
const before = sourceFiles(manifest.modules, manifest.aliases);
const after = sourceFiles(remaining, manifest.aliases);
for (const [rel, data] of before) {
    const next = after.get(rel);
    if (next && sha(next) === sha(data)) continue;
    const dest = join(theme, rel);
    if (!existsSync(dest)) { delete manifest.files[rel]; continue; }
    if (sha(readFileSync(dest)) !== manifest.files[rel]) { report.kept.push(rel); continue; }
    if (next) { put(dest, next); manifest.files[rel] = sha(next); report.restored.push(rel); }
    else { rmSync(dest); delete manifest.files[rel]; report.removed.push(rel); }
}

// 2. css / js imports and slot lines
const dropLines = (file, lines) => {
    if (!existsSync(file)) return;
    const txt = readFileSync(file, 'utf8');
    const kept = txt.split('\n').filter((l) => !lines.includes(l.trim()));
    if (kept.length !== txt.split('\n').length) { writeFileSync(file, kept.join('\n')); report.unhooked.push(file.replace(`${theme}/`, '')); }
};
dropLines(join(theme, 'assets/css/screen.css'), (mod.css ?? []).map((f) => `@import '${f}' layer(components);`));
dropLines(join(theme, 'assets/css/post.css'), (mod.postCss ?? []).map((f) => `@import '${f}' layer(components);`));
for (const [key, file] of [['js', 'main.js'], ['postJs', 'post.js']]) {
    if (mod[key]) dropLines(join(theme, 'assets/js', file), [mod[key].import, mod[key].init]);
}
for (const [slot, partial] of Object.entries(mod.slots ?? {})) dropLines(join(theme, 'partials', `${slot}.hbs`), [`{{> "${partial}"}}`]);

// 3. Replaced slots go back to the starter's default, if you have not edited them
for (const [slot, partial] of Object.entries(mod.replaces ?? {})) {
    const p = join(theme, 'partials', `${slot}.hbs`);
    const written = `{{!-- Slot replaced by module "${name}": delete the line below to fall back to the core default. --}}\n{{> "${partial}"}}\n`;
    if (!existsSync(p)) continue;
    const cur = readFileSync(p, 'utf8');
    if (cur === written) { writeFileSync(p, readFileSync(join(ROOT, 'seed', 'partials', `${slot}.hbs`))); report.restored.push(`partials/${slot}.hbs`); }
    else if (cur.includes(`{{> "${partial}"}}`)) report.warnings.push(`partials/${slot}.hbs was edited and still includes "${partial}": restore it by hand`);
}

// 4. Settings (under the theme's own names)
if (!keepSettings && mod.settings) {
    const p = join(theme, 'package.json');
    const pkg = readJSON(p);
    const stillUsed = new Set(remaining.flatMap((m) => Object.keys(readJSON(join(ROOT, 'modules', m, 'module.json')).settings ?? {}).map((k) => manifest.aliases?.settings?.[k] ?? k)));
    for (const k of Object.keys(mod.settings)) {
        const key = manifest.aliases?.settings?.[k] ?? k;
        if (!stillUsed.has(key) && key in pkg.config.custom) { delete pkg.config.custom[key]; report.unhooked.push(`setting ${key}`); }
    }
    writeJSON(p, pkg);
}

manifest.modules = remaining;
writeJSON(join(theme, MANIFEST), manifest);

const show = (t, l) => l.length && console.log(`${t} (${l.length})\n${l.map((f) => `  ${f}`).join('\n')}`);
console.log(`Removed ${name}`);
show('deleted', report.removed); show('restored to the starter version', report.restored); show('unhooked', [...new Set(report.unhooked)]);
show('kept, edited locally', report.kept); show('warnings', report.warnings);
if (!mod.settings || keepSettings) console.log('settings untouched');
process.exitCode = report.kept.length || report.warnings.length ? 2 : 0;
