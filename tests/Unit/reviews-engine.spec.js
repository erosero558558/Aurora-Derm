const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// reviews/engine.js has no ES module imports — inject as-is.
// It exposes window.PielReviewsEngine at the module level.
const engineScript = fs.readFileSync(
    path.resolve(__dirname, '../../src/apps/reviews/engine.js'),
    'utf8'
);

// Default reviews baked into the engine (used for deduplication assertions)
const DEFAULT_REVIEW_COUNT = 4;

test.describe('Reviews Engine Unit Tests', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('about:blank');
        await page.addScriptTag({ content: engineScript });
        await page.waitForFunction(
            () => typeof window.PielReviewsEngine !== 'undefined'
        );
    });

    // -----------------------------------------------------------------------
    // init
    // -----------------------------------------------------------------------
    test.describe('init', () => {
        test('returns the engine object', async ({ page }) => {
            const result = await page.evaluate(() => {
                const engine = window.PielReviewsEngine.init({});
                return {
                    hasLoadPublicReviews: typeof engine.loadPublicReviews === 'function',
                    hasRenderPublicReviews: typeof engine.renderPublicReviews === 'function',
                    hasGetCache: typeof engine.getCache === 'function',
                    hasSetCache: typeof engine.setCache === 'function',
                };
            });
            expect(result.hasLoadPublicReviews).toBe(true);
            expect(result.hasRenderPublicReviews).toBe(true);
            expect(result.hasGetCache).toBe(true);
            expect(result.hasSetCache).toBe(true);
        });

        test('pre-populates cache with DEFAULT_PUBLIC_REVIEWS on first call', async ({ page }) => {
            const count = await page.evaluate(() => {
                window.PielReviewsEngine.init({});
                return window.PielReviewsEngine.getCache().length;
            });
            expect(count).toBe(DEFAULT_REVIEW_COUNT);
        });

        test('stores provided deps for use by other methods', async ({ page }) => {
            const calledWith = await page.evaluate(async () => {
                let captured;
                window.PielReviewsEngine.init({
                    apiRequest: async (resource, options) => {
                        captured = { resource, options };
                        return { data: [] };
                    },
                    storageGetJSON: () => [],
                });
                await window.PielReviewsEngine.loadPublicReviews();
                return captured;
            });
            expect(calledWith.resource).toBe('reviews');
        });
    });

    // -----------------------------------------------------------------------
    // getCache / setCache
    // -----------------------------------------------------------------------
    test.describe('getCache / setCache', () => {
        test('getCache returns a copy, not the original array reference', async ({ page }) => {
            const isSameRef = await page.evaluate(() => {
                window.PielReviewsEngine.init({});
                const a = window.PielReviewsEngine.getCache();
                const b = window.PielReviewsEngine.getCache();
                return a === b; // should be false — different array instances
            });
            expect(isSameRef).toBe(false);
        });

        test('setCache merges new items with defaults', async ({ page }) => {
            const result = await page.evaluate(() => {
                window.PielReviewsEngine.init({});
                window.PielReviewsEngine.setCache([
                    { id: 'new-1', name: 'Ana Test', rating: 4, text: 'Great!', date: '2026-01-01T00:00:00Z' },
                ]);
                return window.PielReviewsEngine.getCache();
            });
            // Defaults (4) + 1 new = 5 total
            expect(result.length).toBe(DEFAULT_REVIEW_COUNT + 1);
            expect(result.some((r) => r.name === 'Ana Test')).toBe(true);
        });

        test('setCache deduplicates reviews with the same name+text+date', async ({ page }) => {
            const count = await page.evaluate(() => {
                window.PielReviewsEngine.init({});
                // The first default review is Jose Gancino — adding it again should not add a duplicate
                window.PielReviewsEngine.setCache([
                    {
                        name: 'Jose Gancino',
                        rating: 5,
                        text: 'Buena atencion, solo faltan los numeros de la oficina y horarios de atencion.',
                        date: '2025-10-01T10:00:00-05:00',
                    },
                ]);
                return window.PielReviewsEngine.getCache().length;
            });
            expect(count).toBe(DEFAULT_REVIEW_COUNT); // no duplicates added
        });

        test('setCache ignores non-object entries', async ({ page }) => {
            const count = await page.evaluate(() => {
                window.PielReviewsEngine.init({});
                window.PielReviewsEngine.setCache([null, undefined, 42, 'string']);
                return window.PielReviewsEngine.getCache().length;
            });
            expect(count).toBe(DEFAULT_REVIEW_COUNT); // only defaults
        });

        test('setCache ignores reviews with no name', async ({ page }) => {
            const count = await page.evaluate(() => {
                window.PielReviewsEngine.init({});
                window.PielReviewsEngine.setCache([{ name: '', rating: 5, text: 'test', date: '2026-01-01' }]);
                return window.PielReviewsEngine.getCache().length;
            });
            expect(count).toBe(DEFAULT_REVIEW_COUNT);
        });
    });

    // -----------------------------------------------------------------------
    // loadPublicReviews
    // -----------------------------------------------------------------------
    test.describe('loadPublicReviews', () => {
        test('calls apiRequest with resource=reviews', async ({ page }) => {
            const resource = await page.evaluate(async () => {
                let captured;
                window.PielReviewsEngine.init({
                    apiRequest: async (r) => { captured = r; return { data: [] }; },
                    storageGetJSON: () => [],
                });
                await window.PielReviewsEngine.loadPublicReviews();
                return captured;
            });
            expect(resource).toBe('reviews');
        });

        test('passes background+silentSlowNotice options when background=true', async ({ page }) => {
            const options = await page.evaluate(async () => {
                let captured;
                window.PielReviewsEngine.init({
                    apiRequest: async (r, opts) => { captured = opts; return { data: [] }; },
                    storageGetJSON: () => [],
                });
                await window.PielReviewsEngine.loadPublicReviews({ background: true });
                return captured;
            });
            expect(options.background).toBe(true);
            expect(options.silentSlowNotice).toBe(true);
        });

        test('merges fetched reviews with defaults on success', async ({ page }) => {
            const cache = await page.evaluate(async () => {
                window.PielReviewsEngine.init({
                    apiRequest: async () => ({
                        data: [
                            { name: 'API User', rating: 4, text: 'API review', date: '2026-02-01T00:00:00Z' },
                        ],
                    }),
                    storageGetJSON: () => [],
                });
                await window.PielReviewsEngine.loadPublicReviews();
                return window.PielReviewsEngine.getCache();
            });
            expect(cache.length).toBe(DEFAULT_REVIEW_COUNT + 1);
            expect(cache.some((r) => r.name === 'API User')).toBe(true);
        });

        test('falls back to storageGetJSON on API failure', async ({ page }) => {
            const cache = await page.evaluate(async () => {
                window.PielReviewsEngine.init({
                    apiRequest: async () => { throw new Error('Network error'); },
                    storageGetJSON: (key, fallback) => key === 'reviews'
                        ? [{ name: 'Stored User', rating: 5, text: 'Stored', date: '2026-01-15T00:00:00Z' }]
                        : fallback,
                });
                await window.PielReviewsEngine.loadPublicReviews();
                return window.PielReviewsEngine.getCache();
            });
            expect(cache.some((r) => r.name === 'Stored User')).toBe(true);
        });

        test('uses only defaults when both API and storageGetJSON fail', async ({ page }) => {
            const count = await page.evaluate(async () => {
                window.PielReviewsEngine.init({
                    apiRequest: async () => { throw new Error('Network error'); },
                    // no storageGetJSON dep
                });
                await window.PielReviewsEngine.loadPublicReviews();
                return window.PielReviewsEngine.getCache().length;
            });
            expect(count).toBe(DEFAULT_REVIEW_COUNT);
        });

        test('returns the cache after loading', async ({ page }) => {
            const result = await page.evaluate(async () => {
                window.PielReviewsEngine.init({
                    apiRequest: async () => ({ data: [] }),
                    storageGetJSON: () => [],
                });
                return window.PielReviewsEngine.loadPublicReviews();
            });
            expect(Array.isArray(result)).toBe(true);
            expect(result.length).toBeGreaterThanOrEqual(DEFAULT_REVIEW_COUNT);
        });
    });

    // -----------------------------------------------------------------------
    // renderPublicReviews
    // -----------------------------------------------------------------------
    test.describe('renderPublicReviews', () => {
        test('does nothing when .reviews-grid is not in the DOM', async ({ page }) => {
            const threw = await page.evaluate(() => {
                window.PielReviewsEngine.init({});
                try {
                    window.PielReviewsEngine.renderPublicReviews([
                        { name: 'Test', rating: 5, text: 'ok', date: '2026-01-01' },
                    ]);
                    return false;
                } catch {
                    return true;
                }
            });
            expect(threw).toBe(false); // silently returns, no throw
        });

        test('renders review cards into .reviews-grid', async ({ page }) => {
            await page.evaluate(() => {
                document.body.innerHTML = '<div class="reviews-grid"></div>';
                window.PielReviewsEngine.init({
                    escapeHtml: (v) => String(v || ''),
                    getInitials: (name) => name[0].toUpperCase(),
                    renderStars: () => '<stars/>',
                    getRelativeDateLabel: () => 'Hoy',
                });
                window.PielReviewsEngine.renderPublicReviews([
                    { name: 'Maria Lopez', rating: 5, text: 'Excelente', date: '2026-01-01' },
                ]);
            });
            await expect(page.locator('.reviews-grid .review-card')).toBeVisible();
            await expect(page.locator('.reviews-grid')).toContainText('Maria Lopez');
        });

        test('renders at most 6 review cards even when more are provided', async ({ page }) => {
            const cardCount = await page.evaluate(() => {
                document.body.innerHTML = '<div class="reviews-grid"></div>';
                window.PielReviewsEngine.init({
                    escapeHtml: (v) => String(v || ''),
                    getInitials: () => 'X',
                    renderStars: () => '',
                    getRelativeDateLabel: () => '',
                });
                const reviews = Array.from({ length: 10 }, (_, i) => ({
                    name: `User ${i}`, rating: 5, text: 'ok', date: '2026-01-01',
                }));
                window.PielReviewsEngine.renderPublicReviews(reviews);
                return document.querySelectorAll('.reviews-grid .review-card').length;
            });
            expect(cardCount).toBe(6);
        });

        test('omits the review-text paragraph when text is empty', async ({ page }) => {
            await page.evaluate(() => {
                document.body.innerHTML = '<div class="reviews-grid"></div>';
                window.PielReviewsEngine.init({
                    escapeHtml: (v) => String(v || ''),
                    getInitials: () => 'X',
                    renderStars: () => '',
                    getRelativeDateLabel: () => '',
                });
                window.PielReviewsEngine.renderPublicReviews([
                    { name: 'Silent User', rating: 5, text: '', date: '2026-01-01' },
                ]);
            });
            const textParagraphs = await page.locator('.review-text').count();
            expect(textParagraphs).toBe(0);
        });

        test('includes the review-text paragraph when text is present', async ({ page }) => {
            await page.evaluate(() => {
                document.body.innerHTML = '<div class="reviews-grid"></div>';
                window.PielReviewsEngine.init({
                    escapeHtml: (v) => String(v || ''),
                    getInitials: () => 'X',
                    renderStars: () => '',
                    getRelativeDateLabel: () => '',
                });
                window.PielReviewsEngine.renderPublicReviews([
                    { name: 'Vocal User', rating: 5, text: 'Great service!', date: '2026-01-01' },
                ]);
            });
            await expect(page.locator('.review-text')).toContainText('Great service!');
        });

        test('updates .rating-number with the average rating', async ({ page }) => {
            await page.evaluate(() => {
                document.body.innerHTML = `
                    <div class="reviews-grid"></div>
                    <span class="rating-number"></span>
                `;
                window.PielReviewsEngine.init({
                    escapeHtml: (v) => String(v || ''),
                    getInitials: () => 'X',
                    renderStars: () => '',
                    getRelativeDateLabel: () => '',
                });
                window.PielReviewsEngine.renderPublicReviews([
                    { name: 'A', rating: 4, text: '', date: '2026-01-01' },
                    { name: 'B', rating: 5, text: '', date: '2026-01-02' },
                ]);
            });
            const avg = page.locator('.rating-number');
            await expect(avg).toHaveText('4.5');
        });

        test('updates .rating-count with correct Spanish text', async ({ page }) => {
            await page.evaluate(() => {
                document.body.innerHTML = `
                    <div class="reviews-grid"></div>
                    <span class="rating-count"></span>
                `;
                window.PielReviewsEngine.init({
                    getCurrentLang: () => 'es',
                    escapeHtml: (v) => String(v || ''),
                    getInitials: () => 'X',
                    renderStars: () => '',
                    getRelativeDateLabel: () => '',
                });
                window.PielReviewsEngine.renderPublicReviews([
                    { name: 'A', rating: 5, text: '', date: '2026-01-01' },
                    { name: 'B', rating: 5, text: '', date: '2026-01-02' },
                ]);
            });
            const count = await page.locator('.rating-count').textContent();
            expect(count).toContain('2');
            expect(count).toContain('reseñas');
        });

        test('updates .rating-count with correct English text', async ({ page }) => {
            await page.evaluate(() => {
                document.body.innerHTML = `
                    <div class="reviews-grid"></div>
                    <span class="rating-count"></span>
                `;
                window.PielReviewsEngine.init({
                    getCurrentLang: () => 'en',
                    escapeHtml: (v) => String(v || ''),
                    getInitials: () => 'X',
                    renderStars: () => '',
                    getRelativeDateLabel: () => '',
                });
                window.PielReviewsEngine.renderPublicReviews([
                    { name: 'A', rating: 5, text: '', date: '2026-01-01' },
                ]);
            });
            const count = await page.locator('.rating-count').textContent();
            expect(count).toContain('verified reviews');
        });

        test('delegates text escaping to deps.escapeHtml', async ({ page }) => {
            await page.evaluate(() => {
                document.body.innerHTML = '<div class="reviews-grid"></div>';
                let escapeWasCalled = false;
                window.PielReviewsEngine.init({
                    escapeHtml: () => { escapeWasCalled = true; return '__escaped__'; },
                    getInitials: () => 'X',
                    renderStars: () => '',
                    getRelativeDateLabel: () => '',
                });
                window.PielReviewsEngine.renderPublicReviews([
                    { name: 'Test', rating: 5, text: '<b>xss</b>', date: '2026-01-01' },
                ]);
                window.__escapeWasCalled = escapeWasCalled;
            });
            const called = await page.evaluate(() => window.__escapeWasCalled);
            expect(called).toBe(true);
        });
    });
});
