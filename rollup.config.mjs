import resolve from '@rollup/plugin-node-resolve';
import strip from '@rollup/plugin-strip';
import terser from '@rollup/plugin-terser';

const stripDebugFromBundles =
    String(process.env.ROLLUP_STRIP_DEBUG || 'true').toLowerCase() !== 'false';

const minify = terser({
    compress: {
        passes: 2,
        drop_debugger: stripDebugFromBundles,
        // Preserve warn/error by default; strip noisy debug calls from production bundles.
        pure_funcs: stripDebugFromBundles
            ? ['console.log', 'console.debug', 'console.info']
            : [],
    },
    mangle: true,
    format: { comments: false },
});
const stripDebug = strip({
    include: ['**/*.js', '**/*.mjs'],
    exclude: ['**/node_modules/**'],
    functions: stripDebugFromBundles
        ? ['console.log', 'console.debug', 'console.info', 'console.trace']
        : [],
    debugger: stripDebugFromBundles,
    sourceMap: false,
});
const productionPlugins = stripDebugFromBundles
    ? [resolve(), stripDebug, minify]
    : [resolve(), minify];

export default [
    // Admin App (code-split: appointments y availability se cargan bajo demanda)
    {
        input: 'src/apps/admin/index.js',
        output: {
            dir: '.',
            entryFileNames: 'admin.js',
            chunkFileNames: 'js/admin-chunks/[name]-[hash].js',
            format: 'es',
            sourcemap: false,
        },
        plugins: productionPlugins,
    },
    // Booking UI
    {
        input: 'src/apps/booking/ui-entry.js',
        output: {
            file: 'js/engines/booking-ui.js',
            format: 'es',
            sourcemap: false,
        },
        plugins: productionPlugins,
        // Removed external: ['booking-calendar-lazy'] to bundle it inline
    },
    // Booking Engine
    {
        input: 'src/apps/booking/engine.js',
        output: {
            file: 'js/engines/booking-engine.js',
            format: 'es',
            sourcemap: false,
        },
        plugins: productionPlugins,
    },
    // Booking Calendar
    {
        input: 'src/apps/booking/components/calendar.js',
        output: {
            file: 'js/booking-calendar.js',
            format: 'es',
            sourcemap: false,
        },
        plugins: productionPlugins,
    },
    // Chat UI Engine
    {
        input: 'src/apps/chat/ui-engine.js',
        output: {
            file: 'js/engines/chat-ui-engine.js',
            format: 'iife',
            sourcemap: false,
        },
        plugins: productionPlugins,
    },
    // Chat Widget Engine
    {
        input: 'src/apps/chat/widget-engine.js',
        output: {
            file: 'js/engines/chat-widget-engine.js',
            format: 'iife',
            sourcemap: false,
        },
        plugins: productionPlugins,
    },
    // Chat Booking Engine
    {
        input: 'src/apps/chat/booking-engine.js',
        output: {
            file: 'js/engines/chat-booking-engine.js',
            format: 'iife',
            sourcemap: false,
        },
        plugins: productionPlugins,
    },
    // Figo Chat Engine
    {
        input: 'src/apps/chat/engine.js',
        output: {
            file: 'js/engines/chat-engine.js',
            format: 'iife',
            sourcemap: false,
        },
        plugins: productionPlugins,
    },
    // Analytics Engine
    {
        input: 'src/apps/analytics/engine.js',
        output: {
            file: 'js/engines/analytics-engine.js',
            format: 'iife',
            sourcemap: false,
        },
        plugins: productionPlugins,
    },
    // Booking Utils Bundle
    {
        input: 'src/bundles/booking-utils.js',
        output: {
            file: 'js/engines/booking-utils.js',
            format: 'iife',
            sourcemap: false,
        },
        plugins: productionPlugins,
    },
    // Data Bundle
    {
        input: 'src/bundles/data.js',
        output: {
            file: 'js/engines/data-bundle.js',
            format: 'iife',
            sourcemap: false,
        },
        plugins: productionPlugins,
    },
    // UI Bundle
    {
        input: 'src/bundles/ui.js',
        output: {
            file: 'js/engines/ui-bundle.js',
            format: 'iife',
            sourcemap: false,
        },
        plugins: productionPlugins,
    },
    // Engagement Bundle
    {
        input: 'src/bundles/engagement.js',
        output: {
            file: 'js/engines/engagement-bundle.js',
            format: 'iife',
            sourcemap: false,
        },
        plugins: productionPlugins,
    },
    // Engagement Forms Bundle
    {
        input: 'src/bundles/engagement-forms.js',
        output: {
            file: 'js/engines/engagement-forms-bundle.js',
            format: 'iife',
            sourcemap: false,
        },
        plugins: productionPlugins,
    },
    // Main Script (ES module for code splitting; requires type="module" in HTML)
    {
        input: 'js/main.js',
        output: {
            dir: '.',
            entryFileNames: 'script.js',
            chunkFileNames: 'js/chunks/[name]-[hash].js',
            format: 'es',
            sourcemap: false,
            banner: '/* GENERATED FILE - DO NOT EDIT DIRECTLY - Edit source in js/main.js and run npm run build */',
        },
        plugins: productionPlugins,
    },
];
