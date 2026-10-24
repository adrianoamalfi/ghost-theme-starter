import js from '@eslint/js';
import globals from 'globals';

export default [
    { ignores: ['node_modules/**', 'dist/**', 'assets/built/**', 'docs/**'] },
    js.configs.recommended,
    {
        // Browser runtime: theme and module scripts
        files: ['assets/js/**/*.js'],
        languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: globals.browser },
    },
    {
        // Node: build and check scripts, ESM configs
        files: ['scripts/**/*.mjs', '**/*.mjs'],
        languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: globals.node },
    },
    {
        // Scripts that drive a browser (page.evaluate runs in the page): Node plus browser globals
        files: [
            'scripts/screenshots.mjs',
            'scripts/check-rendered.mjs',
            'scripts/static-demo.mjs',
            'scripts/check-tables.mjs',
        ],
        languageOptions: { globals: { ...globals.node, ...globals.browser } },
    },
    {
        files: ['**/*.cjs'],
        languageOptions: { sourceType: 'commonjs', globals: globals.node },
    },
    {
        // Tests (explicit imports from vitest, run under Node)
        files: ['test/**/*.js', 'test/**/*.mjs'],
        languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: globals.node },
    },
];
