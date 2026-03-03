(function () {
    'use strict';

    function bootHeroStage() {
        var roots = Array.from(
            document.querySelectorAll('[data-stage-carousel]')
        );
        roots.forEach(function (root) {
            if (!root || root.dataset.stageReady === 'true') return;
            root.dataset.stageReady = 'true';

            var slides = Array.from(
                root.querySelectorAll('[data-stage-slide]')
            );
            var triggers = Array.from(
                root.querySelectorAll('[data-stage-trigger]')
            );
            if (!slides.length) return;

            var prevButton = root.querySelector('[data-stage-prev]');
            var nextButton = root.querySelector('[data-stage-next]');
            var toggleButton = root.querySelector('[data-stage-toggle]');
            var autoplayMs = Number(
                root.getAttribute('data-stage-autoplay-ms') || 7000
            );
            if (!Number.isFinite(autoplayMs) || autoplayMs < 2000) {
                autoplayMs = 7000;
            }

            var current = slides.findIndex(function (slide) {
                return slide.classList.contains('is-active');
            });
            if (current < 0) current = 0;

            var timer = null;
            var paused = false;
            var focusableSelector =
                'a[href], button, input, select, textarea, [tabindex]';

            var syncSlideInteractivity = function (slide, isActive) {
                if (!slide) return;
                if (isActive) {
                    slide.removeAttribute('inert');
                } else {
                    slide.setAttribute('inert', '');
                }

                Array.from(slide.querySelectorAll(focusableSelector)).forEach(
                    function (node) {
                        var previous = node.getAttribute(
                            'data-stage-prev-tabindex'
                        );

                        if (isActive) {
                            if (previous !== null) {
                                if (previous) {
                                    node.setAttribute('tabindex', previous);
                                } else {
                                    node.removeAttribute('tabindex');
                                }
                                node.removeAttribute(
                                    'data-stage-prev-tabindex'
                                );
                            }
                            return;
                        }

                        if (previous === null) {
                            var current = node.getAttribute('tabindex');
                            node.setAttribute(
                                'data-stage-prev-tabindex',
                                current === null ? '' : current
                            );
                        }
                        node.setAttribute('tabindex', '-1');
                    }
                );
            };

            var syncState = function () {
                var state = paused ? 'paused' : 'playing';
                root.setAttribute('data-stage-state', state);
                root.dataset.stageState = state;

                if (!toggleButton) return;

                var ariaPlaying =
                    toggleButton.getAttribute('data-stage-label-playing') ||
                    'Pause autoplay';
                var ariaPaused =
                    toggleButton.getAttribute('data-stage-label-paused') ||
                    'Resume autoplay';
                var textPlaying =
                    toggleButton.getAttribute('data-stage-text-playing') ||
                    'Pause';
                var textPaused =
                    toggleButton.getAttribute('data-stage-text-paused') ||
                    'Play';

                toggleButton.setAttribute('data-stage-state', state);
                toggleButton.dataset.stageState = state;
                toggleButton.setAttribute(
                    'aria-label',
                    paused ? ariaPaused : ariaPlaying
                );
                toggleButton.setAttribute(
                    'aria-pressed',
                    paused ? 'true' : 'false'
                );
                toggleButton.textContent = paused ? textPaused : textPlaying;
            };

            var activate = function (index) {
                if (!slides.length) return;
                var nextIndex = index;
                if (nextIndex < 0) {
                    nextIndex = slides.length - 1;
                }
                if (nextIndex >= slides.length) {
                    nextIndex = 0;
                }

                current = nextIndex;
                slides.forEach(function (slide, slideIndex) {
                    var isActive = slideIndex === nextIndex;
                    slide.classList.toggle('is-active', isActive);
                    slide.hidden = !isActive;
                    slide.setAttribute(
                        'aria-hidden',
                        isActive ? 'false' : 'true'
                    );
                    syncSlideInteractivity(slide, isActive);
                });
                triggers.forEach(function (trigger, triggerIndex) {
                    var isActive = triggerIndex === nextIndex;
                    trigger.classList.toggle('is-active', isActive);
                    if (isActive) {
                        trigger.setAttribute('aria-current', 'true');
                    } else {
                        trigger.removeAttribute('aria-current');
                    }
                });
            };

            var stopAutoplay = function () {
                if (timer === null) return;
                window.clearInterval(timer);
                timer = null;
            };

            var startAutoplay = function () {
                stopAutoplay();
                if (paused || slides.length < 2) return;
                timer = window.setInterval(function () {
                    activate(current + 1);
                }, autoplayMs);
            };

            triggers.forEach(function (trigger, index) {
                trigger.addEventListener('click', function () {
                    activate(index);
                    startAutoplay();
                });
            });

            if (prevButton) {
                prevButton.addEventListener('click', function () {
                    activate(current - 1);
                    startAutoplay();
                });
            }

            if (nextButton) {
                nextButton.addEventListener('click', function () {
                    activate(current + 1);
                    startAutoplay();
                });
            }

            if (toggleButton) {
                toggleButton.addEventListener('click', function () {
                    paused = !paused;
                    syncState();
                    if (paused) {
                        stopAutoplay();
                    } else {
                        startAutoplay();
                    }
                });
            }

            if (slides.length < 2) {
                paused = true;
                if (prevButton) prevButton.disabled = true;
                if (nextButton) nextButton.disabled = true;
                if (toggleButton) toggleButton.disabled = true;
            }

            activate(current);
            syncState();
            startAutoplay();
        });
    }

    function bootFamilyTabs() {
        var url = new URL(window.location.href);
        var category = url.searchParams.get('category');
        document.querySelectorAll('[data-family-tabs]').forEach(function (nav) {
            if (!nav || nav.dataset.familyTabsReady === 'true') return;
            nav.dataset.familyTabsReady = 'true';
            if (category) {
                var link = nav.querySelector(
                    '[data-family-tab="' + category + '"]'
                );
                if (link) {
                    link.dataset.familyActive = 'true';
                    link.setAttribute('aria-current', 'page');
                }
            }

            nav.addEventListener('click', function (event) {
                var target =
                    event.target instanceof Element ? event.target : null;
                var tab = target ? target.closest('[data-family-tab]') : null;
                if (!tab) return;
                var nextCategory = String(
                    tab.getAttribute('data-family-tab') || ''
                ).trim();
                var nextUrl = new URL(window.location.href);
                if (nextCategory) {
                    nextUrl.searchParams.set('category', nextCategory);
                } else {
                    nextUrl.searchParams.delete('category');
                }
                window.history.replaceState({}, '', nextUrl.toString());
            });
        });
    }

    function bootServiceGrid() {
        var url = new URL(window.location.href);
        var category = url.searchParams.get('category');
        var intent = url.searchParams.get('intent');
        var audience = url.searchParams.get('audience');

        function hasToken(payload, token) {
            if (!token) return true;
            return (
                String(payload || '')
                    .split(',')
                    .map(function (value) {
                        return value.trim();
                    })
                    .filter(Boolean)
                    .indexOf(token) !== -1
            );
        }

        function applyFilters(
            root,
            currentCategory,
            currentIntent,
            currentAudience
        ) {
            if (!root) return;
            var cards = Array.from(
                root.querySelectorAll('[data-service-card]')
            );
            cards.forEach(function (card) {
                var matchesCategory =
                    !currentCategory ||
                    String(card.dataset.cardCategory || '') === currentCategory;
                var matchesIntent = hasToken(
                    card.dataset.cardIntents || '',
                    currentIntent
                );
                var matchesAudience = hasToken(
                    card.dataset.cardAudience || '',
                    currentAudience
                );
                var visible =
                    matchesCategory && matchesIntent && matchesAudience;
                card.hidden = !visible;
            });

            Array.from(root.querySelectorAll('[data-family-section]')).forEach(
                function (section) {
                    var visibleCards = section.querySelectorAll(
                        '[data-service-card]:not([hidden])'
                    );
                    section.hidden = visibleCards.length === 0;
                    if (
                        !section.hidden &&
                        currentCategory &&
                        section.getAttribute('data-family-section') ===
                            currentCategory
                    ) {
                        section.dataset.familyActive = 'true';
                    }
                }
            );
        }

        document
            .querySelectorAll('[data-services-grid]')
            .forEach(function (root) {
                if (!root || root.dataset.familyReady === 'true') return;
                root.dataset.familyReady = 'true';

                var filterIntent = root.querySelector('[data-filter-intent]');
                var filterAudience = root.querySelector(
                    '[data-filter-audience]'
                );

                if (filterIntent) {
                    filterIntent.value = intent || '';
                }
                if (filterAudience) {
                    filterAudience.value = audience || '';
                }

                function syncFilterQuery() {
                    var nextUrl = new URL(window.location.href);
                    var selectedIntent = filterIntent ? filterIntent.value : '';
                    var selectedAudience = filterAudience
                        ? filterAudience.value
                        : '';

                    if (selectedIntent) {
                        nextUrl.searchParams.set('intent', selectedIntent);
                    } else {
                        nextUrl.searchParams.delete('intent');
                    }
                    if (selectedAudience) {
                        nextUrl.searchParams.set('audience', selectedAudience);
                    } else {
                        nextUrl.searchParams.delete('audience');
                    }

                    window.history.replaceState({}, '', nextUrl.toString());
                    applyFilters(
                        root,
                        category,
                        selectedIntent,
                        selectedAudience
                    );
                }

                if (filterIntent) {
                    filterIntent.addEventListener('change', syncFilterQuery);
                }
                if (filterAudience) {
                    filterAudience.addEventListener('change', syncFilterQuery);
                }

                applyFilters(
                    root,
                    category,
                    filterIntent ? filterIntent.value : intent,
                    filterAudience ? filterAudience.value : audience
                );
            });
    }

    function bootCookieBanner() {
        var banner = document.getElementById('cookieBanner');
        if (!banner || banner.dataset.publicV3CookieReady === 'true') return;
        banner.dataset.publicV3CookieReady = 'true';

        var measurementId = 'G-GYY8PE5M8W';
        var storageKey = 'pa_cookie_consent_v1';

        function readConsent() {
            try {
                var raw = window.localStorage.getItem(storageKey);
                if (!raw) return '';
                var payload = JSON.parse(raw);
                return typeof payload.status === 'string' ? payload.status : '';
            } catch (_error) {
                return '';
            }
        }

        function writeConsent(status) {
            try {
                window.localStorage.setItem(
                    storageKey,
                    JSON.stringify({
                        status: status,
                        at: new Date().toISOString(),
                    })
                );
            } catch (_error) {
                // no-op
            }
        }

        function gtag() {
            window.dataLayer = window.dataLayer || [];
            if (typeof window.gtag !== 'function') {
                window.gtag = function () {
                    window.dataLayer.push(arguments);
                };
            }
            window.gtag.apply(null, arguments);
        }

        function updateVisibility() {
            var consent = readConsent();
            banner.classList.toggle(
                'active',
                consent !== 'accepted' && consent !== 'rejected'
            );
        }

        function ensureDefaultConsent() {
            if (window.__publicV3ConsentDefaultReady === true) return;
            window.__publicV3ConsentDefaultReady = true;
            gtag('consent', 'default', {
                analytics_storage: 'denied',
                ad_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied',
            });
        }

        function loadGa4() {
            if (window._ga4Loaded || readConsent() !== 'accepted') return;
            window._ga4Loaded = true;

            if (
                !document.querySelector(
                    'script[data-public-v3-ga4="' + measurementId + '"]'
                )
            ) {
                var script = document.createElement('script');
                script.async = true;
                script.src =
                    'https://www.googletagmanager.com/gtag/js?id=' +
                    measurementId;
                script.dataset.publicV3Ga4 = measurementId;
                document.head.appendChild(script);
            }

            gtag('js', new Date());
            gtag('consent', 'update', {
                analytics_storage: 'granted',
                ad_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied',
            });
            gtag('config', measurementId);
        }

        function applyConsent(status) {
            var normalized = status === 'accepted' ? 'accepted' : 'rejected';
            writeConsent(normalized);
            banner.classList.remove('active');
            gtag('consent', 'update', {
                analytics_storage:
                    normalized === 'accepted' ? 'granted' : 'denied',
                ad_storage: 'denied',
                ad_user_data: 'denied',
                ad_personalization: 'denied',
            });
            if (normalized === 'accepted') {
                loadGa4();
            }
        }

        ensureDefaultConsent();
        updateVisibility();
        if (readConsent() === 'accepted') {
            loadGa4();
        }

        banner.addEventListener('click', function (event) {
            var target = event.target instanceof Element ? event.target : null;
            if (!target) return;
            if (target.closest('#cookieAcceptBtn')) {
                event.preventDefault();
                applyConsent('accepted');
                return;
            }
            if (target.closest('#cookieRejectBtn')) {
                event.preventDefault();
                applyConsent('rejected');
            }
        });
    }

    function bootLegacyRuntimeBridge() {
        var root = document.documentElement;
        if (root.dataset.publicV3RuntimeReady === 'true') return;
        root.dataset.publicV3RuntimeReady = 'true';
        if (document.body) {
            document.body.dataset.publicShellVersion = 'v3';
        }

        var bootstrapHref = '/js/bootstrap-inline-engine.js?v=public-v4-bridge';
        var runtimeHref = '/script.js?v=public-v4-bridge';
        var booted = false;

        function applyServiceHint() {
            var booking = document.getElementById('citas');
            var select = document.getElementById('serviceSelect');
            if (!booking || !select) return;

            var url = new URL(window.location.href);
            var hint =
                url.searchParams.get('service') ||
                booking.dataset.serviceHint ||
                '';
            if (!hint) return;

            var match = Array.from(select.options || []).some(
                function (option) {
                    return String(option.value || '').trim() === hint;
                }
            );
            if (!match) return;

            select.value = hint;
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }

        function appendScript(src, type) {
            if (
                document.querySelector(
                    'script[data-public-v3-src="' + src + '"]'
                )
            )
                return;
            var script = document.createElement('script');
            script.src = src;
            script.dataset.publicV3Src = src;
            if (type === 'module') {
                script.type = 'module';
            } else {
                script.defer = true;
            }
            document.head.appendChild(script);
        }

        function boot() {
            if (booted) return;
            booted = true;
            root.dataset.publicV3RuntimeBooted = 'true';
            applyServiceHint();
            appendScript(bootstrapHref, 'classic');
            appendScript(runtimeHref, 'module');
        }

        function requestBoot() {
            if (document.readyState === 'complete') {
                window.setTimeout(boot, 0);
                return;
            }

            window.addEventListener(
                'load',
                function () {
                    window.setTimeout(boot, 0);
                },
                { once: true }
            );
        }

        function shouldBootImmediately() {
            var url = new URL(window.location.href);
            return url.hash === '#citas' || url.searchParams.has('service');
        }

        if (shouldBootImmediately()) {
            requestBoot();
            return;
        }

        var bookingMount = document.getElementById('citas');
        if (bookingMount && 'IntersectionObserver' in window) {
            var observer = new IntersectionObserver(
                function (entries) {
                    entries.forEach(function (entry) {
                        if (!entry.isIntersecting) return;
                        observer.disconnect();
                        requestBoot();
                    });
                },
                { rootMargin: '700px 0px' }
            );
            observer.observe(bookingMount);
        }

        document.addEventListener(
            'click',
            function (event) {
                var target =
                    event.target instanceof Element ? event.target : null;
                if (!target) return;
                if (
                    target.closest('a[href="#citas"]') ||
                    target.closest('[data-cta-target="booking"]') ||
                    target.closest('#chatbotWidget')
                ) {
                    requestBoot();
                }
            },
            true
        );

        document.addEventListener(
            'focusin',
            function (event) {
                var target =
                    event.target instanceof Element ? event.target : null;
                if (!target) return;
                if (target.closest('#citas')) {
                    requestBoot();
                }
            },
            true
        );

        window.setTimeout(requestBoot, 2600);
    }

    function bootChatFallback() {
        var widget = document.getElementById('chatbotWidget');
        var container = document.getElementById('chatbotContainer');
        if (
            !widget ||
            !container ||
            widget.dataset.publicV3ChatFallbackReady === 'true'
        ) {
            return;
        }

        widget.dataset.publicV3ChatFallbackReady = 'true';

        var syncState = function (open) {
            widget.classList.toggle('open', open);
            container.classList.toggle('active', open);
            widget.setAttribute('data-chat-open', open ? 'true' : 'false');
            document.body.classList.toggle('chatbot-mobile-open', open);
            if (open) {
                container.removeAttribute('hidden');
            } else {
                container.setAttribute('hidden', 'hidden');
            }
        };

        syncState(false);

        widget.addEventListener('click', function (event) {
            var target = event.target instanceof Element ? event.target : null;
            if (!target) return;

            var toggle = target.closest(
                '.chatbot-toggle, [data-action="toggle-chatbot"]'
            );
            var minimize = target.closest('[data-action="minimize-chat"]');
            if (!toggle && !minimize) return;

            event.preventDefault();
            event.stopImmediatePropagation();

            if (minimize) {
                syncState(false);
                return;
            }

            syncState(widget.getAttribute('data-chat-open') !== 'true');
        });
    }

    function bootAll() {
        bootHeroStage();
        bootFamilyTabs();
        bootServiceGrid();
        bootCookieBanner();
        bootChatFallback();
        bootLegacyRuntimeBridge();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootAll, { once: true });
    } else {
        bootAll();
    }
})();
