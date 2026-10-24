// Zips only what Ghost needs. Whitelist, so dev files can never leak into a release.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync } from 'node:fs';

const slug = JSON.parse(readFileSync('package.json', 'utf8')).name;
const out = `dist/${slug}.zip`;
const include = [
    'partials',
    'locales',
    'assets/built',
    'assets/fonts',
    'assets/images',
    'package.json',
    'routes.example.yaml',
    'LICENSE',
    'robots.txt',
];
// zip does not expand `*.hbs` at the top level on its own, so list the templates here; skip paths that do not exist
const templates = readdirSync('.').filter((f) => f.endsWith('.hbs'));
const exclude = ['*.map', '*.starter-new', '.DS_Store', '*/.DS_Store'];

mkdirSync('dist', { recursive: true });
rmSync(out, { force: true });
execFileSync('zip', ['-r', out, ...templates, ...include.filter((p) => existsSync(p)), '-x', ...exclude], {
    stdio: 'inherit',
});
console.log(`\n${out}`);
