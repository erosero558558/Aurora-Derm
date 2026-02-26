const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.describe('State Management Unit Tests', () => {
    // We serve the state.js file locally to allow clean imports
    test.beforeEach(async ({ page }) => {
        await page.route('**/js/state.js', async (route) => {
            const filePath = path.resolve(__dirname, '../../js/state.js');
            const content = fs.readFileSync(filePath, 'utf8');
            await route.fulfill({
                status: 200,
                contentType: 'application/javascript',
                body: content
            });
        });
    });

    /**
     * Helper to load the state module into the page context.
     * Optionally sets up initial localStorage or other mocks before loading.
     */
    async function loadStateModule(page, setupFn = null) {
        // Mock a blank page to ensure we have a valid origin for module imports
        await page.route('**/test-blank', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'text/html',
                body: '<html><body></body></html>'
            });
        });

        await page.goto('/test-blank');

        if (setupFn) {
            await page.evaluate(setupFn);
        }

        // Inject a script that imports the module and exposes it globally
        await page.addScriptTag({
            type: 'module',
            content: `
                import * as State from '/js/state.js';
                window.PielState = State;
            `
        });

        // Wait for the module to be available
        await page.waitForFunction(() => window.PielState);
    }

    test('initializes with default language (Spanish) when no saved pref', async ({ page }) => {
        // Mock navigator.language to something generic that doesn't start with 'en'
        await loadStateModule(page, () => {
            Object.defineProperty(navigator, 'language', {
                value: 'fr-FR',
                configurable: true
            });
            localStorage.clear();
        });

        const currentLang = await page.evaluate(() => window.PielState.getCurrentLang());
        expect(currentLang).toBe('es');
    });

    test('initializes with English if browser language is English', async ({ page }) => {
        await loadStateModule(page, () => {
            Object.defineProperty(navigator, 'language', {
                value: 'en-US',
                configurable: true
            });
            localStorage.clear();
        });

        const currentLang = await page.evaluate(() => window.PielState.getCurrentLang());
        expect(currentLang).toBe('en');
    });

    test('respects saved language preference over browser language', async ({ page }) => {
        await loadStateModule(page, () => {
            Object.defineProperty(navigator, 'language', {
                value: 'en-US',
                configurable: true
            });
            localStorage.setItem('language', 'es');
        });

        const currentLang = await page.evaluate(() => window.PielState.getCurrentLang());
        expect(currentLang).toBe('es');
    });

    test('initializes theme mode correctly', async ({ page }) => {
        await loadStateModule(page, () => {
            localStorage.setItem('themeMode', 'dark');
        });

        const theme = await page.evaluate(() => window.PielState.getCurrentThemeMode());
        expect(theme).toBe('dark');
    });

    test('defaults theme mode to system if not saved', async ({ page }) => {
        await loadStateModule(page, () => {
            localStorage.removeItem('themeMode');
        });

        const theme = await page.evaluate(() => window.PielState.getCurrentThemeMode());
        expect(theme).toBe('system');
    });

    test('can update current language', async ({ page }) => {
        await loadStateModule(page);
        await page.evaluate(() => window.PielState.setCurrentLang('en'));
        const lang = await page.evaluate(() => window.PielState.getCurrentLang());
        expect(lang).toBe('en');
    });

    test('can update current appointment', async ({ page }) => {
        await loadStateModule(page);
        const appointment = { service: 'Botox', doctor: 'Dr. Smith' };
        await page.evaluate((appt) => window.PielState.setCurrentAppointment(appt), appointment);

        const retrieved = await page.evaluate(() => window.PielState.getCurrentAppointment());
        expect(retrieved).toEqual(appointment);
    });

    test('can update checkout session state', async ({ page }) => {
        await loadStateModule(page);
        await page.evaluate(() => window.PielState.setCheckoutSessionActive(true));

        const session = await page.evaluate(() => window.PielState.getCheckoutSession());
        expect(session.active).toBe(true);

        const newSession = { active: false, completed: true, id: '123' };
        await page.evaluate((s) => window.PielState.setCheckoutSession(s), newSession);

        const updated = await page.evaluate(() => window.PielState.getCheckoutSession());
        expect(updated).toEqual(newSession);
    });

    test('state proxy reflects changes via accessors', async ({ page }) => {
        await loadStateModule(page);

        // Set via function, read via proxy
        await page.evaluate(() => window.PielState.setCurrentLang('fr'));
        const proxyValue = await page.evaluate(() => window.PielState.state.currentLang);
        expect(proxyValue).toBe('fr');
    });

    test('state proxy updates via assignment', async ({ page }) => {
        await loadStateModule(page);

        // Set via proxy, read via function
        await page.evaluate(() => { window.PielState.state.currentLang = 'de'; });
        const fnValue = await page.evaluate(() => window.PielState.getCurrentLang());
        expect(fnValue).toBe('de');
    });

    test('chat history persists to localStorage', async ({ page }) => {
        await loadStateModule(page);
        const history = [{ role: 'user', content: 'hello', time: new Date().toISOString() }];

        await page.evaluate((h) => window.PielState.setChatHistory(h), history);

        // Verify localStorage directly
        const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('chatHistory')));
        expect(stored).toEqual(history);
    });

    test('chat history filters out old messages (> 24h)', async ({ page }) => {
        await loadStateModule(page);

        const now = Date.now();
        const oldTime = new Date(now - 25 * 60 * 60 * 1000).toISOString(); // 25 hours ago
        const newTime = new Date(now - 1 * 60 * 60 * 1000).toISOString(); // 1 hour ago

        const mixedHistory = [
            { role: 'user', content: 'old', time: oldTime },
            { role: 'user', content: 'new', time: newTime }
        ];

        // Manually set localStorage with mixed history
        await page.evaluate((h) => localStorage.setItem('chatHistory', JSON.stringify(h)), mixedHistory);

        // Retrieve via getChatHistory
        const filtered = await page.evaluate(() => window.PielState.getChatHistory());

        expect(filtered.length).toBe(1);
        expect(filtered[0].content).toBe('new');
    });

    test('chat history handles corrupted JSON gracefully', async ({ page }) => {
        await loadStateModule(page);

        // Set invalid JSON
        await page.evaluate(() => localStorage.setItem('chatHistory', '{invalid-json'));

        const history = await page.evaluate(() => window.PielState.getChatHistory());
        expect(history).toEqual([]);
    });

    test('chatbotOpen state management', async ({ page }) => {
        await loadStateModule(page);

        await page.evaluate(() => window.PielState.setChatbotOpen(true));
        expect(await page.evaluate(() => window.PielState.getChatbotOpen())).toBe(true);

        await page.evaluate(() => window.PielState.state.chatbotOpen = false);
        expect(await page.evaluate(() => window.PielState.getChatbotOpen())).toBe(false);
    });

    test('conversation context management', async ({ page }) => {
        await loadStateModule(page);
        const ctx = [{ role: 'system', content: 'foo' }];

        await page.evaluate((c) => window.PielState.setConversationContext(c), ctx);
        const retrieved = await page.evaluate(() => window.PielState.getConversationContext());

        expect(retrieved).toEqual(ctx);
    });
});
