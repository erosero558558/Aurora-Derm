const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const pages = [
    'index.html',
    'telemedicina.html',
    path.join('servicios', 'acne.html'),
    path.join('servicios', 'laser.html'),
];

function readCspContent(filePath) {
    const source = fs.readFileSync(filePath, 'utf8');
    const match = source.match(
        /http-equiv="Content-Security-Policy"[\s\S]*?content="([^"]+)"/i
    );
    return match ? match[1] : '';
}

test.describe('Public CSP policy', () => {
    for (const file of pages) {
        test(`${file} includes required sources for runtime`, () => {
            const fullPath = path.resolve(__dirname, '..', file);
            const csp = readCspContent(fullPath);

            expect(csp).toContain("script-src 'self'");
            expect(csp).toContain('https://browser.sentry-cdn.com');
            expect(csp).toContain('https://static.cloudflareinsights.com');

            if (file === 'index.html') {
                // index.html uses:
                // style-src 'self' 'unsafe-inline' ... (for attributes fallback)
                // style-src-elem 'self' 'sha256-...' ... (for elements, overriding style-src)

                expect(csp).toContain("style-src 'self' 'unsafe-inline'");
                expect(csp).toContain("style-src-elem 'self'");
                expect(csp).toContain('sha256-'); // Contains at least one hash
                // Verify style-src-elem does NOT contain unsafe-inline
                // We need to parse the directives a bit more carefully or check the string.
                // A simple check:
                const styleSrcElem = csp.match(/style-src-elem ([^;]+)/)[1];
                expect(styleSrcElem).not.toContain("'unsafe-inline'");

                expect(csp).toContain('https://fonts.googleapis.com');
                expect(csp).toContain('https://cdnjs.cloudflare.com');
            } else {
                expect(csp).toContain(
                    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com"
                );
            }

            expect(csp).toContain(
                "font-src 'self' https://fonts.gstatic.com https://cdnjs.cloudflare.com"
            );
            expect(csp).toContain('https://cloudflareinsights.com');
            expect(csp).toContain('https://*.ingest.sentry.io');
            expect(csp).toContain('https://sentry.io');
            expect(csp).not.toContain("script-src 'unsafe-inline'");
        });
    }
});
