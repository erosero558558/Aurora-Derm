// @ts-check
const { defineConfig } = require('@playwright/test');
const { spawnSync } = require('node:child_process');

function parsePortEnv(value, fallback) {
    const parsed = Number.parseInt(String(value || '').trim(), 10);
    return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535
        ? parsed
        : fallback;
}

function readBooleanEnv(name, fallback = false) {
    const normalized = String(process.env[name] || '')
        .trim()
        .toLowerCase();
    if (!normalized) {
        return fallback;
    }
    return ['1', 'true', 'yes', 'on'].includes(normalized);
}

/**
 * URL base para los tests. Opciones:
 *   - Variable de entorno: TEST_BASE_URL=https://pielarmonia.com npx playwright test
 *   - Servidor local automatico fresco en TEST_LOCAL_SERVER_PORT (8011 por defecto)
 *   - Reuse de servidor existente solo con TEST_REUSE_EXISTING_SERVER=1
 */
const localServerPort = parsePortEnv(process.env.TEST_LOCAL_SERVER_PORT, 8011);
const baseURL =
    process.env.TEST_BASE_URL || `http://127.0.0.1:${localServerPort}`;
const shouldStartLocalServer = !process.env.TEST_BASE_URL;
const localServerPreference = (
    process.env.TEST_LOCAL_SERVER || ''
).toLowerCase();
const reuseExistingServer = readBooleanEnv(
    'TEST_REUSE_EXISTING_SERVER',
    !readBooleanEnv('CI', false)
);

function hasPhpRuntime() {
    const probe = spawnSync('php', ['-v'], { stdio: 'ignore' });
    return !probe.error && probe.status === 0;
}

const usePhpServer =
    localServerPreference === 'php' ||
    (localServerPreference !== 'python' && hasPhpRuntime());

const localServerCommand = usePhpServer
    ? `php -S 127.0.0.1:${localServerPort} -t .`
    : `python -m http.server ${localServerPort} --bind 127.0.0.1`;

module.exports = defineConfig({
    testDir: './tests',
    timeout: 30000,
    retries: 0,
    use: {
        baseURL,
        headless: true,
        screenshot: 'only-on-failure',
        serviceWorkers: 'block',
    },
    webServer: shouldStartLocalServer
        ? {
              command: localServerCommand,
              port: localServerPort,
              reuseExistingServer,
              timeout: 15000,
              env: {
                  ...process.env,
              },
          }
        : undefined,
    projects: [
        {
            name: 'chromium',
            use: { browserName: 'chromium' },
        },
    ],
});
