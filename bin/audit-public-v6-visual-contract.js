#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const {
    startLocalPublicServer,
    stopLocalPublicServer,
} = require('./lib/public-v6-local-server.js');

const ROOT = path.resolve(__dirname, '..');

function parseArg(flag, fallback) {
    const index = process.argv.indexOf(flag);
    if (index === -1) return fallback;
    const value = process.argv[index + 1];
    if (typeof value === 'undefined') return fallback;
    return value;
}

function parseRgb(value) {
    const match = String(value || '').match(
        /rgba?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i
    );
    if (!match) return null;
    return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function countGridColumns(templateValue) {
    const raw = String(templateValue || '').trim();
    if (!raw || raw === 'none') return 0;
    return raw.split(/\s+/).filter(Boolean).length;
}

async function resolveRuntimeBaseUrl() {
    const explicitBaseUrl = String(
        parseArg('--base-url', process.env.TEST_BASE_URL || '')
    )
        .trim()
        .replace(/\/$/, '');
    if (explicitBaseUrl) {
        return {
            baseURL: explicitBaseUrl,
            localServer: null,
            runtimeSource: 'explicit',
        };
    }

    const { server, baseUrl } = await startLocalPublicServer(ROOT, {
        host: '127.0.0.1',
        port: 0,
    });

    return {
        baseURL: String(baseUrl).replace(/\/$/, ''),
        localServer: server,
        runtimeSource: 'local_helper',
    };
}

async function gotoStable(page, url) {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('load', { timeout: 20000 }).catch(() => null);
    await page.waitForTimeout(500);
}

async function waitForShellRuntime(page) {
    await page.waitForFunction(
        () => {
            const header = document.querySelector('[data-v6-header]');
            return (
                header?.dataset.v6MegaReady === 'true' &&
                header?.dataset.v6DrawerReady === 'true' &&
                header?.dataset.v6SearchReady === 'true'
            );
        },
        { timeout: 15000 }
    );
}

async function waitForHomeRuntime(page) {
    await page.waitForFunction(
        () => {
            const header = document.querySelector('[data-v6-header]');
            const hero = document.querySelector('[data-v6-hero]');
            const strip = document.querySelector('[data-v6-news-strip]');
            return (
                header?.dataset.v6MegaReady === 'true' &&
                header?.dataset.v6DrawerReady === 'true' &&
                header?.dataset.v6SearchReady === 'true' &&
                hero?.dataset.v6HeroReady === 'true' &&
                strip?.dataset.v6NewsReady === 'true'
            );
        },
        { timeout: 15000 }
    );
}

function addCheck(checks, id, desc, pass, meta) {
    const entry = { id, desc, pass: Boolean(pass) };
    if (meta && Object.keys(meta).length) {
        entry.meta = meta;
    }
    checks.push(entry);
}

async function run() {
    const minCheckpoints = Number(parseArg('--min-checkpoints', 104));
    const strict = process.argv.includes('--strict');

    const screenshotDir = path.join(
        ROOT,
        'verification',
        'public-v6-screenshots'
    );
    const auditDir = path.join(ROOT, 'verification', 'public-v6-audit');
    fs.mkdirSync(screenshotDir, { recursive: true });
    fs.mkdirSync(auditDir, { recursive: true });

    const { baseURL, localServer, runtimeSource } =
        await resolveRuntimeBaseUrl();
    const checks = [];
    let browser;

    try {
        browser = await chromium.launch({ headless: true });

        const desktop = await browser.newContext({
            viewport: { width: 1536, height: 864 },
        });
        const desktopPage = await desktop.newPage();

        await gotoStable(desktopPage, `${baseURL}/es/`);
        await waitForHomeRuntime(desktopPage);
        await desktopPage.screenshot({
            path: path.join(screenshotDir, 'home-es-desktop.png'),
            fullPage: false,
        });

        const desktopHome = await desktopPage.evaluate(() => {
            const header = document.querySelector('[data-v6-header]');
            const navLinks = Array.from(
                document.querySelectorAll('.v6-header__nav .v6-header__link')
            );
            const mega = document.querySelector('[data-v6-mega]');
            const megaBackdrop = document.querySelector(
                '[data-v6-mega-backdrop]'
            );
            const trigger = document.querySelector('[data-v6-mega-trigger]');
            const hero = document.querySelector('[data-v6-hero]');
            const stage = document.querySelector('.v6-hero__stage');
            const slides = Array.from(
                document.querySelectorAll('[data-v6-hero] [data-v6-slide]')
            );
            const controls = {
                prev: Boolean(document.querySelector('[data-v6-prev]')),
                next: Boolean(document.querySelector('[data-v6-next]')),
                toggle: Boolean(document.querySelector('[data-v6-toggle]')),
            };
            const indicators = Array.from(
                document.querySelectorAll('[data-v6-indicator]')
            );
            const activeIndicator = document.querySelector(
                '.v6-hero__indicator.is-active'
            );
            const activeIndicatorFill = activeIndicator
                ? activeIndicator.querySelector('[data-v6-indicator-fill]')
                : null;
            const activeIndicatorTrack = activeIndicator
                ? activeIndicator.querySelector('.v6-hero__indicator-track')
                : null;
            const activeIndicatorFillStyle = activeIndicatorFill
                ? window.getComputedStyle(activeIndicatorFill)
                : null;
            const band = document.querySelector('.v6-hero__band');
            const news = document.querySelector('[data-v6-news-strip]');
            const editorial = document.querySelector('[data-v6-editorial]');
            const card = document.querySelector('.v6-editorial__card');
            const backTop = document.querySelector('[data-v6-back-top]');

            const headerStyle = header ? window.getComputedStyle(header) : null;
            const headerRect = header ? header.getBoundingClientRect() : null;
            const logoNode = document.querySelector('.v6-header__logo');
            const logoText = logoNode ? logoNode.textContent || '' : '';
            const logoTransform = logoNode
                ? window.getComputedStyle(logoNode).textTransform
                : '';

            const stageRect = stage ? stage.getBoundingClientRect() : null;
            const slideMetrics = slides.map((slide) => {
                const style = window.getComputedStyle(slide);
                const rect = slide.getBoundingClientRect();
                return {
                    index: Number(slide.getAttribute('data-v6-index') || 0),
                    display: style.display,
                    visibility: style.visibility,
                    opacity: Number(style.opacity || 1),
                    width: rect.width,
                    height: rect.height,
                    x: rect.x,
                    active: slide.classList.contains('is-active'),
                    prev: slide.classList.contains('is-prev'),
                    next: slide.classList.contains('is-next'),
                };
            });
            const visibleSlides = slideMetrics.filter(
                (slide) =>
                    slide.display !== 'none' &&
                    slide.visibility !== 'hidden' &&
                    slide.width > 0
            );
            const active = visibleSlides.find((slide) => slide.active) || null;
            const side = visibleSlides.filter((slide) => !slide.active);
            const playOverlay = document.querySelector('.v6-hero__play');
            const playStyle = playOverlay
                ? window.getComputedStyle(playOverlay)
                : null;
            const playRect = playOverlay
                ? playOverlay.getBoundingClientRect()
                : null;

            const newsStyle = news ? window.getComputedStyle(news) : null;
            const newsRect = news ? news.getBoundingClientRect() : null;
            const left = news
                ? news.querySelector('.v6-news-strip__left')
                : null;
            const right = news
                ? news.querySelector('.v6-news-strip__right')
                : null;
            const lang = news
                ? news.querySelector('.v6-news-strip__lang')
                : null;
            const rightRect = right ? right.getBoundingClientRect() : null;
            const langRect = lang ? lang.getBoundingClientRect() : null;

            const editorialStyle = editorial
                ? window.getComputedStyle(editorial)
                : null;
            const editorialGrid = document.querySelector('.v6-editorial__grid');
            const editorialGridStyle = editorialGrid
                ? window.getComputedStyle(editorialGrid)
                : null;
            const editorialCards = Array.from(
                document.querySelectorAll('.v6-editorial__card')
            );
            const editorialHeights = editorialCards.map((node) =>
                Math.round(node.getBoundingClientRect().height)
            );
            const uniqueEditorialHeights = Array.from(
                new Set(editorialHeights)
            );
            const firstCardStyle = card ? window.getComputedStyle(card) : null;

            const heroRect = hero ? hero.getBoundingClientRect() : null;
            const viewportHeight = window.innerHeight || 1;

            return {
                hasHeader: Boolean(header),
                headerRgb: headerStyle ? headerStyle.backgroundColor : '',
                headerHeight: headerRect ? headerRect.height : 0,
                logoText,
                logoTransform,
                navCount: navLinks.length,
                hasContact: Boolean(
                    document.querySelector('.v6-header__contact')
                ),
                hasSearch: Boolean(
                    document.querySelector('.v6-header__search')
                ),
                hasMega: Boolean(mega),
                megaHidden: mega ? mega.hidden : null,
                hasMegaBackdrop: Boolean(megaBackdrop),
                megaBackdropHidden: megaBackdrop ? megaBackdrop.hidden : null,
                hasTrigger: Boolean(trigger),
                megaColumns: document.querySelectorAll(
                    '.v6-mega__menu [data-v6-mega-section]'
                ).length,
                hasHero: Boolean(hero),
                stageTemplate: stage
                    ? window.getComputedStyle(stage).gridTemplateColumns
                    : '',
                visibleSlideCount: visibleSlides.length,
                activeSlideWidth: active ? active.width : 0,
                sideSlideWidths: side.map((item) => item.width),
                sideSlideOpacityMin: side.length
                    ? Math.min(...side.map((item) => item.opacity))
                    : 1,
                hasSlideContract: slides.every((slide) =>
                    slide.hasAttribute('data-v6-slide')
                ),
                playIsCircle: Boolean(
                    playStyle &&
                    playRect &&
                    Math.abs(playRect.width - playRect.height) < 2 &&
                    playStyle.borderRadius !== '0px'
                ),
                bandHasBlur: Boolean(
                    band &&
                    String(
                        window.getComputedStyle(band).backdropFilter || ''
                    ).includes('blur')
                ),
                bandTexts: {
                    category:
                        (
                            document.querySelector('[data-v6-band-category]') ||
                            {}
                        ).textContent || '',
                    title:
                        (document.querySelector('[data-v6-band-title]') || {})
                            .textContent || '',
                    description:
                        (
                            document.querySelector(
                                '[data-v6-band-description]'
                            ) || {}
                        ).textContent || '',
                },
                controls,
                indicators: indicators.length,
                autoplayMs: Number(
                    hero ? hero.getAttribute('data-v6-autoplay-ms') || 0 : 0
                ),
                hasIndicatorFill: Boolean(activeIndicatorFill),
                activeIndicatorProgressing: Boolean(
                    activeIndicator &&
                    activeIndicator.classList.contains('is-progressing')
                ),
                activeIndicatorFillTransform: activeIndicatorFillStyle
                    ? activeIndicatorFillStyle.transform
                    : '',
                activeIndicatorTrackWidth: activeIndicatorTrack
                    ? Math.round(
                          activeIndicatorTrack.getBoundingClientRect().width
                      )
                    : 0,
                heroRatio: heroRect ? heroRect.height / viewportHeight : 0,
                centerWider: Boolean(
                    active && side.every((item) => active.width > item.width)
                ),
                newsExists: Boolean(news),
                newsY: newsRect ? newsRect.y : -1,
                heroY: heroRect ? heroRect.y : -1,
                newsGridCols: newsStyle ? newsStyle.gridTemplateColumns : '',
                newsIsLight: Boolean(
                    newsStyle &&
                    parseFloat(newsStyle.borderTopWidth || '0') >= 1
                ),
                newsLeftLabel:
                    (left ? left.querySelector('span') : null)?.textContent ||
                    '',
                newsRightHeadline:
                    (right ? right.querySelector('a') : null)?.textContent ||
                    '',
                newsHasLang: Boolean(lang),
                langAlignedRight: Boolean(
                    langRect && rightRect && langRect.x >= rightRect.x
                ),
                editorialExists: Boolean(editorial),
                editorialBgImage: editorialStyle
                    ? editorialStyle.backgroundImage
                    : '',
                editorialGridCols: editorialGridStyle
                    ? editorialGridStyle.gridTemplateColumns
                    : '',
                hasVideoPlayIcon: Boolean(
                    document.querySelector(
                        '.v6-editorial__card.is-video .v6-editorial__play'
                    )
                ),
                hasInfoCardFields:
                    Boolean(document.querySelector('.v6-editorial__meta p')) &&
                    Boolean(document.querySelector('.v6-editorial__meta h3')) &&
                    Boolean(document.querySelector('.v6-editorial__meta span')),
                editorialCount: editorialCards.length,
                uniqueEditorialHeights,
                cardTransition: firstCardStyle ? firstCardStyle.transition : '',
                hasBackTop: Boolean(backTop),
                backTopFixed: Boolean(
                    backTop &&
                    window.getComputedStyle(backTop).position === 'fixed'
                ),
            };
        });

        const trigger = desktopPage.locator('[data-v6-mega-trigger]').first();
        const mega = desktopPage.locator('[data-v6-mega]').first();
        const megaBackdrop = desktopPage
            .locator('[data-v6-mega-backdrop]')
            .first();
        await trigger.click();
        const megaOpen = await mega.evaluate((node) => !node.hidden);
        const megaRuntime = await desktopPage.evaluate(() => {
            const layout = document.querySelector('[data-v6-mega-layout]');
            const tabs = Array.from(
                document.querySelectorAll('[data-v6-mega-tab]')
            );
            const backdrop = document.querySelector('[data-v6-mega-backdrop]');
            const header = document.querySelector('[data-v6-header]');
            const activeDetail = document.querySelector(
                '[data-v6-mega-detail]:not([hidden])'
            );
            const context = activeDetail
                ? activeDetail.querySelector('.v6-mega__context')
                : null;
            const contextFields = Boolean(
                context &&
                context.querySelector('p:first-child') &&
                context.querySelector('h3') &&
                context.querySelector('p:nth-of-type(2)')
            );
            return {
                layoutCols: layout
                    ? getComputedStyle(layout).gridTemplateColumns
                    : '',
                tabCount: tabs.length,
                activeColumnId: activeDetail
                    ? activeDetail.getAttribute('data-v6-column-id') || ''
                    : '',
                contextFields,
                backdropVisible: Boolean(
                    backdrop &&
                    !backdrop.hidden &&
                    backdrop.classList.contains('is-visible')
                ),
                headerMegaOpen: Boolean(
                    header && header.classList.contains('is-mega-open')
                ),
                backdropTop: backdrop
                    ? Math.round(backdrop.getBoundingClientRect().top)
                    : -1,
                headerHeight: header
                    ? Math.round(header.getBoundingClientRect().height)
                    : 0,
            };
        });
        await desktopPage.locator('[data-v6-mega-tab]').nth(1).hover();
        await desktopPage.waitForTimeout(120);
        const megaActiveAfterHover = await desktopPage.evaluate(() => {
            const activeDetail = document.querySelector(
                '[data-v6-mega-detail]:not([hidden])'
            );
            return activeDetail
                ? activeDetail.getAttribute('data-v6-column-id') || ''
                : '';
        });
        await desktopPage.locator('[data-v6-mega-tab]').first().focus();
        await desktopPage.keyboard.press('ArrowDown');
        const megaActiveAfterArrow = await desktopPage.evaluate(() => {
            const activeDetail = document.querySelector(
                '[data-v6-mega-detail]:not([hidden])'
            );
            return activeDetail
                ? activeDetail.getAttribute('data-v6-column-id') || ''
                : '';
        });
        await desktopPage.keyboard.press('Escape');
        const megaClosedEsc = await mega.evaluate((node) => node.hidden);
        const megaBackdropHiddenEsc = await megaBackdrop.evaluate(
            (node) => node.hidden
        );

        await trigger.click();
        await desktopPage.evaluate(() => {
            const backdrop = document.querySelector('[data-v6-mega-backdrop]');
            if (!backdrop) return false;
            backdrop.dispatchEvent(
                new MouseEvent('click', {
                    bubbles: true,
                    cancelable: true,
                    view: window,
                })
            );
            return true;
        });
        const megaClosedBackdrop = await mega.evaluate((node) => node.hidden);
        const megaBackdropHiddenBackdrop = await megaBackdrop.evaluate(
            (node) => node.hidden
        );

        const activeIndexBeforeAuto = await desktopPage.evaluate(() =>
            Array.from(document.querySelectorAll('[data-v6-slide]')).findIndex(
                (slide) => slide.classList.contains('is-active')
            )
        );
        await desktopPage.waitForTimeout(7300);
        const activeIndexAfterAuto = await desktopPage.evaluate(() =>
            Array.from(document.querySelectorAll('[data-v6-slide]')).findIndex(
                (slide) => slide.classList.contains('is-active')
            )
        );
        await desktopPage.waitForTimeout(900);
        const activeIndicatorFillTransformAfterTick =
            await desktopPage.evaluate(() => {
                const activeIndicator = document.querySelector(
                    '[data-v6-indicator].is-active'
                );
                const fill = activeIndicator
                    ? activeIndicator.querySelector('[data-v6-indicator-fill]')
                    : null;
                return fill ? getComputedStyle(fill).transform : '';
            });

        const toggle = desktopPage.locator('[data-v6-toggle]').first();
        await toggle.click();
        const pausedState = await desktopPage
            .locator('[data-v6-hero]')
            .first()
            .getAttribute('data-v6-state');
        const pausedIndexBefore = await desktopPage.evaluate(() =>
            Array.from(document.querySelectorAll('[data-v6-slide]')).findIndex(
                (slide) => slide.classList.contains('is-active')
            )
        );
        await desktopPage.waitForTimeout(7300);
        const pausedIndexAfter = await desktopPage.evaluate(() =>
            Array.from(document.querySelectorAll('[data-v6-slide]')).findIndex(
                (slide) => slide.classList.contains('is-active')
            )
        );
        const pausedIndicatorProgressing = await desktopPage.evaluate(() => {
            const activeIndicator = document.querySelector(
                '[data-v6-indicator].is-active'
            );
            return Boolean(
                activeIndicator &&
                activeIndicator.classList.contains('is-progressing')
            );
        });

        await toggle.click();
        const resumedState = await desktopPage
            .locator('[data-v6-hero]')
            .first()
            .getAttribute('data-v6-state');
        const resumedIndicatorProgressing = await desktopPage.evaluate(() => {
            const activeIndicator = document.querySelector(
                '[data-v6-indicator].is-active'
            );
            return Boolean(
                activeIndicator &&
                activeIndicator.classList.contains('is-progressing')
            );
        });

        await desktopPage.locator('[data-v6-next]').first().click();
        await desktopPage.keyboard.press('ArrowRight');
        const indexAfterRight = await desktopPage.evaluate(() =>
            Array.from(document.querySelectorAll('[data-v6-slide]')).findIndex(
                (slide) => slide.classList.contains('is-active')
            )
        );
        await desktopPage.keyboard.press('ArrowLeft');
        const indexAfterLeft = await desktopPage.evaluate(() =>
            Array.from(document.querySelectorAll('[data-v6-slide]')).findIndex(
                (slide) => slide.classList.contains('is-active')
            )
        );

        const firstCard = desktopPage.locator('.v6-editorial__card').first();
        const transformBeforeHover = await firstCard.evaluate(
            (node) => getComputedStyle(node).transform
        );
        await firstCard.hover();
        await desktopPage.waitForTimeout(200);
        const transformAfterHover = await firstCard.evaluate(
            (node) => getComputedStyle(node).transform
        );

        await desktopPage.evaluate(() => window.scrollTo(0, 1200));
        await desktopPage.waitForTimeout(200);
        const backTopVisible = await desktopPage.evaluate(() => {
            const node = document.querySelector('[data-v6-back-top]');
            return Boolean(node && node.classList.contains('is-visible'));
        });

        await gotoStable(desktopPage, `${baseURL}/es/servicios/`);
        await waitForShellRuntime(desktopPage);
        await desktopPage.screenshot({
            path: path.join(screenshotDir, 'hub-es-desktop.png'),
            fullPage: false,
        });

        const desktopHub = await desktopPage.evaluate(() => {
            const pageHead = document.querySelector('[data-v6-page-head]');
            const crumbs = pageHead
                ? pageHead.querySelectorAll('nav a').length
                : 0;
            const title = pageHead
                ? (pageHead.querySelector('h1') || {}).textContent || ''
                : '';
            const langControl = document.querySelector('.v6-corp-head__lang');
            const pageTools = document.querySelector('[data-v6-page-tools]');
            const pageMenuButton = document.querySelector(
                '[data-v6-page-menu]'
            );
            const pageMenuPanel = document.querySelector(
                '[data-v6-page-menu-panel]'
            );
            const pageHeadInner = document.querySelector(
                '.v6-corp-head__inner'
            );
            const toolsRect = pageTools
                ? pageTools.getBoundingClientRect()
                : null;
            const innerRect = pageHeadInner
                ? pageHeadInner.getBoundingClientRect()
                : null;
            const langStyle = langControl
                ? getComputedStyle(langControl)
                : null;
            const menuButtonStyle = pageMenuButton
                ? getComputedStyle(pageMenuButton)
                : null;
            const heroImage = document.querySelector('.v6-page-hero-media img');
            const heroRect = heroImage
                ? heroImage.getBoundingClientRect()
                : null;
            const viewportW = window.innerWidth || 1;
            const contentNode = document.querySelector('.v6-catalog-stream');
            const contentRect = contentNode
                ? contentNode.getBoundingClientRect()
                : null;
            const firstGrid = document.querySelector('.v6-catalog-grid');
            const firstGridCols = firstGrid
                ? getComputedStyle(firstGrid).gridTemplateColumns
                : '';
            const firstCard = document.querySelector('.v6-catalog-card');
            const firstHasImage = Boolean(
                firstCard && firstCard.querySelector('img')
            );
            const firstHasMeta = Boolean(
                firstCard &&
                firstCard.querySelector('h3') &&
                firstCard.querySelector('p') &&
                firstCard.querySelector('strong')
            );
            const initiativesRoot = document.querySelector(
                '[data-v6-hub-initiatives]'
            );
            const initiativesCards = Array.from(
                document.querySelectorAll('[data-v6-hub-initiative-card]')
            );
            const initiativesGrid = document.querySelector(
                '.v6-hub-initiatives__grid'
            );
            const initiativesGridCols = initiativesGrid
                ? getComputedStyle(initiativesGrid).gridTemplateColumns
                : '';
            const firstInitiative = initiativesCards[0] || null;
            const firstInitiativeFields = Boolean(
                firstInitiative &&
                firstInitiative.querySelector('img') &&
                firstInitiative.querySelector('p span') &&
                firstInitiative.querySelector('h3') &&
                firstInitiative.querySelector('p:nth-of-type(2)') &&
                firstInitiative.querySelector('strong')
            );
            const featuredRoot = document.querySelector(
                '[data-v6-hub-featured]'
            );
            const featuredCards = Array.from(
                document.querySelectorAll('[data-v6-hub-featured-card]')
            );
            const featuredGrid = document.querySelector(
                '.v6-hub-featured__grid'
            );
            const featuredGridCols = featuredGrid
                ? getComputedStyle(featuredGrid).gridTemplateColumns
                : '';
            const firstFeatured = featuredCards[0] || null;
            const firstFeaturedImage = firstFeatured
                ? firstFeatured.querySelector('img')
                : null;
            const firstFeaturedFields = Boolean(
                firstFeatured &&
                firstFeatured.querySelector('p span') &&
                firstFeatured.querySelector('h3') &&
                firstFeatured.querySelector('p:nth-of-type(2)') &&
                firstFeatured.querySelector('strong')
            );
            const pageMenuLinks = Array.from(
                document.querySelectorAll(
                    '[data-v6-page-menu-panel] [data-v6-page-menu-link]'
                )
            );
            const hasInitiativesMenuLink = pageMenuLinks.some((node) => {
                const href = node.getAttribute('href') || '';
                return href.endsWith('#v6-hub-initiatives');
            });
            const hasFeaturedMenuLink = pageMenuLinks.some((node) => {
                const href = node.getAttribute('href') || '';
                return href.endsWith('#v6-hub-featured');
            });
            const catalogStream = document.querySelector('.v6-catalog-stream');
            const featuredBeforeCatalog = Boolean(
                featuredRoot &&
                catalogStream &&
                (featuredRoot.compareDocumentPosition(catalogStream) &
                    Node.DOCUMENT_POSITION_FOLLOWING) !==
                    0
            );

            return {
                hasPageHead: Boolean(pageHead),
                crumbCount: crumbs,
                title,
                hasLangControl: Boolean(langControl),
                hasPageTools: Boolean(pageTools),
                hasPageMenuButton: Boolean(pageMenuButton),
                pageMenuPanelHasLinks: Boolean(
                    pageMenuPanel &&
                    pageMenuPanel.querySelectorAll('[data-v6-page-menu-link]')
                        .length > 0
                ),
                pageMenuButtonHeight: menuButtonStyle
                    ? Number.parseFloat(menuButtonStyle.height || '0')
                    : 0,
                pageMenuButtonWidth: menuButtonStyle
                    ? Number.parseFloat(menuButtonStyle.width || '0')
                    : 0,
                langFontSize: langStyle
                    ? Number.parseFloat(langStyle.fontSize || '0')
                    : 0,
                langHasSlash: Boolean(
                    langControl && /\/|\|/.test(langControl.textContent || '')
                ),
                toolsRightAligned: Boolean(
                    toolsRect &&
                    innerRect &&
                    Math.abs(toolsRect.right - innerRect.right) <= 28
                ),
                heroFullBleed: Boolean(
                    heroRect && heroRect.width >= viewportW * 0.9
                ),
                contentWidth: contentRect ? contentRect.width : 0,
                firstGridCols,
                firstHasImage,
                firstHasMeta,
                hasHubInitiatives: Boolean(initiativesRoot),
                initiativesCardsCount: initiativesCards.length,
                initiativesGridCols,
                firstInitiativeFields,
                hasHubFeatured: Boolean(featuredRoot),
                featuredCardsCount: featuredCards.length,
                featuredGridCols,
                firstFeaturedFields,
                firstFeaturedImageHeight: firstFeaturedImage
                    ? firstFeaturedImage.getBoundingClientRect().height
                    : 0,
                pageMenuLinksCount: pageMenuLinks.length,
                hasInitiativesMenuLink,
                hasFeaturedMenuLink,
                featuredBeforeCatalog,
            };
        });

        const hubMenuButton = desktopPage
            .locator('[data-v6-page-menu]')
            .first();
        const hubMenuPanel = desktopPage
            .locator('[data-v6-page-menu-panel]')
            .first();
        await hubMenuButton.click();
        const hubMenuOpen = await desktopPage.evaluate(() => {
            const button = document.querySelector('[data-v6-page-menu]');
            const panel = document.querySelector('[data-v6-page-menu-panel]');
            return {
                buttonExpanded: Boolean(
                    button && button.getAttribute('aria-expanded') === 'true'
                ),
                panelVisible: Boolean(panel && !panel.hidden),
            };
        });
        await hubMenuButton.focus();
        await desktopPage.keyboard.press('ArrowDown');
        const hubMenuKeyboard = await desktopPage.evaluate(() => {
            const panel = document.querySelector('[data-v6-page-menu-panel]');
            const active = document.activeElement;
            const firstLink = panel
                ? panel.querySelector('[data-v6-page-menu-link]')
                : null;
            return {
                firstLinkFocused: Boolean(firstLink && active === firstLink),
                focusedTag: active ? active.tagName.toLowerCase() : '',
                panelVisible: Boolean(panel && !panel.hidden),
            };
        });
        await desktopPage.keyboard.press('Escape');
        const hubMenuEsc = await desktopPage.evaluate(() => {
            const button = document.querySelector('[data-v6-page-menu]');
            const panel = document.querySelector('[data-v6-page-menu-panel]');
            return {
                buttonExpanded: Boolean(
                    button && button.getAttribute('aria-expanded') === 'true'
                ),
                panelHidden: Boolean(panel && panel.hidden),
                focusReturned: Boolean(
                    button && document.activeElement === button
                ),
            };
        });

        await gotoStable(
            desktopPage,
            `${baseURL}/es/servicios/diagnostico-integral/`
        );
        await waitForShellRuntime(desktopPage);
        await desktopPage.screenshot({
            path: path.join(screenshotDir, 'service-es-desktop.png'),
            fullPage: false,
        });
        const desktopService = await desktopPage.evaluate(() => {
            const pageHead = document.querySelector('[data-v6-page-head]');
            const pageHeadRect = pageHead
                ? pageHead.getBoundingClientRect()
                : null;
            const hero = document.querySelector('[data-v6-internal-hero] img');
            const heroRect = hero ? hero.getBoundingClientRect() : null;
            const viewportHeight = window.innerHeight || 1;
            const message = document.querySelector(
                '[data-v6-internal-message]'
            );
            const messageRect = message
                ? message.getBoundingClientRect()
                : null;
            const messageText = message ? message.textContent || '' : '';
            const thesis = document.querySelector('[data-v6-internal-thesis]');
            const thesisRect = thesis ? thesis.getBoundingClientRect() : null;
            const thesisText = thesis ? thesis.textContent || '' : '';
            const statement = document.querySelector(
                '[data-v6-statement-band]'
            );
            const statementStyle = statement
                ? window.getComputedStyle(statement)
                : null;
            const statementHasImage = Boolean(
                statement && statement.querySelector('img')
            );
            const statementHasFields = Boolean(
                statement &&
                statement.querySelector('h2') &&
                statement.querySelector('p:first-child') &&
                statement.querySelector('p:nth-of-type(2)')
            );
            const detail = document.querySelector('.v6-service-detail');
            const detailStyle = detail ? window.getComputedStyle(detail) : null;
            const shell = document.querySelector('[data-v6-internal-shell]');
            const shellStyle = shell ? window.getComputedStyle(shell) : null;
            const rail = document.querySelector('[data-v6-internal-rail]');
            const railStyle = rail ? window.getComputedStyle(rail) : null;
            const railLinks = rail ? rail.querySelectorAll('a').length : 0;

            return {
                pageHeadHeight: pageHeadRect ? pageHeadRect.height : 0,
                heroRatio: heroRect ? heroRect.height / viewportHeight : 0,
                hasInternalMessage: Boolean(message),
                internalMessageWidth: messageRect ? messageRect.width : 0,
                internalMessageTextLength: messageText
                    .replace(/\s+/g, ' ')
                    .trim().length,
                hasThesis: Boolean(thesis),
                thesisWidth: thesisRect ? thesisRect.width : 0,
                thesisTextLength: thesisText.replace(/\s+/g, ' ').trim().length,
                hasStatement: Boolean(statement),
                statementCols: statementStyle
                    ? statementStyle.gridTemplateColumns
                    : '',
                statementHasImage,
                statementHasFields,
                detailCols: detailStyle ? detailStyle.gridTemplateColumns : '',
                detailGap: detailStyle ? detailStyle.gap : '',
                shellCols: shellStyle ? shellStyle.gridTemplateColumns : '',
                railPosition: railStyle ? railStyle.position : '',
                railTop: railStyle
                    ? Number.parseFloat(railStyle.top || '0')
                    : 0,
                railLinks,
            };
        });

        await gotoStable(desktopPage, `${baseURL}/es/telemedicina/`);
        await waitForShellRuntime(desktopPage);
        await desktopPage.screenshot({
            path: path.join(screenshotDir, 'tele-es-desktop.png'),
            fullPage: false,
        });
        const desktopTele = await desktopPage.evaluate(() => {
            const kpiCards = document.querySelectorAll(
                '.v6-tele-kpis article'
            ).length;
            const initiatives = Array.from(
                document.querySelectorAll('[data-v6-tele-initiative]')
            );
            const firstInitiative = initiatives[0] || null;
            const firstInitiativeFields = Boolean(
                firstInitiative &&
                firstInitiative.querySelector('img') &&
                firstInitiative.querySelector('h3') &&
                firstInitiative.querySelector('p') &&
                firstInitiative.querySelector('strong')
            );

            const lead = document.querySelector(
                '.v6-tele-grid article.is-lead'
            );
            const regular = document.querySelector(
                '.v6-tele-grid article:not(.is-lead)'
            );
            const leadRect = lead ? lead.getBoundingClientRect() : null;
            const regularRect = regular
                ? regular.getBoundingClientRect()
                : null;
            const teleGridCols = (() => {
                const node = document.querySelector('.v6-tele-grid');
                return node ? getComputedStyle(node).gridTemplateColumns : '';
            })();
            const initiativeHeights = initiatives.map((node) =>
                Number.parseFloat(
                    window.getComputedStyle(node).minHeight || '0'
                )
            );
            const internalMessage = document.querySelector(
                '[data-v6-internal-message]'
            );
            const internalMessageTextLength = internalMessage
                ? (internalMessage.textContent || '')
                      .replace(/\s+/g, ' ')
                      .trim().length
                : 0;
            const thesis = document.querySelector('[data-v6-internal-thesis]');
            const thesisRect = thesis ? thesis.getBoundingClientRect() : null;
            const thesisTextLength = thesis
                ? (thesis.textContent || '').replace(/\s+/g, ' ').trim().length
                : 0;
            const statement = document.querySelector(
                '[data-v6-statement-band]'
            );
            const statementStyle = statement
                ? window.getComputedStyle(statement)
                : null;
            const statementHasImage = Boolean(
                statement && statement.querySelector('img')
            );
            const statementHasFields = Boolean(
                statement &&
                statement.querySelector('h2') &&
                statement.querySelector('p:first-child') &&
                statement.querySelector('p:nth-of-type(2)')
            );
            const shell = document.querySelector('[data-v6-internal-shell]');
            const shellStyle = shell ? window.getComputedStyle(shell) : null;
            const rail = document.querySelector('[data-v6-internal-rail]');
            const railStyle = rail ? window.getComputedStyle(rail) : null;
            const railLinks = rail ? rail.querySelectorAll('a').length : 0;

            return {
                kpiCards,
                initiativesCount: initiatives.length,
                firstInitiativeFields,
                leadWidth: leadRect ? leadRect.width : 0,
                regularWidth: regularRect ? regularRect.width : 0,
                teleGridCols,
                initiativeHeights,
                internalMessageTextLength,
                hasThesis: Boolean(thesis),
                thesisWidth: thesisRect ? thesisRect.width : 0,
                thesisTextLength,
                hasStatement: Boolean(statement),
                statementCols: statementStyle
                    ? statementStyle.gridTemplateColumns
                    : '',
                statementHasImage,
                statementHasFields,
                shellCols: shellStyle ? shellStyle.gridTemplateColumns : '',
                railPosition: railStyle ? railStyle.position : '',
                railTop: railStyle
                    ? Number.parseFloat(railStyle.top || '0')
                    : 0,
                railLinks,
            };
        });

        await gotoStable(desktopPage, `${baseURL}/es/legal/terminos/`);
        await waitForShellRuntime(desktopPage);
        await desktopPage.screenshot({
            path: path.join(screenshotDir, 'legal-es-desktop.png'),
            fullPage: false,
        });
        const desktopLegal = await desktopPage.evaluate(() => {
            const tabs = document.querySelectorAll('#v6-legal-tabs a').length;
            const tabsNode = document.querySelector('#v6-legal-tabs');
            const tabsStyle = tabsNode ? getComputedStyle(tabsNode) : null;
            const legalSections = document.querySelectorAll(
                '[data-v6-legal-block]'
            ).length;
            const firstLegalBlock = document.querySelector(
                '[data-v6-legal-block]'
            );
            const firstLegalClauses = firstLegalBlock
                ? firstLegalBlock.querySelectorAll('ol li').length
                : 0;
            const firstClauseLabel = firstLegalBlock
                ? (
                      (firstLegalBlock.querySelector('ol li span') || {})
                          .textContent || ''
                  ).trim()
                : '';

            const legalIndexCards = document.querySelectorAll(
                '[data-v6-legal-index] a'
            ).length;
            const firstIndexCard = document.querySelector(
                '[data-v6-legal-index] a'
            );
            const firstIndexFields = Boolean(
                firstIndexCard &&
                firstIndexCard.querySelector('img') &&
                firstIndexCard.querySelector('h3') &&
                firstIndexCard.querySelector('strong')
            );
            const thesis = document.querySelector('[data-v6-internal-thesis]');
            const thesisRect = thesis ? thesis.getBoundingClientRect() : null;
            const thesisTextLength = thesis
                ? (thesis.textContent || '').replace(/\s+/g, ' ').trim().length
                : 0;
            const statement = document.querySelector(
                '[data-v6-statement-band]'
            );
            const statementStyle = statement
                ? window.getComputedStyle(statement)
                : null;
            const statementHasImage = Boolean(
                statement && statement.querySelector('img')
            );
            const statementHasFields = Boolean(
                statement &&
                statement.querySelector('h2') &&
                statement.querySelector('p:first-child') &&
                statement.querySelector('p:nth-of-type(2)')
            );

            return {
                tabs,
                tabsPosition: tabsStyle ? tabsStyle.position : '',
                tabsTop: tabsStyle
                    ? Number.parseFloat(tabsStyle.top || '0')
                    : 0,
                legalSections,
                firstLegalClauses,
                firstClauseLabel,
                legalIndexCards,
                firstIndexFields,
                hasThesis: Boolean(thesis),
                thesisWidth: thesisRect ? thesisRect.width : 0,
                thesisTextLength,
                hasStatement: Boolean(statement),
                statementCols: statementStyle
                    ? statementStyle.gridTemplateColumns
                    : '',
                statementHasImage,
                statementHasFields,
            };
        });

        const mobile = await browser.newContext({
            viewport: { width: 390, height: 844 },
        });
        const mobilePage = await mobile.newPage();

        await gotoStable(mobilePage, `${baseURL}/es/`);
        await waitForHomeRuntime(mobilePage);
        await mobilePage.screenshot({
            path: path.join(screenshotDir, 'home-es-mobile.png'),
            fullPage: false,
        });

        const hasDrawer = await mobilePage.locator('[data-v6-drawer]').count();
        await mobilePage.locator('[data-v6-drawer-open]').click();
        const bodyOverflow = await mobilePage.evaluate(
            () => document.body.style.overflow
        );
        const mobileGridCols = await mobilePage.evaluate(() => {
            const grid = document.querySelector('.v6-editorial__grid');
            return grid ? getComputedStyle(grid).gridTemplateColumns : '';
        });
        await gotoStable(mobilePage, `${baseURL}/es/servicios/`);
        await waitForShellRuntime(mobilePage);
        await mobilePage.screenshot({
            path: path.join(screenshotDir, 'hub-es-mobile.png'),
            fullPage: false,
        });
        const hubMobileInitiativesCols = await mobilePage.evaluate(() => {
            const grid = document.querySelector('.v6-hub-initiatives__grid');
            return grid ? getComputedStyle(grid).gridTemplateColumns : '';
        });
        const hubMobileFeaturedCols = await mobilePage.evaluate(() => {
            const grid = document.querySelector('.v6-hub-featured__grid');
            return grid ? getComputedStyle(grid).gridTemplateColumns : '';
        });

        await gotoStable(
            mobilePage,
            `${baseURL}/es/servicios/diagnostico-integral/`
        );
        await waitForShellRuntime(mobilePage);
        await mobilePage.screenshot({
            path: path.join(screenshotDir, 'service-es-mobile.png'),
            fullPage: false,
        });
        const serviceMobile = await mobilePage.evaluate(() => {
            const detail = document.querySelector('.v6-service-detail');
            const rail = document.querySelector('[data-v6-internal-rail]');
            const railStyle = rail ? getComputedStyle(rail) : null;
            const statement = document.querySelector(
                '[data-v6-statement-band]'
            );
            return {
                detailCols: detail
                    ? getComputedStyle(detail).gridTemplateColumns
                    : '',
                railPosition: railStyle ? railStyle.position : '',
                statementCols: statement
                    ? getComputedStyle(statement).gridTemplateColumns
                    : '',
            };
        });

        await gotoStable(mobilePage, `${baseURL}/es/telemedicina/`);
        await waitForShellRuntime(mobilePage);
        const teleMobileRailPosition = await mobilePage.evaluate(() => {
            const rail = document.querySelector('[data-v6-internal-rail]');
            return rail ? getComputedStyle(rail).position : '';
        });

        await gotoStable(mobilePage, `${baseURL}/es/legal/terminos/`);
        await waitForShellRuntime(mobilePage);
        await mobilePage.screenshot({
            path: path.join(screenshotDir, 'legal-es-mobile.png'),
            fullPage: false,
        });
        const legalMobileCols = await mobilePage.evaluate(() => {
            const sections = document.querySelector('.v6-legal-sections');
            return sections
                ? getComputedStyle(sections).gridTemplateColumns
                : '';
        });

        addCheck(
            checks,
            'VC-01',
            'data-v6-header exists',
            desktopHome.hasHeader
        );
        addCheck(
            checks,
            'VC-02',
            'header uses a dark editorial shell',
            (() => {
                const rgb = parseRgb(desktopHome.headerRgb);
                return Boolean(
                    rgb && rgb[0] <= 18 && rgb[1] <= 24 && rgb[2] <= 36
                );
            })(),
            { headerRgb: desktopHome.headerRgb }
        );
        addCheck(
            checks,
            'VC-03',
            'header height range',
            desktopHome.headerHeight >= 68 && desktopHome.headerHeight <= 96,
            { headerHeight: desktopHome.headerHeight }
        );
        addCheck(
            checks,
            'VC-04',
            'logo stays visible in mixed case display style',
            desktopHome.logoText.trim().length > 0 &&
                desktopHome.logoTransform !== 'uppercase',
            {
                logoTransform: desktopHome.logoTransform,
            }
        );
        addCheck(
            checks,
            'VC-05',
            'desktop nav keeps 5 focused items',
            desktopHome.navCount === 5,
            { navItems: desktopHome.navCount }
        );
        addCheck(
            checks,
            'VC-06',
            'contact action visible',
            desktopHome.hasContact
        );
        addCheck(
            checks,
            'VC-07',
            'search action visible',
            desktopHome.hasSearch
        );
        addCheck(
            checks,
            'VC-08',
            'language switch control present',
            desktopHub.hasLangControl
        );
        addCheck(
            checks,
            'VC-09',
            'data-v6-mega hidden by default',
            desktopHome.hasMega && desktopHome.megaHidden === true
        );
        addCheck(checks, 'VC-10', 'mega opens on primary trigger', megaOpen);
        addCheck(checks, 'VC-11', 'mega closes on Escape', megaClosedEsc);
        addCheck(
            checks,
            'VC-12',
            'mega has category columns',
            desktopHome.megaColumns >= 3,
            { megaColumns: desktopHome.megaColumns }
        );
        addCheck(checks, 'VC-13', 'mobile drawer exists', hasDrawer > 0);
        addCheck(
            checks,
            'VC-14',
            'mobile drawer locks body scroll',
            bodyOverflow === 'hidden',
            { bodyOverflow }
        );
        addCheck(
            checks,
            'VC-15',
            'focus styles visible',
            /outline/.test(
                fs.readFileSync(
                    path.join(
                        ROOT,
                        'src/apps/astro/src/styles/public-v6/components.css'
                    ),
                    'utf8'
                )
            )
        );
        addCheck(
            checks,
            'VC-16',
            'home hero data-v6-hero exists',
            desktopHome.hasHero
        );
        addCheck(
            checks,
            'VC-17',
            'hero 3 panels visible desktop',
            desktopHome.visibleSlideCount === 3,
            { visibleSlideCount: desktopHome.visibleSlideCount }
        );
        addCheck(
            checks,
            'VC-18',
            'center panel prioritized',
            desktopHome.centerWider
        );
        addCheck(
            checks,
            'VC-19',
            'side panels partially de-emphasized',
            desktopHome.sideSlideOpacityMin < 1,
            { sideSlideOpacityMin: desktopHome.sideSlideOpacityMin }
        );
        addCheck(
            checks,
            'VC-20',
            'slides expose data-v6-slide',
            desktopHome.hasSlideContract
        );
        addCheck(
            checks,
            'VC-21',
            'hero play overlay circular',
            desktopHome.playIsCircle
        );
        addCheck(
            checks,
            'VC-22',
            'hero blur band present',
            desktopHome.bandHasBlur
        );
        addCheck(
            checks,
            'VC-23',
            'band includes category/title/description',
            desktopHome.bandTexts.category.trim().length > 0 &&
                desktopHome.bandTexts.title.trim().length > 0 &&
                desktopHome.bandTexts.description.trim().length > 0
        );
        addCheck(
            checks,
            'VC-24',
            'hero controls prev/next/toggle',
            desktopHome.controls.prev &&
                desktopHome.controls.next &&
                desktopHome.controls.toggle
        );
        addCheck(
            checks,
            'VC-25',
            'hero indicators >= 4',
            desktopHome.indicators >= 4,
            { indicators: desktopHome.indicators }
        );
        addCheck(
            checks,
            'VC-26',
            'autoplay 7s and advances',
            desktopHome.autoplayMs >= 6500 &&
                desktopHome.autoplayMs <= 7500 &&
                activeIndexAfterAuto !== activeIndexBeforeAuto,
            {
                autoplayMs: desktopHome.autoplayMs,
                before: activeIndexBeforeAuto,
                after: activeIndexAfterAuto,
            }
        );
        addCheck(
            checks,
            'VC-27',
            'pause state toggles and stops advance',
            pausedState === 'paused' && pausedIndexBefore === pausedIndexAfter,
            {
                pausedState,
                before: pausedIndexBefore,
                after: pausedIndexAfter,
            }
        );
        addCheck(
            checks,
            'VC-28',
            'keyboard left/right navigation',
            indexAfterRight !== indexAfterLeft,
            {
                indexAfterRight,
                indexAfterLeft,
            }
        );
        addCheck(
            checks,
            'VC-29',
            'hero ratio in desktop viewport',
            desktopHome.heroRatio >= 0.38 && desktopHome.heroRatio <= 0.62,
            { heroRatio: desktopHome.heroRatio }
        );
        addCheck(
            checks,
            'VC-30',
            'center panel wider than sides',
            desktopHome.centerWider
        );
        addCheck(
            checks,
            'VC-95',
            'active indicator runs timed progress animation in playing state',
            desktopHome.hasIndicatorFill &&
                desktopHome.activeIndicatorProgressing &&
                desktopHome.activeIndicatorFillTransform !==
                    activeIndicatorFillTransformAfterTick &&
                desktopHome.activeIndicatorTrackWidth >= 50,
            {
                hasIndicatorFill: desktopHome.hasIndicatorFill,
                activeIndicatorProgressing:
                    desktopHome.activeIndicatorProgressing,
                activeIndicatorFillTransformBefore:
                    desktopHome.activeIndicatorFillTransform,
                activeIndicatorFillTransformAfterTick,
                activeIndicatorTrackWidth:
                    desktopHome.activeIndicatorTrackWidth,
            }
        );
        addCheck(
            checks,
            'VC-96',
            'pause stops indicator progress and resume restores it',
            pausedIndicatorProgressing === false &&
                resumedState === 'playing' &&
                resumedIndicatorProgressing === true,
            {
                pausedIndicatorProgressing,
                resumedState,
                resumedIndicatorProgressing,
            }
        );
        addCheck(
            checks,
            'VC-31',
            'news strip exists below hero',
            desktopHome.newsExists && desktopHome.newsY > desktopHome.heroY,
            {
                newsY: desktopHome.newsY,
                heroY: desktopHome.heroY,
            }
        );
        addCheck(
            checks,
            'VC-32',
            'news strip has 2 columns desktop',
            countGridColumns(desktopHome.newsGridCols) >= 2,
            { newsGridCols: desktopHome.newsGridCols }
        );
        addCheck(
            checks,
            'VC-33',
            'news left editorial label',
            desktopHome.newsLeftLabel.trim().length > 0
        );
        addCheck(
            checks,
            'VC-34',
            'news right headline/link',
            desktopHome.newsRightHeadline.trim().length > 0
        );
        addCheck(
            checks,
            'VC-35',
            'news language switch right aligned',
            desktopHome.newsHasLang && desktopHome.langAlignedRight
        );
        addCheck(
            checks,
            'VC-36',
            'editorial atmospheric section exists',
            desktopHome.editorialExists
        );
        addCheck(
            checks,
            'VC-37',
            'editorial glow/multilayer gradient',
            (desktopHome.editorialBgImage.match(/gradient/gi) || []).length >=
                2,
            {
                editorialBgImage: desktopHome.editorialBgImage,
            }
        );
        addCheck(
            checks,
            'VC-38',
            'editorial grid 2 columns desktop',
            countGridColumns(desktopHome.editorialGridCols) === 2,
            { editorialGridCols: desktopHome.editorialGridCols }
        );
        addCheck(
            checks,
            'VC-39',
            'editorial grid 1 column mobile',
            countGridColumns(mobileGridCols) === 1,
            { mobileGridCols }
        );
        addCheck(
            checks,
            'VC-40',
            'video card play icon present',
            desktopHome.hasVideoPlayIcon
        );
        addCheck(
            checks,
            'VC-41',
            'info card fields complete',
            desktopHome.hasInfoCardFields
        );
        addCheck(
            checks,
            'VC-42',
            'editorial cards = 3 master routes',
            desktopHome.editorialCount === 3,
            { editorialCount: desktopHome.editorialCount }
        );
        addCheck(
            checks,
            'VC-43',
            'editorial masonry height variation',
            desktopHome.uniqueEditorialHeights.length >= 2,
            {
                uniqueEditorialHeights: desktopHome.uniqueEditorialHeights,
            }
        );
        addCheck(
            checks,
            'VC-44',
            'hover subtle transform',
            String(desktopHome.cardTransition).includes('transform') &&
                transformBeforeHover !== transformAfterHover,
            {
                transformBeforeHover,
                transformAfterHover,
            }
        );
        addCheck(
            checks,
            'VC-45',
            'internal page head with breadcrumb + h1',
            desktopHub.hasPageHead &&
                desktopHub.crumbCount >= 2 &&
                desktopHub.title.trim().length > 0,
            {
                crumbCount: desktopHub.crumbCount,
                title: desktopHub.title,
            }
        );
        addCheck(
            checks,
            'VC-46',
            'internal hero full-bleed',
            desktopHub.heroFullBleed
        );
        addCheck(
            checks,
            'VC-47',
            'internal max-width controlled',
            desktopHub.contentWidth >= 1180 && desktopHub.contentWidth <= 1360,
            {
                contentWidth: desktopHub.contentWidth,
            }
        );
        addCheck(
            checks,
            'VC-48',
            'hub/service grid >= 3 columns desktop',
            countGridColumns(desktopHub.firstGridCols) >= 3,
            {
                firstGridCols: desktopHub.firstGridCols,
            }
        );
        addCheck(
            checks,
            'VC-49',
            'cards include image + metadata + cta',
            desktopHub.firstHasImage && desktopHub.firstHasMeta
        );
        addCheck(
            checks,
            'VC-50',
            'fixed back-to-top with visibility state',
            desktopHome.hasBackTop && desktopHome.backTopFixed && backTopVisible
        );
        addCheck(
            checks,
            'VC-51',
            'telemedicine KPI tiles = 3',
            desktopTele.kpiCards === 3,
            { kpiCards: desktopTele.kpiCards }
        );
        addCheck(
            checks,
            'VC-52',
            'telemedicine initiatives >= 4 with full card fields',
            desktopTele.initiativesCount >= 4 &&
                desktopTele.firstInitiativeFields,
            {
                initiativesCount: desktopTele.initiativesCount,
                firstInitiativeFields: desktopTele.firstInitiativeFields,
            }
        );
        addCheck(
            checks,
            'VC-53',
            'tele lead block wider than standard card',
            desktopTele.leadWidth > desktopTele.regularWidth * 1.5 &&
                countGridColumns(desktopTele.teleGridCols) >= 2,
            {
                leadWidth: desktopTele.leadWidth,
                regularWidth: desktopTele.regularWidth,
                teleGridCols: desktopTele.teleGridCols,
            }
        );
        addCheck(checks, 'VC-54', 'legal tabs >= 4', desktopLegal.tabs >= 4, {
            tabs: desktopLegal.tabs,
        });
        addCheck(
            checks,
            'VC-55',
            'legal section cards >= 2 with clause rows',
            desktopLegal.legalSections >= 2 &&
                desktopLegal.firstLegalClauses >= 2,
            {
                legalSections: desktopLegal.legalSections,
                firstLegalClauses: desktopLegal.firstLegalClauses,
            }
        );
        addCheck(
            checks,
            'VC-56',
            'legal policy index cards >= 4 with image and metadata',
            desktopLegal.legalIndexCards >= 4 && desktopLegal.firstIndexFields,
            {
                legalIndexCards: desktopLegal.legalIndexCards,
                firstIndexFields: desktopLegal.firstIndexFields,
            }
        );
        addCheck(
            checks,
            'VC-57',
            'hub initiatives block exists',
            desktopHub.hasHubInitiatives
        );
        addCheck(
            checks,
            'VC-58',
            'hub initiatives cards >= 8',
            desktopHub.initiativesCardsCount >= 8,
            { initiativesCardsCount: desktopHub.initiativesCardsCount }
        );
        addCheck(
            checks,
            'VC-59',
            'hub initiatives grid has 4 columns desktop',
            countGridColumns(desktopHub.initiativesGridCols) === 4,
            { initiativesGridCols: desktopHub.initiativesGridCols }
        );
        addCheck(
            checks,
            'VC-60',
            'hub initiative card fields complete',
            desktopHub.firstInitiativeFields,
            { firstInitiativeFields: desktopHub.firstInitiativeFields }
        );
        addCheck(
            checks,
            'VC-61',
            'hub page menu links to initiatives',
            desktopHub.pageMenuLinksCount >= 4 &&
                desktopHub.hasInitiativesMenuLink,
            {
                pageMenuLinksCount: desktopHub.pageMenuLinksCount,
                hasInitiativesMenuLink: desktopHub.hasInitiativesMenuLink,
            }
        );
        addCheck(
            checks,
            'VC-62',
            'hub initiatives grid 1 column mobile',
            countGridColumns(hubMobileInitiativesCols) === 1,
            { hubMobileInitiativesCols }
        );
        addCheck(
            checks,
            'VC-63',
            'service page head height in corporate band range',
            desktopService.pageHeadHeight >= 120 &&
                desktopService.pageHeadHeight <= 240,
            { pageHeadHeight: desktopService.pageHeadHeight }
        );
        addCheck(
            checks,
            'VC-64',
            'internal hero ratio in viewport range',
            desktopService.heroRatio >= 0.34 &&
                desktopService.heroRatio <= 0.58,
            { heroRatio: desktopService.heroRatio }
        );
        addCheck(
            checks,
            'VC-65',
            'internal message exists with centered width and narrative density',
            desktopService.hasInternalMessage &&
                desktopService.internalMessageWidth >= 900 &&
                desktopService.internalMessageWidth <= 1110 &&
                desktopService.internalMessageTextLength >= 120 &&
                desktopTele.internalMessageTextLength >= 120,
            {
                internalMessageWidth: desktopService.internalMessageWidth,
                serviceMessageTextLength:
                    desktopService.internalMessageTextLength,
                teleMessageTextLength: desktopTele.internalMessageTextLength,
            }
        );
        addCheck(
            checks,
            'VC-66',
            'service detail grid keeps 2 columns desktop with expanded gap',
            countGridColumns(desktopService.detailCols) === 2 &&
                Number.parseFloat(desktopService.detailGap || '0') >= 24,
            {
                detailCols: desktopService.detailCols,
                detailGap: desktopService.detailGap,
            }
        );
        addCheck(
            checks,
            'VC-67',
            'tele initiatives cards keep editorial min-height >= 340px',
            desktopTele.initiativeHeights.length >= 4 &&
                desktopTele.initiativeHeights.every((value) => value >= 340),
            { initiativeHeights: desktopTele.initiativeHeights }
        );
        addCheck(
            checks,
            'VC-68',
            'legal tabs are sticky with top offset aligned to header',
            desktopLegal.tabsPosition === 'sticky' &&
                desktopLegal.tabsTop >= 68 &&
                desktopLegal.tabsTop <= 90,
            {
                tabsPosition: desktopLegal.tabsPosition,
                tabsTop: desktopLegal.tabsTop,
            }
        );
        addCheck(
            checks,
            'VC-69',
            'legal clause numbering uses two-digit markers',
            /^[0-9]{2}$/.test(desktopLegal.firstClauseLabel),
            { firstClauseLabel: desktopLegal.firstClauseLabel }
        );
        addCheck(
            checks,
            'VC-70',
            'service/legal grids collapse to one column on mobile',
            countGridColumns(serviceMobile.detailCols) === 1 &&
                countGridColumns(legalMobileCols) === 1,
            {
                serviceMobileCols: serviceMobile.detailCols,
                legalMobileCols,
            }
        );
        addCheck(
            checks,
            'VC-71',
            'hub featured block exists',
            desktopHub.hasHubFeatured
        );
        addCheck(
            checks,
            'VC-72',
            'hub featured cards = 3',
            desktopHub.featuredCardsCount === 3,
            { featuredCardsCount: desktopHub.featuredCardsCount }
        );
        addCheck(
            checks,
            'VC-73',
            'hub featured grid has 3 columns desktop',
            countGridColumns(desktopHub.featuredGridCols) === 3,
            { featuredGridCols: desktopHub.featuredGridCols }
        );
        addCheck(
            checks,
            'VC-74',
            'hub featured card fields complete',
            desktopHub.firstFeaturedFields,
            { firstFeaturedFields: desktopHub.firstFeaturedFields }
        );
        addCheck(
            checks,
            'VC-75',
            'hub page menu links to featured block',
            desktopHub.pageMenuLinksCount >= 5 &&
                desktopHub.hasFeaturedMenuLink,
            {
                pageMenuLinksCount: desktopHub.pageMenuLinksCount,
                hasFeaturedMenuLink: desktopHub.hasFeaturedMenuLink,
            }
        );
        addCheck(
            checks,
            'VC-76',
            'hub featured media keeps high visual presence',
            desktopHub.firstFeaturedImageHeight >= 220,
            { firstFeaturedImageHeight: desktopHub.firstFeaturedImageHeight }
        );
        addCheck(
            checks,
            'VC-77',
            'hub featured grid 1 column mobile',
            countGridColumns(hubMobileFeaturedCols) === 1,
            { hubMobileFeaturedCols }
        );
        addCheck(
            checks,
            'VC-78',
            'hub featured block appears before catalog stream',
            desktopHub.featuredBeforeCatalog,
            { featuredBeforeCatalog: desktopHub.featuredBeforeCatalog }
        );
        addCheck(
            checks,
            'VC-79',
            'service internal rail sticky with route anchors',
            desktopService.railPosition === 'sticky' &&
                desktopService.railTop >= 140 &&
                desktopService.railTop <= 180 &&
                desktopService.railLinks >= 5,
            {
                railPosition: desktopService.railPosition,
                railTop: desktopService.railTop,
                railLinks: desktopService.railLinks,
            }
        );
        addCheck(
            checks,
            'VC-80',
            'tele internal rail sticky with flow anchors',
            desktopTele.railPosition === 'sticky' &&
                desktopTele.railTop >= 140 &&
                desktopTele.railTop <= 180 &&
                desktopTele.railLinks >= 6,
            {
                railPosition: desktopTele.railPosition,
                railTop: desktopTele.railTop,
                railLinks: desktopTele.railLinks,
            }
        );
        addCheck(
            checks,
            'VC-81',
            'service thesis block exists',
            desktopService.hasThesis
        );
        addCheck(
            checks,
            'VC-82',
            'tele thesis block exists',
            desktopTele.hasThesis
        );
        addCheck(
            checks,
            'VC-83',
            'legal thesis block exists',
            desktopLegal.hasThesis
        );
        addCheck(
            checks,
            'VC-84',
            'internal thesis width and density in range',
            desktopService.thesisWidth >= 900 &&
                desktopService.thesisWidth <= 1120 &&
                desktopService.thesisTextLength >= 150 &&
                desktopTele.thesisWidth >= 900 &&
                desktopTele.thesisWidth <= 1120 &&
                desktopTele.thesisTextLength >= 150 &&
                desktopLegal.thesisWidth >= 900 &&
                desktopLegal.thesisWidth <= 1120 &&
                desktopLegal.thesisTextLength >= 150,
            {
                serviceThesisWidth: desktopService.thesisWidth,
                serviceThesisTextLength: desktopService.thesisTextLength,
                teleThesisWidth: desktopTele.thesisWidth,
                teleThesisTextLength: desktopTele.thesisTextLength,
                legalThesisWidth: desktopLegal.thesisWidth,
                legalThesisTextLength: desktopLegal.thesisTextLength,
            }
        );
        addCheck(
            checks,
            'VC-85',
            'service and tele rails become non-sticky on mobile',
            serviceMobile.railPosition === 'static' &&
                teleMobileRailPosition === 'static',
            {
                serviceRailPosition: serviceMobile.railPosition,
                teleRailPosition: teleMobileRailPosition,
            }
        );
        addCheck(
            checks,
            'VC-86',
            'internal shell keeps 2 columns desktop for service and tele',
            countGridColumns(desktopService.shellCols) === 2 &&
                countGridColumns(desktopTele.shellCols) === 2,
            {
                serviceShellCols: desktopService.shellCols,
                teleShellCols: desktopTele.shellCols,
            }
        );
        addCheck(
            checks,
            'VC-87',
            'service statement band includes media and narrative fields',
            desktopService.hasStatement &&
                desktopService.statementHasImage &&
                desktopService.statementHasFields,
            {
                hasStatement: desktopService.hasStatement,
                statementHasImage: desktopService.statementHasImage,
                statementHasFields: desktopService.statementHasFields,
            }
        );
        addCheck(
            checks,
            'VC-88',
            'tele statement band includes media and narrative fields',
            desktopTele.hasStatement &&
                desktopTele.statementHasImage &&
                desktopTele.statementHasFields,
            {
                hasStatement: desktopTele.hasStatement,
                statementHasImage: desktopTele.statementHasImage,
                statementHasFields: desktopTele.statementHasFields,
            }
        );
        addCheck(
            checks,
            'VC-89',
            'legal statement band includes media and narrative fields',
            desktopLegal.hasStatement &&
                desktopLegal.statementHasImage &&
                desktopLegal.statementHasFields,
            {
                hasStatement: desktopLegal.hasStatement,
                statementHasImage: desktopLegal.statementHasImage,
                statementHasFields: desktopLegal.statementHasFields,
            }
        );
        addCheck(
            checks,
            'VC-90',
            'statement band keeps 2 columns desktop and 1 column mobile',
            countGridColumns(desktopService.statementCols) === 2 &&
                countGridColumns(desktopTele.statementCols) === 2 &&
                countGridColumns(desktopLegal.statementCols) === 2 &&
                countGridColumns(serviceMobile.statementCols) === 1,
            {
                serviceDesktopCols: desktopService.statementCols,
                teleDesktopCols: desktopTele.statementCols,
                legalDesktopCols: desktopLegal.statementCols,
                serviceMobileCols: serviceMobile.statementCols,
            }
        );
        addCheck(
            checks,
            'VC-91',
            'mega menu uses two-panel layout on desktop',
            countGridColumns(megaRuntime.layoutCols) === 2 &&
                megaRuntime.tabCount >= 3,
            {
                layoutCols: megaRuntime.layoutCols,
                tabCount: megaRuntime.tabCount,
            }
        );
        addCheck(
            checks,
            'VC-92',
            'mega category hover switches active detail panel',
            megaRuntime.activeColumnId === 'entry-routes' &&
                megaActiveAfterHover === 'procedures',
            {
                activeColumnStart: megaRuntime.activeColumnId,
                activeColumnAfterHover: megaActiveAfterHover,
            }
        );
        addCheck(
            checks,
            'VC-93',
            'active mega detail includes context block fields',
            megaRuntime.contextFields,
            { contextFields: megaRuntime.contextFields }
        );
        addCheck(
            checks,
            'VC-94',
            'mega category keyboard arrow switches active detail panel',
            megaActiveAfterArrow === 'procedures',
            { activeColumnAfterArrow: megaActiveAfterArrow }
        );
        addCheck(
            checks,
            'VC-97',
            'mega backdrop exists and is hidden by default',
            desktopHome.hasMegaBackdrop &&
                desktopHome.megaBackdropHidden === true,
            {
                hasMegaBackdrop: desktopHome.hasMegaBackdrop,
                megaBackdropHidden: desktopHome.megaBackdropHidden,
            }
        );
        addCheck(
            checks,
            'VC-98',
            'opening mega toggles backdrop and header open state',
            megaOpen &&
                megaRuntime.backdropVisible &&
                megaRuntime.headerMegaOpen,
            {
                megaOpen,
                backdropVisible: megaRuntime.backdropVisible,
                headerMegaOpen: megaRuntime.headerMegaOpen,
            }
        );
        addCheck(
            checks,
            'VC-99',
            'mega backdrop click closes panel and backdrop',
            megaClosedBackdrop && megaBackdropHiddenBackdrop,
            {
                megaClosedBackdrop,
                megaBackdropHiddenBackdrop,
            }
        );
        addCheck(
            checks,
            'VC-100',
            'mega backdrop aligns with header bottom and stays hidden after Escape',
            Math.abs(megaRuntime.backdropTop - megaRuntime.headerHeight) <= 4 &&
                megaClosedEsc &&
                megaBackdropHiddenEsc,
            {
                backdropTop: megaRuntime.backdropTop,
                headerHeight: megaRuntime.headerHeight,
                megaClosedEsc,
                megaBackdropHiddenEsc,
            }
        );
        addCheck(
            checks,
            'VC-101',
            'internal page tools expose language switch and page menu controls',
            desktopHub.hasPageTools &&
                desktopHub.hasLangControl &&
                desktopHub.hasPageMenuButton &&
                desktopHub.pageMenuPanelHasLinks,
            {
                hasPageTools: desktopHub.hasPageTools,
                hasLangControl: desktopHub.hasLangControl,
                hasPageMenuButton: desktopHub.hasPageMenuButton,
                pageMenuPanelHasLinks: desktopHub.pageMenuPanelHasLinks,
            }
        );
        addCheck(
            checks,
            'VC-102',
            'page menu click toggles expanded state and opens panel',
            hubMenuOpen.buttonExpanded && hubMenuOpen.panelVisible,
            hubMenuOpen
        );
        addCheck(
            checks,
            'VC-103',
            'page menu keyboard open focuses first link and Escape returns focus',
            hubMenuKeyboard.firstLinkFocused &&
                hubMenuKeyboard.panelVisible &&
                hubMenuEsc.panelHidden &&
                !hubMenuEsc.buttonExpanded &&
                hubMenuEsc.focusReturned,
            {
                hubMenuKeyboard,
                hubMenuEsc,
            }
        );
        addCheck(
            checks,
            'VC-104',
            'page tools keep editorial geometry for language and menu button',
            desktopHub.toolsRightAligned &&
                desktopHub.langHasSlash &&
                desktopHub.langFontSize >= 11 &&
                desktopHub.langFontSize <= 14.5 &&
                desktopHub.pageMenuButtonHeight >= 24 &&
                desktopHub.pageMenuButtonHeight <= 34 &&
                desktopHub.pageMenuButtonWidth >= 44 &&
                desktopHub.pageMenuButtonWidth <= 110,
            {
                toolsRightAligned: desktopHub.toolsRightAligned,
                langHasSlash: desktopHub.langHasSlash,
                langFontSize: desktopHub.langFontSize,
                pageMenuButtonHeight: desktopHub.pageMenuButtonHeight,
                pageMenuButtonWidth: desktopHub.pageMenuButtonWidth,
            }
        );

        await desktop.close();
        await mobile.close();
    } finally {
        if (browser) {
            await browser.close().catch(() => null);
        }
        await stopLocalPublicServer(localServer).catch(() => null);
    }

    const passed = checks.filter((item) => item.pass).length;
    const failed = checks.filter((item) => !item.pass);
    const result = {
        ok: passed >= minCheckpoints && (!strict || failed.length === 0),
        passed,
        total: checks.length,
        minCheckpoints,
        strict,
        runtime: {
            base_url: baseURL,
            source: runtimeSource,
        },
        checks,
        failed,
        evidence: {
            screenshots: [
                'verification/public-v6-screenshots/home-es-desktop.png',
                'verification/public-v6-screenshots/home-es-mobile.png',
                'verification/public-v6-screenshots/hub-es-desktop.png',
                'verification/public-v6-screenshots/hub-es-mobile.png',
                'verification/public-v6-screenshots/service-es-desktop.png',
                'verification/public-v6-screenshots/service-es-mobile.png',
                'verification/public-v6-screenshots/tele-es-desktop.png',
                'verification/public-v6-screenshots/legal-es-desktop.png',
                'verification/public-v6-screenshots/legal-es-mobile.png',
            ],
        },
    };

    fs.writeFileSync(
        path.join(auditDir, 'visual-contract.json'),
        `${JSON.stringify(result, null, 2)}\n`,
        'utf8'
    );

    const markdown = [
        '# Public V6 Visual Contract Audit (Runtime Geometry)',
        '',
        `- Passed: **${passed}/${checks.length}**`,
        `- Minimum required: **${minCheckpoints}**`,
        `- Strict mode: **${strict ? 'on' : 'off'}**`,
        `- Runtime base URL: **${baseURL}**`,
        `- Runtime source: **${runtimeSource}**`,
        `- Status: **${result.ok ? 'PASS' : 'FAIL'}**`,
        '',
        '## Evidence',
        '',
        '- `verification/public-v6-screenshots/home-es-desktop.png`',
        '- `verification/public-v6-screenshots/home-es-mobile.png`',
        '- `verification/public-v6-screenshots/hub-es-desktop.png`',
        '- `verification/public-v6-screenshots/hub-es-mobile.png`',
        '- `verification/public-v6-screenshots/service-es-desktop.png`',
        '- `verification/public-v6-screenshots/service-es-mobile.png`',
        '- `verification/public-v6-screenshots/tele-es-desktop.png`',
        '- `verification/public-v6-screenshots/legal-es-desktop.png`',
        '- `verification/public-v6-screenshots/legal-es-mobile.png`',
        '',
        '## Checkpoints',
        '',
        '| ID | Result | Description |',
        '|---|---|---|',
        ...checks.map(
            (check) =>
                `| ${check.id} | ${check.pass ? 'PASS' : 'FAIL'} | ${check.desc} |`
        ),
        '',
    ].join('\n');

    fs.writeFileSync(
        path.join(auditDir, 'visual-contract.md'),
        `${markdown}\n`,
        'utf8'
    );

    if (!result.ok) {
        console.error(JSON.stringify(result, null, 2));
        process.exit(1);
    }

    console.log(
        JSON.stringify({ ok: true, passed, total: checks.length }, null, 2)
    );
}

run().catch((error) => {
    const outDir = path.join(ROOT, 'verification', 'public-v6-audit');
    fs.mkdirSync(outDir, { recursive: true });
    const payload = {
        ok: false,
        error: error && error.message ? error.message : String(error),
    };
    fs.writeFileSync(
        path.join(outDir, 'visual-contract.json'),
        `${JSON.stringify(payload, null, 2)}\n`,
        'utf8'
    );
    console.error(JSON.stringify(payload, null, 2));
    process.exit(1);
});
