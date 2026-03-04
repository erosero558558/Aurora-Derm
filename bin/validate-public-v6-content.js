#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

const requiredFiles = [
    'content/public-v6/assets-manifest.json',
    'content/public-v6/es/navigation.json',
    'content/public-v6/es/home.json',
    'content/public-v6/es/hub.json',
    'content/public-v6/es/service.json',
    'content/public-v6/es/telemedicine.json',
    'content/public-v6/es/legal.json',
    'content/public-v6/en/navigation.json',
    'content/public-v6/en/home.json',
    'content/public-v6/en/hub.json',
    'content/public-v6/en/service.json',
    'content/public-v6/en/telemedicine.json',
    'content/public-v6/en/legal.json',
];

function readJson(relativePath) {
    const full = path.join(ROOT, relativePath);
    const raw = fs.readFileSync(full, 'utf8');
    return JSON.parse(raw);
}

function flattenImageRefs(value, collector) {
    if (!value) return;
    if (typeof value === 'string') {
        if (value.startsWith('/images/')) {
            if (value.includes(',')) {
                value.split(',').forEach((entry) => {
                    const src = entry.trim().split(/\s+/)[0];
                    if (src.startsWith('/images/')) {
                        collector.add(src);
                    }
                });
            } else {
                const src = value.trim().split(/\s+/)[0];
                if (src.startsWith('/images/')) {
                    collector.add(src);
                }
            }
        }
        return;
    }

    if (Array.isArray(value)) {
        value.forEach((item) => flattenImageRefs(item, collector));
        return;
    }

    if (typeof value === 'object') {
        Object.entries(value).forEach(([key, item]) => {
            if (key === 'src' || key === 'image' || key === 'heroImage') {
                flattenImageRefs(item, collector);
            }
            if (key === 'srcset' && typeof item === 'string') {
                item.split(',').forEach((entry) => {
                    const src = entry.trim().split(/\s+/)[0];
                    if (src.startsWith('/images/')) {
                        collector.add(src);
                    }
                });
            }
            flattenImageRefs(item, collector);
        });
    }
}

function existsWebAsset(webPath) {
    const local = path.join(ROOT, webPath.replace(/^\//, ''));
    return fs.existsSync(local);
}

function run() {
    const issues = [];

    for (const file of requiredFiles) {
        if (!fs.existsSync(path.join(ROOT, file))) {
            issues.push({ type: 'missing_file', file });
        }
    }

    if (issues.length) {
        return finalize(issues);
    }

    const manifest = readJson('content/public-v6/assets-manifest.json');
    const assets = Array.isArray(manifest.assets) ? manifest.assets : [];

    if (!assets.length) {
        issues.push({ type: 'empty_assets_manifest' });
    }

    assets.forEach((asset) => {
        if (!asset.id || !asset.src) {
            issues.push({ type: 'asset_schema', asset });
            return;
        }
        if (!existsWebAsset(asset.src)) {
            issues.push({
                type: 'missing_asset_file',
                asset: asset.id,
                src: asset.src,
            });
        }
        if (asset.srcset) {
            asset.srcset.split(',').forEach((entry) => {
                const src = entry.trim().split(/\s+/)[0];
                if (src && src.startsWith('/images/') && !existsWebAsset(src)) {
                    issues.push({
                        type: 'missing_asset_file',
                        asset: asset.id,
                        src,
                    });
                }
            });
        }
    });

    const contentFiles = requiredFiles.filter(
        (file) =>
            file.endsWith('.json') && !file.endsWith('assets-manifest.json')
    );
    const imageRefs = new Set();
    contentFiles.forEach((file) => {
        const json = readJson(file);
        flattenImageRefs(json, imageRefs);

        if (file.endsWith('navigation.json')) {
            if (
                !json.header ||
                !Array.isArray(json.header.links) ||
                json.header.links.length < 4
            ) {
                issues.push({
                    type: 'navigation_schema',
                    file,
                    detail: 'header.links invalid',
                });
            }
        }

        if (file.endsWith('home.json')) {
            if (
                !json.hero ||
                !Array.isArray(json.hero.slides) ||
                json.hero.slides.length < 3
            ) {
                issues.push({
                    type: 'home_schema',
                    file,
                    detail: 'hero.slides must be >= 3',
                });
            }
        }

        if (file.endsWith('hub.json')) {
            if (!Array.isArray(json.sections) || json.sections.length < 3) {
                issues.push({
                    type: 'hub_schema',
                    file,
                    detail: 'sections missing or < 3',
                });
            }
            if (
                !Array.isArray(json.initiatives) ||
                json.initiatives.length < 8
            ) {
                issues.push({
                    type: 'hub_schema',
                    file,
                    detail: 'initiatives must be >= 8',
                });
            }
        }

        if (file.endsWith('service.json')) {
            if (!Array.isArray(json.services) || !json.services.length) {
                issues.push({
                    type: 'service_schema',
                    file,
                    detail: 'services missing',
                });
            }
        }

        if (file.endsWith('legal.json')) {
            if (
                !Array.isArray(json.index) ||
                !json.pages ||
                typeof json.pages !== 'object'
            ) {
                issues.push({
                    type: 'legal_schema',
                    file,
                    detail: 'index/pages missing',
                });
            }
        }
    });

    imageRefs.forEach((src) => {
        if (!existsWebAsset(src)) {
            issues.push({ type: 'missing_referenced_image', src });
        }
    });

    finalize(issues);
}

function finalize(issues) {
    const output = {
        ok: issues.length === 0,
        issues,
    };

    const outDir = path.join(ROOT, 'verification', 'public-v6-audit');
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(
        path.join(outDir, 'content-validation.json'),
        `${JSON.stringify(output, null, 2)}\n`,
        'utf8'
    );

    if (issues.length) {
        console.error(JSON.stringify(output, null, 2));
        process.exit(1);
    }

    console.log(
        JSON.stringify(
            { ok: true, checkedFiles: requiredFiles.length },
            null,
            2
        )
    );
}

run();
