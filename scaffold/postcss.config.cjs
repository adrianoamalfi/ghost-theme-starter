module.exports = {
    plugins: [
        require('postcss-import'),
        // calc: false, because postcss-calc cannot parse the channel keywords (l, c, h)
        // of CSS relative colours such as oklch(from var(--accent) calc(l * .8) c h).
        require('cssnano')({ preset: ['default', { calc: false }] }),
    ],
};
