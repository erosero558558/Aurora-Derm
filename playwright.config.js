// @ts-check
const { defineConfig } = require('@playwright/test');
const { spawnSync } = require('node:child_process');

/**
 * URL base para los tests. Opciones:
 *   - Variable de entorno: TEST_BASE_URL=https://pielarmonia.com npx playwright test
 *   - Servidor local automatico (PHP si existe, fallback Python)
 */
const baseURL = process.env.TEST_BASE_URL || 'http://localhost:8000';
const shouldStartLocalServer = !process.env.TEST_BASE_URL;
const localServerPreference = (
    process.env.TEST_LOCAL_SERVER || ''
).toLowerCase();

function hasPhpRuntime() {
    const probe = spawnSync('php', ['-v'], { stdio: 'ignore' });
    return !probe.error && probe.status === 0;
}

const usePhpServer =
    localServerPreference === 'php' ||
    (localServerPreference !== 'python' && hasPhpRuntime());

const localServerCommand = usePhpServer
    ? 'php -S 127.0.0.1:8000 -t .'
    : 'python -m http.server 8000 --bind 127.0.0.1';

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
              port: 8000,
              reuseExistingServer: true,
              timeout: 15000,
              env: {
                  PIELARMONIA_ADMIN_PASSWORD:
                      process.env.PIELARMONIA_ADMIN_PASSWORD || 'admin123',
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
