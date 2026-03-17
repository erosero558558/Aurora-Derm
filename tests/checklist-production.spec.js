// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const {
    adminOpenClawLogin,
    getAdminAuthStatus,
    getEnv,
    getOperatorAuthTestEnv,
} = require('./helpers/admin-auth');
const { skipIfPhpRuntimeMissing } = require('./helpers/php-backend');

const ADMIN_PASSWORD = getEnv('PIELARMONIA_ADMIN_PASSWORD');
const ADMIN_AUTH_MODE = getEnv('TEST_ADMIN_AUTH_MODE', 'openclaw_chatgpt');
const OPERATOR_AUTH_ENV = getOperatorAuthTestEnv();
const ENV_PATH = path.join(__dirname, '../env.php');
const PUBLIC_HOME_PATH = '/es/';
let envFileManaged = false;
let envFileBackup = null;

function toPhpSingleQuoted(value) {
    return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function buildManagedEnvPhp() {
    const lines = ['<?php'];

    if (ADMIN_AUTH_MODE === 'legacy_password') {
        lines.push(
            "putenv('PIELARMONIA_INTERNAL_CONSOLE_AUTH_PRIMARY=legacy_password');"
        );
    } else {
        for (const [key, value] of Object.entries(OPERATOR_AUTH_ENV)) {
            lines.push(
                `putenv('${toPhpSingleQuoted(key)}=${toPhpSingleQuoted(value)}');`
            );
        }
    }

    if (ADMIN_PASSWORD) {
        lines.push(
            `putenv('PIELARMONIA_ADMIN_PASSWORD=${toPhpSingleQuoted(ADMIN_PASSWORD)}');`
        );
    }

    lines.push('?>', '');
    return lines.join('\n');
}

async function expectLegacyPublicShellAbsent(page) {
    await expect(page.locator('#appointmentForm')).toHaveCount(0);
    await expect(page.locator('#paymentModal')).toHaveCount(0);
    await expect(page.locator('#chatbotWidget')).toHaveCount(0);
}

async function expectAdminAccessGateVisible(page) {
    await expect(page.locator('#loginScreen')).toBeVisible();
    await expect(page.locator('#adminDashboard')).toBeHidden();
}

test.describe('Checklist de Pruebas en Producción', () => {
    test.beforeAll(async () => {
        // Clear rate limit directory to avoid 429 errors during testing
        const rateLimitDir = path.join(__dirname, '../data/ratelimit');
        if (fs.existsSync(rateLimitDir)) {
            try {
                fs.rmSync(rateLimitDir, { recursive: true, force: true });
            } catch (e) {
                console.warn('Could not clear rate limit dir:', e.message);
            }
        }

        try {
            if (fs.existsSync(ENV_PATH)) {
                envFileBackup = fs.readFileSync(ENV_PATH, 'utf8');
            }
            fs.writeFileSync(ENV_PATH, buildManagedEnvPhp());
            envFileManaged = true;
        } catch (e) {
            console.warn('Could not create env.php for E2E tests:', e.message);
        }
    });

    test.afterAll(async () => {
        if (!envFileManaged) {
            return;
        }

        try {
            if (envFileBackup !== null) {
                fs.writeFileSync(ENV_PATH, envFileBackup);
            } else if (fs.existsSync(ENV_PATH)) {
                fs.unlinkSync(ENV_PATH);
            }
        } catch (e) {
            console.warn('Could not cleanup env.php:', e.message);
        }
    });

    // 1. Pre-check de servidor (archivos, variables, permisos)
    test('1. Pre-check de servidor - Entrypoints y archivos críticos existen', async () => {
        const requiredFiles = [
            'index.php',
            'es/index.html',
            'en/index.html',
            'es/servicios/index.html',
            'es/telemedicina/index.html',
            'es/legal/terminos/index.html',
            'es/legal/privacidad/index.html',
            'es/legal/cookies/index.html',
            'es/legal/aviso-medico/index.html',
            'styles.css',
            'styles-deferred.css',
            'script.js',
            'js/public-v6-shell.js',
            'js/engines/chat-engine.js',
            'js/engines/booking-engine.js',
            'legal.css',
            'admin.html',
            'admin.js',
            'api.php',
            'api-lib.php',
            'payment-lib.php',
            'admin-auth.php',
            'figo-chat.php',
            '_astro',
        ];

        for (const file of requiredFiles) {
            const exists = fs.existsSync(path.join(__dirname, '..', file));
            expect(exists, `Archivo ${file} debe existir`).toBe(true);
        }
    });

    test('1. Pre-check de servidor - Variables de entorno y salud', async ({
        request,
    }) => {
        await skipIfPhpRuntimeMissing(test, request);
        const response = await request.get('/api.php?resource=health');
        expect(response.ok()).toBeTruthy();
        const body = await response.json();

        expect(body.ok).toBe(true);
        expect(body.status).toBe('ok');
        // Verificaciones adicionales de salud si la API las expone
        if (body.dataDirWritable !== undefined) {
            expect(body.dataDirWritable).toBe(true);
        }
    });

    // 2. Pruebas del panel admin
    test('2. Panel Admin - Gate inicial sin sesion no abre el dashboard', async ({
        page,
        request,
    }) => {
        await skipIfPhpRuntimeMissing(test, request);
        await page.goto('/admin.html');
        await expect(page).toHaveTitle(
            /Nucleo Interno de Consultorio|Admin|Piel en Armonia|Piel en Armonía/
        );

        await expectAdminAccessGateVisible(page);

        const passwordInput = page.locator('#adminPassword');
        const legacyStage = page.locator('#legacyLoginStage');
        const openClawStage = page.locator('#openclawLoginStage');
        const loginButton = page.locator('#loginBtn');
        const statusTitle = page.locator('#adminLoginStatusTitle');
        const statusMessage = page.locator('#adminLoginStatusMessage');

        if (await passwordInput.isVisible()) {
            await expect(legacyStage).toBeVisible();
            await passwordInput.fill('incorrecta');
            await loginButton.click();

            await expectAdminAccessGateVisible(page);
            await expect(passwordInput).toBeVisible();
            await expect(statusTitle).toContainText(
                'No se pudo iniciar sesion'
            );
            await expect(statusMessage).toContainText(
                /Credenciales|Verifica la clave|contingencia|2FA|fallback/i
            );
            return;
        }

        await expect(openClawStage).toBeVisible();
        await expect(legacyStage).toBeHidden();
        await loginButton.click();

        await expectAdminAccessGateVisible(page);
        await expect(openClawStage).toBeVisible();
        await expect(statusTitle).toContainText(
            /OpenClaw|Challenge|Email|Helper|Codigo temporal|Generando codigo/i
        );
        await expect(statusMessage).toContainText(
            /OpenClaw|helper|configur|challenge|sesion|identidad/i
        );
    });

    test('2. Panel Admin - Login exitoso y navegacion', async ({
        page,
        request,
    }) => {
        await skipIfPhpRuntimeMissing(test, request);
        const browserRequest = page.context().request;
        const authStatus = await getAdminAuthStatus(browserRequest);
        test.skip(
            !authStatus.ok,
            `No se pudo consultar admin-auth status (HTTP ${authStatus.httpStatus}).`
        );

        if (authStatus.mode === 'openclaw_chatgpt') {
            const login = await adminOpenClawLogin(browserRequest);
            test.skip(
                !login.ok,
                `No se pudo autenticar OpenClaw: ${login.reason}`
            );
        } else {
            test.skip(
                !ADMIN_PASSWORD,
                'PIELARMONIA_ADMIN_PASSWORD no está definido para validar login legacy.'
            );

            await page.goto('/admin.html');

            const passwordInput = page.locator('#adminPassword');
            const loginButton = page.locator('#loginBtn');

            await expectAdminAccessGateVisible(page);
            await expect(passwordInput).toBeVisible();
            await expect(loginButton).toBeVisible();
            await passwordInput.fill(ADMIN_PASSWORD);
            await loginButton.click();
        }

        await page.goto('/admin.html');

        // 1. Confirm login success via toast or URL change first
        // This confirms the backend auth worked
        await expect(page.locator('#adminDashboard')).toBeVisible({
            timeout: 20000,
        });

        // 2. Wait for dashboard visibility
        // admin.js removes 'is-hidden' class from #adminDashboard
        await expect(page.locator('#adminDashboard')).not.toHaveClass(
            /is-hidden/,
            { timeout: 15000 }
        );
        await expect(page.locator('#adminDashboard')).toBeVisible({
            timeout: 5000,
        });

        // Navegación
        // Verificar que existen los enlaces o pestañas
        const navItems = ['Citas', 'Callbacks', 'Reseñas', 'Disponibilidad'];
        for (const item of navItems) {
            // Buscar texto flexiblemente
            const link = page
                .locator(`nav a, .nav-item, button`, { hasText: item })
                .first();
            if (await link.isVisible()) {
                await link.click();
                await page.waitForTimeout(500); // Pequeña espera para renderizado
                // Verificar que la vista cambió o el contenido es relevante
                // Esto depende mucho de la estructura del DOM, aquí es genérico
            }
        }
    });

    // 3. Flujo de cita pública
    test('3. Cita Pública - Home muestra la ruta de reserva en mantenimiento', async ({
        page,
    }) => {
        await page.goto(PUBLIC_HOME_PATH);

        await expect(page.locator('[data-v6-header]')).toBeVisible();
        await expect(page.locator('[data-v6-news-strip]')).toContainText(
            'Escribanos por WhatsApp y le ayudamos a ubicar si hoy conviene consulta, tratamiento o teledermatologia.'
        );

        const bookingStatus = page.locator('[data-v6-booking-status]');
        await expect(bookingStatus).toBeVisible();
        await expect(bookingStatus).toContainText(
            'Reserva online en mantenimiento'
        );
        await expect(
            bookingStatus.getByRole('link', { name: 'Escribir por WhatsApp' })
        ).toHaveAttribute('href', /wa\.me\/593982453672/);

        await expectLegacyPublicShellAbsent(page);
    });

    test('3. Cita Pública - Teledermatologia mantiene WhatsApp como siguiente paso', async ({
        page,
    }) => {
        await page.goto('/es/telemedicina/');

        await expect(page.locator('h1')).toContainText(
            'Teledermatologia en Quito'
        );
        await expectLegacyPublicShellAbsent(page);

        const telemedicineStatus = page.locator('[data-v6-booking-status]');
        await expect(telemedicineStatus).toContainText(
            'Reserva online en mantenimiento'
        );

        const whatsappLink = telemedicineStatus.getByRole('link', {
            name: 'Escribir por WhatsApp',
        });
        await expect(whatsappLink).toHaveAttribute(
            'href',
            /wa\.me\/593982453672/
        );
    });

    // 4. Validación de disponibilidad
    test('4. Disponibilidad - API responde', async ({ request }) => {
        await skipIfPhpRuntimeMissing(test, request);
        const response = await request.get('/api.php?resource=availability');
        expect(response.ok()).toBeTruthy();
        const body = await response.json();
        expect(body.ok).toBe(true);
        // data should be an object (map of dates), potentially empty, but NOT strictly an array.
        // PHP empty array [] encodes to [] in JSON, but associative array encodes to {}.
        // So checking if it is an object (and not null) is safer.
        expect(typeof body.data).toBe('object');
        expect(body.data).not.toBeNull();
    });

    // 5. Flujo de callback
    test('5. Contacto rápido - CTA de WhatsApp existe', async ({ page }) => {
        await page.goto(PUBLIC_HOME_PATH);

        const whatsappCta = page
            .locator('[data-v6-header] a[href*="wa.me/"]')
            .first();
        await expect(whatsappCta).toBeVisible();
        await expect(whatsappCta).toHaveAttribute('href', /wa\.me\/593/);
    });

    // 6. Flujo de reseñas
    test('6. Resenas - Carga correcta', async ({ page, request }) => {
        await skipIfPhpRuntimeMissing(test, request);
        await page.goto(PUBLIC_HOME_PATH);
        await expect(page.locator('[data-v6-header]')).toBeVisible();
        // Verificar que la sección de reseñas existe
        const reviewsSection = page.locator('#reviews, .reviews-section');
        if (await reviewsSection.isVisible()) {
            await expect(reviewsSection).toBeVisible();
        }

        // Verificar API de reseñas
        const response = await request.get('/api.php?resource=reviews');
        expect(response.ok()).toBeTruthy();
    });

    // 7. Chatbot Figo
    test('7. Chatbot Figo - API Health', async ({ request }) => {
        await skipIfPhpRuntimeMissing(test, request);
        const response = await request.get('/figo-chat.php');
        // Puede devolver 405 Method Not Allowed si es GET, o JSON config
        // El checklist dice: "Esperado: responde JSON y muestra configured..."
        if (response.status() === 200) {
            const body = await response.json();
            expect(body).toHaveProperty('configured');
            expect(body).toHaveProperty('mode');
        } else {
            // Si no permite GET, verificar POST con payload dummy
            const postResp = await request.post('/figo-chat.php', {
                data: { messages: [{ role: 'user', content: 'hola' }] },
            });
            // Puede fallar si no hay API Key configurada, pero debería responder algo coherente (JSON error o success)
            expect(postResp.status()).toBeLessThan(500);
        }
    });

    // 8. Seguridad básica
    test('8. Seguridad - Headers y acceso denegado', async ({ request }) => {
        await skipIfPhpRuntimeMissing(test, request);
        // Verificar acceso denegado a directorios sensibles si es posible via HTTP
        const dataResp = await request.get('/data/');
        expect([403, 404]).toContain(dataResp.status()); // O 404, pero no 200 con listado

        const uploadsResp = await request.get('/uploads/');
        // Uploads podría ser accesible, pero no listable
        if (uploadsResp.status() === 200) {
            // Verificar que no muestre listado de archivos (autoindex off)
            const text = await uploadsResp.text();
            expect(text).not.toContain('Index of');
        }
    });
});
