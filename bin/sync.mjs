#!/usr/bin/env node
// Usage: node bin/sync.mjs <theme-dir> [--dry-run]
// Brings starter-owned files up to date without clobbering local edits:
//   untouched locally -> overwritten      edited locally -> kept, new copy at <file>.starter-new
import { parseArgs } from 'node:util';
import { rmSync } from 'node:fs';
import { installModuleHooks } from './modules.mjs';
import { ROOT, walk, STARTER_VERSION, MANIFEST, existsSync, join, readFileSync, resolve, sha, sourceFiles, put, loadManifest, writeJSON } from './lib.mjs';

const { values, positionals } = parseArgs({ allowPositionals: true, options: { 'dry-run': { type: 'boolean', default: false } } });
const theme = resolve(process.cwd(), positionals[0] ?? '.');
const dry = values['dry-run'];
const manifest = loadManifest(theme);
const src = sourceFiles(manifest.modules, manifest.aliases);
const report = { newSlots: [], updated: [], added: [], conflicts: [], removed: [], orphaned: [], deletedLocally: [] };

for (const [rel, next] of src) {
    const nextHash = sha(next);
    const dest = join(theme, rel);
    const recorded = manifest.files[rel];

    if (!existsSync(dest)) {
        if (recorded) { report.deletedLocally.push(rel); continue; }
        report.added.push(rel);
        if (!dry) { put(dest, next); manifest.files[rel] = nextHash; }
        continue;
    }
    const cur = sha(readFileSync(dest));
    if (cur === nextHash) { manifest.files[rel] = nextHash; continue; }
    if (cur === recorded) {
        report.updated.push(rel);
        if (!dry) { put(dest, next); manifest.files[rel] = nextHash; }
    } else {
        report.conflicts.push(rel);
        if (!dry) put(dest + '.starter-new', next);
    }
}

// Slots introduced by newer starter versions: create them (never touch existing ones)
for (const rel of walk(join(ROOT, 'seed'))) {
    if (existsSync(join(theme, rel))) continue;
    report.newSlots.push(rel);
    if (!dry) put(join(theme, rel), readFileSync(join(ROOT, 'seed', rel)));
}

// Files the starter no longer ships
for (const rel of Object.keys(manifest.files)) {
    if (src.has(rel)) continue;
    const dest = join(theme, rel);
    if (existsSync(dest) && sha(readFileSync(dest)) === manifest.files[rel]) {
        report.removed.push(rel);
        if (!dry) { rmSync(dest); delete manifest.files[rel]; }
    } else {
        report.orphaned.push(rel);
    }
}

// Re-apply module hooks (idempotent): picks up slots a module newly replaces or composes into
const hookWarnings = [];
if (!dry) for (const m of manifest.modules) hookWarnings.push(...installModuleHooks(theme, m, manifest.aliases).map((w) => `${m}: ${w}`));

if (!dry) writeJSON(join(theme, MANIFEST), { ...manifest, starter: STARTER_VERSION });

const show = (title, list) => list.length && console.log(`${title} (${list.length})\n${list.map((f) => '  ' + f).join('\n')}`);
console.log(`${dry ? '[dry-run] ' : ''}sync ${manifest.starter} -> ${STARTER_VERSION}`);
show('new slots (yours to edit)', report.newSlots); show('updated', report.updated); show('added', report.added); show('removed', report.removed);
show('CONFLICT: edited locally, new version saved as *.starter-new', report.conflicts);
show('deleted locally, left deleted', report.deletedLocally);
show('no longer in starter, kept', report.orphaned);
show('module hooks that need attention', hookWarnings);
if (!Object.values(report).some((l) => l.length)) console.log('already up to date');
process.exitCode = report.conflicts.length ? 2 : 0;
