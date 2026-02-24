import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

export default [
    // Admin App (code-split: appointments y availability se cargan bajo demanda)
    {
        input: 'src/apps/admin/index.js',
        output: {
            dir: '.',
            entryFileNames: 'admin.js',
            chunkFileNames: 'js/admin-chunks/[name]-[hash].js',
            format: 'es',
            sourcemap: false
        },
        plugins: [resolve(), terser()]
    },
    // Booking UI
    {
        input: 'src/apps/booking/ui-entry.js',
        output: {
            file: 'js/engines/booking-ui.js',
            format: 'es',
            sourcemap: false
        },
        plugins: [resolve(), terser()]
        // Removed external: ['booking-calendar-lazy'] to bundle it inline
    },
    // Booking Engine
    {
        input: 'src/apps/booking/engine.js',
        output: {
            file: 'js/engines/booking-engine.js',
            format: 'es',
            sourcemap: false
        },
        plugins: [resolve(), terser()]
    },
    // Booking Calendar
    {
        input: 'src/apps/booking/components/calendar.js',
        output: {
            file: 'js/booking-calendar.js',
            format: 'es',
            sourcemap: false
        },
        plugins: [resolve(), terser()]
    },
    // Chat UI Engine
    {
        input: 'src/apps/chat/ui-engine.js',
        output: {
            file: 'js/engines/chat-ui-engine.js',
            format: 'iife',
            sourcemap: false
        },
        plugins: [resolve(), terser()]
    },
    // Chat Widget Engine
    {
        input: 'src/apps/chat/widget-engine.js',
        output: {
            file: 'js/engines/chat-widget-engine.js',
            format: 'iife',
            sourcemap: false
        },
        plugins: [resolve(), terser()]
    },
    // Chat Booking Engine
    {
        input: 'src/apps/chat/booking-engine.js',
        output: {
            file: 'js/engines/chat-booking-engine.js',
            format: 'iife',
            sourcemap: false
        },
        plugins: [resolve(), terser()]
    },
    // Figo Chat Engine
    {
        input: 'src/apps/chat/engine.js',
        output: {
            file: 'js/engines/chat-engine.js',
            format: 'iife',
            sourcemap: false
        },
        plugins: [resolve(), terser()]
    },
    // Analytics Engine
    {
        input: 'src/apps/analytics/engine.js',
        output: {
            file: 'js/engines/analytics-engine.js',
            format: 'iife',
            sourcemap: false
        },
        plugins: [resolve(), terser()]
    },
    // Booking Utils Bundle
    {
        input: 'src/bundles/booking-utils.js',
        output: {
            file: 'js/engines/booking-utils.js',
            format: 'iife',
            sourcemap: false
        },
        plugins: [resolve(), terser()]
    },
    // Data Bundle
    {
        input: 'src/bundles/data.js',
        output: {
            file: 'js/engines/data-bundle.js',
            format: 'iife',
            sourcemap: false
        },
        plugins: [resolve(), terser()]
    },
    // UI Bundle
    {
        input: 'src/bundles/ui.js',
        output: {
            file: 'js/engines/ui-bundle.js',
            format: 'iife',
            sourcemap: false
        },
        plugins: [resolve(), terser()]
    },
    // Engagement Bundle
    {
        input: 'src/bundles/engagement.js',
        output: {
            file: 'js/engines/engagement-bundle.js',
            format: 'iife',
            sourcemap: false
        },
        plugins: [resolve(), terser()]
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
        plugins: [resolve(), terser()],
    },
];
