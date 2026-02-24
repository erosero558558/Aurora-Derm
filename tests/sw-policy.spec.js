const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const swPath = path.resolve(__dirname, '..', 'sw.js');

test.describe('Service worker policy hardening', () => {
    test('sw bypasses dynamic API endpoints and non-GET requests', () => {
        const source = fs.readFileSync(swPath, 'utf8');

        expect(source).toContain("request.method !== 'GET'");
        expect(source).toContain("'/api.php'");
        expect(source).toContain("'/figo-chat.php'");
        expect(source).toContain("'/figo-backend.php'");
    });

    test('sw pre-caches versioned critical bundles', () => {
        const source = fs.readFileSync(swPath, 'utf8');

        expect(source).toMatch(
            /\/styles-deferred\.css\?v=[^'"\s]+/
        );
        expect(source).toMatch(
            /\/js\/bootstrap-inline-engine\.js\?v=[^'"\s]+/
        );
        expect(source).toMatch(
            /\/script\.js\?v=[^'"\s]+/
        );
    });
});
