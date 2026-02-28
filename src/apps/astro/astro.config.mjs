import { defineConfig } from 'astro/config';

export default defineConfig({
    output: 'static',
    scopedStyleStrategy: 'class',
    outDir: './dist',
    build: {
        format: 'directory',
    },
});
