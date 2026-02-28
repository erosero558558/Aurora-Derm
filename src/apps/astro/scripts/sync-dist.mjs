import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const astroRoot = path.resolve(scriptDir, '..');
const distRoot = path.resolve(astroRoot, 'dist');
const repoRoot = path.resolve(astroRoot, '..', '..', '..');

const syncEntries = ['es', 'en', '_astro'];

function copyDirectory(sourceDir, targetDir) {
    if (!fs.existsSync(sourceDir)) {
        return;
    }
    fs.rmSync(targetDir, { recursive: true, force: true });
    fs.cpSync(sourceDir, targetDir, { recursive: true, force: true });
}

function run() {
    if (!fs.existsSync(distRoot)) {
        throw new Error(`Astro dist no encontrado: ${distRoot}`);
    }

    for (const entry of syncEntries) {
        const source = path.join(distRoot, entry);
        const target = path.join(repoRoot, entry);
        copyDirectory(source, target);
    }

    console.log('Astro dist sincronizado en /es, /en y /_astro');
}

run();
