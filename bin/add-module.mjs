#!/usr/bin/env node
// Usage: node bin/add-module.mjs <theme-dir> <module>
import { variantFiles, applyAliases, missingRequires, ROOT, MANIFEST, existsSync, join, readFileSync, writeFileSync, resolve, sha, put, loadManifest, walk, writeJSON } from './lib.mjs';
import { installModuleHooks } from './modules.mjs';

const [dir, name] = process.argv.slice(2);
if (!dir || !name) { console.error('Usage: add-module <theme-dir> <module>'); process.exit(1); }
const theme = resolve(process.cwd(), dir);
const manifest = loadManifest(theme);
const modDir = join(ROOT, 'modules', name);
if (!existsSync(join(modDir, 'module.json'))) { console.error(`Unknown module "${name}"`); process.exit(1); }
if (manifest.modules.includes(name)) { console.error(`${name} already installed`); process.exit(1); }

const reqs = missingRequires([...manifest.modules, name]);
if (reqs.length) { console.error(`Missing module dependencies: ${reqs.join('; ')}`); process.exit(1); }

const variants = variantFiles(modDir, [...manifest.modules, name]);
const files = walk(modDir).filter((f) => f !== 'module.json' && !f.startsWith('variants/'));
const isLocale = (f) => /^locales\/[^/]+\.json$/.test(f);

// A module may override a core file (e.g. home.hbs), but only an UNTOUCHED one: its hash must still match the manifest.
for (const f of files.filter((f) => !isLocale(f))) {
    const dest = join(theme, f);
    if (existsSync(dest) && !(manifest.files[f] && sha(readFileSync(dest)) === manifest.files[f])) {
        console.error(`Refusing to overwrite ${f} (edited locally or not starter-owned). Move it aside and retry.`);
        process.exit(2);
    }
}
for (const f of files.filter((f) => !isLocale(f))) {
    let data = readFileSync(join(modDir, variants.get(f) ?? f));
    if (manifest.aliases && f.endsWith('.hbs')) data = Buffer.from(applyAliases(data.toString('utf8'), manifest.aliases));
    put(join(theme, f), data);
    manifest.files[f] = sha(data);
}

// Locales: add the module's keys. If the file is untouched, stay in sync-managed state;
// if it was edited locally, add the keys but leave the recorded hash so sync flags it.
for (const f of files.filter(isLocale)) {
    const dest = join(theme, f);
    if (!existsSync(dest)) { put(dest, readFileSync(join(modDir, f))); manifest.files[f] = sha(readFileSync(dest)); continue; }
    const before = readFileSync(dest);
    const keys = JSON.parse(before);
    for (const [k, v] of Object.entries(JSON.parse(readFileSync(join(modDir, f))))) if (!(k in keys)) keys[k] = v;
    const merged = Buffer.from(JSON.stringify(keys, null, 2) + '\n');
    writeFileSync(dest, merged);
    if (sha(before) === manifest.files[f]) manifest.files[f] = sha(merged);
}

const warnings = installModuleHooks(theme, name, manifest.aliases);
manifest.modules.push(name);
writeJSON(join(theme, MANIFEST), manifest);
console.log(`Installed ${name}`);
for (const w of warnings) console.warn(`  warning: ${w}`);
