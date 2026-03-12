const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

test.describe('Chat Engine Unit Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('about:blank');
        const enginePath = path.resolve(__dirname, '../../src/apps/chat/engine.js');
        const content = fs.readFileSync(enginePath, 'utf8');
        await page.addScriptTag({ content: content, type: 'module' });
        await page.waitForFunction(() => window.Piel && window.Piel.FigoChatEngine);
    });

    test('init initializes with dependencies', async ({ page }) => {
        const result = await page.evaluate(() => {
            return window.Piel.FigoChatEngine.init({
                getConversationContext: () => [],
                getChatHistory: () => []
            });
        });
        expect(result).toBeTruthy();
    });

    test('processWithKimi falls back to local response on network error', async ({ page }) => {
        const result = await page.evaluate(async () => {
            let lastMessage = null;
            const deps = {
                addBotMessage: (msg) => { lastMessage = msg; },
                getConversationContext: () => [],
                setConversationContext: () => {},
                getChatHistory: () => [],
                setChatHistory: () => {},
                showTypingIndicator: () => {},
                removeTypingIndicator: () => {},
                debugLog: () => {}
            };
            window.Piel.FigoChatEngine.init(deps);

            // Mock fetch to fail so it triggers local fallback
            window.fetch = () => Promise.reject(new Error('Network error'));

            // We assume processWithKimi catches the error and calls processLocalResponse
            await window.Piel.FigoChatEngine.processWithKimi('hola');

            return lastMessage;
        });

        // Check for local response content
        expect(result).toContain('Soy <strong>Figo</strong>');
    });

    test('processWithKimi handles appointment booking intent', async ({ page }) => {
        const result = await page.evaluate(async () => {
            let bookingStarted = false;
            const deps = {
                startChatBooking: () => { bookingStarted = true; },
                getConversationContext: () => [],
                getChatHistory: () => []
            };
            window.Piel.FigoChatEngine.init(deps);

            await window.Piel.FigoChatEngine.processWithKimi('quiero agendar una cita');
            return bookingStarted;
        });
        expect(result).toBe(true);
    });

    test('processWithKimi keeps out-of-scope questions limited to clinic context', async ({ page }) => {
        const result = await page.evaluate(async () => {
            let lastMessage = null;
            const deps = {
                addBotMessage: (msg) => {
                    lastMessage = msg;
                },
                getConversationContext: () => [],
                getChatHistory: () => [],
                showTypingIndicator: () => {},
                removeTypingIndicator: () => {},
            };
            window.Piel.FigoChatEngine.init(deps);

            await window.Piel.FigoChatEngine.processWithKimi('capital de ecuador');
            return lastMessage;
        });

        expect(result).toContain('Aurora Derm');
        expect(result).toContain('Reservar cita');
        expect(result).not.toContain('Quito');
    });

    test('processWithKimi returns detailed payment steps on local fallback', async ({ page }) => {
        const result = await page.evaluate(async () => {
            let lastMessage = null;
            const deps = {
                addBotMessage: (msg) => {
                    lastMessage = msg;
                },
                getConversationContext: () => [],
                setConversationContext: () => {},
                getChatHistory: () => [],
                setChatHistory: () => {},
                showTypingIndicator: () => {},
                removeTypingIndicator: () => {},
                debugLog: () => {},
            };
            window.Piel.FigoChatEngine.init(deps);

            // Force local fallback branch after real-ai attempt.
            window.fetch = () => Promise.reject(new Error('Network error'));
            await window.Piel.FigoChatEngine.processWithKimi(
                'como pago por transferencia y facturacion'
            );

            return lastMessage;
        });

        expect(result).toContain('Transferencia (paso a paso)');
        expect(result).toContain('Facturacion');
    });
});
