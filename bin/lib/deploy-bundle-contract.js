'use strict';

const {
    GENERATED_PUBLIC_ENTRIES,
    GENERATED_RUNTIME_DIRECTORIES,
    GENERATED_RUNTIME_FILES,
} = require('./generated-site-root.js');

const DEPLOY_STAGE_DIRECTORIES = [...GENERATED_PUBLIC_ENTRIES, ...GENERATED_RUNTIME_DIRECTORIES];
const DEPLOY_STAGE_FILES = [...GENERATED_RUNTIME_FILES];

const DEPLOY_AUTHORED_FILES = [
    '.htaccess',
    'index.php',
    'styles.css',
    'styles-deferred.css',
    'sw.js',
    'manifest.json',
    'js/public-v6-shell.js',
    'js/admin-preboot-shortcuts.js',
    'js/admin-runtime.js',
    'js/monitoring-loader.js',
    'admin.html',
    'admin-v3.css',
    'queue-ops.css',
    'operador-turnos.html',
    'kiosco-turnos.html',
    'sala-turnos.html',
    'queue-kiosk.css',
    'queue-display.css',
    'admin-auth.php',
    'api.php',
    'api-lib.php',
    'payment-lib.php',
    'figo-chat.php',
    'figo-backend.php',
    'content/index.json',
    'content/es.json',
    'content/en.json',
    'terminos.html',
    'privacidad.html',
    'cookies.html',
    'aviso-medico.html',
    'telemedicina.html',
    'legal.css',
    'favicon.ico',
    'hero-woman.jpg',
    'images/icon-192.png',
    'images/icon-512.png',
    'robots.txt',
    'sitemap.xml',
    'nginx-pielarmonia.conf',
];

const DEPLOY_AUTHORED_DIRECTORIES = [
    'fonts',
    'images/optimized',
    'app-downloads',
    'desktop-updates',
    'servicios',
];

const DEPLOY_TOOLING_FILES = [
    'SMOKE-PRODUCCION.ps1',
    'VERIFICAR-DESPLIEGUE.ps1',
    'BENCH-API-PRODUCCION.ps1',
    'GATE-POSTDEPLOY.ps1',
    'CONFIGURAR-TELEGRAM-WEBHOOK.ps1',
    'docs/DEPLOYMENT.md',
    'docs/DEPLOY_HOSTING_PLAYBOOK.md',
    'docs/PRODUCTION_TEST_CHECKLIST.md',
];

const DEPLOY_TOOLING_DIRECTORIES = [
    'bin/powershell',
    'scripts/ops/prod',
    'scripts/ops/setup',
];

function buildDeployBundleManifest(options = {}) {
    const includeTooling = Boolean(options.includeTooling);
    const entries = [
        ...DEPLOY_STAGE_FILES.map((relativePath) => ({
            source: 'stage',
            type: 'file',
            relativePath,
        })),
        ...DEPLOY_STAGE_DIRECTORIES.map((relativePath) => ({
            source: 'stage',
            type: 'directory',
            relativePath,
        })),
        ...DEPLOY_AUTHORED_FILES.map((relativePath) => ({
            source: 'repo',
            type: 'file',
            relativePath,
        })),
        ...DEPLOY_AUTHORED_DIRECTORIES.map((relativePath) => ({
            source: 'repo',
            type: 'directory',
            relativePath,
        })),
    ];

    if (includeTooling) {
        entries.push(
            ...DEPLOY_TOOLING_FILES.map((relativePath) => ({
                source: 'repo',
                type: 'file',
                relativePath,
            })),
            ...DEPLOY_TOOLING_DIRECTORIES.map((relativePath) => ({
                source: 'repo',
                type: 'directory',
                relativePath,
            }))
        );
    }

    return entries;
}

module.exports = {
    DEPLOY_AUTHORED_DIRECTORIES,
    DEPLOY_AUTHORED_FILES,
    DEPLOY_STAGE_DIRECTORIES,
    DEPLOY_STAGE_FILES,
    DEPLOY_TOOLING_DIRECTORIES,
    DEPLOY_TOOLING_FILES,
    buildDeployBundleManifest,
};
