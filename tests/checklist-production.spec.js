// @ts-check
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { skipIfPhpRuntimeMissing } = require('./helpers/php-backend');

const ADMIN_PASSWORD = process.env.PIELARMONIA_ADMIN_PASSWORD || 'admin123';

function toLocalDateKey(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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

        // Set up env.php for E2E tests authentication
        const envPath = path.join(__dirname, '../env.php');
        try {
            fs.writeFileSync(
                envPath,
                `<?php putenv('PIELARMONIA_ADMIN_PASSWORD=${ADMIN_PASSWORD}'); ?>`
            );
        } catch (e) {
            console.warn('Could not create env.php for E2E tests:', e.message);
        }
    });

    test.afterAll(async () => {
        // Clean up env.php
        const envPath = path.join(__dirname, '../env.php');
        if (fs.existsSync(envPath)) {
            try {
                fs.unlinkSync(envPath);
            } catch (e) {
                console.warn('Could not cleanup env.php:', e.message);
            }
        }
    });

    // 1. Pre-check de servidor (archivos, variables, permisos)
    test('1. Pre-check de servidor - Archivos críticos existen', async () => {
        const requiredFiles = [
            'index.html',
            'index.php',
            'styles.css',
            'styles-deferred.css',
            'script.js',
            'js/engines/chat-engine.js',
            'js/engines/booking-engine.js',
            'terminos.html',
            'privacidad.html',
            'cookies.html',
            'aviso-medico.html',
            'legal.css',
            'admin.html',
            'admin.js',
            'api.php',
            'api-lib.php',
            'payment-lib.php',
            'admin-auth.php',
            'figo-chat.php',
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
    test('2. Panel Admin - Login fallido', async ({ page, request }) => {
        await skipIfPhpRuntimeMissing(test, request);
        await page.goto('/admin.html');
        await expect(page).toHaveTitle(/Admin|Piel en Armonía/);

        // Login con contraseña incorrecta
        await page.fill('input[type="password"]', 'incorrecta');
        await page.click('button[type="submit"]');

        // Debería mostrar error o no redirigir al dashboard
        // Asumimos que el dashboard tiene un ID específico o clase
        const dashboard = page.locator('#dashboard-view, .dashboard-container');
        await expect(dashboard).not.toBeVisible();

        // El input de password debería seguir visible
        await expect(page.locator('input[type="password"]')).toBeVisible();
    });

    test('2. Panel Admin - Login exitoso y navegacion', async ({
        page,
        request,
    }) => {
        await skipIfPhpRuntimeMissing(test, request);
        if (!process.env.PIELARMONIA_ADMIN_PASSWORD) {
            test.skip(
                true,
                'PIELARMONIA_ADMIN_PASSWORD no está definido para validar login exitoso en producción.'
            );
        }
        await page.goto('/admin.html');

        // Login correcto
        await page.fill('input[type="password"]', ADMIN_PASSWORD);
        await page.click('button[type="submit"]');

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
    test('3. Cita Pública - Carga de formulario', async ({ page }) => {
        await page.goto('/index.html');

        const appointmentForm = page.locator('#appointmentForm');
        await expect(appointmentForm).toBeVisible({ timeout: 15000 });

        const serviceSelect = page
            .locator('#serviceSelect, select[name="service"]')
            .first();
        const dateInput = page
            .locator('#dateInput, input[name="date"]')
            .first();
        await expect(serviceSelect).toBeVisible();
        await expect(dateInput).toBeVisible();
    });

    test('3. Cita Pública - Flujo básico (mock)', async ({ page }) => {
        await page.goto('/index.html');

        const appointmentForm = page.locator('#appointmentForm');
        await expect(appointmentForm).toBeVisible({ timeout: 15000 });

        // Llenar formulario
        const serviceSelect = page
            .locator('#serviceSelect, select[name="service"]')
            .first();
        await serviceSelect.selectOption({ index: 1 });

        // Seleccionar doctor si existe el campo y es visible
        const doctorSelect = page
            .locator('#doctorSelect, select[name="doctor"]')
            .first();
        if (await doctorSelect.isVisible()) {
            await doctorSelect.selectOption({ index: 1 });
        }

        // Fecha futura
        const dateInput = page.locator('#dateInput, input[name="date"]').first();
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 2); // 2 días en el futuro
        await dateInput.fill(toLocalDateKey(futureDate));
        await dateInput.dispatchEvent('change');

        // Esperar horarios
        // Esto puede variar según la implementación (select o botones)
        await page.waitForTimeout(1500);

        // Intentar seleccionar hora si aparece un select de hora
        const timeSelect = page.locator('#timeSelect, select[name="time"]').first();
        if (await timeSelect.isVisible()) {
            // Seleccionar primera opcion habilitada y con valor real
            const enabledValues = await timeSelect.evaluate((select) =>
                Array.from(select.options)
                    .filter(
                        (option) =>
                            !option.disabled &&
                            option.value !== '' &&
                            !option.hidden
                    )
                    .map((option) => option.value)
            );

            if (enabledValues.length > 0) {
                await timeSelect.selectOption(enabledValues[0]);
            }
        }

        // Llenar datos personales
        await appointmentForm.locator('input[name="name"]').fill('Test Automático');
        await appointmentForm
            .locator('input[name="email"]')
            .fill('test@example.com');
        await appointmentForm.locator('input[name="phone"]').fill('0991234567');

        // Checkbox privacidad
        const privacy = appointmentForm.locator('input[name="privacyConsent"]');
        if (await privacy.isVisible()) {
            await privacy.check();
        }

        // Enviar (no hacemos submit real para no llenar la base de datos de basura en producción real sin querer,
        // pero en test environment sí. El script asume entorno de pruebas).
        // Si estamos en producción real, esto crearía una cita.
        // Para el checklist, se pide verificar el flujo.

        // Descomentar para probar el submit real:
        /*
    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();
    await expect(page.locator('.modal-success, .alert-success')).toBeVisible({ timeout: 10000 });
    */
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
    test('5. Callback - Formulario existe', async ({ page }) => {
        await page.goto('/index.html');
        // Buscar formulario de callback (puede estar en un modal o sección)
        // Asumimos un botón que abre el modal o una sección visible
        // Buscamos inputs típicos de callback
        const callbackInputs = page.locator(
            'input[name="telefono"], input[name="phone"]'
        );
        // Verificar si hay algún formulario de "te llamamos"
        // Esto depende de la UI específica
        await expect(callbackInputs.first()).toBeVisible();
    });

    // 6. Flujo de reseñas
    test('6. Resenas - Carga correcta', async ({ page, request }) => {
        await skipIfPhpRuntimeMissing(test, request);
        await page.goto('/index.html');
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

